/* preview page. shows the ta portal's unsaved STATE inside the real landing
   page and dashboard by loading them in an iframe with ?preview=1, which
   tells js/main.js and js/dashboard.js to read the "preview_content"
   snapshot in localStorage (written by js/ta.js's Preview button) instead
   of fetching /api/content. */

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

/* whether the "Edit text" toggle is on, so text can click-to-edit on the
   landing tab (see wireClickToEdit() in js/main.js). persisted the same
   way as the active tab, so it survives switching tabs/reloading */
var editMode = false;

/**
 * Points the iframe at the given tab's page and marks it active. Appends
 * &edit=1 when the "Edit text" toggle is on, which is what actually turns
 * on click-to-edit for pages that support it (currently just the landing
 * page, via js/main.js).
 * @param name "landing", "dashboard", or "gallery"
 */
function showTab(name) {
  if (!TAB_PAGES[name]) name = "landing";
  var frame = document.getElementById("pvFrame");
  if (frame) frame.src = TAB_PAGES[name] + (editMode ? "&edit=1" : "");
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

  var editToggle = document.getElementById("pvEditToggle");
  try { editMode = localStorage.getItem("preview_edit") === "1"; } catch (e) {}
  if (editToggle) {
    editToggle.classList.toggle("active", editMode);
    editToggle.addEventListener("click", function () {
      editMode = !editMode;
      editToggle.classList.toggle("active", editMode);
      try { localStorage.setItem("preview_edit", editMode ? "1" : "0"); } catch (e) {}
      showTab(localStorage.getItem("preview_tab") || "landing");
    });
  }

  showTab(localStorage.getItem("preview_tab") || "landing");
});
