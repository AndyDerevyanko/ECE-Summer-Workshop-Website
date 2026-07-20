/* account manager. lists users off /api/users, adds and removes them.
   passwords are typed in plain here (the ta hands them out anyway), the
   server hashes them before they touch the db. */

var USERS = [];

/**
 * Builds the Authorization header for a ta-only request.
 * @return a {Authorization} headers object
 */
function authHeaders() {
  return { "Authorization": "Bearer " + (localStorage.getItem("token") || "") };
}

/**
 * The server says the session's gone (idle timeout, or the account got
 * removed): clears local state and bounces to login with a message instead
 * of quietly failing every button on the page.
 */
function handleExpiredSession() {
  localStorage.removeItem("session");
  localStorage.removeItem("role");
  localStorage.removeItem("token");
  localStorage.removeItem("last_active");
  window.location.href = "login.html?expired=1";
}

/**
 * Fetch with the auth header attached; on a 401 it handles the redirect
 * itself and rejects, so callers only need to handle other failures.
 * @param url request url
 * @param opts fetch options
 * @return a promise resolving to the response (rejects on 401)
 */
function authedFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, authHeaders());
  return fetch(url, opts).then(function (res) {
    if (res.status === 401) { handleExpiredSession(); throw new Error("expired"); }
    return res;
  });
}

/**
 * Shows a status message under the account forms.
 * @param text message to show
 * @param ok true for a success style, false for an error style
 */
function showMsg(text, ok) {
  var el = document.getElementById("accMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/**
 * Only ta keys get in here.
 * @return true if a ta is logged in
 */
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

/**
 * Loads the user list from the server into USERS and re-renders it.
 * @return the underlying fetch promise
 */
function fetchUsers() {
  return authedFetch("/api/users")
    .then(function (res) {
      if (!res.ok) throw new Error("users failed");
      return res.json();
    })
    .then(function (list) {
      USERS = list;
      renderUsers();
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't load accounts. Check you're still logged in.", false);
    });
}

/**
 * Confirms and deletes an account.
 * @param u the user row {username, role, password}
 */
function removeUser(u) {
  var what = u.role === "ta" ? "TA" : "student";
  if (!confirm("Remove " + what + ' "' + u.username + '"? They won\'t be able to log in anymore.')) return;
  authedFetch("/api/users/" + encodeURIComponent(u.username), { method: "DELETE" })
    .then(function (res) {
      if (!res.ok) throw new Error("delete failed");
      USERS.splice(USERS.indexOf(u), 1);
      renderUsers();
      showMsg('Removed "' + u.username + '".', true);
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't remove that account.", false);
    });
}

/**
 * Renders one role's account list (students or tas) into a container.
 * @param el the list container element
 * @param role "student" or "ta"
 * @param emptyText message shown when there are no accounts of that role
 */
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

/** Renders both the student and ta account lists. */
function renderUsers() {
  renderList(document.getElementById("studentList"), "student", "No student accounts yet.");
  renderList(document.getElementById("taList"), "ta", "No TA accounts yet.");
}

/**
 * Reads the add-account form and posts a new account to the server.
 * @param role "student" or "ta"
 * @param userInput the username input element
 * @param passInput the password input element
 */
function addUser(role, userInput, passInput) {
  var username = userInput.value.trim();
  var password = passInput.value;
  if (!username || !password) {
    showMsg("Both a username and a password are needed.", false);
    return;
  }
  if (role === "ta" && !confirm('Add "' + username + '" as a TA? They get full access to this portal.')) return;
  authedFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
      if (err.message === "expired") return;
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
    localStorage.removeItem("last_active");
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
