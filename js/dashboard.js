/* dashboard: renders day panels from content fetched off /api/content */

/* full length of the workshop, used to decide whether a trailing "next day"
   locked card still needs to show once every real day panel is open. Set from
   /api/content ("Total days" variable); this is just the fallback. The live
   progress bar is a placed "progress" element now, not driven from here. */
var TOTAL_DAYS = 10;

/* how many day tiles the grid draws at once, on top of the days actually
   open - the "don't show students an empty page on day one, or all ten cards
   on day two" control. Set site-wide in the content manager.

   min_tiles is a floor on the total ("always look like a five-day workshop");
   extra_locked is a count of teasers on top of what's open ("always one card
   ahead"). Whichever asks for more wins - they're two ways to ask for the
   same thing, not two things that add up - and TOTAL_DAYS caps both.

   Any tile past the open ones uses the locked template whether or not a real
   days[] entry backs it: a locked card shows a number and "available soon",
   so an unwritten day and a still-locked one are the same card to a student.
   That's why capping may leave an authored-but-locked panel unrendered. */
var DAYS_DISPLAY_DEFAULTS = { min_tiles: 0, extra_locked: 1 };

/**
 * Coerces one of the two days_display numbers out of saved content.
 * @param value whatever content.days_display held
 * @param fallback the DAYS_DISPLAY_DEFAULTS entry for it
 * @return a whole count >= 0
 * @note A missing key (an old blob, a hand-edited profile) falls back; a
 * saved 0 is a real answer ("no floor" / "no teasers") and is kept.
 */
function daysDisplayNum(value, fallback) {
  var n = Math.floor(+value);
  if (!isFinite(n) || n < 0) return fallback;
  return n;
}

/**
 * How many day tiles the grid shows in total right now.
 * @param unlockedCount how many day panels are open
 * @return the tile count, open ones included
 */
function visibleDayTileCount(unlockedCount) {
  var conf = (DAYS_CONTENT && DAYS_CONTENT.days_display) || {};
  var want = Math.max(
    daysDisplayNum(conf.min_tiles, DAYS_DISPLAY_DEFAULTS.min_tiles),
    unlockedCount + daysDisplayNum(conf.extra_locked, DAYS_DISPLAY_DEFAULTS.extra_locked)
  );
  if (TOTAL_DAYS > 0) want = Math.min(want, TOTAL_DAYS);
  /* an open day is real content a student is already meant to have, so it
     outranks both the cap and the settings: a workshop whose "Total days" was
     typed too low still shows every day it has actually opened */
  return Math.max(want, unlockedCount);
}

/* filled in by loadContent() before renderDays()/renderExtras() run */
var DAYS = [];
var EXTRAS = [];

/* the full /api/content response, stashed so renderExtras() can read the
   colors/radius/sizes/text/hidden itself: main.js's sweeps run against
   whatever is in the DOM when they're called, and this section's tiles are
   built later, after a fetch resolves. */
var EXTRAS_CONTENT = null;

/* same idea as EXTRAS_CONTENT, for renderDays(). Two names for one object,
   just so each render function's reads stay scoped to its own section. */
var DAYS_CONTENT = null;

/* the shared template default for a tile's filename field - just the local
   filename chip. Computed here since script order guarantees main.js ran. */
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

/* every attachment glyph keyed by the short name a tile carries in its own
   data-extras-kind, so the right icon can be re-derived from the DOM alone -
   that's what lets main.js paint an "attachment icon" element per tile
   without knowing anything about attachments (see attachmentIconSvgFor()) */
var ATTACH_ICONS = { link: LINK_SVG, image: IMAGE_SVG, doc: DOC_SVG, slides: SLIDES_SVG, file: FILE_SVG };

/**
 * Picks the icon KIND off the file extension in the attachment's name.
 * @param item an attachment (string or {type, ...} object)
 * @return one of ATTACH_ICONS's keys
 * @note Falls back to a generic file glyph for anything unrecognized.
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
 * The type icon a rendered tile should show, resolved off its own
 * data-extras-kind rather than the attachment object.
 * @param tileEl a [data-extras-tile] element
 * @return an inline svg icon string (the generic file glyph if unknown)
 * @note The DOM-only lookup repaintExtrasTypeIcons() needs: a ta places one
 * "attachment icon" element and every sibling tile paints its own glyph into
 * that same shared-template element.
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
   too, identical to main.js's. Not harmless duplicates: this file loads AFTER
   main.js, so each declaration quietly REPLACED main.js's own and every call
   in both files ran this copy - so when main.js's fetchContent() grew the
   seeded-element top-up, the dashboard silently didn't get it. Deleted rather
   than kept in sync, so there's no way for the two to drift again. */

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
 * Shows the dashboard if logged in, otherwise the locked-out page.
 * @return the logged-in username, or null if there's no session
 * @note Both are real editable pages in one file and only one is ever in the
 * document; which one is applyDashSessionState()'s call, so this is now here
 * only for its return value and its name. Idempotent, and called more than
 * once per load.
 */
function gateCheck() {
  applyDashSessionState();
  return localStorage.getItem("session") || null;
}

/**
 * Reads the shared "extras.tile.*" template's style overrides off a content
 * blob - the same lookup renderExtras() and renderDays() both need, since a
 * day's attachment tiles and the main section's render through one template
 * and are meant to restyle together.
 * @param data a content blob (EXTRAS_CONTENT/DAYS_CONTENT)
 * @return {rectColor, rectDarkColor, rectRadius, iconSize, buttonSize,
 *   buttonLinkSize}
 * @note Download and Open keep their own separate sizes, so both are read
 * here and the tile picks whichever it is.
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

/* the shared template defaults for a day tile's chip-eligible text fields,
   same "computed once, main.js already ran" reasoning as above */
var DEFAULT_DAYS_LOCKED_TITLE_HTML = buildDaysChipHtml("day-number", "Day #");
var DEFAULT_DAYS_OPEN_DAYTAG_HTML =
  buildDaysChipHtml("day-number", "Day #") + ' &middot; ' + buildDaysChipHtml("day-date", "date");
/* the open tile's headline/blurb are chips too: the words stay per-day
   content typed in the content manager, but in the editor they're reached as
   a VARIABLE inside an ordinary restyleable field - so a ta can move, recolour
   or type around it without overwriting one day's actual title */
var DEFAULT_DAYS_OPEN_TITLE_HTML = buildDaysChipHtml("day-title", "Title");
var DEFAULT_DAYS_OPEN_BLURB_HTML = buildDaysChipHtml("day-blurb", "Description");
/* the locked tile's one-line explanation. Plain words, no chip: nothing about
   it is per-day, it's the shared template's own copy - which is why it's
   editable as one field for every locked tile at once. */
var DEFAULT_DAYS_LOCKED_BLURB_HTML = "This module will be available soon";
/* the open tile's attachment sub-area's empty-state line, third copy of the
   same placeholder. It exists because the sub-area always renders now, and a
   container with nothing in it and no line to say so is a box a ta can't tell
   apart from empty space. */
var DEFAULT_DAYS_ATTACH_EMPTY_HTML = "<strong>No attachments yet.</strong>";

/**
 * Builds one LOCKED day tile's markup.
 * @param dayId the day's own stable id, or "" for the trailing synthetic card
 * @param dayNum the day number to show
 * @param style {rectColor, rectDarkColor, rectRadius} (reads "days.locked.*"
 *   keys, independent from the open template's own style)
 * @param titleHtml content.text["days.locked.title"], or undefined for the
 *   shared default (just the day-number chip)
 * @param blurbHtml content.text["days.locked.blurb"], or undefined for the
 *   shared default (see DEFAULT_DAYS_LOCKED_BLURB_HTML)
 * @param badgeHtml content.text["days.locked.badge"], or undefined for "Locked"
 * @param slot which content.days[] entry this tile came from, or -1 for a
 *   padding card standing for no entry at all
 * @return an HTML string for one locked tile
 * @note A shared template rendered once per still-locked day the grid has
 * room for, plus one per padding card. Its ids are independent of the open
 * template's, so restyling a locked tile never touches an open one.
 * @note The lock icon and "Locked" badge are data-days-fixed (stylable,
 * never deletable); the rect, title and blurb are ordinary deletable ones.
 */
function buildDayLockedTileHtml(dayId, dayNum, style, titleHtml, blurbHtml, badgeHtml, slot) {
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
      '" data-flow-slot="' + slot +
      '" data-days-var="Day' + dayNum + '">' +
      '<div class="day-tile-rect" data-resize-id="days.locked.rect" data-days-role="locked.rect" aria-hidden="true"' +
        (rectStyle ? ' style="' + rectStyle + '"' : "") + '></div>' +
      '<span class="soon-lock" data-resize-id="days.locked.icon" data-days-role="locked.icon" data-days-fixed="1"' +
        (iconStyle ? ' style="' + iconStyle + '"' : "") + '>' + LOCK_SVG + '</span>' +
      '<h3 data-edit-id="days.locked.title" data-days-role="locked.title" ' +
        'data-default-html="' + escapeHtml(DEFAULT_DAYS_LOCKED_TITLE_HTML) + '">' +
        (titleHtml !== undefined ? titleHtml : DEFAULT_DAYS_LOCKED_TITLE_HTML) +
      '</h3>' +
      '<p class="muted" data-edit-id="days.locked.blurb" data-days-role="locked.blurb" ' +
        'data-default-html="' + escapeHtml(DEFAULT_DAYS_LOCKED_BLURB_HTML) + '">' +
        (blurbHtml !== undefined ? blurbHtml : DEFAULT_DAYS_LOCKED_BLURB_HTML) +
      '</p>' +
      '<span class="badge locked" data-edit-id="days.locked.badge" data-days-role="locked.badge" data-days-fixed="1" ' +
        'data-default-html="Locked">' + LOCK_SVG + (badgeHtml !== undefined ? badgeHtml : "Locked") +
      '</span>' +
    '</div>'
  );
}

/**
 * Builds one OPEN day tile's markup - same shared-template idea as
 * buildDayLockedTileHtml(), with its own "days.open.*" ids.
 * @param day one DAYS entry (id, day, date, title, blurb, files, children)
 * @param style {rectColor, rectDarkColor, rectRadius} (reads "days.open.*" keys)
 * @param text the content.text map (read for every "days.open.*" id plus the
 *   shared "extras.tile.*" ones the attachment tiles below need)
 * @param extrasStyle see extrasTileStyleFrom() - shared with renderExtras()
 * @param slot which content.days[] entry this tile was rendered from
 * @return an HTML string for one open tile
 * @note Title and blurb stay per-day content, rendered through a shared
 * restyleable field carrying a local chip that resolves to THIS tile's value.
 * @note The attachment list reuses buildExtrasTileHtml() verbatim, so a day's
 * attachments and the main section's restyle together everywhere they appear.
 * @note The attachment sub-area renders UNCONDITIONALLY, empty days included.
 * It used to appear only once a day had files, which left a ta unable to
 * position or resize a box that wasn't in the document - and since every
 * layout edit is keyed to the one shared id, it has to exist on all of them
 * for those edits to mean anything.
 */
function buildDayOpenTileHtml(day, style, text, extrasStyle, slot) {
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
      '" data-flow-slot="' + slot +
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
      /* the third tile flow container: a tracked element of its own, so a ta
         can move, resize and axis-lock it, all mirrored onto every day card
         through the shared id. Undeletable (data-days-fixed) - it's where a
         day's real attachments render, not decoration. Both axes locked by
         default, so one day with eight files scrolls instead of stretching
         its card past every other in the row. */
      '<div class="tile-flow" style="margin-top:14px"' +
        ' data-resize-id="days.open.attachments" data-days-role="open.attachments"' +
        ' data-days-fixed="1" data-flow-area="1" data-tile-id="days.attach.tile">' +
        '<p class="muted extras-empty tile-flow-full' + (chips ? " has-attachments" : "") +
          '" data-edit-id="days.open.attachments.empty" data-days-role="open.attachments.empty" ' +
          'data-default-html="' + escapeHtml(DEFAULT_DAYS_ATTACH_EMPTY_HTML) + '">' +
          (text["days.open.attachments.empty"] !== undefined
            ? text["days.open.attachments.empty"] : DEFAULT_DAYS_ATTACH_EMPTY_HTML) +
        '</p>' +
        chips +
      '</div>' +
    '</div>'
  );
}

/**
 * Decides which day tiles the grid should draw right now, in order.
 * @return {tiles: [{day, num, slot}], unlockedCount} - day is null on a
 *   padding card, and slot is its content.days[] index (-1 when there's none)
 * @note Every open day is always drawn where it sits in content.days[]. The
 * leftover tiles are locked ones, filled from still-locked panels first: a
 * panel a ta actually wrote beats a number with nothing behind it.
 * @note Padding cards number on from the highest day number in content.days[]
 * rather than from its length, so panels numbered 1, 2, 5 pad with 6.
 */
function planDayTiles() {
  var unlockedCount = 0;
  var highestNum = 0;
  DAYS.forEach(function (d) {
    if (d.unlocked) unlockedCount++;
    if ((+d.day || 0) > highestNum) highestNum = +d.day || 0;
  });

  var lockedBudget = visibleDayTileCount(unlockedCount) - unlockedCount;
  var tiles = [];
  DAYS.forEach(function (day, i) {
    if (!day.unlocked) {
      if (lockedBudget <= 0) return;
      lockedBudget--;
    }
    tiles.push({ day: day, num: day.day, slot: i });
  });

  if (highestNum < DAYS.length) highestNum = DAYS.length;
  for (var k = 0; k < lockedBudget; k++) {
    tiles.push({ day: null, num: highestNum + 1 + k, slot: -1 });
  }
  return { tiles: tiles, unlockedCount: unlockedCount };
}

/**
 * Renders "The days" tile grid's live area, each tile as its locked or open
 * template.
 * @return how many day panels are currently unlocked
 * @note Rebuilds the whole area's innerHTML each run - small enough that
 * incremental diffing isn't worth it.
 * @note Called both via the window.renderDays hook and from this file's own
 * DOMContentLoaded; see EXTRAS_CONTENT for why that's safe.
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

  var plan = planDayTiles();
  var html = "";

  plan.tiles.forEach(function (t) {
    if (t.day && t.day.unlocked) {
      html += buildDayOpenTileHtml(t.day, openStyle, text, extrasStyle, t.slot);
      return;
    }
    /* a padding card has no content.days[] entry, so no id and no bound
       children of its own - same as the trailing "next day" card this grew
       out of */
    html += buildDayLockedTileHtml(t.day ? (t.day.id || "") : "", t.num, lockedStyle,
      text["days.locked.title"], text["days.locked.blurb"], text["days.locked.badge"], t.slot);
  });

  host.innerHTML = html;

  /* every deletable role in either template - a plain prefix test rather than
     a list of ids, so a role added later doesn't silently stop honouring a
     ta's delete (the fixed icon/badge roles never reach content.hidden) */
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
  /* every tile here is brand new markup, so every saved move/resize/colour
     has to be painted on now - the sweeps that normally do it already ran,
     before any of this existed */
  if (window.applyLiveAreaOverrides) window.applyLiveAreaOverrides(data);

  /* host is the auto-height grid div, which just grew to fit its tiles - but
     its position comes from #dashDaysAreaAnchor, a separate in-flow spacer
     that never tracks it (the real content is absolutely positioned, out of
     flow). Grow the spacer to match so later sections sit correctly, then
     re-anchor once more so anything anchored after it sees the new rect. */
  var daysAnchorEl = document.getElementById("dashDaysAreaAnchor");
  if (daysAnchorEl) daysAnchorEl.style.minHeight = host.offsetHeight + "px";
  if (window.applyElementAnchors) window.applyElementAnchors();

  return plan.unlockedCount;
}
window.renderDays = renderDays;

/**
 * Builds one attachment tile's markup.
 * @param f one EXTRAS entry (legacy filename string, {type:"link", value},
 *   or {type:"file", name, url, id, children})
 * @param style see extrasTileStyleFrom()
 * @param text the content.text map (read for "extras.tile.text" and whichever
 *   of the two button ids this tile uses; a missing entry means the shared
 *   default - the filename chip, and the "Open"/"Download" label)
 * @param varBase this tile's own variable scope, eg "Attachment1" or
 *   "Day3Attachment2" - the filename chip renders as ${varBase + "Name"}
 *   while a ta edits the field. Per-tile, and never enters content.variables.
 * @param tileId the shared data-resize-id for the tile BOX itself, which is
 *   what a ta resizes to re-tile the container around it. Deliberately NOT
 *   shared between the two places this template renders, unlike every role
 *   inside it: the main section's column is three times the width of a day
 *   card's sub-area, so one shared width would mis-size the other.
 * @return an HTML string for one tile
 * @note The rect, icon, filename and button are INDEPENDENT SIBLINGS, not
 * nested, so deleting the rect (which is allowed) never cascades into the
 * three that visually sit on top of it.
 * @note All four carry a SHARED fixed id, so this is one template rendered
 * per attachment: any tile's style or text edit applies everywhere. The
 * override sweeps repaint every node sharing an id, so this just has to paint
 * that look once up front - those sweeps ran before these tiles existed.
 * @note Icon and button are data-extras-fixed (stylable, never deletable);
 * rect and filename are ordinary deletable elements. Every role is
 * individually movable and resizable, clamped to the tile's box and mirrored
 * onto its siblings.
 * @note The button is the one role split across two ids (file vs link): its
 * look mirrors across both variants (they share a data-extras-role), while
 * its text, size and position deliberately don't, since "Download" and
 * "Open" are different labels wanting their own box.
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
 * Gives one just-rendered tile role click-to-edit wiring, if it's a text role.
 * @param el a role element (or null, ignored)
 * @note Both render functions sweep every role through here rather than
 * listing text ids by hand, so a role added to either template later picks up
 * its wiring instead of silently rendering as dead text - which is exactly
 * what happened to the day title/blurb fields. Rect/icon roles carry only a
 * data-resize-id and fall straight through.
 */
function wireEditableRole(el) {
  if (el && el.hasAttribute("data-edit-id")) wireTextField(el);
}

/**
 * Renders the "Extra attachments" section's live area: the always-present
 * empty-state text plus every current attachment's tile, inside the placed
 * "extrasArea" element (found by its data-extras-area marker).
 * @note Rebuilds the whole innerHTML each run, as renderDays() does - a
 * shared-template edit can touch every tile at once and this section is small.
 * @note Called via the window.renderExtras hook AND from this file's own
 * DOMContentLoaded: whichever fetch resolves second finds both
 * EXTRAS_CONTENT set and the host in the DOM, and the other no-ops.
 */
function renderExtras() {
  if (!EXTRAS_CONTENT) return;
  var host = document.querySelector('[data-extras-area="1"]');
  if (!host) return;
  var data = EXTRAS_CONTENT;
  var text = data.text || {};
  var style = extrasTileStyleFrom(data);
  var emptyHtml = text["dash.extras.empty"] !== undefined ? text["dash.extras.empty"] : DEFAULT_EXTRAS_EMPTY_HTML;

  /* the tiles are DIRECT children of the area: the area itself is the tile
     flow container, and a wrapper would become the thing tiles laid out
     inside, leaving the container a ta resizes with nothing to arrange. The
     empty-state text isn't a tile, so it spans the row. */
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

  /* click-to-edit wiring is a one-time non-delegated pass, already run by the
     time either racing fetch gets here, so these need wiring by hand */
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
    /* previewing isn't a real visit: don't let the brand logo wander the ta
       off, and don't let "Log out" fire for real - it shares localStorage
       with their portal tab, so it would end their actual login. dim=false,
       since the nav is editable here and should show its real colours. */
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
      /* both renders measure as they go, and a ta sitting on the locked-out
         page has #dashApp - and everything being measured - out of the
         document, so every measurement would come back zero and be saved as
         the real answer. A no-op when neither half is hidden. */
      withStateViewsLaidOut(function () {
        renderDays();
        renderExtras();
      });
    });
});
