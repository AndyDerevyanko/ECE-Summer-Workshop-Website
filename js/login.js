(function () {
  var loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      // whatever they typed in email is just used as a label, blank is fine
      var email = document.getElementById("liEmail");
      localStorage.setItem("session", (email && email.value.trim()) || "guest");
      window.location.href = "dashboard.html";
    });
  }
})();
