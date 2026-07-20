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

/**
 * Builds the Authorization header for a ta-only request.
 * @return a {Authorization} headers object
 */
function authHeaders() {
  return { "Authorization": "Bearer " + (localStorage.getItem("token") || "") };
}

/** The server says the session's gone: clears local state and bounces to login. */
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
 * Shows a status message under the action row.
 * @param text message to show
 * @param ok true for a success style, false for an error style
 */
function showMsg(text, ok) {
  var el = document.getElementById("edMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/**
 * Labels the profile being edited, if any, the same way js/ta.js's
 * profileLabel() does, for the Apply confirm prompt.
 * @param p a profile row from preview_editing
 * @return the display label
 */
function profileLabel(p) {
  if (p.mine) return p.name;
  if (/^Profile \d+$/.test(p.name)) return p.owner + "'s " + p.name;
  return p.owner + "'s \"" + p.name + "\" profile";
}

/**
 * Reads the ta portal's unsaved-edits snapshot, the same one this page's
 * click-to-edit fields save into (js/main.js's saveTextOverride()).
 * @return the content object, or null if there's nothing to read
 */
function readSnapshot() {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/**
 * Reads which profile (if any) the snapshot belongs to.
 * @return the profile row, or null if editing the live site
 */
function readEditing() {
  var raw;
  try { raw = localStorage.getItem("preview_editing"); } catch (e) { raw = null; }
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

/** Clears the unsaved-edits snapshot, the same one js/ta.js's Preview button writes. */
function clearSnapshot() {
  try {
    localStorage.removeItem("preview_content");
    localStorage.removeItem("preview_editing");
  } catch (e) {}
}

/** Forces the iframe to reload, since just resetting localStorage doesn't refetch on its own. */
function reloadFrame() {
  var frame = document.getElementById("edFrame");
  if (frame && frame.contentWindow) frame.contentWindow.location.reload();
}

/**
 * Apply = make what's in the snapshot live for students, same rule as the
 * content manager's Apply changes button: in profile mode it also saves
 * the profile first so the two can't drift apart.
 */
function applyChanges() {
  var data = readSnapshot();
  if (!data) { showMsg("Nothing to apply yet.", false); return; }
  var editing = readEditing();
  if (editing && !confirm('Apply "' + profileLabel(editing) + '" to the live site? Students will see it right away.')) return;
  showMsg("Applying...", true);
  authedFetch("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
    .then(function (res) {
      if (!res.ok) throw new Error("apply failed");
      if (!editing) {
        clearSnapshot();
        showMsg("Applied. Students see this now.", true);
        return;
      }
      return authedFetch("/api/profiles/" + editing.id, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: data })
      }).then(function (res2) {
        if (!res2.ok) throw new Error("apply failed");
        clearSnapshot();
        showMsg("Profile applied. Students see it now.", true);
      });
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't apply. Check you're still logged in and try again.", false);
    });
}

/** Save = stash the snapshot in a profile, live site untouched. */
function saveToProfile() {
  var data = readSnapshot();
  if (!data) { showMsg("Nothing to save yet.", false); return; }
  var editing = readEditing();
  showMsg("Saving...", true);
  if (editing) {
    authedFetch("/api/profiles/" + editing.id, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: data })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("save failed");
        showMsg("Profile saved. The live site is unchanged.", true);
      })
      .catch(function (err) {
        if (err.message === "expired") return;
        showMsg("Couldn't save. Check you're still logged in and try again.", false);
      });
    return;
  }
  authedFetch("/api/profiles")
    .then(function (res) { return res.json(); })
    .then(function (profiles) {
      var n = 0;
      profiles.forEach(function (p) {
        var m = p.mine && p.name.match(/^Profile (\d+)$/);
        if (m && +m[1] > n) n = +m[1];
      });
      var name = "Profile " + (n + 1);
      return authedFetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, data: data })
      }).then(function (res) {
        if (!res.ok) throw new Error("save failed");
        showMsg('Saved as "' + name + '". The live site is unchanged.', true);
      });
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't save. Check you're still logged in and try again.", false);
    });
}

/**
 * Reset = throw away unsaved edits: back to the live site, or the open
 * profile's last saved data if one's being edited, same rule as the
 * content manager's Reset button.
 */
function resetEdits() {
  if (!confirm("Reset everything back to how it was last saved? This throws away your edits.")) return;
  var editing = readEditing();
  clearSnapshot();
  if (editing) {
    try {
      localStorage.setItem("preview_content", JSON.stringify(editing.data));
      localStorage.setItem("preview_editing", JSON.stringify(editing));
    } catch (e) {}
  }
  reloadFrame();
  showMsg("Reset.", true);
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

  document.getElementById("edApply").addEventListener("click", applyChanges);
  document.getElementById("edSave").addEventListener("click", saveToProfile);
  document.getElementById("edResetBtn").addEventListener("click", resetEdits);

  showTab(localStorage.getItem("editor_tab") || "landing");
});
