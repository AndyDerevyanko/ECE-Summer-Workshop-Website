/* account manager. lists users off /api/users, adds and removes them.
   passwords are typed in plain here (the ta hands them out anyway), the
   server hashes them before they touch the db. */

var USERS = [];

function authHeaders() {
  return { "Authorization": "Bearer " + (localStorage.getItem("token") || "") };
}

function showMsg(text, ok) {
  var el = document.getElementById("accMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/* only ta keys get in here */
function gateCheck() {
  var ok = localStorage.getItem("session") && localStorage.getItem("role") === "ta";
  var app = document.getElementById("accApp");
  var gate = document.getElementById("accGate");
  if (app) app.style.display = ok ? "block" : "none";
  if (gate) gate.style.display = ok ? "none" : "block";
  return ok;
}

var PERSON_SVG =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';

function fetchUsers() {
  return fetch("/api/users", { headers: authHeaders() })
    .then(function (res) {
      if (!res.ok) throw new Error("users failed");
      return res.json();
    })
    .then(function (list) {
      USERS = list;
      renderUsers();
    })
    .catch(function () {
      showMsg("Couldn't load accounts. Check you're still logged in.", false);
    });
}

function removeUser(u) {
  var what = u.role === "ta" ? "TA" : "student";
  if (!confirm("Remove " + what + ' "' + u.username + '"? They won\'t be able to log in anymore.')) return;
  fetch("/api/users/" + encodeURIComponent(u.username), { method: "DELETE", headers: authHeaders() })
    .then(function (res) {
      if (!res.ok) throw new Error("delete failed");
      USERS.splice(USERS.indexOf(u), 1);
      renderUsers();
      showMsg('Removed "' + u.username + '".', true);
    })
    .catch(function () {
      showMsg("Couldn't remove that account.", false);
    });
}

function renderList(el, role, emptyText) {
  if (!el) return;
  var me = localStorage.getItem("session");
  var rows = USERS.filter(function (u) { return u.role === role; });
  if (!rows.length) {
    el.innerHTML = '<p class="muted"><strong>' + emptyText + '</strong></p>';
    return;
  }
  el.innerHTML = "";
  rows.forEach(function (u) {
    var row = document.createElement("div");
    row.className = "res-row";
    row.innerHTML = PERSON_SVG + '<span class="rname"></span>';
    row.querySelector(".rname").textContent = u.username;
    /* students get their password shown, it's a ta-issued handout credential.
       ta passwords are never stored in plain so there's nothing to show. */
    if (u.password) {
      var pw = document.createElement("span");
      pw.className = "rmeta";
      pw.textContent = u.password;
      row.appendChild(pw);
    }
    if (u.username === me) {
      var meTag = document.createElement("span");
      meTag.className = "rmeta";
      meTag.textContent = "that's you";
      row.appendChild(meTag);
    } else {
      var btn = document.createElement("button");
      btn.className = "btn btn-ghost";
      btn.type = "button";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () { removeUser(u); });
      row.appendChild(btn);
    }
    el.appendChild(row);
  });
}

function renderUsers() {
  renderList(document.getElementById("studentList"), "student", "No student accounts yet.");
  renderList(document.getElementById("taList"), "ta", "No TA accounts yet.");
}

function addUser(role, userInput, passInput) {
  var username = userInput.value.trim();
  var password = passInput.value;
  if (!username || !password) {
    showMsg("Both a username and a password are needed.", false);
    return;
  }
  if (role === "ta" && !confirm('Add "' + username + '" as a TA? They get full access to this portal.')) return;
  fetch("/api/users", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
    body: JSON.stringify({ username: username, password: password, role: role })
  })
    .then(function (res) {
      if (res.status === 409) throw new Error("taken");
      if (!res.ok) throw new Error("add failed");
      userInput.value = "";
      passInput.value = "";
      showMsg('Added "' + username + '". They can log in now.', true);
      return fetchUsers();
    })
    .catch(function (err) {
      if (err.message === "taken") showMsg('"' + username + '" is already taken.', false);
      else showMsg("Couldn't add the account. Check you're still logged in.", false);
    });
}

document.addEventListener("DOMContentLoaded", function () {
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
  if (!gateCheck()) return;

  fetchUsers();

  var stuUser = document.getElementById("stuUser");
  var stuPass = document.getElementById("stuPass");
  var taUser = document.getElementById("taUser");
  var taPass = document.getElementById("taPass");

  document.getElementById("stuAdd").addEventListener("click", function () {
    addUser("student", stuUser, stuPass);
  });
  document.getElementById("taAdd").addEventListener("click", function () {
    addUser("ta", taUser, taPass);
  });

  /* enter in a password box adds straight away */
  stuPass.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addUser("student", stuUser, stuPass); }
  });
  taPass.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addUser("ta", taUser, taPass); }
  });
});
