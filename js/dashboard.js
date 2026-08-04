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

/* same idea as EXTRAS_CONTENT, for renderDays() - both point at the same
   fetched content object, kept as two named globals just so each render
   function's own doc comments/reads stay obviously scoped to their own
   section. */
var DAYS_CONTENT = null;

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

/* every attachment-type glyph keyed by the short name a tile carries in its
   own data-extras-kind attribute (see buildExtrasTileHtml()), so the icon a
   tile should show can be re-derived from the DOM alone - that's what lets
   js/main.js paint an "attachment icon" element (its tile-exclusive
   "extrasIcon" element kind) per tile without knowing anything about
   attachments itself, see attachmentIconSvgFor() below. */
var ATTACH_ICONS = { link: LINK_SVG, image: IMAGE_SVG, doc: DOC_SVG, slides: SLIDES_SVG, file: FILE_SVG };

/**
 * Picks the icon KIND off the file extension in the attachment's name (or
 * the filename itself, for the legacy plain-string shape). Falls back to a
 * generic file glyph for anything not recognized (zip, mp3, xlsx, etc).
 * @param item an attachment (string or {type, ...} object)
 * @return one of ATTACH_ICONS's keys
 */
function itemIconKey(item) {
  if (isLink(item)) return "link";
  var name = itemLabel(item) || "";
  var m = /\.([a-z0-9]+)$/i.exec(name);
  var ext = m ? m[1].toLowerCase() : "";
  if (IMAGE_EXTS.indexOf(ext) !== -1) return "image";
  if (DOC_EXTS.indexOf(ext) !== -1) return "doc";
  if (SLIDES_EXTS.indexOf(ext) !== -1) return "slides";
  return "file";
}

/**
 * The inline svg for an attachment's type icon.
 * @param item an attachment (string or {type, ...} object)
 * @return an inline svg icon string
 */
function itemIcon(item) {
  return ATTACH_ICONS[itemIconKey(item)];
}

/**
 * The type icon a given rendered attachment tile should show, resolved off
 * the tile's own data-extras-kind rather than the attachment object - the
 * DOM-only lookup js/main.js's repaintExtrasTypeIcons() needs, since a ta
 * can place an "attachment icon" element onto one tile and have every
 * sibling tile paint ITS OWN correct glyph into the same shared-template
 * element (a .pdf tile shows the document glyph, a link tile the chain).
 * @param tileEl a [data-extras-tile] element
 * @return an inline svg icon string (the generic file glyph if unknown)
 */
function attachmentIconSvgFor(tileEl) {
  var key = tileEl && tileEl.getAttribute ? tileEl.getAttribute("data-extras-kind") : "";
  return ATTACH_ICONS[key] || FILE_SVG;
}
window.attachmentIconSvgFor = attachmentIconSvgFor;

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

/* isPreviewMode()/repairMojibake*()/fetchContent() used to be declared here
   too, character for character the same as js/main.js's. They weren't
   harmless duplicates: this file is loaded AFTER main.js, so each of those
   top-level declarations quietly REPLACED main.js's own, and every call in
   both files - main.js's initDashboardPage() included - ran this copy. The
   moment main.js's fetchContent() grew the seeded-element top-up
   (mergeSeededElements(), the thing that keeps a ta's older draft from
   previewing a page with its live areas missing and then applying that over
   the real site), the dashboard silently didn't get it. Deleted outright
   rather than kept in sync: main.js is already loaded on this page, so there
   is exactly one copy now and no way for the two to drift again. */

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
 * Shows the dashboard if logged in, otherwise the locked-out page. Both are
 * real, editable pages in the same file and only one is ever in the document;
 * which one is entirely js/main.js's applyDashSessionState() to decide - the
 * same call the override pipeline makes after every re-render, so the two
 * can't drift - and this is now only here for its return value and its name.
 * Idempotent, and called more than once per load (js/main.js's
 * initDashboardPage() runs it too, see its doc comment).
 * @return the logged-in username, or null if there's no session
 */
function gateCheck() {
  applyDashSessionState();
  return localStorage.getItem("session") || null;
}

/**
 * Reads the shared "extras.tile.*" template's style overrides off a content
 * blob - the exact same lookup renderExtras() needs for the main Extra
 * attachments tiles, and renderDays() needs again for a day's own files[],
 * since both render through the identical buildExtrasTileHtml() template
 * (see its doc comment - a day's attachment tiles and the main section's
 * are meant to restyle together, not independently). Factored out once
 * rather than duplicated so there's exactly one place reading these keys.
 * The Download and Open buttons deliberately keep their own separate sizes
 * (see buildExtrasTileHtml()'s doc comment on the two button ids), so both
 * are read here and the tile picks whichever one it is.
 * @param data a content blob (EXTRAS_CONTENT/DAYS_CONTENT)
 * @return {rectColor, rectDarkColor, rectRadius, iconSize, buttonSize,
 *   buttonLinkSize}
 */
function extrasTileStyleFrom(data) {
  var colors = data.colors || {}, darkColors = data.dark_colors || {}, radius = data.radius || {}, sizes = data.sizes || {};
  return {
    rectColor: colors["extras.tile.rect"], rectDarkColor: darkColors["extras.tile.rect"],
    rectRadius: radius["extras.tile.rect"],
    iconSize: sizes["extras.tile.icon"],
    buttonSize: sizes["extras.tile.button"], buttonLinkSize: sizes["extras.tile.button.link"]
  };
}

/* the shared template defaults for a day tile's chip-eligible text fields -
   local "day-number"/"day-date" chips (js/main.js's buildDaysChipHtml(), the
   day-tile equivalent of the filename chip), same "computed once, main.js
   is guaranteed to have already run" reasoning as DEFAULT_EXTRAS_TEXT_HTML. */
var DEFAULT_DAYS_LOCKED_TITLE_HTML = buildDaysChipHtml("day-number", "Day #");
var DEFAULT_DAYS_OPEN_DAYTAG_HTML =
  buildDaysChipHtml("day-number", "Day #") + ' &middot; ' + buildDaysChipHtml("day-date", "date");
/* the open tile's headline/blurb are chips too now: the words themselves are
   still per-day content typed in the content manager (STATE.days[i].title/
   blurb), but in the visual editor they're reached as a VARIABLE inside an
   ordinary, restyleable text field - so a ta can move/resize/recolour the
   field, or type extra words around the chip, without ever being able to
   overwrite one day's actual title from here. See buildDayOpenTileHtml(). */
var DEFAULT_DAYS_OPEN_TITLE_HTML = buildDaysChipHtml("day-title", "Title");
var DEFAULT_DAYS_OPEN_BLURB_HTML = buildDaysChipHtml("day-blurb", "Description");

/**
 * Builds one LOCKED day tile's markup: a shared template rendered once per
 * still-locked day (plus, per allOpen below, one trailing synthetic "next
 * day" instance with no backing content.days[] entry) - same "one style
 * edit applies to every instance" shared-template idea as
 * buildExtrasTileHtml(), using its own independent set of ids
 * ("days.locked.*") so restyling a locked tile never touches an open one
 * (the two states are deliberately separate templates, not one template
 * that swaps pieces). The big lock icon and the "Locked" badge are
 * data-days-fixed (stylable/resizable, never deletable); the rect and the
 * title text are ordinary deletable elements, restorable via right-click
 * (see js/main.js's insertDaysChip()).
 * @param dayId the day's own stable id, or "" for the trailing synthetic card
 * @param dayNum the day number to show
 * @param style {rectColor, rectDarkColor, rectRadius} (reads "days.locked.*"
 *   keys, independent from the open template's own style)
 * @param titleHtml content.text["days.locked.title"], or undefined for the
 *   shared default (just the day-number chip)
 * @param badgeHtml content.text["days.locked.badge"], or undefined for "Locked"
 * @return an HTML string for one locked tile
 */
function buildDayLockedTileHtml(dayId, dayNum, style, titleHtml, badgeHtml) {
  var rectStyle = "";
  if (style.rectColor || style.rectDarkColor) {
    rectStyle += "background-color:" + resolveThemedColor(style.rectColor, style.rectDarkColor) + ";";
  }
  if (style.rectRadius) rectStyle += "border-radius:" + style.rectRadius + "px;";
  var iconStyle = style.iconSize ? ("width:" + style.iconSize.w + "px;height:" + style.iconSize.h + "px;") : "";
  return (
    '<div class="day-card soon" data-days-tile="1" data-resize-id="days.tile"' +
      ' data-days-id="' + escapeHtml(dayId) +
      '" data-days-locked="1" data-days-number="' + dayNum +
      '" data-days-var="Day' + dayNum + '">' +
      '<div class="day-tile-rect" data-resize-id="days.locked.rect" data-days-role="locked.rect" aria-hidden="true"' +
        (rectStyle ? ' style="' + rectStyle + '"' : "") + '></div>' +
      '<span class="soon-lock" data-resize-id="days.locked.icon" data-days-role="locked.icon" data-days-fixed="1"' +
        (iconStyle ? ' style="' + iconStyle + '"' : "") + '>' + LOCK_SVG + '</span>' +
      '<h3 data-edit-id="days.locked.title" data-days-role="locked.title" ' +
        'data-default-html="' + escapeHtml(DEFAULT_DAYS_LOCKED_TITLE_HTML) + '">' +
        (titleHtml !== undefined ? titleHtml : DEFAULT_DAYS_LOCKED_TITLE_HTML) +
      '</h3>' +
      '<p class="muted">This module will be available soon</p>' +
      '<span class="badge locked" data-edit-id="days.locked.badge" data-days-role="locked.badge" data-days-fixed="1" ' +
        'data-default-html="Locked">' + LOCK_SVG + (badgeHtml !== undefined ? badgeHtml : "Locked") +
      '</span>' +
    '</div>'
  );
}

/**
 * Builds one OPEN day tile's markup: same shared-template idea as
 * buildDayLockedTileHtml(), its own independent "days.open.*" ids. Title and
 * blurb are still real per-day content a ta types in the content manager's
 * day panel (STATE.days[i].title/blurb) - but they're rendered through a
 * shared, restyleable text field carrying a local chip that resolves to THIS
 * tile's own value (data-days-title/data-days-blurb below, painted by
 * js/main.js's repaintDaysChips()), the same treatment the day number/date
 * already get. The attachment list reuses buildExtrasTileHtml() verbatim
 * (js/main.js's findBoundTileOwner() already knows to look inside a day's own
 * files[] too), so a day's attachments and the main Extra attachments
 * section's tiles restyle together as one shared template everywhere they
 * appear.
 * @param day one DAYS entry (id, day, date, title, blurb, files, children)
 * @param style {rectColor, rectDarkColor, rectRadius} (reads "days.open.*" keys)
 * @param text the content.text map (read for every "days.open.*" id plus the
 *   shared "extras.tile.*" ones the attachment tiles below need)
 * @param extrasStyle see extrasTileStyleFrom() - shared with renderExtras()
 * @return an HTML string for one open tile
 */
function buildDayOpenTileHtml(day, style, text, extrasStyle) {
  var daytagHtml = text["days.open.daytag"];
  var badgeHtml = text["days.open.badge"];
  var titleHtml = text["days.open.title"];
  var blurbHtml = text["days.open.blurb"];
  var varBase = "Day" + day.day;
  var rectStyle = "";
  if (style.rectColor || style.rectDarkColor) {
    rectStyle += "background-color:" + resolveThemedColor(style.rectColor, style.rectDarkColor) + ";";
  }
  if (style.rectRadius) rectStyle += "border-radius:" + style.rectRadius + "px;";
  var chips = (day.files || []).map(function (f, j) {
    return buildExtrasTileHtml(f, extrasStyle, text, varBase + "Attachment" + (j + 1), "days.attach.tile");
  }).join("");
  return (
    '<div class="day-card" data-days-tile="1" data-resize-id="days.tile"' +
      ' data-days-id="' + escapeHtml(day.id || "") +
      '" data-days-locked="0" data-days-number="' + day.day +
      '" data-days-var="' + escapeHtml(varBase) +
      '" data-days-title="' + escapeHtml(day.title || "") +
      '" data-days-blurb="' + escapeHtml(day.blurb || "") +
      '" data-days-date="' + escapeHtml(day.date ? fmtDate(day.date) : "") + '">' +
      '<div class="day-tile-rect" data-resize-id="days.open.rect" data-days-role="open.rect" aria-hidden="true"' +
        (rectStyle ? ' style="' + rectStyle + '"' : "") + '></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<span class="daytag" data-edit-id="days.open.daytag" data-days-role="open.daytag" ' +
          'data-default-html="' + escapeHtml(DEFAULT_DAYS_OPEN_DAYTAG_HTML) + '">' +
          (daytagHtml !== undefined ? daytagHtml : DEFAULT_DAYS_OPEN_DAYTAG_HTML) +
        '</span>' +
        '<span class="badge open" data-edit-id="days.open.badge" data-days-role="open.badge" data-days-fixed="1" ' +
          'data-default-html="Open">' + UNLOCK_SVG + (badgeHtml !== undefined ? badgeHtml : "Open") +
        '</span>' +
      '</div>' +
      '<h3 data-edit-id="days.open.title" data-days-role="open.title" ' +
        'data-default-html="' + escapeHtml(DEFAULT_DAYS_OPEN_TITLE_HTML) + '">' +
        (titleHtml !== undefined ? titleHtml : DEFAULT_DAYS_OPEN_TITLE_HTML) +
      '</h3>' +
      '<p class="muted" data-edit-id="days.open.blurb" data-days-role="open.blurb" ' +
        'data-default-html="' + escapeHtml(DEFAULT_DAYS_OPEN_BLURB_HTML) + '">' +
        (blurbHtml !== undefined ? blurbHtml : DEFAULT_DAYS_OPEN_BLURB_HTML) +
      '</p>' +
      /* the third tile flow container (see applyTileFlow() in js/main.js): a
         real tracked element of its own, so a ta can move it around inside the
         card, resize it, and lock or unlock either of its axes - all of which
         mirror onto every day card at once through the shared id, "so all
         tiles in the row become taller (mirror one another)". Undeletable
         (data-days-fixed) for the same reason a tile is: it's where a day's
         real attachments render, not decoration. Both axes are locked by
         default, so one day with eight files can't stretch its card past every
         other card in the row - it scrolls instead. */
      (chips ? '<div class="tile-flow" style="margin-top:14px"' +
        ' data-resize-id="days.open.attachments" data-days-role="open.attachments"' +
        ' data-days-fixed="1" data-flow-area="1" data-tile-id="days.attach.tile">' +
        chips + '</div>' : "") +
    '</div>'
  );
}

/**
 * Renders "The days" tile grid's live area: every day as either its locked
 * or open tile (see buildDayLockedTileHtml()/buildDayOpenTileHtml()), plus
 * one trailing locked card for the next day once everything so far is open
 * - same behavior as before this was a live editor area, just built through
 * the two shared templates now. Rebuilds the whole area's innerHTML from
 * DAYS_CONTENT every time it runs, same "no incremental diffing, this
 * section is small" reasoning as renderExtras(). Called via the
 * window.renderDays hook from js/main.js's applySharedEditorOverrides() AND
 * from this file's own DOMContentLoaded handler below - see
 * EXTRAS_CONTENT's doc comment for why both call it and why that's safe.
 * @return how many day panels are currently unlocked
 */
function renderDays() {
  if (!DAYS_CONTENT) return 0;
  var host = document.querySelector('[data-days-area="1"]');
  if (!host) return 0;
  var data = DAYS_CONTENT;
  var radius = data.radius || {}, colors = data.colors || {}, darkColors = data.dark_colors || {};
  var lockedStyle = {
    rectColor: colors["days.locked.rect"], rectDarkColor: darkColors["days.locked.rect"],
    rectRadius: radius["days.locked.rect"]
  };
  var openStyle = {
    rectColor: colors["days.open.rect"], rectDarkColor: darkColors["days.open.rect"],
    rectRadius: radius["days.open.rect"]
  };
  var text = data.text || {};
  var extrasStyle = extrasTileStyleFrom(data);

  var html = "";
  var unlockedCount = 0;
  var allOpen = true;

  DAYS.forEach(function (day) {
    if (!day.unlocked) {
      allOpen = false;
      html += buildDayLockedTileHtml(day.id || "", day.day, lockedStyle, text["days.locked.title"], text["days.locked.badge"]);
      return;
    }
    unlockedCount++;
    html += buildDayOpenTileHtml(day, openStyle, text, extrasStyle);
  });

  /* once every panel is open, one locked card trails for the next day - no
     backing content.days[] entry, so no id/bound children, same as before */
  if (allOpen && DAYS.length < TOTAL_DAYS) {
    html += buildDayLockedTileHtml("", DAYS.length + 1, lockedStyle, text["days.locked.title"], text["days.locked.badge"]);
  }

  host.innerHTML = html;

  /* every deletable role in either template (the fixed icon/badge roles are
     never in content.hidden, see js/main.js's deleteElement()) - a plain
     prefix test rather than a list of ids, so a role added to either
     template later doesn't silently stop honouring a ta's delete */
  (data.hidden || []).forEach(function (id) {
    if (!/^(days\.|extras\.tile\.)/.test(id)) return;
    host.querySelectorAll('[data-resize-id="' + id + '"], [data-edit-id="' + id + '"]').forEach(function (el) {
      setHiddenVisual(el, true);
    });
  });

  repaintDaysChips();
  repaintExtrasFilenameChips();

  var wireText = isPreviewMode() && isEditMode();
  host.querySelectorAll('[data-days-tile]').forEach(function (tileEl) {
    var day = DAYS.filter(function (d) { return d.id && d.id === tileEl.getAttribute("data-days-id"); })[0];
    if (window.renderTileChildren) window.renderTileChildren(tileEl, day && day.children);
    if (wireText) tileEl.querySelectorAll("[data-days-role], [data-extras-role]").forEach(wireEditableRole);
  });
  /* every tile in this area is brand new markup, so every saved move/resize/
     colour keyed to a tile role or a bound child has to be painted onto it
     now - the sweeps that normally do that already ran, before any of this
     existed. See applyLiveAreaOverrides() in js/main.js. */
  if (window.applyLiveAreaOverrides) window.applyLiveAreaOverrides(data);

  /* host is the always-100%-wide, auto-height grid div itself (see
     js/main.js's buildCustomElement()'s isAutoHeightArea branch) - it just
     grew/shrank to fit the tiles above, but its free-floating position is
     still driven by #dashDaysAreaAnchor, a separate in-flow spacer
     (templates/dashboard.html) that never automatically tracks it (the
     real content lives in an absolutely-positioned sibling, out of flow,
     so nothing pushes later page content down on its own). Grow the
     spacer to match so the "Extra attachments" section/footer after it
     get correct in-flow positions, then re-anchor everything once more so
     any later anchored element (extrasArea) picks up its new, now-correct
     rect - see applyElementAnchors()'s own doc comment for why this is
     safe to call again. */
  var daysAnchorEl = document.getElementById("dashDaysAreaAnchor");
  if (daysAnchorEl) daysAnchorEl.style.minHeight = host.offsetHeight + "px";
  if (window.applyElementAnchors) window.applyElementAnchors();

  return unlockedCount;
}
window.renderDays = renderDays;

/**
 * Builds one attachment tile's markup: a wrapper (data-extras-tile, bound to
 * this specific attachment via data-extras-id/data-extras-filename, and
 * tracked under the shared tileId below so a ta can resize it - see the
 * @param) holding FOUR INDEPENDENT SIBLING elements - the
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
 * Icon and button are data-extras-fixed (stylable/resizable/movable, never
 * deletable, per the spec); rect and the filename text are ordinary
 * deletable elements. Every role IS individually movable and resizable now,
 * clamped to the tile's own box and mirrored onto every sibling tile (see
 * js/main.js's clampOwnPos()/mirrorTiledRoleGeometry()).
 *
 * The Download/Open button is the one role split across TWO ids
 * ("extras.tile.button" for a file, "extras.tile.button.link" for a link):
 * per the spec its look (colour, rounding, shadow, border) still mirrors
 * across both variants - they share one data-extras-role, which is what
 * mirrorTiledRoleStyle() keys off - while its text, size and position
 * deliberately do NOT, since "Download" and "Open" are different labels that
 * want their own box. Everything else is one id across every tile.
 * @param f one EXTRAS entry (legacy filename string, {type:"link", value},
 *   or {type:"file", name, url, id, children})
 * @param style see extrasTileStyleFrom()
 * @param text the content.text map (read for "extras.tile.text" and
 *   whichever of the two button ids this tile uses; a missing entry means
 *   the shared default - the filename chip, and the per-attachment
 *   "Open"/"Download" label live students already see today)
 * @param varBase this tile's own variable-name scope, eg "Attachment1" or
 *   "Day3Attachment2" - the filename chip renders as ${varBase + "Name"}
 *   while a ta is editing the field (see js/main.js's localChipVarToken()).
 *   These names are deliberately per-tile and never enter content.variables.
 * @param tileId the shared data-resize-id for the tile BOX itself, which is
 *   what a ta resizes to re-tile the container around it (see isTileBoxEl()/
 *   applyTileFlow() in js/main.js). Deliberately NOT shared between the two
 *   places this template renders, unlike every role inside it: the main
 *   section's column is three times the width of a day card's attachment
 *   sub-area, so one tile width across both would mean sizing either one
 *   silently mis-sizes the other. Defaults to the main section's own id.
 * @return an HTML string for one tile
 */
function buildExtrasTileHtml(f, style, text, varBase, tileId) {
  var filename = itemLabel(f) || "";
  var link = isLink(f);
  var defaultButtonText = link ? "Open" : "Download";
  var buttonId = link ? "extras.tile.button.link" : "extras.tile.button";
  var textHtml = text["extras.tile.text"];
  var buttonHtml = text[buttonId];
  var rectStyle = "";
  if (style.rectColor || style.rectDarkColor) {
    rectStyle += "background-color:" + resolveThemedColor(style.rectColor, style.rectDarkColor) + ";";
  }
  if (style.rectRadius) rectStyle += "border-radius:" + style.rectRadius + "px;";
  var iconStyle = style.iconSize ? ("width:" + style.iconSize.w + "px;height:" + style.iconSize.h + "px;") : "";
  var btnSize = link ? style.buttonLinkSize : style.buttonSize;
  var btnStyle = btnSize ? ("width:" + btnSize.w + "px;height:" + btnSize.h + "px;") : "";
  return (
    '<div class="res-row extras-tile" data-extras-tile="1" data-resize-id="' +
      escapeHtml(tileId || "extras.tile.box") +
      '" data-extras-id="' + escapeHtml((f && f.id) || "") +
      '" data-extras-filename="' + escapeHtml(filename) +
      '" data-extras-kind="' + itemIconKey(f) +
      '" data-extras-var="' + escapeHtml(varBase || "") + '">' +
      '<div class="extras-tile-rect" data-resize-id="extras.tile.rect" data-extras-role="rect"' +
        (rectStyle ? ' style="' + rectStyle + '"' : "") + ' aria-hidden="true"></div>' +
      '<div class="extras-tile-icon" data-resize-id="extras.tile.icon" data-extras-role="icon" data-extras-fixed="1"' +
        (iconStyle ? ' style="' + iconStyle + '"' : "") + '>' + itemIcon(f) + '</div>' +
      '<span class="extras-tile-text" data-edit-id="extras.tile.text" data-extras-role="text" ' +
        'data-default-html="' + escapeHtml(DEFAULT_EXTRAS_TEXT_HTML) + '">' +
        (textHtml !== undefined ? textHtml : DEFAULT_EXTRAS_TEXT_HTML) +
      '</span>' +
      '<a class="btn btn-ghost extras-tile-btn" data-edit-id="' + buttonId + '" data-extras-role="button" data-extras-fixed="1" ' +
        'data-default-html="' + escapeHtml(defaultButtonText) + '"' + (btnStyle ? ' style="' + btnStyle + '"' : "") + ' ' +
        'href="' + escapeHtml(itemHref(f)) + '" target="_blank" rel="noopener">' +
        (buttonHtml !== undefined ? buttonHtml : escapeHtml(defaultButtonText)) +
      '</a>' +
    '</div>'
  );
}

/**
 * Gives one just-rendered tile role click-to-edit text wiring, if it's a
 * text role at all. Both render functions sweep every [data-days-role]/
 * [data-extras-role] through here rather than listing the text ids by hand:
 * a role added to either shared template later then picks up its own
 * wiring automatically instead of silently rendering as dead text, which is
 * exactly what happened to the day title/blurb fields when they became
 * editable (see buildDayOpenTileHtml()). The rect/icon roles carry only a
 * data-resize-id, so they fall straight through.
 * @param el a role element (or null, ignored)
 */
function wireEditableRole(el) {
  if (el && el.hasAttribute("data-edit-id")) wireTextField(el);
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
  var text = data.text || {};
  var style = extrasTileStyleFrom(data);
  var emptyHtml = text["dash.extras.empty"] !== undefined ? text["dash.extras.empty"] : DEFAULT_EXTRAS_EMPTY_HTML;

  /* the tiles are DIRECT children of the area, not wrapped in a list of their
     own: the area itself is the tile flow container (see applyTileFlow() in
     js/main.js), and an intermediate wrapper would be the thing the tiles
     actually tiled inside, leaving the container a ta resizes with nothing to
     lay out. The empty-state text isn't a tile, so it spans the whole row. */
  var html =
    '<p class="muted extras-empty tile-flow-full' + (EXTRAS.length ? " has-attachments" : "") +
      '" data-edit-id="dash.extras.empty" ' +
      'data-default-html="' + escapeHtml(DEFAULT_EXTRAS_EMPTY_HTML) + '">' + emptyHtml + '</p>';
  html += EXTRAS.map(function (f, i) {
    return buildExtrasTileHtml(f, style, text, "Attachment" + (i + 1), "extras.tile.box");
  }).join("");
  host.innerHTML = html;

  (data.hidden || []).forEach(function (id) {
    if (!/^extras\.tile\./.test(id)) return;
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
    wireEditableRole(host.querySelector('[data-edit-id="dash.extras.empty"]'));
    host.querySelectorAll("[data-extras-role]").forEach(wireEditableRole);
  }

  if (window.renderTileChildren) {
    host.querySelectorAll('[data-extras-tile]').forEach(function (tileEl) {
      var f = EXTRAS.filter(function (item) { return item && item.id === tileEl.getAttribute("data-extras-id"); })[0];
      window.renderTileChildren(tileEl, f && f.children);
    });
  }
  /* same "these tiles didn't exist when the sweeps ran" repaint renderDays()
     needs, see applyLiveAreaOverrides() in js/main.js */
  if (window.applyLiveAreaOverrides) window.applyLiveAreaOverrides(data);

  /* same "grow the in-flow anchor spacer to match, then re-anchor
     everything" reasoning as renderDays() - see its matching comment. */
  var extrasAnchorEl = document.getElementById("dashExtrasAreaAnchor");
  if (extrasAnchorEl) extrasAnchorEl.style.minHeight = host.offsetHeight + "px";
  if (window.applyElementAnchors) window.applyElementAnchors();
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

document.addEventListener("DOMContentLoaded", function () {
  var session = gateCheck();
  var logoutBtn = document.getElementById("logoutBtn");
  if (isPreviewMode()) {
    /* previewing isn't a real visit: don't let the brand logo wander the
       ta off to another page, and don't let "Log out" fire for real either,
       since it'd clear the session localStorage shares with the ta's own
       portal tab, ending their actual login just from clicking a preview.
       neuterLink() lives in js/main.js, loaded before this file on every page
       that uses it; dim=false because the nav is editable in the visual
       editor and a ta comparing it against the live site should see the same
       colours there, not a half-faded "disabled" navbar. */
    neuterLink(document.querySelector(".brand"), false);
    neuterLink(logoutBtn, false);
    /* same for the locked-out page's "Go to login" button, which is editable
       from the editor's Page switch now (see gateCheck()) - clicking it to
       select it shouldn't sail the whole editor frame off to login.html */
    neuterLink(document.querySelector('[data-edit-id="dash.gate.action"]'), false);
  } else if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  if (!session) return;

  fetchContent()
    .then(function (data) {
      DAYS = data.days;
      EXTRAS = data.extras;
      EXTRAS_CONTENT = data;
      DAYS_CONTENT = data;
      var totalDaysVar = (data.variables || []).filter(function (v) { return v.key === "total_days"; })[0];
      TOTAL_DAYS = (totalDaysVar && +totalDaysVar.value) || TOTAL_DAYS;
      /* both renders measure as they go - the tiles they paint, the containers
         those lay out in, the in-flow spacers they grow to match - and a ta
         sitting on the locked-out page has #dashApp, and therefore everything
         being measured, out of the document (see applyDashView()). Every
         measurement would come back zero and get saved as the real answer.
         The override pipeline in js/main.js already wraps its own copy of
         these calls for the same reason, see withStateViewsLaidOut(); this is
         the racing second copy (see its comment there), which needs it just
         as much. A no-op when neither half is hidden. */
      withStateViewsLaidOut(function () {
        renderDays();
        renderExtras();
      });
    });
});
