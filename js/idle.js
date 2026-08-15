/* idle logout. Real input (clicks, keys, scrolling, mouse movement) counts as
   activity; sitting idle past the limit logs you out with a message. Limits
   match TA_IDLE_SECONDS/STUDENT_IDLE_SECONDS in app/db.py - tas get a short
   window since their key edits the site, students only lose the dashboard.

   Loaded by every template except login.html. The clock is per origin
   (localStorage), not per tab, so every tab shares one. Two things make
   "idle" mean what it says: activity has to count from inside the editor's
   iframe (watchFrame()), and a logout must never cost work (flushAutosaves()). */

(function () {
  /* exported before the session check below, so the 401 paths that log a ta
     out without this clock's help (handleExpiredSession() in ta.js and
     accounts.js, authedFetch() in object-editor.js) flush through one place */
  window.IdleClock = { flush: flushAutosaves };

  if (!localStorage.getItem("session")) return;

  var IDLE_LIMIT_MS = (localStorage.getItem("role") === "ta" ? 20 : 240) * 60 * 1000;
  var PING_EVERY_MS = 5 * 60 * 1000;

  /* whether this copy is running inside a frame. A framed copy feeds the
     shared clock and does nothing else: the top window already checks and
     pings for both, and expiring from in here would swap the editor's canvas
     for a login form while the portal chrome carried on regardless. */
  var NESTED = true;
  try { NESTED = window.top !== window; } catch (e) { NESTED = true; }

  var lastWrite = 0;
  /** Stamps last_active with now, throttled so it doesn't hammer localStorage. */
  function touch() {
    var now = Date.now();
    if (now - lastWrite < 15000) return;
    lastWrite = now;
    localStorage.setItem("last_active", String(now));
  }

  /**
   * Returns the last recorded activity timestamp.
   * @return milliseconds since epoch, or 0 if never set
   */
  function lastActive() {
    return +(localStorage.getItem("last_active") || 0);
  }

  /**
   * Runs one window's registered autosave hooks.
   * @param win the window whose hooks to run
   */
  function runSaveHooks(win) {
    var hooks;
    try { hooks = win && win.IdleSaveHooks; } catch (e) { return; } /* cross-origin */
    if (!hooks || !hooks.length) return;
    for (var i = 0; i < hooks.length; i++) {
      try { hooks[i](); } catch (e) {} /* one broken hook mustn't cost the rest their work */
    }
  }

  /**
   * Gives every page a last chance to stash unsaved work before the session
   * goes. A page registers with
   *   (window.IdleSaveHooks = window.IdleSaveHooks || []).push(fn);
   * which depends on no load order, and works even where this script bailed
   * out early for want of a session.
   * @note Hooks save LOCALLY, to the same drafts the next login restores
   * from - never to the server. Being timed out isn't a ta saying "publish",
   * so Apply/Save stay the only things that reach the live site.
   * @note Runs before the token is cleared, and reaches into frames: in the
   * portal the work is happening a document below the window expiring it.
   */
  function flushAutosaves() {
    runSaveHooks(window);
    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) {
      try { runSaveHooks(frames[i].contentWindow); } catch (e) {}
    }
  }

  /** Clears the session out of localStorage and bounces to a logged-out login page. */
  function expire() {
    flushAutosaves(); /* before the clearing below: their work outlives the session */
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("last_active");
    window.location.href = "login.html?expired=1";
  }

  /** Expires the session if idle too long: stale from a previous visit, or gone idle with the tab still open. */
  function check() {
    if (NESTED) return;
    var last = lastActive();
    if (last && Date.now() - last > IDLE_LIMIT_MS) expire();
  }

  /* while a ta is actually here, ping so the server-side session slides
     along with the client one. Goes quiet as soon as input stops. */
  var lastPing = Date.now();
  /** Sends a keep-alive ping to the server if a ta is active and due for one. */
  function maybePing() {
    if (NESTED) return;
    if (localStorage.getItem("role") !== "ta") return;
    var now = Date.now();
    if (now - lastPing < PING_EVERY_MS) return;
    if (now - lastActive() > PING_EVERY_MS) return;
    lastPing = now;
    fetch("/api/ping", {
      headers: { "Authorization": "Bearer " + (localStorage.getItem("token") || "") }
    }).then(function (res) {
      if (res.status === 401) expire();
    }).catch(function () {});
  }

  /* pointermove is in there so reading a long page with the mouse drifting
     counts, not just clicking things */
  var ACTIVITY = ["pointerdown", "keydown", "scroll", "pointermove"];

  /**
   * Starts counting real input on a window or a document as activity.
   * @param target the window or document to listen on
   */
  function bindActivity(target) {
    ACTIVITY.forEach(function (ev) {
      target.addEventListener(ev, touch, { passive: true });
    });
  }

  /**
   * Returns a frame's document, or null if it isn't reachable.
   * @param frame the iframe element
   */
  function frameDoc(frame) {
    try { return frame.contentDocument || null; } catch (e) { return null; }
  }

  /**
   * Counts input inside a same-origin frame as activity out here.
   * @param frame the iframe element to watch
   * @note Events don't cross a frame boundary, so listening on this window
   * alone missed nearly everything a ta does - twenty minutes of editing in
   * the Visual editor looked exactly like twenty minutes away from the desk.
   * @note Re-bound on every load: each sub-tab and every Apply/profile-switch
   * reload is a fresh document.
   */
  function watchFrame(frame) {
    var doc = frameDoc(frame);
    if (doc && !doc.__idleBound) {
      doc.__idleBound = true;
      bindActivity(doc);
      touch(); /* whatever put a page in there was a ta doing something */
    }
    if (frame.__idleWatched) return;
    frame.__idleWatched = true;
    frame.addEventListener("load", function () { watchFrame(frame); });
  }

  /** Watches every frame on the page, picking up any added since the last pass. */
  function watchFrames() {
    if (NESTED) return; /* one level up owns the clock; it watches this frame */
    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) watchFrame(frames[i]);
  }

  check(); /* before touch(), so a stale last_active still logs out */
  touch(); /* landing on the page is input too */
  bindActivity(window);
  watchFrames();
  setInterval(function () { check(); maybePing(); watchFrames(); }, 60000);
})();
