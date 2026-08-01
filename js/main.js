/* landing page: countdown + workshop dates, both driven by whatever the
   ta portal last saved (see /api/content). scroll-reveal and the hero
   floaties were removed earlier, this file is countdown-only now. */

var CD_TBA_HTML =
  '<div class="countdown cd-tba" data-resize-id="container.countdown">' +
    '<svg class="cd-cal" data-resize-id="icon.countdown.calendar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>' +
    '<div><span class="cd-label accent" data-edit-id="countdown.tba.label">Date and time</span>' +
    '<b class="cd-tba-txt" data-edit-id="countdown.tba.text">To be announced</b></div>' +
  '</div>';

var CHECK_ICON_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>';

/**
 * Builds one logistics tile ("2 weeks", "4 hours", "SFB520", certificate, etc).
 * Text is click-to-editable in the visual editor (see wireClickToEdit()), tagged
 * with the tile's index so an edit writes straight back into content.logistics
 * instead of a template-default override, the content manager's "Info tiles"
 * list shows the same array. Adding/removing tiles stays a content-manager-only
 * action, this view is text-only.
 * @param t {big, lbl, icon} tile data
 * @param i the tile's index in the logistics array
 * @return the tile's card element
 */
function logisticsTile(t, i) {
  var card = document.createElement("div");
  card.className = "card stat";
  card.setAttribute("data-resize-id", "box.logistics." + i);
  var big = document.createElement("div");
  big.className = "big";
  if (t.icon) {
    big.innerHTML = CHECK_ICON_SVG;
    big.querySelector("svg").setAttribute("data-resize-id", "logistics." + i + ".icon");
  } else {
    big.textContent = t.big;
    big.setAttribute("data-edit-id", "logistics." + i + ".big");
  }
  var lbl = document.createElement("div");
  lbl.className = "lbl";
  lbl.textContent = t.lbl;
  lbl.setAttribute("data-edit-id", "logistics." + i + ".lbl");
  card.appendChild(big);
  card.appendChild(lbl);
  return card;
}

var CD_CLOCK_HTML =
  '<div class="countdown" id="countdown" data-resize-id="container.countdown">' +
    '<span class="cd-label" data-edit-id="countdown.clock.label">Workshop begins in</span>' +
    '<div class="cd-clock">' +
      '<div class="cd-unit"><b id="cd-d">00</b><span>days</span></div>' +
      '<div class="cd-unit"><b id="cd-h">00</b><span>hrs</span></div>' +
      '<div class="cd-unit"><b id="cd-m">00</b><span>min</span></div>' +
      '<div class="cd-unit"><b id="cd-s">00</b><span>sec</span></div>' +
    '</div>' +
  '</div>';

/* used if /api/content can't be reached, same shape/values as DEFAULT_CONTENT in app/db.py */
var DEFAULT_LOGISTICS = [
  { big: "2 weeks", lbl: "Tentative start date", icon: false },
  { big: "4 hours", lbl: "1:30pm–5:30pm", icon: false },
  { big: "SFB520", lbl: "Sandford Fleming", icon: false },
  { big: "", lbl: "Certificate of completion", icon: true }
];
var DEFAULT_JOIN_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
var DEFAULT_APPLY_TOOLTIP = "Applications open once the workshop dates are confirmed, check back soon.";
var DEFAULT_HERO_VIDEO = "assets/cover-video.mp4";
/* landing page photo slots, same shape/values as home_images in
   DEFAULT_CONTENT, app/db.py. keys map to the <img> ids below. */
var DEFAULT_HOME_IMAGES = {
  about_hero: "assets/gallery/group-main-alt.jpeg",
  about_1: "assets/gallery/class-closeup.jpeg",
  about_2: "assets/gallery/robot-closeup.png",
  about_3: "assets/gallery/class-2.jpeg",
  certificate: "assets/certificate.png"
};
var HOME_IMAGE_ELS = {
  about_hero: "imgAboutHero",
  about_1: "imgAboutGrid1",
  about_2: "imgAboutGrid2",
  about_3: "imgAboutGrid3",
  certificate: "imgCertificate"
};

/**
 * Checks whether this page was opened from the ta portal's preview page
 * (see js/preview.js, js/ta.js) rather than by a real visitor.
 * @return true if ?preview=1 is set
 */
function isPreviewMode() {
  return /[?&]preview=1(&|$)/.test(window.location.search);
}

/**
 * Checks whether this page is the reusable-object mini editor's blank
 * canvas (templates/object-editor.html), rather than a real page or a page
 * preview. Same click-to-edit/resize/color/group/etc engine as the Visual
 * editor tab, just aimed at building one reusable bundle instead of editing
 * the live page, see initObjectCanvas()/snapshotKey().
 * @return true if ?object=1 is set
 */
function isObjectMode() {
  return /[?&]object=1(&|$)/.test(window.location.search);
}

/**
 * The localStorage key every save*()/apply*Overrides() draft in this file
 * reads and writes: the shared "preview_content" snapshot on a real page/
 * preview (see js/ta.js's writePreviewSnapshot()), or the object mini
 * editor's own "object_content" scene when isObjectMode(). This one switch
 * is what lets the entire visual editor engine (resize, move, color, tint,
 * group, layers, undo, all of it) work unmodified against a blank object
 * canvas, exactly the same code path, just a different piece of storage.
 * @return the localStorage key to use
 */
function snapshotKey() {
  return isObjectMode() ? "object_content" : "preview_content";
}

/* every object saved to the shared reusable-objects library (a ta-only
   resource, GET/POST/DELETE /api/objects in app/main.py, entirely separate
   from content/preview_content), fetched fresh whenever the visual editor's
   right-click "Add element" menu might need it (see fetchObjectsLibrary()/
   placeObject()/renderCtxMenuObjectPicker()). */
var OBJECTS_LIBRARY = [];

/* the object-editor.html tab opened from the right-click menu's own "New
   object..." option, reused (not reopened) on repeat clicks, same
   window.open(url, name) reuse pattern js/ta.js's openObjectEditor() uses
   for the portal's "New object"/Edit buttons, and the same window NAME
   ("ta_object_editor") so opening from either place reuses one tab rather
   than juggling two. */
var OBJECT_EDITOR_TAB = null;

/**
 * Opens the reusable-object mini editor in a new (or already-open, reused)
 * tab, always starting a brand new, unsaved object; an existing one is only
 * ever edited from instructor.html's own Objects list.
 */
function openNewObjectEditor() {
  var url = "object-editor.html?object=1";
  if (OBJECT_EDITOR_TAB && !OBJECT_EDITOR_TAB.closed) {
    OBJECT_EDITOR_TAB.location.href = url;
    OBJECT_EDITOR_TAB.focus();
  } else {
    OBJECT_EDITOR_TAB = window.open(url, "ta_object_editor");
  }
}

/**
 * Fetches the shared reusable-objects library (ta-only, needs the bearer
 * token, same convention assetFetch() already uses for icons/videos/fonts
 * since this file never loads js/ta.js's own authedFetch()). Resolves to []
 * on any failure (not logged in, network error) rather than rejecting, so a
 * real visitor's page load (which never calls this) or a stale/expired
 * session just sees an empty picker instead of breaking anything.
 * @return a promise resolving to the objects list
 */
function fetchObjectsLibrary() {
  return assetFetch("/api/objects")
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; });
}

/**
 * Loads whatever's in the object mini editor's own canvas (a blank scene
 * until something's placed in it, see templates/object-editor.html), plus
 * the shared objects library (see fetchObjectsLibrary(), so a saved object
 * is placeable inside another object too). Mirrors fetchContent()'s "read
 * the shared draft, mojibake-repair it" shape, but the scene itself is
 * never the server's /api/content, an object canvas has no page of its own
 * to fall back to.
 * @return a promise resolving to the canvas's current content-shaped scene
 */
function fetchObjectContent() {
  var raw;
  try { raw = localStorage.getItem("object_content"); } catch (e) { raw = null; }
  var scene;
  try { scene = raw ? repairMojibakeDeep(JSON.parse(raw)) : {}; } catch (e) { scene = {}; }
  return fetchObjectsLibrary().then(function (list) { OBJECTS_LIBRARY = list; return scene; });
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
 * snapshot or old saved blob never reaches a real visitor's screen.
 * @return a promise resolving to the content object
 */
function fetchContent() {
  if (isPreviewMode()) {
    try {
      var raw = localStorage.getItem(snapshotKey());
      if (raw) return Promise.resolve(repairMojibakeDeep(JSON.parse(raw)));
    } catch (e) {}
  }
  return fetch("/api/content").then(function (res) { return res.json(); }).then(repairMojibakeDeep);
}

/**
 * Formats a date range as "Mon D to Mon D, YYYY".
 * @param start iso date string (yyyy-mm-dd)
 * @param end iso date string (yyyy-mm-dd)
 * @return the formatted range
 */
function formatDateRange(start, end) {
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var s = new Date(start + "T00:00:00");
  var e = new Date(end + "T00:00:00");
  return months[s.getMonth()] + " " + s.getDate() + " to " +
    months[e.getMonth()] + " " + e.getDate() + ", " + e.getFullYear();
}

/**
 * Returns the logistics tiles to render, migrating old-shaped content on
 * the fly. Content saved before the workshop-dates tile got folded into the
 * generic logistics list has no "logistics" key at all, just the old
 * date_mode/weeks_label fields; this builds a first tile out of those so
 * the real saved dates don't disappear on students until a ta re-saves.
 * @param data the content blob from /api/content
 * @return an array of {big, lbl, icon} tiles
 */
function resolveLogistics(data) {
  if (data.logistics) return data.logistics;
  var lbl = (data.date_mode === "confirmed" && data.start_date && data.end_date) ?
    formatDateRange(data.start_date, data.end_date) : "Tentative start date";
  var tiles = DEFAULT_LOGISTICS.slice();
  tiles[0] = { big: data.weeks_label || "2 weeks", lbl: lbl, icon: false };
  return tiles;
}

/**
 * Starts the hero countdown clock, ticking the digits every second.
 * @param target iso datetime string to count down to
 */
function startCountdown(target) {
  var targetMs = new Date(target).getTime();

  function tick() {
    var diff = targetMs - Date.now();
    if (diff < 0) diff = 0;
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    var dEl = document.getElementById("cd-d");
    var hEl = document.getElementById("cd-h");
    var mEl = document.getElementById("cd-m");
    var sEl = document.getElementById("cd-s");
    if (dEl) dEl.textContent = p(d);
    if (hEl) hEl.textContent = p(h);
    if (mEl) mEl.textContent = p(m);
    if (sEl) sEl.textContent = p(s);
  }

  tick();
  setInterval(tick, 1000);
}

/* month/weekday names for the strftime formatter below. site is english
   only, so these are hardcoded rather than pulled from Intl (keeps the
   formatter predictable and locale-independent). */
var DT_MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
var DT_MONTHS_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var DT_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var DT_DAYS_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* default strftime pattern per datetime format, used when a datetime
   element has no custom pattern of its own (see datetimeText()). */
var DT_DEFAULT_PATTERNS = {
  countdown: "%D  %H  %M  %S",
  datetime: "%b %-d, %Y, %-I:%M %p",
  date: "%b %-d, %Y",
  time: "%-I:%M %p"
};

/**
 * A small strftime for the static datetime formats (date/time/datetime),
 * enough tokens to cover the common cases without pulling in a date
 * library (vanilla JS only, see CLAUDE.md). "%-x" is the non-zero-padded
 * variant of "%x", "%%" is a literal percent, an unknown token is left as
 * written so a typo is visible rather than silently dropped.
 * @param date the Date to format
 * @param pattern the strftime pattern string
 * @return the formatted string
 */
function strftimeFormat(date, pattern) {
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var h24 = date.getHours();
  var h12 = h24 % 12 || 12;
  var map = {
    "Y": date.getFullYear(), "y": pad(date.getFullYear() % 100),
    "m": pad(date.getMonth() + 1), "-m": date.getMonth() + 1,
    "B": DT_MONTHS[date.getMonth()], "b": DT_MONTHS_ABBR[date.getMonth()],
    "d": pad(date.getDate()), "-d": date.getDate(),
    "A": DT_DAYS[date.getDay()], "a": DT_DAYS_ABBR[date.getDay()],
    "H": pad(h24), "-H": h24, "I": pad(h12), "-I": h12,
    "M": pad(date.getMinutes()), "S": pad(date.getSeconds()),
    "p": h24 < 12 ? "AM" : "PM", "P": h24 < 12 ? "am" : "pm"
  };
  return pattern.replace(/%(-?[A-Za-z%])/g, function (whole, tok) {
    if (tok === "%") return "%";
    return map[tok] !== undefined ? String(map[tok]) : whole;
  });
}

/**
 * The countdown counterpart to strftimeFormat(): tokens are the remaining
 * duration (not a wall clock), %D total days, %H/%M/%S the hour/minute/
 * second remainders (zero-padded), %T total hours, "%-x" the non-padded
 * variant of each. A negative (already-past) diff clamps to zero.
 * @param diffMs milliseconds remaining until the target
 * @param pattern the pattern string
 * @return the formatted countdown string
 */
function countdownFormat(diffMs, pattern) {
  if (diffMs < 0) diffMs = 0;
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var totalDays = Math.floor(diffMs / 86400000);
  var totalHours = Math.floor(diffMs / 3600000);
  var h = Math.floor((diffMs % 86400000) / 3600000);
  var m = Math.floor((diffMs % 3600000) / 60000);
  var s = Math.floor((diffMs % 60000) / 1000);
  var map = {
    "D": totalDays, "-D": totalDays, "T": totalHours, "-T": totalHours,
    "H": pad(h), "-H": h, "M": pad(m), "-M": m, "S": pad(s), "-S": s
  };
  return pattern.replace(/%(-?[A-Za-z%])/g, function (whole, tok) {
    if (tok === "%") return "%";
    return map[tok] !== undefined ? String(map[tok]) : whole;
  });
}

/**
 * Produces one datetime custom element's displayed string from its own
 * {target, format, strftime} data. A blank/absent strftime falls back to
 * that format's default pattern (DT_DEFAULT_PATTERNS). Countdown counts
 * toward the target from nowMs; every other format renders the target
 * timestamp itself (a fixed value, never ticks).
 * @param d the element's custom_elements entry
 * @param nowMs current time in ms (only used by countdown)
 * @return the string to display, "" if the target doesn't parse
 */
function datetimeText(d, nowMs) {
  var format = d.format || "countdown";
  var pattern = (d.strftime && d.strftime.trim()) ? d.strftime : (DT_DEFAULT_PATTERNS[format] || DT_DEFAULT_PATTERNS.countdown);
  var target = new Date(d.target || Date.now());
  if (isNaN(target.getTime())) return "";
  if (format === "countdown") return countdownFormat(target.getTime() - (nowMs || Date.now()), pattern);
  return strftimeFormat(target, pattern);
}

/**
 * Whether a datetime format needs a live ticking interval: only countdown
 * changes second to second, the static date/time formats render the fixed
 * target once and never move.
 * @param format the datetime element's format
 * @return true if it should tick
 */
function datetimeIsLive(format) {
  return (format || "countdown") === "countdown";
}

/**
 * Formats a Date as the local "YYYY-MM-DDTHH:mm" string a
 * `<input type="datetime-local">` expects for its value, in the visitor's
 * own local time (not UTC, unlike toISOString()).
 * @param d the Date
 * @return the datetime-local input value
 */
function toDatetimeLocalValue(d) {
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

/**
 * (Re)paints one datetime element's text from its own data and, for a live
 * (countdown) format, (re)starts its per-element ticking interval, clearing
 * any previous one first so calling this again (eg after a format/pattern
 * change in the style popover) never leaks a timer. The element is a plain
 * text element (styleable like any text field, see .dt-el / colorTarget()),
 * not the hero countdown's boxed clock: the standalone "Date/time" element
 * is deliberately just the reformattable time text, the "Countdown timer"
 * object is what composes it with a box and labels.
 * @param el the datetime element (data-datetime already set)
 * @param d its custom_elements entry ({target, format, strftime})
 */
function renderDatetimeContent(el, d) {
  if (el._dtInterval) { clearInterval(el._dtInterval); el._dtInterval = null; }
  var paint = function () { el.textContent = datetimeText(d, Date.now()); };
  paint();
  if (datetimeIsLive(d.format)) el._dtInterval = setInterval(paint, 1000);
}

/**
 * Strips a link's href and swallows its clicks, so it can't navigate the
 * preview iframe away to a page a real visitor there shouldn't reach.
 * @param el the link to neuter
 * @param dim false to skip the disabled-looking dimming, for a link that
 *   wraps an editable data-edit-id child (e.g. the brand text): the whole
 *   link still shouldn't navigate, but it shouldn't look disabled either
 *   since part of it is a live editable field
 */
function neuterLink(el, dim) {
  if (!el) return;
  el.removeAttribute("href");
  if (dim !== false) {
    el.style.opacity = ".5";
    el.style.cursor = "default";
  }
  el.addEventListener("click", function (e) { e.preventDefault(); });
}

/**
 * Checks whether the preview iframe is in click-to-edit mode (a toggle in
 * preview.html, see js/preview.js). Meaningless outside of preview mode.
 * @return true if &edit=1 is set
 */
function isEditMode() {
  return /[?&]edit=1(&|$)/.test(window.location.search);
}

/**
 * Applies saved text overrides on top of the page's own hardcoded copy.
 * Every element carrying a data-edit-id keeps the template's default text
 * until a ta overrides it via click-to-edit; stashes that default in a
 * data attribute first so a later edit can tell if it's back to the
 * original wording (see wireClickToEdit()'s blur handler). Skips
 * #portalLink on a real (non-preview) load where a session is already
 * logged in: updatePortalLink() runs earlier in DOMContentLoaded and has
 * already swapped its text to "Staff Portal"/"Dashboard" for this visitor, so
 * capturing that swapped text as the "default" (or overwriting it with a
 * saved "Access portal" override meant for logged-out visitors) would
 * break the per-session label. In preview mode updatePortalLink() never
 * reaches that swap (it neuters and returns early instead), so the ta
 * previewing/editing still gets a normal, fully editable field.
 * Also stamps data-overridden on every field (cleared if there's no saved
 * override), so a theme-toggle's ".tic-label" (see buildCustomElement()'s
 * "theme" kind) can tell refreshThemeToggles() (js/theme.js) apart from a
 * plain default: only a field with no override left has its text kept in
 * sync with the live theme instead of whatever a ta typed over it.
 * @param textMap {id: overrideHtml}, from content.text
 */
function applyTextOverrides(textMap) {
  var skipPortalLink = !isPreviewMode() && localStorage.getItem("session") && localStorage.getItem("role");
  document.querySelectorAll("[data-edit-id]").forEach(function (el) {
    if (skipPortalLink && el.id === "portalLink") return;
    el.setAttribute("data-default-html", el.innerHTML);
    var id = el.getAttribute("data-edit-id");
    if (textMap && textMap[id] !== undefined) {
      el.innerHTML = textMap[id];
      el.dataset.overridden = "1";
    } else {
      delete el.dataset.overridden;
    }
  });
}

/* every element that can be resized/moved in the visual editor: text
   fields (data-edit-id) and every other tagged box - images, icons, cards,
   nav, sections, footer, buttons, day rows, tiles (data-resize-id). */
var RESIZABLE_SEL = "[data-edit-id], [data-resize-id]";

/**
 * Reads the id an element's size/position overrides are keyed by.
 * @param el the element
 * @return its data-edit-id or data-resize-id
 */
function elId(el) {
  return el.getAttribute("data-edit-id") || el.getAttribute("data-resize-id");
}

/**
 * Resolves the element a click actually selects (RING_EL, or a right-click's
 * context-menu target), starting from `target.closest(RESIZABLE_SEL)`. A
 * theme toggle is the one place in this codebase where a RESIZABLE_SEL match
 * (its own data-edit-id ".tic-label" span) sits nested inside ANOTHER
 * RESIZABLE_SEL element (the button's own data-resize-id) - every other
 * field is either the resizable unit itself (a plain text box) or a single
 * tagged `<a class="btn">`/`<button>` with no separately-tracked child, so
 * `closest()` landing on the nearest match is normally exactly right. Here
 * it isn't: the label has no resize handles or style controls of its own
 * (isButtonEl()/colorTarget()'s bg/icon/color rows all key off the outer
 * button), so a click landing on the label text - most of the button's
 * clickable area - would otherwise select just the label, hiding the
 * Background/Text color/Change icon rows entirely. Redirecting up to the
 * button leaves the label's own click-to-edit text entry untouched (see
 * wireTextField(), wired directly on the label and independent of
 * selection), it only changes what gets selected/right-clicked/styled.
 * @param target the event's target (e.g. e.target)
 * @return the element to select, or null
 */
function resolveSelectableTarget(target) {
  var el = target && target.closest ? target.closest(RESIZABLE_SEL) : null;
  if (el && el.classList.contains("tic-label")) {
    var toggle = el.closest("[data-theme-toggle], #themeBtn");
    if (toggle) return toggle;
  }
  return el;
}

/**
 * True for a theme toggle's own ".tic-label" span: a RESIZABLE_SEL match
 * (its data-edit-id) that still isn't an independent element the way every
 * other tracked descendant is. It's permanently glued to its button (no UI
 * ever selects it on its own, see resolveSelectableTarget()), so unlike a
 * nav link sitting inside the tracked nav bar - which SHOULD stay exactly
 * where a ta put it if the nav itself is later moved/resized, per
 * ancestorPos()'s "no attachment between elements" rule - the label is
 * supposed to move and resize as one physical piece with its button,
 * exactly like the plain (untracked) sun/moon icon markup already sitting
 * right next to it. Used to opt the label out of that rule everywhere it's
 * enforced (ancestorPos(), freezeDescendants()), rather than opting out of
 * RESIZABLE_SEL matching altogether, which would also break its
 * data-edit-id-driven click-to-edit text (wireTextField()) and its saved
 * text override (applyTextOverrides()), neither of which cares about this
 * distinction.
 * @param el the element
 * @return true if el is a theme toggle's label
 */
function isThemeToggleLabel(el) {
  return !!(el.classList && el.classList.contains("tic-label") &&
    el.parentElement && el.parentElement.hasAttribute &&
    (el.parentElement.hasAttribute("data-theme-toggle") || el.parentElement.id === "themeBtn"));
}

/**
 * Classifies an element so a resize drag can pick the right aspect-ratio
 * rule: an icon never distorts no matter what (its box's own ratio always
 * locked); an image or video never distorts its pixels either (object-fit:
 * cover re-crops instead), but its box's ratio is only locked while shift is
 * held; everything else (text boxes, cards, sections, buttons) always
 * resizes its two axes independently.
 * @param el the element
 * @return "icon", "img" or "box"
 */
function elKind(el) {
  var tag = (el.tagName || "").toLowerCase();
  if (tag === "svg") return "icon";
  var rid = el.getAttribute("data-resize-id") || "";
  if (rid.indexOf("icon.") === 0 || /\.icon$/.test(rid)) return "icon";
  if (tag === "img" || tag === "video") return "img";
  return "box";
}

/**
 * Reads an element's own move offset off its dataset, 0,0 if never moved.
 * This is the element's own offset only; what actually paints also cancels
 * out every tracked ancestor's offset, see paintPos().
 * @param el the element
 * @return {tx, ty}
 */
function getPos(el) {
  return {
    tx: parseFloat(el.dataset.ovTx) || 0,
    ty: parseFloat(el.dataset.ovTy) || 0
  };
}

/**
 * Reads an element's current box size: its explicit override if it's been
 * resized, else the size it was detached from flow at, else its live
 * rendered size. Layout px, not visual px, so an element with its own
 * stylesheet transform (eg. the scaled-up brand logo) doesn't jump when a
 * resize starts.
 * @param el the element
 * @return {w, h}
 */
function getSize(el) {
  var w = parseFloat(el.dataset.ovW);
  var h = parseFloat(el.dataset.ovH);
  if (!isNaN(w) && !isNaN(h)) return { w: w, h: h };
  if (el.dataset.natW !== undefined) {
    return { w: parseFloat(el.dataset.natW), h: parseFloat(el.dataset.natH) };
  }
  var r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

/**
 * The move offset of el's NEAREST tracked ancestor only, not every tracked
 * ancestor above it. Used to cancel a container's translate back out of the
 * elements inside it: moving a section or a card slides only that box,
 * never the independent text/icons/images sitting in it (no attachment
 * between elements). Only the nearest one matters because css transforms
 * compound down the real dom chain on their own: a card nested in a moved
 * section already paints its own cancel-transform for the section's move,
 * and that cancellation carries down to everything inside the card for
 * free. A title two levels down (section > card > title) summing BOTH
 * the section's offset and the card's would cancel the section's move
 * twice, once via the card's own painted transform propagating down and
 * again via its own, landing it exactly backwards instead of standing
 * still.
 * A theme toggle's own ".tic-label" is the one exception: it isn't an
 * independent element at all (see isThemeToggleLabel()), so its button
 * parent is never treated as a cancel-worthy ancestor - the label is
 * supposed to move/resize as one piece with the button, exactly like the
 * plain (untracked) icon markup sitting right next to it.
 * @param el the element
 * @return {tx, ty}
 */
function ancestorPos(el) {
  if (isThemeToggleLabel(el)) return { tx: 0, ty: 0 };
  var p = el.parentElement;
  while (p && p !== document.body) {
    if (p.matches && p.matches(RESIZABLE_SEL)) {
      return { tx: parseFloat(p.dataset.ovTx) || 0, ty: parseFloat(p.dataset.ovTy) || 0 };
    }
    p = p.parentElement;
  }
  return { tx: 0, ty: 0 };
}

/**
 * The id of el's nearest tracked ancestor (its own local stacking-context
 * scope, see applyLayerOrder()), or "" if el is top-level (no tracked
 * ancestor). Same walk as ancestorPos(), just returning the id instead of
 * the offset: z-index only ever compares elements within the SAME
 * stacking context, so two elements only "layer" against each other
 * meaningfully when they share this same nearest tracked ancestor (an icon
 * inside one card can never visually out-layer a button inside a totally
 * different section, no matter what a flat page-wide order says).
 * @param el the element
 * @return the ancestor's data-edit-id/data-resize-id, or ""
 */
function nearestTrackedAncestorId(el) {
  var p = el.parentElement;
  while (p && p !== document.body) {
    if (p.matches && p.matches(RESIZABLE_SEL)) return elId(p);
    p = p.parentElement;
  }
  return "";
}

/**
 * Writes el's painted transform: its own move offset minus its tracked
 * ancestors' (see ancestorPos()). A translate is a purely paint-time
 * effect, so moving an element can never push or reflow anything else on
 * the page. An element with a stylesheet transform of its own (the scaled
 * brand logo, the flipped cta arrow) keeps it, composed after the
 * translate, instead of having it silently stomped by the inline style.
 * @param el the element
 */
function paintPos(el) {
  if (el.dataset.baseXf === undefined) {
    var base = getComputedStyle(el).transform;
    el.dataset.baseXf = base && base !== "none" ? base : "";
  }
  var own = getPos(el);
  var anc = ancestorPos(el);
  var tx = own.tx - anc.tx, ty = own.ty - anc.ty;
  var xf = tx || ty ? "translate(" + tx + "px, " + ty + "px)" : "";
  if (el.dataset.baseXf) xf = (xf ? xf + " " : "") + el.dataset.baseXf;
  /* a naturally *inline* element (a plain <span>, eg. the hero title text)
     ignores transform entirely per spec until blockified, same reason a
     move/resize of the span ITSELF already calls detachFromFlow() first
     (see startMoveDrag()). This is the same problem one step removed: el's
     OWN offset can be 0 (it was never individually touched) and it can
     still need a non-empty transform here purely to cancel out a tracked
     ANCESTOR's move (see ancestorPos()) - without this, the cancellation
     is silently a no-op and el visually drags along with its ancestor,
     exactly contradicting "no attachment between elements". Forcing
     inline-block (not a full detachFromFlow: nothing here needs a frozen
     size or position:absolute, only the ability to accept a transform) is
     enough, and only applied once a transform is actually needed. */
  if (xf && getComputedStyle(el).display === "inline") el.style.display = "inline-block";
  el.style.transform = xf;
  /* a css transition on transform (eg. .card's) would make el lag behind
     the cursor for its duration, and the ring reads el's rect synchronously */
  if (xf) el.style.transition = "none";
}

/**
 * Sets el's own move offset and repaints it plus every tracked element
 * inside it: their painted transforms cancel el's out (see ancestorPos()),
 * so they visually stay put while el's own box slides underneath them.
 * @param el the element
 * @param tx horizontal offset in css px
 * @param ty vertical offset in css px
 */
function setOwnPos(el, tx, ty) {
  if (!tx && !ty) {
    delete el.dataset.ovTx;
    delete el.dataset.ovTy;
  } else {
    el.dataset.ovTx = tx;
    el.dataset.ovTy = ty;
  }
  paintPos(el);
  el.querySelectorAll(RESIZABLE_SEL).forEach(paintPos);
}

/**
 * Writes a real width/height onto an element (already detached from flow
 * by detachFromFlow(), so this can never push, shrink, or otherwise reflow
 * anything else on the page). A real box size, not a `transform: scale()`,
 * is the whole point: the box only dictates how the content inside flows.
 * Text rewraps at its own unchanged character size (the A-/A+ buttons are
 * the only thing that changes the letters themselves), and an image keeps
 * its authored object-fit (cover) and re-crops to whatever shape the box
 * is, rather than stretching its pixels.
 * @param el the element
 * @param w new width in css px
 * @param h new height in css px
 */
function setBox(el, w, h) {
  el.dataset.ovW = w;
  el.dataset.ovH = h;
  el.style.width = w + "px";
  el.style.height = h + "px";
}

/**
 * Clears a resize back to the template's own sizing: el stays detached
 * (its wrap still holds its original slot open) but returns to the exact
 * size it was detached at.
 * @param el the element
 */
function resetBox(el) {
  delete el.dataset.ovW;
  delete el.dataset.ovH;
  el.style.width = parseFloat(el.dataset.natW) + "px";
  el.style.height = parseFloat(el.dataset.natH) + "px";
}

/**
 * Persists el's current move offset (or clears it if back at 0,0): the
 * shared tail end of a move drag, a resize drag (which can also shift
 * position, see startResizeDrag()), and undo/redo replaying either one.
 * @param el the element
 */
function commitPosition(el) {
  var p = getPos(el);
  if (p.tx || p.ty) saveEditedPosition(elId(el), Math.round(p.tx), Math.round(p.ty));
  else saveEditedPosition(elId(el), null, null);
}

/**
 * Persists el's current size: the shared tail end of a resize drag and of
 * undo/redo replaying one.
 * @param el the element
 */
function commitSize(el) {
  var s = getSize(el);
  saveEditedSize(elId(el), { w: Math.round(s.w), h: Math.round(s.h) });
  mirrorTiledRoleStyle(el);
}

/**
 * Mirrors an attachments/day tile's rect/icon/text/button role element's
 * live inline style onto every other tile's same-role element (every
 * rendered tile shares one data-resize-id/data-edit-id per role, so a style
 * edit to any single tile is meant to apply to the shared template - see
 * js/dashboard.js's buildExtrasTileHtml()/renderDays()). Checks both
 * data-extras-role (attachments tiles) and data-days-role (day tiles, two
 * independent templates - locked and open never mirror into each other
 * since they carry different role values). applyColorOverrides()/
 * applySizeOverrides()/etc. already repaint every matching id from the saved
 * maps on the NEXT load; this only covers the live, same-session gap, since
 * those inputs otherwise only ever touch styleMenuEl()'s single match (see
 * buildStyleMenu()'s colorInput/radiusInput/etc. handlers) and a resize drag
 * only ever touches the one dragged element. A no-op for every element
 * outside a tiled area.
 * @param el a just-edited element, any kind
 */
function mirrorTiledRoleStyle(el) {
  var attr = el.hasAttribute("data-extras-role") ? "data-extras-role"
    : el.hasAttribute("data-days-role") ? "data-days-role" : null;
  if (!attr) return;
  var role = el.getAttribute(attr);
  var cssText = el.style.cssText;
  var opColor = el.dataset.opColor, opAlpha = el.dataset.opAlpha, baseColor = el.dataset.baseColor;
  document.querySelectorAll('[' + attr + '="' + role + '"]').forEach(function (other) {
    if (other === el) return;
    other.style.cssText = cssText;
    if (opColor === undefined) delete other.dataset.opColor; else other.dataset.opColor = opColor;
    if (opAlpha !== undefined) other.dataset.opAlpha = opAlpha;
    if (baseColor !== undefined) other.dataset.baseColor = baseColor;
  });
}

/**
 * Moves el to an exact {tx, ty} and persists it: used by a move drag's
 * mouseup and by undo/redo replaying a "move" history entry, so both go
 * through the exact same code.
 * @param el the element
 * @param pos {tx, ty}
 */
function applyMoveSide(el, pos) {
  detachFromFlow(el);
  setOwnPos(el, pos.tx, pos.ty);
  commitPosition(el);
  positionRing();
}

/**
 * Resizes (and, since a left/top-handle drag can shift position too,
 * repositions) el to an exact {w, h, tx, ty} and persists both: used by a
 * resize drag's mouseup, a double-click reset, and undo/redo replaying a
 * "resize" history entry, so all three go through the exact same code.
 * @param el the element
 * @param box {w, h, tx, ty}
 */
function applyResizeSide(el, box) {
  detachFromFlow(el);
  setBox(el, box.w, box.h);
  setOwnPos(el, box.tx, box.ty);
  commitSize(el);
  commitPosition(el);
  positionRing();
}

/**
 * Pushes a "move" undo entry (see applyHistoryAction()) unless the drag
 * didn't actually change anything (eg a double-click reset with nothing to
 * reset). Clears the redo stack, same as any other fresh edit.
 * @param id the element's data-edit-id or data-resize-id
 * @param before {tx, ty} before the drag
 * @param after {tx, ty} after the drag
 */
function pushMoveUndo(id, before, after) {
  if (before.tx === after.tx && before.ty === after.ty) return;
  EDIT_UNDO.push({ type: "move", id: id, before: { tx: before.tx, ty: before.ty }, after: { tx: after.tx, ty: after.ty } });
  EDIT_REDO.length = 0;
}

/**
 * Pushes a "resize" undo entry (see applyHistoryAction()), same no-op guard
 * and redo-clearing as pushMoveUndo().
 * @param id the element's data-edit-id or data-resize-id
 * @param before {w, h, tx, ty} before the drag
 * @param after {w, h, tx, ty} after the drag
 */
function pushResizeUndo(id, before, after) {
  if (before.w === after.w && before.h === after.h && before.tx === after.tx && before.ty === after.ty) return;
  EDIT_UNDO.push({ type: "resize", id: id, before: before, after: after });
  EDIT_REDO.length = 0;
}

/**
 * Applies saved size overrides (from a resize-handle drag, see
 * startResizeDrag()) on top of the page's own default sizing, for every
 * tracked element that has one. Runs on every load, live site included,
 * same as applyTextOverrides(): a saved size means real width/height, so
 * the element needs detaching from flow first (see detachFromFlow()) even
 * outside the ta portal's editor, otherwise a visitor's page would reflow
 * around the resized element. Elements with no saved size are left
 * completely untouched, in flow, exactly as the template renders them.
 * @param sizes content.sizes, {id: {w, h}}
 */
function applySizeOverrides(sizes) {
  sizes = sizes || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var s = sizes[elId(el)];
    if (!s || s.w === undefined) return;
    detachFromFlow(el);
    setBox(el, s.w, s.h === undefined ? parseFloat(el.dataset.natH) : s.h);
  });
}

/**
 * Applies saved font-size overrides (from the A-/A+ buttons, see
 * showTextToolbar()) on top of the page's own default type scale, for
 * every click-to-edit text field that carries one.
 * @param sizes content.font_sizes, {id: px}
 */
function applyFontSizeOverrides(sizes) {
  sizes = sizes || {};
  /* RESIZABLE_SEL, not just [data-edit-id]: a datetime element (data-resize-id)
     is styleable like text too, see colorTarget()/the style popover */
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (sizes[id]) el.style.fontSize = sizes[id];
  });
}

/**
 * Applies saved whole-field text style overrides (font family, alignment,
 * letter spacing, see showTextToolbar()/saveTextStyle()) on top of the
 * page's own default styling, for every click-to-edit text field that
 * carries one. Runs on every load, live site included, same as
 * applyTextOverrides().
 * @param styles content.text_styles, {id: {fontFamily, align, letterSpacing}}
 */
function applyTextStyleOverrides(styles) {
  styles = styles || {};
  /* RESIZABLE_SEL, not just [data-edit-id]: a datetime element is styleable
     like text too, see applyFontSizeOverrides() */
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var s = styles[elId(el)];
    if (!s) return;
    if (s.fontFamily) {
      /* a ta-uploaded font (s.fontUrl set) needs its @font-face declared
         before the name means anything: a real visitor's browser needs
         this exactly as much as the ta's own portal tab does, so this runs
         unconditionally here rather than only inside the editor */
      if (s.fontUrl) ensureFontFace(s.fontFamily, s.fontUrl);
      el.style.fontFamily = s.fontFamily;
    }
    if (s.align) el.style.textAlign = s.align;
    if (s.letterSpacing) el.style.letterSpacing = s.letterSpacing;
  });
}

/**
 * Applies saved move offsets (from a move-handle drag, see
 * startMoveDrag()) on top of the page's own default flow position. Runs on
 * every load, live site included, same as applyTextOverrides(). A block/
 * inline-block element's flow slot is untouched either way, a translate is
 * paint-only, but a naturally *inline* element (a plain <span>, eg. the
 * hero title text) ignores `transform` entirely per spec until blockified,
 * so any element carrying a saved position still needs detachFromFlow()
 * first; a size override already forced that in applySizeOverrides()
 * (called before this), so this is a no-op for those. Two passes so every
 * element's cancel-out of its ancestors' offsets (see ancestorPos()) sees
 * those offsets already in place.
 * @param positions content.positions, {id: {tx, ty}}
 */
function applyPositionOverrides(positions) {
  positions = positions || {};
  var els = document.querySelectorAll(RESIZABLE_SEL);
  els.forEach(function (el) {
    var p = positions[elId(el)];
    if (p) {
      detachFromFlow(el);
      el.dataset.ovTx = p.tx;
      el.dataset.ovTy = p.ty;
    }
  });
  els.forEach(paintPos);
}

/* every id currently deleted (data-edit-id/data-resize-id), kept in sync by
   applyHiddenOverrides()/setElementHidden() below. setHiddenVisual() checks
   this so hiding a wrapper never forces a child that's independently
   deleted back to visible, see its own doc comment. */
var HIDDEN_IDS = {};

/**
 * Hides every element a ta deleted in the visual editor (see
 * deleteElement()), on every load, live site included, same as
 * applyTextOverrides(). A deleted id can match more than one element
 * (mirrored text like the brand wordmark, nav + footer); all of them hide
 * together, same "an id is one logical thing" rule as the rest of this file.
 * @param hidden array of data-edit-id/data-resize-id values to hide
 */
function applyHiddenOverrides(hidden) {
  HIDDEN_IDS = {};
  (hidden || []).forEach(function (id) { HIDDEN_IDS[id] = true; });
  (hidden || []).forEach(function (id) {
    document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
      setHiddenVisual(el, true);
    });
  });
}

/**
 * Whether el has any independently-tagged element nested inside it (eg the
 * brand link wraps the logo image and brand text, or the hero section wraps
 * its own eyebrow/title/countdown box, each separately resizable/editable).
 * Used to tell a plain leaf element (a hero CTA button, nothing tracked
 * nested inside it) from a wrapper other tagged elements depend on staying
 * visible/present when it's deleted.
 * @param el the element
 * @return true if el has a tracked descendant
 */
function hasTrackedDescendants(el) {
  return el.querySelectorAll(RESIZABLE_SEL).length > 0;
}

/**
 * Applies (or removes) the "deleted" look/behavior for one element, without
 * persisting anything (setElementHidden() below does that on top of this;
 * applyHiddenOverrides() calls this directly on every load, since a real
 * visitor's page must never write to localStorage). A leaf element (nothing
 * independently tracked inside it) gets display:none, detached from flow
 * first (see detachFromFlow()) so its own slot stays reserved and removing
 * it can never reflow a sibling into the gap, same "no attachment between
 * elements" guarantee a move/resize already gets.
 *
 * Any element wrapping other independently-tagged elements (eg the brand
 * link around the logo image and brand text, or a section/card around its
 * own nested text/images/icons) can't use display:none at all: css
 * unconditionally hides every descendant of a hidden element too, which
 * would take those down with it even though none of them was the thing
 * actually selected for deletion. Physically moving them out to become
 * siblings (an earlier attempt at this) broke just as badly, dropping them
 * out of whatever flex/inline layout the wrapper used to arrange them,
 * straight into the surrounding layout's own flow, visibly reshuffling
 * everything else in it. Instead the wrapper is made invisible but still
 * present: visibility:hidden on it (unlike display:none, this doesn't
 * force-hide descendants, css lets any of them override back to visible on
 * their own), with visibility:visible stamped onto every tracked descendant
 * so they stay fully visible and interactive exactly as before, deleting a
 * section can never take its independent children down with it. A
 * descendant that's independently deleted in its own right (its id is in
 * HIDDEN_IDS) is left alone here rather than forced visible, so deleting a
 * wrapper never accidentally resurrects something inside it that was
 * already separately deleted.
 * @param el the element
 * @param hide true to hide/delete it, false to restore it
 */
function setHiddenVisual(el, hide) {
  if (hasTrackedDescendants(el)) {
    el.classList.toggle("el-deleted", hide);
    el.style.visibility = hide ? "hidden" : "";
    el.querySelectorAll(RESIZABLE_SEL).forEach(function (child) {
      var childId = elId(child);
      if (childId && HIDDEN_IDS[childId]) return;
      child.style.visibility = hide ? "visible" : "";
    });
  } else {
    if (hide) detachFromFlow(el);
    el.style.display = hide ? "none" : "";
  }
}

/* the visual editor's stacking order, bottom to top: which id's element
   paints on top of which. an explicit ordered list a ta controls with the
   ring's layer up/down handles (see moveLayer()), not the old syncStacking()
   guess ("whatever was touched last must be on top", removed - it stomped
   its own z-index the moment two touched elements overlapped, since resize/
   move and stacking order shared the same inline style property). kept as
   the in-memory canonical order so moveLayer() can shift one id without
   re-deriving everything from content.layers again. */
var LAYER_ORDER = [];

/* the hero's own background video/scrim are deliberately not
   data-edit-id/data-resize-id elements (no ring, no move/resize handles,
   see CLAUDE.md's Media bullets), but a ta still needs "send to back" on
   some OTHER element to be able to reach all the way behind them, not just
   behind other tracked content, since visually they're as much a part of
   "the page" as anything else. Two fixed synthetic ids, resolved by a
   plain selector instead of a data attribute, let them take part in the
   exact same flat z-index ranking as every real tracked leaf (see
   applyLayerOrder()) without making them independently selectable/
   resizable, which is still deliberately not offered for these two. */
var HERO_MEDIA_IDS = { "media.hero.video": ".hero-bg", "media.hero.scrim": ".hero-scrim" };

/**
 * Every currently-rendered tracked element's id, in DOM (paint) order,
 * deduplicated. Seeds a sane default stack for any id a saved content.layers
 * list doesn't know about yet (a fresh blob, or a template id added since
 * it was saved), so an untouched page's stacking still matches exactly what
 * it looked like before any layer system existed. The hero's background
 * video/scrim (see HERO_MEDIA_IDS) are seeded first, ahead of everything
 * else, matching the backdrop position they've always visually had.
 * @return array of ids, document order
 */
function domOrderIds() {
  var seen = {};
  var ids = [];
  Object.keys(HERO_MEDIA_IDS).forEach(function (id) {
    if (document.querySelector(HERO_MEDIA_IDS[id])) { seen[id] = true; ids.push(id); }
  });
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (id && !seen[id]) { seen[id] = true; ids.push(id); }
  });
  return ids;
}

/* ids "promoted to navbar" (see the right-click "Promote to navbar" menu
   option, toggleFixed()): these always stack above every non-fixed element
   regardless of layer order, since a sticky/fixed-position element (the nav
   bar itself, by default, see NAV_FIXED_IDS in app/db.py) needs to actually
   stay on top of scrolling page content, not just whatever its DOM position
   happened to sort it to. an object keyed by id for O(1) lookup. */
var FIXED_SET = {};

/**
 * Whether an id is currently promoted to the always-on-top group.
 * @param id a data-edit-id or data-resize-id value
 * @return true if fixed
 */
function isFixed(id) {
  return !!FIXED_SET[id];
}

/**
 * Rebuilds FIXED_SET from a saved content.fixed_elements list. Doesn't touch
 * z-index itself, applyLayerOrder() does that; call this first so the
 * banding below sees the right group for each id.
 * @param ids content.fixed_elements
 */
function setFixedElements(ids) {
  FIXED_SET = {};
  (ids || []).forEach(function (id) { FIXED_SET[id] = true; });
}

/**
 * Toggles one id in or out of the always-on-top group (the right-click
 * "Promote to navbar" / "Remove from navbar" option), then repaints the
 * stacking order and the red edit-mode highlight, and persists the change.
 * @param id the element's data-edit-id or data-resize-id
 */
function toggleFixed(id) {
  if (FIXED_SET[id]) delete FIXED_SET[id];
  else FIXED_SET[id] = true;
  saveFixedElements(Object.keys(FIXED_SET));
  applyLayerOrder(LAYER_ORDER);
  applyFixedHighlight();
}

/**
 * Persists the whole fixed-elements set into the preview snapshot, the same
 * localStorage draft every other override here uses. Rewritten wholesale,
 * same as saveLayerOrder()/saveCustomElements().
 * @param ids Object.keys(FIXED_SET)
 */
function saveFixedElements(ids) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.fixed_elements = ids;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/* ids locked against being moved (right-click "Lock element"/"Unlock
   element", see toggleLocked()): blocks both the drag-anywhere-to-move
   affordance and the ring's own move handle from starting a drag, so a
   placed element can't be nudged out of position by an accidental
   click-drag. Resizing, text editing, deleting, layering, and color/
   opacity are all still allowed while locked, only moving is blocked. an
   object keyed by id for O(1) lookup, same shape as FIXED_SET. */
var LOCKED_SET = {};

/**
 * Whether an id is currently locked against moving.
 * @param id a data-edit-id or data-resize-id value
 * @return true if locked
 */
function isLocked(id) {
  return !!LOCKED_SET[id];
}

/**
 * Rebuilds LOCKED_SET from a saved content.locked list, same pattern as
 * setFixedElements().
 * @param ids content.locked
 */
function setLockedElements(ids) {
  LOCKED_SET = {};
  (ids || []).forEach(function (id) { LOCKED_SET[id] = true; });
}

/**
 * Toggles one id in or out of the locked set (the right-click "Lock
 * element"/"Unlock element" option), repaints the grey edit-mode
 * highlight, and persists the change. Its own inverse, same as
 * toggleFixed(), so undo/redo just call it again either direction.
 * @param id the element's data-edit-id or data-resize-id
 */
function toggleLocked(id) {
  if (LOCKED_SET[id]) delete LOCKED_SET[id];
  else LOCKED_SET[id] = true;
  saveLockedElements(Object.keys(LOCKED_SET));
  applyLockHighlight();
}

/**
 * Persists the whole locked-elements set into the preview snapshot, the
 * same localStorage draft every other override here uses. Rewritten
 * wholesale, same as saveFixedElements().
 * @param ids Object.keys(LOCKED_SET)
 */
function saveLockedElements(ids) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.locked = ids;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Paints the always-visible grey "this is locked" outline (.edit-locked in
 * css/style.css) onto every currently-rendered element in LOCKED_SET, and
 * clears it off everything else, same pattern as applyFixedHighlight().
 */
function applyLockHighlight() {
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    el.classList.toggle("edit-locked", isLocked(elId(el)));
  });
}

/**
 * Paints the always-visible red "this is fixed" outline (see .edit-fixed in
 * css/style.css) onto every currently-rendered element in FIXED_SET, and
 * clears it off everything else. Only actually visible under body.edit-mode
 * (the css rule is scoped there), but harmless to run unconditionally.
 */
function applyFixedHighlight() {
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    el.classList.toggle("edit-fixed", isFixed(elId(el)));
  });
}

/**
 * Marks every tagged element that's either an actual link (`<a>`) or has a
 * right-click "Add link" url set (see LINKS/applyOneLink()) with
 * .edit-link (yellow hitbox, orange if it's also fixed, see
 * css/style.css), so anything that navigates when clicked reads as
 * visually distinct from the plain content nested inside it, instead of
 * just another same-colored overlapping box. Reruns on every
 * setElementLink(), same as applyFixedHighlight() reruns on every
 * toggleFixed().
 */
function applyLinkHighlight() {
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    el.classList.toggle("edit-link", el.tagName === "A" || !!LINKS[elId(el)]);
  });
}

/* every id with a right-click "Add link"/"Edit link" url set, mirrors
   content.links exactly, see setLinks() */
var LINKS = {};

/**
 * Makes one element actually navigate to url when clicked. A real `<a>`
 * tag (a button, the brand link) just gets a real href, same as any
 * ordinary link, so the browser's own affordances (new tab, status bar
 * preview, ctrl-click) work normally; inside the visual editor,
 * wireClickToEdit()'s own click handler already preventDefaults before
 * this ever fires (see wireTextField()), so a linked button never
 * navigates away mid-edit with no extra handling needed here. Anything
 * else (a card, an image, a plain text field, none of which have a
 * navigable href of their own) gets a click listener that navigates
 * instead, gated on !isEditMode() so clicking it in the visual editor
 * still selects/edits normally rather than leaving the page. Guarded by
 * a JS property, not a dataset attribute: cloneNode() (see
 * duplicateElement()) copies attributes but never properties or
 * listeners, so a freshly duplicated element always gets its own real
 * listener re-wired here rather than trusting a copied flag that would
 * otherwise look "already wired" with no actual listener behind it.
 * @param el the element
 * @param url the link target, or "" to remove it
 */
function applyOneLink(el, url) {
  if (el.tagName === "A") {
    if (url) el.href = url; else el.removeAttribute("href");
    return;
  }
  if (!el._hrLinkWired) {
    el._hrLinkWired = true;
    el.addEventListener("click", function () {
      if (isEditMode()) return;
      if (el._hrLinkUrl) window.location.href = el._hrLinkUrl;
    });
  }
  el._hrLinkUrl = url || "";
  el.style.cursor = url ? "pointer" : "";
}

/**
 * Rebuilds LINKS from a saved content.links map and applies every entry to
 * its element (see applyOneLink()), same load-time pattern as
 * setFixedElements()/setLockedElements().
 * @param links content.links, {id: url string}
 */
function setLinks(links) {
  LINKS = links ? Object.assign({}, links) : {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var url = LINKS[elId(el)];
    if (url) applyOneLink(el, url);
  });
}

/**
 * Sets (or clears, with url "") the link on one element from the
 * right-click menu's link editor: updates the live element, LINKS, the
 * preview snapshot, the edit-mode highlight, and pushes an undo entry.
 * @param id the element's data-edit-id or data-resize-id
 * @param url the link target, or "" to remove it
 */
function setElementLink(id, url) {
  var before = LINKS[id] || "";
  var after = url || "";
  if (before === after) return;
  var el = styleMenuElById(id);
  if (el) applyOneLink(el, after);
  if (after) LINKS[id] = after; else delete LINKS[id];
  saveEditedLink(id, after);
  applyLinkHighlight();
  EDIT_UNDO.push({ type: "link", id: id, before: before, after: after });
  EDIT_REDO.length = 0;
}

/**
 * Applies an explicit stacking order to every tracked element: z-index is
 * just an id's rank (bottom = 1), so the layer menu (see moveLayer()/
 * moveLayerExtreme()) is the only thing that ever reorders elements,
 * resizing or moving one no longer silently bumps it above its neighbours.
 * Only ONE flat rank actually matters (split into two bands, fixed always
 * above non-fixed, see below), not one scoped per container: two EARLIER
 * versions of this both tried to scope z-index per container (per nearest
 * tracked ancestor, then per outermost/top-level tracked ancestor) to work
 * around css only ever comparing z-index within the same stacking context,
 * and both were wrong in different ways. Scoping per nearest ancestor made
 * almost every element its own group of one (a card, an icon's own
 * countdown box), so "bring forward" was a no-op for nearly everything
 * already on the page. Scoping per top-level ancestor (a whole section/
 * nav/header) fixed cross-card reordering within one section, but couldn't
 * reach across DIFFERENT sections, or past any container - tracked or not
 * - that happens to carry its own real css stacking context (eg the hero's
 * own `.hero-media > .wrap`, which needed `z-index: 2` to paint above its
 * background video; see css/style.css, now fixed with negative z-index on
 * the video/scrim instead so `.wrap` needs no stacking context of its own
 * at all). The actual fix: a stacking context can ONLY be escaped by an
 * element that doesn't create one in the first place, so instead of
 * hunting down every container that might quietly wall its children off
 * (an unbounded, easy-to-miss list), NO tracked container (has
 * hasTrackedDescendants()) is ever given an explicit z-index anymore, at
 * ANY nesting depth, top-level or not: it's left at `z-index: auto`, which
 * never establishes a stacking context, so a container can't trap its own
 * tracked children no matter how deep they're nested. Only an actual LEAF
 * (icon, image, text, button, box, custom element, ...) ever competes for
 * a real z-index, and every leaf on the entire page shares the exact same
 * flat ranking, letting a leaf anywhere be sent in front of or behind any
 * other leaf anywhere else, section, card, or custom element alike. The
 * unavoidable trade (a real css constraint, not a bug, since this editor
 * deliberately never reparents elements, see the Grouping/detachFromFlow
 * bullets in CLAUDE.md): a CONTAINER can no longer be reordered as a whole
 * unit against unrelated content, only its individual leaf children can,
 * one at a time. `nav`'s own real stacking context (`.nav` in
 * css/style.css also carries a hardcoded `z-index: 50`, kept as a sane
 * default for a page with no js at all) is topped up dynamically by this
 * function too, not left to that hardcoded value alone: nav is a FIXED
 * container (see NAV_FIXED_IDS), so it gets stamped, same as a fixed leaf
 * would, with a z-index one past the entire non-fixed band, guaranteed to
 * clear it regardless of how many ordinary tracked leaves the page has
 * grown to (an earlier version relied on the css `50` alone, which quietly
 * stopped being enough once the page passed 50 tracked leaves, letting
 * plain content start painting over the sticky nav while scrolling).
 * Reconciles the saved order with what's actually on the page first: any id
 * missing from it is appended in DOM order (see domOrderIds()), so a page
 * that's never had anything reordered still stacks exactly as if there
 * were no layer system at all. Fixed elements (FIXED_SET, see
 * setFixedElements()) are always stacked above every non-fixed one: split
 * into two flat bands, non-fixed first then fixed, each keeping its own
 * relative order, so within either band elements are still individually
 * reorderable (see moveLayer()) but no fixed element's z-index can ever
 * fall below a non-fixed one's. Runs on every load, live site included,
 * same as applyTextOverrides(). Forces position:relative on a still-static
 * leaf first, z-index has no effect otherwise.
 * @param layers content.layers, ordered ids bottom to top
 */
function applyLayerOrder(layers) {
  var order = (layers || []).slice();
  var have = {};
  order.forEach(function (id) { have[id] = true; });
  /* the hero media ids specifically default to the very back (see
     HERO_MEDIA_IDS), never merged in via the generic "append to the end"
     rule below: an already-saved, already-customized order predates these
     two (they didn't used to be part of the ranking at all), so a plain
     append would land them in FRONT of everything already on the page,
     exactly backwards for what's meant to be its own backdrop. Iterated in
     REVERSE key order (video, scrim, so reversed: scrim, video) because
     unshift() prepends, the opposite of domOrderIds()'s own push(): walking
     the keys forward here would unshift video first then scrim second,
     landing scrim BEHIND video (scrim would win the last unshift and end up
     at index 0), invisibly hiding the scrim's own darkening under the
     opaque video regardless of its opacity. Reversing first fixes the final
     order to [video, scrim, ...], video truly backmost, scrim just above
     it, matching domOrderIds()'s own video-then-scrim push order. */
  Object.keys(HERO_MEDIA_IDS).reverse().forEach(function (id) {
    if (!have[id] && document.querySelector(HERO_MEDIA_IDS[id])) { order.unshift(id); have[id] = true; }
  });
  domOrderIds().forEach(function (id) {
    if (!have[id]) { order.push(id); have[id] = true; }
  });
  LAYER_ORDER = order;
  var rank = {};
  order.forEach(function (id, i) { rank[id] = i; });

  /* one flat pass over every actual DOM element: a container (has tracked
     descendants of its own) never gets an explicit z-index, see the doc
     comment above. Iterated by DOM element, not just id, since a mirrored
     id (eg the brand wordmark, shared by the nav and footer) can be two
     different elements at once. */
  var members = [];
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (!id) return;
    members.push({ el: el, id: id, assignZ: !hasTrackedDescendants(el) });
  });
  /* the hero's background video/scrim (see HERO_MEDIA_IDS) join the same
     flat ranking as any other leaf, always assignZ (neither ever wraps
     tracked content), so "send to back" on some other element can outrank
     them same as it would any other leaf. */
  Object.keys(HERO_MEDIA_IDS).forEach(function (id) {
    var el = document.querySelector(HERO_MEDIA_IDS[id]);
    if (el) members.push({ el: el, id: id, assignZ: true });
  });
  var nonFixed = members.filter(function (m) { return !isFixed(m.id); });
  var fixed = members.filter(function (m) { return isFixed(m.id); });
  var byRank = function (a, b) { return (rank[a.id] || 0) - (rank[b.id] || 0); };
  nonFixed.sort(byRank);
  fixed.sort(byRank);
  var z = 1;
  nonFixed.concat(fixed).forEach(function (m) {
    if (!m.assignZ) {
      /* a container never gets a numbered rank the way a leaf does (see the
         doc comment above), but a FIXED one (nav itself, or any other
         element right-click "Promote to navbar" was used on that happens
         to wrap tracked children) still has to visually clear the whole
         non-fixed band while scrolling, same guarantee a fixed LEAF already
         gets. nav used to rely on css/style.css's own hardcoded
         `.nav { z-index: 50 }` for this instead, which quietly stopped
         being enough once the page's actual tracked-leaf count grew past
         50 (each new section/custom element/duplicated card pushes
         ordinary leaves' own js-assigned z-index higher), letting plain
         page content start painting over the sticky nav on scroll. Stamping
         it here instead, one past the highest z-index any non-fixed leaf
         can have, makes it correct regardless of how large that count ever
         grows, no magic number to outgrow again later. Nav's own children
         (the fixed-band leaves) don't need this, they already sit inside
         nav's own stacking context, safely confined there regardless of
         nav's absolute z-index value. */
      m.el.style.zIndex = isFixed(m.id) ? String(nonFixed.length + 1) : "";
      return;
    }
    if (getComputedStyle(m.el).position === "static") m.el.style.position = "relative";
    m.el.style.zIndex = String(z);
    /* a tint overlay (setElementTint()) is a plain untracked sibling div
       appended right after its image inside the same free-wrap: without
       its own z-index it stays at the implicit 0/auto, and ANY element
       here with a real explicit z-index (which is every one of them,
       including its own image) paints above z-index:auto regardless of
       dom order, hiding the tint completely. Giving it the SAME z-index
       as its image is enough, not a higher one: for two elements sharing
       one z-index, plain dom order decides, and the overlay is already
       the later sibling. */
    if (m.el.parentNode && m.el.parentNode.classList && m.el.parentNode.classList.contains("free-wrap")) {
      var tintOv = m.el.parentNode.querySelector(".tint-ov");
      if (tintOv) tintOv.style.zIndex = String(z);
      /* same reasoning, same fix, for a shade overlay (setElementShade()) */
      var shadeOv = m.el.parentNode.querySelector(".shade-ov");
      if (shadeOv) shadeOv.style.zIndex = String(z);
    }
    z++;
  });
}

/**
 * Shifts one element one step up or down the stacking order (a plain
 * adjacent swap with its neighbour, so repeated clicks walk it further each
 * time, see the layer menu's Up/Down buttons), repaints every element's z-index,
 * and persists the whole order. A no-op at either end of the stack. Only
 * ever swaps with the nearest neighbour in the SAME fixed/non-fixed band
 * (see applyLayerOrder()'s own doc comment for why that's the only
 * grouping that still matters now), skipping over any others in between.
 * @param id the element's data-edit-id or data-resize-id
 * @param dir +1 to bring forward one step, -1 to send backward one step
 * @return true if it actually moved, false at either end of its group (so
 *   pushLayerUndo() knows not to record a no-op step)
 */
function moveLayer(id, dir) {
  var i = LAYER_ORDER.indexOf(id);
  if (i === -1) { LAYER_ORDER.push(id); i = LAYER_ORDER.length - 1; }
  var group = isFixed(id);
  var j = i + dir;
  while (j >= 0 && j < LAYER_ORDER.length && isFixed(LAYER_ORDER[j]) !== group) j += dir;
  if (j < 0 || j >= LAYER_ORDER.length) return false;
  var tmp = LAYER_ORDER[i];
  LAYER_ORDER[i] = LAYER_ORDER[j];
  LAYER_ORDER[j] = tmp;
  applyLayerOrder(LAYER_ORDER);
  saveLayerOrder(LAYER_ORDER);
  return true;
}

/**
 * Pushes a "layer" undo entry for a bring-forward/send-backward step (see
 * the layer menu's Up/Down buttons), unless moveLayer() reports it was a
 * no-op (already at that end of its fixed/non-fixed group).
 * @param id the element's data-edit-id or data-resize-id
 * @param dir +1 (forward) or -1 (backward), same as moveLayer()
 */
function pushLayerUndo(id, dir) {
  if (!moveLayer(id, dir)) return;
  EDIT_UNDO.push({ type: "layer", id: id, dir: dir });
  EDIT_REDO.length = 0;
}

/**
 * Moves id all the way to the front or back of its own scope+fixed group
 * (the layer menu's "To top"/"To bottom" buttons): unlike moveLayer()'s
 * single-step swap, this just pulls id out of LAYER_ORDER and drops it back
 * in at the extreme end of the WHOLE array, no scope search needed. Only
 * relative order among the same-scope, same-fixed-band members matters for
 * the z-index applyLayerOrder() ends up assigning (see its doc comment), so
 * an absolute end of the full array is always ALSO an extreme end of
 * whichever scope/group id actually belongs to, since nothing can be more
 * extreme than the literal ends of the whole list.
 * @param id the element's data-edit-id or data-resize-id
 * @param toTop true for "to top" (front), false for "to bottom" (back)
 * @return true if the order actually changed
 */
function moveLayerExtreme(id, toTop) {
  var before = LAYER_ORDER.slice();
  var i = LAYER_ORDER.indexOf(id);
  if (i !== -1) LAYER_ORDER.splice(i, 1);
  if (toTop) LAYER_ORDER.push(id); else LAYER_ORDER.unshift(id);
  if (LAYER_ORDER.join("") === before.join("")) { LAYER_ORDER = before; return false; }
  applyLayerOrder(LAYER_ORDER);
  saveLayerOrder(LAYER_ORDER);
  return true;
}

/**
 * Pushes a "layerorder" undo entry for a to-top/to-bottom jump, unless
 * moveLayerExtreme() reports it was a no-op. Stores the whole before/after
 * stack (not just an id+dir like the single-step version) since jumping to
 * an extreme isn't its own inverse the way an adjacent swap is.
 * @param id the element's data-edit-id or data-resize-id
 * @param toTop true for "to top", false for "to bottom", same as moveLayerExtreme()
 */
function pushLayerExtremeUndo(id, toTop) {
  var before = LAYER_ORDER.slice();
  if (!moveLayerExtreme(id, toTop)) return;
  EDIT_UNDO.push({ type: "layerorder", before: before, after: LAYER_ORDER.slice() });
  EDIT_REDO.length = 0;
}

/**
 * Persists the whole stacking order into the preview snapshot, the same
 * localStorage draft every other override here uses. Rewritten wholesale
 * (not merged), same as saveCustomElements(), since the in-memory
 * LAYER_ORDER is always the full, current stack.
 * @param order LAYER_ORDER
 */
function saveLayerOrder(order) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.layers = order;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/* undo/redo for every visual editor action, a plain stack of commits: see
   applyHistoryAction()'s doc comment for the full list of entry shapes
   (text, delete, add, move, resize, fontsize, align, letterspacing,
   fontfamily, layer, layerorder, fixed, color, opacity, locked). a
   duplicate reuses the "add" entry shape, see duplicateElement(). a fresh
   edit clears the redo stack, same convention as any text editor. */
var EDIT_UNDO = [];
var EDIT_REDO = [];

/**
 * Takes el out of normal document flow so its real width/height can change
 * without ever touching anything else on the page: an absolutely
 * positioned box is excluded from its containing block's own fit-content
 * size calculation by definition, so however big el gets, no sibling or
 * parent ever shifts because of it (no attachment between elements). Only
 * done lazily, on the first actual resize (or a saved size on load); an
 * untouched element stays exactly as the template laid it out.
 * Wraps el in a plain <span class="free-wrap"> (skipped if already
 * wrapped) frozen to el's pre-detach layout size, so el's old flow slot
 * doesn't collapse or get filled by a sibling the instant el leaves it.
 * The wrap's display is matched to el's natural one (block stays block,
 * inline becomes inline-block): forcing inline-block on everything would
 * pull block siblings (a heading and its paragraph) onto one line. Sizes
 * come from offsetWidth/offsetHeight (layout px) rather than the rect so
 * an element with a stylesheet transform of its own (the scaled brand
 * logo) doesn't get its visual size baked in as its layout size; svg has
 * no offsetWidth, so icons fall back to the rect, which is fine since
 * none of them are scaled by the stylesheet.
 * @param el the element to detach from flow
 * @return el's wrap
 */
function detachFromFlow(el, knownRect) {
  var wrap = el.parentNode;
  if (wrap && wrap.classList && wrap.classList.contains("free-wrap")) return wrap;

  /* el's exact pre-detach viewport position, so any drift introduced by
     the wrap/reparent below (see the correction at the bottom of this
     function) can be measured and cancelled out. Accepts an already-
     measured rect (knownRect) instead of measuring fresh here: a grouped
     move detaches several siblings in one gesture, and an EARLIER sibling
     leaving flow (becoming position:absolute) can itself reflow a LATER
     one still waiting its turn (eg two spans sharing one <h1> line box),
     so measuring fresh here for the second element would capture its
     position AFTER the first one's departure already nudged it, not its
     true pre-drag spot. Callers that detach a whole group up front (see
     startMoveDrag()) grab every member's rect in one synchronous pass
     before detaching any of them, and pass those in here instead. */
  var preRect = knownRect || el.getBoundingClientRect();

  /* getBoundingClientRect keeps sub-pixel precision; offsetWidth/Height
     round to a whole css px, which is fine for a transformed element (its
     visual, scaled size shouldn't become its layout size) but for
     anything else that rounding is enough to nudge a child's text across
     its own wrap threshold and reflow it, moving stuff that's supposed to
     be immune (see freezeDescendants()) */
  var xf = getComputedStyle(el).transform;
  var w, h;
  if (xf && xf !== "none") {
    w = el.offsetWidth !== undefined ? el.offsetWidth : el.getBoundingClientRect().width;
    h = el.offsetHeight !== undefined ? el.offsetHeight : el.getBoundingClientRect().height;
  } else {
    var rect = el.getBoundingClientRect();
    w = rect.width; h = rect.height;
  }
  var naturalDisplay = getComputedStyle(el).display;
  /* el's own margin becomes the gap flow siblings expect around its old
     slot; moved onto the wrap below so zeroing it on el (needed so its
     absolute box isn't shoved off (0,0) inside the wrap) doesn't collapse
     that spacing and pull the next sibling up into it */
  var cs = getComputedStyle(el);
  var mTop = cs.marginTop, mRight = cs.marginRight, mBottom = cs.marginBottom, mLeft = cs.marginLeft;

  wrap = document.createElement("span");
  wrap.className = "free-wrap";
  wrap.style.display = naturalDisplay === "inline" ? "inline-block" : "block";
  wrap.style.width = w + "px";
  wrap.style.height = h + "px";
  wrap.style.margin = mTop + " " + mRight + " " + mBottom + " " + mLeft;
  /* an inline-block whose only child is position:absolute has no in-flow
     content of its own, so its default baseline (vertical-align: baseline)
     falls back to its OWN bottom margin edge instead of wherever the
     original text's baseline actually was. That drags the whole box above
     the line's baseline as pure ascent, inflating the line box (and the
     containing block's height along with it, eg. the hero title <h1>),
     which can shift unrelated siblings sharing that container (eg the
     eyebrow text above it, recentered by the hero's own flex layout) even
     though nothing about them changed. Aligning to the line's top instead
     removes the wrap from that baseline calculation entirely, so detaching
     one inline span can't inflate the shared line/container it sits in. */
  if (naturalDisplay === "inline") wrap.style.verticalAlign = "top";
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);

  el.dataset.natW = w;
  el.dataset.natH = h;
  el.style.position = "absolute";
  el.style.top = "0";
  el.style.left = "0";
  el.style.margin = "0";
  /* the site's global `img { max-width: 100% }` reset (and any other
     max-width a card/section/etc happens to carry) would otherwise cap el
     at its old column's width no matter what size is set later */
  el.style.maxWidth = "none";
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.transition = "none";
  /* object-fit stays whatever the stylesheet authored (eg. cover, to crop a
     differently-shaped photo into a fixed box): detaching alone must look
     pixel-identical to flow, since a plain move calls this too and never
     changes the box size. Switching to "fill" (so the box freely dictates
     the image's shape) only happens once an actual resize drag starts, see
     startResizeDrag() and applySizeOverrides() below, never here. */

  /* if el holds any independently-tracked descendants (eg the hero section
     around its own eyebrow/title/buttons), those get counter-translated by
     paintPos()/ancestorPos() to stay visually put while el itself moves,
     exactly the "no attachment between elements" rule this whole system is
     built on. But that only works if el can't clip them: an "overflow:
     hidden/clip" ancestor (eg .hero's own clip, meant for its background
     video) crops anything outside its OWN box regardless of how a child got
     there, so as el moved further from its start point its "staying put"
     children would fall outside el's new box and vanish. Forcing visible
     here (inline, only once el is actually detached, never touching the
     stylesheet) is scoped to exactly the containers that need it: nothing
     tracked inside means nothing can ever escape el's box in the first
     place, so an untouched or childless element keeps its authored clip. */
  if (el.querySelectorAll(RESIZABLE_SEL).length > 0) {
    if (cs.overflowX === "hidden" || cs.overflowX === "clip") el.style.overflowX = "visible";
    if (cs.overflowY === "hidden" || cs.overflowY === "clip") el.style.overflowY = "visible";
  }

  /* a naturally-inline element (this h1's own title/accent spans, say)
     unconditionally blockifies the instant position:absolute lands on it
     (a plain css rule, not a bug), which can render its text a few px off
     from the tight inline rect measured above (the line's own line-height
     leading applies around the text as a block that never applied to it
     as raw inline content, and that leading itself shifts depending on
     what ELSE is still sharing its old line box, eg a sibling span that
     already left flow earlier, so the drift isn't even a fixed constant
     for a given element). Rather than reason about which of those css
     mechanics applies to a given el, just measure the actual result and
     cancel out whatever it drifted by, so detaching is pixel-seamless
     unconditionally, exactly as this function has always promised. */
  var postRect = el.getBoundingClientRect();
  var driftX = postRect.left - preRect.left, driftY = postRect.top - preRect.top;
  if (driftX || driftY) {
    el.style.left = (-driftX) + "px";
    el.style.top = (-driftY) + "px";
  }
  return wrap;
}

/* the visual editor's one selection ring: a floating frame that follows
   whichever tracked element was last clicked, carrying 8 resize handles
   (all four corners + all four edges, so any direction works) and one
   move handle. one shared ring instead of per-element grips, so a
   hundred-odd tagged elements never show overlapping handles at once and
   nested elements (an icon in a card in a section) stay individually
   grabbable. Selection is click-based and sticky: it stays on whatever was
   clicked regardless of where the mouse moves afterward (so an element
   just dragged behind another stays selected and can still be grabbed by
   its own move handle, which floats above everything), and only changes
   when a different tracked element is clicked or empty space clears it. */
var RING = null;
var RING_EL = null;
var RING_DRAGGING = false;
/* the ring's one layer-order button, so the popover can anchor under it */
var LAYER_BTN = null;
/* the ring's one style (color/opacity) button, so the popover can anchor under it */
var STYLE_BTN = null;

/* handle name -> [x edge, y edge] it drags: -1 left/top, 1 right/bottom */
var RING_DIRS = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
  se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0]
};

/**
 * Builds the ring and its handles once, appended to body: 8 resize handles,
 * a move handle, a delete handle, and one layer-order handle that opens a
 * popover (bring forward/send backward/to front/to back, see
 * toggleLayerMenu()).
 */
function buildRing() {
  RING = document.createElement("div");
  RING.className = "sel-ring";
  RING.style.display = "none";
  Object.keys(RING_DIRS).forEach(function (dir) {
    var h = document.createElement("span");
    h.className = "rh rh-" + dir;
    h.setAttribute("data-dir", dir);
    h.title = "Drag to resize";
    h.addEventListener("mousedown", startResizeDrag);
    h.addEventListener("dblclick", resetSizeDbl);
    RING.appendChild(h);
  });
  var mv = document.createElement("span");
  mv.className = "mvh";
  mv.title = "Drag to move";
  mv.addEventListener("mousedown", startMoveDrag);
  mv.addEventListener("dblclick", resetPosDbl);
  RING.appendChild(mv);

  var del = document.createElement("span");
  del.className = "delh";
  del.title = "Delete element";
  del.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/>' +
    '<path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>';
  /* swallow mousedown so it can't be picked up as a drag by the delegated
     body-drag handler in wireResizable() (RING.contains(e.target) already
     excludes it there, this just stops the caret/selection side effects) */
  del.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  del.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (RING_EL) deleteElement(RING_EL);
  });
  RING.appendChild(del);

  var ly = document.createElement("span");
  ly.className = "lyh";
  ly.title = "Layer order";
  ly.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5-8 4.5-8-4.5 8-4.5z"/>' +
    '<path d="M4 12l8 4.5 8-4.5"/><path d="M4 16.5l8 4.5 8-4.5"/></svg>';
  ly.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  ly.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleLayerMenu(ly);
  });
  RING.appendChild(ly);
  LAYER_BTN = ly;

  var st = document.createElement("span");
  st.className = "sth";
  st.title = "Color / opacity";
  st.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 ' +
    '2-2 1.8 1.8 0 0 0-.5-1.2 1.8 1.8 0 0 1 1.3-3 2 2 0 0 0 2-2A9 9 0 0 0 12 3z"/>' +
    '<circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="12" cy="7.5" r="1.1" fill="currentColor" stroke="none"/>' +
    '<circle cx="16.2" cy="10" r="1.1" fill="currentColor" stroke="none"/></svg>';
  st.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  st.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    toggleStyleMenu(st);
  });
  RING.appendChild(st);
  STYLE_BTN = st;

  document.body.appendChild(RING);
}

/* the layer-order popover's own singleton, opened by the ring's one .lyh
   button (see buildRing()): "Bring forward"/"Send backward" (a single
   adjacent-swap step, see moveLayer()) and "Bring to front"/"Send to back"
   (all the way to one end of the stack, see moveLayerExtreme()). the id it
   acts on is captured once at open time so it keeps acting on the same
   element even if the mouse wanders elsewhere while it's open. */
var LAYER_MENU = null;
var LAYER_MENU_ID = null;

/** Builds the layer-order popover once, lazily, reusing the ctx-menu's own look. */
function buildLayerMenu() {
  LAYER_MENU = document.createElement("div");
  LAYER_MENU.className = "ctx-menu layer-menu";
  LAYER_MENU.innerHTML =
    '<button type="button" data-ly="up">Bring forward</button>' +
    '<button type="button" data-ly="down">Send backward</button>' +
    '<button type="button" data-ly="top">Bring to front</button>' +
    '<button type="button" data-ly="bottom">Send to back</button>';
  LAYER_MENU.querySelectorAll("button[data-ly]").forEach(function (btn) {
    /* deliberately does NOT hide the menu after acting, so several steps
       (eg two "bring forward" clicks) don't need reopening it each time */
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!LAYER_MENU_ID) return;
      var kind = btn.getAttribute("data-ly");
      if (kind === "up") pushLayerUndo(LAYER_MENU_ID, 1);
      else if (kind === "down") pushLayerUndo(LAYER_MENU_ID, -1);
      else if (kind === "top") pushLayerExtremeUndo(LAYER_MENU_ID, true);
      else if (kind === "bottom") pushLayerExtremeUndo(LAYER_MENU_ID, false);
    });
  });
  document.body.appendChild(LAYER_MENU);
}

/**
 * Opens the layer-order popover anchored under the ring's layer button (or
 * closes it, if it's already open, so re-clicking the button toggles it).
 * @param anchorEl the ring's .lyh button
 */
function toggleLayerMenu(anchorEl) {
  if (!LAYER_MENU) buildLayerMenu();
  if (LAYER_MENU.classList.contains("show")) { hideLayerMenu(); return; }
  if (!RING_EL) return;
  LAYER_MENU_ID = elId(RING_EL);
  var r = anchorEl.getBoundingClientRect();
  LAYER_MENU.classList.add("show");
  var w = LAYER_MENU.offsetWidth, h = LAYER_MENU.offsetHeight;
  var maxX = window.innerWidth - w - 4, maxY = window.innerHeight + window.scrollY - h - 4;
  var x = r.left + window.scrollX;
  var y = r.bottom + window.scrollY + 4;
  LAYER_MENU.style.left = Math.max(0, Math.min(x, maxX)) + "px";
  LAYER_MENU.style.top = Math.max(0, Math.min(y, maxY)) + "px";
}

/** Closes the layer-order popover, if open. */
function hideLayerMenu() {
  if (LAYER_MENU) LAYER_MENU.classList.remove("show");
  LAYER_MENU_ID = null;
}

/**
 * Whether el is a button-like element that needs its own separate Text
 * color control, distinct from its background: a custom Button element
 * (right-click "Add element" > Button, or the template's own CTA links,
 * a single tagged `<a class="btn">`, its text box IS the button, same rule
 * every other CTA on the site follows), OR a theme toggle (the nav's own
 * `#themeBtn`, or a placed "theme" custom element, both tagged
 * `data-theme-toggle`), a plain `<button>` (not an `<a class="btn">`, so the
 * class check alone misses it) whose own Color row already means its
 * background (see colorTarget()), leaving no other control for its "Light
 * mode"/"Dark mode" label's own color. Its own helper (rather than inlining
 * the check) since both colorTarget() and the style popover's Text color row
 * (see buildStyleMenu()) need the exact same test.
 * @param el the element
 * @return true if el is a button
 */
function isButtonEl(el) {
  return (el.tagName === "A" && el.classList.contains("btn")) || el.id === "themeBtn" || el.hasAttribute("data-theme-toggle");
}

/**
 * Which css property a color override actually lands on, for a given
 * element: an icon (svg, currentColor stroke/fill throughout this
 * codebase's icon set) gets its foreground color; a plain click-to-edit
 * text field gets its font color; everything else (cards, sections, nav,
 * footer, buttons, the countdown box) gets its background color, since
 * that's the only visible surface a resize-id container has. A button's
 * own text color is a separate control, see the Text color bullet in
 * CLAUDE.md / applyTextColorOverrides().
 * @param el the element
 * @return "icon", "text", or "bg"
 */
function colorTarget(el) {
  if (elKind(el) === "icon") return "icon";
  /* a datetime element is text-like (its color paints el.style.color, its
     digits/date text), even though it carries data-resize-id not
     data-edit-id (its content is generated, see buildCustomElement()) */
  if (el.hasAttribute("data-datetime")) return "text";
  if (el.hasAttribute("data-edit-id") && !isButtonEl(el)) return "text";
  return "bg";
}

/**
 * Whether el's opacity has to fade its own background surface instead of
 * using real css opacity: css opacity is a group compositing effect that
 * unconditionally fades an element's WHOLE subtree (the exact same problem
 * setHiddenVisual() already had to solve for delete, see its own doc
 * comment), so a wrapper with independently tracked children inside it (a
 * card, a section, the countdown box) can't use real opacity without
 * dragging those children's own look down with it. Scoped to "bg" targets
 * (colorTarget()) since that covers every container in this project that
 * can have nested tracked content (cards/sections/nav/footer/buttons/the
 * countdown box all paint via backgroundColor); an icon is always a leaf
 * svg (never wraps anything tracked) and a lone click-to-edit text field
 * wrapping other tracked elements doesn't occur in this template, so both
 * keep using plain css opacity, same as an image/video (also always a leaf).
 * @param el the element
 * @return true if opacity should fade backgroundColor instead of el itself
 */
function fadesOwnBackground(el) {
  return colorTarget(el) === "bg" && hasTrackedDescendants(el);
}

/**
 * Converts a "#rrggbb" hex string to an "rgba(r, g, b, a)" string.
 * @param hex a "#rrggbb" string
 * @param alpha 0-1
 * @return the rgba() string, "rgba(0, 0, 0, a)" if hex doesn't parse
 */
function hexToRgba(hex, alpha) {
  var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  var r = m ? parseInt(m[1], 16) : 0, g = m ? parseInt(m[2], 16) : 0, b = m ? parseInt(m[3], 16) : 0;
  return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
}

/**
 * Repaints a fadesOwnBackground() wrapper's real backgroundColor from its
 * last-known color (data-op-color) and opacity (data-op-alpha), kept on the
 * element's own dataset rather than re-derived from the live computed style
 * every time: color and opacity both have to land on this SAME css
 * property, and re-reading an already alpha-blended computed color as the
 * "base" for the next change would compound (each edit fading it further
 * than intended) instead of composing the two independently. data-op-color
 * defaults to whatever the element's pristine background already was
 * (data-base-color, captured once by applyColorOverrides() before either
 * override ever touches it, or the live computed style as a last resort)
 * so an element that's never had an explicit color override still fades
 * its own real surface, not an invented one.
 * @param el the element
 */
function paintSurface(el) {
  var hex = el.dataset.opColor || el.dataset.baseColor || rgbToHex(getComputedStyle(el).backgroundColor) || "#000000";
  var alpha = el.dataset.opAlpha !== undefined ? parseFloat(el.dataset.opAlpha) : 1;
  el.style.opacity = "";
  el.style.backgroundColor = hexToRgba(hex, alpha);
}

/**
 * Paints one element's color override onto whichever css property
 * colorTarget() says it should (icon/text color both use el.style.color,
 * currentColor is how every svg icon in this codebase is drawn). A
 * fadesOwnBackground() wrapper never writes backgroundColor directly here:
 * it stashes the color on the dataset and repaints through paintSurface()
 * instead, so a color change composes with whatever opacity is already
 * active rather than resetting it back to fully opaque.
 * @param el the element
 * @param value a css color string, or "" to clear back to the template default
 */
function setElementColor(el, value) {
  if (fadesOwnBackground(el)) {
    el.dataset.opColor = value || el.dataset.baseColor || "";
    if (!el.dataset.opColor) delete el.dataset.opColor;
    paintSurface(el);
    return;
  }
  if (colorTarget(el) === "bg") el.style.backgroundColor = value;
  else el.style.color = value;
}

/**
 * Applies value (0-1) as el's own opacity without ever touching anything
 * nested inside it, see fadesOwnBackground()'s doc comment for why a plain
 * css opacity can't be used on a wrapper. Used on every load
 * (applyOpacityOverrides()), by the style popover's live slider, and by
 * undo/redo, so all three ways of setting opacity behave identically.
 * @param el the element
 * @param value 0-1
 */
function applyElementOpacity(el, value) {
  if (fadesOwnBackground(el)) {
    el.dataset.opAlpha = String(value);
    paintSurface(el);
  } else {
    el.style.opacity = String(value);
  }
}

/* the light-mode maps most recently passed to applyColorOverrides()/
   applyFillOverrides()/applyTextColorOverrides()/applyBorderOverrides(),
   paired with their dark_* counterparts, kept around purely so
   reapplyThemedColors() can redo the same resolveThemedColor() pass after a
   theme flip without needing a fresh fetch - see js/theme.js's setTheme(),
   which calls it right after updateIcon(). */
var THEMED_OVERRIDE_MAPS = {
  colors: {}, darkColors: {}, fill: {}, darkFill: {},
  textColor: {}, darkTextColor: {}, border: {}, darkBorder: {},
  progressFill: {}, darkProgressFill: {}, progressTrack: {}, darkProgressTrack: {}
};

/**
 * Applies saved color overrides (from the style popover, see
 * buildStyleMenu()) on top of the page's own default colors. Runs on every
 * load, live site included, same as applyTextOverrides(). Images/videos
 * are deliberately skipped: a background color painted behind an
 * object-fit: cover element is never visible, there's nothing for a color
 * picker to usefully do there. Also captures every fadesOwnBackground()
 * wrapper's pristine default background (data-base-color) before anything
 * this load could have touched it, so a later opacity fade (or a reset
 * back to "no color override") always has the real template default to
 * fall back to, see paintSurface().
 * @param colors content.colors, {id: css color string}
 * @param darkColors content.dark_colors, {id: css color string}, the
 *   explicit dark-mode override for whichever ids also have one here (see
 *   resolveThemedColor())
 */
function applyColorOverrides(colors, darkColors) {
  colors = colors || {};
  THEMED_OVERRIDE_MAPS.colors = colors;
  THEMED_OVERRIDE_MAPS.darkColors = darkColors || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    if (fadesOwnBackground(el) && el.dataset.baseColor === undefined) {
      el.dataset.baseColor = rgbToHex(getComputedStyle(el).backgroundColor) || "#000000";
    }
    var id = elId(el);
    var v = colors[id], dv = THEMED_OVERRIDE_MAPS.darkColors[id];
    /* a "progress" element paints its own two colors (see
       applyProgressBindings()), the generic Color row is hidden for it in
       the style popover (toggleStyleMenu()) so content.colors should never
       actually carry an entry for one, but skip it here too for safety -
       painting a stray background on the outer track div would visually
       clash with its own resolved track color */
    if ((!v && !dv) || elKind(el) === "img" || el.hasAttribute("data-progress")) return;
    setElementColor(el, resolveThemedColor(v, dv));
  });
}

/**
 * Applies saved opacity overrides (from the style popover's slider) on top
 * of the page's own default (fully opaque). Runs on every load, live site
 * included, same as applyTextOverrides(). Must run after
 * applyColorOverrides() so a fadesOwnBackground() wrapper's data-base-color
 * is already captured.
 * @param opacity content.opacity, {id: number 0-1}
 */
function applyOpacityOverrides(opacity) {
  opacity = opacity || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = opacity[elId(el)];
    if (v === undefined || v === null) return;
    applyElementOpacity(el, v);
  });
}

/**
 * Applies saved textbox background-fill overrides (from the style
 * popover's Fill control) on top of the page's own default (no fill).
 * Runs on every load, live site included, same as applyColorOverrides().
 * @param fill content.fill, {id: css color string}
 * @param darkFill content.dark_fill, {id: css color string}, see
 *   resolveThemedColor()
 */
function applyFillOverrides(fill, darkFill) {
  fill = fill || {};
  THEMED_OVERRIDE_MAPS.fill = fill;
  THEMED_OVERRIDE_MAPS.darkFill = darkFill || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    var v = fill[id], dv = THEMED_OVERRIDE_MAPS.darkFill[id];
    if (!v && !dv) return;
    el.style.backgroundColor = resolveThemedColor(v, dv);
  });
}

/**
 * Applies saved button text-color overrides (the style popover's Text
 * color row, buttons only) on top of the page's own default `.btn` text
 * color. Runs on every load, live site included, same as
 * applyColorOverrides()/applyFillOverrides(). A button's own Color row
 * already controls its background (see colorTarget()), this is the
 * separate control for its label, since css has no single property that's
 * "whichever of background/text makes sense for this element".
 * @param colors content.text_color, {id: css color string}
 * @param darkColors content.dark_text_color, {id: css color string}, see
 *   resolveThemedColor()
 */
function applyTextColorOverrides(colors, darkColors) {
  colors = colors || {};
  THEMED_OVERRIDE_MAPS.textColor = colors;
  THEMED_OVERRIDE_MAPS.darkTextColor = darkColors || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    if (!isButtonEl(el)) return;
    var id = elId(el);
    var v = colors[id], dv = THEMED_OVERRIDE_MAPS.darkTextColor[id];
    if (!v && !dv) return;
    el.style.color = resolveThemedColor(v, dv);
  });
}

/**
 * Paints (or removes) a color tint over an image/video. An object-fit:
 * cover element has no visible background-color of its own to paint over
 * (see colorTarget()'s doc comment on why the plain Color row is hidden for
 * images), so tinting one needs an actual overlay layer instead: a same-
 * size, pointer-events:none ".tint-ov" div in mix-blend-mode "color"
 * (css/style.css), painted right on top of it. Forces el into its own
 * free-wrap first (detachFromFlow(), the same lazy "first special action
 * detaches" rule a resize/move/delete already follows) so the overlay has
 * something position:relative to size itself against.
 * @param el the image/video element
 * @param hex a "#rrggbb" tint color, or "" to remove the tint
 */
function setElementTint(el, hex) {
  var wrap = detachFromFlow(el);
  var ov = wrap.querySelector(".tint-ov");
  if (!hex) {
    if (ov) ov.remove();
    return;
  }
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "tint-ov";
    wrap.appendChild(ov);
  }
  ov.style.backgroundColor = hex;
  /* match el's own current z-index right away (same reasoning as
     applyLayerOrder()'s own copy of this, see its doc comment): without
     this a freshly-picked tint would stay invisible, behind el, until the
     next time applyLayerOrder() happens to run */
  ov.style.zIndex = getComputedStyle(el).zIndex;
}

/**
 * Applies saved image/video tint overrides on top of the page's own default
 * (no tint). Runs on every load, live site included, same as
 * applyColorOverrides(). Only ever touches elKind() === "img" elements
 * (images and videos both); the Tint row is hidden for anything else.
 * @param tint content.tint, {id: css color string}
 */
function applyTintOverrides(tint) {
  tint = tint || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    if (elKind(el) !== "img") return;
    var v = tint[elId(el)];
    if (v) setElementTint(el, v);
  });
}

/**
 * Darkens (or un-darkens) an image/video with a flat black overlay, the same
 * per-element idea as the hero's own .hero-scrim, just resizable/undoable
 * like every other style control here instead of being one fixed global
 * layer. A plain opacity change (see applyElementOpacity()) would dim the
 * whole element uniformly (icon, text, everything alike), which reads as
 * "faded", not "darkened photo"; this instead stacks a same-size, pointer-
 * events:none black ".shade-ov" sibling in the element's own free-wrap (see
 * detachFromFlow(), same lazy-detach rule setElementTint() already follows),
 * so the pixels themselves stay fully opaque and only get visually darker.
 * @param el the image/video element
 * @param alpha 0 (no shade) to 1 (fully black); 0 removes the overlay
 */
function setElementShade(el, alpha) {
  var wrap = detachFromFlow(el);
  var ov = wrap.querySelector(".shade-ov");
  if (!alpha) {
    if (ov) ov.remove();
    return;
  }
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "shade-ov";
    wrap.appendChild(ov);
  }
  ov.style.opacity = String(alpha);
  /* match el's own current z-index right away, same reasoning as
     setElementTint()'s own copy of this: without it a freshly-picked shade
     would stay invisible, behind el, until the next applyLayerOrder() run */
  ov.style.zIndex = getComputedStyle(el).zIndex;
}

/**
 * Applies saved image/video shade overrides on top of the page's own
 * default (none). Runs on every load, live site included, same spot as
 * applyTintOverrides(). Only ever touches elKind() === "img" elements; the
 * Shade row is hidden for anything else.
 * @param shade content.shade, {id: number 0-1}
 */
function applyShadeOverrides(shade) {
  shade = shade || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    if (elKind(el) !== "img") return;
    var v = shade[elId(el)];
    if (v) setElementShade(el, v);
  });
}

/**
 * Applies saved border-radius overrides on top of the page's own default
 * corners. Runs on every load, live site included.
 * @param radius content.radius, {id: px number}
 */
function applyRadiusOverrides(radius) {
  radius = radius || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = radius[elId(el)];
    if (!v) return;
    el.style.borderRadius = v + "px";
  });
}

/**
 * Applies saved border width/color overrides on top of the page's own
 * default (no border, see --border in css/style.css). Runs on every load,
 * live site included.
 * @param border content.border, {id: {w, color}}
 * @param darkBorder content.dark_border, {id: {w, color}} - only its color
 *   is ever used (see resolveThemedColor()), width isn't theme-dependent so
 *   the light side's own w always wins
 */
function applyBorderOverrides(border, darkBorder) {
  border = border || {};
  THEMED_OVERRIDE_MAPS.border = border;
  THEMED_OVERRIDE_MAPS.darkBorder = darkBorder || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = border[elId(el)];
    if (!v || !v.w) return;
    var dv = THEMED_OVERRIDE_MAPS.darkBorder[elId(el)];
    el.style.border = v.w + "px solid " + resolveThemedColor(v.color, dv && dv.color);
  });
}

/**
 * Paints one "progress" element's live fill width (off its two bound
 * variables, VARIABLES/variableNumericValue()) and its two theme-paired
 * colors (THEMED_OVERRIDE_MAPS.progress*). Split out from
 * applyProgressBindings() so a single element can be repainted right away -
 * just after it's placed (finishAddedElement()), after its Current/Total
 * bindings change, or after a fill/track color edit - without re-scanning
 * every progress element on the page for one change.
 * @param el the element (data-progress)
 * @param d its custom-element descriptor ({varCurrent, varTotal, ...})
 */
function paintProgressElement(el, d) {
  var id = elId(el);
  var cur = variableNumericValue(d.varCurrent);
  var tot = variableNumericValue(d.varTotal);
  var pct = tot > 0 ? Math.max(0, Math.min(100, (cur / tot) * 100)) : 0;
  var fillEl = el.querySelector(".progress-el-fill");
  if (fillEl) {
    /* stashed on the fill bar itself (not just computed on demand) so the
       style popover's fill-color hover preview (see buildStyleMenu()) can
       restore the real width after temporarily forcing a visible one,
       without having to re-run this whole calc just to leave preview mode */
    fillEl.dataset.pct = pct;
    fillEl.style.width = pct + "%";
  }
  var trackColor = resolveThemedColor(THEMED_OVERRIDE_MAPS.progressTrack[id], THEMED_OVERRIDE_MAPS.darkProgressTrack[id]);
  if (trackColor) el.style.background = trackColor;
  var fillColor = resolveThemedColor(THEMED_OVERRIDE_MAPS.progressFill[id], THEMED_OVERRIDE_MAPS.darkProgressFill[id]);
  if (fillColor && fillEl) fillEl.style.background = fillColor;
}

/**
 * Applies every placed "progress" element's live state on top of whatever
 * buildCustomElementNode() built it with by default. Runs on every load,
 * live site included, right after renderCustomElements() has (re)built
 * every progress element's DOM and VARIABLES has been refreshed from the
 * same content payload - same "build with defaults, then apply overrides"
 * two-pass shape every other kind/override here follows.
 * @param fill content.progress_fill, {id: css color string}
 * @param darkFill content.dark_progress_fill, {id: css color string}
 * @param track content.progress_track, {id: css color string}
 * @param darkTrack content.dark_progress_track, {id: css color string}
 */
function applyProgressBindings(fill, darkFill, track, darkTrack) {
  THEMED_OVERRIDE_MAPS.progressFill = fill || {};
  THEMED_OVERRIDE_MAPS.darkProgressFill = darkFill || {};
  THEMED_OVERRIDE_MAPS.progressTrack = track || {};
  THEMED_OVERRIDE_MAPS.darkProgressTrack = darkTrack || {};
  document.querySelectorAll("[data-progress]").forEach(function (el) {
    paintProgressElement(el, customElementById(elId(el)) || {});
  });
}

/**
 * Re-resolves every color/fill/text-color/border/progress override already
 * on the page against whichever theme just became active, from the same
 * maps the last applyColorOverrides()/applyFillOverrides()/
 * applyTextColorOverrides()/applyBorderOverrides()/applyProgressBindings()
 * pass cached (THEMED_OVERRIDE_MAPS) - a plain re-run of those five rather
 * than a full page reload, so a mid-session theme toggle repaints every
 * TA-set color immediately. Exposed on window so js/theme.js's setTheme()
 * can call it right after updateIcon() without a circular file dependency
 * (main.js already loads before theme.js on every page, see
 * templates/index.html's script order, but not guaranteed the other way).
 */
function reapplyThemedColors() {
  applyColorOverrides(THEMED_OVERRIDE_MAPS.colors, THEMED_OVERRIDE_MAPS.darkColors);
  applyFillOverrides(THEMED_OVERRIDE_MAPS.fill, THEMED_OVERRIDE_MAPS.darkFill);
  applyTextColorOverrides(THEMED_OVERRIDE_MAPS.textColor, THEMED_OVERRIDE_MAPS.darkTextColor);
  applyBorderOverrides(THEMED_OVERRIDE_MAPS.border, THEMED_OVERRIDE_MAPS.darkBorder);
  applyProgressBindings(THEMED_OVERRIDE_MAPS.progressFill, THEMED_OVERRIDE_MAPS.darkProgressFill,
    THEMED_OVERRIDE_MAPS.progressTrack, THEMED_OVERRIDE_MAPS.darkProgressTrack);
  repaintInlineTextColors();
}
window.reapplyThemedColors = reapplyThemedColors;

/**
 * Repaints every inline foreColor span (see applyThemedForeColor(), the
 * floating text toolbar's ".tt-color" picker) against whichever theme is
 * currently active. Unlike the whole-element overrides above, these spans
 * carry their own light/dark values right on themselves (data-light-color/
 * data-dark-color) rather than in a THEMED_OVERRIDE_MAPS entry, since a
 * single text field's innerHTML can hold any number of independently-colored
 * spans, not just one - the id-keyed map shape the rest of this file uses
 * doesn't fit. Those data attributes ride along in the same innerHTML string
 * applyTextOverrides()/saveEditedField() already read and write, so no
 * separate save path or content.* column is needed for them. Called once
 * after every load (right after applyTextOverrides() sets each field's
 * innerHTML from its saved override, which may have been painted for
 * whichever theme was active at save time) and again here on every theme
 * flip, same as the rest of reapplyThemedColors().
 */
function repaintInlineTextColors() {
  document.querySelectorAll("[data-light-color], [data-dark-color]").forEach(function (span) {
    span.style.color = resolveThemedColor(span.dataset.lightColor || "", span.dataset.darkColor || "");
  });
}

/**
 * Applies the shared drop-shadow (see BOX_SHADOW_VALUE) to every id in the
 * saved list. Runs on every load, live site included.
 * @param shadow content.shadow, a flat array of ids
 */
function applyShadowOverrides(shadow) {
  shadow = shadow || [];
  shadow.forEach(function (id) {
    var el = styleMenuElById(id);
    if (el) el.style.boxShadow = BOX_SHADOW_VALUE;
  });
}

/* the style (color/opacity) popover's own singleton, opened by the ring's
   .sth button. same "captured once at open time, stays open across
   interactions" pattern as the layer menu, since dialing in a color/opacity
   is naturally a multi-step, no-need-to-reopen interaction. */
var STYLE_MENU = null;
var STYLE_MENU_ID = null;
/* the value a color/opacity control held right before its current drag/
   picker session, so releasing it (native "change") can push exactly one
   undo step for the whole gesture instead of one per intermediate "input" */
var STYLE_COLOR_BEFORE = "";
var STYLE_OPACITY_BEFORE = "";
var STYLE_TEXTCOLOR_BEFORE = "";
var STYLE_FILL_BEFORE = "";
var STYLE_TINT_BEFORE = "";
var STYLE_SHADE_BEFORE = 0;
var STYLE_RADIUS_BEFORE = "0";
var STYLE_BORDER_BEFORE = { w: 0, color: "#000000" };
/* same "value right before this popover session's edit" convention as
   STYLE_COLOR_BEFORE etc. above, for each row's "dark mode color" sub-row */
var STYLE_DARKCOLOR_BEFORE = "";
var STYLE_DARKTEXTCOLOR_BEFORE = "";
var STYLE_DARKFILL_BEFORE = "";
var STYLE_DARKBORDER_BEFORE = "";
/* same "value right before this popover session's edit" convention, for the
   "progress" custom element's own Progress color/Bar color rows */
var STYLE_PROGRESSFILL_BEFORE = "";
var STYLE_DARKPROGRESSFILL_BEFORE = "";
var STYLE_PROGRESSTRACK_BEFORE = "";
var STYLE_DARKPROGRESSTRACK_BEFORE = "";
/* a progress element's {varCurrent, varTotal} right before the current
   popover-session edit, same idea as STYLE_DT_BEFORE for datetime */
var STYLE_PROGRESSVAR_BEFORE = null;
/* a datetime element's {target, format, strftime} right before the current
   popover-session edit, so format/pattern/target changes push one undo
   step each against the value they started from (see buildStyleMenu()) */
var STYLE_DT_BEFORE = null;

/* fixed, tasteful drop-shadow value every shadow-enabled box shares, one
   flat on/off toggle rather than a configurable blur/spread picker, same
   "few controls, not a design-tool megabundle" spirit as TEXT_FONTS */
var BOX_SHADOW_VALUE = "0 8px 24px rgba(0, 0, 0, .35)";

/** Builds the style popover once, lazily, reusing the ctx-menu's own look. */
function buildStyleMenu() {
  STYLE_MENU = document.createElement("div");
  STYLE_MENU.className = "ctx-menu style-menu";
  STYLE_MENU.innerHTML =
    '<div class="sm-row sm-color-row">' +
      '<label class="sm-color-label">Color</label>' +
      '<input type="color" class="sm-color">' +
      '<button type="button" class="sm-color-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-color-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-color-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-color-dark-row">' +
      '<label>Dark mode color</label>' +
      '<input type="color" class="sm-color-dark">' +
      '<button type="button" class="sm-color-dark-reset" title="Reset to auto">×</button>' +
    '</div>' +
    '<div class="sm-row sm-textcolor-row">' +
      '<label>Text color</label>' +
      '<input type="color" class="sm-textcolor">' +
      '<button type="button" class="sm-textcolor-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-textcolor-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-textcolor-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-textcolor-dark-row">' +
      '<label>Dark mode text color</label>' +
      '<input type="color" class="sm-textcolor-dark">' +
      '<button type="button" class="sm-textcolor-dark-reset" title="Reset to auto">×</button>' +
    '</div>' +
    '<div class="sm-row sm-theme-row">' +
      '<label>Icon</label>' +
      '<button type="button" class="sm-theme-icon-btn">Change icon</button>' +
    '</div>' +
    '<div class="sm-row sm-fill-row">' +
      '<label>Fill</label>' +
      '<input type="color" class="sm-fill">' +
      '<button type="button" class="sm-fill-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-fill-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-fill-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-fill-dark-row">' +
      '<label>Dark mode fill</label>' +
      '<input type="color" class="sm-fill-dark">' +
      '<button type="button" class="sm-fill-dark-reset" title="Reset to auto">×</button>' +
    '</div>' +
    '<div class="sm-row sm-progress-row sm-progress-current-row">' +
      '<label>Current</label>' +
      '<select class="sm-progress-current"></select>' +
    '</div>' +
    '<div class="sm-row sm-progress-row sm-progress-total-row">' +
      '<label>Total</label>' +
      '<select class="sm-progress-total"></select>' +
    '</div>' +
    '<div class="sm-row sm-progress-row sm-progress-fill-row">' +
      '<label>Progress color</label>' +
      '<input type="color" class="sm-progress-fill">' +
      '<button type="button" class="sm-progress-fill-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-progress-row sm-progress-fill-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-progress-fill-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-progress-row sm-progress-fill-dark-row">' +
      '<label>Dark mode progress color</label>' +
      '<input type="color" class="sm-progress-fill-dark">' +
      '<button type="button" class="sm-progress-fill-dark-reset" title="Reset to auto">×</button>' +
    '</div>' +
    '<div class="sm-row sm-progress-row sm-progress-track-row">' +
      '<label>Bar color</label>' +
      '<input type="color" class="sm-progress-track">' +
      '<button type="button" class="sm-progress-track-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-progress-row sm-progress-track-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-progress-track-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-progress-row sm-progress-track-dark-row">' +
      '<label>Dark mode bar color</label>' +
      '<input type="color" class="sm-progress-track-dark">' +
      '<button type="button" class="sm-progress-track-dark-reset" title="Reset to auto">×</button>' +
    '</div>' +
    '<div class="sm-row sm-tint-row">' +
      '<label>Tint</label>' +
      '<input type="color" class="sm-tint">' +
      '<button type="button" class="sm-tint-reset" title="Remove tint">×</button>' +
    '</div>' +
    '<div class="sm-row sm-shade-row">' +
      '<label>Shade</label>' +
      '<input type="range" class="sm-shade" min="0" max="100" step="1">' +
      '<span class="sm-shade-val">0%</span>' +
    '</div>' +
    '<div class="sm-row sm-shape-row sm-radius-row">' +
      '<label>Radius</label>' +
      '<input type="range" class="sm-radius" min="0" max="60" step="1">' +
      '<span class="sm-radius-val">0px</span>' +
    '</div>' +
    '<div class="sm-row sm-shape-row sm-border-row">' +
      '<label>Border</label>' +
      '<input type="range" class="sm-border-w" min="0" max="10" step="1">' +
      '<span class="sm-border-val">0px</span>' +
      '<input type="color" class="sm-border-color">' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-shape-row sm-border-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-border-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-shape-row sm-border-dark-row">' +
      '<label>Dark mode border</label>' +
      '<input type="color" class="sm-border-color-dark">' +
      '<button type="button" class="sm-border-dark-reset" title="Reset to auto">×</button>' +
    '</div>' +
    '<div class="sm-row sm-shape-row sm-shadow-row">' +
      '<label>Shadow</label>' +
      '<input type="checkbox" class="sm-shadow">' +
    '</div>' +
    '<div class="sm-row sm-dt-row sm-dt-font-row">' +
      '<label>Font</label>' +
      '<select class="sm-dt-font">' +
        TEXT_FONTS.map(function (f) { return '<option value="' + f.value + '">' + f.label + '</option>'; }).join("") +
      '</select>' +
    '</div>' +
    '<div class="sm-row sm-dt-row sm-dt-size-row">' +
      '<label>Size</label>' +
      '<button type="button" class="sm-dt-fs-dn">A-</button>' +
      '<button type="button" class="sm-dt-fs-up">A+</button>' +
    '</div>' +
    '<div class="sm-row sm-dt-row sm-dt-align-row">' +
      '<label>Align</label>' +
      '<button type="button" class="sm-dt-align" data-align="left" title="Align left">' + ALIGN_ICONS.left + '</button>' +
      '<button type="button" class="sm-dt-align" data-align="center" title="Align center">' + ALIGN_ICONS.center + '</button>' +
      '<button type="button" class="sm-dt-align" data-align="right" title="Align right">' + ALIGN_ICONS.right + '</button>' +
    '</div>' +
    '<div class="sm-row sm-dt-row sm-dt-format-row">' +
      '<label>Format</label>' +
      '<select class="sm-dt-format">' +
        '<option value="countdown">Countdown</option>' +
        '<option value="datetime">Date &amp; time</option>' +
        '<option value="date">Date only</option>' +
        '<option value="time">Time only</option>' +
      '</select>' +
    '</div>' +
    '<div class="sm-row sm-dt-row sm-dt-pattern-row">' +
      '<label>Format string</label>' +
      '<input type="text" class="sm-dt-pattern" placeholder="strftime, blank = default">' +
    '</div>' +
    '<div class="sm-row sm-dt-row sm-dt-target-row">' +
      '<label>Target</label>' +
      '<input type="datetime-local" class="sm-dt-target">' +
    '</div>' +
    '<div class="sm-row">' +
      '<label>Opacity</label>' +
      '<input type="range" class="sm-opacity" min="10" max="100" step="1">' +
      '<span class="sm-opacity-val">100%</span>' +
    '</div>';
  document.body.appendChild(STYLE_MENU);

  /* covers every color/radius/border/shadow/opacity/fill control below in
     one place, rather than hooking mirrorTiledRoleStyle() into each row's
     own handler individually: fires after the row's own handler already
     repainted styleMenuElById(STYLE_MENU_ID) (bubbles up from the control),
     so the mirror always sees the freshly-committed style. A no-op for
     every element outside a tiled area (see mirrorTiledRoleStyle()). */
  ["input", "change", "click"].forEach(function (evt) {
    STYLE_MENU.addEventListener(evt, function () {
      var el = STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID);
      if (el) mirrorTiledRoleStyle(el);
    });
  });

  var colorInput = STYLE_MENU.querySelector(".sm-color");
  var colorReset = STYLE_MENU.querySelector(".sm-color-reset");
  var colorDarkToggle = STYLE_MENU.querySelector(".sm-color-dark-toggle");
  var colorDarkInput = STYLE_MENU.querySelector(".sm-color-dark");
  var colorDarkReset = STYLE_MENU.querySelector(".sm-color-dark-reset");
  var textColorInput = STYLE_MENU.querySelector(".sm-textcolor");
  var textColorReset = STYLE_MENU.querySelector(".sm-textcolor-reset");
  var textColorDarkToggle = STYLE_MENU.querySelector(".sm-textcolor-dark-toggle");
  var textColorDarkInput = STYLE_MENU.querySelector(".sm-textcolor-dark");
  var textColorDarkReset = STYLE_MENU.querySelector(".sm-textcolor-dark-reset");
  var fillInput = STYLE_MENU.querySelector(".sm-fill");
  var fillReset = STYLE_MENU.querySelector(".sm-fill-reset");
  var fillDarkToggle = STYLE_MENU.querySelector(".sm-fill-dark-toggle");
  var fillDarkInput = STYLE_MENU.querySelector(".sm-fill-dark");
  var fillDarkReset = STYLE_MENU.querySelector(".sm-fill-dark-reset");
  var progressCurrent = STYLE_MENU.querySelector(".sm-progress-current");
  var progressTotal = STYLE_MENU.querySelector(".sm-progress-total");
  var progressFillInput = STYLE_MENU.querySelector(".sm-progress-fill");
  var progressFillReset = STYLE_MENU.querySelector(".sm-progress-fill-reset");
  var progressFillDarkToggle = STYLE_MENU.querySelector(".sm-progress-fill-dark-toggle");
  var progressFillDarkInput = STYLE_MENU.querySelector(".sm-progress-fill-dark");
  var progressFillDarkReset = STYLE_MENU.querySelector(".sm-progress-fill-dark-reset");
  var progressTrackInput = STYLE_MENU.querySelector(".sm-progress-track");
  var progressTrackReset = STYLE_MENU.querySelector(".sm-progress-track-reset");
  var progressTrackDarkToggle = STYLE_MENU.querySelector(".sm-progress-track-dark-toggle");
  var progressTrackDarkInput = STYLE_MENU.querySelector(".sm-progress-track-dark");
  var progressTrackDarkReset = STYLE_MENU.querySelector(".sm-progress-track-dark-reset");
  var tintInput = STYLE_MENU.querySelector(".sm-tint");
  var tintReset = STYLE_MENU.querySelector(".sm-tint-reset");
  var shadeInput = STYLE_MENU.querySelector(".sm-shade");
  var shadeVal = STYLE_MENU.querySelector(".sm-shade-val");
  var radiusInput = STYLE_MENU.querySelector(".sm-radius");
  var radiusVal = STYLE_MENU.querySelector(".sm-radius-val");
  var borderW = STYLE_MENU.querySelector(".sm-border-w");
  var borderVal = STYLE_MENU.querySelector(".sm-border-val");
  var borderColor = STYLE_MENU.querySelector(".sm-border-color");
  var borderDarkToggle = STYLE_MENU.querySelector(".sm-border-dark-toggle");
  var borderColorDark = STYLE_MENU.querySelector(".sm-border-color-dark");
  var borderDarkReset = STYLE_MENU.querySelector(".sm-border-dark-reset");
  var shadowInput = STYLE_MENU.querySelector(".sm-shadow");
  var opacityInput = STYLE_MENU.querySelector(".sm-opacity");
  var opacityVal = STYLE_MENU.querySelector(".sm-opacity-val");
  var dtFont = STYLE_MENU.querySelector(".sm-dt-font");
  var dtFormat = STYLE_MENU.querySelector(".sm-dt-format");
  var dtPattern = STYLE_MENU.querySelector(".sm-dt-pattern");
  var dtTarget = STYLE_MENU.querySelector(".sm-dt-target");

  var themeIconBtn = STYLE_MENU.querySelector(".sm-theme-icon-btn");

  [colorInput, colorReset, colorDarkToggle, colorDarkInput, colorDarkReset,
   textColorInput, textColorReset, textColorDarkToggle, textColorDarkInput, textColorDarkReset,
   fillInput, fillReset, fillDarkToggle, fillDarkInput, fillDarkReset,
   progressCurrent, progressTotal,
   progressFillInput, progressFillReset, progressFillDarkToggle, progressFillDarkInput, progressFillDarkReset,
   progressTrackInput, progressTrackReset, progressTrackDarkToggle, progressTrackDarkInput, progressTrackDarkReset,
   tintInput, tintReset, shadeInput, radiusInput, borderW, borderColor,
   borderDarkToggle, borderColorDark, borderDarkReset,
   shadowInput, opacityInput, dtFont, dtFormat, dtPattern, dtTarget, themeIconBtn].forEach(function (el) {
    el.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  });

  /**
   * Wires one Color/Text color/Fill/Border row's "🌙"/"☀️" toggle: click
   * shows (or hides) whichever of the row's two swatches - light ("Color")
   * or dark ("Dark mode color") - ISN'T the one currently shown by default.
   * The one shown by default always matches the theme actually rendering
   * right now (see primeThemedColorRow(), which sets the icon and default
   * visibility every time the popover opens or the site theme flips while
   * it's open): in light mode the light row is already visible and this
   * reveals the dark one; in dark mode it's the other way around. Purely a
   * visibility toggle either way - the value underneath is set/cleared by
   * each row's own input/reset, wired separately below.
   * @param toggleBtn the row's own "🌙"/"☀️" button
   * @param lightRow the "sm-color-row"-style div (always saves to the light map)
   * @param darkRow the "sm-dark-row" div (always saves to the dark map)
   */
  function wireDarkToggle(toggleBtn, lightRow, darkRow) {
    toggleBtn.addEventListener("click", function () {
      var secondary = isDarkThemeActive() ? lightRow : darkRow;
      secondary.style.display = secondary.style.display === "none" ? "" : "none";
    });
  }
  wireDarkToggle(colorDarkToggle, STYLE_MENU.querySelector(".sm-color-row"), STYLE_MENU.querySelector(".sm-color-dark-row"));
  wireDarkToggle(textColorDarkToggle, STYLE_MENU.querySelector(".sm-textcolor-row"), STYLE_MENU.querySelector(".sm-textcolor-dark-row"));
  wireDarkToggle(fillDarkToggle, STYLE_MENU.querySelector(".sm-fill-row"), STYLE_MENU.querySelector(".sm-fill-dark-row"));
  wireDarkToggle(progressFillDarkToggle, STYLE_MENU.querySelector(".sm-progress-fill-row"), STYLE_MENU.querySelector(".sm-progress-fill-dark-row"));
  wireDarkToggle(progressTrackDarkToggle, STYLE_MENU.querySelector(".sm-progress-track-row"), STYLE_MENU.querySelector(".sm-progress-track-dark-row"));
  wireDarkToggle(borderDarkToggle, STYLE_MENU.querySelector(".sm-border-color"), STYLE_MENU.querySelector(".sm-border-dark-row"));

  /**
   * Previews the progress bar's fill at a visible, non-zero width while a ta
   * is choosing its color - at 0% (or a low %) the color swatch's own
   * choice is otherwise invisible on the actual bar, exactly the gap the
   * "let a ta see the fill color in action" ask calls out. Purely a visual
   * preview: the real width (stashed on the fill bar's own dataset by
   * paintProgressElement()) is restored on mouseleave, no data changes.
   * @param input the row's own <input type=color> (light or dark side)
   */
  function wireProgressFillHoverPreview(input) {
    input.addEventListener("mouseenter", function () {
      var el = STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID);
      var fillEl = el && el.querySelector(".progress-el-fill");
      if (fillEl) fillEl.style.width = "60%";
    });
    input.addEventListener("mouseleave", function () {
      var el = STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID);
      var fillEl = el && el.querySelector(".progress-el-fill");
      if (fillEl) fillEl.style.width = (fillEl.dataset.pct || 0) + "%";
    });
  }
  wireProgressFillHoverPreview(progressFillInput);
  wireProgressFillHoverPreview(progressFillDarkInput);
  STYLE_MENU.querySelectorAll(".sm-dt-fs-dn, .sm-dt-fs-up, .sm-dt-align").forEach(function (btn) {
    btn.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  });

  themeIconBtn.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var id = STYLE_MENU_ID;
    hideStyleMenu();
    openThemeIconPicker(id);
  });

  colorInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.colors[STYLE_MENU_ID] = colorInput.value;
    setElementColor(el, resolveThemedColor(colorInput.value, THEMED_OVERRIDE_MAPS.darkColors[STYLE_MENU_ID]));
    saveEditedColor(STYLE_MENU_ID, colorInput.value);
  });
  colorInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = colorInput.value;
    if (after !== STYLE_COLOR_BEFORE) {
      EDIT_UNDO.push({ type: "color", id: STYLE_MENU_ID, before: STYLE_COLOR_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_COLOR_BEFORE = after;
  });

  colorReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_COLOR_BEFORE;
    THEMED_OVERRIDE_MAPS.colors[STYLE_MENU_ID] = "";
    /* resolve rather than blank outright - if dark mode is what's actually
       on screen right now, clearing the LIGHT override must not blow away
       the still-in-effect dark color/auto-variant that's currently
       painted, see primeThemedColorRow()'s doc comment */
    setElementColor(el, resolveThemedColor("", THEMED_OVERRIDE_MAPS.darkColors[STYLE_MENU_ID]));
    saveEditedColor(STYLE_MENU_ID, "");
    var after = currentColorValue(el);
    colorInput.value = isDarkThemeActive() ? autoDarkVariant(after) : after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "color", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_COLOR_BEFORE = "";
  });

  colorDarkInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.darkColors[STYLE_MENU_ID] = colorDarkInput.value;
    setElementColor(el, resolveThemedColor(colorInput.value, colorDarkInput.value));
    saveEditedDarkColor(STYLE_MENU_ID, colorDarkInput.value);
  });
  colorDarkInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = colorDarkInput.value;
    if (after !== STYLE_DARKCOLOR_BEFORE) {
      EDIT_UNDO.push({ type: "darkcolor", id: STYLE_MENU_ID, before: STYLE_DARKCOLOR_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKCOLOR_BEFORE = after;
  });
  colorDarkReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_DARKCOLOR_BEFORE;
    THEMED_OVERRIDE_MAPS.darkColors[STYLE_MENU_ID] = "";
    saveEditedDarkColor(STYLE_MENU_ID, "");
    setElementColor(el, resolveThemedColor(colorInput.value, ""));
    var after = autoDarkVariant(colorInput.value);
    colorDarkInput.value = after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "darkcolor", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKCOLOR_BEFORE = "";
  });

  textColorInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.textColor[STYLE_MENU_ID] = textColorInput.value;
    el.style.color = resolveThemedColor(textColorInput.value, THEMED_OVERRIDE_MAPS.darkTextColor[STYLE_MENU_ID]);
    saveEditedTextColor(STYLE_MENU_ID, textColorInput.value);
  });
  textColorInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = textColorInput.value;
    if (after !== STYLE_TEXTCOLOR_BEFORE) {
      EDIT_UNDO.push({ type: "textcolor", id: STYLE_MENU_ID, before: STYLE_TEXTCOLOR_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_TEXTCOLOR_BEFORE = after;
  });

  textColorReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_TEXTCOLOR_BEFORE;
    THEMED_OVERRIDE_MAPS.textColor[STYLE_MENU_ID] = "";
    el.style.color = resolveThemedColor("", THEMED_OVERRIDE_MAPS.darkTextColor[STYLE_MENU_ID]);
    saveEditedTextColor(STYLE_MENU_ID, "");
    var after = currentTextColorValue(el);
    textColorInput.value = isDarkThemeActive() ? autoDarkVariant(after) : after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "textcolor", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_TEXTCOLOR_BEFORE = "";
  });

  textColorDarkInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.darkTextColor[STYLE_MENU_ID] = textColorDarkInput.value;
    el.style.color = resolveThemedColor(textColorInput.value, textColorDarkInput.value);
    saveEditedDarkTextColor(STYLE_MENU_ID, textColorDarkInput.value);
  });
  textColorDarkInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = textColorDarkInput.value;
    if (after !== STYLE_DARKTEXTCOLOR_BEFORE) {
      EDIT_UNDO.push({ type: "darktextcolor", id: STYLE_MENU_ID, before: STYLE_DARKTEXTCOLOR_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKTEXTCOLOR_BEFORE = after;
  });
  textColorDarkReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_DARKTEXTCOLOR_BEFORE;
    THEMED_OVERRIDE_MAPS.darkTextColor[STYLE_MENU_ID] = "";
    saveEditedDarkTextColor(STYLE_MENU_ID, "");
    el.style.color = resolveThemedColor(textColorInput.value, "");
    var after = autoDarkVariant(textColorInput.value);
    textColorDarkInput.value = after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "darktextcolor", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKTEXTCOLOR_BEFORE = "";
  });

  fillInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.fill[STYLE_MENU_ID] = fillInput.value;
    el.style.backgroundColor = resolveThemedColor(fillInput.value, THEMED_OVERRIDE_MAPS.darkFill[STYLE_MENU_ID]);
    saveEditedFill(STYLE_MENU_ID, fillInput.value);
  });
  fillInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = fillInput.value;
    if (after !== STYLE_FILL_BEFORE) {
      EDIT_UNDO.push({ type: "fill", id: STYLE_MENU_ID, before: STYLE_FILL_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_FILL_BEFORE = after;
  });

  fillReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_FILL_BEFORE;
    THEMED_OVERRIDE_MAPS.fill[STYLE_MENU_ID] = "";
    el.style.backgroundColor = resolveThemedColor("", THEMED_OVERRIDE_MAPS.darkFill[STYLE_MENU_ID]);
    saveEditedFill(STYLE_MENU_ID, "");
    var after = currentFillValue(el);
    fillInput.value = isDarkThemeActive() ? autoDarkVariant(after) : after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "fill", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_FILL_BEFORE = "";
  });

  fillDarkInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.darkFill[STYLE_MENU_ID] = fillDarkInput.value;
    el.style.backgroundColor = resolveThemedColor(fillInput.value, fillDarkInput.value);
    saveEditedDarkFill(STYLE_MENU_ID, fillDarkInput.value);
  });
  fillDarkInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = fillDarkInput.value;
    if (after !== STYLE_DARKFILL_BEFORE) {
      EDIT_UNDO.push({ type: "darkfill", id: STYLE_MENU_ID, before: STYLE_DARKFILL_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKFILL_BEFORE = after;
  });
  fillDarkReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_DARKFILL_BEFORE;
    THEMED_OVERRIDE_MAPS.darkFill[STYLE_MENU_ID] = "";
    saveEditedDarkFill(STYLE_MENU_ID, "");
    el.style.backgroundColor = resolveThemedColor(fillInput.value, "");
    var after = autoDarkVariant(fillInput.value);
    fillDarkInput.value = after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "darkfill", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKFILL_BEFORE = "";
  });

  /**
   * Commits a Current/Total variable-select change: updates the element's
   * own descriptor (varCurrent/varTotal live on it directly, like a
   * datetime element's target/format - see addCustomElement()), repersists
   * CUSTOM_ELEMENTS, and repaints just this element's fill ratio.
   * @param selectEl the "sm-progress-current"/"sm-progress-total" <select>
   * @param field "varCurrent" or "varTotal"
   */
  function wireProgressVarSelect(selectEl, field) {
    selectEl.addEventListener("change", function () {
      if (!STYLE_MENU_ID) return;
      var d = customElementById(STYLE_MENU_ID);
      var el = styleMenuEl();
      if (!d || !el) return;
      var before = { varCurrent: d.varCurrent, varTotal: d.varTotal };
      d[field] = selectEl.value;
      saveCustomElements(CUSTOM_ELEMENTS);
      paintProgressElement(el, d);
      var after = { varCurrent: d.varCurrent, varTotal: d.varTotal };
      if (before[field] !== after[field]) {
        EDIT_UNDO.push({ type: "progressvar", id: STYLE_MENU_ID, before: before, after: after });
        EDIT_REDO.length = 0;
      }
      STYLE_PROGRESSVAR_BEFORE = after;
    });
  }
  wireProgressVarSelect(progressCurrent, "varCurrent");
  wireProgressVarSelect(progressTotal, "varTotal");

  /**
   * Wires one "progress" themed color row's input/change/reset for both its
   * light and dark swatches - the fill/darkFill wiring just above's
   * generic twin, factored since progress adds two such rows (fill, track)
   * at once rather than incrementally like fill/border/etc were. Unlike a
   * plain background color there's no single setElementColor()-style
   * setter for a two-color composite element, so every branch repaints via
   * paintProgressElement() instead.
   * @param lightInput/lightReset/darkInput/darkReset the row's four controls
   * @param mapKey/darkMapKey THEMED_OVERRIDE_MAPS.progress* keys for this row
   * @param saveFn/saveDarkFn the row's saveEditedProgress*()/
   *   saveEditedDarkProgress*() persistence functions
   * @param type/darkType EDIT_UNDO "type" strings for this row
   * @param readCurrentFn (el) -> hex, reads the live rendered color back
   *   after a reset (currentProgressFillValue or currentProgressTrackValue)
   * @param getBefore/setBefore/getDarkBefore/setDarkBefore accessors for
   *   this row's pair of STYLE_PROGRESS*_BEFORE/STYLE_DARKPROGRESS*_BEFORE
   *   session-baseline globals
   */
  function wireProgressColorRow(lightInput, lightReset, darkInput, darkReset,
      mapKey, darkMapKey, saveFn, saveDarkFn, type, darkType, readCurrentFn,
      getBefore, setBefore, getDarkBefore, setDarkBefore) {
    lightInput.addEventListener("input", function () {
      if (!STYLE_MENU_ID) return;
      var el = styleMenuEl();
      if (!el) return;
      THEMED_OVERRIDE_MAPS[mapKey][STYLE_MENU_ID] = lightInput.value;
      paintProgressElement(el, customElementById(STYLE_MENU_ID) || {});
      saveFn(STYLE_MENU_ID, lightInput.value);
    });
    lightInput.addEventListener("change", function () {
      if (!STYLE_MENU_ID) return;
      var after = lightInput.value;
      if (after !== getBefore()) {
        EDIT_UNDO.push({ type: type, id: STYLE_MENU_ID, before: getBefore(), after: after });
        EDIT_REDO.length = 0;
      }
      setBefore(after);
    });
    lightReset.addEventListener("click", function () {
      if (!STYLE_MENU_ID) return;
      var el = styleMenuEl();
      if (!el) return;
      var before = getBefore();
      THEMED_OVERRIDE_MAPS[mapKey][STYLE_MENU_ID] = "";
      saveFn(STYLE_MENU_ID, "");
      paintProgressElement(el, customElementById(STYLE_MENU_ID) || {});
      var after = readCurrentFn(el);
      lightInput.value = isDarkThemeActive() ? autoDarkVariant(after) : after;
      if (before !== "") {
        EDIT_UNDO.push({ type: type, id: STYLE_MENU_ID, before: before, after: "" });
        EDIT_REDO.length = 0;
      }
      setBefore("");
    });

    darkInput.addEventListener("input", function () {
      if (!STYLE_MENU_ID) return;
      var el = styleMenuEl();
      if (!el) return;
      THEMED_OVERRIDE_MAPS[darkMapKey][STYLE_MENU_ID] = darkInput.value;
      paintProgressElement(el, customElementById(STYLE_MENU_ID) || {});
      saveDarkFn(STYLE_MENU_ID, darkInput.value);
    });
    darkInput.addEventListener("change", function () {
      if (!STYLE_MENU_ID) return;
      var after = darkInput.value;
      if (after !== getDarkBefore()) {
        EDIT_UNDO.push({ type: darkType, id: STYLE_MENU_ID, before: getDarkBefore(), after: after });
        EDIT_REDO.length = 0;
      }
      setDarkBefore(after);
    });
    darkReset.addEventListener("click", function () {
      if (!STYLE_MENU_ID) return;
      var el = styleMenuEl();
      if (!el) return;
      var before = getDarkBefore();
      THEMED_OVERRIDE_MAPS[darkMapKey][STYLE_MENU_ID] = "";
      saveDarkFn(STYLE_MENU_ID, "");
      paintProgressElement(el, customElementById(STYLE_MENU_ID) || {});
      var after = autoDarkVariant(lightInput.value);
      darkInput.value = after;
      if (before !== "") {
        EDIT_UNDO.push({ type: darkType, id: STYLE_MENU_ID, before: before, after: "" });
        EDIT_REDO.length = 0;
      }
      setDarkBefore("");
    });
  }
  wireProgressColorRow(progressFillInput, progressFillReset, progressFillDarkInput, progressFillDarkReset,
    "progressFill", "darkProgressFill", saveEditedProgressFill, saveEditedDarkProgressFill,
    "progressfill", "darkprogressfill", currentProgressFillValue,
    function () { return STYLE_PROGRESSFILL_BEFORE; }, function (v) { STYLE_PROGRESSFILL_BEFORE = v; },
    function () { return STYLE_DARKPROGRESSFILL_BEFORE; }, function (v) { STYLE_DARKPROGRESSFILL_BEFORE = v; });
  wireProgressColorRow(progressTrackInput, progressTrackReset, progressTrackDarkInput, progressTrackDarkReset,
    "progressTrack", "darkProgressTrack", saveEditedProgressTrack, saveEditedDarkProgressTrack,
    "progresstrack", "darkprogresstrack", currentProgressTrackValue,
    function () { return STYLE_PROGRESSTRACK_BEFORE; }, function (v) { STYLE_PROGRESSTRACK_BEFORE = v; },
    function () { return STYLE_DARKPROGRESSTRACK_BEFORE; }, function (v) { STYLE_DARKPROGRESSTRACK_BEFORE = v; });

  tintInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    setElementTint(el, tintInput.value);
    saveEditedTint(STYLE_MENU_ID, tintInput.value);
  });
  tintInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = tintInput.value;
    if (after !== STYLE_TINT_BEFORE) {
      EDIT_UNDO.push({ type: "tint", id: STYLE_MENU_ID, before: STYLE_TINT_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_TINT_BEFORE = after;
  });

  tintReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_TINT_BEFORE;
    setElementTint(el, "");
    saveEditedTint(STYLE_MENU_ID, "");
    tintInput.value = "#ffffff";
    if (before !== "") {
      EDIT_UNDO.push({ type: "tint", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_TINT_BEFORE = "";
  });

  shadeInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var v = parseFloat((parseFloat(shadeInput.value) / 100).toFixed(2));
    setElementShade(el, v);
    shadeVal.textContent = shadeInput.value + "%";
    saveEditedShade(STYLE_MENU_ID, v);
  });
  shadeInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = shadeInput.value;
    if (after !== STYLE_SHADE_BEFORE) {
      EDIT_UNDO.push({ type: "shade", id: STYLE_MENU_ID, before: STYLE_SHADE_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_SHADE_BEFORE = after;
  });

  radiusInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var px = parseInt(radiusInput.value, 10);
    el.style.borderRadius = px + "px";
    radiusVal.textContent = px + "px";
    saveEditedRadius(STYLE_MENU_ID, px);
  });
  radiusInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = radiusInput.value;
    if (after !== STYLE_RADIUS_BEFORE) {
      EDIT_UNDO.push({ type: "radius", id: STYLE_MENU_ID, before: parseInt(STYLE_RADIUS_BEFORE, 10), after: parseInt(after, 10) });
      EDIT_REDO.length = 0;
    }
    STYLE_RADIUS_BEFORE = after;
  });

  /**
   * Commits width+color together, given the color to use. Width is always
   * theme-independent (applyBorderOverrides() only ever reads w off the
   * light "border" map), but the color half needs care: when light mode is
   * the secondary/hidden swatch right now, borderColor.value is just an
   * unconfirmed autoDarkVariant() suggestion, not something the TA
   * actually chose - dragging only the width slider must NOT promote that
   * suggestion into a real saved light color. So a width-only drag reuses
   * whatever light color was last confirmed (the cached map entry) instead
   * of reading the possibly-hidden swatch; an actual edit of the light
   * swatch itself always passes its own (deliberately-chosen) value.
   */
  function commitBorder(color) {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var w = parseInt(borderW.value, 10);
    THEMED_OVERRIDE_MAPS.border[STYLE_MENU_ID] = { w: w, color: color };
    if (w > 0) {
      var dv = THEMED_OVERRIDE_MAPS.darkBorder[STYLE_MENU_ID];
      el.style.border = w + "px solid " + resolveThemedColor(color, dv && dv.color);
    } else {
      el.style.border = "none";
    }
    borderVal.textContent = w + "px";
    saveEditedBorder(STYLE_MENU_ID, w, color);
    return color;
  }
  function confirmedLightBorderColor() {
    var cached = THEMED_OVERRIDE_MAPS.border[STYLE_MENU_ID];
    return (cached && cached.color) || borderColor.value;
  }
  borderW.addEventListener("input", function () { commitBorder(confirmedLightBorderColor()); });
  borderColor.addEventListener("input", function () { commitBorder(borderColor.value); });
  borderW.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = { w: parseInt(borderW.value, 10), color: confirmedLightBorderColor() };
    if (after.w !== STYLE_BORDER_BEFORE.w || after.color !== STYLE_BORDER_BEFORE.color) {
      EDIT_UNDO.push({ type: "border", id: STYLE_MENU_ID, before: STYLE_BORDER_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_BORDER_BEFORE = after;
  });
  borderColor.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = { w: parseInt(borderW.value, 10), color: borderColor.value };
    if (after.w !== STYLE_BORDER_BEFORE.w || after.color !== STYLE_BORDER_BEFORE.color) {
      EDIT_UNDO.push({ type: "border", id: STYLE_MENU_ID, before: STYLE_BORDER_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_BORDER_BEFORE = after;
  });

  borderColorDark.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.darkBorder[STYLE_MENU_ID] = { color: borderColorDark.value };
    var w = parseInt(borderW.value, 10);
    if (w > 0) el.style.border = w + "px solid " + resolveThemedColor(borderColor.value, borderColorDark.value);
    saveEditedDarkBorder(STYLE_MENU_ID, borderColorDark.value);
  });
  borderColorDark.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = borderColorDark.value;
    if (after !== STYLE_DARKBORDER_BEFORE) {
      EDIT_UNDO.push({ type: "darkborder", id: STYLE_MENU_ID, before: STYLE_DARKBORDER_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKBORDER_BEFORE = after;
  });
  borderDarkReset.addEventListener("click", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var before = STYLE_DARKBORDER_BEFORE;
    THEMED_OVERRIDE_MAPS.darkBorder[STYLE_MENU_ID] = { color: "" };
    saveEditedDarkBorder(STYLE_MENU_ID, "");
    var w = parseInt(borderW.value, 10);
    if (w > 0) el.style.border = w + "px solid " + resolveThemedColor(borderColor.value, "");
    var after = autoDarkVariant(borderColor.value);
    borderColorDark.value = after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "darkborder", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_DARKBORDER_BEFORE = "";
  });

  shadowInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    el.style.boxShadow = shadowInput.checked ? BOX_SHADOW_VALUE : "none";
    saveEditedShadow(STYLE_MENU_ID, shadowInput.checked);
    EDIT_UNDO.push({ type: "shadow", id: STYLE_MENU_ID });
    EDIT_REDO.length = 0;
  });

  opacityInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var v = parseFloat((parseFloat(opacityInput.value) / 100).toFixed(2));
    applyElementOpacity(el, v);
    opacityVal.textContent = opacityInput.value + "%";
    saveEditedOpacity(STYLE_MENU_ID, v);
  });
  opacityInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = opacityInput.value;
    if (after !== STYLE_OPACITY_BEFORE) {
      EDIT_UNDO.push({ type: "opacity", id: STYLE_MENU_ID, before: STYLE_OPACITY_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_OPACITY_BEFORE = after;
  });

  /* font/size/align act on a datetime element exactly the way they act on a
     text field (same save*() maps, keyed by the element's own id), just
     driven from the popover here instead of the click-to-edit toolbar,
     since a datetime element isn't a click-to-edit field (its text is
     generated). */
  dtFont.addEventListener("change", function () {
    var el = styleMenuEl();
    if (!el) return;
    var before = el.style.fontFamily || "";
    el.style.fontFamily = dtFont.value;
    saveFontFamily(STYLE_MENU_ID, dtFont.value, "");
    EDIT_UNDO.push({ type: "fontfamily", id: STYLE_MENU_ID, before: { family: before, url: "" }, after: { family: dtFont.value, url: "" } });
    EDIT_REDO.length = 0;
  });

  STYLE_MENU.querySelectorAll(".sm-dt-fs-dn, .sm-dt-fs-up").forEach(function (btn) {
    var dir = btn.classList.contains("sm-dt-fs-dn") ? -2 : 2;
    btn.addEventListener("click", function () {
      var el = styleMenuEl();
      if (!el) return;
      var before = el.style.fontSize || "";
      var cur = parseFloat(getComputedStyle(el).fontSize) || 16;
      var after = Math.max(8, Math.min(160, Math.round(cur + dir))) + "px";
      el.style.fontSize = after;
      saveFontSize(STYLE_MENU_ID, after);
      EDIT_UNDO.push({ type: "fontsize", id: STYLE_MENU_ID, before: before, after: after });
      EDIT_REDO.length = 0;
      positionRing();
    });
  });

  STYLE_MENU.querySelectorAll(".sm-dt-align").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var el = styleMenuEl();
      if (!el) return;
      var align = btn.getAttribute("data-align");
      var before = el.style.textAlign || "";
      var next = before === align ? "" : align;
      el.style.textAlign = next;
      saveTextStyle(STYLE_MENU_ID, "align", next);
      EDIT_UNDO.push({ type: "align", id: STYLE_MENU_ID, before: before, after: next });
      EDIT_REDO.length = 0;
      STYLE_MENU.querySelectorAll(".sm-dt-align").forEach(function (b) {
        b.classList.toggle("active", el.style.textAlign === b.getAttribute("data-align"));
      });
    });
  });

  /* applies the popover's current format/pattern/target to the datetime
     element and repaints it, no undo (see commitDatetimeUndo() for that). */
  function applyDatetimeLive() {
    var el = styleMenuEl();
    var d = customElementById(STYLE_MENU_ID);
    if (!el || !d) return;
    d.format = dtFormat.value;
    d.strftime = dtPattern.value;
    if (dtTarget.value) d.target = new Date(dtTarget.value).toISOString();
    dtPattern.placeholder = DT_DEFAULT_PATTERNS[d.format] || "";
    renderDatetimeContent(el, d);
    saveCustomElements(CUSTOM_ELEMENTS);
  }
  /* pushes one undo step for the whole format/pattern/target gesture, from
     whatever the datetime config was when the popover last settled. */
  function commitDatetimeUndo() {
    var d = customElementById(STYLE_MENU_ID);
    if (!d || !STYLE_DT_BEFORE) return;
    var after = { target: d.target, format: d.format, strftime: d.strftime || "" };
    var b = STYLE_DT_BEFORE;
    if (b.target !== after.target || b.format !== after.format || (b.strftime || "") !== after.strftime) {
      EDIT_UNDO.push({ type: "datetime", id: STYLE_MENU_ID, before: b, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_DT_BEFORE = after;
  }
  dtFormat.addEventListener("change", function () { applyDatetimeLive(); commitDatetimeUndo(); });
  dtTarget.addEventListener("change", function () { applyDatetimeLive(); commitDatetimeUndo(); });
  dtPattern.addEventListener("input", applyDatetimeLive);
  dtPattern.addEventListener("change", commitDatetimeUndo);
}

/**
 * The element the style popover is currently acting on, re-queried each
 * time rather than cached, same reasoning as the layer menu's LAYER_MENU_ID.
 * @return the element, or null if it's no longer in the document
 */
function styleMenuEl() {
  return styleMenuElById(STYLE_MENU_ID);
}

/**
 * Looks up any tracked element by its data-edit-id/data-resize-id, same
 * query every override in this file uses to find its target.
 * @param id the element's id
 * @return the element, or null if it's no longer in the document
 */
function styleMenuElById(id) {
  return document.querySelector('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]');
}

/**
 * Reads an element's current color override as a hex string a native
 * <input type=color> can display, "#000000" if none is set (the input
 * itself has no real "unset" state to fall back to).
 * @param el the element
 * @return a "#rrggbb" string
 */
function currentColorValue(el) {
  var cs = getComputedStyle(el);
  var live = colorTarget(el) === "bg" ? cs.backgroundColor : cs.color;
  return rgbToHex(live) || "#000000";
}

/**
 * Parses a computed color string into 0-255 r/g/b and a 0-1 alpha,
 * whichever of the two syntaxes the browser used to serialize it: the
 * usual "rgb(r, g, b)"/"rgba(r, g, b, a)", or "color(srgb r g b / a)"
 * (0-1 floats), which Chromium uses instead when the computed value came
 * from a color-mix() (this project's own --surface tokens are all defined
 * that way, eg the countdown box's "color-mix(in srgb, var(--surface) 75%,
 * transparent)" background) - a plain rgba?() regex alone never matches
 * that second form at all, silently falling back to black everywhere a
 * color-mix()'d surface's current color needed reading back.
 * @param str the computed color string
 * @return {r, g, b, a} (0-255, 0-255, 0-255, 0-1), or null if unparseable
 */
function parseComputedColor(str) {
  var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(str || "");
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  var cm = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/.exec(str || "");
  if (cm) {
    return {
      r: Math.round(parseFloat(cm[1]) * 255), g: Math.round(parseFloat(cm[2]) * 255), b: Math.round(parseFloat(cm[3]) * 255),
      a: cm[4] !== undefined ? parseFloat(cm[4]) : 1
    };
  }
  return null;
}

/**
 * Converts a computed color string (see parseComputedColor()) to a
 * "#rrggbb" hex string an <input type=color> can take as its value.
 * @param rgb the computed color string
 * @return a hex string, or "" if it couldn't be parsed (eg "transparent")
 */
function rgbToHex(rgb) {
  var c = parseComputedColor(rgb);
  if (!c) return "";
  function hex(n) { return ("0" + n.toString(16)).slice(-2); }
  return "#" + hex(c.r) + hex(c.g) + hex(c.b);
}

/**
 * Converts a "#rrggbb" hex string to {h, s, l} (h 0-360, s/l 0-100), the
 * intermediate autoDarkVariant() flips lightness in rather than plain rgb
 * (flipping rgb channels directly would shift hue/saturation too, eg a TA's
 * navy blue would come back a washed-out tan instead of a lighter blue).
 * @param hex a "#rrggbb" string
 * @return {h, s, l}, or null if unparseable
 */
function hexToHsl(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  var r = parseInt(m[1].slice(0, 2), 16) / 255;
  var g = parseInt(m[1].slice(2, 4), 16) / 255;
  var b = parseInt(m[1].slice(4, 6), 16) / 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h = 0, s = 0, l = (max + min) / 2;
  var d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h: h, s: s * 100, l: l * 100 };
}

/**
 * Converts {h, s, l} (see hexToHsl()) back to a "#rrggbb" hex string.
 * @param h 0-360, s/l 0-100
 * @return a "#rrggbb" string
 */
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  function f(n) {
    var k = (n + h / 30) % 12;
    var a = s * Math.min(l, 1 - l);
    var c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255);
  }
  function hex(n) { return ("0" + n.toString(16)).slice(-2); }
  return "#" + hex(f(0)) + hex(f(8)) + hex(f(4));
}

/**
 * Auto-computes a dark-mode variant of a TA-picked light-mode color: same
 * hue/saturation, lightness flipped around the midpoint (l' = 100 - l), the
 * same trick this site's own --text/--bg/--surface css variables already
 * amount to between their [data-theme="light"] and (default) dark palettes.
 * A near-black color a ta picked for a light background becomes near-white
 * for the dark one, same hue, so it never goes invisible in the theme it
 * wasn't designed against. Used as the fallback whenever a TA hasn't picked
 * an explicit dark-mode override (see resolveThemedColor()).
 * @param hex a "#rrggbb" string (or any css color the browser normalized to
 *   one via getComputedStyle - callers here always pass one of those)
 * @return a "#rrggbb" string, or the input unchanged if unparseable (eg a
 *   css var()/color-mix() string that never went through getComputedStyle)
 */
function autoDarkVariant(hex) {
  var c = hexToHsl(hex);
  if (!c) return hex;
  return hslToHex(c.h, c.s, 100 - c.l);
}

/**
 * Whether the page currently being edited/viewed is showing dark mode right
 * now - the live signal every theme-aware color read/write in this file
 * keys off (resolveThemedColor(), the style popover's primary/secondary
 * swatch binding, see primeThemedColorRow()). Reads straight off
 * documentElement rather than caching, since a ta can flip it at any moment
 * by clicking the nav's own toggle (see js/theme.js's setTheme()) - default
 * theme with no [data-theme] set at all would be dark (js/theme.js's
 * currentTheme() convention), but templates/index.html always sets one
 * explicitly, so that fallback is mostly theoretical here.
 * @return true if dark mode is the one currently rendering
 */
function isDarkThemeActive() {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

/**
 * Resolves which of a color-bearing override's two saved values actually
 * applies right now: the TA's explicit value for whichever theme is active
 * if they set one, else the OTHER side's auto-computed variant
 * (autoDarkVariant(), self-inverse so it round-trips either direction) -
 * never the literal other-theme color unmodified, which is the whole bug
 * this exists to fix (a TA-placed element's color used to be identical in
 * both themes). The two values are independent optional overrides, not "a
 * base plus an optional override": either can be set without the other (a
 * ta editing while already in dark mode - the site's own default theme -
 * can set just the dark value, see primeThemedColorRow()), so this has to
 * auto-flip in BOTH directions, not just light-set/dark-missing: a ta who
 * only ever edits in dark mode and never sets a light value would otherwise
 * see every override silently vanish back to the page default the moment
 * light mode renders (eg a first-time visitor whose OS/browser prefers
 * light), instead of the same auto-derived variant the dark side already
 * gets from a light-only value.
 * @param lightVal the saved light-mode value, "" / undefined if unset
 * @param darkVal the saved dark-mode value, "" / undefined if unset
 * @return the css color string to actually paint, "" if neither side is set
 *   (callers already skip painting anything in that case)
 */
function resolveThemedColor(lightVal, darkVal) {
  if (isDarkThemeActive()) {
    if (darkVal) return darkVal;
    if (lightVal) return autoDarkVariant(lightVal);
    return "";
  }
  if (lightVal) return lightVal;
  if (darkVal) return autoDarkVariant(darkVal);
  return "";
}

/**
 * Reads an element's current background fill (a textbox's own surface
 * color, separate from its font color, see colorTarget()) as a hex string,
 * "#ffffff" if it's transparent/unset (an <input type=color> has no real
 * "unset" state of its own).
 * @param el the element
 * @return a "#rrggbb" string
 */
function currentFillValue(el) {
  var c = parseComputedColor(getComputedStyle(el).backgroundColor);
  if (!c || c.a === 0) return "#ffffff";
  return rgbToHex(getComputedStyle(el).backgroundColor) || "#ffffff";
}

/**
 * Reads a "progress" element's current fill-bar color as a hex string,
 * "#ffffff" if unparseable - same convention as currentFillValue(), just
 * pointed at the inner .progress-el-fill rather than el itself.
 * @param el the progress element (data-progress)
 * @return a "#rrggbb" string
 */
function currentProgressFillValue(el) {
  var fillEl = el.querySelector(".progress-el-fill");
  return (fillEl && rgbToHex(getComputedStyle(fillEl).backgroundColor)) || "#ffffff";
}

/**
 * Reads a "progress" element's current track/background color as a hex
 * string, "#ffffff" if unparseable - same convention as currentFillValue(),
 * just for its own background rather than a textbox's.
 * @param el the progress element (data-progress)
 * @return a "#rrggbb" string
 */
function currentProgressTrackValue(el) {
  return rgbToHex(getComputedStyle(el).backgroundColor) || "#ffffff";
}

/**
 * Reads a button's current text color (see the style popover's Text color
 * row, buttons only) as a hex string, "#ffffff" if it's unparseable (an
 * <input type=color> has no real "unset" state of its own, same convention
 * as currentFillValue()).
 * @param el the button element
 * @return a "#rrggbb" string
 */
function currentTextColorValue(el) {
  return rgbToHex(getComputedStyle(el).color) || "#ffffff";
}

/**
 * Reads an image/video's current tint color (see setElementTint()) as a hex
 * string, "#ffffff" if it has none (an <input type=color> has no real
 * "unset" state of its own, same convention as currentFillValue()).
 * @param el the image/video element
 * @return a "#rrggbb" string
 */
function currentTintValue(el) {
  var wrap = el.parentNode;
  var ov = wrap && wrap.classList && wrap.classList.contains("free-wrap") ? wrap.querySelector(".tint-ov") : null;
  if (!ov) return "#ffffff";
  return rgbToHex(getComputedStyle(ov).backgroundColor) || "#ffffff";
}

/**
 * Reads an image/video's current shade amount (see setElementShade()) as a
 * 0-1 number, 0 if it has none.
 * @param el the image/video element
 * @return a 0-1 number
 */
function currentShadeValue(el) {
  var wrap = el.parentNode;
  var ov = wrap && wrap.classList && wrap.classList.contains("free-wrap") ? wrap.querySelector(".shade-ov") : null;
  if (!ov) return 0;
  return parseFloat(getComputedStyle(ov).opacity) || 0;
}

/**
 * Reads an element's current (uniform, all four corners) border radius in
 * css px, off the live computed style so an element already rounded by the
 * stylesheet (eg a .card) starts the slider at its real look, not 0.
 * @param el the element
 * @return a whole-number px value
 */
function currentRadiusValue(el) {
  return Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
}

/**
 * Reads an element's current border width/color off the live computed
 * style. A computed border-width resolves to 0 when border-style is "none"
 * (the css spec, not a manual check here), but this project's own
 * untouched elements instead draw a real 1px solid border with a fully
 * transparent color (--border in css/style.css, "no borders anywhere" is
 * achieved by hiding the color, not removing the border), which the spec
 * does NOT zero out on its own: read literally, that would show a
 * misleading "1px" in the picker, and worse, undo could restore it as a
 * solid black border once rgbToHex() collapses the unparseable alpha away.
 * So a fully transparent computed color is treated as no border too,
 * same alpha check currentFillValue() already does.
 * @param el the element
 * @return {w, color}
 */
function currentBorderValue(el) {
  var cs = getComputedStyle(el);
  var c = parseComputedColor(cs.borderTopColor);
  if (!c || c.a === 0) return { w: 0, color: "#000000" };
  return {
    w: Math.round(parseFloat(cs.borderTopWidth) || 0),
    color: rgbToHex(cs.borderTopColor) || "#000000"
  };
}

/**
 * Whether el currently has the shared drop-shadow applied (see
 * BOX_SHADOW_VALUE), read straight off its own inline style since that's
 * the only place applyShadowOverrides()/the shadow checkbox ever write it.
 * @param el the element
 * @return true if its box-shadow is set to anything other than "none"
 */
function currentShadowOn(el) {
  var v = getComputedStyle(el).boxShadow;
  return !!v && v !== "none";
}

/**
 * Fills one Color/Text color/Fill/Border row's pair of light+dark swatches,
 * and its toggle button, so that whichever theme is actually rendering on
 * screen right now is always the "primary" one: shown by default, its
 * value the color the TA can actually see. The other theme's swatch is
 * "secondary" - collapsed behind the toggle - so a TA who never touches it
 * never even notices it's there. Without this the panel would always treat
 * light as primary regardless of which mode is being previewed, exactly
 * the bug flagged in "make sure that whatever color shows up in the editor
 * panel is the color that is being shown in the current mode they are on".
 * The secondary swatch previews its own explicit override if the TA set
 * one, else autoDarkVariant() of the primary value as a starting
 * suggestion - autoDarkVariant() is self-inverse (flips HSL lightness), so
 * the same formula works as a suggestion in either direction. Only the
 * primary side's value is written into THEMED_OVERRIDE_MAPS eagerly (it
 * mirrors what's already painted); the secondary side stays
 * presentation-only until the TA actually edits or resets it.
 * @param liveValue the color actually rendered right now (eg
 *   currentColorValue(el)), always goes in the primary swatch
 * @param lightInput/darkInput the row's two <input type=color>s - fixed
 *   save targets (light always saves to lightMap, dark to darkMap)
 *   regardless of which one is primary right now
 * @param lightRow/darkRow their own "sm-*-row"/"sm-dark-row" divs
 * @param toggleBtn the row's "🌙"/"☀️" toggle button
 * @param lightMap/darkMap THEMED_OVERRIDE_MAPS.* for this row
 * @param label used in the toggle's title, eg "color" -> "Edit dark mode color"
 * @return {{lightBefore, darkBefore}} gesture-baseline values for the two
 *   physical inputs, for STYLE_*_BEFORE/STYLE_DARK*_BEFORE
 */
function primeThemedColorRow(liveValue, lightInput, darkInput, lightRow, darkRow, toggleBtn, lightMap, darkMap, label) {
  var id = STYLE_MENU_ID;
  var dark = isDarkThemeActive();
  var primaryInput = dark ? darkInput : lightInput;
  var primaryRow = dark ? darkRow : lightRow;
  var primaryMap = dark ? darkMap : lightMap;
  var secondaryInput = dark ? lightInput : darkInput;
  var secondaryRow = dark ? lightRow : darkRow;
  var secondaryMap = dark ? lightMap : darkMap;

  primaryInput.value = liveValue;
  /* NOT primaryMap[id] = liveValue here - that would fabricate a fake
     "explicit override" out of a plain live-value read (eg an element with
     no dark override at all, just showing its auto-computed variant), and
     since primary/secondary swap by theme, a later re-open (or theme
     flip) in the OTHER direction would then see this map entry and
     wrongly treat it as a real explicit override, auto-expanding the
     secondary row for something the TA never actually set. Only an actual
     edit (the row's own "input" handler) should ever write into a map. */
  primaryRow.style.display = "";

  var explicitSecondary = secondaryMap[id];
  secondaryInput.value = explicitSecondary || autoDarkVariant(liveValue);
  secondaryRow.style.display = explicitSecondary ? "" : "none";

  toggleBtn.textContent = dark ? "☀️" : "🌙";
  toggleBtn.title = dark ? ("Edit light mode " + label) : ("Edit dark mode " + label);

  /* the primary side's baseline is always its live value (there's always
     "a color" being rendered); the secondary side's baseline is the raw
     explicit-override map entry, "" if unset - NOT the suggestion showing
     in its input - so that eg clicking its reset button when nothing was
     ever explicitly set doesn't record a spurious "suggestion -> nothing"
     undo step. */
  return {
    lightBefore: dark ? (explicitSecondary || "") : liveValue,
    darkBefore: dark ? liveValue : (explicitSecondary || "")
  };
}

/**
 * Re-primes Color/Text color/Fill/Border color's light<->dark swap for
 * whichever element the style popover is currently open on - the part of
 * toggleStyleMenu() that actually depends on which theme is active, kept
 * separate so it can be re-run on its own by refreshStyleMenuTheme()
 * without disturbing radius/shadow/tint/opacity/etc, which don't change
 * with theme. Which rows are relevant for this element's KIND (isImg,
 * isBtn, isText, isIcon/isDatetime) never changes for a given element, so
 * that gating is recomputed fresh here too (cheap) rather than threaded in.
 * @param el the element the popover is open on
 */
function primeStyleMenuThemedRows(el) {
  var kind = elKind(el);
  var isImg = kind === "img";
  var isIcon = kind === "icon";
  var isDatetime = el.hasAttribute("data-datetime");
  var isProgress = el.hasAttribute("data-progress");
  var isExtrasArea = el.hasAttribute("data-extras-area") || el.hasAttribute("data-days-area");
  var isText = colorTarget(el) === "text";
  var isBtn = isButtonEl(el);
  var shapeDisplay = (isIcon || isDatetime) ? "none" : "";

  if (!isImg && !isProgress && !isExtrasArea) {
    var colorBefore = primeThemedColorRow(currentColorValue(el),
      STYLE_MENU.querySelector(".sm-color"), STYLE_MENU.querySelector(".sm-color-dark"),
      STYLE_MENU.querySelector(".sm-color-row"), STYLE_MENU.querySelector(".sm-color-dark-row"),
      STYLE_MENU.querySelector(".sm-color-dark-toggle"), THEMED_OVERRIDE_MAPS.colors, THEMED_OVERRIDE_MAPS.darkColors, "color");
    STYLE_COLOR_BEFORE = colorBefore.lightBefore;
    STYLE_DARKCOLOR_BEFORE = colorBefore.darkBefore;
  }

  if (isProgress) {
    var d = customElementById(STYLE_MENU_ID) || {};
    populateProgressVarSelect(STYLE_MENU.querySelector(".sm-progress-current"), d.varCurrent || "");
    populateProgressVarSelect(STYLE_MENU.querySelector(".sm-progress-total"), d.varTotal || "");
    STYLE_PROGRESSVAR_BEFORE = { varCurrent: d.varCurrent, varTotal: d.varTotal };

    var pFillBefore = primeThemedColorRow(currentProgressFillValue(el),
      STYLE_MENU.querySelector(".sm-progress-fill"), STYLE_MENU.querySelector(".sm-progress-fill-dark"),
      STYLE_MENU.querySelector(".sm-progress-fill-row"), STYLE_MENU.querySelector(".sm-progress-fill-dark-row"),
      STYLE_MENU.querySelector(".sm-progress-fill-dark-toggle"), THEMED_OVERRIDE_MAPS.progressFill, THEMED_OVERRIDE_MAPS.darkProgressFill, "progress color");
    STYLE_PROGRESSFILL_BEFORE = pFillBefore.lightBefore;
    STYLE_DARKPROGRESSFILL_BEFORE = pFillBefore.darkBefore;

    var pTrackBefore = primeThemedColorRow(currentProgressTrackValue(el),
      STYLE_MENU.querySelector(".sm-progress-track"), STYLE_MENU.querySelector(".sm-progress-track-dark"),
      STYLE_MENU.querySelector(".sm-progress-track-row"), STYLE_MENU.querySelector(".sm-progress-track-dark-row"),
      STYLE_MENU.querySelector(".sm-progress-track-dark-toggle"), THEMED_OVERRIDE_MAPS.progressTrack, THEMED_OVERRIDE_MAPS.darkProgressTrack, "bar color");
    STYLE_PROGRESSTRACK_BEFORE = pTrackBefore.lightBefore;
    STYLE_DARKPROGRESSTRACK_BEFORE = pTrackBefore.darkBefore;
  }

  if (isText) {
    var fillBefore = primeThemedColorRow(currentFillValue(el),
      STYLE_MENU.querySelector(".sm-fill"), STYLE_MENU.querySelector(".sm-fill-dark"),
      STYLE_MENU.querySelector(".sm-fill-row"), STYLE_MENU.querySelector(".sm-fill-dark-row"),
      STYLE_MENU.querySelector(".sm-fill-dark-toggle"), THEMED_OVERRIDE_MAPS.fill, THEMED_OVERRIDE_MAPS.darkFill, "fill");
    STYLE_FILL_BEFORE = fillBefore.lightBefore;
    STYLE_DARKFILL_BEFORE = fillBefore.darkBefore;
  }

  if (isBtn) {
    var textColorBefore = primeThemedColorRow(currentTextColorValue(el),
      STYLE_MENU.querySelector(".sm-textcolor"), STYLE_MENU.querySelector(".sm-textcolor-dark"),
      STYLE_MENU.querySelector(".sm-textcolor-row"), STYLE_MENU.querySelector(".sm-textcolor-dark-row"),
      STYLE_MENU.querySelector(".sm-textcolor-dark-toggle"), THEMED_OVERRIDE_MAPS.textColor, THEMED_OVERRIDE_MAPS.darkTextColor, "text color");
    STYLE_TEXTCOLOR_BEFORE = textColorBefore.lightBefore;
    STYLE_DARKTEXTCOLOR_BEFORE = textColorBefore.darkBefore;
  }

  if (!isIcon && !isDatetime) {
    /* border width lives in the same always-visible row as the light color
       swatch (there's no separate "width" row to swap), so unlike
       color/text color/fill, border can't just swap two whole rows by
       theme - instead the light swatch <input> itself hides/shows within
       its row (width stays put either way, since it's theme-independent,
       see applyBorderOverrides()), while the dark row (just the one
       swatch) still swaps wholesale like the others. */
    var borderColor = STYLE_MENU.querySelector(".sm-border-color");
    var borderColorDark = STYLE_MENU.querySelector(".sm-border-color-dark");
    var borderDarkToggle = STYLE_MENU.querySelector(".sm-border-dark-toggle");
    var bd = currentBorderValue(el);
    STYLE_MENU.querySelector(".sm-border-w").value = bd.w;
    STYLE_MENU.querySelector(".sm-border-val").textContent = bd.w + "px";
    /* NOT writing bd (the live value) into THEMED_OVERRIDE_MAPS.border/
       darkBorder here - same reasoning as primeThemedColorRow(): a plain
       live-value read isn't a real explicit override, and fabricating one
       would make the OTHER side wrongly auto-expand once the TA flips
       theme or reopens this popover later, see confirmedLightBorderColor()
       for the one place that still needs a "no real override yet"
       fallback. */
    var darkActive = isDarkThemeActive();
    if (darkActive) {
      borderColorDark.value = bd.color;
      var cachedLight = THEMED_OVERRIDE_MAPS.border[STYLE_MENU_ID];
      var explicitLight = cachedLight && cachedLight.color;
      borderColor.value = explicitLight || autoDarkVariant(bd.color);
      borderColor.style.display = explicitLight ? "" : "none";
      STYLE_MENU.querySelector(".sm-border-dark-row").style.display = shapeDisplay;
    } else {
      borderColor.value = bd.color;
      borderColor.style.display = "";
      var cachedDark = THEMED_OVERRIDE_MAPS.darkBorder[STYLE_MENU_ID];
      var explicitDark = cachedDark && cachedDark.color;
      borderColorDark.value = explicitDark || autoDarkVariant(bd.color);
      STYLE_MENU.querySelector(".sm-border-dark-row").style.display =
        (shapeDisplay !== "none" && explicitDark) ? "" : "none";
    }
    STYLE_BORDER_BEFORE = { w: bd.w, color: borderColor.value };
    STYLE_DARKBORDER_BEFORE = darkActive ? bd.color : ((THEMED_OVERRIDE_MAPS.darkBorder[STYLE_MENU_ID] || {}).color || "");
    borderDarkToggle.textContent = darkActive ? "☀️" : "🌙";
    borderDarkToggle.title = darkActive ? "Edit light mode border" : "Edit dark mode border";
  }
}

/**
 * Keeps the style popover in sync with reality when a TA flips the site's
 * own theme toggle while the popover is already open on some element -
 * without this the panel would keep showing whichever mode was active when
 * it was opened, exactly the "you WILL have to add some kind of way for
 * the editor to know which mode of page it is showing a preview of" gap.
 * A no-op if the popover isn't open. Hooked into js/theme.js's setTheme()
 * via window.refreshStyleMenuTheme, same window.-gated pattern as
 * window.reapplyThemedColors.
 */
function refreshStyleMenuTheme() {
  if (!STYLE_MENU || !STYLE_MENU.classList.contains("show") || !STYLE_MENU_ID) return;
  var el = styleMenuEl();
  if (!el) return;
  primeStyleMenuThemedRows(el);
}
window.refreshStyleMenuTheme = refreshStyleMenuTheme;

/**
 * Opens the style popover anchored under the ring's style button (or
 * closes it, if it's already open, so re-clicking the button toggles it),
 * pre-filling both controls from the element's current live color/opacity.
 * @param anchorEl the ring's .sth button
 */
function toggleStyleMenu(anchorEl) {
  if (!STYLE_MENU) buildStyleMenu();
  if (STYLE_MENU.classList.contains("show")) { hideStyleMenu(); return; }
  if (!RING_EL) return;
  STYLE_MENU_ID = elId(RING_EL);
  var el = RING_EL;
  var kind = elKind(el);
  var isImg = kind === "img";
  var isIcon = kind === "icon";
  var isDatetime = el.hasAttribute("data-datetime");
  var isProgress = el.hasAttribute("data-progress");
  var isExtrasArea = el.hasAttribute("data-extras-area") || el.hasAttribute("data-days-area");
  var isText = colorTarget(el) === "text";
  var isBtn = isButtonEl(el);
  var isThemeToggle = el.hasAttribute("data-theme-toggle");
  /* a progress element paints its own Progress color/Bar color rows
     instead of the generic Color row (see colorTarget(), which would
     otherwise call it a plain "bg" target); the extras/days-area container
     is deliberately always transparent - a background belongs on the tile
     rect underneath each attachment/day, not on the layout box around them */
  STYLE_MENU.querySelector(".sm-color-row").style.display = (isImg || isProgress || isExtrasArea) ? "none" : "";
  STYLE_MENU.querySelector(".sm-color-dark-row").style.display = (isImg || isProgress || isExtrasArea) ? "none" : "";
  STYLE_MENU.querySelector(".sm-color-toggle-row").style.display = (isImg || isProgress || isExtrasArea) ? "none" : "";
  STYLE_MENU.querySelectorAll(".sm-progress-row").forEach(function (row) { row.style.display = isProgress ? "" : "none"; });
  /* for every other bg-target element "Color" is the only surface control
     there is, but a button also gets its own separate Text color row right
     below, so it's worth spelling out which one this now is */
  STYLE_MENU.querySelector(".sm-color-label").textContent = isBtn ? "Background" : "Color";
  STYLE_MENU.querySelector(".sm-textcolor-row").style.display = isBtn ? "" : "none";
  STYLE_MENU.querySelector(".sm-textcolor-dark-row").style.display = isBtn ? "" : "none";
  STYLE_MENU.querySelector(".sm-textcolor-toggle-row").style.display = isBtn ? "" : "none";
  STYLE_MENU.querySelector(".sm-theme-row").style.display = isThemeToggle ? "" : "none";
  /* a datetime element paints its own text color via the Color row, so its
     Fill row (a text field's background) would just be clutter; hide it */
  STYLE_MENU.querySelector(".sm-fill-row").style.display = (isText && !isDatetime) ? "" : "none";
  STYLE_MENU.querySelector(".sm-fill-dark-row").style.display = (isText && !isDatetime) ? "" : "none";
  STYLE_MENU.querySelector(".sm-fill-toggle-row").style.display = (isText && !isDatetime) ? "" : "none";
  STYLE_MENU.querySelector(".sm-tint-row").style.display = isImg ? "" : "none";
  STYLE_MENU.querySelector(".sm-shade-row").style.display = isImg ? "" : "none";
  /* rounding/border/shadow on the bare digits text make no more sense than
     on an icon, so hide the shape group for a datetime element too */
  var shapeDisplay = (isIcon || isDatetime) ? "none" : "";
  STYLE_MENU.querySelectorAll(".sm-shape-row").forEach(function (row) { row.style.display = shapeDisplay; });
  STYLE_MENU.querySelectorAll(".sm-dt-row").forEach(function (row) { row.style.display = isDatetime ? "" : "none"; });

  var tintInput = STYLE_MENU.querySelector(".sm-tint");
  var shadeInput = STYLE_MENU.querySelector(".sm-shade");
  var shadeVal = STYLE_MENU.querySelector(".sm-shade-val");
  var radiusInput = STYLE_MENU.querySelector(".sm-radius");
  var radiusVal = STYLE_MENU.querySelector(".sm-radius-val");
  var shadowInput = STYLE_MENU.querySelector(".sm-shadow");
  var opacityInput = STYLE_MENU.querySelector(".sm-opacity");
  var opacityVal = STYLE_MENU.querySelector(".sm-opacity-val");

  /* handles Color/Text color/Fill/Border color's light<->dark primary swap
     (see primeThemedColorRow()) - factored out so refreshStyleMenuTheme()
     can re-run just this part when the site's theme flips while the
     popover is already open, without disturbing anything else */
  primeStyleMenuThemedRows(el);

  if (isImg) {
    tintInput.value = currentTintValue(el);
    STYLE_TINT_BEFORE = tintInput.value === "#ffffff" ? "" : tintInput.value;
    var shadeNow = currentShadeValue(el);
    shadeInput.value = Math.round(shadeNow * 100);
    shadeVal.textContent = shadeInput.value + "%";
    STYLE_SHADE_BEFORE = shadeInput.value;
  }

  if (isDatetime) {
    var dtd = customElementById(STYLE_MENU_ID) || {};
    var fmt = dtd.format || "countdown";
    STYLE_MENU.querySelector(".sm-dt-font").value = el.style.fontFamily || "";
    STYLE_MENU.querySelector(".sm-dt-format").value = fmt;
    STYLE_MENU.querySelector(".sm-dt-pattern").value = dtd.strftime || "";
    STYLE_MENU.querySelector(".sm-dt-pattern").placeholder = DT_DEFAULT_PATTERNS[fmt] || "";
    STYLE_MENU.querySelector(".sm-dt-target").value = toDatetimeLocalValue(new Date(dtd.target || Date.now()));
    STYLE_MENU.querySelectorAll(".sm-dt-align").forEach(function (b) {
      b.classList.toggle("active", el.style.textAlign === b.getAttribute("data-align"));
    });
    STYLE_DT_BEFORE = { target: dtd.target, format: fmt, strftime: dtd.strftime || "" };
  }

  if (!isIcon && !isDatetime) {
    /* a progress bar is usually short and wide (eg 14px tall), so reaching
       a full pill shape needs a radius well past the 60px ceiling that's
       plenty for a normal card/tile; bump it just for this kind rather than
       raising the shared default for everything else too */
    radiusInput.max = isProgress ? 200 : 60;
    var rad = currentRadiusValue(el);
    radiusInput.value = rad;
    radiusVal.textContent = rad + "px";
    STYLE_RADIUS_BEFORE = String(rad);

    shadowInput.checked = currentShadowOn(el);
  }

  /* a fadesOwnBackground() wrapper never carries a real css opacity (see its
     own doc comment), so its actual fade lives in data-op-alpha instead;
     reading getComputedStyle(el).opacity there would always read back 1 */
  var op = fadesOwnBackground(el)
    ? Math.round((el.dataset.opAlpha !== undefined ? parseFloat(el.dataset.opAlpha) : 1) * 100)
    : Math.round((parseFloat(getComputedStyle(el).opacity) || 1) * 100);
  opacityInput.value = op;
  opacityVal.textContent = op + "%";
  STYLE_OPACITY_BEFORE = String(op);

  var r = anchorEl.getBoundingClientRect();
  STYLE_MENU.classList.add("show");
  var w = STYLE_MENU.offsetWidth, h = STYLE_MENU.offsetHeight;
  var maxX = window.innerWidth - w - 4, maxY = window.innerHeight + window.scrollY - h - 4;
  var x = r.left + window.scrollX;
  var y = r.bottom + window.scrollY + 4;
  STYLE_MENU.style.left = Math.max(0, Math.min(x, maxX)) + "px";
  STYLE_MENU.style.top = Math.max(0, Math.min(y, maxY)) + "px";
}

/** Closes the style popover, if open. */
function hideStyleMenu() {
  if (STYLE_MENU) STYLE_MENU.classList.remove("show");
  STYLE_MENU_ID = null;
}

/**
 * Snaps the ring onto its current element's rendered box. Document
 * coordinates (rect + scroll), re-run on scroll/resize since the sticky
 * nav's document position changes as the page scrolls. Also toggles
 * .locked so the move handle can dim/disable itself for a locked element
 * (see isLocked()/startMoveDrag()).
 */
function positionRing() {
  if (!RING || !RING_EL) return;
  var r = RING_EL.getBoundingClientRect();
  RING.style.display = "";
  RING.style.left = (r.left + window.scrollX) + "px";
  RING.style.top = (r.top + window.scrollY) + "px";
  RING.style.width = r.width + "px";
  RING.style.height = r.height + "px";
  RING.classList.toggle("locked", isLocked(elId(RING_EL)));
  RING.classList.toggle("reel-tile", RING_EL.hasAttribute("data-reel-tile"));
}

/**
 * Freezes every tracked element inside el (icon, text, image, whatever) at
 * its exact current on-screen spot, right before el itself gets resized.
 * Without this, an untouched descendant is still governed by el's own css
 * layout (eg flex centering), so growing el would visually drag it along,
 * breaking "no attachment between elements" just as much as if el's own
 * move leaked into it (moving is already immune to this, see paintPos()/
 * ancestorPos(), resizing needs the same guarantee). Pins each one to
 * whichever ancestor is actually its nearest positioned one (offsetParent)
 * so a doubly-nested tracked element (an icon inside a card inside the
 * section being resized) lands relative to the closest thing that makes
 * sense, not always the outer el. Two passes, same reason
 * applyPositionOverrides() is two passes: read every wrap's current rect
 * FIRST, then write the pins second, so pinning the first descendant (an
 * icon leaving the flex row) can't shift a not-yet-pinned sibling (the
 * label sliding over to fill the gap) before its own turn comes and it
 * gets measured already-wrong. A no-op past the first resize, since a
 * pinned element is already immune to every future one, its own or an
 * ancestor's. Skips a theme toggle's own ".tic-label" (see
 * isThemeToggleLabel()): pinning it absolute would freeze the label at its
 * pre-resize spot instead of letting it reflow inside the button's own
 * growing/shrinking flex box, same as the plain (untracked) icon markup
 * beside it already does with no pinning at all.
 * @param el the element about to be resized
 */
function freezeDescendants(el) {
  var wraps = [];
  el.querySelectorAll(RESIZABLE_SEL).forEach(function (d) {
    if (isThemeToggleLabel(d)) return;
    var wrap = detachFromFlow(d);
    if (wrap.dataset.pinned !== "1") wraps.push(wrap);
  });
  var snaps = wraps.map(function (wrap) {
    var anchor = wrap.offsetParent || el;
    return { wrap: wrap, anchor: anchor, cr: anchor.getBoundingClientRect(), tr: wrap.getBoundingClientRect() };
  });
  snaps.forEach(function (s) {
    var cs = getComputedStyle(s.anchor);
    if (cs.position === "static") s.anchor.style.position = "relative";
    s.wrap.style.position = "absolute";
    s.wrap.style.left = (s.tr.left - s.cr.left - (parseFloat(cs.borderLeftWidth) || 0)) + "px";
    s.wrap.style.top = (s.tr.top - s.cr.top - (parseFloat(cs.borderTopWidth) || 0)) + "px";
    s.wrap.style.margin = "0";
    s.wrap.dataset.pinned = "1";
  });
}

/**
 * One resize drag from whichever of the 8 handles was grabbed. A real
 * width/height change (see setBox()), so text reflows inside its box at
 * its own size instead of stretching. Dragging a left/top handle keeps
 * the opposite edge pinned by sliding the element's own move offset while
 * the box grows/shrinks. Aspect ratio: icons always locked; images keep
 * object-fit: cover (whatever the box's new shape, the photo re-crops to
 * fill it, never stretched/warped pixel-for-pixel) with shift additionally
 * locking the box's own proportions so the crop framing doesn't swing
 * wildly; everything else (text boxes, cards, sections, buttons) is free.
 * @param e the handle's mousedown
 */
function startResizeDrag(e) {
  /* a reel tile can't detachFromFlow() without breaking the flex track it
     lives in - this only ever fires from the ring's own (already CSS-hidden
     for a tile, see positionRing()) handle buttons, so it's defense in
     depth, not the real gate. Same reasoning for an attachments/day tile's
     rect (fills the tile via inset:0, a fixed size makes no sense) and its
     filename/title/daytag text (sized by its own content); the icon/badge/
     button roles are deliberately NOT included here - those stay resizable,
     see buildExtrasTileHtml()/renderDays() in js/dashboard.js. */
  if (!RING_EL || RING_EL.hasAttribute("data-reel-tile")) return;
  var xRole = RING_EL.getAttribute("data-extras-role");
  if (xRole === "rect" || xRole === "text") return;
  var dRole = RING_EL.getAttribute("data-days-role");
  if (dRole && /(^|\.)(rect|title|daytag)$/.test(dRole)) return;
  e.preventDefault();
  e.stopPropagation();
  var el = RING_EL;
  var dir = RING_DIRS[e.target.getAttribute("data-dir")];
  var kind = elKind(el);
  detachFromFlow(el);
  freezeDescendants(el);
  var startX = e.clientX, startY = e.clientY;
  var start = getSize(el);
  var base = getPos(el);
  RING_DRAGGING = true;

  function onMove(ev) {
    var w = dir[0] ? Math.max(16, start.w + dir[0] * (ev.clientX - startX)) : start.w;
    var h = dir[1] ? Math.max(12, start.h + dir[1] * (ev.clientY - startY)) : start.h;
    if (kind === "icon" || (kind === "img" && ev.shiftKey)) {
      var f;
      if (dir[0] && dir[1]) {
        /* corner drag: follow whichever axis moved more */
        f = Math.abs(w / start.w - 1) > Math.abs(h / start.h - 1) ? w / start.w : h / start.h;
      } else {
        f = dir[0] ? w / start.w : h / start.h;
      }
      w = start.w * f;
      h = start.h * f;
    }
    setBox(el, w, h);
    /* pin the opposite edge on left/top drags */
    setOwnPos(el,
      base.tx + (dir[0] === -1 ? start.w - w : 0),
      base.ty + (dir[1] === -1 ? start.h - h : 0));
    positionRing();
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    RING_DRAGGING = false;
    var s = getSize(el), p = getPos(el);
    commitSize(el);
    commitPosition(el);
    pushResizeUndo(elId(el),
      { w: start.w, h: start.h, tx: base.tx, ty: base.ty },
      { w: s.w, h: s.h, tx: p.tx, ty: p.ty });
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/**
 * One move drag from the ring's move handle: a pure translate on the
 * element itself, any direction. A block/inline-block element's own flow
 * slot is untouched by a translate (it's paint-only), but a naturally
 * *inline* element (a plain <span>, eg. the hero title text) is exempt from
 * `transform` by spec, CSS only honours it on block/inline-block/replaced
 * boxes, so it must still be detached first (see detachFromFlow()): that
 * forces a blockified, absolutely-positioned box, whose old flow slot is
 * held open by its frozen wrap, so nothing shifts either way. A no-op past
 * the first detach. Tracked elements inside a moved container visually stay
 * put, see setOwnPos(). Locked elements (see isLocked()) don't start a
 * drag at all, so a placed element can't be accidentally nudged out of
 * position; the handle itself is also dimmed/disabled via .sel-ring.locked.
 * @param e the handle's mousedown
 */
function startMoveDrag(e) {
  /* every attachments/day tile role (rect/icon/text/button/badge) is laid
     out by shared CSS across every rendered tile, not individually placed -
     moving one would only fight that layout on the next render, see
     buildExtrasTileHtml()/renderDays() in js/dashboard.js */
  if (!RING_EL || isLocked(elId(RING_EL)) || RING_EL.hasAttribute("data-reel-tile") || RING_EL.hasAttribute("data-extras-role") || RING_EL.hasAttribute("data-days-role")) return;
  e.preventDefault();
  e.stopPropagation();
  var el = RING_EL;
  var startX = e.clientX, startY = e.clientY;
  RING_DRAGGING = true;
  /* same rigid-group broadcast as the drag-anywhere handler, see
     groupMembersFor(). Every member's rect is grabbed up front, before ANY
     of them detaches, see detachFromFlow()'s knownRect param: two spans
     sharing one flow (eg the hero title's own two halves) would otherwise
     have the first one's detach reflow the second's still-fresh position
     out from under it. */
  var groupMembers = groupMembersFor(elId(el));
  var elRect = el.getBoundingClientRect();
  groupMembers.forEach(function (m) { m.preRect = m.el.getBoundingClientRect(); });
  detachFromFlow(el, elRect);
  var base = getPos(el);
  groupMembers.forEach(function (m) { detachFromFlow(m.el, m.preRect); });

  function onMove(ev) {
    var dx = ev.clientX - startX, dy = ev.clientY - startY;
    setOwnPos(el, base.tx + dx, base.ty + dy);
    groupMembers.forEach(function (m) { setOwnPos(m.el, m.base.tx + dx, m.base.ty + dy); });
    positionRing();
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    RING_DRAGGING = false;
    var p = getPos(el);
    commitPosition(el);
    var moves = [{ id: elId(el), before: base, after: p }];
    groupMembers.forEach(function (m) {
      var mp = getPos(m.el);
      commitPosition(m.el);
      moves.push({ id: m.id, before: m.base, after: mp });
    });
    pushGroupMoveUndo(moves);
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/** Double-click on a resize handle: back to the template's own size. */
function resetSizeDbl(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!RING_EL) return;
  var el = RING_EL;
  var before = getSize(el);
  var pos = getPos(el);
  resetBox(el);
  saveEditedSize(elId(el), null);
  var after = getSize(el);
  pushResizeUndo(elId(el), { w: before.w, h: before.h, tx: pos.tx, ty: pos.ty }, { w: after.w, h: after.h, tx: pos.tx, ty: pos.ty });
  positionRing();
}

/** Double-click on the move handle: back to the template's own spot. */
function resetPosDbl(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!RING_EL) return;
  var el = RING_EL;
  var before = getPos(el);
  setOwnPos(el, 0, 0);
  saveEditedPosition(elId(el), null, null);
  pushMoveUndo(elId(el), before, { tx: 0, ty: 0 });
  positionRing();
}

/**
 * Hides (or restores) every element sharing one data-edit-id/data-resize-id
 * and persists it, same "an id is one logical thing, not one specific DOM
 * node" rule mirrorEditedField() already applies to text (deleting the brand
 * wordmark takes it out of the nav and the footer together, not just
 * whichever copy was clicked). The actual hide/show is setHiddenVisual()
 * (display:none for a leaf element, invisible-but-present for a wrapper
 * around other tracked elements, see its doc comment); this just applies
 * that to every matching element and persists the change.
 * @param id the element's data-edit-id or data-resize-id
 * @param hidden true to hide/delete it, false to restore it
 */
function setElementHidden(id, hidden) {
  if (hidden) HIDDEN_IDS[id] = true; else delete HIDDEN_IDS[id];
  document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
    setHiddenVisual(el, hidden);
  });
  saveEditedVisibility(id, hidden);
}

/**
 * Deletes the currently-selected element (ring's trash handle, or the
 * Delete/Backspace key, see wireResizable()), and it really is deleted, same
 * as anything else in the editor (see setHiddenVisual() for how a wrapper
 * around other tracked elements, eg the brand link around the logo image
 * and brand text or a section around its own nested content, is handled
 * differently so it can't take them down with it). Pushed onto the same
 * undo stack as a text edit so Ctrl+Z brings it right back.
 * @param el the element to delete (always the current RING_EL)
 */
function deleteElement(el) {
  /* a reel tile isn't an independently deletable thing - only the reel
     panel itself is (see buildReelElement()); this guard covers both the
     ring's own trash handle AND the Delete/Backspace keydown handler
     (see wireResizable()), since both call this one function */
  if (el.hasAttribute("data-reel-tile")) return;
  /* the download button and icon inside an attachments tile, and the
     icon/badge inside a day tile, are the one deliberate exception besides a
     reel tile: everything else about a tile (its rect, its filename/title/
     daytag text) stays normally deletable, see buildExtrasTileHtml()/
     renderDays() in js/dashboard.js */
  if (el.hasAttribute("data-extras-fixed") || el.hasAttribute("data-days-fixed")) return;
  var id = elId(el);
  if (!id) return;
  /* a grouped element (see groupOf()) takes every other member down with
     it, one "groupdelete" undo entry covering the whole group instead of a
     plain "delete" for just el, so undo brings all of them back at once */
  var g = groupOf(id);
  if (g && g.length > 1) {
    g.forEach(function (gid) { setElementHidden(gid, true); });
    EDIT_UNDO.push({ type: "groupdelete", ids: g.slice() });
  } else {
    setElementHidden(id, true);
    EDIT_UNDO.push({ type: "delete", id: id });
  }
  EDIT_REDO.length = 0;
  hideTextToolbar();
  RING_EL = null;
  if (RING) RING.style.display = "none";
}

/* every group of ids a ta has tied together (right-click > "Group N
   elements", see createGroup()), a flat array of id-arrays, mirrors
   content.groups exactly. moving, nudging, or deleting one member does the
   same to every other member of its own group (see groupMembersFor()),
   its own move/resize/delete stays completely independent otherwise: a
   group is a deliberate, explicit tie, not a new kind of nesting, this
   project's whole "no attachment between elements" system (see
   ancestorPos()'s own doc comment) is exactly the opposite default. */
var GROUPS = [];

/* ids currently queued for grouping (shift-click a tracked element to
   toggle it in/out, see toggleSelected()), session-only, never persisted:
   this is just "what the ta has clicked so far", cleared once "Group" is
   actually chosen (or Escape) */
var SELECTED_IDS = [];

/**
 * The group id belongs to, if any.
 * @param id the element's data-edit-id or data-resize-id
 * @return the group (an array of ids, including id itself), or null
 */
function groupOf(id) {
  for (var i = 0; i < GROUPS.length; i++) {
    if (GROUPS[i].indexOf(id) !== -1) return GROUPS[i];
  }
  return null;
}

/**
 * Every OTHER member of id's group, resolved to their live element and
 * captured move offset, ready for a move/nudge to broadcast the same delta
 * onto. Locked members are left out, same rule a direct drag on them
 * already follows; a member no longer in the document (deleted, or this id
 * isn't grouped at all) is left out too.
 * @param id the element's data-edit-id or data-resize-id
 * @return an array of {id, el, base}
 */
function groupMembersFor(id) {
  var g = groupOf(id);
  if (!g) return [];
  var out = [];
  g.forEach(function (otherId) {
    if (otherId === id) return;
    var el = document.querySelector('[data-edit-id="' + otherId + '"], [data-resize-id="' + otherId + '"]');
    if (!el || isLocked(otherId)) return;
    out.push({ id: otherId, el: el, base: getPos(el) });
  });
  return out;
}

/**
 * Whether id is currently queued for grouping.
 * @param id the element's data-edit-id or data-resize-id
 * @return true if it's in SELECTED_IDS
 */
function isSelected(id) {
  return SELECTED_IDS.indexOf(id) !== -1;
}

/**
 * Adds or removes id from the current grouping selection (shift-click, see
 * wireTextField()/the drag-anywhere mousedown handler in wireResizable()),
 * repainting the .multi-selected highlight either way.
 * @param id the element's data-edit-id or data-resize-id
 */
function toggleSelected(id) {
  if (!id) return;
  var i = SELECTED_IDS.indexOf(id);
  if (i === -1) SELECTED_IDS.push(id); else SELECTED_IDS.splice(i, 1);
  updateSelectionHighlight();
}

/** Clears the current grouping selection (Escape), repainting the highlight. */
function clearSelection() {
  SELECTED_IDS = [];
  updateSelectionHighlight();
}

/**
 * Repaints the .multi-selected outline (css/style.css) onto exactly the
 * elements currently in SELECTED_IDS, clearing it from anything else that
 * still carries it from a moment ago.
 */
function updateSelectionHighlight() {
  document.querySelectorAll(".multi-selected").forEach(function (el) { el.classList.remove("multi-selected"); });
  SELECTED_IDS.forEach(function (id) {
    document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
      el.classList.add("multi-selected");
    });
  });
}

/**
 * Ties the given ids together into a new group (right-click > "Group N
 * elements"): any of them already in another group is pulled out of that
 * one first, so groups never overlap.
 * @param ids the ids to group (2 or more)
 * @return the new group, the same array passed in
 */
function createGroup(ids) {
  ids = ids.slice();
  GROUPS = GROUPS.map(function (g) { return g.filter(function (id) { return ids.indexOf(id) === -1; }); })
    .filter(function (g) { return g.length > 1; });
  GROUPS.push(ids);
  saveGroups(GROUPS);
  return ids;
}

/**
 * Dissolves whichever group id belongs to, if any (right-click > "Ungroup").
 * @param id an id in the group to dissolve
 * @return the dissolved group's ids, or null if id wasn't grouped
 */
function dissolveGroup(id) {
  var g = groupOf(id);
  if (!g) return null;
  GROUPS = GROUPS.filter(function (x) { return x !== g; });
  saveGroups(GROUPS);
  return g;
}

/**
 * Persists the whole group list into the preview snapshot, the same
 * localStorage draft every other override here uses. Rewritten wholesale,
 * same as saveLayerOrder(), since GROUPS is always the full, current list.
 * @param groups GROUPS
 */
function saveGroups(groups) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.groups = groups;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Loads content.groups into the in-memory GROUPS on every load, live site
 * included (though grouping only ever matters inside the visual editor,
 * this keeps it consistent with every other applyXOverrides() here).
 * @param groups content.groups
 */
function applyGroups(groups) {
  GROUPS = (groups || []).map(function (g) { return g.slice(); });
}

/**
 * Pushes one undo entry for a group move/nudge (see the drag-anywhere
 * mousedown handler and the arrow-key nudge handler in wireResizable()):
 * drops any member that didn't actually move (eg a locked or missing one
 * never included to begin with), and collapses to a plain "move" entry
 * when only one member actually moved, so an ungrouped drag's undo history
 * looks exactly like it always has.
 * @param moves [{id, before, after}], one entry per member that was moved
 */
function pushGroupMoveUndo(moves) {
  var real = moves.filter(function (m) { return m.before.tx !== m.after.tx || m.before.ty !== m.after.ty; });
  if (!real.length) return;
  if (real.length === 1) {
    EDIT_UNDO.push({ type: "move", id: real[0].id, before: real[0].before, after: real[0].after });
  } else {
    EDIT_UNDO.push({ type: "groupmove", moves: real });
  }
  EDIT_REDO.length = 0;
}

/* every custom element a ta has added via the right-click "Add element"
   menu this load, {id, kind, left, top, w, h, icon, href}, mirrors
   content.custom_elements exactly (see renderCustomElements()) */
var CUSTOM_ELEMENTS = [];

/* content.variables, refreshed from the same content payload as
   CUSTOM_ELEMENTS on every load (see applyProgressBindings()): named, typed
   values a "progress" custom element's Current/Total selects bind to by
   key, see variableByKey()/variableNumericValue(). */
var VARIABLES = [];

/**
 * Looks up one variable by its stable key (see app/db.py's
 * DEFAULT_CONTENT["variables"]).
 * @param key a variable's "key"
 * @return the variable {key, name, type, value, ...}, or null if unknown
 */
function variableByKey(key) {
  for (var i = 0; i < VARIABLES.length; i++) {
    if (VARIABLES[i].key === key) return VARIABLES[i];
  }
  return null;
}

/**
 * Reads a variable's current value as a number, for the "progress" custom
 * element's fill-ratio math - a string/boolean/datetime-typed variable (or
 * an unknown key, eg one that's since been deleted) just reads as 0 rather
 * than throwing, same "never crash the page over a stale reference" stance
 * customElementById()/elByAnyId() already take elsewhere in this file.
 * @param key a variable's "key"
 * @return a number, 0 if unset/unparseable
 */
function variableNumericValue(key) {
  var v = variableByKey(key);
  var n = v ? parseFloat(v.value) : NaN;
  return isNaN(n) ? 0 : n;
}

/**
 * Fills a <select> with every variable matching predicate, built with real
 * DOM nodes rather than an innerHTML string since a variable's ta-typed
 * "name" isn't escaped anywhere else in this file. Shared by the "progress"
 * element's style-popover Current/Total selects (see
 * populateProgressVarSelect()) and the text toolbar's formula menu (see
 * openFormulaMenu()).
 * @param selectEl the <select> to fill
 * @param predicate function(variable) -> bool, which variables to include
 * @param selectedKey the value to preselect
 */
function populateVariableSelect(selectEl, predicate, selectedKey) {
  selectEl.textContent = "";
  VARIABLES.filter(predicate).forEach(function (v) {
    var opt = document.createElement("option");
    opt.value = v.key;
    opt.textContent = v.name || v.key;
    selectEl.appendChild(opt);
  });
  selectEl.value = selectedKey;
}

/**
 * Fills a "progress" element's style-popover Current/Total <select> with
 * every number-typed variable (a progress bar's fill ratio is only ever
 * meaningful between two numbers - string/boolean/datetime variables just
 * don't show up as options here). See populateVariableSelect().
 * @param selectEl the "sm-progress-current"/"sm-progress-total" <select>
 * @param selectedKey the element's current d.varCurrent/d.varTotal
 */
function populateProgressVarSelect(selectEl, selectedKey) {
  populateVariableSelect(selectEl, function (v) { return v.type === "number"; }, selectedKey);
}

/**
 * Every operation the text toolbar's formula chip ("ƒx" button) can insert.
 * "value" is the only one that accepts a non-number variable (its B select
 * stays hidden); every other op reads both operands as numbers via
 * variableNumericValue(), same 0-on-unset/unparseable fallback as the
 * progress bar's bindings.
 */
var FX_OPS = {
  value: { label: "Value", needsB: false, anyType: true },
  sum: { label: "Sum (A + B)", needsB: true },
  difference: { label: "Difference (A − B)", needsB: true },
  product: { label: "Product (A × B)", needsB: true },
  quotient: { label: "Quotient (A ÷ B)", needsB: true },
  percent: { label: "Percent (A of B, as %)", needsB: true },
  fraction: { label: "“A of B”", needsB: true }
};

/**
 * Escapes text being dropped into an innerHTML string. Nothing else in this
 * file needs this (a ta's own contentEditable output is trusted verbatim,
 * see saveEditedField()/applyTextOverrides()), but a formula chip's
 * displayed text is computed from live variable data, not typed by a ta, so
 * building its <span> markup (see buildFormulaChipHtml()) is the one place
 * here that turns arbitrary data into an HTML string and needs to guard
 * against it looking like markup.
 * @param str any value, coerced to string
 * @return str with &<>"' replaced by entities
 */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/**
 * Computes a formula chip's live display text from its op + operand
 * variable keys (see FX_OPS, buildFormulaChipHtml()). Reads current
 * VARIABLES, so this always reflects whatever was last fetched - same
 * reload-to-refresh freshness as the progress bar's own bindings
 * (paintProgressElement()), there is no live polling anywhere in this app.
 * @param op one of FX_OPS's keys
 * @param aKey variable A's key
 * @param bKey variable B's key, ignored for "value"
 * @param decimals decimal places for any numeric result
 * @return the text to show inside the chip
 */
function formulaChipText(op, aKey, bKey, decimals) {
  var dp = parseInt(decimals, 10);
  if (isNaN(dp) || dp < 0) dp = 0;
  if (op === "value") {
    var a = variableByKey(aKey);
    if (!a) return "";
    if (a.type === "number") return variableNumericValue(aKey).toFixed(dp);
    if (a.type === "boolean") return a.value ? "Yes" : "No";
    if (a.type === "datetime") {
      var d = a.value ? new Date(a.value) : null;
      return d && !isNaN(d.getTime()) ? d.toLocaleString() : "";
    }
    return a.value == null ? "" : String(a.value);
  }
  var av = variableNumericValue(aKey);
  var bv = variableNumericValue(bKey);
  switch (op) {
    case "sum": return (av + bv).toFixed(dp);
    case "difference": return (av - bv).toFixed(dp);
    case "product": return (av * bv).toFixed(dp);
    case "quotient": return bv === 0 ? "—" : (av / bv).toFixed(dp);
    case "percent": return bv === 0 ? "—" : (av / bv * 100).toFixed(dp) + "%";
    case "fraction": return av.toFixed(dp) + " of " + bv.toFixed(dp);
    default: return "";
  }
}

/**
 * Builds the <span> markup for a new/edited formula chip, config baked into
 * data-fx-* attributes (read back by repaintFormulaChips() and
 * openFormulaMenu()'s edit flow) riding along inside the same content.text
 * HTML string as everything else a ta types in this field - same
 * self-describing-inline-span approach as the toolbar's own foreColor spans
 * (data-light-color/data-dark-color, see applyThemedForeColor()).
 * contenteditable="false" makes the browser treat it as one atomic unit for
 * caret/backspace navigation inside the surrounding contentEditable field.
 * @param op one of FX_OPS's keys
 * @param aKey variable A's key
 * @param bKey variable B's key, omitted from the markup for "value"
 * @param decimals decimal places for any numeric result
 * @return an HTML string for a single <span class="fx-chip">
 */
function buildFormulaChipHtml(op, aKey, bKey, decimals) {
  var text = formulaChipText(op, aKey, bKey, decimals);
  var attrs = ' data-fx-op="' + escapeHtml(op) + '" data-fx-a="' + escapeHtml(aKey) + '"' +
    (bKey ? ' data-fx-b="' + escapeHtml(bKey) + '"' : '') +
    ' data-fx-decimals="' + escapeHtml(String(decimals)) + '"';
  return '<span class="fx-chip" contenteditable="false"' + attrs + '>' + escapeHtml(text) + '</span>';
}

/**
 * Repaints every formula chip's displayed text against current VARIABLES,
 * same role for chips as repaintInlineTextColors() plays for foreColor
 * spans: applyTextOverrides() just set each field's innerHTML from its
 * saved content.text snapshot, which may carry a chip's stale baked-in text
 * from whenever it was last saved, so every load (and every VARIABLES
 * refresh) needs to re-render each chip's text from live data. Called right
 * after VARIABLES is (re)assigned, alongside applyProgressBindings().
 */
function repaintFormulaChips() {
  document.querySelectorAll(".fx-chip").forEach(function (chip) {
    chip.textContent = formulaChipText(chip.dataset.fxOp, chip.dataset.fxA, chip.dataset.fxB, chip.dataset.fxDecimals);
  });
}

/**
 * Builds the markup for a "filename" chip: an attachments-tile-only variant
 * of the formula chip above (data-fx-local instead of data-fx-op/data-fx-a)
 * that resolves off whichever tile it's actually rendered inside right now
 * (closest("[data-extras-tile]")'s own data-extras-filename, set by js/
 * dashboard.js's buildExtrasTileHtml()) rather than a content.variables
 * lookup - so unlike every fx-chip above, this one deliberately never shows
 * up in js/ta.js's variables list. Lives inside the shared tile text
 * template (content.text["extras.tile.text"]), same as any other text a ta
 * types there, so deleting it (plain contenteditable backspace - still
 * atomic, contenteditable="false") removes it from every tile at once, same
 * as any other template edit.
 * @return an HTML string for a single <span class="fx-chip">
 */
function buildExtrasFilenameChipHtml() {
  return '<span class="fx-chip" contenteditable="false" data-fx-local="filename">filename</span>';
}

/**
 * Repaints every filename chip's displayed text off the tile it's actually
 * rendered inside right now. Needed because content.text's saved template
 * HTML carries whichever tile's filename happened to be resolved when it
 * was last saved - in particular, mirrorEditedField() blindly copies one
 * tile's just-edited innerHTML onto every other tile sharing the same
 * data-edit-id, which for every other chip is exactly right (same template,
 * same everywhere) but would leave every OTHER tile showing the edited
 * tile's own filename. Called unconditionally at the end of
 * mirrorEditedField() (cheap no-op wherever no filename chip exists) so
 * that blind copy is corrected right back to each tile's own filename
 * immediately after.
 */
function repaintExtrasFilenameChips() {
  document.querySelectorAll('.fx-chip[data-fx-local="filename"]').forEach(function (chip) {
    var tile = chip.closest("[data-extras-tile]");
    chip.textContent = (tile && tile.dataset.extrasFilename) || "";
  });
}

/**
 * Handles the attachments area's right-click "Create textbox with filename
 * variable" action (see renderCtxMenuRoot()'s data-extras-add-filename
 * button): restores the filename chip into the shared tile text template at
 * the end of whichever tile the context menu was opened on, so a ta who
 * backspaced the chip out of the template can bring it back without
 * retyping the rest of it by hand. Goes through the exact same
 * commitTextFieldChange()/mirrorEditedField() path a normal typed edit
 * does, so undo and cross-tile mirroring both work identically - the
 * restored chip (and any text the ta adds around it afterward) then shows
 * up on every tile, same as any other template edit.
 * @param tile the [data-extras-tile] the context menu was opened on
 */
function insertExtrasFilenameChip(tile) {
  var field = tile.querySelector('[data-extras-role="text"]');
  if (!field) return;
  var before = field.innerHTML;
  field.innerHTML = before + (before ? " " : "") + buildExtrasFilenameChipHtml();
  commitTextFieldChange(field, before, field.innerHTML);
}

/**
 * A day tile's local chip variants (day-number/day-date/day-locked): same
 * "resolves off whichever tile it's rendered inside" idea as the filename
 * chip above (data-fx-local, closest("[data-days-tile]")'s own dataset)
 * rather than a content.variables lookup, so none of these show up in
 * js/ta.js's variables list either. day-locked reads as plain "Yes"/"No",
 * same convention formulaChipText() already uses for a real boolean
 * variable's "value" formula chip - no boolean-variable machinery had to
 * change, this is just a third local source feeding the same display rule.
 * @param local "day-number", "day-date", or "day-locked"
 * @param label the chip's placeholder text before it resolves
 * @return an HTML string for a single <span class="fx-chip">
 */
function buildDaysChipHtml(local, label) {
  return '<span class="fx-chip" contenteditable="false" data-fx-local="' + local + '">' + label + '</span>';
}

/**
 * Repaints every day-tile local chip off the tile it's actually rendered
 * inside right now, same "undo mirrorEditedField()'s blind copy" reasoning
 * as repaintExtrasFilenameChips(). data-days-date is already the tile's
 * pre-formatted display date (see js/dashboard.js's renderDays()), not a
 * raw ISO string, so no date formatting is duplicated here.
 */
function repaintDaysChips() {
  document.querySelectorAll('.fx-chip[data-fx-local="day-number"]').forEach(function (chip) {
    var tile = chip.closest("[data-days-tile]");
    chip.textContent = (tile && tile.dataset.daysNumber) ? ("Day " + tile.dataset.daysNumber) : "";
  });
  document.querySelectorAll('.fx-chip[data-fx-local="day-date"]').forEach(function (chip) {
    var tile = chip.closest("[data-days-tile]");
    chip.textContent = (tile && tile.dataset.daysDate) || "";
  });
  document.querySelectorAll('.fx-chip[data-fx-local="day-locked"]').forEach(function (chip) {
    var tile = chip.closest("[data-days-tile]");
    chip.textContent = tile && tile.dataset.daysLocked === "1" ? "Yes" : "No";
  });
}

/**
 * Handles the day tile area's right-click "Insert day number"/"Insert
 * unlock date"/"Insert locked-state text" actions (see renderCtxMenuRoot()'s
 * data-days-add-* buttons): restores the given local chip into whichever
 * chip-eligible text field (the locked template's title, or the open
 * template's daytag) exists on the tile the context menu was opened on -
 * same commitTextFieldChange()/mirrorEditedField() path a normal typed edit
 * takes, so undo and cross-tile mirroring both work identically.
 * @param tile the [data-days-tile] the context menu was opened on
 * @param local "day-number", "day-date", or "day-locked"
 */
function insertDaysChip(tile, local) {
  var field = tile.querySelector('[data-days-role="locked.title"], [data-days-role="open.daytag"]');
  if (!field) return;
  var labels = { "day-number": "Day #", "day-date": "date", "day-locked": "locked" };
  var before = field.innerHTML;
  field.innerHTML = before + (before ? " " : "") + buildDaysChipHtml(local, labels[local] || local);
  commitTextFieldChange(field, before, field.innerHTML);
}

/* the nav's real theme toggle (#themeBtn, templates/index.html)'s own sun/
   moon pair, verbatim: a placed "theme" custom element (buildCustomElement())
   starts out with this same auto day/night swap (css [data-theme] rule,
   .tic.sun/.tic.moon in style.css) before a ta ever picks a fixed
   replacement icon via the style popover's "Change icon" row. */
var THEME_ICON_DEFAULT_SVG =
  '<svg class="tic sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" />' +
  '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>' +
  '<svg class="tic moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>';

/* every distinct icon actually used anywhere on the site (index.html's
   learn cards, schedule day rows, prizes, countdown, theme toggle, about
   section burst, plus dashboard.html/js/dashboard.js's attachment-type and
   lock/unlock glyphs), reused verbatim rather than pulling in an icon
   library: "icons that exist already", not new ones, and not just the
   handful off one page. class="cic" for the same fixed 30x30 accent-colored
   sizing every other content icon on the site already uses. Built-in, so
   unlike CUSTOM_ICONS (see fetchCustomAssets()) none of these are ever
   deletable from the picker. */
var ICON_LIBRARY = [
  { label: "Checkmark", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>' },
  { label: "Calendar", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" />' +
    '<path d="M3 9h18M8 3v4M16 3v4" /></svg>' },
  { label: "Circuit", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h3" /><path d="M19 12h3" />' +
    '<path d="M5 12c2-7 4-7 6 0s4 7 6 0" /></svg>' },
  { label: "Component", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h6" /><path d="M21 12h-6" />' +
    '<path d="M9 7l6 5-6 5z" /><path d="M15 7v10" /></svg>' },
  { label: "Chip", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" />' +
    '<path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" /></svg>' },
  { label: "Cube", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z" />' +
    '<path d="M12 12l9-5M12 12v10M12 12L3 7" /></svg>' },
  { label: "Soldering iron", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 7l4 4L7 21H3v-4z" />' +
    '<path d="M15 5l2-2 4 4-2 2" /></svg>' },
  { label: "Flag", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v18" /><path d="M6 4h13v8H6z" />' +
    '<path d="M6 4h4.3v4H6zM14.7 4H19v4h-4.3zM10.3 8h4.4v4h-4.4z" fill="currentColor" stroke="none" /></svg>' },
  { label: "Mystery", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" />' +
    '<path d="M8.5 14a4.5 4.5 0 0 0 7 0" /><path d="M9 9.5h.01M15 9.5h.01" /></svg>' },
  { label: "Lightbulb", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0 0 12 3z" />' +
    '<path d="M9 19h6M10 22h4" /></svg>' },
  { label: "Signal", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 17h3V7h5v10h5V7h5" />' +
    '<path d="M20 7h2" /></svg>' },
  { label: "Play", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 5v14l12-7z" />' +
    '<path d="M2 9h5M2 15h5M19 12h3" /></svg>' },
  { label: "Magnet", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v8a5 5 0 0 0 10 0V3" />' +
    '<path d="M5 8h4M15 8h4" /></svg>' },
  { label: "Lightning", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9z" /></svg>' },
  { label: "Figure", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="5" r="2" />' +
    '<path d="M11 7l-5.5 13M13 7l5.5 13" /><path d="M8.2 15a7 7 0 0 0 7.6 0" /></svg>' },
  { label: "Wrench", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>' },
  { label: "Module", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v6M15 2v6" />' +
    '<path d="M7 8h10v3a5 5 0 0 1-10 0z" /><path d="M12 16v6" /></svg>' },
  { label: "Code", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5" /></svg>' },
  { label: "Target", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" />' +
    '<circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>' },
  { label: "Smiley", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" />' +
    '<circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none" />' +
    '<circle cx="12" cy="15.5" r="2" /></svg>' },
  { label: "Sun", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" />' +
    '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>' },
  { label: "Moon", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>' },
  { label: "Burst", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M10 12H2" /><path d="M11 7L4 3" /><path d="M11 17l-7 4" /></svg>' },
  { label: "Folder", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>' },
  { label: "Link", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>' },
  { label: "Photo", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>' +
    '<path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>' },
  { label: "Document", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>' +
    '<path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>' },
  { label: "Slides", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="M7 21l5-5 5 5"/></svg>' },
  { label: "File", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>' },
  { label: "Lock", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/>' +
    '<path d="M8 11V8a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2"/></svg>' },
  { label: "Unlock", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/>' +
    '<path d="M8 11V8a4 4 0 0 1 7.5-2"/><path d="M12 14.5v2"/></svg>' }
];

/* ta-uploaded icons/videos/fonts, shared with every ta the moment they're
   added (unlike a profile there's no separate share step), fetched fresh
   whenever the relevant picker opens (see fetchCustomAssets()). Each entry
   is {id, owner, name, url}; only its owner can remove it (enforced
   server-side too, see app/main.py's api_delete_asset()) - never a built-in
   (ICON_LIBRARY/TEXT_FONTS aren't rows in this table at all) and never
   another ta's upload. */
var CUSTOM_ICONS = [];
var CUSTOM_FONTS = [];

/**
 * The logged-in ta's username, straight out of localStorage: same-origin,
 * so it's already there whether this runs in the ta's real portal tab or
 * the preview iframe that shares localStorage with it.
 * @return the current ta's username, or "" if somehow not logged in
 */
function currentTaUsername() {
  return localStorage.getItem("session") || "";
}

/**
 * Bearer-authed fetch for the shared icon/video/font asset endpoints, same
 * token convention as uploadEditorFile() (js/ta.js's authedFetch() isn't
 * loaded on this file's pages).
 * @param url request url
 * @param opts fetch options
 * @return the fetch promise
 */
function assetFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, { "Authorization": "Bearer " + (localStorage.getItem("token") || "") });
  return fetch(url, opts);
}

/**
 * Lists every ta-uploaded asset of one kind, shared with every ta.
 * @param kind "icon", "video", or "font"
 * @return a promise resolving to a list of {id, owner, name, url} rows
 *   (resolves to [] on any failure, so a picker just shows no custom ones
 *   rather than breaking)
 */
function fetchCustomAssets(kind) {
  return assetFetch("/api/assets/" + kind)
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; });
}

/**
 * Registers an already-uploaded file (see uploadEditorFile()) as a shared
 * icon/video/font, owned by whoever's calling this.
 * @param kind "icon", "video", or "font"
 * @param name display name
 * @param url the uploaded file's url
 * @return a promise resolving to the new asset's id
 */
function createCustomAsset(kind, name, url) {
  return assetFetch("/api/assets/" + kind, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, url: url })
  }).then(function (res) {
    if (!res.ok) throw new Error("save failed");
    return res.json();
  }).then(function (data) { return data.id; });
}

/**
 * Deletes a ta-uploaded icon/video/font. Only actually deletes server-side
 * if the current ta is the one who added it (see app/main.py).
 * @param kind "icon", "video", or "font"
 * @param id the asset's id
 * @return the fetch promise
 */
function deleteCustomAsset(kind, id) {
  return assetFetch("/api/assets/" + kind + "/" + id, { method: "DELETE" });
}

/**
 * Parses a raw `<svg>...</svg>` string (see ICON_LIBRARY) into a real,
 * detached svg element: document.createElement() can't build one directly,
 * it needs the svg namespace, so this goes through innerHTML on a plain
 * div instead and pulls the parsed node back out.
 * @param markup the svg markup
 * @return the parsed, detached svg element
 */
function svgFromMarkup(markup) {
  var tmp = document.createElement("div");
  tmp.innerHTML = markup;
  return tmp.firstElementChild;
}

/**
 * Wraps a not-yet-inserted element in its own `.free-wrap` (see
 * detachFromFlow()) positioned at (x, y) in document coordinates and
 * attaches it to the page, so every existing resize/move/delete/text-edit
 * mechanism already treats it exactly like a template element that's been
 * dragged out of flow, no special-casing needed anywhere else. Appended
 * directly to body, never nested inside page content, so deleting or
 * moving an existing section can never take a newly-added element down
 * with it (see ancestorPos()'s "no attachment between elements" rule).
 * @param el the element to place (not yet in the document)
 * @param x left, document (page) px
 * @param y top, document (page) px
 * @return el, now attached
 */
function placeFreeElement(el, x, y) {
  var wrap = document.createElement("span");
  wrap.className = "free-wrap";
  wrap.style.position = "absolute";
  wrap.style.left = x + "px";
  wrap.style.top = y + "px";
  document.body.appendChild(wrap);
  el.style.position = "absolute";
  el.style.top = "0";
  el.style.left = "0";
  el.style.margin = "0";
  el.style.maxWidth = "none";
  wrap.appendChild(el);
  return el;
}

/**
 * Freezes a freshly-placed free element (see placeFreeElement()) at its
 * just-rendered size, the same finishing step detachFromFlow() already
 * does for an existing element on its first resize, so double-clicking a
 * resize handle later has a sane "as first created" size to reset back to.
 * @param el the element, already filled with its real content
 */
function freezeFreeElement(el) {
  var r = el.getBoundingClientRect();
  el.dataset.natW = r.width;
  el.dataset.natH = r.height;
  el.style.width = r.width + "px";
  el.style.height = r.height + "px";
  el.parentNode.style.width = r.width + "px";
  el.parentNode.style.height = r.height + "px";
}

/**
 * Builds and places the DOM node for one custom-element descriptor (see
 * addCustomElement()/renderCustomElements()), tagging it with the same
 * data-edit-id/data-resize-id convention every template element already
 * uses, so the rest of this file (resize, move, delete, text edit, text
 * style, undo) needs zero special-casing for anything created here. A
 * "button" is a single tagged `<a>` (data-edit-id right on it, no separate
 * inner textbox), same "the button IS the textbox" rule every other CTA on
 * the site follows; the link entered when adding it becomes a real href
 * via the same right-click "Add link" mechanism every other element uses
 * (see LINKS/applyOneLink(), addCustomElement()). An "image" with a `d.url` is a real
 * uploaded photo (see uploadEditorFile()/renderCtxMenuImagePicker()), a plain
 * `<img>` with the site's usual object-fit: cover so its box dictates the
 * crop rather than stretching the pixels; one saved before real uploads
 * existed (no `d.url`) still falls back to the site's flat `.ph` placeholder
 * box (see the Media bullets in CLAUDE.md). A "video" is a real uploaded
 * clip (same upload flow as an image), a plain looping muted autoplay
 * `<video>`, same object-fit: cover. A "datetime" is a live countdown or a
 * formatted static date/time (see renderDatetimeContent()), driven by its
 * own `d.target`/`d.format` rather than a click-to-edit text field. A
 * "theme" is a real functional light/dark toggle (see js/theme.js's
 * `[data-theme-toggle]` listener), always built with the default sun/moon
 * icon (a fixed replacement is a content.theme_icons override applied
 * afterward, see applyThemeIconOverrides(), same two-pass shape the nav's
 * static #themeBtn also relies on), its label a normal click-to-edit
 * `.tic-label` span nested inside. An icon (the catch-all last branch)
 * with a `d.url` is a ta-uploaded icon (see fetchCustomAssets()) rendered as
 * a plain `<img>` rather than parsed svg markup; `elKind()` already treats
 * any "icon."-prefixed id as icon kind (locked aspect ratio) regardless of
 * tag, so this needs no special-casing anywhere else.
 * @param d {id, kind, left, top, w, h, icon, href, url, target, format}
 * @return the built, attached element
 */
function buildCustomElement(d) {
  var el = buildCustomElementNode(d);
  placeFreeElement(el, d.left, d.top);
  if (d.w) { el.style.width = d.w + "px"; el.dataset.natW = d.w; }
  if (d.h) { el.style.height = d.h + "px"; el.dataset.natH = d.h; }
  return el;
}

/**
 * The kind-dispatch half of buildCustomElement(): builds and fills in one
 * descriptor's DOM node, but doesn't place it - split out so a reel tile's
 * bound child (see buildReelElement()) can be built the exact same way
 * every top-level custom element is, then appended straight into its tile
 * instead of going through placeFreeElement()/document.body.
 * @param d see buildCustomElement()
 * @return the built, unplaced element
 */
function buildCustomElementNode(d) {
  var el;
  if (d.kind === "text") {
    el = document.createElement("div");
    el.setAttribute("data-edit-id", d.id);
    el.textContent = "Text";
  } else if (d.kind === "button") {
    el = document.createElement("a");
    el.className = "btn";
    el.href = "#";
    el.setAttribute("data-edit-id", d.id);
    el.textContent = "Button";
    /* a real href now (see LINKS/applyOneLink()): wireClickToEdit()'s own
       click handler already preventDefaults before this ever fires while
       the visual editor's open (see wireTextField()), so it's never a
       dead "#" link outside the editor the way it used to be */
  } else if (d.kind === "box") {
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.style.background = "var(--surface-2)";
    el.style.width = "160px";
    el.style.height = "100px";
  } else if (d.kind === "extrasArea") {
    /* transparent layout container for the student dashboard's "Extra
       attachments" tile list (see app/db.py's _DASH_EXTRAS_AREA_ENTRY) -
       js/dashboard.js's renderExtras() finds it by data-resize-id and
       renders the actual per-attachment tiles inside; this only builds the
       empty shell. Deliberately no background (kept transparent, unlike
       "box") - see toggleStyleMenu()'s isExtrasArea handling, which hides
       the generic Color row for it the same way it does for "progress".
       Height is intentionally not left resize-tracked in practice -
       renderExtras() forces height:auto on every render since the tile
       count varies - only width is meant to be dragged, so tiles reflow to
       whatever width a ta picks. */
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-extras-area", "1");
    el.style.width = "100%";
    el.style.minHeight = "40px";
  } else if (d.kind === "daysArea") {
    /* transparent layout container for the student dashboard's "The days"
       tile grid (see app/db.py's _DASH_DAYS_AREA_ENTRY) - js/dashboard.js's
       renderDays() finds it by data-resize-id and renders the actual
       per-day tiles inside; this only builds the empty shell. Same shape as
       the "extrasArea" kind just above, see its doc comment for why height
       isn't left resize-tracked in practice. className carries over the old
       static #dayGrid's own "grid grid-3" (css/style.css), the exact 3-
       column layout (with its existing responsive breakpoints) students
       already see today, rather than duplicating that in a new selector. */
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-days-area", "1");
    el.className = "grid grid-3";
    el.style.width = "100%";
    el.style.minHeight = "40px";
  } else if (d.kind === "image" && d.url) {
    el = document.createElement("img");
    el.src = d.url;
    el.alt = "";
    el.setAttribute("data-resize-id", d.id);
    el.style.objectFit = "cover";
    el.style.width = "240px";
    el.style.height = "180px";
  } else if (d.kind === "image") {
    el = document.createElement("div");
    el.className = "ph";
    el.setAttribute("data-resize-id", d.id);
    el.textContent = "Image";
    el.style.width = "240px";
    el.style.height = "180px";
  } else if (d.kind === "video") {
    el = document.createElement("video");
    el.src = d.url;
    el.autoplay = true;
    el.muted = true;
    el.loop = true;
    el.setAttribute("playsinline", "");
    el.setAttribute("data-resize-id", d.id);
    el.style.objectFit = "cover";
    el.style.width = "320px";
    el.style.height = "200px";
  } else if (d.kind === "datetime") {
    /* a plain, styleable text element whose content is generated from its
       own target/format/strftime (renderDatetimeContent()), live-ticking
       for countdown. data-datetime marks it so colorTarget()/the style
       popover treat it as text (font/size/color/align all apply) without it
       being a click-to-edit field (its text is generated, not typed). */
    el = document.createElement("div");
    el.className = "dt-el";
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-datetime", "1");
    renderDatetimeContent(el, d);
  } else if (d.kind === "progress") {
    /* the outer div (data-resize-id) IS the track/background rectangle:
       applyRadiusOverrides()/applyBorderOverrides()/the opacity slider all
       already work generically on any data-resize-id div (see
       toggleStyleMenu()'s isProgress handling for the one exception, the
       generic Color row, which this has its own replacement for), so
       rounding it into a pill or adding a border needs no new plumbing.
       overflow:hidden clips the inner fill bar to whatever shape the radius
       slider picks. Its own two colors (this div's background is the
       track, the child's is the fill) are independent from the generic
       Color row - see colorTarget()/applyColorOverrides(), both skip
       data-progress elements - and get painted, along with the live fill
       width off the two bound variables (d.varCurrent/d.varTotal), by
       applyProgressBindings()/paintProgressElement(), not here: this only
       builds the static structure with placeholder default colors, same
       two-pass "build with defaults, then apply overrides" shape every
       other kind here follows. */
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-progress", "1");
    el.style.position = "relative";
    el.style.overflow = "hidden";
    el.style.background = "var(--surface-2)";
    el.style.width = "280px";
    el.style.height = "14px";
    var progressFillEl = document.createElement("i");
    progressFillEl.className = "progress-el-fill";
    progressFillEl.style.cssText = "position:absolute;left:0;top:0;bottom:0;width:0;display:block;background:var(--accent);transition:width 1s ease;";
    el.appendChild(progressFillEl);
  } else if (d.kind === "theme") {
    /* a real, functional light/dark toggle (not a decorative copy): clicking
       it anywhere it's placed calls the exact same setTheme() the nav's own
       #themeBtn uses (see js/theme.js's delegated [data-theme-toggle]
       listener), so every instance and the live nav toggle always agree.
       Always starts on the auto sun/moon swap (THEME_ICON_DEFAULT_SVG, css
       [data-theme] rule): a ta's fixed replacement icon isn't baked in here,
       it's a per-id override applied afterward by applyThemeIconOverrides(),
       same two-pass "build with defaults, then apply overrides" shape every
       other kind already follows (colors, text, size, ...) - the nav's own
       static #themeBtn (templates/index.html) needs that same override pass
       since it isn't a custom element at all, so one shared mechanism
       covers both instead of a custom_elements-only field that the real nav
       button could never use. The label is a normal click-to-edit field
       (data-edit-id) defaulting to the live theme's own "Light mode"/"Dark
       mode" text (see refreshThemeToggles() in js/theme.js) rather than a
       fixed default like "text"/"button" kind gets, up until a ta types
       custom text over it. The sun/moon pair lives inside its own ".tic-icon"
       span (d.id + ".icon"), a RESIZABLE_SEL element in its own right, so
       the icon can be resized/moved/colored independently of the button's
       own box and the label - see replaceThemeIcon()/applyThemeIconOverrides()
       for why a picked replacement icon lands inside that same wrapper
       rather than replacing the button's whole innerHTML. */
    el = document.createElement("button");
    el.type = "button";
    el.className = "theme-btn";
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-theme-toggle", "1");
    el.setAttribute("aria-label", "Toggle theme");
    var themeIconWrap = document.createElement("span");
    themeIconWrap.className = "tic-icon";
    themeIconWrap.setAttribute("data-resize-id", d.id + ".icon");
    themeIconWrap.innerHTML = THEME_ICON_DEFAULT_SVG;
    el.appendChild(themeIconWrap);
    var themeLabel = document.createElement("span");
    themeLabel.className = "tic-label";
    themeLabel.setAttribute("data-edit-id", d.id + ".label");
    themeLabel.textContent = "Light mode";
    el.appendChild(themeLabel);
  } else if (d.kind === "reel") {
    el = buildReelElement(d);
  } else if (d.icon) {
    /* built-in or ta-uploaded icon: always real inline <svg> markup, never
       an <img>, so a future color-restyle tool can just set fill/stroke via
       css (an <img> can't be recolored that way). a ta-uploaded icon's raw
       svg markup is fetched once at add-time (see renderCtxMenuIconPicker())
       and stored here, same "the file's actual content travels with the
       saved element" reasoning content.text_styles[id].fontUrl uses for
       custom fonts. */
    el = svgFromMarkup(d.icon);
    el.setAttribute("data-resize-id", d.id);
  } else if (d.url) {
    /* an icon added before icons were inlined as svg markup: still just an
       <img>, can't be recolored later, but keeps rendering fine. elKind()
       already treats an "icon."-prefixed id as icon kind (locked aspect
       ratio) regardless of tag, so this needs no special-casing beyond
       that. */
    el = document.createElement("img");
    el.src = d.url;
    el.alt = "";
    el.setAttribute("data-resize-id", d.id);
  } else {
    el = svgFromMarkup(ICON_LIBRARY[0].svg);
    el.setAttribute("data-resize-id", d.id);
  }
  return el;
}

/**
 * Appends el into tileEl at (x, y), the reel-tile equivalent of
 * placeFreeElement(): same position:absolute + zeroed-margin/max-width
 * setup, wrapped in the same ".free-wrap" span placeFreeElement() uses,
 * just appended into tileEl instead of document.body. Using the exact same
 * wrap convention means detachFromFlow()'s existing "already free" short-
 * circuit (checking el.parentNode for a .free-wrap class) recognizes a
 * bound child immediately, so every later independent move/resize/delete
 * on it (see startResizeDrag()/startMoveDrag()/deleteElement()) needs zero
 * reel-specific code - it works exactly as it would for any other custom
 * element, just anchored to its tile (data-resize-id="1" on the tile, see
 * buildReelElement()) instead of the page.
 * @param tileEl the reel-tile div to append into
 * @param el the built, unplaced element (see buildCustomElementNode())
 * @param x left, tile-relative px
 * @param y top, tile-relative px
 * @return el
 */
function placeInTile(tileEl, el, x, y) {
  var wrap = document.createElement("span");
  wrap.className = "free-wrap";
  wrap.style.position = "absolute";
  wrap.style.left = x + "px";
  wrap.style.top = y + "px";
  tileEl.appendChild(wrap);
  el.style.position = "absolute";
  el.style.top = "0";
  el.style.left = "0";
  el.style.margin = "0";
  el.style.maxWidth = "none";
  wrap.appendChild(el);
  return el;
}

/**
 * Builds a reel's whole DOM subtree (see js/learn-reel.js for the runtime
 * drift/hover/loop behavior this markup drives): a resizable/movable/
 * deletable panel (.reel > .reel-mask > .reel-track), and a fixed set of
 * content tiles inside the track. Tiles are individually selectable/
 * stylable (data-resize-id, so the generic color/radius/border/opacity
 * style-popover rows apply to them automatically, see colorTarget()/
 * elKind()) but are marked data-reel-tile="1" so they're excluded from
 * every path that would otherwise detachFromFlow() them out of the flex
 * track (deleteElement(), the delegated drag-anywhere mousedown handler,
 * arrow-key nudge, startResizeDrag()/startMoveDrag() - see those functions'
 * own data-reel-tile guards). Whatever a ta has already dropped onto a tile
 * (d.tiles[i].children) is built via buildCustomElementNode() and appended
 * straight into that tile via placeInTile(), so it's a real DOM descendant
 * that travels with its tile once js/learn-reel.js starts scrolling it -
 * not just a page element that happens to visually overlap it.
 * @param d {id, orientation, tileW, tileH, tiles: [{id, children}]}
 * @return the unplaced panel element (placeFreeElement()'d by the caller,
 *   buildCustomElement(), exactly like every other kind)
 */
function buildReelElement(d) {
  var panel = document.createElement("div");
  panel.className = "reel reel--" + (d.orientation === "vertical" ? "vertical" : "horizontal");
  panel.setAttribute("data-resize-id", d.id);
  var mask = document.createElement("div");
  mask.className = "reel-mask";
  var track = document.createElement("div");
  track.className = "reel-track";
  mask.appendChild(track);
  panel.appendChild(mask);
  (d.tiles || []).forEach(function (t) {
    var tile = document.createElement("div");
    tile.className = "reel-tile";
    tile.setAttribute("data-resize-id", t.id);
    tile.setAttribute("data-reel-tile", "1");
    tile.style.width = (d.tileW || 280) + "px";
    tile.style.height = (d.tileH || 200) + "px";
    (t.children || []).forEach(function (childD) {
      var childEl = buildCustomElementNode(childD);
      placeInTile(tile, childEl, childD.left || 0, childD.top || 0);
      if (childD.w) { childEl.style.width = childD.w + "px"; childEl.dataset.natW = childD.w; }
      if (childD.h) { childEl.style.height = childD.h + "px"; childEl.dataset.natH = childD.h; }
      if (childD.kind === "text" || childD.kind === "button") wireTextField(childEl);
    });
    track.appendChild(tile);
  });
  return panel;
}

/**
 * Recreates every custom element a ta has added via the visual editor's
 * right-click "Add element" menu, on every load, live site included, same
 * as applyTextOverrides(). These don't exist in the template at all, so
 * unlike a text/size/position override there's no page markup to lay an
 * override on top of, the element itself has to be built from scratch
 * first. Called before every apply*Overrides() pass so they can find these
 * elements by id exactly like any template one.
 * @param list content.custom_elements
 */
function renderCustomElements(list) {
  CUSTOM_ELEMENTS = (list || []).slice();
  CUSTOM_ELEMENTS.forEach(buildCustomElement);
}

/**
 * Re-pins any custom element carrying a stored `d.anchor` selector (right
 * now, just the migrated "What You'll Learn" reel - see app/db.py's
 * _LEARN_REEL_ENTRY and the #learnReelAnchor spacer in templates/index.html)
 * to that in-flow anchor's real, current position, instead of trusting the
 * element's stored left/top verbatim.
 *
 * Why this exists: `d.left`/`d.top` for a migrated element is a plain
 * document-pixel offset, hand-measured once against one browser window.
 * Content that used to sit in normal document flow doesn't stay put at a
 * fixed pixel the way template markup does - anything above it that changes
 * height (eg the hero section, sized with vh units, growing taller on a
 * taller browser window) silently drags the real heading/paragraph down
 * without moving the reel's frozen pixel position, so on a tall enough
 * window the two overlap instead of stacking cleanly. The spacer div
 * (`#learnReelAnchor`) still reserves real in-flow space exactly where the
 * reel belongs, so re-reading its live rect on every load (and resize)
 * keeps the reel correctly aligned under any window size, without having to
 * make the whole free-placed custom-element system responsive.
 *
 * Deliberately doesn't touch anything a ta has since dragged the reel to:
 * a manual move is stored as a separate translate offset on top of this
 * base position (see setOwnPos()/commitPosition()), never by overwriting
 * the wrap's left/top, so re-anchoring the base here can never fight or
 * undo a ta's own drag.
 *
 * Must run after every apply*Overrides() call that could change layout
 * height above the anchor (text/size/position/hidden), so the anchor's own
 * rect already reflects whatever a ta has customized - see the call site
 * next to initAllReels() in fetchContent()'s success handler.
 */
function applyElementAnchors() {
  CUSTOM_ELEMENTS.forEach(function (d) {
    if (!d.anchor) return;
    var anchor = document.querySelector(d.anchor);
    var el = elByAnyId(d.id);
    var wrap = el && el.parentElement;
    if (!anchor || !wrap || !wrap.classList.contains("free-wrap")) return;
    var r = anchor.getBoundingClientRect();
    wrap.style.left = (r.left + window.scrollX) + "px";
    wrap.style.top = (r.top + window.scrollY) + "px";
  });
}

/* re-runs applyElementAnchors() whenever the browser window is resized
   (debounced), since a vh-sized section above an anchored element changes
   height live as the window resizes, not just between page loads. One
   listener for the page's whole lifetime is enough - applyElementAnchors()
   itself is a safe no-op before the first real content load (CUSTOM_ELEMENTS
   starts empty). */
(function () {
  var timer = null;
  window.addEventListener("resize", function () {
    if (timer) clearTimeout(timer);
    timer = setTimeout(applyElementAnchors, 150);
  });
})();

/**
 * Persists the whole custom_elements list into the preview snapshot, the
 * same localStorage draft every other override here uses. Rewritten
 * wholesale (not merged) since the in-memory CUSTOM_ELEMENTS array is
 * always the full, current list.
 * @param list CUSTOM_ELEMENTS
 */
function saveCustomElements(list) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.custom_elements = list;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists the whole extras list into the shared snapshot, same merge-one-
 * field-in shape as saveCustomElements() just above - needed so a bound
 * child added onto an attachments tile (see addBoundElement()) survives
 * Apply/reload, since content.extras otherwise isn't a field this file ever
 * writes to (it's js/dashboard.js's/js/ta.js's own domain the rest of the
 * time).
 * @param list js/dashboard.js's EXTRAS array
 */
function saveExtras(list) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.extras = list;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists the whole days list into the shared snapshot, the day-tile
 * equivalent of saveExtras() just above.
 * @param list js/dashboard.js's DAYS array
 */
function saveDays(list) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.days = list;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Looks up any tracked element by its data-edit-id/data-resize-id, same
 * query every override in this file uses to find its target. First match
 * only: an id shared by mirrored elements (eg nav.brand in the nav and
 * footer) resolves to whichever one happens to come first in the DOM,
 * which is fine here since mirrored elements are always kept identical by
 * design (see mirrorEditedField()).
 * @param id the element's id
 * @return the element, or null if none match
 */
function elByAnyId(id) {
  return document.querySelector('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]');
}

/**
 * A fresh suffix to append to every id in a duplicated subtree (see
 * buildDuplicateClone()), same timestamp+random uid scheme
 * addCustomElement() already uses for the same "guaranteed collision-free,
 * no lookup needed" reason: checking just the root id against the live dom
 * isn't enough here, since one duplicate operation renames a whole subtree
 * of ids at once, and two unrelated duplicates (say, this element's icon
 * duplicated on its own earlier, then the element's whole parent
 * duplicated later) could otherwise land on the same nested id if they
 * both happened to pick the same small counter value. The "~" is
 * deliberately not a character any hand-written id in this codebase uses
 * (ids are dot-separated words), so a duplicate's id can never collide
 * with a genuine template/custom-element id no matter how it's suffixed.
 * @return a fresh suffix, "~dupk3j2x1a4b" or similar
 */
function uniqueDupSuffix() {
  return "~dup" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Clones sourceEl (or, if it's already been individually moved/resized/
 * deleted at some point, its whole .free-wrap, see detachFromFlow()) and
 * gives the clone and every tracked descendant inside it a fresh id: the
 * same suffix appended to every original id found in the subtree, so
 * nested ids stay unique relative to each other exactly as they were
 * (two elements that used to mirror each other, eg the brand text sitting
 * inside a duplicated nav, would still mirror each other within the
 * clone, just not with the original anymore). Any DOM id="..." attribute
 * (a handful of nav elements like #portalLink are addressed that way
 * elsewhere in this file) is stripped from the clone so it can never
 * collide with the original's, since the clone doesn't inherit that
 * element's singleton role. Pure: doesn't touch the DOM, storage, or undo,
 * see insertDuplicateClone()/copyDuplicateOverrides() for the parts that do.
 * @param sourceEl the element (or one of its mirrored instances) to clone
 * @param suffix see uniqueDupSuffix()
 * @return {clone, wrap, pairs, rootEl}: clone is the node to insert into
 *   the dom (either sourceEl's clone or its wrap's clone), wrap is the
 *   original's .free-wrap parent if it has one (else null), pairs is
 *   every {old, new, el} id remap found (el is the clone's own node), and
 *   rootEl is the pairs entry (a live node) corresponding to sourceEl itself
 */
function buildDuplicateClone(sourceEl, suffix) {
  var sourceId = elId(sourceEl);
  var wrap = sourceEl.parentElement && sourceEl.parentElement.classList.contains("free-wrap") ?
    sourceEl.parentElement : null;
  var nodeToClone = wrap || sourceEl;
  var clone = nodeToClone.cloneNode(true);
  if (clone.hasAttribute && clone.hasAttribute("id")) clone.removeAttribute("id");
  if (clone.querySelectorAll) {
    clone.querySelectorAll("[id]").forEach(function (e) { e.removeAttribute("id"); });
  }
  var tracked = [];
  if (clone.matches && clone.matches(RESIZABLE_SEL)) tracked.push(clone);
  clone.querySelectorAll(RESIZABLE_SEL).forEach(function (e) { tracked.push(e); });
  var pairs = [];
  var rootEl = null;
  tracked.forEach(function (el) {
    var oldId = elId(el);
    var newId = oldId + suffix;
    if (el.hasAttribute("data-edit-id")) el.setAttribute("data-edit-id", newId);
    if (el.hasAttribute("data-resize-id")) el.setAttribute("data-resize-id", newId);
    pairs.push({ old: oldId, new: newId, el: el });
    if (oldId === sourceId && !rootEl) rootEl = el;
  });
  return { clone: clone, wrap: wrap, pairs: pairs, rootEl: rootEl };
}

/**
 * Inserts a built duplicate (see buildDuplicateClone()) into the dom: a
 * still-in-flow source (never individually moved/resized) gets its clone
 * dropped in right after it as a plain sibling, so it slots naturally into
 * whatever flex/grid layout the two now share (a duplicated card in a row
 * of cards, say), no coordinate math needed. A source that's been detached
 * from flow gets its whole wrap cloned in beside the original wrap
 * instead, then nudged +24px/+24px from the original so the copy doesn't
 * render exactly on top of it (an in-flow insert never needs this, flow
 * layout already separates the two).
 * @param sourceEl the element that was duplicated
 * @param built the object buildDuplicateClone() returned
 */
function insertDuplicateClone(sourceEl, built) {
  if (built.wrap) {
    built.wrap.parentNode.insertBefore(built.clone, built.wrap.nextSibling);
    var base = getPos(built.rootEl);
    built.rootEl.dataset.ovTx = base.tx + 24;
    built.rootEl.dataset.ovTy = base.ty + 24;
    built.pairs.forEach(function (p) { paintPos(p.el); });
  } else {
    sourceEl.parentNode.insertBefore(built.clone, sourceEl.nextSibling);
  }
}

/**
 * One-time copy of every existing per-id override (size, position, font
 * size, text style, color, opacity, click-to-edit text) from a
 * duplicate's old ids to its new ones, so the copy starts out looking
 * identical to the original instead of snapping back to the template
 * default. Only ever called right when a duplicate is created
 * (duplicateElement()), never on a later reload (renderDuplicates()):
 * every one of these maps is already keyed by the new ids permanently
 * after this runs once, so redoing it on every load would blow away any
 * independent edit made to the duplicate afterward. text_styles gets a
 * shallow copy of its per-id object rather than sharing the same
 * reference, since saveTextStyle()/saveFontFamily() mutate that object
 * in place, sharing it would leak a later font/align change on either
 * copy onto the other.
 * @param pairs the {old, new} id pairs from buildDuplicateClone()
 */
function copyDuplicateOverrides(pairs) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snap;
  try { snap = raw ? JSON.parse(raw) : {}; } catch (e) { snap = {}; }
  var plainMaps = ["sizes", "positions", "font_sizes", "colors", "opacity", "text", "fill", "tint", "shade", "radius", "border", "links", "text_color", "theme_icons", "dark_colors", "dark_text_color", "dark_fill", "dark_border", "progress_fill", "dark_progress_fill", "progress_track", "dark_progress_track"];
  pairs.forEach(function (p) {
    plainMaps.forEach(function (m) {
      if (snap[m] && snap[m][p.old] !== undefined) {
        snap[m] = snap[m] || {};
        snap[m][p.new] = snap[m][p.old];
      }
    });
    if (snap.text_styles && snap.text_styles[p.old]) {
      snap.text_styles = snap.text_styles || {};
      snap.text_styles[p.new] = Object.assign({}, snap.text_styles[p.old]);
    }
    if (Array.isArray(snap.shadow) && snap.shadow.indexOf(p.old) !== -1 && snap.shadow.indexOf(p.new) === -1) {
      snap.shadow.push(p.new);
    }
  });
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snap)); } catch (e) {}
}

/**
 * Registers a duplicate so it survives a reload: content.duplicates is a
 * flat list of {sourceId, suffix}, just enough for renderDuplicates() to
 * redo the exact same clone+remap on every future load (the actual style/
 * text overrides for its ids are already sitting in the normal maps by
 * then, see copyDuplicateOverrides(), this only has to recreate the DOM
 * structure itself).
 * @param sourceId the id that was duplicated
 * @param suffix see uniqueDupSuffix()
 */
function saveDuplicateEntry(sourceId, suffix) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snap;
  try { snap = raw ? JSON.parse(raw) : {}; } catch (e) { snap = {}; }
  if (!Array.isArray(snap.duplicates)) snap.duplicates = [];
  snap.duplicates.push({ sourceId: sourceId, suffix: suffix });
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snap)); } catch (e) {}
}

/**
 * Duplicates one element from the visual editor's right-click menu
 * (Duplicate): clones it (or its whole free-wrap, if it's been moved/
 * resized/deleted before) with a fresh id on itself and every tracked
 * element nested inside it, drops the copy into the dom right next to the
 * original (or nudged +24px/+24px if the original was out of flow),
 * copies over any existing style/text overrides so it starts out looking
 * identical, registers it in content.duplicates so it survives a reload,
 * and wires up click-to-edit on every text field inside the copy (dom
 * clones don't carry over js event listeners, only markup). Undo/redo
 * reuses the plain "add" entry shape: undoing just hides the new element
 * again (setElementHidden(), same as any delete), redoing unhides it,
 * neither side ever needs to rebuild or discard content.duplicates' own
 * entry, which is exactly how a right-click "Add element" already works.
 * @param sourceEl the specific element node that was right-clicked (see
 *   CTX_TARGET_EL, not just its id, which a mirrored element can share
 *   with another node)
 */
function duplicateElement(sourceEl) {
  var sourceId = elId(sourceEl);
  if (!sourceId) return;
  var suffix = uniqueDupSuffix();
  var built = buildDuplicateClone(sourceEl, suffix);
  insertDuplicateClone(sourceEl, built);
  copyDuplicateOverrides(built.pairs);
  if (built.wrap) {
    var rootPos = getPos(built.rootEl);
    saveEditedPosition(elId(built.rootEl), rootPos.tx, rootPos.ty);
  }
  saveDuplicateEntry(sourceId, suffix);
  built.pairs.forEach(function (p) {
    if (p.el.hasAttribute("data-edit-id")) wireTextField(p.el);
    /* cloneNode() copies el.href/attributes but never JS listeners, so a
       cloned linked element (see LINKS/applyOneLink()) needs its own
       click listener re-wired here even though copyDuplicateOverrides()
       already copied the url itself into the snapshot */
    var linkUrl = LINKS[p.old];
    if (linkUrl) {
      LINKS[p.new] = linkUrl;
      applyOneLink(p.el, linkUrl);
    }
  });
  var rootNewId = sourceId + suffix;
  LAYER_ORDER.push(rootNewId);
  applyLayerOrder(LAYER_ORDER);
  saveLayerOrder(LAYER_ORDER);
  applyFixedHighlight();
  applyLinkHighlight();
  applyLockHighlight();
  EDIT_UNDO.push({ type: "add", id: rootNewId });
  EDIT_REDO.length = 0;
}

/**
 * Recreates every duplicate a ta has made via the visual editor's
 * right-click "Duplicate" option, on every load, live site included, same
 * as renderCustomElements(). Unlike a custom element (built from scratch
 * off a structured recipe), a duplicate is reconstructed by re-cloning
 * whatever its source id currently renders as, so it always matches the
 * source's own template markup/structure even if that source was a
 * template element this codebase's markup later changed. Runs in
 * repeated passes (capped) so a duplicate-of-a-duplicate (chained
 * suffixes) renders correctly regardless of array order: each pass
 * renders whatever entries have a currently-findable source and skips the
 * rest, stopping once a full pass makes no progress. Called before every
 * apply*Overrides() pass (same spot renderCustomElements() runs), so those
 * can find a duplicate's ids exactly like any template one; specifically
 * before applyHiddenOverrides(), so a duplicate created from a
 * since-deleted source still gets cloned from what the source looked like
 * before it was hidden, not skipped because the live source node is
 * momentarily still mid-reload.
 * @param list content.duplicates
 */
function renderDuplicates(list) {
  var remaining = (list || []).slice();
  var wireText = isPreviewMode() && isEditMode();
  for (var pass = 0; pass < 20 && remaining.length; pass++) {
    var progressed = false;
    remaining = remaining.filter(function (d) {
      var rootId = d.sourceId + d.suffix;
      if (elByAnyId(rootId)) return false;
      var src = elByAnyId(d.sourceId);
      if (!src) return true;
      var built = buildDuplicateClone(src, d.suffix);
      insertDuplicateClone(src, built);
      if (wireText) {
        built.pairs.forEach(function (p) {
          if (p.el.hasAttribute("data-edit-id")) wireTextField(p.el);
        });
      }
      progressed = true;
      return false;
    });
    if (!progressed) break;
  }
}

/**
 * Uploads one file for the "Add element" menu (Image, Video, or an
 * uploaded Icon), the same ta-only /api/upload endpoint every other upload
 * on the site already posts to (attachments, gallery, hero video, home
 * images). Reads the session token straight out of localStorage rather
 * than going through js/ta.js's authedFetch()/authHeaders(), since this
 * file runs on pages that never load ta.js; same-origin, so the token's
 * already there whether this runs in the ta's real portal tab or the
 * preview iframe it shares localStorage with.
 * @param file the File object from the picker
 * @return a promise resolving to the uploaded file's url
 */
function uploadEditorFile(file) {
  var fd = new FormData();
  fd.append("file", file);
  return fetch("/api/upload", {
    method: "POST",
    headers: { "Authorization": "Bearer " + (localStorage.getItem("token") || "") },
    body: fd
  }).then(function (res) {
    if (!res.ok) throw new Error("upload failed");
    return res.json();
  }).then(function (data) { return data.url; });
}

/**
 * Looks up a placed custom element's own data entry (eg a datetime
 * element's target/format) by id, for the right-click "Edit date/time"
 * flow. Unlike elByAnyId() (finds the live DOM node), this finds the plain
 * data object CUSTOM_ELEMENTS holds for it.
 * @param id the element's id
 * @return the CUSTOM_ELEMENTS entry, or null if none match
 */
function customElementById(id) {
  for (var i = 0; i < CUSTOM_ELEMENTS.length; i++) {
    if (CUSTOM_ELEMENTS[i].id === id) return CUSTOM_ELEMENTS[i];
  }
  return null;
}

/* default placed size for the addCustomElement() kinds that have a fixed
   one at build time - text/button/icon/datetime/theme all size themselves
   from their own content/default instead, so there's no hitbox to test yet
   for those; see findReelTileHit(). */
var REEL_DEFAULT_HIT_SIZE = { box: [160, 100], image: [240, 180], video: [320, 200] };

/* how many blank tiles a freshly-placed reel starts with (see
   addCustomElement()'s "reel" branch) - enough to visibly read as a reel
   without being an unwieldy blank slab a ta has to fill in before it looks
   like anything. */
var REEL_DEFAULT_TILE_COUNT = 4;

/* every kind of "bind a new element into whichever tile it lands on"
   container, checked in this priority order by findBoundTileHit() (first
   match wins - a nested case, e.g. a days tile's attachment rendered via
   the extras tile template, is possible in principle but each element only
   ever needs one owner, and the more specific/innermost selector should
   generally come first). See addBoundElement() for how the owning content
   array is resolved once a tile element is found. */
var BOUND_TILE_SELECTORS = ['[data-reel-tile="1"]', '[data-extras-tile="1"]', '[data-days-tile="1"]'];

/**
 * Finds the tile (reel, attachments, or day - see BOUND_TILE_SELECTORS)
 * that a new element being placed at document (x, y) should bind into
 * instead of landing as an independent page element (see
 * addCustomElement()/addBoundElement()): the drop point itself, OR - for
 * kinds with a known fixed placed size (box/image/video, see
 * REEL_DEFAULT_HIT_SIZE) - the element's own about-to-be-placed hitbox,
 * either one touching a tracked tile's box. Cursor alone is the fallback
 * for every other kind, since text/button/icon/datetime/theme all size
 * themselves from their own content/default rather than a fixed box, so
 * there's nothing to hit-test until after they're already built.
 * @param x drop point left, document px
 * @param y drop point top, document px
 * @param kind the element kind being added
 * @return the hit tile element, or null if neither the cursor nor the
 *   hitbox touches any tracked tile
 */
function findBoundTileHit(x, y, kind) {
  var size = REEL_DEFAULT_HIT_SIZE[kind];
  for (var s = 0; s < BOUND_TILE_SELECTORS.length; s++) {
    var tiles = document.querySelectorAll(BOUND_TILE_SELECTORS[s]);
    for (var i = 0; i < tiles.length; i++) {
      var r = tiles[i].getBoundingClientRect();
      var left = r.left + window.scrollX, top = r.top + window.scrollY;
      var right = left + r.width, bottom = top + r.height;
      if (x >= left && x <= right && y >= top && y <= bottom) return tiles[i];
      if (size) {
        var ex2 = x + size[0], ey2 = y + size[1];
        if (!(x > right || ex2 < left || y > bottom || ey2 < top)) return tiles[i];
      }
    }
  }
  return null;
}

/**
 * Finishes wiring a freshly built custom element identically regardless of
 * whether it landed as a top-level page element (addCustomElement()) or
 * bound into a reel tile (addBoundElement()): text/button fields get
 * click-to-edit wiring, a theme toggle gets its nested label wired and
 * synced to the live theme, and a button's initial link (if any) is applied
 * as a real href.
 * @param el the built, placed element
 * @param d its descriptor (already has final left/top/w/h)
 * @param kind the element kind
 * @param extra the same extra addCustomElement() was called with
 */
function finishAddedElement(el, d, kind, extra) {
  if (kind === "text" || kind === "button") wireTextField(el);
  if (kind === "reel" && window.initReel) {
    /* every other kind is fully live the instant it's built, but a reel's
       drift/hover/loop only starts once js/learn-reel.js clones and wires
       it (initAllReels(), normally run once at page load right after
       renderCustomElements()) - a freshly placed one needs that same call
       made on it directly, or it'd just sit as a static, unclipped row of
       tiles until the next reload. Runs AFTER freezeFreeElement() above has
       already frozen the panel at its pre-clone (4-tile) natural size, so
       the clones added here correctly overflow into that already-frozen
       box instead of growing it, exactly like the migrated reel's own
       explicit w/h does (see _learn_reel_overlay() in app/db.py). */
    window.initReel(el);
  }
  if (kind === "progress") {
    /* paints its real fill width/colors off the two just-defaulted variable
       bindings right away - VARIABLES is already populated from the initial
       page load by the time a ta can interactively add one, so there's no
       need to wait for the next full reload's applyProgressBindings() pass */
    paintProgressElement(el, d);
  }
  if (kind === "theme") {
    /* the button itself only carries data-resize-id; its nested ".tic-label"
       is the actual data-edit-id field, so it needs its own wireTextField()
       call. Also sync its text to the live theme right away, since it was
       just built with a hardcoded "Light mode" default regardless of which
       theme is actually active (see refreshThemeToggles() in js/theme.js). */
    wireTextField(el.querySelector(".tic-label"));
    if (window.refreshThemeToggles) window.refreshThemeToggles();
  }
  /* a button's own initial link (see LINKS/applyOneLink()) is part of its
     creation, not a separately undoable step: undoing the "add" just hides
     the button, href and all, so redoing brings the same link straight back
     with no extra bookkeeping needed here */
  if (kind === "button" && extra.href) {
    applyOneLink(el, extra.href);
    LINKS[d.id] = extra.href;
    saveEditedLink(d.id, extra.href);
    applyLinkHighlight();
  }
}

/**
 * Adds one new element via the visual editor's right-click "Add element"
 * menu (see wireAddElementMenu()): built through buildCustomElement(), the
 * exact same construction that recreates it on every future load, then
 * measured/frozen at its just-rendered size and pushed onto
 * content.custom_elements so it round-trips through Apply/profiles like
 * everything else the editor creates. Always lands on the very top of the
 * stacking order (see moveLayer()), matching what a ta would expect from
 * something they just placed. If (x, y) (or, for box/image/video, the new
 * element's own hitbox) lands on a reel tile, delegates to
 * addBoundElement() instead - see findReelTileHit().
 * @param kind "text", "button", "box", "image", "video", "icon", "datetime",
 *   "theme", or "reel"
 * @param x left, document px (where the menu was opened)
 * @param y top, document px
 * @param extra {icon, url} for kind "icon" (a built-in's svg markup, or an
 *   uploaded one's url), {href} for kind "button", {url} for kind "image"/
 *   "video" (the uploaded file's url, see uploadEditorFile()); "datetime"
 *   takes sensible defaults (countdown, 30 days out) and is configured from
 *   the style popover afterward (see buildStyleMenu()); {orientation} for
 *   kind "reel" ("horizontal" or "vertical")
 * @return the new element
 */
function addCustomElement(kind, x, y, extra) {
  extra = extra || {};
  var uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var d = { id: (kind === "icon" ? "icon.custom." : "custom." + kind + ".") + uid, kind: kind, left: Math.round(x), top: Math.round(y) };
  if (kind === "icon") { d.icon = extra.icon; d.url = extra.url; }
  if (kind === "image" || kind === "video") d.url = extra.url;
  if (kind === "datetime") {
    d.target = extra.target || new Date(Date.now() + 30 * 86400000).toISOString();
    d.format = extra.format || "countdown";
    d.strftime = extra.strftime || "";
  }
  if (kind === "progress") {
    /* binds to the two builtin variables by default (see
       DEFAULT_CONTENT["variables"] in app/db.py); re-bindable afterward from
       the style popover's Current/Total selects, same "sensible defaults,
       configure from the popover after" pattern as datetime just above. */
    d.varCurrent = extra.varCurrent || "days_progressed";
    d.varTotal = extra.varTotal || "total_days";
  }
  if (kind === "reel") {
    d.orientation = extra.orientation === "vertical" ? "vertical" : "horizontal";
    d.tileW = 280;
    d.tileH = 200;
    d.tiles = [];
    for (var ti = 0; ti < REEL_DEFAULT_TILE_COUNT; ti++) {
      d.tiles.push({ id: d.id + ".tile." + ti, children: [] });
    }
  }

  var tileHit = kind === "reel" ? null : findBoundTileHit(x, y, kind);
  if (tileHit) return addBoundElement(tileHit, kind, d, extra);

  var el = buildCustomElement(d);
  freezeFreeElement(el);
  d.w = parseFloat(el.dataset.natW);
  d.h = parseFloat(el.dataset.natH);
  CUSTOM_ELEMENTS.push(d);
  saveCustomElements(CUSTOM_ELEMENTS);
  LAYER_ORDER.push(d.id);
  applyLayerOrder(LAYER_ORDER);
  saveLayerOrder(LAYER_ORDER);
  finishAddedElement(el, d, kind, extra);
  /* undoing an add just hides the new element again (setElementHidden(),
     same "before" state a delete leaves behind), rather than actually
     unbuilding it: the element and its content.custom_elements entry both
     stay around either way, so redo can just unhide it instead of having
     to rebuild it from scratch. */
  EDIT_UNDO.push({ type: "add", id: d.id });
  EDIT_REDO.length = 0;
  return el;
}

/**
 * Resolves which content array actually owns tileEl (see
 * BOUND_TILE_SELECTORS/findBoundTileHit()), so addBoundElement() can push a
 * new bound child onto it and persist it back to the shared snapshot
 * regardless of which kind of tile it is:
 * - a reel tile's owner is its reel entry's own tiles[].children (nested
 *   inside content.custom_elements, see buildReelElement()'s doc comment)
 * - an attachments tile's owner is the matching content.extras[] entry's
 *   own children (js/dashboard.js's EXTRAS, keyed by data-extras-id)
 * - a day tile's owner is the matching content.days[] entry's own children
 *   (js/dashboard.js's DAYS, keyed by data-days-id)
 * Either of the last two only exist as globals on the student dashboard
 * page (js/dashboard.js isn't loaded anywhere else), which is also the only
 * place their tile selectors ever match, so referencing them here is safe.
 * @param tileEl a tile matching one of BOUND_TILE_SELECTORS
 * @return {children, persist()}, or null if no matching owner is found
 */
function findBoundTileOwner(tileEl) {
  var tileId = elId(tileEl);
  if (tileEl.hasAttribute("data-reel-tile")) {
    for (var i = 0; i < CUSTOM_ELEMENTS.length; i++) {
      if (CUSTOM_ELEMENTS[i].kind !== "reel") continue;
      var found = (CUSTOM_ELEMENTS[i].tiles || []).filter(function (t) { return t.id === tileId; })[0];
      if (found) return { children: found.children, persist: function () { saveCustomElements(CUSTOM_ELEMENTS); } };
    }
    return null;
  }
  if (tileEl.hasAttribute("data-extras-tile")) {
    /* an attachments tile renders both as a top-level content.extras[] entry
       AND, using the exact same shared "extras.tile.*" template/markup, as
       one of a day's own files[] (see js/dashboard.js's renderDays()) - so
       the owning entry might live in either array. */
    var eid = tileEl.getAttribute("data-extras-id");
    var eEntry = (window.EXTRAS || []).filter(function (f) { return f && f.id === eid; })[0];
    if (!eEntry) {
      (window.DAYS || []).some(function (day) {
        eEntry = (day.files || []).filter(function (f) { return f && f.id === eid; })[0];
        return !!eEntry;
      });
    }
    if (!eEntry) return null;
    if (!eEntry.children) eEntry.children = [];
    return { children: eEntry.children, persist: function () { saveExtras(window.EXTRAS); saveDays(window.DAYS); } };
  }
  if (tileEl.hasAttribute("data-days-tile")) {
    var did = tileEl.getAttribute("data-days-id");
    var dEntry = (window.DAYS || []).filter(function (dd) { return dd.id === did; })[0];
    if (!dEntry) return null;
    if (!dEntry.children) dEntry.children = [];
    return { children: dEntry.children, persist: function () { saveDays(window.DAYS); } };
  }
  return null;
}

/**
 * The "drop landed on a tracked tile" branch of addCustomElement(): builds
 * the same descriptor via the same buildCustomElementNode(), but appends it
 * into tileEl (see placeInTile()) instead of document.body, and persists it
 * nested inside the owning tile's own children array (see
 * findBoundTileOwner()) instead of as a new top-level content.custom_elements
 * entry - this is what makes bound content travel with its tile (reel
 * scrolling, or an attachments/day tile's shared-template re-render). Falls
 * back to the normal unbound path if no owner can be found for some reason
 * (shouldn't happen - findBoundTileHit() only ever returns a live tracked
 * tile - but a silently dropped element would be a worse failure mode than
 * a stray top-level one).
 * @param tileEl the hit tile DOM node (see findBoundTileHit())
 * @param kind the element kind being added
 * @param d its descriptor, left/top still in page coordinates at this point
 * @param extra see addCustomElement()
 * @return the built, bound (or, on fallback, unbound) element
 */
function addBoundElement(tileEl, kind, d, extra) {
  var owner = findBoundTileOwner(tileEl);

  if (!owner) {
    var fallbackEl = buildCustomElement(d);
    freezeFreeElement(fallbackEl);
    d.w = parseFloat(fallbackEl.dataset.natW);
    d.h = parseFloat(fallbackEl.dataset.natH);
    CUSTOM_ELEMENTS.push(d);
    saveCustomElements(CUSTOM_ELEMENTS);
    LAYER_ORDER.push(d.id);
    applyLayerOrder(LAYER_ORDER);
    saveLayerOrder(LAYER_ORDER);
    finishAddedElement(fallbackEl, d, kind, extra);
    EDIT_UNDO.push({ type: "add", id: d.id });
    EDIT_REDO.length = 0;
    return fallbackEl;
  }

  var tileRect = tileEl.getBoundingClientRect();
  d.left = Math.round(d.left - (tileRect.left + window.scrollX));
  d.top = Math.round(d.top - (tileRect.top + window.scrollY));

  var childEl = buildCustomElementNode(d);
  placeInTile(tileEl, childEl, d.left, d.top);
  freezeFreeElement(childEl);
  d.w = parseFloat(childEl.dataset.natW);
  d.h = parseFloat(childEl.dataset.natH);

  owner.children.push(d);
  owner.persist();
  finishAddedElement(childEl, d, kind, extra);
  EDIT_UNDO.push({ type: "add", id: d.id });
  EDIT_REDO.length = 0;
  return childEl;
}

/**
 * Rebuilds every bound child inside tileEl (see findBoundTileOwner()) from
 * its saved descriptor array, the attachments/day tile equivalent of what
 * buildReelElement() already does for a reel tile's own children on every
 * render. Called by js/dashboard.js's renderExtras()/renderDays() right
 * after a tile's own shared-template pieces (rect/icon/text/button, or the
 * locked/open template) are built, since those functions fully rebuild the
 * tile's innerHTML from scratch on every call - any previously-rendered
 * bound children need rebuilding right along with it. Re-runs the same
 * generic override sweeps (color/size/radius/text/position/hidden) a second
 * time afterward: extras/days tiles render AFTER applySharedEditorOverrides()'s
 * own sweep pass already ran once (see its window.renderExtras hook), so a
 * bound child's own saved style overrides would otherwise never get
 * repainted - those sweeps are plain document-wide queries, safe and cheap
 * to re-run, exactly the same "sweep instead of single match" reasoning
 * mirrorTiledRoleStyle() already relies on for the tile roles themselves.
 * @param tileEl a tile matching one of BOUND_TILE_SELECTORS
 * @param children the tile's own saved children array (may be empty/undefined)
 * @param data the full content blob (for the override maps), or omitted to
 *   skip the repaint pass (eg when children is known to be empty)
 */
function renderTileChildren(tileEl, children, data) {
  tileEl.querySelectorAll(":scope > .free-wrap").forEach(function (w) { w.remove(); });
  (children || []).forEach(function (d) {
    var el = buildCustomElementNode(d);
    placeInTile(tileEl, el, d.left || 0, d.top || 0);
    if (d.w) el.style.width = d.w + "px";
    if (d.h) el.style.height = d.h + "px";
    if ((d.kind === "text" || d.kind === "button") && isPreviewMode() && isEditMode()) wireTextField(el);
    if (d.kind === "progress") paintProgressElement(el, d);
    if (d.kind === "button" && d.id && LINKS[d.id]) applyOneLink(el, LINKS[d.id]);
  });
  if (!children || !children.length || !data) return;
  applyTextOverrides(data.text || {});
  applySizeOverrides(data.sizes);
  applyFontSizeOverrides(data.font_sizes);
  applyTextStyleOverrides(data.text_styles);
  applyPositionOverrides(data.positions);
  applyColorOverrides(data.colors, data.dark_colors);
  applyRadiusOverrides(data.radius);
  applyHiddenOverrides(data.hidden);
}
window.renderTileChildren = renderTileChildren;

/**
 * Drops a saved object (see the right-click "Add element" > "Object"
 * picker, renderCtxMenuObjectPicker()) onto the canvas at (x, y): every part
 * in objData.custom_elements is rebuilt (buildCustomElement(), same
 * construction renderCustomElements() already uses on every load) under a
 * freshly suffixed id (uniqueDupSuffix(), same collision-free scheme
 * duplicateElement() uses to rename a whole subtree at once), offset so the
 * object's own bounding box lands with its top-left at (x, y) regardless of
 * where its parts happened to sit in the object's own mini editor canvas.
 * Every per-id override map the object bundle carries (sizes, positions,
 * colors, ..., even its own internal groupings/stacking order from the
 * mini editor) is remapped onto the new ids and merged into the live
 * snapshot, the same "copy old id's overrides onto the new id" trick
 * copyDuplicateOverrides() already uses for a plain duplicate, just sourced
 * from a separate bundle instead of the same document. Every part not
 * already tied together by one of those internal groupings still ends up
 * in one new all-parts group regardless, so the placed object always moves
 * as a single rigid unit, the whole point of placing one.
 * @param objData the object's stored bundle (an object row's "data")
 * @param x left, document px (where the menu was opened)
 * @param y top, document px
 */
function placeObject(objData, x, y) {
  var parts = (objData.parts || objData.custom_elements || []).slice();
  if (!parts.length) return;
  var minLeft = Math.min.apply(null, parts.map(function (p) { return p.left || 0; }));
  var minTop = Math.min.apply(null, parts.map(function (p) { return p.top || 0; }));
  var dx = x - minLeft, dy = y - minTop;
  var suffix = uniqueDupSuffix();
  var idMap = {};
  parts.forEach(function (p) { idMap[p.id] = p.id + suffix; });

  var raw, snap;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  try { snap = raw ? JSON.parse(raw) : {}; } catch (e) { snap = {}; }

  var newParts = parts.map(function (p) {
    var np = Object.assign({}, p);
    np.id = idMap[p.id];
    np.left = Math.round((p.left || 0) + dx);
    np.top = Math.round((p.top || 0) + dy);
    return np;
  });
  snap.custom_elements = (snap.custom_elements || []).concat(newParts);

  var plainMaps = ["sizes", "positions", "font_sizes", "colors", "opacity", "text", "fill", "tint", "shade", "radius", "border", "links", "text_color", "theme_icons", "dark_colors", "dark_text_color", "dark_fill", "dark_border", "progress_fill", "dark_progress_fill", "progress_track", "dark_progress_track"];
  plainMaps.forEach(function (m) {
    if (!objData[m]) return;
    snap[m] = snap[m] || {};
    Object.keys(objData[m]).forEach(function (oldId) {
      if (idMap[oldId]) snap[m][idMap[oldId]] = objData[m][oldId];
    });
  });
  if (objData.text_styles) {
    snap.text_styles = snap.text_styles || {};
    Object.keys(objData.text_styles).forEach(function (oldId) {
      if (idMap[oldId]) snap.text_styles[idMap[oldId]] = Object.assign({}, objData.text_styles[oldId]);
    });
  }
  ["shadow", "locked"].forEach(function (m) {
    if (!Array.isArray(objData[m])) return;
    snap[m] = snap[m] || [];
    objData[m].forEach(function (oldId) {
      if (idMap[oldId] && snap[m].indexOf(idMap[oldId]) === -1) snap[m].push(idMap[oldId]);
    });
  });

  /* internal groupings made while building the object (eg its own icon
     grouped with its own label) are preserved, remapped onto the new ids */
  snap.groups = snap.groups || [];
  if (Array.isArray(objData.groups)) {
    objData.groups.forEach(function (g) {
      var mapped = g.map(function (oldId) { return idMap[oldId]; }).filter(Boolean);
      if (mapped.length > 1) snap.groups.push(mapped);
    });
  }
  var allNewIds = newParts.map(function (p) { return p.id; });
  /* every part still moves together as one rigid unit regardless of
     whatever finer-grained groupings above, that's the whole point of
     placing a saved object rather than pasting loose parts */
  if (allNewIds.length > 1) snap.groups.push(allNewIds);

  /* land the whole placed object above everything already on the canvas:
     applyLayerOrder() appends any id MISSING from content.layers, in dom
     order, straight after whatever IS explicitly listed there, so a
     "layers" array holding only the new ids (the naive concat this used to
     do) would leave every pre-existing element, never having been
     explicitly listed itself, appended AFTER them instead, on top of the
     object just placed, exactly backwards. Resolving the current full
     effective order first (explicit list + domOrderIds() fallback, the
     same resolution applyLayerOrder() itself does) before appending the
     new ids is what actually guarantees they land last. */
  var fullOrder = (snap.layers || []).slice();
  var haveLayer = {};
  fullOrder.forEach(function (id) { haveLayer[id] = true; });
  domOrderIds().forEach(function (id) { if (!haveLayer[id]) { fullOrder.push(id); haveLayer[id] = true; } });
  var newOrder = Array.isArray(objData.layers) ?
    objData.layers.map(function (oldId) { return idMap[oldId]; }).filter(Boolean) : allNewIds.slice();
  allNewIds.forEach(function (id) { if (newOrder.indexOf(id) === -1) newOrder.push(id); });
  snap.layers = fullOrder.concat(newOrder);

  try { localStorage.setItem(snapshotKey(), JSON.stringify(snap)); } catch (e) {}

  /* only the newly-placed parts need building, everything already on the
     canvas stays exactly as it is: renderCustomElements() rebuilds its
     WHOLE list from scratch, calling it again here would duplicate every
     element already placed earlier this session */
  newParts.forEach(function (p) {
    var el = buildCustomElement(p);
    if (p.kind === "text" || p.kind === "button") wireTextField(el);
    if (p.kind === "theme") wireTextField(el.querySelector(".tic-label"));
  });
  CUSTOM_ELEMENTS = CUSTOM_ELEMENTS.concat(newParts);

  applyTextOverrides(snap.text || {});
  repaintInlineTextColors();
  applyThemeIconOverrides(snap.theme_icons);
  if (window.refreshThemeToggles) window.refreshThemeToggles();
  applySizeOverrides(snap.sizes);
  applyFontSizeOverrides(snap.font_sizes);
  applyTextStyleOverrides(snap.text_styles);
  applyPositionOverrides(snap.positions);
  applyColorOverrides(snap.colors, snap.dark_colors);
  applyFillOverrides(snap.fill, snap.dark_fill);
  applyTextColorOverrides(snap.text_color, snap.dark_text_color);
  applyTintOverrides(snap.tint);
  applyShadeOverrides(snap.shade);
  applyRadiusOverrides(snap.radius);
  applyBorderOverrides(snap.border, snap.dark_border);
  applyShadowOverrides(snap.shadow);
  applyOpacityOverrides(snap.opacity);
  setLockedElements(snap.locked);
  setLinks(snap.links);
  applyGroups(snap.groups);
  applyLayerOrder(snap.layers);
  applyFixedHighlight();
  applyLinkHighlight();
  applyLockHighlight();

  /* mirrors addCustomElement()'s own "add" entry: undo just hides every new
     part again, redo unhides them, the elements and their custom_elements
     entries stay around either way */
  EDIT_UNDO.push({ type: "addmulti", ids: allNewIds });
  EDIT_REDO.length = 0;
}

/* the one floating right-click "Add element" menu, same singleton pattern
   as the ring/text toolbar */
var CTX_MENU = null;
var CTX_POS = { x: 0, y: 0 };

/* the tagged element (if any) that was right-clicked ON to open the menu,
   so renderCtxMenuRoot() can offer a "Promote to navbar"/"Remove from
   navbar" toggle for it, see wireAddElementMenu(). null when the menu was
   opened on empty space. */
var CTX_TARGET_ID = null;
/* the actual DOM node right-clicked (not just its id, which an id like
   "nav.brand" can share with more than one mirrored element): duplicateElement()
   needs the specific node, not just any element carrying that id. */
var CTX_TARGET_EL = null;
/* set by openThemeIconPicker() to repoint the icon-picker sub-view (see
   renderCtxMenuIconPicker()) at "replace this element's icon" instead of its
   normal "add a new icon element" behavior; cleared any time the menu goes
   back to a normal add flow (hideCtxMenu(), renderCtxMenuRoot()) so a later
   "Add element > Icon" click never accidentally overwrites the last theme
   toggle a ta styled. */
var ICON_REPLACE_TARGET = null;

/** Builds the context menu once, lazily. */
function buildCtxMenu() {
  CTX_MENU = document.createElement("div");
  CTX_MENU.className = "ctx-menu";
  document.body.appendChild(CTX_MENU);
}

/**
 * Renders the menu's root list: an optional "This element" section first
 * (only when the menu was opened by right-clicking an existing tagged
 * element, see CTX_TARGET_ID) with Duplicate, Lock/Unlock, and Promote/
 * Remove from navbar, then the 7 things that can be added (an 8th, Reel/
 * Vertical reel, lives inside "Object..." - see renderCtxMenuObjectPicker()).
 * Duplicate is
 * left out for the countdown box/info tiles (ids starting "countdown."/
 * "logistics."), anything containing #heroCountdown/#logisticsGrid (eg the
 * whole logistics section), and any placed "datetime" custom element: all
 * three render their content from their own structured data
 * (content.logistics, the countdown's text overrides, a datetime element's
 * own target/format/strftime) via getElementById()/renderDatetimeContent()
 * rather than static template markup a generic clone can carry over, so a
 * duplicate of one would come out empty (or frozen, un-ticking) the moment
 * it's reconstructed on a reload rather than just visually copied in the
 * moment, see duplicateElement()'s doc comment. A datetime element's own
 * format/pattern/target/style are all edited from the style popover (see
 * buildStyleMenu()), not here.
 */
function renderCtxMenuRoot() {
  var toggleHtml = "";
  if (CTX_TARGET_ID) {
    var targetData = customElementById(CTX_TARGET_ID);
    var isDatetime = targetData && targetData.kind === "datetime";
    /* a reel tile isn't independently duplicable or deletable - only the
       reel panel itself is (see buildReelElement()'s doc comment) - so it
       joins the same "special" bucket logistics/countdown tiles already sit
       in, which already suppresses Duplicate; Delete (new, see below) is
       gated by the same flag */
    var isTile = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-reel-tile");
    /* the download button/icon inside an attachments tile are undeletable
       (see deleteElement()'s data-extras-fixed guard); duplicate is also
       suppressed for EVERY tile role (rect included) since a copy would be
       an orphan outside the shared-template system, see
       buildExtrasTileHtml() in js/dashboard.js */
    var isExtrasFixed = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-extras-fixed");
    var isExtrasRole = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-extras-role");
    var extrasTile = CTX_TARGET_EL && CTX_TARGET_EL.closest && CTX_TARGET_EL.closest("[data-extras-tile]");
    var isDaysFixed = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-days-fixed");
    var isDaysRole = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-days-role");
    var daysTile = CTX_TARGET_EL && CTX_TARGET_EL.closest && CTX_TARGET_EL.closest("[data-days-tile]");
    var isSpecial = isDatetime || isTile || isExtrasFixed || isDaysFixed || CTX_TARGET_ID.indexOf("logistics.") === 0 || CTX_TARGET_ID.indexOf("countdown.") === 0 ||
      (CTX_TARGET_EL && CTX_TARGET_EL.querySelector && CTX_TARGET_EL.querySelector("#heroCountdown, #logisticsGrid"));
    toggleHtml =
      '<div class="ctx-title">This element</div>' +
      ((isSpecial || isExtrasRole || isDaysRole) ? "" : '<button type="button" data-dup="1">Duplicate</button>') +
      (isSpecial ? "" : '<button type="button" data-delete="1">Delete</button>') +
      (extrasTile ? '<button type="button" data-extras-add-filename="1">Create textbox with filename variable</button>' : "") +
      (daysTile ? '<button type="button" data-days-add-number="1">Insert day number</button>' +
        '<button type="button" data-days-add-date="1">Insert unlock date</button>' +
        '<button type="button" data-days-add-locked="1">Insert locked-state text</button>' : "") +
      '<button type="button" data-link-edit="1">' +
      (LINKS[CTX_TARGET_ID] ? "Edit link" : "Add link") +
      '</button>' +
      '<button type="button" data-lock-toggle="1">' +
      (isLocked(CTX_TARGET_ID) ? "Unlock element" : "Lock element") +
      '</button>' +
      '<button type="button" data-fixed-toggle="1">' +
      (isFixed(CTX_TARGET_ID) ? "Remove from navbar" : "Promote to navbar") +
      '</button>' +
      (groupOf(CTX_TARGET_ID) ? '<button type="button" data-ungroup="1">Ungroup</button>' : "");
  }
  if (SELECTED_IDS.length >= 2) {
    toggleHtml += '<div class="ctx-title">Selection</div>' +
      '<button type="button" data-group="1">Group ' + SELECTED_IDS.length + ' elements</button>';
  }
  CTX_MENU.innerHTML =
    toggleHtml +
    '<div class="ctx-title">Add element</div>' +
    '<button type="button" data-add="text">Textbox</button>' +
    '<button type="button" data-add="box">Box</button>' +
    '<button type="button" data-add="image">Image</button>' +
    '<button type="button" data-add="video">Video</button>' +
    '<button type="button" data-add="icon">Icon</button>' +
    '<button type="button" data-add="button">Button</button>' +
    '<button type="button" data-add="datetime">Date/time</button>' +
    '<button type="button" data-add="progress">Progress bar</button>' +
    '<button type="button" data-add="object">Object...</button>';
  CTX_MENU.querySelectorAll("button[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () { handleCtxAdd(btn.getAttribute("data-add")); });
  });
  var dupBtn = CTX_MENU.querySelector("[data-dup]");
  if (dupBtn) {
    dupBtn.addEventListener("click", function () {
      if (CTX_TARGET_EL) duplicateElement(CTX_TARGET_EL);
      hideCtxMenu();
    });
  }
  var deleteBtn = CTX_MENU.querySelector("[data-delete]");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      if (CTX_TARGET_EL) deleteElement(CTX_TARGET_EL);
      hideCtxMenu();
    });
  }
  var extrasFilenameBtn = CTX_MENU.querySelector("[data-extras-add-filename]");
  if (extrasFilenameBtn) {
    extrasFilenameBtn.addEventListener("click", function () {
      var tile = CTX_TARGET_EL && CTX_TARGET_EL.closest && CTX_TARGET_EL.closest("[data-extras-tile]");
      if (tile) insertExtrasFilenameChip(tile);
      hideCtxMenu();
    });
  }
  [["data-days-add-number", "day-number"], ["data-days-add-date", "day-date"], ["data-days-add-locked", "day-locked"]].forEach(function (pair) {
    var btn = CTX_MENU.querySelector("[" + pair[0] + "]");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var tile = CTX_TARGET_EL && CTX_TARGET_EL.closest && CTX_TARGET_EL.closest("[data-days-tile]");
      if (tile) insertDaysChip(tile, pair[1]);
      hideCtxMenu();
    });
  });
  var linkEditBtn = CTX_MENU.querySelector("[data-link-edit]");
  if (linkEditBtn) {
    linkEditBtn.addEventListener("click", function () { renderCtxMenuLinkEditor(); });
  }
  var lockBtn = CTX_MENU.querySelector("[data-lock-toggle]");
  if (lockBtn) {
    lockBtn.addEventListener("click", function () {
      toggleLocked(CTX_TARGET_ID);
      EDIT_UNDO.push({ type: "locked", id: CTX_TARGET_ID });
      EDIT_REDO.length = 0;
      hideCtxMenu();
    });
  }
  var toggleBtn = CTX_MENU.querySelector("[data-fixed-toggle]");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", function () {
      toggleFixed(CTX_TARGET_ID);
      EDIT_UNDO.push({ type: "fixed", id: CTX_TARGET_ID });
      EDIT_REDO.length = 0;
      hideCtxMenu();
    });
  }
  var ungroupBtn = CTX_MENU.querySelector("[data-ungroup]");
  if (ungroupBtn) {
    ungroupBtn.addEventListener("click", function () {
      var g = dissolveGroup(CTX_TARGET_ID);
      if (g) {
        EDIT_UNDO.push({ type: "ungroup", ids: g });
        EDIT_REDO.length = 0;
      }
      hideCtxMenu();
    });
  }
  var groupBtn = CTX_MENU.querySelector("[data-group]");
  if (groupBtn) {
    groupBtn.addEventListener("click", function () {
      var ids = createGroup(SELECTED_IDS);
      EDIT_UNDO.push({ type: "group", ids: ids });
      EDIT_REDO.length = 0;
      clearSelection();
      hideCtxMenu();
    });
  }
}

/**
 * Swaps the menu into its link-editor sub-view (the right-click menu's
 * "Add link"/"Edit link"), for whatever element CTX_TARGET_ID/CTX_TARGET_EL
 * currently point at. Works the same for every element kind: a real `<a>`
 * (a button, the brand link) just gets a real href (see applyOneLink()),
 * anything else gets a click listener that navigates outside the editor.
 * A "Remove link" button only shows once one's actually set, same
 * pattern as the style popover's color/fill reset buttons.
 */
function renderCtxMenuLinkEditor() {
  var id = CTX_TARGET_ID;
  var current = LINKS[id] || "";
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Element link</div>' +
    '<input type="url" class="ctx-link-input" placeholder="https://...">' +
    '<button type="button" class="ctx-link-save">Save</button>' +
    (current ? '<button type="button" class="ctx-link-remove">Remove link</button>' : "");
  var input = CTX_MENU.querySelector(".ctx-link-input");
  input.value = current;
  input.focus();
  function save() {
    setElementLink(id, input.value.trim());
    hideCtxMenu();
  }
  CTX_MENU.querySelector(".ctx-link-save").addEventListener("click", save);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
  });
  var rm = CTX_MENU.querySelector(".ctx-link-remove");
  if (rm) rm.addEventListener("click", function () { setElementLink(id, ""); hideCtxMenu(); });
}

/**
 * Swaps the menu into its icon-picker sub-view: the built-in library (see
 * ICON_LIBRARY) plus whatever custom icons any ta has uploaded (see
 * fetchCustomAssets()), fetched fresh every time this opens so a teammate's
 * just-added icon shows up without a reload. A custom icon shows a small
 * delete "x" only when the current ta is the one who added it (enforced
 * server-side too, never a built-in and never another ta's upload). The
 * file input at the bottom uploads a new one, shared with every ta
 * immediately, same /api/upload + /api/assets round trip as a video/image.
 */
function renderCtxMenuIconPicker() {
  var replacing = !!ICON_REPLACE_TARGET;
  CTX_MENU.innerHTML =
    '<div class="ctx-title">' + (replacing ? "Change icon" : "Choose an icon") + '</div>' +
    '<div class="ctx-icons">' +
      ICON_LIBRARY.map(function (ic, i) {
        return '<button type="button" class="ctx-icon-btn" data-icon="' + i + '" title="' + ic.label + '">' + ic.svg + '</button>';
      }).join("") +
    '</div>' +
    '<div class="ctx-title">Icons your team added</div>' +
    '<div class="ctx-icons ctx-custom-icons"></div>' +
    '<input type="file" class="ctx-file-input" accept=".svg,image/svg+xml">' +
    '<div class="ctx-file-msg">SVG only, so it can be recolored later</div>' +
    '<div class="ctx-file-msg ctx-upload-msg"></div>';
  CTX_MENU.querySelectorAll(".ctx-icon-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ic = ICON_LIBRARY[parseInt(btn.getAttribute("data-icon"), 10)];
      if (replacing) replaceThemeIcon(ICON_REPLACE_TARGET, ic.svg);
      else addCustomElement("icon", CTX_POS.x, CTX_POS.y, { icon: ic.svg });
      hideCtxMenu();
    });
  });

  var customWrap = CTX_MENU.querySelector(".ctx-custom-icons");
  var me = currentTaUsername();
  fetchCustomAssets("icon").then(function (list) {
    CUSTOM_ICONS = list;
    /* the menu may have closed, or been swapped to a different sub-view,
       before this resolved: bail rather than paint into a stale node */
    if (!CTX_MENU.contains(customWrap)) return;
    customWrap.innerHTML = "";
    if (!list.length) {
      customWrap.innerHTML = '<div class="ctx-file-msg">None yet</div>';
      return;
    }
    list.forEach(function (ic) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctx-icon-btn";
      btn.title = ic.name + " (added by " + ic.owner + ")";
      btn.innerHTML = '<img src="' + ic.url + '" alt="">';
      btn.addEventListener("click", function () {
        /* fetch the uploaded file's real svg markup and inline it (same as
           a built-in icon) rather than dropping the url into an <img>, so
           it can be recolored by a future styling tool; falls back to a
           plain <img> if the fetch fails for any reason (eg a legacy
           non-svg upload from before this was enforced) */
        fetchSvgMarkup(ic.url).then(function (svg) {
          if (replacing) replaceThemeIcon(ICON_REPLACE_TARGET, svg || '<img src="' + ic.url + '" alt="">');
          else addCustomElement("icon", CTX_POS.x, CTX_POS.y, svg ? { icon: svg } : { url: ic.url });
          hideCtxMenu();
        });
      });
      if (ic.owner === me) {
        var del = document.createElement("span");
        del.className = "ctx-icon-del";
        del.title = "Remove (you added this)";
        del.textContent = "×";
        del.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
        del.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          deleteCustomAsset("icon", ic.id).then(function () { renderCtxMenuIconPicker(); });
        });
        btn.appendChild(del);
      }
      customWrap.appendChild(btn);
    });
  });

  var input = CTX_MENU.querySelector(".ctx-file-input");
  var msg = CTX_MENU.querySelector(".ctx-upload-msg");
  input.addEventListener("change", function () {
    var file = input.files[0];
    if (!file) return;
    if (file.type !== "image/svg+xml" && !/\.svg$/i.test(file.name)) {
      msg.textContent = "Only .svg files can be added as icons.";
      input.value = "";
      return;
    }
    input.disabled = true;
    msg.textContent = "Uploading...";
    uploadEditorFile(file)
      .then(function (url) { return createCustomAsset("icon", file.name, url); })
      .then(function () { renderCtxMenuIconPicker(); })
      .catch(function () {
        msg.textContent = "Upload failed, try again.";
        input.disabled = false;
      });
  });
}

/**
 * Opens the icon picker (see renderCtxMenuIconPicker()) in "replace" mode,
 * anchored under a theme-toggle's style popover "Change icon" row rather
 * than at a right-click point: picking an icon there calls replaceThemeIcon()
 * on id instead of adding a brand new element. Positioned/clamped the same
 * way showCtxMenu() anchors the right-click menu, just measured off the
 * target element's own box instead of a click point, since there isn't one.
 * @param id the theme-toggle element's id (STYLE_MENU_ID)
 */
function openThemeIconPicker(id) {
  var el = elByAnyId(id);
  if (!el) return;
  if (!CTX_MENU) buildCtxMenu();
  ICON_REPLACE_TARGET = id;
  CTX_TARGET_ID = null;
  CTX_TARGET_EL = null;
  renderCtxMenuIconPicker();
  CTX_MENU.classList.add("show");
  var r = el.getBoundingClientRect();
  var x = r.left + window.scrollX, y = r.bottom + window.scrollY + 6;
  var w = CTX_MENU.offsetWidth, h = CTX_MENU.offsetHeight;
  var maxX = window.scrollX + document.documentElement.clientWidth - w - 6;
  var maxY = window.scrollY + document.documentElement.clientHeight - h - 6;
  CTX_MENU.style.left = Math.max(0, Math.min(x, maxX)) + "px";
  CTX_MENU.style.top = Math.max(0, Math.min(y, maxY)) + "px";
}

/**
 * Re-classes a picked icon's root tag(s) to "tic" before it ever lands in a
 * theme toggle: the picker's own markup (ICON_LIBRARY / a ta's uploaded svg)
 * carries class="cic", the fixed 30x30 accent-colored sizing every
 * standalone content icon on the site uses (see ICON_LIBRARY's own comment),
 * which is wrong here on two counts - too big for the 40px-tall toggle
 * button, and "color: var(--accent)" on the svg itself would override the
 * inherited currentColor stroke, permanently locking the icon's color and
 * defeating the toggle's own (or its ".tic-icon" wrapper's) color control.
 * ".tic" (css/style.css) is the toggle's real sizing/coloring class: fills
 * its ".tic-icon" wrapper (20x20 by default, resizable via the visual
 * editor), no color of its own, so it inherits whichever ancestor's color
 * wins exactly like the default sun/moon pair already does. Works on every
 * direct child (not just the first), since the
 * legacy non-svg fallback path hands this a plain <img> instead of an <svg>.
 * @param markup raw icon markup (one or more root <svg>/<img> tags)
 * @return the same markup with every root tag's class forced to "tic"
 */
function normalizeThemeIconMarkup(markup) {
  var tmp = document.createElement("div");
  tmp.innerHTML = markup;
  Array.prototype.forEach.call(tmp.children, function (node) {
    node.setAttribute("class", "tic");
  });
  return tmp.innerHTML;
}

/**
 * Persists a theme-toggle icon override into the preview snapshot, keyed by
 * the toggle's own id (elId(): data-resize-id for a placed "theme" custom
 * element, or "box.themeBtn" for the nav's own static #themeBtn), same
 * plain per-id map shape content.colors/content.text_color already use
 * (saveEditedColor()). A shared map rather than a custom-element-only field
 * (content.custom_elements[].icon) since the real nav toggle isn't a custom
 * element at all and still needs its icon override to survive a reload.
 * @param id the theme-toggle element's id
 * @param svgMarkup the new icon's markup, or "" to clear back to the
 *   default sun/moon swap
 */
function saveThemeIcon(id, svgMarkup) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.theme_icons || typeof snapshot.theme_icons !== "object") snapshot.theme_icons = {};
  if (!svgMarkup) delete snapshot.theme_icons[id];
  else snapshot.theme_icons[id] = svgMarkup;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Applies saved theme-toggle icon overrides (content.theme_icons, see
 * saveThemeIcon()) on top of every toggle's built-in default sun/moon pair
 * (THEME_ICON_DEFAULT_SVG, baked in by buildCustomElement()/already sitting
 * in templates/index.html's static markup). Runs on every load, live site
 * included, same "second pass on top of built defaults" shape every other
 * override map uses (applyColorOverrides() etc.) - covers the nav's real
 * #themeBtn and every placed "theme" custom element in one pass, both
 * selected the same way js/theme.js's updateIcon() already does. Only the
 * ".tic-icon" wrapper's own innerHTML is replaced, never the button's: that
 * wrapper is its own RESIZABLE_SEL element (data-resize-id = id + ".icon"),
 * so its saved size/position/color overrides (applied elsewhere, same
 * generic passes every other tracked element goes through) survive an icon
 * swap untouched.
 * @param map content.theme_icons, {id: svgMarkup}
 */
function applyThemeIconOverrides(map) {
  map = map || {};
  document.querySelectorAll("[data-theme-toggle], #themeBtn").forEach(function (btn) {
    var v = map[elId(btn)];
    if (!v) return;
    var wrap = btn.querySelector(".tic-icon");
    if (wrap) wrap.innerHTML = v;
  });
}

/**
 * Swaps a theme-toggle's icon (the nav's own static #themeBtn, or a placed
 * "theme" custom element, see buildCustomElement()) for a newly picked one,
 * live in the dom and in content.theme_icons (saveThemeIcon()), so it
 * survives a reload exactly like every other style-popover field. The
 * picked markup is re-classed first (see normalizeThemeIconMarkup()) so it
 * fits and recolors like the toggle's own default icon rather than the
 * standalone-icon picker's fixed look. Only replaces the ".tic-icon"
 * wrapper's own innerHTML (see applyThemeIconOverrides()), so the button's
 * own box and its ".tic-label" text are never touched by an icon swap.
 * @param id the theme-toggle element's id
 * @param svgMarkup the new icon's raw <svg>...</svg> (or <img>) markup
 */
function replaceThemeIcon(id, svgMarkup) {
  var el = elByAnyId(id);
  if (!el || !svgMarkup) return;
  var wrap = el.querySelector(".tic-icon");
  if (!wrap) return;
  var normalized = normalizeThemeIconMarkup(svgMarkup);
  wrap.innerHTML = normalized;
  saveThemeIcon(id, normalized);
}

/**
 * Fetches a url's contents as raw <svg>...</svg> markup, for inlining a
 * ta-uploaded icon the same way a built-in one already is (see
 * buildCustomElement()'s icon branch). Resolves null instead of rejecting
 * on any failure (network error, non-svg content) so a caller can fall back
 * to a plain <img> rather than breaking the "Add element" flow.
 * @param url the uploaded icon's url
 * @return a promise resolving to the svg markup string, or null
 */
function fetchSvgMarkup(url) {
  return fetch(url)
    .then(function (res) { return res.ok ? res.text() : null; })
    .then(function (text) { return text && /<svg[\s>]/i.test(text) ? text : null; })
    .catch(function () { return null; });
}

/**
 * Swaps the menu into its "Add button" sub-view: a link field, wired to a
 * real href the moment the button's created (see addCustomElement()),
 * same right-click "Add link" mechanism every other element uses. Left
 * blank, the button just gets no link yet, editable later the same way
 * any element's link is (right-click > Add link).
 */
function renderCtxMenuButtonLink() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Add button</div>' +
    '<input type="url" class="ctx-link-input" placeholder="Link (optional)">' +
    '<button type="button" class="ctx-link-add">Add</button>';
  var input = CTX_MENU.querySelector(".ctx-link-input");
  input.focus();
  function submit() {
    addCustomElement("button", CTX_POS.x, CTX_POS.y, { href: input.value.trim() });
    hideCtxMenu();
  }
  CTX_MENU.querySelector(".ctx-link-add").addEventListener("click", submit);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  });
}

/**
 * Swaps the menu into its "Add image" sub-view: a real file picker (see
 * uploadEditorFile()), same "choose a file, it uploads immediately" pattern
 * as every other upload input on the site (attachments, gallery, home
 * images), not the earlier flat placeholder box. The menu stays open with a
 * status line during the upload so a slow connection doesn't look broken;
 * closes itself and drops the new image on success.
 */
function renderCtxMenuImagePicker() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Add image</div>' +
    '<input type="file" class="ctx-file-input" accept="image/*">' +
    '<div class="ctx-file-msg"></div>';
  var input = CTX_MENU.querySelector(".ctx-file-input");
  var msg = CTX_MENU.querySelector(".ctx-file-msg");
  input.addEventListener("change", function () {
    var file = input.files[0];
    if (!file) return;
    input.disabled = true;
    msg.textContent = "Uploading...";
    uploadEditorFile(file)
      .then(function (url) {
        addCustomElement("image", CTX_POS.x, CTX_POS.y, { url: url });
        hideCtxMenu();
      })
      .catch(function () {
        msg.textContent = "Upload failed, try again.";
        input.disabled = false;
      });
  });
}

/**
 * Swaps the menu into its "Add video" sub-view: a real file picker, same
 * "choose a file, it uploads immediately" pattern as Image, just pointed at
 * /api/upload with a video accept filter and a wider default box.
 */
function renderCtxMenuVideoPicker() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Add video</div>' +
    '<input type="file" class="ctx-file-input" accept="video/*">' +
    '<div class="ctx-file-msg"></div>';
  var input = CTX_MENU.querySelector(".ctx-file-input");
  var msg = CTX_MENU.querySelector(".ctx-file-msg");
  input.addEventListener("change", function () {
    var file = input.files[0];
    if (!file) return;
    input.disabled = true;
    msg.textContent = "Uploading...";
    uploadEditorFile(file)
      .then(function (url) {
        addCustomElement("video", CTX_POS.x, CTX_POS.y, { url: url });
        hideCtxMenu();
      })
      .catch(function () {
        msg.textContent = "Upload failed, try again.";
        input.disabled = false;
      });
  });
}

/**
 * Swaps the menu into its "Add object" sub-view: two built-in entries (the
 * Light/Dark toggle and the Reel/Vertical reel pair - all three are "for
 * fun" extras rather than everyday building blocks, which is why they sit
 * here instead of cluttering the root list), then every object saved to the
 * shared reusable-objects library (OBJECTS_LIBRARY, fetched fresh on every
 * page load, see fetchContent()/fetchObjectContent()), each rebuilt (see
 * placeObject()) as a group of freshly-idd elements at the point the menu
 * was opened. Built the same page in both the real Visual editor and the
 * object mini editor itself, so an object can be built up out of other,
 * already-saved objects too. A trailing "New object..." button opens a
 * brand new object in its own tab (openNewObjectEditor()); saving it there
 * refreshes OBJECTS_LIBRARY and this picker without a reload, see the
 * "objects_updated" storage listener in wireAddElementMenu().
 */
function renderCtxMenuObjectPicker() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Place an object</div>' +
    '<div class="ctx-objects"></div>' +
    '<button type="button" class="ctx-new-object">New object...</button>';
  var wrap = CTX_MENU.querySelector(".ctx-objects");

  /* the one built-in entry in this list that isn't a ta-saved OBJECTS_LIBRARY
     bundle: a real functional light/dark toggle (buildCustomElement()'s
     "theme" kind), not just a decorative group of shapes, so its name gets
     a small "Live" badge here to signal that up front rather than a ta
     discovering it only after placing it. */
  var builtin = document.createElement("button");
  builtin.type = "button";
  builtin.className = "ctx-obj-builtin";
  builtin.innerHTML = '<span class="ctx-obj-badge">Live</span> Light / Dark mode toggle';
  builtin.addEventListener("click", function () {
    addCustomElement("theme", CTX_POS.x, CTX_POS.y);
    hideCtxMenu();
  });
  wrap.appendChild(builtin);

  /* the other two built-in (not ta-saved) entries in this list: a fresh
     horizontal/vertical reel (buildReelElement()'s "reel" kind), tagged
     "Animated" the same way the toggle above is tagged "Live" - a reel
     starts blank, unlike a saved OBJECTS_LIBRARY bundle, so it's placed
     the same way the toggle is instead of going through placeObject(). */
  [
    { orientation: "horizontal", label: "Reel" },
    { orientation: "vertical", label: "Vertical reel" }
  ].forEach(function (spec) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctx-obj-builtin";
    btn.innerHTML = '<span class="ctx-obj-badge">Animated</span> ' + spec.label;
    btn.addEventListener("click", function () {
      addCustomElement("reel", CTX_POS.x, CTX_POS.y, { orientation: spec.orientation });
      hideCtxMenu();
    });
    wrap.appendChild(btn);
  });

  if (!OBJECTS_LIBRARY.length) {
    var msg = document.createElement("div");
    msg.className = "ctx-file-msg";
    msg.textContent = "No saved objects yet. Build one in the object editor.";
    wrap.appendChild(msg);
  } else {
    OBJECTS_LIBRARY.forEach(function (obj) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = obj.name || "Object";
      btn.addEventListener("click", function () {
        placeObject(obj.data || {}, CTX_POS.x, CTX_POS.y);
        hideCtxMenu();
      });
      wrap.appendChild(btn);
    });
  }
  CTX_MENU.querySelector(".ctx-new-object").addEventListener("click", function () {
    openNewObjectEditor();
    hideCtxMenu();
  });
}

/**
 * Handles a click on one of the root menu's 8 options: textbox/box add
 * immediately and close the menu, icon/button/image/video/datetime/object
 * swap to a picker/link/file sub-view first.
 * @param kind "text", "box", "image", "video", "icon", "button", "datetime", or "object"
 */
function handleCtxAdd(kind) {
  if (kind === "icon") { renderCtxMenuIconPicker(); return; }
  if (kind === "button") { renderCtxMenuButtonLink(); return; }
  if (kind === "image") { renderCtxMenuImagePicker(); return; }
  if (kind === "video") { renderCtxMenuVideoPicker(); return; }
  if (kind === "object") { renderCtxMenuObjectPicker(); return; }
  /* datetime adds immediately with sensible defaults (countdown, 30 days
     out, see addCustomElement()); its format/pattern/target are all set
     afterward from the style popover, no add-time sub-view needed */
  addCustomElement(kind, CTX_POS.x, CTX_POS.y);
  hideCtxMenu();
}

/**
 * Shows the "Add element" menu at (x, y), resetting it back to the root
 * list even if it was left mid sub-view from a previous open. Clamped to
 * stay inside the viewport so a right-click near an edge doesn't render
 * the menu partly off-screen.
 * @param x left, document px
 * @param y top, document px
 * @param targetId the right-clicked element's id (see CTX_TARGET_ID), or
 *   null if the click landed on empty space
 * @param targetEl the actual right-clicked element (see CTX_TARGET_EL), or
 *   null if the click landed on empty space
 */
function showCtxMenu(x, y, targetId, targetEl) {
  if (!CTX_MENU) buildCtxMenu();
  CTX_POS = { x: x, y: y };
  CTX_TARGET_ID = targetId || null;
  CTX_TARGET_EL = targetEl || null;
  ICON_REPLACE_TARGET = null;
  renderCtxMenuRoot();
  CTX_MENU.classList.add("show");
  var w = CTX_MENU.offsetWidth, h = CTX_MENU.offsetHeight;
  var maxX = window.scrollX + document.documentElement.clientWidth - w - 6;
  var maxY = window.scrollY + document.documentElement.clientHeight - h - 6;
  CTX_MENU.style.left = Math.max(0, Math.min(x, maxX)) + "px";
  CTX_MENU.style.top = Math.max(0, Math.min(y, maxY)) + "px";
}

/** Hides the "Add element" menu. */
function hideCtxMenu() {
  if (CTX_MENU) CTX_MENU.classList.remove("show");
  ICON_REPLACE_TARGET = null;
}

/**
 * Wires up the right-click "Add element" menu, only called in the ta
 * portal's Visual editor tab alongside wireResizable()/wireClickToEdit().
 * Replaces the browser's own context menu everywhere in the editor. Also
 * owns the outside-click/Escape dismissal for the ring's layer-order popover
 * (see toggleLayerMenu() in wireResizable()), since both are the same kind
 * of floating menu and only ever exist together in this tab.
 */
function wireAddElementMenu() {
  document.addEventListener("contextmenu", function (e) {
    /* mid-edit, leave the browser's own menu alone so right-click paste/
       spellcheck still works while actually typing */
    if (e.target.closest && e.target.closest("[contenteditable='true']")) return;
    e.preventDefault();
    var t = resolveSelectableTarget(e.target);
    showCtxMenu(e.pageX, e.pageY, t ? elId(t) : null, t);
  });
  /* mousedown (not click) so this runs and reads e.target BEFORE a menu
     button's own click handler gets a chance to rewrite CTX_MENU's
     children (eg swapping to the icon-picker sub-view), which would
     otherwise make a stale e.target read as "outside" the menu on the
     click that follows and close it out from under itself */
  document.addEventListener("mousedown", function (e) {
    if (CTX_MENU && CTX_MENU.classList.contains("show") && !CTX_MENU.contains(e.target)) hideCtxMenu();
    /* the layer button itself is excluded too: it has its own click handler
       that toggles the menu, a mousedown here closing it first would just
       have that click immediately reopen it */
    if (LAYER_MENU && LAYER_MENU.classList.contains("show") &&
        !LAYER_MENU.contains(e.target) && e.target !== LAYER_BTN) hideLayerMenu();
    /* same reasoning as the layer button above, the style button toggles
       its own popover on click */
    if (STYLE_MENU && STYLE_MENU.classList.contains("show") &&
        !STYLE_MENU.contains(e.target) && e.target !== STYLE_BTN) hideStyleMenu();
    /* the fx button toggles its own menu open via its click handler same as
       the style/layer buttons above, but there's no dedicated "fx button"
       element to exclude by identity (it lives inside TEXT_TOOLBAR, rebuilt
       once): excluding by "not already showing" is enough since a fresh
       open always starts from FX_MENU not yet visible. */
    if (FX_MENU && FX_MENU.classList.contains("show") && !FX_MENU.contains(e.target)) closeFormulaMenu();
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (CTX_MENU && CTX_MENU.classList.contains("show")) hideCtxMenu();
    if (LAYER_MENU && LAYER_MENU.classList.contains("show")) hideLayerMenu();
    if (STYLE_MENU && STYLE_MENU.classList.contains("show")) hideStyleMenu();
    if (FX_MENU && FX_MENU.classList.contains("show")) closeFormulaMenu();
    if (SELECTED_IDS.length) clearSelection();
  });
  /* object-editor.js's saveObject() stamps this key after a successful save
     (a plain value, its content doesn't matter, only the change itself
     does); the "storage" event only ever fires in OTHER same-origin tabs,
     never the one that made the write, which is exactly what's wanted here,
     the object editor tab notifying this one. Re-fetches the library so a
     freshly-saved object is placeable right away, and re-renders the
     picker sub-view immediately too if it's what's currently showing,
     rather than making the ta close and reopen the menu to see it. */
  window.addEventListener("storage", function (e) {
    if (e.key !== "objects_updated") return;
    fetchObjectsLibrary().then(function (list) {
      OBJECTS_LIBRARY = list;
      if (CTX_MENU && CTX_MENU.classList.contains("show") && CTX_MENU.querySelector(".ctx-objects")) {
        renderCtxMenuObjectPicker();
      }
    });
  });
}

/* set for one tick after a body-drag move ends, so the click that the
   browser fires right after mouseup doesn't also open a text edit */
var JUST_DRAGGED = false;

/**
 * Sets up the visual editor's shared selection ring: clicking any tagged
 * element (text field, image, icon, card, nav, section, footer, button,
 * day row, tile, anything carrying a data-edit-id or data-resize-id)
 * attaches the ring to it, and the ring stays there (sticky selection)
 * until a different tracked element is clicked or empty space clears it,
 * regardless of what the mouse hovers over in between. This matters once
 * an element ends up behind another one (moved there, or just naturally
 * stacked that way): a plain click-drag on its own body can only ever
 * reach whichever element is topmost at that pixel, but the ring's own
 * move handle floats above everything, so a selected-but-covered element
 * can still be dragged by it as long as it hasn't been deselected. Buttons
 * are single tagged elements, so their text box IS the button itself;
 * every other text field is its own box, fully independent of whatever
 * container it sits in. Moving doesn't need the handle: dragging anywhere
 * on the element itself moves it too, with a small threshold so a plain
 * click still clicks (and still opens a text edit). Only called in the ta
 * portal's Visual editor tab alongside wireClickToEdit().
 */
function wireResizable() {
  buildRing();
  window.addEventListener("scroll", positionRing, true);
  window.addEventListener("resize", positionRing);

  /* drag-anywhere move, delegated so it covers rerendered content too */
  document.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    if (RING.contains(e.target)) return;
    var el = resolveSelectableTarget(e.target);
    if (!el) {
      /* clicked away from every tracked element: clear the sticky selection,
         unless the click actually landed in one of the selected element's
         own floating popovers (layer/style menus, the right-click add-
         element menu, the rich text toolbar) - those aren't part of the
         page content but still count as "still using the selection" */
      if ((!LAYER_MENU || !LAYER_MENU.contains(e.target)) &&
          (!STYLE_MENU || !STYLE_MENU.contains(e.target)) &&
          (!CTX_MENU || !CTX_MENU.contains(e.target)) &&
          (!TEXT_TOOLBAR || !TEXT_TOOLBAR.contains(e.target)) &&
          (!FX_MENU || !FX_MENU.contains(e.target))) {
        RING_EL = null;
        RING.style.display = "none";
      }
      return;
    }
    /* mid-edit: leave the mouse to text selection/caret placement */
    if (el.isContentEditable) return;
    /* a reel tile is selectable (so its style popover is reachable) but
       can't move, resize, delete, or be shift-selected into a group -
       any of those would detachFromFlow() it out of the flex track it
       lives in (see buildReelElement()) - so it's selected and left at
       that, skipping the shift-click/drag-start logic below entirely */
    if (el.hasAttribute("data-reel-tile")) {
      RING_EL = el;
      positionRing();
      return;
    }
    /* shift-click toggles group-selection instead of starting a drag (see
       toggleSelected()); a data-edit-id text field's own click handler
       already does the same thing, this covers everything else (images,
       icons, boxes, sections) that only ever goes through THIS handler */
    if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); toggleSelected(elId(el)); return; }

    /* a click always selects the element it landed on, and that selection
       sticks regardless of what the mouse hovers over afterward (see
       wireResizable()'s doc comment): this is what lets an element that
       ends up behind another still be grabbed by its own move handle */
    RING_EL = el;
    positionRing();

    /* locked: don't even start tracking a possible drag, see isLocked() */
    if (isLocked(elId(el))) return;

    var startX = e.clientX, startY = e.clientY;
    var base = getPos(el);
    var moving = false;
    /* other members of el's group (see groupOf()), each moved by the exact
       same delta as el so the group drags as one rigid unit; locked members
       are left out, same rule a direct drag on them would already follow */
    var groupMembers = groupMembersFor(elId(el));

    function onMove(ev) {
      if (!moving) {
        /* not a drag until the cursor actually travels */
        if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
        moving = true;
        RING_DRAGGING = true;
        RING_EL = el;
        document.body.style.userSelect = "none";
        /* naturally-inline elements (a plain <span>, eg. the hero title
           text) ignore `transform` per spec until blockified, see
           startMoveDrag()'s doc comment. Every member's rect is grabbed
           before ANY of them detaches, see detachFromFlow()'s knownRect
           param and startMoveDrag()'s own doc comment on why order matters
           here. */
        var elRect = el.getBoundingClientRect();
        groupMembers.forEach(function (m) { m.preRect = m.el.getBoundingClientRect(); });
        detachFromFlow(el, elRect);
        groupMembers.forEach(function (m) { detachFromFlow(m.el, m.preRect); });
      }
      ev.preventDefault();
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      setOwnPos(el, base.tx + dx, base.ty + dy);
      groupMembers.forEach(function (m) { setOwnPos(m.el, m.base.tx + dx, m.base.ty + dy); });
      positionRing();
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (!moving) return; /* plain click, let it click/edit as normal */
      RING_DRAGGING = false;
      document.body.style.userSelect = "";
      JUST_DRAGGED = true;
      setTimeout(function () { JUST_DRAGGED = false; }, 0);
      var p = getPos(el);
      commitPosition(el);
      var moves = [{ id: elId(el), before: base, after: p }];
      groupMembers.forEach(function (m) {
        var mp = getPos(m.el);
        commitPosition(m.el);
        moves.push({ id: m.id, before: m.base, after: mp });
      });
      pushGroupMoveUndo(moves);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  /* the click the browser fires after a drag's mouseup must not open a
     text edit or follow a link */
  document.addEventListener("click", function (e) {
    if (JUST_DRAGGED) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* stop the browser's own image/link drag from hijacking a body-drag */
  document.addEventListener("dragstart", function (e) {
    var t = e.target.closest ? e.target.closest(RESIZABLE_SEL) : null;
    if (t) e.preventDefault();
  });

  /* Delete/Backspace deletes whatever the ring is currently on, unless a
     text field is mid-edit (contentEditable) or focus is sitting in a real
     form control (eg the "Add element" menu's link input), where the key
     should just type/edit as normal */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (!RING_EL) return;
    var active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    e.preventDefault();
    deleteElement(RING_EL);
  });

  /* Arrow keys nudge whatever the ring is currently on, 1px a press, 10px
     with shift held, for lining something up more precisely than a mouse
     drag can manage. Same guards as Delete/Backspace above (a locked
     element can't be nudged either, same rule a drag already follows, see
     startMoveDrag()), plus its own one-entry-per-press undo step since
     each press is already its own discrete action, not a drag gesture. */
  var ARROW_DELTAS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  document.addEventListener("keydown", function (e) {
    var d = ARROW_DELTAS[e.key];
    if (!d) return;
    if (!RING_EL || isLocked(elId(RING_EL)) || RING_EL.hasAttribute("data-reel-tile") || RING_EL.hasAttribute("data-extras-role") || RING_EL.hasAttribute("data-days-role")) return;
    var active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    e.preventDefault();
    var el = RING_EL;
    var step = e.shiftKey ? 10 : 1;
    /* every group member's rect is grabbed before ANY of them detaches, see
       detachFromFlow()'s knownRect param and startMoveDrag()'s doc comment
       on why the order matters for elements sharing one flow */
    var members = groupMembersFor(elId(el));
    var elRect = el.getBoundingClientRect();
    members.forEach(function (m) { m.preRect = m.el.getBoundingClientRect(); });
    detachFromFlow(el, elRect);
    var before = getPos(el);
    var after = { tx: before.tx + d[0] * step, ty: before.ty + d[1] * step };
    setOwnPos(el, after.tx, after.ty);
    positionRing();
    commitPosition(el);
    var moves = [{ id: elId(el), before: before, after: after }];
    members.forEach(function (m) {
      detachFromFlow(m.el, m.preRect);
      var mAfter = { tx: m.base.tx + d[0] * step, ty: m.base.ty + d[1] * step };
      setOwnPos(m.el, mAfter.tx, mAfter.ty);
      commitPosition(m.el);
      moves.push({ id: m.id, before: m.base, after: mAfter });
    });
    pushGroupMoveUndo(moves);
  });
}

/* the one floating text toolbar, shared by every text field, shown above
   whichever one is being edited. font/align/letter-spacing/size act on the
   whole field (real character size and spacing, never tied to the field's
   box: resizing the box only changes how the text flows); bold/italic/
   underline act on whatever's selected inside it, same as any contenteditable
   rich-text box (document.execCommand, still the pragmatic way to do this
   without a full editor library). */
var TEXT_TOOLBAR = null;
var TEXT_TOOLBAR_EL = null;

/* a small curated set rather than every Google Font under the sun: the
   first three are the site's own fonts, referenced by css variable (see
   :root in css/style.css) rather than hardcoded names so this list never
   names a specific typeface that could go stale, whichever fonts those
   variables actually point to is whatever shows up and gets used here. the
   rest are common system fonts that need no extra network request and
   render everywhere, keeping the "one student, one week, no build step"
   feel instead of turning into a font-picker megabundle. */
var TEXT_FONTS = [
  { label: "Default", value: "" },
  { label: "Heading", value: "var(--font-head)" },
  { label: "Body", value: "var(--font-body)" },
  { label: "Monospace", value: "var(--font-mono)" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', serif" },
  { label: "Courier New", value: "'Courier New', monospace" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" }
];

/**
 * The generated css font-family name a ta-uploaded font (see CUSTOM_FONTS)
 * is referenced by, both in the toolbar's select and in a saved
 * content.text_styles[id].fontFamily. Just the asset's own id, so it's
 * always unique and never collides with a built-in TEXT_FONTS value.
 * @param id the custom font asset's id
 * @return the css font-family name
 */
function customFontFamily(id) {
  return "cf" + id;
}

/* family names already given an @font-face declaration this page load, so
   re-selecting or re-applying the same font never injects a duplicate
   <style> tag, see ensureFontFace(). */
var INJECTED_FONTS = {};

/**
 * Declares an @font-face rule for a ta-uploaded font so `font-family: name`
 * actually renders it, injected straight into <head>: unlike an icon/video/
 * image (which just need their url dropped into a src/href), a font needs a
 * page-wide declaration before any element can reference it by name. Runs
 * both in the editor (as soon as a font's picked or uploaded) and on every
 * ordinary page load (applyTextStyleOverrides(), live site included) since
 * a real visitor's browser needs the same declaration to render text a ta
 * styled with it, not just the ta's own portal tab.
 * @param family the css font-family name (see customFontFamily())
 * @param url the uploaded font file's url
 */
function ensureFontFace(family, url) {
  if (INJECTED_FONTS[family]) return;
  INJECTED_FONTS[family] = true;
  var style = document.createElement("style");
  style.textContent = '@font-face { font-family: "' + family + '"; src: url("' + url + '"); font-display: swap; }';
  document.head.appendChild(style);
}

/* single-color inline svgs for the 4 align buttons, same convention as
   every other icon on the site (no emoji/unicode glyphs) */
var ALIGN_ICONS = {
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>',
  center: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>',
  justify: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
    '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>'
};

/**
 * Applies a foreColor pick from the floating toolbar's ".tt-color" swatch to
 * the current selection inside fieldEl, then tags whichever span(s) now
 * carry that exact color as belonging to the theme that's active right now
 * (data-light-color / data-dark-color, read back by repaintInlineTextColors()
 * on every load and theme flip - same independent-per-theme-value model as
 * the style popover's Color row, see resolveThemedColor()). There's no
 * separate "edit the other theme's color" toggle here the way the popover
 * has one: a ta gets that by flipping the site's own theme button (already
 * live-visible while editing) and picking a different color for the same
 * selection, which is the exact workflow the popover's own design already
 * settled on for "whatever's showing is whichever mode you're in".
 *
 * Re-tags by color VALUE, not by node identity: execCommand("foreColor") is
 * free to split/merge/replace the spans under the selection however the
 * browser sees fit, so there's no reliable "the node(s) I just touched" to
 * diff against. Walking the whole field afterward and tagging every element
 * whose live style.color now equals the just-picked hex is equivalent and
 * doesn't need that tracking: any span currently showing exactly that color,
 * however it got there, IS that theme's color for that span. A field is
 * always small (a heading, a paragraph), so re-scanning it on every pick is
 * cheap.
 *
 * Runs execCommand unconditionally even when forDark names the theme that
 * ISN'T currently showing (the toolbar's secondary ".tt-color-dark" input,
 * see buildTextToolbar()): that's the only way to get a concrete span to tag
 * for an arbitrary selection (see the note above on why this can't diff
 * against "before"), so the not-currently-active color briefly paints, then
 * repaintInlineTextColors() immediately corrects the visible result back to
 * whatever the CURRENTLY active theme's value resolves to - which is a no-op
 * repaint if that side's value didn't just change, exactly like editing a
 * hidden secondary swatch in the style popover doesn't repaint the element
 * either.
 * @param fieldEl the contenteditable text field being edited
 * @param hex the "#rrggbb" just picked from a color input
 * @param forDark which theme this pick is for; defaults to whichever theme
 *   is actually active right now (the primary ".tt-color" input's case)
 */
function applyThemedForeColor(fieldEl, hex, forDark) {
  var dark = forDark === undefined ? isDarkThemeActive() : forDark;
  document.execCommand("styleWithCSS", false, true);
  document.execCommand("foreColor", false, hex);
  fieldEl.querySelectorAll("[style*='color']").forEach(function (span) {
    if (rgbToHex(span.style.color) !== hex.toLowerCase()) return;
    if (dark) span.dataset.darkColor = hex;
    else span.dataset.lightColor = hex;
  });
  repaintInlineTextColors();
}

/**
 * Finds the data-light-color/data-dark-color span (see
 * applyThemedForeColor()) touching the current selection inside fieldEl, so
 * the toolbar's secondary color input can prefill with that span's explicit
 * other-theme value instead of just a blind autoDarkVariant() guess. Two
 * cases, since a tagged span can sit on either side of the selection's
 * common ancestor:
 *  - selection collapsed/inside the span (typical click-then-pick): walk UP
 *    from the common ancestor, same "closest tagged ancestor" idea as
 *    colorTarget()'s own data-edit-id walk.
 *  - selection wraps the whole span from outside it (typical of this
 *    editor's own click-to-edit, which auto-selects a field's ENTIRE
 *    contents on open, see wireTextField()'s click handler - if that's the
 *    field's one and only colored span, the common ancestor is the field
 *    itself, an ancestor of the tagged span, not the span or a descendant of
 *    it): fall back to checking whether exactly one tagged descendant is
 *    intersected by the range.
 * A selection spanning several differently-tagged spans resolves to
 * whichever one the selection starts in (first case) or null (second case,
 * ambiguous), an approximation fine for priming a swatch, not for
 * correctness (the actual color pick always re-tags whatever's really
 * selected, see applyThemedForeColor()).
 * @param fieldEl the contenteditable text field being edited
 * @return the tagged span element, or null if the selection isn't inside one
 */
function selectionColorSpan(fieldEl) {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var range = sel.getRangeAt(0);
  var container = range.commonAncestorContainer;
  if (container.nodeType === 3) container = container.parentElement;
  var node = container;
  while (node && node !== fieldEl.parentElement) {
    if (node.dataset && (node.dataset.lightColor || node.dataset.darkColor)) return node;
    node = node.parentElement;
  }
  if (container.querySelectorAll) {
    var tagged = container.querySelectorAll("[data-light-color], [data-dark-color]");
    if (tagged.length === 1 && range.intersectsNode(tagged[0])) return tagged[0];
  }
  return null;
}

/**
 * Builds the floating text toolbar once, lazily, same singleton pattern as
 * the selection ring. Every button's mousedown is swallowed (preventDefault
 * + stopPropagation) before it can steal focus (and the field's selection
 * along with it) away from the field being edited, same trick the old A-/A+
 * pair already used; the font <select> can't have its mousedown prevented
 * without breaking the native dropdown, so its blur is special-cased instead
 * (see wireClickToEdit()'s blur handler).
 */
function buildTextToolbar() {
  TEXT_TOOLBAR = document.createElement("span");
  TEXT_TOOLBAR.className = "text-toolbar";
  TEXT_TOOLBAR.innerHTML =
    '<select class="tt-font" title="Font">' +
      TEXT_FONTS.map(function (f) { return '<option value="' + f.value + '">' + f.label + '</option>'; }).join("") +
    '</select>' +
    '<button type="button" class="tt-font-add" title="Upload a font, shared with your whole team">+</button>' +
    '<button type="button" class="tt-font-del" title="Remove this font (you added it)" style="display:none">×</button>' +
    '<input type="file" class="tt-font-file" accept=".woff,.woff2,.ttf,.otf" style="display:none">' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="fs-dn" title="Smaller text">A-</button>' +
    '<button type="button" class="fs-up" title="Larger text">A+</button>' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="tt-bold" title="Bold"><b>B</b></button>' +
    '<button type="button" class="tt-italic" title="Italic"><i>I</i></button>' +
    '<button type="button" class="tt-underline" title="Underline"><u>U</u></button>' +
    '<input type="color" class="tt-color" title="Text color (selection)">' +
    '<button type="button" class="tt-color-dark-toggle" title="Edit other mode\'s text color">🌙</button>' +
    '<input type="color" class="tt-color-dark" title="Text color (selection), other mode" style="display:none">' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="tt-align" data-align="left" title="Align left">' + ALIGN_ICONS.left + '</button>' +
    '<button type="button" class="tt-align" data-align="center" title="Align center">' + ALIGN_ICONS.center + '</button>' +
    '<button type="button" class="tt-align" data-align="right" title="Align right">' + ALIGN_ICONS.right + '</button>' +
    '<button type="button" class="tt-align" data-align="justify" title="Justify">' + ALIGN_ICONS.justify + '</button>' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="ls-dn" title="Tighter letter spacing">Sp-</button>' +
    '<button type="button" class="ls-up" title="Wider letter spacing">Sp+</button>' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="tt-fx" title="Insert a live value from a variable">ƒx</button>';
  document.body.appendChild(TEXT_TOOLBAR);

  TEXT_TOOLBAR.querySelectorAll("button").forEach(function (btn) {
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  });
  /* the select needs its own mousedown to open (preventDefault would block
     that), just stop it reaching the drag-anywhere handler underneath */
  TEXT_TOOLBAR.querySelector(".tt-font").addEventListener("mousedown", function (e) { e.stopPropagation(); });

  ["fs-dn", "fs-up"].forEach(function (cls) {
    TEXT_TOOLBAR.querySelector("." + cls).addEventListener("click", function () {
      if (!TEXT_TOOLBAR_EL) return;
      var el = TEXT_TOOLBAR_EL;
      var id = el.getAttribute("data-edit-id");
      var before = el.style.fontSize || "";
      var cur = parseFloat(getComputedStyle(el).fontSize) || 16;
      var next = Math.max(8, Math.min(120, Math.round(cur + (cls === "fs-dn" ? -2 : 2))));
      var after = next + "px";
      el.style.fontSize = after;
      saveFontSize(id, after);
      EDIT_UNDO.push({ type: "fontsize", id: id, before: before, after: after });
      EDIT_REDO.length = 0;
      positionRing();
    });
  });

  [["tt-bold", "bold"], ["tt-italic", "italic"], ["tt-underline", "underline"]].forEach(function (pair) {
    TEXT_TOOLBAR.querySelector("." + pair[0]).addEventListener("click", function () {
      document.execCommand(pair[1]);
      updateTextToolbarState();
    });
  });

  /* a native <input type=color> can't have its mousedown swallowed without
     breaking the picker itself, same reason the font <select> doesn't
     either (see below): it needs to actually take focus to open. The
     field's own blur handler already treats any focus landing inside
     TEXT_TOOLBAR as "don't end the edit", so no extra plumbing is needed
     to keep the edit alive while the picker's open. */
  /* both swatches guard against a real <input type=color> footgun: opening
     the native picker and confirming it (eg clicking its own "OK") fires
     "input"/"change" even if the user never actually moved off the value it
     was pre-filled with - which for the secondary swatch is very often just
     an autoDarkVariant() SUGGESTION, never confirmed by a real ta edit. Left
     unguarded, a ta merely opening the toggle to see what the other theme
     would look like (see the toggle button below) and clicking away would
     silently bake that guess in as a permanent override. dataset.baseline
     tracks the value as of the last prime (updateTextToolbarState()) or the
     last real commit, so only an actual change past that point counts. */
  var colorInput = TEXT_TOOLBAR.querySelector(".tt-color");
  colorInput.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  colorInput.addEventListener("input", function () {
    if (colorInput.value === colorInput.dataset.baseline) return;
    colorInput.dataset.baseline = colorInput.value;
    if (TEXT_TOOLBAR_EL) applyThemedForeColor(TEXT_TOOLBAR_EL, colorInput.value);
  });
  colorInput.addEventListener("change", function () {
    if (TEXT_TOOLBAR_EL) TEXT_TOOLBAR_EL.focus();
  });

  /* the secondary swatch always edits whichever theme ISN'T currently
     showing, same "primary tracks live theme, secondary is the other one"
     split as the style popover's own rows (see primeThemedColorRow()) -
     just scoped to a text selection instead of a whole element. */
  var colorDarkInput = TEXT_TOOLBAR.querySelector(".tt-color-dark");
  var colorDarkToggle = TEXT_TOOLBAR.querySelector(".tt-color-dark-toggle");
  colorDarkInput.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  colorDarkInput.addEventListener("input", function () {
    if (colorDarkInput.value === colorDarkInput.dataset.baseline) return;
    colorDarkInput.dataset.baseline = colorDarkInput.value;
    if (TEXT_TOOLBAR_EL) applyThemedForeColor(TEXT_TOOLBAR_EL, colorDarkInput.value, !isDarkThemeActive());
  });
  colorDarkInput.addEventListener("change", function () {
    if (TEXT_TOOLBAR_EL) TEXT_TOOLBAR_EL.focus();
  });
  colorDarkToggle.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  colorDarkToggle.addEventListener("click", function () {
    colorDarkInput.style.display = colorDarkInput.style.display === "none" ? "" : "none";
  });

  TEXT_TOOLBAR.querySelectorAll(".tt-align").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!TEXT_TOOLBAR_EL) return;
      var el = TEXT_TOOLBAR_EL;
      var id = el.getAttribute("data-edit-id");
      var align = btn.getAttribute("data-align");
      var before = el.style.textAlign || "";
      /* clicking the already-active alignment turns it back off (back to
         the template's own default), same toggle feel as everything else
         in this editor rather than a one-way ratchet */
      var next = before === align ? "" : align;
      el.style.textAlign = next;
      saveTextStyle(id, "align", next);
      EDIT_UNDO.push({ type: "align", id: id, before: before, after: next });
      EDIT_REDO.length = 0;
      updateTextToolbarState();
    });
  });

  ["ls-dn", "ls-up"].forEach(function (cls) {
    TEXT_TOOLBAR.querySelector("." + cls).addEventListener("click", function () {
      if (!TEXT_TOOLBAR_EL) return;
      var el = TEXT_TOOLBAR_EL;
      var id = el.getAttribute("data-edit-id");
      var before = el.style.letterSpacing || "";
      var cur = parseFloat(getComputedStyle(el).letterSpacing) || 0;
      var next = Math.max(-2, Math.min(8, Math.round((cur + (cls === "ls-dn" ? -0.5 : 0.5)) * 10) / 10));
      var val = next === 0 ? "" : next + "px";
      el.style.letterSpacing = val;
      saveTextStyle(id, "letterSpacing", val);
      EDIT_UNDO.push({ type: "letterspacing", id: id, before: before, after: val });
      EDIT_REDO.length = 0;
    });
  });

  TEXT_TOOLBAR.querySelector(".tt-fx").addEventListener("click", function () {
    if (!TEXT_TOOLBAR_EL || this.disabled) return;
    openFormulaMenu(TEXT_TOOLBAR_EL, null);
  });

  TEXT_TOOLBAR.querySelector(".tt-font").addEventListener("change", function () {
    if (!TEXT_TOOLBAR_EL) return;
    var el = TEXT_TOOLBAR_EL;
    var id = el.getAttribute("data-edit-id");
    var beforeFamily = el.style.fontFamily || "";
    var beforeCustom = CUSTOM_FONTS.filter(function (f) { return customFontFamily(f.id) === beforeFamily; })[0];
    var before = { family: beforeFamily, url: beforeCustom ? beforeCustom.url : "" };
    var val = this.value;
    var custom = CUSTOM_FONTS.filter(function (f) { return customFontFamily(f.id) === val; })[0];
    if (custom) ensureFontFace(val, custom.url);
    el.style.fontFamily = val;
    saveFontFamily(id, val, custom ? custom.url : "");
    EDIT_UNDO.push({ type: "fontfamily", id: id, before: before, after: { family: val, url: custom ? custom.url : "" } });
    EDIT_REDO.length = 0;
    updateFontDeleteButton();
    el.focus();
  });

  TEXT_TOOLBAR.querySelector(".tt-font-add").addEventListener("click", function () {
    TEXT_TOOLBAR.querySelector(".tt-font-file").click();
  });

  TEXT_TOOLBAR.querySelector(".tt-font-file").addEventListener("change", function () {
    var input = this;
    var file = input.files[0];
    var el = TEXT_TOOLBAR_EL;
    if (!file || !el) return;
    input.disabled = true;
    var name = file.name.replace(/\.[^.]+$/, "");
    var beforeFamily = el.style.fontFamily || "";
    var beforeCustom = CUSTOM_FONTS.filter(function (f) { return customFontFamily(f.id) === beforeFamily; })[0];
    var before = { family: beforeFamily, url: beforeCustom ? beforeCustom.url : "" };
    uploadEditorFile(file)
      .then(function (url) {
        return createCustomAsset("font", name, url).then(function (id) {
          return { id: id, name: name, owner: currentTaUsername(), url: url };
        });
      })
      .then(function (asset) {
        CUSTOM_FONTS.push(asset);
        var family = customFontFamily(asset.id);
        ensureFontFace(family, asset.url);
        refreshFontSelect();
        TEXT_TOOLBAR.querySelector(".tt-font").value = family;
        el.style.fontFamily = family;
        var id = el.getAttribute("data-edit-id");
        saveFontFamily(id, family, asset.url);
        EDIT_UNDO.push({ type: "fontfamily", id: id, before: before, after: { family: family, url: asset.url } });
        EDIT_REDO.length = 0;
        updateFontDeleteButton();
        el.focus();
      })
      .catch(function () {})
      .then(function () { input.disabled = false; input.value = ""; });
  });

  TEXT_TOOLBAR.querySelector(".tt-font-del").addEventListener("click", function () {
    var id = this.dataset.assetId;
    if (!id) return;
    var deleted = CUSTOM_FONTS.filter(function (f) { return String(f.id) === String(id); })[0];
    deleteCustomAsset("font", id).then(function () {
      CUSTOM_FONTS = CUSTOM_FONTS.filter(function (f) { return String(f.id) !== String(id); });
      refreshFontSelect();
      if (TEXT_TOOLBAR_EL) {
        var el = TEXT_TOOLBAR_EL;
        var fieldId = el.getAttribute("data-edit-id");
        var before = { family: el.style.fontFamily || "", url: deleted ? deleted.url : "" };
        el.style.fontFamily = "";
        saveFontFamily(fieldId, "", "");
        EDIT_UNDO.push({ type: "fontfamily", id: fieldId, before: before, after: { family: "", url: "" } });
        EDIT_REDO.length = 0;
      }
      updateFontDeleteButton();
    });
  });
}

/**
 * Rebuilds the font <select>'s option list: the built-ins (TEXT_FONTS)
 * first, then whatever custom fonts any ta has uploaded (CUSTOM_FONTS, see
 * fetchCustomAssets()) in their own optgroup. Keeps whatever value the
 * select already had; if that font just got deleted (by anyone) the select
 * naturally falls back to Default, since "" is always a valid option value.
 */
function refreshFontSelect() {
  if (!TEXT_TOOLBAR) return;
  var select = TEXT_TOOLBAR.querySelector(".tt-font");
  var current = select.value;
  var html = TEXT_FONTS.map(function (f) {
    return '<option value="' + f.value + '">' + f.label + '</option>';
  }).join("");
  if (CUSTOM_FONTS.length) {
    html += '<optgroup label="Your team">' +
      CUSTOM_FONTS.map(function (f) {
        return '<option value="' + customFontFamily(f.id) + '">' + f.name + '</option>';
      }).join("") +
      '</optgroup>';
  }
  select.innerHTML = html;
  select.value = current;
}

/**
 * Shows the "×" delete button next to the font select only when the
 * currently-selected font is a custom one the logged-in ta is the owner of
 * (never a built-in, never another ta's upload, mirrors the icon picker's
 * per-item delete rule).
 */
function updateFontDeleteButton() {
  if (!TEXT_TOOLBAR) return;
  var del = TEXT_TOOLBAR.querySelector(".tt-font-del");
  var val = TEXT_TOOLBAR.querySelector(".tt-font").value;
  var mine = CUSTOM_FONTS.filter(function (f) {
    return customFontFamily(f.id) === val && f.owner === currentTaUsername();
  })[0];
  del.style.display = mine ? "" : "none";
  del.dataset.assetId = mine ? mine.id : "";
}

/**
 * Refreshes the toolbar's pressed/active look to match the current
 * selection and field: bold/italic/underline read from
 * document.queryCommandState() (only meaningful with the field focused),
 * align reads the field's own inline override (not its computed style, so a
 * field that merely inherits center alignment from a parent doesn't show as
 * "active" until a ta actually sets it here). The color swatches follow the
 * same primary/secondary split as the style popover's rows (see
 * primeThemedColorRow()): the primary ".tt-color" always shows whatever's
 * actually painted right now (already correct for either theme since
 * repaintInlineTextColors() keeps the selection's live color resolved), the
 * secondary ".tt-color-dark" shows the other theme's EXPLICIT value if the
 * selection sits inside a tagged span that has one (selectionColorSpan()),
 * else an autoDarkVariant() suggestion, hidden until the toggle button
 * reveals it - a fresh suggestion never counts as "the ta set this",
 * exactly the pollution bug primeThemedColorRow() itself had to be fixed
 * for.
 */
function updateTextToolbarState() {
  if (!TEXT_TOOLBAR || !TEXT_TOOLBAR_EL) return;
  ["bold", "italic", "underline"].forEach(function (cmd) {
    var on = false;
    try { on = document.queryCommandState(cmd); } catch (e) {}
    TEXT_TOOLBAR.querySelector(".tt-" + cmd).classList.toggle("active", on);
  });
  TEXT_TOOLBAR.querySelectorAll(".tt-align").forEach(function (btn) {
    btn.classList.toggle("active", TEXT_TOOLBAR_EL.style.textAlign === btn.getAttribute("data-align"));
  });
  var curColor = "";
  try { curColor = document.queryCommandValue("foreColor"); } catch (e) {}
  var primaryHex = rgbToHex(curColor) || "#000000";
  var colorInput = TEXT_TOOLBAR.querySelector(".tt-color");
  colorInput.value = primaryHex;
  colorInput.dataset.baseline = primaryHex;

  var dark = isDarkThemeActive();
  var span = selectionColorSpan(TEXT_TOOLBAR_EL);
  var explicitOther = span ? (dark ? span.dataset.lightColor : span.dataset.darkColor) : null;
  var colorDarkInput = TEXT_TOOLBAR.querySelector(".tt-color-dark");
  var suggestedOther = explicitOther || autoDarkVariant(primaryHex);
  colorDarkInput.value = suggestedOther;
  colorDarkInput.dataset.baseline = suggestedOther;
  colorDarkInput.style.display = explicitOther ? "" : "none";
  var toggle = TEXT_TOOLBAR.querySelector(".tt-color-dark-toggle");
  toggle.textContent = dark ? "☀️" : "🌙";
  toggle.title = dark ? "Edit light mode text color (selection)" : "Edit dark mode text color (selection)";

  /* logistics.*.big/lbl fields save through saveEditedField()'s special-case
     branch that stores plain textContent into content.logistics, stripping
     any markup - a formula chip's <span> would get silently flattened to
     its rendered text on save, so offer the button nowhere it can't work */
  var id = TEXT_TOOLBAR_EL.getAttribute("data-edit-id") || "";
  TEXT_TOOLBAR.querySelector(".tt-fx").disabled = id.indexOf("logistics.") === 0;
}

/**
 * Shows the floating text toolbar above a text field being edited, and
 * points its font dropdown at whatever this field's already set to.
 * @param el the text field being edited
 */
function showTextToolbar(el) {
  if (!TEXT_TOOLBAR) buildTextToolbar();
  TEXT_TOOLBAR_EL = el;
  TEXT_TOOLBAR.querySelector(".tt-font").value = el.style.fontFamily || "";
  updateFontDeleteButton();
  updateTextToolbarState();
  /* fetched fresh every time, so a teammate's just-uploaded font shows up
     in the picker without a reload */
  fetchCustomAssets("font").then(function (list) {
    CUSTOM_FONTS = list;
    list.forEach(function (f) { ensureFontFace(customFontFamily(f.id), f.url); });
    if (TEXT_TOOLBAR_EL !== el) return; /* editing moved on before this resolved */
    var current = el.style.fontFamily || "";
    refreshFontSelect();
    TEXT_TOOLBAR.querySelector(".tt-font").value = current;
    updateFontDeleteButton();
  });
  /* shown (and thus laid out) before measuring: the toolbar wraps onto a
     second row past a certain width (flex-wrap, see .text-toolbar's
     max-width), so its real height varies with viewport width and can't be
     hardcoded, it has to be read off the actual rendered element. Adding
     the class and reading offsetHeight both happen synchronously here, so
     the browser never paints the still-unpositioned toolbar in between. */
  TEXT_TOOLBAR.classList.add("show");
  var r = el.getBoundingClientRect();
  var th = TEXT_TOOLBAR.offsetHeight;
  var top = r.top + window.scrollY - th - 6;
  /* no room above (the field is flush against the top of the page, eg. in
     the sticky nav, or the toolbar itself is taller than the gap above):
     drop below it instead of overlapping the field or the page above it */
  if (r.top < th + 10) top = r.bottom + window.scrollY + 6;
  var left = r.left + window.scrollX;
  var maxLeft = window.scrollX + document.documentElement.clientWidth - TEXT_TOOLBAR.offsetWidth - 6;
  left = Math.max(window.scrollX + 6, Math.min(left, maxLeft));
  TEXT_TOOLBAR.style.left = left + "px";
  TEXT_TOOLBAR.style.top = top + "px";
}

/** Hides the text toolbar once the edit ends. */
function hideTextToolbar() {
  TEXT_TOOLBAR_EL = null;
  if (TEXT_TOOLBAR) TEXT_TOOLBAR.classList.remove("show");
}

/* the text toolbar's "ƒx" button's own popover: picks an operation + one or
   two variables and inserts/edits a formula chip (see buildFormulaChipHtml())
   in the field currently being edited. Same lazy-singleton pattern as
   TEXT_TOOLBAR/STYLE_MENU. */
var FX_MENU = null;
/* the data-edit-id field the menu is currently acting on */
var FX_MENU_FIELD = null;
/* the chip <span> being edited, or null when inserting a brand new one */
var FX_MENU_CHIP = null;
/* the field's selection at the moment the menu opened (insert case only) -
   picking a variable in the menu's own <select>s moves real browser focus
   (and the selection) away from the field, so the caret position has to be
   captured up front and restored right before execCommand("insertHTML") */
var FX_MENU_RANGE = null;

/** Builds the formula menu once, lazily. */
function buildFormulaMenu() {
  FX_MENU = document.createElement("div");
  FX_MENU.className = "fx-menu";
  FX_MENU.innerHTML =
    '<label class="fxm-row">Insert<select class="fxm-op"></select></label>' +
    '<label class="fxm-row fxm-a-row">Variable<select class="fxm-a"></select></label>' +
    '<label class="fxm-row fxm-b-row">Of<select class="fxm-b"></select></label>' +
    '<label class="fxm-row fxm-dec-row">Decimals<input type="number" class="fxm-decimals" min="0" max="6" value="0"></label>' +
    '<div class="fxm-actions">' +
      '<button type="button" class="fxm-remove" style="display:none">Remove</button>' +
      '<span class="fxm-sep"></span>' +
      '<button type="button" class="fxm-cancel">Cancel</button>' +
      '<button type="button" class="fxm-ok">Insert</button>' +
    '</div>';
  document.body.appendChild(FX_MENU);

  var opSelect = FX_MENU.querySelector(".fxm-op");
  Object.keys(FX_OPS).forEach(function (op) {
    var opt = document.createElement("option");
    opt.value = op;
    opt.textContent = FX_OPS[op].label;
    opSelect.appendChild(opt);
  });

  /* buttons never need to actually take focus themselves (same reasoning as
     TEXT_TOOLBAR's own buttons, see buildTextToolbar()): swallowing their
     mousedown keeps the field's contentEditable focus (and selection) intact
     the whole time these are used. The op/variable/decimals controls DO need
     real focus to open/type, so those only get their mousedown's bubbling
     stopped, not prevented - same split TEXT_TOOLBAR's font <select> and
     color <input>s already use. */
  FX_MENU.querySelectorAll("button").forEach(function (btn) {
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  });
  FX_MENU.querySelectorAll("select, input").forEach(function (ctl) {
    ctl.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  });

  opSelect.addEventListener("change", refreshFormulaMenuRows);
  FX_MENU.querySelector(".fxm-a").addEventListener("change", refreshFormulaMenuRows);
  FX_MENU.querySelector(".fxm-cancel").addEventListener("click", closeFormulaMenu);
  FX_MENU.querySelector(".fxm-ok").addEventListener("click", commitFormulaMenu);
  FX_MENU.querySelector(".fxm-remove").addEventListener("click", removeFormulaMenuChip);
}

/**
 * Shows/hides the menu's Of/Decimals rows and refills the Variable/Of
 * selects for whichever operation is now picked - "value" is the only op
 * that accepts a non-number variable and has no second operand, every other
 * op needs two number-typed variables. Also drives the Decimals row's
 * visibility off the currently-picked A variable's type for "value" (a
 * string/boolean/datetime value has no decimal places to speak of), and
 * always hides it for "fraction" (always whole numbers, see
 * formulaChipText()).
 */
function refreshFormulaMenuRows() {
  var op = FX_MENU.querySelector(".fxm-op").value;
  var meta = FX_OPS[op];
  var aSelect = FX_MENU.querySelector(".fxm-a");
  var aPredicate = meta.anyType ? function () { return true; } : function (v) { return v.type === "number"; };
  var curA = aSelect.value;
  var aStillValid = curA && VARIABLES.some(function (v) { return v.key === curA && aPredicate(v); });
  var firstA = (VARIABLES.filter(aPredicate)[0] || {}).key || "";
  populateVariableSelect(aSelect, aPredicate, aStillValid ? curA : firstA);

  FX_MENU.querySelector(".fxm-b-row").style.display = meta.needsB ? "" : "none";
  if (meta.needsB) {
    var bSelect = FX_MENU.querySelector(".fxm-b");
    var curB = bSelect.value;
    var numberPredicate = function (v) { return v.type === "number"; };
    var bStillValid = curB && VARIABLES.some(function (v) { return v.key === curB && numberPredicate(v); });
    var firstB = (VARIABLES.filter(numberPredicate)[0] || {}).key || "";
    populateVariableSelect(bSelect, numberPredicate, bStillValid ? curB : firstB);
  }

  var aVar = variableByKey(aSelect.value);
  var showDecimals = op !== "fraction" && (meta.needsB || (aVar && aVar.type === "number"));
  FX_MENU.querySelector(".fxm-dec-row").style.display = showDecimals ? "" : "none";
}

/**
 * Opens the formula menu, either to insert a brand new chip at the field's
 * current selection (chip === null) or to reconfigure/remove one already
 * placed (chip is that <span class="fx-chip">, prefills every control from
 * its own data-fx-* attributes). Only ever called while fieldEl is already
 * mid-edit (isContentEditable), from the toolbar's ƒx button or a click on
 * an existing chip, see wireTextField().
 * @param fieldEl the data-edit-id field being edited
 * @param chip the fx-chip <span> to edit, or null to insert a new one
 */
function openFormulaMenu(fieldEl, chip) {
  if (!FX_MENU) buildFormulaMenu();
  FX_MENU_FIELD = fieldEl;
  FX_MENU_CHIP = chip;
  var sel = window.getSelection();
  FX_MENU_RANGE = (!chip && sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;

  FX_MENU.querySelector(".fxm-op").value = chip ? (chip.dataset.fxOp || "value") : "value";
  refreshFormulaMenuRows();
  if (chip && chip.dataset.fxA) FX_MENU.querySelector(".fxm-a").value = chip.dataset.fxA;
  if (chip && chip.dataset.fxB) FX_MENU.querySelector(".fxm-b").value = chip.dataset.fxB;
  FX_MENU.querySelector(".fxm-decimals").value = chip ? (chip.dataset.fxDecimals || "0") : "0";
  FX_MENU.querySelector(".fxm-ok").textContent = chip ? "Update" : "Insert";
  FX_MENU.querySelector(".fxm-remove").style.display = chip ? "" : "none";

  FX_MENU.classList.add("show");
  var anchor = chip || TEXT_TOOLBAR_EL || fieldEl;
  var r = anchor.getBoundingClientRect();
  var top = r.bottom + window.scrollY + 6;
  var left = r.left + window.scrollX;
  var maxLeft = window.scrollX + document.documentElement.clientWidth - FX_MENU.offsetWidth - 6;
  left = Math.max(window.scrollX + 6, Math.min(left, maxLeft));
  FX_MENU.style.left = left + "px";
  FX_MENU.style.top = top + "px";
}

/** Hides the formula menu without changing anything. */
function closeFormulaMenu() {
  FX_MENU_FIELD = null;
  FX_MENU_CHIP = null;
  FX_MENU_RANGE = null;
  if (FX_MENU) FX_MENU.classList.remove("show");
}

/**
 * Applies the menu's current picks: updates FX_MENU_CHIP in place if editing
 * one, otherwise inserts a brand new chip at the caret position captured
 * when the menu opened (FX_MENU_RANGE). Either way ends by diffing the
 * field's whole innerHTML through commitTextFieldChange() - same undo/save/
 * mirror path a normal typed edit commits through on blur, since a chip is
 * just more of the field's own innerHTML.
 */
function commitFormulaMenu() {
  if (!FX_MENU_FIELD) return;
  var op = FX_MENU.querySelector(".fxm-op").value;
  var meta = FX_OPS[op];
  var aKey = FX_MENU.querySelector(".fxm-a").value;
  var bKey = meta.needsB ? FX_MENU.querySelector(".fxm-b").value : "";
  var decimals = parseInt(FX_MENU.querySelector(".fxm-decimals").value, 10);
  if (isNaN(decimals) || decimals < 0) decimals = 0;
  var field = FX_MENU_FIELD;
  var before = field.innerHTML;

  if (FX_MENU_CHIP) {
    var chip = FX_MENU_CHIP;
    chip.dataset.fxOp = op;
    chip.dataset.fxA = aKey;
    if (bKey) chip.dataset.fxB = bKey; else delete chip.dataset.fxB;
    chip.dataset.fxDecimals = String(decimals);
    chip.textContent = formulaChipText(op, aKey, bKey, decimals);
  } else {
    field.focus();
    var sel = window.getSelection();
    sel.removeAllRanges();
    if (FX_MENU_RANGE) {
      sel.addRange(FX_MENU_RANGE);
    } else {
      var r = document.createRange();
      r.selectNodeContents(field);
      r.collapse(false);
      sel.addRange(r);
    }
    document.execCommand("insertHTML", false, buildFormulaChipHtml(op, aKey, bKey, decimals));
  }

  var after = field.innerHTML;
  closeFormulaMenu();
  commitTextFieldChange(field, before, after);
  field.focus();
}

/** Deletes the chip being edited and commits the change. */
function removeFormulaMenuChip() {
  if (!FX_MENU_FIELD || !FX_MENU_CHIP) return;
  var field = FX_MENU_FIELD;
  var before = field.innerHTML;
  FX_MENU_CHIP.remove();
  var after = field.innerHTML;
  closeFormulaMenu();
  commitTextFieldChange(field, before, after);
  field.focus();
}

/**
 * Wires up one data-edit-id element as a click-to-edit field: shared by
 * wireClickToEdit()'s initial pass over every template field and
 * addCustomElement() for a text/button field created on the fly through
 * the right-click "Add element" menu, so a brand new field behaves exactly
 * like one that's been there since the template loaded.
 * @param el the element to wire up
 */
function wireTextField(el) {
  /* undo neuterLink()'s dimming, if any: an editable element should look
     normal (own hover affordance) rather than disabled. Only clears an
     opacity that's exactly neuterLink()'s own dimmed value (".5"), not a
     real saved style-popover opacity override that just happens to already
     be applied by the time this runs (applyOpacityOverrides() runs before
     wireClickToEdit() wires up every field, see fetchContent()) */
  if (el.style.opacity === ".5") el.style.opacity = "";
  el.style.cursor = "";

  var beforeEdit = "";
  el.addEventListener("click", function (e) {
    if (el.isContentEditable) {
      /* a click on a chip while the field is already mid-edit reconfigures
         it instead of just placing the caret next to it
         (contenteditable="false" makes chips atomic for caret navigation,
         but they still receive normal click events) */
      var chip = e.target.closest && e.target.closest(".fx-chip");
      if (chip) { e.preventDefault(); e.stopPropagation(); openFormulaMenu(el, chip); }
      return; /* already editing, let the caret land normally otherwise */
    }
    /* shift-click already toggled group-selection in the mousedown handler
       above (wireResizable(), which runs for every tracked element,
       text fields included, and fires before this click event does); this
       just has to stop the edit from ALSO opening, not toggle a second
       time (that would just cancel the mousedown handler's own toggle) */
    if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    beforeEdit = el.innerHTML;
    el.contentEditable = "true";
    el.classList.add("editing");
    showTextToolbar(el);
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  });

  el.addEventListener("keydown", function (e) {
    if (!el.isContentEditable) return;
    if (e.key === "Enter") { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") { e.preventDefault(); el.innerHTML = beforeEdit; el.blur(); }
  });

  el.addEventListener("blur", function (e) {
    if (!el.isContentEditable) return;
    /* focus moved to the toolbar itself (eg opening the font dropdown) or
       the formula menu (eg opening its variable <select>), not away from
       the field: don't end the edit, that control's own handler runs and
       hands focus straight back */
    if (e.relatedTarget && ((TEXT_TOOLBAR && TEXT_TOOLBAR.contains(e.relatedTarget)) ||
        (FX_MENU && FX_MENU.contains(e.relatedTarget)))) return;
    el.contentEditable = "false";
    el.classList.remove("editing");
    hideTextToolbar();
    /* the edit may have changed el's own rendered size (more/less text),
       so the ring needs to catch up if it's sitting on this field */
    positionRing();
    commitTextFieldChange(el, beforeEdit, el.innerHTML);
  });

  el.addEventListener("keyup", updateTextToolbarState);
  el.addEventListener("mouseup", updateTextToolbarState);
}

/**
 * Commits a text field's edit session: pushes an undo step (if anything
 * actually changed), persists, and syncs any duplicate elements sharing the
 * same data-edit-id. Shared by wireTextField()'s blur handler (a normal
 * typed edit) and the formula menu's insert/update/remove (see
 * commitFormulaMenu(), removeFormulaMenuChip()) - a formula chip is just
 * more of the field's own innerHTML, so both paths commit identically and
 * get full undo/redo for free, no separate action type needed.
 * @param el the data-edit-id field
 * @param before its innerHTML at the start of the edit session
 * @param after its innerHTML now
 */
function commitTextFieldChange(el, before, after) {
  if (after !== before) {
    EDIT_UNDO.push({ type: "text", id: el.getAttribute("data-edit-id"), before: before, after: after });
    EDIT_REDO.length = 0;
  }
  saveEditedField(el.getAttribute("data-edit-id"), after, el.getAttribute("data-default-html"));
  mirrorEditedField(el.getAttribute("data-edit-id"), after, el);
}

/**
 * Turns every data-edit-id element into a click-to-edit field, only called
 * in the ta portal's Visual editor tab (instructor.html/js/ta.js) with
 * &edit=1 set (see isEditMode()). Edits save straight into localStorage's
 * preview_content snapshot (the same one js/ta.js's
 * tryRestoreFromPreview() already restores unsaved work from), since the
 * iframe is same-origin with the ta portal tab and shares it, so no
 * postMessage plumbing is needed to get the edit back to the portal.
 */
function wireClickToEdit() {
  document.body.classList.add("edit-mode");
  document.querySelectorAll("[data-edit-id]").forEach(wireTextField);

  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    /* a real form control (eg the "Add element" menu's link input) should
       get its own native undo, not hijack the click-to-edit stack */
    var active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    var key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey) { e.preventDefault(); undoEdit(); }
    else if (key === "y" || (key === "z" && e.shiftKey)) { e.preventDefault(); redoEdit(); }
  });

  /* exposed so instructor.html's Undo/Redo buttons can drive this from the
     parent frame (same-origin, so a direct contentWindow reference works) */
  window.ClickEditHistory = {
    undo: undoEdit,
    redo: redoEdit,
    canUndo: function () { return EDIT_UNDO.length > 0; },
    canRedo: function () { return EDIT_REDO.length > 0; }
  };
}

/**
 * Copies a committed edit onto every other element sharing the same
 * data-edit-id (e.g. the brand wordmark appears in both the nav and the
 * footer), so they stay in sync within the same page load instead of only
 * matching up again after a reload re-runs applyTextOverrides().
 * @param id the edited element's data-edit-id
 * @param html its new innerHTML
 * @param editedEl the element that was just edited, skipped in the sync
 */
function mirrorEditedField(id, html, editedEl) {
  document.querySelectorAll('[data-edit-id="' + id + '"]').forEach(function (el) {
    if (el !== editedEl) el.innerHTML = html;
  });
  repaintExtrasFilenameChips();
  repaintDaysChips();
}

/** Reverts the most recent click-to-edit commit, moving it onto the redo stack. */
function undoEdit() {
  var action = EDIT_UNDO.pop();
  if (!action) return;
  applyHistoryAction(action, "before");
  EDIT_REDO.push(action);
}

/** Reapplies the most recently undone commit, moving it back onto the undo stack. */
function redoEdit() {
  var action = EDIT_REDO.pop();
  if (!action) return;
  applyHistoryAction(action, "after");
  EDIT_UNDO.push(action);
}

/**
 * Replays one undo/redo stack entry. "before"/"after" mean whatever state
 * of the element that side of the action represents (side is "before" for
 * an undo, "after" for a redo), same idea for every type:
 *  - "text": innerHTML
 *  - "delete": existed (before) vs hidden (after)
 *  - "move": {tx, ty}
 *  - "resize": {w, h, tx, ty} (a resize can also shift position, see
 *    startResizeDrag())
 *  - "fontsize": css font-size, or "" for the template default
 *  - "align"/"letterspacing": the css value, or "" for the template default
 *  - "fontfamily": {family, url} (url only set for a ta-uploaded font)
 *  - "add": existed (after) vs hidden (before), same shape as "delete", just
 *    the two sides swapped (see addCustomElement())
 *  - "layer": no before/after value, just replays moveLayer(id, +-dir)
 *  - "layerorder": {before, after} full LAYER_ORDER snapshots (a to-top/
 *    to-bottom jump isn't its own inverse like an adjacent swap is, so the
 *    whole stack is stored on both sides, see moveLayerExtreme())
 *  - "fixed": no before/after value either, toggleFixed(id) is its own
 *    inverse so either side just calls it again
 *  - "datetime": {target, format, strftime} (a placed datetime custom
 *    element's edited target/display format/pattern, see buildStyleMenu()'s
 *    commitDatetimeUndo())
 *  - "darkcolor"/"darktextcolor"/"darkfill": the style popover's "dark mode
 *    color" sub-row for Color/Text color/Fill, a css color string or "" for
 *    the auto-computed variant (see resolveThemedColor()/autoDarkVariant())
 *  - "darkborder": same idea, a css color string or "" (only the color
 *    half of the Border row is theme-dependent, see applyBorderOverrides())
 * @param action the stack entry
 * @param side "before" or "after", which side of the action to restore
 */
function applyHistoryAction(action, side) {
  var val = action[side];
  if (action.type === "delete") {
    setElementHidden(action.id, side === "after");
    return;
  }
  if (action.type === "add") {
    setElementHidden(action.id, side === "before");
    return;
  }
  if (action.type === "groupdelete") {
    action.ids.forEach(function (id) { setElementHidden(id, side === "after"); });
    return;
  }
  if (action.type === "addmulti") {
    action.ids.forEach(function (id) { setElementHidden(id, side === "before"); });
    return;
  }
  if (action.type === "group") {
    if (side === "after") createGroup(action.ids); else dissolveGroup(action.ids[0]);
    return;
  }
  if (action.type === "ungroup") {
    if (side === "after") dissolveGroup(action.ids[0]); else createGroup(action.ids);
    return;
  }
  if (action.type === "layer") {
    moveLayer(action.id, side === "after" ? action.dir : -action.dir);
    return;
  }
  if (action.type === "layerorder") {
    LAYER_ORDER = (side === "before" ? action.before : action.after).slice();
    applyLayerOrder(LAYER_ORDER);
    saveLayerOrder(LAYER_ORDER);
    return;
  }
  if (action.type === "fixed") {
    toggleFixed(action.id);
    return;
  }
  if (action.type === "locked") {
    toggleLocked(action.id);
    return;
  }
  if (action.type === "text") {
    var textEls = document.querySelectorAll('[data-edit-id="' + action.id + '"]');
    if (!textEls.length) return;
    textEls.forEach(function (el) { el.innerHTML = val; });
    saveEditedField(action.id, val, textEls[0].getAttribute("data-default-html"));
    return;
  }
  if (action.type === "move" || action.type === "resize") {
    var posEls = document.querySelectorAll('[data-edit-id="' + action.id + '"], [data-resize-id="' + action.id + '"]');
    if (!posEls.length) return;
    posEls.forEach(function (el) {
      if (action.type === "move") applyMoveSide(el, val);
      else applyResizeSide(el, val);
    });
    return;
  }
  if (action.type === "groupmove") {
    action.moves.forEach(function (mv) {
      var mvVal = side === "after" ? mv.after : mv.before;
      document.querySelectorAll('[data-edit-id="' + mv.id + '"], [data-resize-id="' + mv.id + '"]').forEach(function (el) {
        applyMoveSide(el, mvVal);
      });
    });
    return;
  }
  if (action.type === "fontsize") {
    /* elByAnyId, not just [data-edit-id]: a datetime element (data-resize-id)
       is font-size/align/font-styleable too, driven from the style popover */
    var fsEl = elByAnyId(action.id);
    if (!fsEl) return;
    fsEl.style.fontSize = val || "";
    saveFontSize(action.id, val || "");
    return;
  }
  if (action.type === "align" || action.type === "letterspacing") {
    var styleEl = elByAnyId(action.id);
    if (!styleEl) return;
    if (action.type === "align") {
      styleEl.style.textAlign = val;
      saveTextStyle(action.id, "align", val);
      if (TEXT_TOOLBAR_EL === styleEl) updateTextToolbarState();
      if (STYLE_MENU_ID === action.id && STYLE_MENU && STYLE_MENU.classList.contains("show")) {
        STYLE_MENU.querySelectorAll(".sm-dt-align").forEach(function (b) {
          b.classList.toggle("active", styleEl.style.textAlign === b.getAttribute("data-align"));
        });
      }
    } else {
      styleEl.style.letterSpacing = val;
      saveTextStyle(action.id, "letterSpacing", val);
    }
    return;
  }
  if (action.type === "fontfamily") {
    var fontEl = elByAnyId(action.id);
    if (!fontEl) return;
    if (val.url) ensureFontFace(val.family, val.url);
    fontEl.style.fontFamily = val.family;
    saveFontFamily(action.id, val.family, val.url);
    if (TEXT_TOOLBAR_EL === fontEl) {
      TEXT_TOOLBAR.querySelector(".tt-font").value = val.family;
      updateFontDeleteButton();
    }
    if (STYLE_MENU_ID === action.id && STYLE_MENU && STYLE_MENU.classList.contains("show")) {
      STYLE_MENU.querySelector(".sm-dt-font").value = val.family;
    }
    return;
  }
  if (action.type === "color") {
    var colorEl = styleMenuElById(action.id);
    if (!colorEl) return;
    THEMED_OVERRIDE_MAPS.colors[action.id] = val || "";
    setElementColor(colorEl, resolveThemedColor(val || "", THEMED_OVERRIDE_MAPS.darkColors[action.id]));
    saveEditedColor(action.id, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-color").value = currentColorValue(colorEl);
      STYLE_COLOR_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "darkcolor") {
    var darkColorEl = styleMenuElById(action.id);
    if (!darkColorEl) return;
    THEMED_OVERRIDE_MAPS.darkColors[action.id] = val || "";
    saveEditedDarkColor(action.id, val || "");
    var darkColorBase = THEMED_OVERRIDE_MAPS.colors[action.id] || currentColorValue(darkColorEl);
    setElementColor(darkColorEl, resolveThemedColor(darkColorBase, val || ""));
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-color-dark").value = val || autoDarkVariant(darkColorBase);
      STYLE_DARKCOLOR_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "link") {
    var linkEl = styleMenuElById(action.id);
    if (!linkEl) return;
    applyOneLink(linkEl, val || "");
    if (val) LINKS[action.id] = val; else delete LINKS[action.id];
    saveEditedLink(action.id, val || "");
    applyLinkHighlight();
    return;
  }
  if (action.type === "fill") {
    var fillEl = styleMenuElById(action.id);
    if (!fillEl) return;
    THEMED_OVERRIDE_MAPS.fill[action.id] = val || "";
    fillEl.style.backgroundColor = resolveThemedColor(val || "", THEMED_OVERRIDE_MAPS.darkFill[action.id]);
    saveEditedFill(action.id, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-fill").value = currentFillValue(fillEl);
      STYLE_FILL_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "darkfill") {
    var darkFillEl = styleMenuElById(action.id);
    if (!darkFillEl) return;
    THEMED_OVERRIDE_MAPS.darkFill[action.id] = val || "";
    saveEditedDarkFill(action.id, val || "");
    var darkFillBase = THEMED_OVERRIDE_MAPS.fill[action.id] || currentFillValue(darkFillEl);
    darkFillEl.style.backgroundColor = resolveThemedColor(darkFillBase, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-fill-dark").value = val || autoDarkVariant(darkFillBase);
      STYLE_DARKFILL_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "progressvar") {
    var pvD = customElementById(action.id);
    if (!pvD) return;
    pvD.varCurrent = val.varCurrent;
    pvD.varTotal = val.varTotal;
    var pvEl = elByAnyId(action.id);
    if (pvEl) paintProgressElement(pvEl, pvD);
    saveCustomElements(CUSTOM_ELEMENTS);
    if (STYLE_MENU_ID === action.id && STYLE_MENU && STYLE_MENU.classList.contains("show")) {
      STYLE_MENU.querySelector(".sm-progress-current").value = pvD.varCurrent;
      STYLE_MENU.querySelector(".sm-progress-total").value = pvD.varTotal;
      STYLE_PROGRESSVAR_BEFORE = { varCurrent: pvD.varCurrent, varTotal: pvD.varTotal };
    }
    return;
  }
  if (action.type === "progressfill" || action.type === "progresstrack") {
    var pcEl = styleMenuElById(action.id);
    if (!pcEl) return;
    var pcMapKey = action.type === "progressfill" ? "progressFill" : "progressTrack";
    var pcDarkMapKey = action.type === "progressfill" ? "darkProgressFill" : "darkProgressTrack";
    var pcSaveFn = action.type === "progressfill" ? saveEditedProgressFill : saveEditedProgressTrack;
    THEMED_OVERRIDE_MAPS[pcMapKey][action.id] = val || "";
    pcSaveFn(action.id, val || "");
    paintProgressElement(pcEl, customElementById(action.id) || {});
    if (STYLE_MENU_ID === action.id) {
      var pcReadFn = action.type === "progressfill" ? currentProgressFillValue : currentProgressTrackValue;
      var pcSel = action.type === "progressfill" ? ".sm-progress-fill" : ".sm-progress-track";
      STYLE_MENU.querySelector(pcSel).value = pcReadFn(pcEl);
      if (action.type === "progressfill") STYLE_PROGRESSFILL_BEFORE = val || "";
      else STYLE_PROGRESSTRACK_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "darkprogressfill" || action.type === "darkprogresstrack") {
    var dpcEl = styleMenuElById(action.id);
    if (!dpcEl) return;
    var dpcMapKey = action.type === "darkprogressfill" ? "darkProgressFill" : "darkProgressTrack";
    var dpcSaveFn = action.type === "darkprogressfill" ? saveEditedDarkProgressFill : saveEditedDarkProgressTrack;
    THEMED_OVERRIDE_MAPS[dpcMapKey][action.id] = val || "";
    dpcSaveFn(action.id, val || "");
    paintProgressElement(dpcEl, customElementById(action.id) || {});
    if (STYLE_MENU_ID === action.id) {
      var dpcLightMapKey = action.type === "darkprogressfill" ? "progressFill" : "progressTrack";
      var dpcLightVal = THEMED_OVERRIDE_MAPS[dpcLightMapKey][action.id] ||
        (action.type === "darkprogressfill" ? currentProgressFillValue(dpcEl) : currentProgressTrackValue(dpcEl));
      var dpcSel = action.type === "darkprogressfill" ? ".sm-progress-fill-dark" : ".sm-progress-track-dark";
      STYLE_MENU.querySelector(dpcSel).value = val || autoDarkVariant(dpcLightVal);
      if (action.type === "darkprogressfill") STYLE_DARKPROGRESSFILL_BEFORE = val || "";
      else STYLE_DARKPROGRESSTRACK_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "textcolor") {
    var textColorEl = styleMenuElById(action.id);
    if (!textColorEl) return;
    THEMED_OVERRIDE_MAPS.textColor[action.id] = val || "";
    textColorEl.style.color = resolveThemedColor(val || "", THEMED_OVERRIDE_MAPS.darkTextColor[action.id]);
    saveEditedTextColor(action.id, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-textcolor").value = currentTextColorValue(textColorEl);
      STYLE_TEXTCOLOR_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "darktextcolor") {
    var darkTextColorEl = styleMenuElById(action.id);
    if (!darkTextColorEl) return;
    THEMED_OVERRIDE_MAPS.darkTextColor[action.id] = val || "";
    saveEditedDarkTextColor(action.id, val || "");
    var darkTextBase = THEMED_OVERRIDE_MAPS.textColor[action.id] || currentTextColorValue(darkTextColorEl);
    darkTextColorEl.style.color = resolveThemedColor(darkTextBase, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-textcolor-dark").value = val || autoDarkVariant(darkTextBase);
      STYLE_DARKTEXTCOLOR_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "datetime") {
    var dtD = customElementById(action.id);
    if (!dtD) return;
    dtD.target = val.target;
    dtD.format = val.format;
    dtD.strftime = val.strftime || "";
    var dtEl = elByAnyId(action.id);
    if (dtEl) renderDatetimeContent(dtEl, dtD);
    saveCustomElements(CUSTOM_ELEMENTS);
    /* keep the popover's own controls in sync if it's open on this element */
    if (STYLE_MENU_ID === action.id && STYLE_MENU && STYLE_MENU.classList.contains("show")) {
      STYLE_MENU.querySelector(".sm-dt-format").value = dtD.format || "countdown";
      STYLE_MENU.querySelector(".sm-dt-pattern").value = dtD.strftime || "";
      STYLE_MENU.querySelector(".sm-dt-pattern").placeholder = DT_DEFAULT_PATTERNS[dtD.format || "countdown"] || "";
      STYLE_MENU.querySelector(".sm-dt-target").value = toDatetimeLocalValue(new Date(dtD.target || Date.now()));
      STYLE_DT_BEFORE = { target: dtD.target, format: dtD.format, strftime: dtD.strftime || "" };
    }
    return;
  }
  if (action.type === "tint") {
    var tintEl = styleMenuElById(action.id);
    if (!tintEl) return;
    setElementTint(tintEl, val || "");
    saveEditedTint(action.id, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-tint").value = currentTintValue(tintEl);
      STYLE_TINT_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "radius") {
    var radEl = styleMenuElById(action.id);
    if (!radEl) return;
    var px = parseInt(val, 10) || 0;
    radEl.style.borderRadius = px + "px";
    saveEditedRadius(action.id, px);
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-radius").value = px;
      STYLE_MENU.querySelector(".sm-radius-val").textContent = px + "px";
      STYLE_RADIUS_BEFORE = String(px);
    }
    return;
  }
  if (action.type === "border") {
    var bdEl = styleMenuElById(action.id);
    if (!bdEl) return;
    var bw = (val && val.w) || 0;
    var bColor = val ? val.color : "#000000";
    THEMED_OVERRIDE_MAPS.border[action.id] = { w: bw, color: bColor };
    if (bw > 0) {
      var bdDark = THEMED_OVERRIDE_MAPS.darkBorder[action.id];
      bdEl.style.border = bw + "px solid " + resolveThemedColor(bColor, bdDark && bdDark.color);
    } else {
      bdEl.style.border = "none";
    }
    saveEditedBorder(action.id, bw, bColor);
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-border-w").value = bw;
      STYLE_MENU.querySelector(".sm-border-val").textContent = bw + "px";
      STYLE_MENU.querySelector(".sm-border-color").value = bColor;
      STYLE_BORDER_BEFORE = { w: bw, color: bColor };
    }
    return;
  }
  if (action.type === "darkborder") {
    var darkBdEl = styleMenuElById(action.id);
    if (!darkBdEl) return;
    THEMED_OVERRIDE_MAPS.darkBorder[action.id] = { color: val || "" };
    saveEditedDarkBorder(action.id, val || "");
    var bdBase = THEMED_OVERRIDE_MAPS.border[action.id];
    var darkBw = (bdBase && bdBase.w) || 0;
    var darkBaseColor = (bdBase && bdBase.color) || currentBorderValue(darkBdEl).color;
    if (darkBw > 0) darkBdEl.style.border = darkBw + "px solid " + resolveThemedColor(darkBaseColor, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-border-color-dark").value = val || autoDarkVariant(darkBaseColor);
      STYLE_DARKBORDER_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "shadow") {
    var shEl = styleMenuElById(action.id);
    if (!shEl) return;
    var on = !currentShadowOn(shEl);
    shEl.style.boxShadow = on ? BOX_SHADOW_VALUE : "none";
    saveEditedShadow(action.id, on);
    if (STYLE_MENU_ID === action.id) STYLE_MENU.querySelector(".sm-shadow").checked = on;
    return;
  }
  if (action.type === "opacity") {
    var opEl = styleMenuElById(action.id);
    if (!opEl) return;
    var pct = parseFloat(val) || 100;
    applyElementOpacity(opEl, pct / 100);
    saveEditedOpacity(action.id, pct / 100);
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-opacity").value = pct;
      STYLE_MENU.querySelector(".sm-opacity-val").textContent = pct + "%";
      STYLE_OPACITY_BEFORE = String(pct);
    }
    return;
  }
  if (action.type === "shade") {
    var shadeEl = styleMenuElById(action.id);
    if (!shadeEl) return;
    var shadePct = parseFloat(val) || 0;
    setElementShade(shadeEl, shadePct / 100);
    saveEditedShade(action.id, shadePct / 100);
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-shade").value = shadePct;
      STYLE_MENU.querySelector(".sm-shade-val").textContent = shadePct + "%";
      STYLE_SHADE_BEFORE = String(shadePct);
    }
    return;
  }
}

/**
 * Persists one click-to-edit change into the preview snapshot in
 * localStorage, so it round-trips through the same unsaved-draft mechanism
 * as every other in-progress ta portal edit (see js/ta.js's
 * tryRestoreFromPreview()/openPreview()). Routes logistics tile text
 * (data-edit-id "logistics.<i>.big"/"logistics.<i>.lbl") straight into
 * content.logistics itself, the same array the content manager's "Info
 * tiles" list reads/writes, so editing a tile here shows up there too, not
 * just as a separate override. Everything else (hardcoded template copy)
 * keeps using content.text, dropping the key entirely once it's edited back
 * to the page's own default so saved blobs don't carry no-op overrides.
 * @param id the element's data-edit-id
 * @param html the element's current innerHTML
 * @param defaultHtml the template's original innerHTML for that element
 */
function saveEditedField(id, html, defaultHtml) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }

  if (id.indexOf("logistics.") === 0) {
    var parts = id.split(".");
    var idx = parseInt(parts[1], 10);
    var field = parts[2];
    if (!Array.isArray(snapshot.logistics)) snapshot.logistics = [];
    if (!snapshot.logistics[idx]) snapshot.logistics[idx] = { big: "", lbl: "", icon: false };
    var tmp = document.createElement("div");
    tmp.innerHTML = html;
    snapshot.logistics[idx][field] = tmp.textContent;
  } else {
    if (!snapshot.text || typeof snapshot.text !== "object") snapshot.text = {};
    if (html.trim() === (defaultHtml || "").trim()) delete snapshot.text[id];
    else snapshot.text[id] = html;
  }

  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a resize-handle drag (see startResizeDrag()) into the preview
 * snapshot, the same localStorage draft saveEditedField() uses, so a
 * resized element round-trips through Apply/profiles exactly like an
 * edited caption does.
 * @param id the element's data-edit-id or data-resize-id
 * @param size the new size ({w, h}), or null to clear back to the
 *   template default
 */
function saveEditedSize(id, size) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.sizes || typeof snapshot.sizes !== "object") snapshot.sizes = {};
  if (size == null) delete snapshot.sizes[id];
  else snapshot.sizes[id] = size;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a font-size bump from the A-/A+ buttons (see showTextToolbar())
 * into the preview snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id
 * @param px new font-size (css px string)
 */
function saveFontSize(id, px) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.font_sizes || typeof snapshot.font_sizes !== "object") snapshot.font_sizes = {};
  snapshot.font_sizes[id] = px;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists one whole-field text style property (font family, alignment, or
 * letter spacing, see showTextToolbar()) into the preview snapshot, the same
 * localStorage draft every other override here uses. Grouped per id under
 * one object rather than three separate top-level maps since they're all
 * "how this text field is styled", not a resize/move/font-size, which
 * already have their own dedicated maps.
 * @param id the element's data-edit-id
 * @param prop "fontFamily", "align", or "letterSpacing"
 * @param value the new css value, or "" to clear back to the template default
 */
function saveTextStyle(id, prop, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.text_styles || typeof snapshot.text_styles !== "object") snapshot.text_styles = {};
  if (!snapshot.text_styles[id]) snapshot.text_styles[id] = {};
  if (value) snapshot.text_styles[id][prop] = value;
  else delete snapshot.text_styles[id][prop];
  if (!Object.keys(snapshot.text_styles[id]).length) delete snapshot.text_styles[id];
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a font choice (see showTextToolbar()'s font select) into the
 * preview snapshot, the same as saveTextStyle() but carrying the font
 * file's url alongside a ta-uploaded font's family name: a built-in
 * (TEXT_FONTS) has no url and never needs one, but a custom font's
 * @font-face has to be re-declared on every future load (see
 * applyTextStyleOverrides()), including for a real visitor who never opens
 * the ta portal at all, so the url has to travel with the saved style
 * rather than being looked up from the (ta-only) asset list at render time.
 * @param id the element's data-edit-id
 * @param family the css font-family name, or "" to clear back to the default
 * @param url the custom font's file url, or "" for a built-in/cleared font
 */
function saveFontFamily(id, family, url) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.text_styles || typeof snapshot.text_styles !== "object") snapshot.text_styles = {};
  if (!snapshot.text_styles[id]) snapshot.text_styles[id] = {};
  if (family) {
    snapshot.text_styles[id].fontFamily = family;
    if (url) snapshot.text_styles[id].fontUrl = url;
    else delete snapshot.text_styles[id].fontUrl;
  } else {
    delete snapshot.text_styles[id].fontFamily;
    delete snapshot.text_styles[id].fontUrl;
  }
  if (!Object.keys(snapshot.text_styles[id]).length) delete snapshot.text_styles[id];
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a move-handle drag (see startMoveDrag()) into the preview
 * snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param tx new horizontal offset in css px, or null to clear back to place
 * @param ty new vertical offset in css px, or null to clear back to place
 */
function saveEditedPosition(id, tx, ty) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.positions || typeof snapshot.positions !== "object") snapshot.positions = {};
  if (tx == null || ty == null) delete snapshot.positions[id];
  else snapshot.positions[id] = { tx: tx, ty: ty };
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a delete/restore (see deleteElement()) into the preview snapshot,
 * the same localStorage draft every other override here uses. Stored as a
 * flat list of hidden ids rather than a per-id boolean map so an untouched
 * blob's "hidden" key doesn't need to exist at all.
 * @param id the element's data-edit-id or data-resize-id
 * @param hidden true to hide/delete it, false to restore it
 */
function saveEditedVisibility(id, hidden) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!Array.isArray(snapshot.hidden)) snapshot.hidden = [];
  var idx = snapshot.hidden.indexOf(id);
  if (hidden) { if (idx === -1) snapshot.hidden.push(id); }
  else if (idx !== -1) snapshot.hidden.splice(idx, 1);
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a color pick from the style popover (see buildStyleMenu()) into
 * the preview snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param value a css color string, or "" to clear back to the template default
 */
function saveEditedColor(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.colors || typeof snapshot.colors !== "object") snapshot.colors = {};
  if (!value) delete snapshot.colors[id];
  else snapshot.colors[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a dark-mode color override (the style popover's "dark mode
 * color" toggle under the main Color row, see buildStyleMenu()) into the
 * preview snapshot, same draft as saveEditedColor(). "" clears the
 * override, falling back to the light color's auto-computed variant
 * (autoDarkVariant()) rather than to no color at all - only ever meaningful
 * on an id that already has a light-mode color saved.
 * @param id the element's data-edit-id or data-resize-id
 * @param value a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkColor(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.dark_colors || typeof snapshot.dark_colors !== "object") snapshot.dark_colors = {};
  if (!value) delete snapshot.dark_colors[id];
  else snapshot.dark_colors[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists an opacity change from the style popover's slider into the
 * preview snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param value a number 0-1, or null/1 to clear back to the template default
 */
function saveEditedOpacity(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.opacity || typeof snapshot.opacity !== "object") snapshot.opacity = {};
  if (value === null || value === undefined || value >= 1) delete snapshot.opacity[id];
  else snapshot.opacity[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a textbox's background fill from the style popover's Fill
 * control into the preview snapshot, the same draft everything else here
 * uses. Separate map from content.colors since a text field's "Color" row
 * already means its font color (see colorTarget()); fill is its surface.
 * @param id the element's data-edit-id
 * @param value a css color string, or "" to clear back to no fill
 */
function saveEditedFill(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.fill || typeof snapshot.fill !== "object") snapshot.fill = {};
  if (!value) delete snapshot.fill[id];
  else snapshot.fill[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a dark-mode fill override (the style popover's "dark mode color"
 * toggle under Fill), same idea as saveEditedDarkColor() but for
 * content.dark_fill.
 * @param id the element's data-edit-id
 * @param value a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkFill(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.dark_fill || typeof snapshot.dark_fill !== "object") snapshot.dark_fill = {};
  if (!value) delete snapshot.dark_fill[id];
  else snapshot.dark_fill[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a value into one flat, id-keyed map of the preview snapshot,
 * deleting the key entirely when cleared - the shared body every
 * saveEdited*() function above hand-wrote per map; factored here only for
 * the four new progress-color maps (saveEditedProgressFill() etc. just
 * below) rather than retrofitted onto the older ones, to keep this change
 * from touching code it doesn't need to.
 * @param mapKey the snapshot's top-level key, eg "progress_fill"
 * @param id the element's data-resize-id
 * @param value any truthy value to store, or "" to delete the key
 */
function saveEditedMapValue(mapKey, id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot[mapKey] || typeof snapshot[mapKey] !== "object") snapshot[mapKey] = {};
  if (!value) delete snapshot[mapKey][id];
  else snapshot[mapKey][id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a "progress" element's fill-color pick from the style popover's
 * Progress color row into the preview snapshot, the same draft everything
 * else here uses.
 * @param id the element's data-resize-id
 * @param value a css color string, or "" to clear back to the default
 */
function saveEditedProgressFill(id, value) { saveEditedMapValue("progress_fill", id, value); }

/**
 * Persists a dark-mode override for the row above (the "dark mode progress
 * color" toggle), same idea as saveEditedDarkColor() but for
 * content.dark_progress_fill.
 * @param id the element's data-resize-id
 * @param value a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkProgressFill(id, value) { saveEditedMapValue("dark_progress_fill", id, value); }

/**
 * Persists a "progress" element's track/background color pick from the
 * style popover's Bar color row into the preview snapshot.
 * @param id the element's data-resize-id
 * @param value a css color string, or "" to clear back to the default
 */
function saveEditedProgressTrack(id, value) { saveEditedMapValue("progress_track", id, value); }

/**
 * Persists a dark-mode override for the row above, same idea as
 * saveEditedDarkColor() but for content.dark_progress_track.
 * @param id the element's data-resize-id
 * @param value a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkProgressTrack(id, value) { saveEditedMapValue("dark_progress_track", id, value); }

/**
 * Persists a button's text-color change from the style popover's Text
 * color control into the preview snapshot, the same draft everything else
 * here uses. Separate map from content.colors since a button's "Color" row
 * already means its background (see colorTarget()); this is its label.
 * @param id the button's data-edit-id
 * @param value a css color string, or "" to clear back to the default
 */
function saveEditedTextColor(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.text_color || typeof snapshot.text_color !== "object") snapshot.text_color = {};
  if (!value) delete snapshot.text_color[id];
  else snapshot.text_color[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a dark-mode text-color override (the style popover's "dark mode
 * color" toggle under Text color, buttons only), same idea as
 * saveEditedDarkColor() but for content.dark_text_color.
 * @param id the button's data-edit-id
 * @param value a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkTextColor(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.dark_text_color || typeof snapshot.dark_text_color !== "object") snapshot.dark_text_color = {};
  if (!value) delete snapshot.dark_text_color[id];
  else snapshot.dark_text_color[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists an image/video tint change from the style popover's Tint
 * control into the preview snapshot, the same draft everything else here
 * uses.
 * @param id the element's data-resize-id
 * @param value a css color string, or "" to remove the tint
 */
function saveEditedTint(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.tint || typeof snapshot.tint !== "object") snapshot.tint = {};
  if (!value) delete snapshot.tint[id];
  else snapshot.tint[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists an image/video shade change from the style popover's Shade
 * control into the preview snapshot, the same draft everything else here
 * uses.
 * @param id the element's data-resize-id
 * @param value a 0-1 number, or 0 to remove the shade
 */
function saveEditedShade(id, value) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.shade || typeof snapshot.shade !== "object") snapshot.shade = {};
  if (!value) delete snapshot.shade[id];
  else snapshot.shade[id] = value;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a border-radius change from the style popover's Radius slider.
 * @param id the element's data-edit-id or data-resize-id
 * @param px a whole-number px value, 0 to clear back to the template default
 */
function saveEditedRadius(id, px) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.radius || typeof snapshot.radius !== "object") snapshot.radius = {};
  if (!px) delete snapshot.radius[id];
  else snapshot.radius[id] = px;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a border width/color change from the style popover's Border row.
 * @param id the element's data-edit-id or data-resize-id
 * @param w border width in css px, 0 to clear back to no border
 * @param color a css color string (ignored when w is 0)
 */
function saveEditedBorder(id, w, color) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.border || typeof snapshot.border !== "object") snapshot.border = {};
  if (!w) delete snapshot.border[id];
  else snapshot.border[id] = { w: w, color: color };
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a dark-mode border-color override (the style popover's "dark
 * mode color" toggle under Border) into content.dark_border, same draft as
 * saveEditedBorder(). Only ever stores {color}: border width isn't
 * theme-dependent, the light side's own w always wins (see
 * applyBorderOverrides()).
 * @param id the element's data-edit-id or data-resize-id
 * @param color a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkBorder(id, color) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.dark_border || typeof snapshot.dark_border !== "object") snapshot.dark_border = {};
  if (!color) delete snapshot.dark_border[id];
  else snapshot.dark_border[id] = { color: color };
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a right-click "Add link"/"Edit link" change into the preview
 * snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param url the link target, or "" to clear it
 */
function saveEditedLink(id, url) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.links || typeof snapshot.links !== "object") snapshot.links = {};
  if (!url) delete snapshot.links[id];
  else snapshot.links[id] = url;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists the shared drop-shadow toggle (see BOX_SHADOW_VALUE) into the
 * preview snapshot as a flat list of ids, the same shape content.locked/
 * content.fixed_elements already use for a per-id boolean flag.
 * @param id the element's data-edit-id or data-resize-id
 * @param on true to add the shadow, false to remove it
 */
function saveEditedShadow(id, on) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!Array.isArray(snapshot.shadow)) snapshot.shadow = [];
  var idx = snapshot.shadow.indexOf(id);
  if (on && idx === -1) snapshot.shadow.push(id);
  else if (!on && idx !== -1) snapshot.shadow.splice(idx, 1);
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Still logged in from a previous visit? Point the nav link back at your
 * portal and show a log out button, instead of always saying "Access
 * portal", which read as having been logged out. Skipped in preview mode:
 * a ta previewing the landing page is always logged in as themselves, but
 * a real visitor wouldn't be, so the preview should show the logged-out nav.
 */
function updatePortalLink() {
  if (isPreviewMode()) {
    /* previewing isn't a real visit: don't let "Access portal", the brand
       logo, or "See more in the gallery" wander the ta off into another
       page while they're just checking their edits (the gallery gets its
       own preview tab, separate from the landing page, see js/preview.js) */
    neuterLink(document.getElementById("portalLink"));
    neuterLink(document.querySelector(".brand"), false);
    neuterLink(document.getElementById("galleryLink"));
    return;
  }
  var link = document.getElementById("portalLink");
  var outBtn = document.getElementById("logoutBtn");
  var navJoin = document.getElementById("navJoinLink");
  if (!link) return;
  var session = localStorage.getItem("session");
  var role = localStorage.getItem("role");
  if (!session || !role) return;
  link.textContent = role === "ta" ? "Staff Portal" : "Dashboard";
  link.href = role === "ta" ? "instructor.html" : "dashboard.html";
  /* Apply Now next to Gallery would be a dead prompt to sign up again,
     hide it while logged in (only in this nav bar, not the rest of the page) */
  if (navJoin) navJoin.style.display = "none";
  if (!outBtn) return;
  outBtn.style.display = "";
  outBtn.addEventListener("click", function () {
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("last_active");
    link.textContent = "Access portal";
    link.href = "login.html";
    if (navJoin) navJoin.style.display = "";
    outBtn.style.display = "none";
  });
}

/**
 * The shared tail of a real page's (as opposed to the object mini editor's
 * blank canvas, see initObjectCanvas()) content load: every generic
 * apply*Overrides() pass plus the edit-mode-gated wiring, factored out so
 * templates/index.html and templates/dashboard.html's DOMContentLoaded
 * handlers (see initDashboardPage()) run the exact same pipeline instead of
 * two copies that could quietly drift apart. Landing-page-only concerns
 * (hero countdown/logistics/video, home images, join url/tooltip) stay in
 * each page's own handler, called before this.
 * @param data the fetched content dict
 * @param textMap click-to-edit overrides to apply, defaults to data.text -
 *   index.html passes its own merged copy (see the footer.contact fallback
 *   in its DOMContentLoaded handler below), dashboard has no such fallback
 *   to merge so it just lets this default
 */
function applySharedEditorOverrides(data, textMap) {
  renderCustomElements(data.custom_elements);
  renderDuplicates(data.duplicates);
  applyTextOverrides(textMap !== undefined ? textMap : (data.text || {}));
  repaintInlineTextColors();
  applyThemeIconOverrides(data.theme_icons);
  if (window.refreshThemeToggles) window.refreshThemeToggles();
  applySizeOverrides(data.sizes);
  applyFontSizeOverrides(data.font_sizes);
  applyTextStyleOverrides(data.text_styles);
  applyPositionOverrides(data.positions);
  applyColorOverrides(data.colors, data.dark_colors);
  applyFillOverrides(data.fill, data.dark_fill);
  applyTextColorOverrides(data.text_color, data.dark_text_color);
  applyTintOverrides(data.tint);
  applyShadeOverrides(data.shade);
  applyRadiusOverrides(data.radius);
  applyBorderOverrides(data.border, data.dark_border);
  VARIABLES = data.variables || [];
  applyProgressBindings(data.progress_fill, data.dark_progress_fill, data.progress_track, data.dark_progress_track);
  repaintFormulaChips();
  applyShadowOverrides(data.shadow);
  applyOpacityOverrides(data.opacity);
  applyHiddenOverrides(data.hidden);
  setFixedElements(data.fixed_elements);
  setLockedElements(data.locked);
  setLinks(data.links);
  applyGroups(data.groups);
  applyLayerOrder(data.layers);
  applyFixedHighlight();
  applyLinkHighlight();
  applyLockHighlight();
  applyElementAnchors();
  if (window.initAllReels) window.initAllReels();
  /* js/dashboard.js's own renderExtras()/renderDays() also run off its own
     independent fetchContent() call (see initDashboardPage()'s doc comment)
     and race this one - whichever finishes second is the one that actually
     has somewhere to render into (this function is what builds the
     "extrasArea"/"daysArea" custom elements those render tiles inside), so
     both sides trigger a render attempt and the earlier one just no-ops,
     same window.-gated cross-script pattern as window.initAllReels above */
  if (window.renderExtras) window.renderExtras();
  if (window.renderDays) window.renderDays();
  if (isPreviewMode() && isEditMode()) {
    wireResizable();
    wireClickToEdit();
    wireAddElementMenu();
    /* fire-and-forget: only needed once a ta actually opens the right-click
       menu's "Object..." picker, not before the editor can be used at all */
    fetchObjectsLibrary().then(function (list) { OBJECTS_LIBRARY = list; });
  }
}

/**
 * Boots the shared visual-editor engine on the student dashboard
 * (templates/dashboard.html, identified by its #dashProgressAnchor spacer -
 * see applySharedEditorOverrides()/applyElementAnchors()). Unlike the
 * landing page there's no hardcoded countdown/logistics/hero markup to
 * hydrate here - the days/extras lists stay js/dashboard.js's own separate,
 * hand-rolled rendering, entirely untouched by this file - this only wires
 * up the generic override pipeline every custom-placed element (right now,
 * just the migrated progress bar) needs, gated into edit affordances the
 * exact same isPreviewMode() && isEditMode() way index.html's own pipeline
 * is, so a real student loading this page directly never sees drag handles
 * or a right-click menu, only the rendered result.
 */
function initDashboardPage() {
  fetchContent()
    .then(function (data) { applySharedEditorOverrides(data); })
    .catch(function () {});
}

/**
 * Boots the reusable-object mini editor's blank canvas
 * (templates/object-editor.html, ?object=1&edit=1): no landing-page markup
 * to render (no countdown/logistics/hero video/nav), so this skips straight
 * to the same generic apply*Overrides()/wire*() pass fetchContent()'s
 * success handler runs below for index.html, just against the object
 * canvas's own "object_content" scene (see fetchObjectContent()/
 * snapshotKey()) instead of the real page's content. Always wired up as if
 * &edit=1 were set, unlike index.html's own gate on isPreviewMode() &&
 * isEditMode(): an object canvas only ever exists to be edited, there's no
 * "look-only" mode for it the way a page preview has.
 */
function initObjectCanvas() {
  fetchObjectContent().then(function (data) {
    renderCustomElements(data.custom_elements);
    renderDuplicates(data.duplicates);
    applyTextOverrides(data.text || {});
    repaintInlineTextColors();
    applyThemeIconOverrides(data.theme_icons);
    if (window.refreshThemeToggles) window.refreshThemeToggles();
    applySizeOverrides(data.sizes);
    applyFontSizeOverrides(data.font_sizes);
    applyTextStyleOverrides(data.text_styles);
    applyPositionOverrides(data.positions);
    applyColorOverrides(data.colors, data.dark_colors);
    applyFillOverrides(data.fill, data.dark_fill);
    applyTextColorOverrides(data.text_color, data.dark_text_color);
    applyTintOverrides(data.tint);
    applyShadeOverrides(data.shade);
    applyRadiusOverrides(data.radius);
    applyBorderOverrides(data.border, data.dark_border);
    VARIABLES = data.variables || [];
    applyProgressBindings(data.progress_fill, data.dark_progress_fill, data.progress_track, data.dark_progress_track);
    repaintFormulaChips();
    applyShadowOverrides(data.shadow);
    applyOpacityOverrides(data.opacity);
    applyHiddenOverrides(data.hidden);
    setFixedElements(data.fixed_elements || []);
    setLockedElements(data.locked);
    setLinks(data.links);
    applyGroups(data.groups);
    applyLayerOrder(data.layers);
    applyFixedHighlight();
    applyLinkHighlight();
    applyLockHighlight();
    var hint = document.getElementById("objCanvasHint");
    if (hint) hint.style.display = (data.custom_elements || []).length ? "none" : "";
    if (window.initAllReels) window.initAllReels();
    wireResizable();
    wireClickToEdit();
    wireAddElementMenu();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  /* the object mini editor (templates/object-editor.html, js/object-editor.js)
     first has to resolve which saved object (if any) this session is
     editing and stash its data into localStorage's "object_content" key
     before the canvas can render it; that's an async server round trip
     (GET /api/objects), so initObjectCanvas() isn't safe to call yet, it'd
     race that fetch. object-editor.js calls it itself (a plain top-level
     function declaration, already reachable as window.initObjectCanvas)
     once that's settled, instead of this file auto-running it here. */
  if (isObjectMode()) return;

  updatePortalLink();

  var slot = document.getElementById("heroCountdown");
  var grid = document.getElementById("logisticsGrid");
  if (!slot) {
    /* not the landing page - the only other page this file's shared editor
       engine is wired onto right now is the student dashboard, identified
       by its #dashProgressAnchor spacer (see initDashboardPage()); anything
       else (gallery.html, login.html, ...) just isn't wired up yet */
    if (document.getElementById("dashProgressAnchor")) initDashboardPage();
    return;
  }

  function renderTiles(list) {
    if (!grid) return;
    grid.innerHTML = "";
    list.forEach(function (t, i) { grid.appendChild(logisticsTile(t, i)); });
  }

  function setJoinUrl(url) {
    document.querySelectorAll(".join-link").forEach(function (a) { a.href = url; });
  }

  function setApplyTooltip(text) {
    document.querySelectorAll(".join-link").forEach(function (a) { a.setAttribute("data-tooltip", text); });
  }

  /**
   * Points the hero's background video at a staff-uploaded clip instead of
   * the hardcoded default, reloading it so the new src actually takes.
   * @param url video url (staff upload or the default assets/cover-video.mp4)
   */
  function setHeroVideo(url) {
    var video = document.querySelector(".hero-bg");
    if (!video || video.getAttribute("src") === url) return;
    video.setAttribute("src", url);
    video.load();
  }

  /**
   * Points each landing-page photo slot (about section + certificate) at a
   * staff-uploaded replacement, if set, falling back to the template's own
   * default otherwise.
   * @param images content.home_images, {slot key: url}
   */
  function setHomeImages(images) {
    images = images || {};
    Object.keys(HOME_IMAGE_ELS).forEach(function (key) {
      var el = document.getElementById(HOME_IMAGE_ELS[key]);
      if (!el) return;
      el.src = images[key] || DEFAULT_HOME_IMAGES[key];
    });
  }

  fetchContent()
    .then(function (data) {
      if (data.timer_mode === "actual" && data.timer_target) {
        slot.innerHTML = CD_CLOCK_HTML;
        startCountdown(data.timer_target);
      } else {
        slot.innerHTML = CD_TBA_HTML;
      }

      renderTiles(resolveLogistics(data));
      setJoinUrl(data.join_url || DEFAULT_JOIN_URL);
      setApplyTooltip(data.apply_tooltip || DEFAULT_APPLY_TOOLTIP);
      setHeroVideo(data.hero_video_url || DEFAULT_HERO_VIDEO);
      setHomeImages(data.home_images);

      /* the footer contact line used to be its own content.contact_text
         field; it's click-to-edit now like the rest of the landing page
         copy (content.text["footer.contact"]), but an old saved blob a ta
         hasn't reopened the portal on since this shipped only has the old
         field, so fall back to it here rather than losing their text */
      var textMap = data.text ? Object.assign({}, data.text) : {};
      if (textMap["footer.contact"] === undefined && data.contact_text) {
        textMap["footer.contact"] = data.contact_text;
      }
      applySharedEditorOverrides(data, textMap);
    })
    .catch(function () {
      slot.innerHTML = CD_TBA_HTML;
      renderTiles(DEFAULT_LOGISTICS);
      setJoinUrl(DEFAULT_JOIN_URL);
      setApplyTooltip(DEFAULT_APPLY_TOOLTIP);
      applyTextOverrides({});
      if (window.initAllReels) window.initAllReels();
    });
});
