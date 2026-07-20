/* preview page. shows the ta portal's unsaved STATE inside the real landing
   page and dashboard by loading them in an iframe with ?preview=1, which
   tells js/main.js and js/dashboard.js to read the "preview_content"
   snapshot in localStorage (written by js/ta.js's Preview button) instead
   of fetching /api/content. look-only: click-to-edit lives in the ta portal's
   own Visual editor tab (instructor.html/js/ta.js), same engine
   (js/main.js's wireClickToEdit()). */

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
  gallery: "gallery.html?preview=1"
};

/**
 * Points the iframe at the given tab's page and marks it active.
 * @param name "landing", "dashboard", or "gallery"
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
