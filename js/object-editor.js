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

/* localStorage key for a rolling local draft of whatever's on the canvas
   right now: {id, name, data}, id mirrors CURRENT_ID (null for a
   never-saved object). Refreshed every few seconds (persistDraft(), via
   DRAFT_INTERVAL) independently of Save, since the whole point is
   surviving a ta idle-logout mid-edit (js/idle.js's redirect to
   login.html only clears session/role/token/last_active, never this key,
   see loadObject()'s own restore check below) or just a closed tab, not
   only an explicit save. */
var DRAFT_KEY = "object_editor_draft";
var DRAFT_INTERVAL = null;

/**
 * Snapshots the canvas's current scene (object_content, kept live-updated
 * by js/main.js's whole editor engine, see snapshotKey()) plus the name
 * field into the rolling local draft. Cheap and local only, no server
 * round trip, so it can run on a plain interval regardless of session
 * state.
 */
function persistDraft() {
  var raw;
  try { raw = localStorage.getItem("object_content"); } catch (e) { raw = null; }
  var data;
  try { data = raw ? JSON.parse(raw) : {}; } catch (e) { data = {}; }
  var name = document.getElementById("objName").value.trim();
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ id: CURRENT_ID, name: name, data: data }));
  } catch (e) {}
}

/** Starts (or restarts) the periodic local draft autosave. */
function startDraftAutosave() {
  if (DRAFT_INTERVAL) clearInterval(DRAFT_INTERVAL);
  DRAFT_INTERVAL = setInterval(persistDraft, 4000);
}

/**
 * Reads the rolling local draft, if any.
 * @return {id, name, data}, or null if there isn't one / it's unparseable
 */
function readDraft() {
  var raw;
  try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) { raw = null; }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

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
    /* refresh the local draft's own id right away rather than waiting for
       the next 4s tick, so a just-assigned CURRENT_ID (a brand new
       object's first save) is reflected immediately; the draft itself is
       deliberately NOT cleared on save, editing continues on the same page
       afterward and a later idle-logout should still be recoverable, see
       loadObject() */
    persistDraft();
    /* lets any other open tab (the Visual editor's right-click "Add
       element" picker, or instructor.html's own Objects list) know a save
       just happened, see the "storage" listener in js/main.js's
       wireAddElementMenu(); the value itself is never read, only the
       change fires the event, and only in OTHER tabs, never this one */
    try { localStorage.setItem("objects_updated", String(Date.now())); } catch (e) {}
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
    /* the object this draft pointed at is gone, don't resurrect it on a
       later "New" load, see loadObject()'s restore check */
    var d = readDraft();
    if (d && d.id === CURRENT_ID) { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
    window.location.href = "instructor.html#objects";
  }).catch(function () { showMsg("Couldn't delete it, try again.", false); });
}

/** Starts a brand new, unsaved object: a blank canvas with no id yet, discarding any recoverable local draft too, since this is an explicit "start over" action. */
function startNew() {
  try { localStorage.removeItem("object_content"); } catch (e) {}
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  window.location.href = "object-editor.html?object=1";
}

/**
 * Resolves which object (if any) this session is editing, stashes its data
 * into "object_content" for the canvas engine to render, then hands off to
 * js/main.js's initObjectCanvas() (a plain top-level function declaration,
 * already reachable as window.initObjectCanvas) now that it's safe: doing
 * this before that server round trip finishes would race it, see the
 * isObjectMode() branch of js/main.js's own DOMContentLoaded handler.
 *
 * Before doing either, checks the rolling local draft (see persistDraft()/
 * DRAFT_KEY): a ta logged out mid-edit by the idle timer never gets a
 * chance to click Save, and js/idle.js's redirect only clears the session
 * itself, never this key, so the last few seconds of unsaved work are
 * still sitting in localStorage the next time this page loads. A draft
 * matching what's being opened here (the same known id, or a leftover
 * never-saved one when opening fresh with no id at all) wins over a plain
 * server refetch/blank canvas.
 */
function loadObject() {
  CURRENT_ID = idFromUrl();
  var draft = readDraft();

  if (!CURRENT_ID && draft) {
    restoreFromDraft(draft);
    return;
  }

  document.getElementById("objDelete").style.display = CURRENT_ID ? "" : "none";

  if (!CURRENT_ID) {
    try { localStorage.removeItem("object_content"); } catch (e) {}
    document.getElementById("objName").value = "";
    window.initObjectCanvas();
    startDraftAutosave();
    return;
  }

  if (draft && draft.id === CURRENT_ID) {
    document.getElementById("objName").value = draft.name || "";
    try { localStorage.setItem("object_content", JSON.stringify(draft.data || {})); } catch (e) {}
    window.initObjectCanvas();
    startDraftAutosave();
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
    startDraftAutosave();
  }).catch(function () {
    showMsg("Couldn't load that object.", false);
    window.initObjectCanvas();
    startDraftAutosave();
  });
}

/**
 * Reopens a leftover unsaved draft (see loadObject()) instead of the blank
 * canvas a fresh "New object" load would otherwise show.
 * @param draft {id, name, data}, as read from DRAFT_KEY
 */
function restoreFromDraft(draft) {
  CURRENT_ID = draft.id || null;
  if (CURRENT_ID) {
    window.history.replaceState(null, "", "object-editor.html?object=1&id=" + CURRENT_ID);
  }
  document.getElementById("objDelete").style.display = CURRENT_ID ? "" : "none";
  document.getElementById("objName").value = draft.name || "";
  try { localStorage.setItem("object_content", JSON.stringify(draft.data || {})); } catch (e) {}
  window.initObjectCanvas();
  startDraftAutosave();
  showMsg("Restored your last unsaved design.", true);
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
