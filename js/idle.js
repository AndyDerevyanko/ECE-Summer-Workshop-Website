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
  function touch() {
    var now = Date.now();
    if (now - lastWrite < 15000) return; /* don't hammer localStorage */
    lastWrite = now;
    localStorage.setItem("last_active", String(now));
  }

  function lastActive() {
    return +(localStorage.getItem("last_active") || 0);
  }

  function expire() {
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("last_active");
    window.location.href = "login.html?expired=1";
  }

  /* stale from a previous visit, or went idle with the tab still open */
  function check() {
    var last = lastActive();
    if (last && Date.now() - last > IDLE_LIMIT_MS) expire();
  }

  /* while a ta is actually here, ping so the server-side session slides
     along with the client one. goes quiet as soon as input stops. */
  var lastPing = Date.now();
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
