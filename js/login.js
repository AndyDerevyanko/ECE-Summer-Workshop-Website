/* login posts to /api/login, which checks the hashed credentials in the database */

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
        window.location.href = data.role === "ta" ? "instructor.html" : "dashboard.html";
      })
      .catch(function () {
        if (msg) msg.textContent = "Wrong username or password. Check with your TA.";
      });
  });
})();
