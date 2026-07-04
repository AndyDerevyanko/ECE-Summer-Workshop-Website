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

// old account system, kept in case accounts come back:
//
//   var signupForm = document.getElementById("signupForm");
//   var tabSignup = document.getElementById("tabSignup");
//   var tabLogin = document.getElementById("tabLogin");
//
//   function showTab(which) {
//     var signup = which === "signup";
//     tabSignup.classList.toggle("active", signup);
//     tabLogin.classList.toggle("active", !signup);
//     signupForm.style.display = signup ? "block" : "none";
//     loginForm.style.display = signup ? "none" : "block";
//   }
//
//   function getUsers() {
//     try { return JSON.parse(localStorage.getItem("users") || "{}"); }
//     catch (e) { return {}; }
//   }
//   function saveUsers(u) { localStorage.setItem("users", JSON.stringify(u)); }
//   function setMsg(el, text, ok) {
//     el.textContent = text;
//     el.className = "form-msg " + (ok ? "ok" : "err");
//   }
//
//   signupForm.addEventListener("submit", function (e) {
//     e.preventDefault();
//     var msg = document.getElementById("signupMsg");
//     var name = document.getElementById("suName").value.trim();
//     var email = document.getElementById("suEmail").value.trim().toLowerCase();
//     var pass = document.getElementById("suPass").value;
//     if (!name || !email || pass.length < 6) {
//       setMsg(msg, "Fill everything in (password needs 6+ characters).", false);
//       return;
//     }
//     var users = getUsers();
//     if (users[email]) {
//       setMsg(msg, "There's already an account with that email.", false);
//       return;
//     }
//     users[email] = { name: name, pass: pass, approved: false };
//     saveUsers(users);
//     setMsg(msg, "Account created. We'll email you once your spot is approved.", true);
//     signupForm.reset();
//   });
