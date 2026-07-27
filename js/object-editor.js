/* reusable-object mini editor (templates/object-editor.html): a slim
   toolbar (name/save/new/delete/undo/redo) wrapped around the exact same
   visual-editor engine js/main.js already provides for the real Visual
   editor tab, just aimed at a blank canvas (object mode, see
   isObjectMode()/snapshotKey()/initObjectCanvas() in js/main.js) instead of
   editing the live page. Objects are their own shared, ta-uploadable-style
   library (GET/POST/DELETE /api/objects, app/main.py), independent of the
   content blob/profiles system entirely, same "visible to every ta right
   away, owner-only delete" model custom_assets already uses for icons/
   fonts/videos. */

/** Shows or hides the gate depending on whether a ta session is present. */
function gateCheck() {
  var ok = localStorage.getItem("session") && localStorage.getItem("role") === "ta";
  var app = document.getElementById("objApp");
  var gate = document.getElementById("objGate");
  var hint = document.getElementById("objCanvasHint");
  if (app) app.style.display = ok ? "flex" : "none";
  if (gate) gate.style.display = ok ? "none" : "block";
  if (hint) hint.style.display = ok ? "" : "none";
  return ok;
}

/**
 * Bearer-authed fetch, same token-straight-out-of-localStorage convention
 * js/main.js's assetFetch() uses (this page never loads js/ta.js, so its
 * authedFetch() isn't available here either). On a 401 it clears the
 * session and bounces to login, same as every other ta-only page.
 * @param url request url
 * @param opts fetch options
 * @return the fetch promise (rejects on a 401, after redirecting)
 */
function authedFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, { "Authorization": "Bearer " + (localStorage.getItem("token") || "") });
  return fetch(url, opts).then(function (res) {
    if (res.status === 401) {
      localStorage.removeItem("session");
      localStorage.removeItem("role");
      localStorage.removeItem("token");
      localStorage.removeItem("last_active");
      window.location.href = "login.html?expired=1";
      throw new Error("expired");
    }
    return res;
  });
}

/**
 * Shows a status message in the toolbar.
 * @param text message to show
 * @param ok true for a success style, false for an error style
 */
function showMsg(text, ok) {
  var el = document.getElementById("objMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/* the object currently being edited, if it already exists on the server (see /api/objects); null while building a brand new one that's never been saved yet */
var CURRENT_ID = null;

/**
 * Reads ?id=N off the url.
 * @return the object id, or null if not editing an existing one
 */
function idFromUrl() {
  var m = /[?&]id=(\d+)/.exec(window.location.search);
  return m ? parseInt(m[1], 10) : null;
}

/** Enables/disables the toolbar's Undo/Redo buttons to match the canvas's own history stack (js/main.js's window.ClickEditHistory). */
function syncUndoButtons() {
  var undoBtn = document.getElementById("objUndo");
  var redoBtn = document.getElementById("objRedo");
  var history = window.ClickEditHistory;
  undoBtn.disabled = !history || !history.canUndo();
  redoBtn.disabled = !history || !history.canRedo();
}

/**
 * Saves the canvas's current scene (js/main.js has already been persisting
 * every edit into localStorage's "object_content" key throughout, see
 * snapshotKey()) to the shared objects library: creates a new row the
 * first time, updates the same one on every save after that.
 */
function saveObject() {
  var raw;
  try { raw = localStorage.getItem("object_content"); } catch (e) { raw = null; }
  var data;
  try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = {}; }
  var name = document.getElementById("objName").value.trim() || "Object";
  var body = JSON.stringify({ name: name, data: data });
  var req = CURRENT_ID ?
    authedFetch("/api/objects/" + CURRENT_ID, { method: "POST", headers: { "Content-Type": "application/json" }, body: body }) :
    authedFetch("/api/objects", { method: "POST", headers: { "Content-Type": "application/json" }, body: body });
  req.then(function (res) {
    if (!res.ok) throw new Error("save failed");
    return res.json();
  }).then(function (result) {
    if (!CURRENT_ID && result.id) {
      CURRENT_ID = result.id;
      window.history.replaceState(null, "", "object-editor.html?object=1&id=" + CURRENT_ID);
      document.getElementById("objDelete").style.display = "";
    }
    showMsg("Saved.", true);
  }).catch(function () {
    showMsg("Couldn't save, try again.", false);
  });
}

/** Deletes the object currently being edited (owner only, enforced server-side) and returns to the library list. */
function deleteObject() {
  if (!CURRENT_ID) return;
  if (!window.confirm("Delete this object? This can't be undone.")) return;
  authedFetch("/api/objects/" + CURRENT_ID, { method: "DELETE" }).then(function (res) {
    if (!res.ok) throw new Error("delete failed");
    window.location.href = "instructor.html#objects";
  }).catch(function () { showMsg("Couldn't delete it, try again.", false); });
}

/** Starts a brand new, unsaved object: a blank canvas with no id yet. */
function startNew() {
  try { localStorage.removeItem("object_content"); } catch (e) {}
  window.location.href = "object-editor.html?object=1";
}

/**
 * Resolves which object (if any) this session is editing, stashes its data
 * into "object_content" for the canvas engine to render, then hands off to
 * js/main.js's initObjectCanvas() (a plain top-level function declaration,
 * already reachable as window.initObjectCanvas) now that it's safe: doing
 * this before that server round trip finishes would race it, see the
 * isObjectMode() branch of js/main.js's own DOMContentLoaded handler.
 */
function loadObject() {
  CURRENT_ID = idFromUrl();
  document.getElementById("objDelete").style.display = CURRENT_ID ? "" : "none";
  if (!CURRENT_ID) {
    try { localStorage.removeItem("object_content"); } catch (e) {}
    document.getElementById("objName").value = "";
    window.initObjectCanvas();
    return;
  }
  authedFetch("/api/objects").then(function (res) { return res.json(); }).then(function (list) {
    var obj = list.filter(function (o) { return o.id === CURRENT_ID; })[0];
    if (!obj) {
      showMsg("That object no longer exists.", false);
      CURRENT_ID = null;
      document.getElementById("objDelete").style.display = "none";
      obj = { name: "", data: {} };
    }
    document.getElementById("objName").value = obj.name || "";
    try { localStorage.setItem("object_content", JSON.stringify(obj.data || {})); } catch (e) {}
    window.initObjectCanvas();
  }).catch(function () {
    showMsg("Couldn't load that object.", false);
    window.initObjectCanvas();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  /* isObjectMode()/snapshotKey() (js/main.js) key every canvas action off
     ?object=1 being in the url; a direct or bookmarked load without it
     needs fixing up first (a full reload, so js/main.js's own
     DOMContentLoaded handler, registered before this file's, sees the
     corrected url from a clean start rather than needing to be poked) */
  if (!/[?&]object=1(&|$)/.test(window.location.search)) {
    var sep = window.location.search ? "&" : "?";
    window.location.replace(window.location.pathname + window.location.search + sep + "object=1" + window.location.hash);
    return;
  }

  if (!gateCheck()) return;

  document.getElementById("objSave").addEventListener("click", saveObject);
  document.getElementById("objNew").addEventListener("click", startNew);
  document.getElementById("objDelete").addEventListener("click", deleteObject);
  document.getElementById("objUndo").addEventListener("click", function () {
    if (window.ClickEditHistory) window.ClickEditHistory.undo();
    syncUndoButtons();
  });
  document.getElementById("objRedo").addEventListener("click", function () {
    if (window.ClickEditHistory) window.ClickEditHistory.redo();
    syncUndoButtons();
  });
  setInterval(syncUndoButtons, 400);

  loadObject();
});
