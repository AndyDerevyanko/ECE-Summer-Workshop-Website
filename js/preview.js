/* preview page. Loads the real landing page/dashboard in an iframe with
   ?preview=1, which tells main.js and dashboard.js to read the
   "preview_content" snapshot from localStorage instead of /api/content.
   Look-only; click-to-edit lives in the portal's Visual editor tab. */

/* only ta keys get in here */
function gateCheck() {
  var ok = localStorage.getItem("session") && localStorage.getItem("role") === "ta";
  var app = document.getElementById("pvApp");
  var gate = document.getElementById("pvGate");
  if (app) app.style.display = ok ? "flex" : "none";
  if (gate) gate.style.display = ok ? "none" : "block";
  return ok;
}

var TAB_PAGES = {
  landing: "index.html?preview=1",
  dashboard: "dashboard.html?preview=1",
  login: "login.html?preview=1",
  gallery: "gallery.html?preview=1",
  notfound: "404.html?preview=1"
};

/**
 * Points the iframe at the given tab's page and marks it active.
 * @param name "landing", "dashboard", "login", "gallery", or "notfound"
 */
function showTab(name) {
  if (!TAB_PAGES[name]) name = "landing";
  var frame = document.getElementById("pvFrame");
  if (frame) frame.src = TAB_PAGES[name];
  document.querySelectorAll(".pv-tab").forEach(function (btn) {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
  });
  try { localStorage.setItem("preview_tab", name); } catch (e) {}
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

  document.querySelectorAll(".pv-tab").forEach(function (btn) {
    btn.addEventListener("click", function () { showTab(this.getAttribute("data-tab")); });
  });

  showTab(localStorage.getItem("preview_tab") || "landing");
});
