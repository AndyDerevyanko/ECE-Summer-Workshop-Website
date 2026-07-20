/* visual editor page. same tab/iframe engine as js/preview.js, but always
   in click-to-edit mode (&edit=1) and with its own undo/redo toolbar that
   drives the iframe's history (js/main.js's window.ClickEditHistory),
   since the iframe is same-origin so a direct contentWindow call works. */

/* only ta keys get in here */
function gateCheck() {
  var ok = localStorage.getItem("session") && localStorage.getItem("role") === "ta";
  var app = document.getElementById("edApp");
  var gate = document.getElementById("edGate");
  if (app) app.style.display = ok ? "flex" : "none";
  if (gate) gate.style.display = ok ? "none" : "block";
  return ok;
}

var TAB_PAGES = {
  landing: "index.html?preview=1&edit=1",
  dashboard: "dashboard.html?preview=1&edit=1",
  gallery: "gallery.html?preview=1&edit=1"
};

/**
 * Points the iframe at the given tab's page and marks it active.
 * @param name "landing", "dashboard", or "gallery"
 */
function showTab(name) {
  if (!TAB_PAGES[name]) name = "landing";
  var frame = document.getElementById("edFrame");
  if (frame) frame.src = TAB_PAGES[name];
  document.querySelectorAll(".pv-tab").forEach(function (btn) {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
  });
  try { localStorage.setItem("editor_tab", name); } catch (e) {}
}

/**
 * Reads the iframe's undo/redo stack (js/main.js's window.ClickEditHistory)
 * and enables/disables the toolbar buttons to match. Polled on an interval
 * since edits happen inside the iframe with no event wired back out.
 */
function syncUndoButtons() {
  var frame = document.getElementById("edFrame");
  var undoBtn = document.getElementById("edUndo");
  var redoBtn = document.getElementById("edRedo");
  if (!frame || !undoBtn || !redoBtn) return;
  var history;
  try { history = frame.contentWindow.ClickEditHistory; } catch (e) { history = null; }
  undoBtn.disabled = !history || !history.canUndo();
  redoBtn.disabled = !history || !history.canRedo();
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

  var undoBtn = document.getElementById("edUndo");
  var redoBtn = document.getElementById("edRedo");
  undoBtn.addEventListener("click", function () {
    var frame = document.getElementById("edFrame");
    if (frame.contentWindow.ClickEditHistory) frame.contentWindow.ClickEditHistory.undo();
    syncUndoButtons();
  });
  redoBtn.addEventListener("click", function () {
    var frame = document.getElementById("edFrame");
    if (frame.contentWindow.ClickEditHistory) frame.contentWindow.ClickEditHistory.redo();
    syncUndoButtons();
  });

  setInterval(syncUndoButtons, 400);
  showTab(localStorage.getItem("editor_tab") || "landing");
});
