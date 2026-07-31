/* dashboard: renders day panels from content fetched off /api/content */

/* full length of the workshop, used to decide whether a trailing "next day"
   locked card still needs to show once every real day panel is open (see
   renderDays()). The live progress bar itself is a placed "progress"
   custom element now (js/main.js's applyProgressBindings(), bound to the
   same content.variables["total_days"] value), not driven from here
   anymore. Set from /api/content ("Total days" variable), this is just the
   fallback if that's missing. */
var TOTAL_DAYS = 10;

/* filled in by loadContent() before renderDays()/renderExtras() run */
var DAYS = [];
var EXTRAS = [];

/* the full /api/content response, stashed so renderExtras() can read
   content.colors/dark_colors/radius/sizes/text/hidden itself - it can't
   rely on js/main.js's own applyColorOverrides()/applyTextOverrides()/etc.
   sweeps to paint its tiles, since those run against whatever's already in
   the DOM at the time they're called, and this section's tiles are built
   later, after a fetchContent() resolves (see the window.renderExtras hook
   in applySharedEditorOverrides()) - by main.js and dashboard.js's own,
   separately-raced fetch alike, see initDashboardPage()'s doc comment. */
var EXTRAS_CONTENT = null;

/* the shared template default for a tile's filename text field - just the
   local filename chip (js/main.js's buildExtrasFilenameChipHtml(), a
   per-tile-resolved variant of the formula chip that deliberately never
   shows up in the ta variables list) - computed once here since main.js is
   guaranteed to have already run (script tag order) by the time this file's
   own top-level code executes. */
var DEFAULT_EXTRAS_TEXT_HTML = buildExtrasFilenameChipHtml();
var DEFAULT_EXTRAS_EMPTY_HTML = "<strong>Nothing here yet.</strong>";

/* attachments are a plain filename string (legacy), a {type:"link", value}
   object, or a {type:"file", name, url} object for an uploaded file */

/**
 * Checks whether an attachment is a link entry.
 * @param item an attachment (string or {type, ...} object)
 * @return true if it's a {type:"link", value} entry
 */
function isLink(item) { return item && typeof item === "object" && item.type === "link"; }

/**
 * Returns the href an attachment chip should point at.
 * @param item an attachment (string or {type, ...} object)
 * @return the link's url, or "#" for anything unrecognized
 */
function itemHref(item) {
  if (isLink(item)) return item.value;
  if (item && typeof item === "object") return item.url;
  return "#";
}

/**
 * Returns the display label for an attachment chip.
 * @param item an attachment (string or {type, ...} object)
 * @return the link url, the uploaded file's name, or the raw legacy string
 */
function itemLabel(item) {
  if (isLink(item)) return item.value;
  if (item && typeof item === "object") return item.name;
  return item;
}

var LINK_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>';

var IMAGE_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>' +
  '<path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';

var DOC_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>' +
  '<path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>';

var SLIDES_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="M7 21l5-5 5 5"/></svg>';

var FILE_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>';

var IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "tiff", "heic"];
var DOC_EXTS = ["pdf", "doc", "docx", "txt", "rtf", "odt", "pages"];
var SLIDES_EXTS = ["ppt", "pptx", "key", "odp"];

/**
 * Picks an icon off the file extension in the attachment's name (or the
 * filename itself, for the legacy plain-string shape). Falls back to a
 * generic file glyph for anything not recognized (zip, mp3, xlsx, etc).
 * @param item an attachment (string or {type, ...} object)
 * @return an inline svg icon string
 */
function itemIcon(item) {
  if (isLink(item)) return LINK_SVG;
  var name = itemLabel(item) || "";
  var m = /\.([a-z0-9]+)$/i.exec(name);
  var ext = m ? m[1].toLowerCase() : "";
  if (IMAGE_EXTS.indexOf(ext) !== -1) return IMAGE_SVG;
  if (DOC_EXTS.indexOf(ext) !== -1) return DOC_SVG;
  if (SLIDES_EXTS.indexOf(ext) !== -1) return SLIDES_SVG;
  return FILE_SVG;
}

var LOCK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="5" y="11" width="14" height="9" rx="2"/>' +
  '<path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/></svg>';

var UNLOCK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="5" y="11" width="14" height="9" rx="2"/>' +
  '<path d="M8 11V8a4 4 0 0 1 7.5-2"/><path d="M12 14.5v2"/></svg>';

/**
 * Checks whether this page was opened from the ta portal's preview page
 * (see js/preview.js, js/ta.js) rather than by a real student.
 * @return true if ?preview=1 is set
 */
function isPreviewMode() {
  return /[?&]preview=1(&|$)/.test(window.location.search);
}

/* windows-1252's 0x80-0x9f block, the only range where it disagrees with
   latin-1 (euro sign, smart quotes, en/em dash, etc). used by
   repairMojibake() to reverse text that got typed as utf-8 then saved
   somewhere that read those bytes back as cp1252. */
var CP1252_C1 = [
  0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
  0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8D, 0x017D, 0x8F,
  0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x017E, 0x0178
];

/**
 * Reverses "typed/pasted as utf-8, misread as windows-1252" mojibake (eg.
 * an en dash saved somewhere that reads bytes back as cp1252), without
 * touching genuinely accented text: only fires if every character maps to
 * a single cp1252 byte AND those bytes form valid utf-8, which plain
 * latin-1 text almost never does by chance. Loops so text corrupted more
 * than once unwraps fully in one call, capped so a weird string can't loop
 * forever.
 * @param str the string to check/repair
 * @return the repaired string, or the original untouched if it wasn't mojibake
 */
function repairMojibake(str) {
  if (typeof str !== "string" || !str.length) return str;
  for (var pass = 0; pass < 4; pass++) {
    var next = repairMojibakeOnce(str);
    if (next === str) break;
    str = next;
  }
  return str;
}

/**
 * Reverses a single level of the mojibake described in repairMojibake().
 * @param str the string to check/repair
 * @return the repaired string, or the original untouched if it isn't mojibake
 */
function repairMojibakeOnce(str) {
  var hasHighChar = false;
  for (var j = 0; j < str.length; j++) {
    if (str.charCodeAt(j) > 0x7f) { hasHighChar = true; break; }
  }
  if (!hasHighChar) return str;
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
    } else {
      var b = CP1252_C1.indexOf(code);
      if (b === -1) return str; /* not representable as a single cp1252 byte, wasn't mojibake */
      bytes.push(0x80 + b);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch (e) {
    return str; /* not valid utf-8 once reinterpreted, so it wasn't mojibake */
  }
}

/**
 * Walks a content blob and runs repairMojibake() on every string in it, so
 * corrupted text anywhere in a loaded/restored blob fixes itself.
 * @param val any content value (object, array, string, or other)
 * @return the same shape with any mojibake strings repaired
 */
function repairMojibakeDeep(val) {
  if (typeof val === "string") return repairMojibake(val);
  if (Array.isArray(val)) return val.map(repairMojibakeDeep);
  if (val && typeof val === "object") {
    var out = {};
    for (var k in val) out[k] = repairMojibakeDeep(val[k]);
    return out;
  }
  return val;
}

/**
 * Resolves to the site content: the ta portal's unsaved snapshot in
 * preview mode, otherwise the live content from /api/content. Either way
 * runs it through repairMojibakeDeep() first, so a stale corrupted preview
 * snapshot or old saved blob never reaches a real student's screen.
 * @return a promise resolving to the content object
 */
function fetchContent() {
  if (isPreviewMode()) {
    try {
      var raw = localStorage.getItem("preview_content");
      if (raw) return Promise.resolve(repairMojibakeDeep(JSON.parse(raw)));
    } catch (e) {}
  }
  return fetch("/api/content").then(function (res) { return res.json(); }).then(repairMojibakeDeep);
}

/**
 * Formats a day panel's date for its card ("Mon, Jan 5").
 * @param dateStr iso date string (yyyy-mm-dd)
 * @return the formatted date
 */
function fmtDate(dateStr) {
  var d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Shows the dashboard if logged in, otherwise the gate.
 * @return the logged-in username, or null if there's no session
 */
function gateCheck() {
  var session = localStorage.getItem("session");
  var app = document.getElementById("dashApp");
  var gate = document.getElementById("dashGate");
  if (!session) {
    if (app) app.style.display = "none";
    if (gate) gate.style.display = "block";
    return null;
  }
  if (gate) gate.style.display = "none";
  if (app) app.style.display = "block";
  return session;
}

/**
 * Builds a locked "available soon" day card.
 * @param dayNum the day number to show on the card
 * @return the card's html
 */
function soonCard(dayNum) {
  return '<div class="day-card soon">' +
    '<span class="soon-lock">' + LOCK_SVG + '</span>' +
    '<h3>Day ' + dayNum + '</h3>' +
    '<p class="muted">This module will be available soon</p>' +
    '<span class="badge locked">' + LOCK_SVG + 'Locked</span>' +
  '</div>';
}

/**
 * Renders every day panel into #dayGrid: unlocked panels with their
 * content, locked ones as a "soon" card, plus one trailing locked card for
 * the next day once everything so far is open.
 * @return how many day panels are currently unlocked
 */
function renderDays() {
  var grid = document.getElementById("dayGrid");
  if (!grid) return 0;
  var html = "";
  var unlockedCount = 0;
  var allOpen = true;

  DAYS.forEach(function (day) {
    if (!day.unlocked) {
      allOpen = false;
      html += soonCard(day.day);
      return;
    }
    unlockedCount++;
    var chips = day.files.map(function (f) {
      return '<a class="chip" href="' + itemHref(f) + '" target="_blank" rel="noopener">' + itemIcon(f) + ' ' + itemLabel(f) + '</a>';
    }).join("");
    html +=
      '<div class="day-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span class="daytag">Day ' + day.day +
            (day.date ? ' &middot; ' + fmtDate(day.date) : '') + '</span>' +
          '<span class="badge open">' + UNLOCK_SVG + 'Open</span>' +
        '</div>' +
        '<h3>' + day.title + '</h3>' +
        '<p class="muted">' + day.blurb + '</p>' +
        '<div class="links">' + chips + '</div>' +
      '</div>';
  });

  /* once every panel is open, one locked card trails for the next day */
  if (allOpen && DAYS.length < TOTAL_DAYS) {
    html += soonCard(DAYS.length + 1);
  }

  grid.innerHTML = html;
  return unlockedCount;
}

/**
 * Builds one attachment tile's markup: a plain, untracked flex wrapper
 * (data-extras-tile, bound to this specific attachment via data-extras-id/
 * data-extras-filename) holding FOUR INDEPENDENT SIBLING elements - the
 * colored rect, the file-type icon, the filename text, and the Download/
 * Open button - rather than nesting them inside the rect, so a ta deleting
 * the rect (js/main.js's deleteElement(), which explicitly allows it) never
 * cascades to delete the icon/text/button that visually sit on top of it
 * (the rect is position:absolute;inset:0, see css/style.css). All four
 * carry a SHARED, fixed id ("extras.tile.rect"/"extras.tile.icon"/
 * "extras.tile.text"/"extras.tile.button") - the exact same id on every
 * tile's matching element - so this is one shared template rendered once
 * per attachment: a style edit to any single tile's rect/icon/text/button
 * (js/main.js's mirrorExtrasTileStyle(), for the live same-session mirror)
 * or a text edit (mirrorEditedField()) applies everywhere, live and after
 * reload alike, since applyColorOverrides()/applyRadiusOverrides()/
 * applySizeOverrides() already repaint every DOM node sharing one id from
 * the very same saved maps read below - this function just has to paint
 * that same look itself once, up front, since those sweeps already ran
 * (against a DOM that didn't have these tiles yet) by the time this runs.
 * Icon and button are data-extras-fixed (stylable/resizable, never
 * deletable, per the spec); rect and the filename text are ordinary
 * deletable elements. Icon/button/rect never move independently and rect/
 * text never resize independently (js/main.js's startMoveDrag()/
 * startResizeDrag() guards) - the whole tile is laid out by this shared
 * template's own css, not per-instance dragging.
 * @param f one EXTRAS entry (legacy filename string, {type:"link", value},
 *   or {type:"file", name, url, id, children})
 * @param style {rectColor, rectDarkColor, rectRadius, iconSize, buttonSize}
 * @param textHtml content.text["extras.tile.text"], or undefined for the
 *   shared default (just the filename chip)
 * @param buttonHtml content.text["extras.tile.button"], or undefined for
 *   the per-attachment default ("Open"/"Download" - see isLink()), so an
 *   untouched template still shows the same live label live students
 *   already see today
 * @return an HTML string for one tile
 */
function buildExtrasTileHtml(f, style, textHtml, buttonHtml) {
  var filename = itemLabel(f) || "";
  var defaultButtonText = isLink(f) ? "Open" : "Download";
  var rectStyle = "";
  if (style.rectColor || style.rectDarkColor) {
    rectStyle += "background-color:" + resolveThemedColor(style.rectColor, style.rectDarkColor) + ";";
  }
  if (style.rectRadius) rectStyle += "border-radius:" + style.rectRadius + "px;";
  var iconStyle = style.iconSize ? ("width:" + style.iconSize.w + "px;height:" + style.iconSize.h + "px;") : "";
  var btnStyle = style.buttonSize ? ("width:" + style.buttonSize.w + "px;height:" + style.buttonSize.h + "px;") : "";
  return (
    '<div class="res-row extras-tile" data-extras-tile="1" data-extras-id="' + escapeHtml((f && f.id) || "") +
      '" data-extras-filename="' + escapeHtml(filename) + '">' +
      '<div class="extras-tile-rect" data-resize-id="extras.tile.rect" data-extras-role="rect"' +
        (rectStyle ? ' style="' + rectStyle + '"' : "") + ' aria-hidden="true"></div>' +
      '<div class="extras-tile-icon" data-resize-id="extras.tile.icon" data-extras-role="icon" data-extras-fixed="1"' +
        (iconStyle ? ' style="' + iconStyle + '"' : "") + '>' + itemIcon(f) + '</div>' +
      '<span class="extras-tile-text" data-edit-id="extras.tile.text" data-extras-role="text" ' +
        'data-default-html="' + escapeHtml(DEFAULT_EXTRAS_TEXT_HTML) + '">' +
        (textHtml !== undefined ? textHtml : DEFAULT_EXTRAS_TEXT_HTML) +
      '</span>' +
      '<a class="btn btn-ghost extras-tile-btn" data-edit-id="extras.tile.button" data-extras-role="button" data-extras-fixed="1" ' +
        'data-default-html="' + escapeHtml(defaultButtonText) + '"' + (btnStyle ? ' style="' + btnStyle + '"' : "") + ' ' +
        'href="' + escapeHtml(itemHref(f)) + '" target="_blank" rel="noopener">' +
        (buttonHtml !== undefined ? buttonHtml : escapeHtml(defaultButtonText)) +
      '</a>' +
    '</div>'
  );
}

/**
 * Renders the "Extra attachments" section's live area: the always-present
 * (per the ta's own "always editable" answer) empty-state text plus every
 * current attachment's tile, inside the placed "extrasArea" custom element
 * (js/main.js's buildCustomElementNode() "extrasArea" kind, found here by
 * its data-extras-area marker - see applyElementAnchors()/the
 * #dashExtrasAreaAnchor spacer in templates/dashboard.html). Rebuilds this
 * area's whole innerHTML from EXTRAS_CONTENT every time it runs (same as
 * renderDays() does for #dayGrid), since a shared-template style/text edit
 * can touch every tile at once - there's no incremental per-tile diffing
 * here, this section is small.
 * Called via the window.renderExtras hook from js/main.js's
 * applySharedEditorOverrides() AND from this file's own DOMContentLoaded
 * handler below - see EXTRAS_CONTENT's doc comment for why both call it and
 * why that's safe (whichever fetch resolves second is the one that finds
 * both EXTRAS_CONTENT set AND the host div in the DOM, the other no-ops).
 */
function renderExtras() {
  if (!EXTRAS_CONTENT) return;
  var host = document.querySelector('[data-extras-area="1"]');
  if (!host) return;
  var data = EXTRAS_CONTENT;
  var colors = data.colors || {}, darkColors = data.dark_colors || {}, radius = data.radius || {}, sizes = data.sizes || {};
  var text = data.text || {};
  var style = {
    rectColor: colors["extras.tile.rect"], rectDarkColor: darkColors["extras.tile.rect"],
    rectRadius: radius["extras.tile.rect"],
    iconSize: sizes["extras.tile.icon"], buttonSize: sizes["extras.tile.button"]
  };
  var textHtml = text["extras.tile.text"];
  var buttonHtml = text["extras.tile.button"];
  var emptyHtml = text["dash.extras.empty"] !== undefined ? text["dash.extras.empty"] : DEFAULT_EXTRAS_EMPTY_HTML;

  var html =
    '<p class="muted extras-empty' + (EXTRAS.length ? " has-attachments" : "") + '" data-edit-id="dash.extras.empty" ' +
      'data-default-html="' + escapeHtml(DEFAULT_EXTRAS_EMPTY_HTML) + '">' + emptyHtml + '</p>';
  if (EXTRAS.length) {
    html += '<div class="res-list extras-tile-list">' +
      EXTRAS.map(function (f) { return buildExtrasTileHtml(f, style, textHtml, buttonHtml); }).join("") +
      '</div>';
  }
  host.innerHTML = html;

  (data.hidden || []).forEach(function (id) {
    if (id !== "extras.tile.rect" && id !== "extras.tile.text") return;
    host.querySelectorAll('[data-resize-id="' + id + '"], [data-edit-id="' + id + '"]').forEach(function (el) {
      setHiddenVisual(el, true);
    });
  });

  repaintExtrasFilenameChips();

  /* click-to-edit text wiring is a one-time, non-delegated pass
     (js/main.js's wireClickToEdit(), already run by the time either racing
     fetch gets here) - these tiles/empty-state text are built after that
     pass, so each needs wiring by hand, same gating as everywhere else. */
  if (isPreviewMode() && isEditMode()) {
    host.querySelectorAll('[data-edit-id="dash.extras.empty"], [data-edit-id="extras.tile.text"], [data-edit-id="extras.tile.button"]')
      .forEach(wireTextField);
  }
}
window.renderExtras = renderExtras;

/** Clears the session and sends the student back to the login page. */
function logout() {
  localStorage.removeItem("session");
  localStorage.removeItem("role");
  localStorage.removeItem("token");
  localStorage.removeItem("last_active");
  window.location.href = "login.html";
}

/**
 * Strips a link's href and swallows its clicks, so it can't navigate the
 * preview iframe away to a page a real student there shouldn't reach.
 * @param el the link/button to neuter
 */
function neuterLink(el) {
  if (!el) return;
  el.removeAttribute("href");
  el.style.opacity = ".5";
  el.style.cursor = "default";
  el.addEventListener("click", function (e) { e.preventDefault(); });
}

document.addEventListener("DOMContentLoaded", function () {
  var session = gateCheck();
  var logoutBtn = document.getElementById("logoutBtn");
  if (isPreviewMode()) {
    /* previewing isn't a real visit: don't let the brand logo wander the
       ta off to another page, and don't let "Log out" fire for real either,
       since it'd clear the session localStorage shares with the ta's own
       portal tab, ending their actual login just from clicking a preview */
    neuterLink(document.querySelector(".brand"));
    neuterLink(logoutBtn);
  } else if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  if (!session) return;

  fetchContent()
    .then(function (data) {
      DAYS = data.days;
      EXTRAS = data.extras;
      EXTRAS_CONTENT = data;
      var totalDaysVar = (data.variables || []).filter(function (v) { return v.key === "total_days"; })[0];
      TOTAL_DAYS = (totalDaysVar && +totalDaysVar.value) || TOTAL_DAYS;
      renderDays();
      renderExtras();
    });
});
