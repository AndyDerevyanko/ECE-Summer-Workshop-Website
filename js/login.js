/* login checks username + password against the pregenerated pairs in keys.js */
/* all local, no server. which list you're in decides student vs ta. */

(function () {
  var loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var userEl = document.getElementById("liUser");
    var passEl = document.getElementById("liPass");
    var msg = document.getElementById("loginMsg");
    var user = (userEl && userEl.value.trim()) || "";
    var pass = (passEl && passEl.value) || "";

    /* keys.js is gitignored, so a fresh clone won't have it */
    if (typeof STUDENTS === "undefined" || typeof TAS === "undefined") {
      if (msg) msg.textContent = "Login list missing, ask the coordinator for keys.js.";
      return;
    }

    if (TAS[user] === pass) {
      localStorage.setItem("session", user);
      localStorage.setItem("role", "ta");
      window.location.href = "instructor.html";
      return;
    }
    if (STUDENTS[user] === pass) {
      localStorage.setItem("session", user);
      localStorage.setItem("role", "student");
      window.location.href = "dashboard.html";
      return;
    }

    if (msg) msg.textContent = "Wrong username or password. Check with your TA.";
  });
})();
