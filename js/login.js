/* login posts to /api/login, which checks the hashed credentials in the database */

(function () {
  var loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  /* bounced here by an idle-timed-out session (see handleExpiredSession
     in js/ta.js and js/accounts.js), say so instead of a blank form */
  if (/[?&]expired=1(&|$)/.test(window.location.search)) {
    var expiredMsg = document.getElementById("loginMsg");
    if (expiredMsg) {
      expiredMsg.textContent = "You were logged out after a while of inactivity. Log in again.";
      expiredMsg.className = "form-msg err";
    }
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var userEl = document.getElementById("liUser");
    var passEl = document.getElementById("liPass");
    var msg = document.getElementById("loginMsg");
    var user = (userEl && userEl.value.trim()) || "";
    var pass = (passEl && passEl.value) || "";

    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("bad login");
        return res.json();
      })
      .then(function (data) {
        localStorage.setItem("session", data.username);
        localStorage.setItem("role", data.role);
        localStorage.setItem("token", data.token);
        /* fresh start for the idle clock (js/idle.js), a stale timestamp
           from an old visit would log the new session straight back out */
        localStorage.setItem("last_active", String(Date.now()));
        window.location.href = data.role === "ta" ? "instructor.html" : "dashboard.html";
      })
      .catch(function () {
        if (msg) msg.textContent = "Wrong username or password. Check with a staff member.";
      });
  });
})();
