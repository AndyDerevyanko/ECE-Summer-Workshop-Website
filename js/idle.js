/* idle logout for the logged-in pages. real input (clicks, keys, scrolling,
   moving the mouse) counts as activity; sitting idle past the limit logs you
   out with a message. tas get a short window since their key edits the site,
   students just lose the dashboard so theirs is lazier. limits match
   TA_IDLE_SECONDS/STUDENT_IDLE_SECONDS in app/db.py. */

(function () {
  if (!localStorage.getItem("session")) return;

  var IDLE_LIMIT_MS = (localStorage.getItem("role") === "ta" ? 20 : 240) * 60 * 1000;
  var PING_EVERY_MS = 5 * 60 * 1000;

  var lastWrite = 0;
  /** Stamps last_active with now, throttled so it doesn't hammer localStorage. */
  function touch() {
    var now = Date.now();
    if (now - lastWrite < 15000) return; /* don't hammer localStorage */
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

  /** Clears the session out of localStorage and bounces to a logged-out login page. */
  function expire() {
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("last_active");
    window.location.href = "login.html?expired=1";
  }

  /** Expires the session if idle too long: stale from a previous visit, or gone idle with the tab still open. */
  function check() {
    var last = lastActive();
    if (last && Date.now() - last > IDLE_LIMIT_MS) expire();
  }

  /* while a ta is actually here, ping so the server-side session slides
     along with the client one. goes quiet as soon as input stops. */
  var lastPing = Date.now();
  /** Sends a keep-alive ping to the server if a ta is active and due for one. */
  function maybePing() {
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

  check(); /* before touch(), so a stale last_active still logs out */
  touch(); /* landing on the page is input too */
  ["pointerdown", "keydown", "scroll", "pointermove"].forEach(function (ev) {
    window.addEventListener(ev, touch, { passive: true });
  });
  setInterval(function () { check(); maybePing(); }, 60000);
})();
