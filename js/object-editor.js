/* reusable-object mini editor: a slim toolbar wrapped around the same
   visual-editor engine main.js drives the real Visual editor tab with, aimed
   at a blank canvas (object mode) instead of the live page. Objects are their
   own shared library (/api/objects), independent of the content blob and
   profiles, on the same "every ta sees it, owner-only delete" model as the
   custom icon/font/video assets. */

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
 * Bearer-authed fetch. On a 401 it clears the session and bounces to login.
 * @param url request url
 * @param opts fetch options
 * @return the fetch promise (rejects on a 401, after redirecting)
 */
function authedFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, { "Authorization": "Bearer " + (localStorage.getItem("token") || "") });
  return fetch(url, opts).then(function (res) {
    if (res.status === 401) {
      if (window.IdleClock) window.IdleClock.flush();
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

/* id of the object being edited; null while building a never-saved one */
var CURRENT_ID = null;

/* localStorage key for a rolling draft of the canvas: {id, name, data}.
   Refreshed every few seconds independently of Save, so an idle logout or a
   closed tab mid-edit is recoverable (see loadObject()'s restore check). */
var DRAFT_KEY = "object_editor_draft";
var DRAFT_INTERVAL = null;

/**
 * Snapshots the canvas's scene (object_content, kept up to date by main.js)
 * plus the name field into the rolling local draft.
 * @note Local only, no server round trip, so it can run on a plain interval
 * regardless of session state.
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

/* the draft is only seconds old, but seconds is exactly the window a logout
   lands in, so take one more on the way out (idle.js's flushAutosaves()) */
(window.IdleSaveHooks = window.IdleSaveHooks || []).push(function () {
  if (DRAFT_INTERVAL) persistDraft(); /* only while there's really a canvas being edited */
});

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
 * Saves the canvas's scene to the shared objects library: creates a row the
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
    /* pick up a just-assigned CURRENT_ID now rather than on the next 4s
       tick. Deliberately not cleared on save: editing carries on afterward
       and a later idle-logout should still be recoverable. */
    persistDraft();
    /* tells other open tabs (the Add-element picker, the Objects list) that
       a save happened - the value is never read, only the change matters,
       and "storage" fires in other tabs, never this one */
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
    /* the object this draft pointed at is gone; don't resurrect it later */
    var d = readDraft();
    if (d && d.id === CURRENT_ID) { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }
    window.location.href = "instructor.html#objects";
  }).catch(function () { showMsg("Couldn't delete it, try again.", false); });
}

/** Starts a blank unsaved object, discarding any recoverable draft - this is an explicit "start over". */
function startNew() {
  try { localStorage.removeItem("object_content"); } catch (e) {}
  try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  window.location.href = "object-editor.html?object=1";
}

/**
 * Resolves which object this session is editing, stashes its data into
 * "object_content", then hands off to main.js's initObjectCanvas() - which
 * has to wait until after the server round trip, or it races it.
 * @note Checks the rolling draft first: a ta logged out mid-edit never got
 * to click Save, so a draft matching what's being opened (same id, or a
 * leftover never-saved one) wins over a refetch or a blank canvas.
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
 * Reopens a leftover unsaved draft instead of a blank canvas.
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
  /* main.js keys every canvas action off ?object=1 being in the url, so a
     bookmarked load without it gets a full reload rather than a poke -
     main.js's own handler runs before this one and needs the fixed url */
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
