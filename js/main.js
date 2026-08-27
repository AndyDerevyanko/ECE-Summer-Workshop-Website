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
 * Builds one logistics tile ("2 weeks", "4 hours", "SFB520", certificate).
 * @param t {big, lbl, icon} tile data
 * @param i the tile's index in the logistics array
 * @return the tile's card element
 * @note Text is click-to-editable and tagged with the tile's index, so an
 * edit writes back into content.logistics rather than a template-default
 * override. Text only: the tiles render from that array, not from their own
 * markup, which is why the right-click menu leaves them out of
 * Duplicate/Delete - so the array's LENGTH has no ui behind it at all.
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
 * Checks whether this page is the reusable-object mini editor's blank canvas.
 * @return true if ?object=1 is set
 * @note Same click-to-edit/resize/colour/group engine as the Visual editor
 * tab, aimed at building one reusable bundle instead of the live page.
 */
function isObjectMode() {
  return /[?&]object=1(&|$)/.test(window.location.search);
}

/**
 * The localStorage key every save*()/apply*Overrides() draft here reads and
 * writes: the shared "preview_content" snapshot, or the object editor's own
 * "object_content" scene when isObjectMode().
 * @return the localStorage key to use
 * @note This one switch is what lets the whole editor engine work unmodified
 * against a blank object canvas - same code path, different storage.
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

/* the object-editor.html tab opened from the right-click menu's "New
   object...", reused rather than reopened on repeat clicks. Same window NAME
   as ta.js's openObjectEditor(), so opening from either place reuses one
   tab. */
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
 * token, same convention as assetFetch()).
 * @return a promise resolving to the objects list
 * @note Resolves to [] on any failure rather than rejecting, so a visitor's
 * page load or an expired session sees an empty picker, not a broken page.
 */
function fetchObjectsLibrary() {
  return assetFetch("/api/objects")
    .then(function (res) { return res.ok ? res.json() : []; })
    .catch(function () { return []; });
}

/**
 * Loads whatever is in the object editor's canvas, plus the shared objects
 * library - so a saved object is placeable inside another object too.
 * @return a promise resolving to the canvas's current content-shaped scene
 * @note Mirrors fetchContent()'s "read the draft, mojibake-repair it" shape,
 * but the scene is never /api/content: an object canvas has no page to fall
 * back to.
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
 * Reverses "typed as utf-8, misread as windows-1252" mojibake, without
 * touching genuinely accented text.
 * @param str the string to check/repair
 * @return the repaired string, or the original untouched if it wasn't mojibake
 * @note Only fires if every character maps to a single cp1252 byte AND those
 * bytes form valid utf-8, which latin-1 text almost never does by chance.
 * Loops so twice-corrupted text unwraps in one call, capped so it can't spin.
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
 * Backfills any SEEDED custom element (every id the server owns rather than
 * a ta, marked by its "seed."/"learn." prefix) that the live content has but
 * a preview snapshot doesn't.
 * @param snapshot the parsed preview snapshot (mutated in place)
 * @param live the live content from /api/content
 * @return snapshot
 * @note A snapshot is a full copy taken when the ta opened the portal, and
 * preview renders it INSTEAD of the live blob. So the moment a new seeded
 * element ships, a ta on an older draft previews a page missing it - for the
 * login page, a card with no form - and hitting Apply writes that stale list
 * back over live content. This is the one thing a snapshot isn't allowed to
 * be stale about.
 * @note Only ADDS ids that are absent entirely, which is safe against a
 * deliberate delete: deleting keeps the descriptor and records the id in
 * content.hidden, so a missing descriptor can only mean "this draft predates
 * that element".
 */
function mergeSeededElements(snapshot, live) {
  var have = {};
  var added = false;
  (snapshot.custom_elements || []).forEach(function (c) { have[c.id] = true; });
  (live.custom_elements || []).forEach(function (c) {
    if (have[c.id] || !/^(seed|learn)\./.test(String(c.id))) return;
    (snapshot.custom_elements = snapshot.custom_elements || []).push(c);
    added = true;
    /* the styling those elements ship with is seeded alongside them (eg the
       login boxes' corner rounding, the progress bar's fill/track colors), so
       it has to come across too or a restored element renders unstyled */
    ["radius", "progress_fill", "progress_track", "text", "font_sizes", "text_styles", "colors"].forEach(function (map) {
      if (!live[map]) return;
      Object.keys(live[map]).forEach(function (id) {
        if (id.indexOf(c.id) !== 0) return;
        snapshot[map] = snapshot[map] || {};
        if (snapshot[map][id] === undefined) snapshot[map][id] = live[map][id];
      });
    });
  });
  /* written straight back, not just handed to the renderer: js/ta.js's
     Apply/Save reads this same draft back out of localStorage
     (pullStateFromEditor()) and posts it wholesale, so a heal that only
     existed in memory would render correctly and then be undone the moment
     the ta applied - taking the live site's own copy down with it */
  if (added) {
    try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
  }
  return snapshot;
}

/**
 * Resolves to the site content: the portal's unsaved snapshot in preview
 * mode, otherwise the live content from /api/content.
 * @return a promise resolving to the content object
 * @note Everything goes through repairMojibakeDeep() first, so a corrupted
 * snapshot or old blob never reaches a visitor's screen.
 * @note In preview mode the live blob is fetched as well, purely to top the
 * snapshot up with any seeded element it's missing (see
 * mergeSeededElements()). If that fetch fails the snapshot is used as-is.
 */
function fetchContent() {
  if (isPreviewMode()) {
    var snapshot = null;
    try {
      var raw = localStorage.getItem(snapshotKey());
      if (raw) snapshot = repairMojibakeDeep(JSON.parse(raw));
    } catch (e) {}
    if (snapshot) {
      return fetch("/api/content")
        .then(function (res) { return res.json(); })
        .then(function (live) { return mergeSeededElements(snapshot, repairMojibakeDeep(live)); })
        .catch(function () { return snapshot; });
    }
    /* no draft yet, and this page is about to start writing one: every
       save*() merges its one override into whatever is in localStorage, so
       starting from nothing leaves a blob holding ONLY that override - which
       Apply/Save then reads back as the ta's whole content and saves over the
       real thing. Seed the draft with live content first. */
    if (isEditMode()) {
      return fetch("/api/content")
        .then(function (res) { return res.json(); })
        .then(repairMojibakeDeep)
        .then(function (live) {
          try { localStorage.setItem(snapshotKey(), JSON.stringify(live)); } catch (e) {}
          return live;
        });
    }
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
 * Returns the logistics tiles to render, migrating old-shaped content on the
 * fly.
 * @param data the content blob from /api/content
 * @return an array of {big, lbl, icon} tiles
 * @note Content saved before the workshop-dates tile was folded into this
 * list has no "logistics" key, just the old date_mode/weeks_label fields, so
 * a first tile is built from those rather than losing the saved dates.
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
 * A small strftime for the static datetime formats, enough tokens for the
 * common cases without pulling in a date library (vanilla JS only).
 * @param date the Date to format
 * @param pattern the strftime pattern string
 * @return the formatted string
 * @note "%-x" is the non-zero-padded variant of "%x", "%%" a literal percent;
 * an unknown token is left as written so a typo is visible.
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
 * The countdown counterpart to strftimeFormat(), over a remaining duration
 * rather than a wall clock.
 * @param diffMs milliseconds remaining until the target
 * @param pattern the pattern string
 * @return the formatted countdown string
 * @note %D total days, %H/%M/%S the zero-padded remainders, %T total hours,
 * "%-x" the non-padded variant of each. An already-past diff clamps to zero.
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
 * Produces one datetime element's displayed string from its own {target,
 * format, strftime} data.
 * @param d the element's custom_elements entry
 * @param nowMs current time in ms (only used by countdown)
 * @return the string to display, "" if the target doesn't parse
 * @note A blank strftime falls back to that format's default pattern.
 * Countdown counts toward the target; every other format renders the target
 * timestamp itself and never ticks.
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
 * Whether a datetime format needs a live ticking interval.
 * @param format the datetime element's format
 * @return true if it should tick
 * @note Only countdown changes second to second; the static formats render
 * their fixed target once.
 */
function datetimeIsLive(format) {
  return (format || "countdown") === "countdown";
}

/**
 * Formats a Date as the local "YYYY-MM-DDTHH:mm" string a datetime-local
 * input expects - the visitor's own local time, not UTC.
 * @param d the Date
 * @return the datetime-local input value
 */
function toDatetimeLocalValue(d) {
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

/**
 * (Re)paints one datetime element's text and, for a countdown, (re)starts its
 * ticking interval - clearing any previous one first, so calling this again
 * never leaks a timer.
 * @param el the datetime element (data-datetime already set)
 * @param d its custom_elements entry ({target, format, strftime})
 * @note It's a plain text element, styleable like any text field, not the
 * hero countdown's boxed clock: the standalone "Date/time" element is just
 * the reformattable time text, and the "Countdown timer" object is what
 * composes it with a box and labels.
 */
function renderDatetimeContent(el, d) {
  if (el._dtInterval) { clearInterval(el._dtInterval); el._dtInterval = null; }
  var paint = function () { el.textContent = datetimeText(d, Date.now()); };
  paint();
  if (datetimeIsLive(d.format)) el._dtInterval = setInterval(paint, 1000);
}

/**
 * Remembers a template link's real href on the element itself, before
 * neuterLink() strips it off.
 * @param el the link about to lose its href
 * @note Without this the target is simply gone inside the editor - which is
 * exactly where "Links on this page" has to READ it, so a ta asking where the
 * brand logo goes would see a blank beside every neutered link.
 * @note Never overwrites an existing stash, so a second neuterLink() pass
 * can't record the already-stripped "" over the real value.
 */
function stashBuiltinHref(el) {
  var href = el.getAttribute && el.getAttribute("href");
  if (href && !el.hasAttribute("data-builtin-href")) el.setAttribute("data-builtin-href", href);
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
  stashBuiltinHref(el);
  el.removeAttribute("href");
  if (dim !== false) {
    el.style.opacity = ".5";
    el.style.cursor = "default";
  }
  /* at most one swallowing listener per element however often this runs -
     applyNavSessionState() neuters the nav on every override pass. A JS
     property rather than an attribute, so a cloneNode()d duplicate (which
     copies attributes but never properties) correctly reads as not-yet-wired
     and gets its own. */
  if (el._hrNeutered) return;
  el._hrNeutered = true;
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
 * Identifies which real page this document is, regardless of the shared
 * ?preview=1/?edit=1 params: "dashboard" if the progress-bar anchor is
 * present, "login" if the auth card is, "gallery" if the year-picker marker
 * is, "notfound" if the not-found marker is, else "index" - which is also the
 * object editor's blank canvas, since a saved object has no page of its own
 * until it's dropped somewhere.
 * @return "index", "dashboard", "login", "gallery", or "notfound"
 * @note content.custom_elements is one unscoped list across the whole site,
 * so every entry carries the page it was created on and renderCustomElements()
 * builds only the ones belonging here - otherwise a landing-page element like
 * the reel would show up on the dashboard at its raw landing-page offset.
 */
function currentPageKey() {
  if (document.getElementById("dashProgressAnchor")) return "dashboard";
  /* the auth card itself, not one of the four form spacers: those are what
     the login page's own elements anchor TO, and a page identity that could
     be knocked out by a ta deleting an element would take the whole page's
     custom_elements filter down with it (see renderCustomElements()) */
  if (document.getElementById("loginCard")) return "login";
  /* the gallery's directory-rail spacer (templates/gallery.html): the same
     kind of marker the other two use - a reserved in-flow spacer, not one of
     the placed elements that anchor to it, so a ta deleting the rail can't
     take the page's own identity down with it */
  if (document.getElementById("galleryDirsAnchor")) return "gallery";
  /* the not-found page (templates/404.html), same kind of reserved marker: it
     is served for any url that matches nothing, so it's the one page a visitor
     reaches by accident rather than on purpose - and a ta can lay it out here
     like any other */
  if (document.getElementById("notFoundAnchor")) return "notfound";
  return "index";
}

/**
 * Applies saved text overrides on top of the page's own hardcoded copy.
 * @param textMap {id: overrideHtml}, from content.text
 * @note Every data-edit-id keeps the template's default text until a ta
 * overrides it; that default is stashed in a data attribute first, so a later
 * edit can tell whether it's back to the original wording.
 * @note Stamps data-overridden on every field (cleared when there's no saved
 * override), so a theme toggle's label can be told apart from a plain
 * default: only an un-overridden field is kept in sync with the live theme.
 */
function applyTextOverrides(textMap) {
  document.querySelectorAll("[data-edit-id]").forEach(function (el) {
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
 * True for any element whose position is dictated entirely by shared template
 * CSS, never individually placed: a reel tile, which breaks its flex track if
 * detached, and a tile box itself.
 * @param el the element
 * @return true if el must never carry a position override
 * @note A tile ROLE (rect/icon/text/badge/button) used to be here too, back
 * when nothing inside a tile could move. Everything inside one moves freely
 * now, clamped to its own tile's box - safe because a role's saved {tx,ty} is
 * keyed by an id every sibling tile SHARES, so applying it to all of them is
 * the intended mirroring rather than the bug it once was.
 * @note A tile itself does need the check: its position isn't its own to set,
 * it's whatever its container's packing order gives it, so moving stays off
 * while resizing is on. The flow container around the tiles is what moves.
 */
function isMoveLockedTileRole(el) {
  return el.hasAttribute("data-reel-tile") || isTileBoxEl(el);
}

/**
 * True for one of a reel's content tiles.
 * @param el the element
 * @return true if el is a reel tile
 * @note A tile has no position or size of its own for the override maps to
 * carry - where it sits is its order in the track, and how big it is belongs
 * to the reel as a whole - so it stays move/resize-locked to the generic
 * overrides while being fully draggable through the two reel-specific paths.
 */
function isReelTileEl(el) {
  return !!(el && el.hasAttribute && el.hasAttribute("data-reel-tile"));
}

/**
 * The reel panel el belongs to (itself, if el IS one), or null.
 * @param el any element
 * @return the .reel panel, or null
 * @note Used wherever an edit on a tile applies to the whole reel: tile size,
 * tile order and both spacing sliders belong to the reel entry, not the tile.
 */
function reelPanelOf(el) {
  return el && el.closest ? el.closest(".reel") : null;
}

/* a reel's two spacing figures, when its entry doesn't carry its own (see
   reelGap()/reelPad()). The gap matches .reel-track's own stylesheet gap, so
   an untouched reel keeps looking exactly as it did before either slider
   existed; the cross-axis pad starts at nothing, since the tiles used to sit
   flush against the panel. */
var REEL_DEFAULT_GAP = 20;
var REEL_DEFAULT_PAD = 0;

/**
 * True for one of the dashboard's LIVE AREA containers - the attachments tile
 * list and the days tile grid, plus the attachments sub-area inside each open
 * day tile.
 * @param el the element
 * @return true if el is one of the tile containers
 * @note Unlike every other tracked element, a live area isn't content in its
 * own right: it's the transparent box the tiles lie in. So it's always
 * background-less in the style popover, sized on each axis by its own lock
 * rather than a stored box, and everything inside belongs TO it rather than
 * merely sitting on top of it.
 */
function isLiveAreaEl(el) {
  return !!(el.hasAttribute && (el.hasAttribute("data-extras-area") ||
    el.hasAttribute("data-days-area") || el.hasAttribute("data-flow-area")));
}

/**
 * True for one of the three TILE FLOW CONTAINERS - the attachments area, the
 * days area, and the sub-area embedded in each open day tile.
 * @param el the element
 * @return true if el is a tile flow container
 * @note All three carry data-flow-area plus a data-tile-id naming the shared
 * id of the tiles they lay out, and all three go through applyTileFlow().
 * @note A superset of isLiveAreaEl()'s original two: the day-embedded
 * sub-area is a role element rather than a placed one, but it wants every
 * same exception, so isLiveAreaEl() matches it too.
 */
function isFlowAreaEl(el) {
  return !!(el && el.hasAttribute && el.hasAttribute("data-flow-area"));
}

/**
 * True for one TILE inside a flow container: a day card, or an attachment
 * tile.
 * @param el the element
 * @return true if el is a tile box
 * @note Resizable - that's how a ta decides how many fit per row - but never
 * movable and never deletable, since a tile isn't decoration a ta placed but
 * one rendering of a piece of real content.
 */
function isTileBoxEl(el) {
  return !!(el && el.hasAttribute &&
    (el.hasAttribute("data-days-tile") || el.hasAttribute("data-extras-tile") ||
     el.hasAttribute("data-gallery-tile")));
}

/* how each flow container behaves per axis when a ta hasn't said otherwise:
   the two top-level areas grow downwards to fit their tiles, while a day
   tile's attachment sub-area is pinned on both axes, so one day with eight
   files scrolls rather than stretching the card. "lock" = keep the
   container's size and let whatever doesn't fit scroll; "expand" = size it
   to its content. A locked axis never squeezes the tiles themselves - see
   .tile-flow's grid-auto-rows in css/style.css for why that took saying. */
var AREA_FLOW_DEFAULTS = {
  "seed.dashboard.extras.area": { x: "lock", y: "expand" },
  "seed.dashboard.days.area": { x: "lock", y: "expand" },
  "days.open.attachments": { x: "lock", y: "lock" },
  /* the gallery's directory rail is the one container that ships STACKED
     rather than side by side - a narrow column beside the photo - so its
     default names a dir where the others name their axis locks. Everything
     else about it works identically. */
  "seed.gallery.dirs.area": { x: "lock", y: "expand", dir: "column" }
};
/* content.area_flow, {id: {x, y, dir, wrap, gap}} - only what a ta has actually
   changed */
var AREA_FLOW = {};

/* how far apart a flow container's tiles sit when a ta hasn't said otherwise.
   Matches the fallback baked into .tile-flow's own `gap: var(--tile-gap, 10px)`
   in css/style.css, so a container nobody has touched keeps looking exactly as
   it did before the slider existed. */
var TILE_GAP_DEFAULT = 10;

/**
 * The layout behaviour in force for one flow container: its saved override
 * over its default.
 * @param id the container's data-resize-id
 * @return {x, y} (each "lock" or "expand"), dir, wrap, gap
 * @note "dir"/"wrap" are the tile stacking controls, the flexbox model a ta
 * already has an intuition for: dir picks the axis tiles run along and which
 * way, wrap picks which side the overflow goes to. Every container defaults
 * to row/normal, the grid layout that shipped before this existed - see
 * .tile-flow in css/style.css for why only that combination stays on grid.
 * @note "gap" is the space between tiles on both axes at once, since a
 * wrapping layout has rows as well as columns. It belongs to the container,
 * like the axis locks. (A reel's strip has a genuine empty second axis, which
 * is why that gets two sliders instead.)
 */
function areaFlowFor(id) {
  var saved = AREA_FLOW[id] || {};
  var def = AREA_FLOW_DEFAULTS[id] || { x: "lock", y: "expand" };
  /* a responsive band changing this container's stacking at the current width
     wins over the saved answer, and loses to nothing - it IS the saved answer
     re-read for today's width. Merged in here rather than painted by
     paintResponsive() so the whole tile pipeline (applyTileFlow(), the drag
     and reorder paths, minContentWidthOf()) picks it up without a single one
     of them needing to know this layer exists. */
  var rs = RESPONSIVE_FLOW[id];
  if (rs) saved = Object.assign({}, saved, rs);
  /* 0 is a real, deliberate answer here ("tiles flush against each other"), so
     the gap is tested for undefined rather than for falsiness the way the four
     string fields can safely be */
  var gap = saved.gap;
  if (gap === undefined) gap = def.gap;
  if (gap === undefined) gap = TILE_GAP_DEFAULT;
  return {
    x: saved.x || def.x,
    y: saved.y || def.y,
    dir: saved.dir || def.dir || "row",
    wrap: saved.wrap || def.wrap || "normal",
    gap: gap,
    /* where the tiles sit when the container is wider (justify) or taller
       (align) than they need. Only ever set by a responsive band right now -
       "" means "leave it to the stylesheet", which is the stretch-to-fill
       grid every container has always laid out as. */
    justify: saved.justify || "",
    align: saved.align || ""
  };
}

/**
 * True if this container's stacking is anything but the shipped default
 * (tiles left-to-right, overflowing downwards).
 * @param flow an areaFlowFor() result
 * @return true if the flex path applies
 * @note Only that one combination is laid out by css grid; the other seven
 * switch to flexbox - see the .tile-flex block in css/style.css.
 */
function areaFlowIsFlex(flow) {
  return flow.dir !== "row" || flow.wrap !== "normal";
}

/**
 * The flow container that lays out one tile: its own parent, which is always
 * the container itself - a tile is a direct grid item, never wrapped.
 * @param tile a tile box
 * @return the container, or null
 */
function flowAreaOf(tile) {
  var p = tile && tile.parentElement;
  return p && isFlowAreaEl(p) ? p : null;
}

/**
 * The flow container one element BELONGS to - itself if it is one, otherwise
 * the innermost one it sits inside.
 * @param el any element
 * @return the container, or null if el isn't in or of one
 * @note The looser lookup flowAreaOf() deliberately won't do, for controls
 * that act on a container from wherever a ta happened to click (the spacing
 * slider, the right-click Container section). A container is almost entirely
 * covered by its tiles, so the selection is nearly always something inside it.
 */
function flowAreaForEl(el) {
  if (!el || !el.closest) return null;
  return isFlowAreaEl(el) ? el : el.closest("[data-flow-area]");
}

/**
 * Measures how narrow an element can get before its contents bleed out: css's
 * `min-content` width.
 * @param el the element to measure
 * @return its min-content width in css px
 * @note Measured by laying el out at min-content and reading the result back,
 * rather than adding up its parts here: the parts differ per template and
 * change whenever either does, while `min-content` is the browser's own
 * answer to the exact question. That write/read/restore is a synchronous
 * forced reflow, so callers do it ONCE per resize drag, never per mousemove.
 */
function minContentWidthOf(el) {
  /* every .free-wrap inside el is relaxed for the measurement. A wrap carries
     a hard px width - the flow slot it froze open when its element was
     detached - and a hard px width on an in-flow block IS its parent's
     min-content width as far as css is concerned. So one stale wrap answered
     this on the whole tile's behalf: a day card whose blurb froze at ~1030px
     reported that as its narrowest, and the first mousemove of ANY resize on
     that card snapped it to full width, one column, every day stacked.
     Relaxing them is also the honest answer: what a wrap holds is the slot of
     an element that is now absolutely positioned, and out-of-flow content
     can't bleed out of el however narrow el gets. */
  var wraps = [].slice.call(el.querySelectorAll(".free-wrap"));
  var wrapW = wraps.map(function (wrap) { return wrap.style.width; });
  wraps.forEach(function (wrap) { wrap.style.width = "auto"; });
  var w = el.style.width, mw = el.style.minWidth, xw = el.style.maxWidth;
  el.style.width = "min-content";
  el.style.minWidth = "min-content";
  el.style.maxWidth = "none";
  var out = el.getBoundingClientRect().width;
  el.style.width = w;
  el.style.minWidth = mw;
  el.style.maxWidth = xw;
  wraps.forEach(function (wrap, i) { wrap.style.width = wrapW[i]; });
  return out;
}

/**
 * The narrowest a flow container can be dragged: wide enough for its widest
 * tile's min-content width plus the container's own padding and border.
 * @param area a flow container
 * @return its minimum width in css px
 * @note This is the spec's hard stop - resizing physically refuses to move
 * the edges past the point where tiles would bleed out. Anything looser (a
 * tile squeezing rather than bleeding) is already handled by the grid itself.
 * @note An empty container has no tiles to protect, so it gets a small floor
 * rather than collapsing to nothing and becoming ungrabbable.
 */
function flowAreaMinWidth(area) {
  var min = 0;
  area.querySelectorAll(":scope > [data-days-tile], :scope > [data-extras-tile], " +
    ":scope > [data-gallery-tile]").forEach(function (t) {
    min = Math.max(min, minContentWidthOf(t));
  });
  if (!min) return 40;
  var cs = getComputedStyle(area);
  return Math.ceil(min +
    (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
    (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0));
}

/**
 * The largest one tile may be dragged to.
 * @param tile a tile box
 * @return {w, h} maximums in css px
 * @note Neither axis is capped any more: whichever the container has locked,
 * the CONTAINER takes the extra instead of the drag grinding to a halt.
 * A tile in a height-locked container simply refused to be dragged taller -
 * the handle moved and the tile didn't - and width did the same in every
 * x-locked container, worst on the gallery's 120px rail, where a tile could
 * never exceed 120px and nothing said why.
 * @note Growing a tile past its container is a request for more room, not an
 * error. Outwards only: dragging back smaller leaves the container where the
 * ta put it, since that size is now its own and not a measurement.
 */
function tileSizeCap(tile) {
  return { w: Infinity, h: Infinity };
}

/**
 * Grows a flow container outwards to hold tiles just dragged bigger than it,
 * and never shrinks it - the other half of tileSizeCap()'s uncapped axes.
 * @param tile the tile that just changed size
 * @param persist true once the drag has settled, to save the container's new
 *   size the way any other resize is saved
 * @note Neighbours follow for free, since a tile's size is its container's
 * track size (see setTileTrackSize()).
 * @note Only a LOCKED axis needs this - an expanding one is already sized by
 * its content. So this covers the dashboard areas' locked WIDTH, the day
 * card's sub-area, the gallery's 120px rail, and any axis a ta locked. The
 * whole id group grows together, so every day card in the row keeps matching.
 * @note The width a tile NEEDS can't be read back off the layout the way its
 * height can: both .tile-flow rules cap a track at min(--tile-w, 100%), so an
 * over-wide tile just squeezes and scrollWidth never grows to say so - which
 * is what made an over-wide drag look like it did nothing. The figure is read
 * off the tiles' own saved track width instead.
 */
function growFlowAreaForTiles(tile, persist) {
  var area = flowAreaOf(tile);
  var id = area && elId(area);
  if (!id) return;
  var flow = areaFlowFor(id);
  if (flow.x !== "lock" && flow.y !== "lock") return;
  var areas = flowAreasWithId(id);
  if (!areas.length) return;
  var saved = EDIT_SIZES[id] || {};
  /* a width is always part of the record: one without it is ignored wholesale
     on the next load (see applySizeOverrides()), which would throw any height
     saved beside it straight back out - same reasoning as pinFlowAreaHeight() */
  var box = {
    w: saved.w === undefined ? Math.round(areas[0].getBoundingClientRect().width) : saved.w,
    h: saved.h
  };
  var grew = false;
  if (flow.x === "lock") {
    var tileSize = EDIT_SIZES[areas[0].getAttribute("data-tile-id")];
    var wantTile = (tileSize && tileSize.w) || 0;
    var needW = 0;
    areas.forEach(function (a) {
      var cs = getComputedStyle(a);
      var chrome = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
        (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      needW = Math.max(needW, a.scrollWidth, wantTile ? wantTile + chrome : 0);
    });
    if (needW > (box.w || 0)) { box.w = Math.round(needW); grew = true; }
  }
  if (flow.y === "lock") {
    /* scrollHeight is what the tiles actually need; on a locked container
       that's exactly the figure the overflow is currently hiding */
    var needH = 0;
    areas.forEach(function (a) { needH = Math.max(needH, a.scrollHeight); });
    if (needH > (box.h || 0)) { box.h = needH; grew = true; }
  }
  if (!grew) return;
  EDIT_SIZES[id] = box;
  areas.forEach(function (a) {
    /* no detachFromFlow() on either axis: the two dashboard areas and the
       gallery rail are already out of flow (each is a placed element inside
       its own .free-wrap), and the day card's attachments sub-area is a plain
       in-flow child of the card that must stay one - pulling it out would drop
       the card's own height to nothing underneath it */
    if (flow.x === "lock") {
      a.style.width = box.w + "px";
      a.dataset.ovW = box.w;
    }
    if (flow.y === "lock" && box.h) {
      a.style.height = box.h + "px";
      a.dataset.ovH = box.h;
    }
  });
  if (persist) saveEditedSize(id, box);
}

/**
 * Applies one tile's size by re-tiling its CONTAINER rather than writing a
 * box onto the tile.
 * @param tile the tile being resized
 * @param w new tile width in css px
 * @param h new tile height in css px
 * @note A tile is a grid item, so "this tile is 200px wide" means "this
 * container's tracks are 200px wide" - which is also exactly why one tile's
 * resize re-tiles every sibling, giving the shared-template mirroring for
 * free with no second code path.
 * @note The size is still recorded on the tile's dataset under the shared id,
 * so commitSize()/getSize()/applySizeOverrides() work on it unchanged.
 */
function setTileTrackSize(tile, w, h) {
  tile.dataset.ovW = w;
  tile.dataset.ovH = h;
  var id = elId(tile);
  if (id) EDIT_SIZES[id] = { w: w, h: h };
  applyTileFlow();
  /* after the layout, not before: the container has to have been given its own
     locked height back before its scrollHeight says anything about whether the
     tiles still fit in it */
  growFlowAreaForTiles(tile);
}

/**
 * Lays out all three tile flow containers from current saved state: each
 * one's axis locks and the tile size its tiles share. Idempotent and cheap
 * enough to re-run after any edit that could change either.
 * @note Containers are handled in ID GROUPS, not one at a time, because a day
 * tile's sub-area renders once per day - same id, many elements - and they're
 * meant to agree, so every card in the row becomes taller together. With y
 * locked and no explicit height saved, that shared height is the TALLEST of
 * their natural heights, so locking by default clips nobody.
 */
function applyTileFlow() {
  var byId = {};
  document.querySelectorAll("[data-flow-area]").forEach(function (area) {
    var id = elId(area);
    if (!id) return;
    (byId[id] = byId[id] || []).push(area);
  });
  Object.keys(byId).forEach(function (id) {
    var areas = byId[id];
    var flow = areaFlowFor(id);
    var tileSize = EDIT_SIZES[areas[0].getAttribute("data-tile-id")];
    var tw = tileSize && tileSize.w ? tileSize.w + "px" : null;
    var th = tileSize && tileSize.h ? tileSize.h + "px" : null;
    /* the container's own untouched-tile default: "100%" (one per row) for
       both attachment lists, a real px track for the days grid, see
       buildCustomElementNode()'s "daysArea" kind */
    var defW = areas[0].getAttribute("data-tile-w") || "100%";
    areas.forEach(function (area) {
      area.classList.add("tile-flow");
      /* a tile whose width a ta has actually dragged sizes its own track
         exactly, rather than being stretched to fill the row - which is what
         makes the drag smooth instead of stepping between column counts, see
         .tile-w-set in css/style.css */
      area.classList.toggle("tile-w-set", !!tw);
      area.classList.toggle("flow-x-lock", flow.x === "lock");
      area.classList.toggle("flow-x-expand", flow.x === "expand");
      area.classList.toggle("flow-y-lock", flow.y === "lock");
      /* stacking (see areaFlowFor()): the shipped default stays on grid, the
         other seven combinations are flexbox, which is the only one of the
         two that can run tiles up/leftwards or wrap to the opposite side */
      area.classList.toggle("tile-flex", areaFlowIsFlex(flow));
      area.classList.toggle("flow-dir-row-reverse", flow.dir === "row-reverse");
      area.classList.toggle("flow-dir-column", flow.dir === "column");
      area.classList.toggle("flow-dir-column-reverse", flow.dir === "column-reverse");
      area.classList.toggle("flow-wrap-reverse", flow.wrap === "reverse");
      /* the container's own `gap`, read by .tile-flow on both the grid and the
         flex path (see areaFlowFor()) - one property, so a ta's spacing
         survives a stacking change instead of being a separate figure per
         layout mode */
      area.style.setProperty("--tile-gap", flow.gap + "px");
      /* both axes' alignment, written as real properties rather than classes
         because they're free-form values a band interpolates between - and
         cleared back to "" (not to a default) when no band is in force, so
         the stylesheet's own stretch behaviour comes back untouched */
      area.style.justifyContent = flow.justify || "";
      area.style.alignItems = flow.align || "";
      area.style.setProperty("--tile-w", tw || defW);
      area.style.setProperty("--tile-wa", tw || (defW === "100%" ? "max-content" : defW));
      area.style.setProperty("--tile-h", th || "auto");
      /* an expanding axis is sized by its content, so any px still carried
         from a previous lock has to come off. ovH goes with it: a stored
         height on an axis whose px were just thrown away describes a box the
         container isn't in. ovW is deliberately left alone - over in
         applyElementAnchors() it means "a ta chose a width at all", and
         clearing it would hand the container back to the anchor column. */
      if (flow.x === "expand") area.style.width = "";
      if (flow.y === "expand") { area.style.height = ""; delete area.dataset.ovH; }
    });
    if (flow.y !== "lock") return;
    var saved = EDIT_SIZES[id];
    var h = saved && saved.h;
    if (!h) {
      /* no explicit height: measure every member of the group at its own
         natural height and pin them all to the tallest, so mirroring them
         together can only ever make a card taller, never clip one */
      areas.forEach(function (area) { area.style.height = ""; });
      areas.forEach(function (area) { h = Math.max(h || 0, area.scrollHeight); });
    }
    if (h) areas.forEach(function (area) {
      area.style.height = h + "px";
      area.dataset.ovH = h;
    });
  });
}
window.applyTileFlow = applyTileFlow;

/**
 * Reads content.area_flow into AREA_FLOW, so areaFlowFor()/applyTileFlow()
 * see whichever axes a ta has locked.
 * @param flow content.area_flow, {id: {x, y}}
 * @note Runs on every load, live site included: a locked axis is a real
 * layout decision students see, not an editor affordance.
 */
function applyAreaFlowOverrides(flow) {
  AREA_FLOW = flow && typeof flow === "object" ? flow : {};
}

/* content.tile_children, {tileId: [descriptors]} - elements a ta placed onto
   a tile whose backing content entry has nowhere to hold them.

   Every other bound child hangs off the entry it was dropped onto, which is
   what makes it that ONE tile's content. A gallery directory has no entry:
   years is a list of bare strings, and every directory tile is one rendering
   of a single shared template. So a child placed on one is stored against the
   TEMPLATE and rendered into every tile - the same shared-template rule these
   areas already promise everywhere else. */
var TILE_CHILDREN = {};

/**
 * Reads content.tile_children into TILE_CHILDREN. Runs on every load: an
 * element placed on a directory tile is real page content.
 * @param map content.tile_children
 */
function applyTileChildrenOverrides(map) {
  TILE_CHILDREN = map && typeof map === "object" ? map : {};
}

/**
 * The shared children saved against one tile template.
 * @param tileId the tile's data-resize-id, eg "gallery.dir.tile"
 * @return an array of descriptors, possibly empty
 */
function tileChildrenFor(tileId) {
  return TILE_CHILDREN[tileId] || [];
}
window.tileChildrenFor = tileChildrenFor;

/**
 * Persists one tile template's shared children into the preview snapshot, the
 * same draft every other override here writes to.
 * @param tileId the tile's data-resize-id
 * @param children the descriptor array
 */
function saveTileChildren(tileId, children) {
  TILE_CHILDREN[tileId] = children;
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.tile_children || typeof snapshot.tile_children !== "object") snapshot.tile_children = {};
  snapshot.tile_children[tileId] = children;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Writes one field of one flow container's layout state and persists it.
 * @param id the container's data-resize-id
 * @param key "x", "y", "dir", "wrap" or "gap"
 * @param value the new value for that key
 * @note Always saves the COMPLETE resolved state, not just the changed field,
 * so a container whose defaults later move doesn't silently re-lay-out.
 */
function setAreaFlowProp(id, key, value) {
  var cur = areaFlowFor(id);
  var next = { x: cur.x, y: cur.y, dir: cur.dir, wrap: cur.wrap, gap: cur.gap };
  next[key] = value;
  AREA_FLOW[id] = next;
  saveAreaFlow(id, next);
  applyTileFlow();
  positionRing();
}

/**
 * Every rendered copy of one flow container - usually one, but a container
 * embedded in a tile template exists once per tile and shares its id.
 * @param id the container's data-resize-id
 * @return an array of elements, possibly empty
 */
function flowAreasWithId(id) {
  return [].slice.call(document.querySelectorAll("[data-flow-area]"))
    .filter(function (a) { return elId(a) === id; });
}

/**
 * One flow container's tiles, in the order they currently sit in it.
 * @param area a flow container
 * @return an array of tile elements
 * @note Direct children only, and only real tiles - the "nothing here yet"
 * placeholder is a child too but isn't one of the things being ordered.
 */
function flowTilesOf(area) {
  return [].slice.call(area.querySelectorAll(":scope > [data-days-tile], " +
    ":scope > [data-extras-tile], :scope > [data-gallery-tile]"));
}

/**
 * Stamps every tile with the index of the content entry it was rendered FROM,
 * if it doesn't already carry one, and hands the tiles back.
 * @param area a flow container
 * @return its tiles, each carrying a data-flow-slot
 * @note Position-in-the-array rather than an id, because not every tile has
 * one: a legacy attachment is a bare string, and the synthetic "next day"
 * card is rendered from no entry at all. The attachments and gallery
 * renderers emit one tile per entry in order, so the nth tile IS the nth
 * entry; the day grid can cap how many it draws, so its tiles are stamped as
 * they're built and only unstamped ones get one here.
 * @note Re-written the moment a reorder is applied, so it always describes
 * where a tile's entry sits RIGHT NOW - that's what lets two reorders in a
 * row, or a reorder and its undo, compose correctly.
 */
function stampFlowSlots(area) {
  var tiles = flowTilesOf(area);
  tiles.forEach(function (t, i) { if (t.dataset.flowSlot === undefined) t.dataset.flowSlot = i; });
  return tiles;
}

/**
 * Re-orders a list to match the running order the tiles are now in.
 * @param list the content array being reordered
 * @param slots each tile's data-flow-slot, in the tiles' new order
 * @return a new array in that order
 */
function reorderBySlots(list, slots) {
  var out = [];
  var taken = {};
  slots.forEach(function (i) {
    if (i >= 0 && i < list.length && !taken[i]) { taken[i] = true; out.push(list[i]); }
  });
  /* anything the tiles didn't account for keeps its place at the end rather
     than being dropped - an entry with no tile on this page (or one whose tile
     is the synthetic trailing card, which stands for no entry at all) is not
     something a reorder should be able to delete. Same stance saveReelOrder()
     takes for a tiles[] entry with no element. */
  list.forEach(function (item, i) { if (!taken[i]) out.push(item); });
  return out;
}

/**
 * Which content array one flow container's running order lives in, and how to
 * write a new one back - the reorder counterpart of findBoundTileOwner(),
 * split out for the same reason: the four containers hold four different
 * kinds of thing and only the container knows which.
 * @param area a flow container
 * @return {apply(slots)}, or null if nothing owns this container's order
 * @note The attachments template renders from two different arrays, so which
 * is being reordered is decided by whether the container sits inside a day
 * card - the tile itself can't say.
 */
function flowOrderOwner(area) {
  var tiles = flowTilesOf(area);
  if (!tiles.length) return null;
  var first = tiles[0];
  if (first.hasAttribute("data-gallery-tile")) {
    if (!window.reorderGalleryDirs) return null;
    return { apply: function (slots) { window.reorderGalleryDirs(slots); } };
  }
  if (first.hasAttribute("data-days-tile")) {
    if (!window.DAYS) return null;
    return { apply: function (slots) {
      window.DAYS = reorderBySlots(window.DAYS, slots);
      saveDays(window.DAYS);
    } };
  }
  if (first.hasAttribute("data-extras-tile")) {
    var dayCard = area.closest("[data-days-tile]");
    if (dayCard) {
      var did = dayCard.getAttribute("data-days-id");
      var day = (window.DAYS || []).filter(function (d) { return d.id === did; })[0];
      if (!day) return null;
      return { apply: function (slots) {
        day.files = reorderBySlots(day.files || [], slots);
        saveDays(window.DAYS);
      } };
    }
    if (!window.EXTRAS) return null;
    return { apply: function (slots) {
      window.EXTRAS = reorderBySlots(window.EXTRAS, slots);
      saveExtras(window.EXTRAS);
    } };
  }
  return null;
}

/**
 * Writes the running order the tiles are in back to the content array behind
 * them, and re-stamps the slots to match.
 * @param area a flow container
 * @note The dom is already in the new order - the drag moved the nodes as it
 * went - so nothing here re-renders.
 */
function reorderFlowContent(area) {
  var tiles = stampFlowSlots(area);
  var owner = flowOrderOwner(area);
  if (owner) owner.apply(tiles.map(function (t) { return parseInt(t.dataset.flowSlot, 10); }));
  /* re-stamp each tile with where its entry sits NOW, not simply its position
     among the tiles: reorderBySlots() puts every entry that HAD a tile first,
     so it's the nth tile with an entry that is the nth entry. A tile standing
     for no entry keeps its -1 and is skipped by the count. */
  var slot = 0;
  tiles.forEach(function (t) {
    t.dataset.flowSlot = t.dataset.flowSlot === "-1" ? -1 : slot++;
  });
}

/**
 * Puts a flow container's tiles into an exact order, dom and content
 * together - what undo/redo replays for a reorder drag.
 * @param area a flow container
 * @param tiles its tiles in the wanted order
 * @note Takes the ELEMENTS rather than keys the way applyReelOrder() does,
 * since a tile has no key worth naming. The undo stack only lives in memory,
 * so holding nodes is safe; a stale entry pointing at tiles a re-render has
 * replaced is detected and skipped rather than half-applied.
 */
function applyFlowTileOrder(area, tiles) {
  if (!area || !tiles.every(function (t) { return t.parentElement === area; })) return;
  tiles.forEach(function (t) { area.appendChild(t); });
  reorderFlowContent(area);
}

/**
 * One flow-container tile's drag: grab it anywhere on its background and
 * carry it to a different place among its siblings.
 * @param e the mousedown that started it
 * @param tile the tile being dragged
 * @note The same edit startReelTileDrag() makes on a reel. A tile can't be
 * given a free position - where it sits IS its place in the running order -
 * so the drag reorders instead, rearranging live under the cursor.
 * @note Unlike a reel's single strip these containers wrap, on either axis in
 * either direction, so "which slot is this?" is two tests: the cross axis
 * picks the line, the main axis picks the place in it. Both read the
 * container's current stacking, so the answer follows a ta who flipped it.
 */
function startFlowTileDrag(e, tile) {
  var area = flowAreaOf(tile);
  if (!area) return;
  var flow = areaFlowFor(elId(area));
  var isCol = flow.dir.indexOf("column") === 0;
  var rev = flow.dir.indexOf("-reverse") !== -1;
  var wrapRev = flow.wrap === "reverse";
  var startX = e.clientX, startY = e.clientY;
  var before = stampFlowSlots(area);
  var moving = false;
  var grabX = 0, grabY = 0;

  /** @return true if a tile whose rect is r should sit AFTER the cursor. */
  function insertsBefore(cx, cy, r) {
    /* the cross axis first: a cursor on an earlier line goes before everything
       on this one no matter where along the line it is */
    if (isCol) {
      if (cx < r.left) return !wrapRev;
      if (cx > r.right) return wrapRev;
      return rev ? cy > r.top + r.height / 2 : cy < r.top + r.height / 2;
    }
    if (cy < r.top) return !wrapRev;
    if (cy > r.bottom) return wrapRev;
    return rev ? cx > r.left + r.width / 2 : cx < r.left + r.width / 2;
  }

  function onMove(ev) {
    if (!moving) {
      if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
      moving = true;
      RING_DRAGGING = true;
      document.body.style.userSelect = "none";
      var r0 = tile.getBoundingClientRect();
      grabX = startX - r0.left;
      grabY = startY - r0.top;
    }
    ev.preventDefault();
    /* re-derived against the tile's CURRENT slot every time rather than
       accumulated from the drag's start: a swap moves the slot out from under
       the tile, and an offset measured against where it used to be would jump
       by a whole tile each time. Same reasoning as startReelTileDrag(). */
    var wantX = ev.clientX - grabX, wantY = ev.clientY - grabY;
    tile.style.transform = "";
    var at = tile.getBoundingClientRect();
    tile.style.transform = "translate(" + (wantX - at.left) + "px," + (wantY - at.top) + "px)";

    var cx = wantX + at.width / 2, cy = wantY + at.height / 2;
    var target = null;
    flowTilesOf(area).forEach(function (other) {
      if (other === tile || target) return;
      if (insertsBefore(cx, cy, other.getBoundingClientRect())) target = other;
    });
    if (target !== tile.nextElementSibling) {
      area.insertBefore(tile, target);
      tile.style.transform = "";
      var moved = tile.getBoundingClientRect();
      tile.style.transform = "translate(" + (wantX - moved.left) + "px," + (wantY - moved.top) + "px)";
    }
    positionRing();
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    if (!moving) return; /* a plain click: leave the selection it already made */
    RING_DRAGGING = false;
    document.body.style.userSelect = "";
    /* the click the browser fires next must not open a text edit, same as
       every other drag, see wireResizable() */
    JUST_DRAGGED = true;
    setTimeout(function () { JUST_DRAGGED = false; }, 0);
    tile.style.transform = "";
    positionRing();
    var after = flowTilesOf(area);
    if (after.length === before.length &&
        after.every(function (t, i) { return t === before[i]; })) return;
    reorderFlowContent(area);
    EDIT_UNDO.push({ type: "flowOrder", area: area, before: before, after: after });
    EDIT_REDO.length = 0;
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/**
 * Records the height a flow container is painting at as its saved height the
 * moment a ta locks that axis - as if they had dragged it there - and forgets
 * it again on unlock.
 * @param id the container's data-resize-id
 * @param lock true if the y axis is being locked, false if unlocked
 * @note Without this a y lock would be a promise the container doesn't keep:
 * a y-locked container with no saved height is re-measured against its own
 * content, so the first stacking change after the lock would grow the very
 * box the ta asked to hold still - a column of tiles is several times taller
 * than a grid of them, and it would follow that down the page.
 * @note The x axis needs no equivalent, since nothing re-measures a width.
 * Nor is a container y-locked purely by default pinned: never having been
 * clicked, it still auto-mirrors to the tallest of its group.
 */
function pinFlowAreaHeight(id, lock) {
  var areas = flowAreasWithId(id);
  if (!areas.length) return;
  var saved = EDIT_SIZES[id] || {};
  var h = 0;
  areas.forEach(function (a) { h = Math.max(h, Math.round(a.getBoundingClientRect().height)); });
  /* a width is stored alongside it either way: a size record with no width is
     ignored wholesale on the next load (see applySizeOverrides()), which would
     throw the locked height out with it. The container's current width is
     already what it would have been given anyway. */
  var box = {
    w: saved.w === undefined ? Math.round(areas[0].getBoundingClientRect().width) : saved.w,
    h: lock ? h : undefined
  };
  EDIT_SIZES[id] = box;
  areas.forEach(function (a) {
    detachFromFlow(a);
    a.dataset.ovW = box.w;
    a.style.width = box.w + "px";
    if (box.h === undefined) delete a.dataset.ovH;
    else a.dataset.ovH = box.h;
  });
  saveEditedSize(id, box);
}

/**
 * Flips one axis of one flow container between locked and expanding.
 * @param id the container's data-resize-id
 * @param axis "x" or "y"
 */
function toggleAreaFlowAxis(id, axis) {
  var lock = areaFlowFor(id)[axis] !== "lock";
  /* measured BEFORE the switch, so locking the height means "stay exactly as
     tall as you are now" rather than "take whatever the new mode works out to" */
  if (axis === "y") pinFlowAreaHeight(id, lock);
  setAreaFlowProp(id, axis, lock ? "lock" : "expand");
}

/**
 * Hands a flow container whichever axes a ta has just dragged an edge on.
 * @param el the flow container just resized
 * @param before its size at mousedown, {w, h}
 * @param after the last box the drag wrote, {w, h}
 * @note An "expand" axis is sized by its CONTENT, so a size dragged along it
 * is a figure nothing will ever paint - which is why dragging the dashboard
 * containers taller looked like it did nothing, springing back on mouseup.
 * Dragging an edge IS claiming that axis, so it flips to "lock"; the
 * Container menu's toggle is the way back, and reads as locked afterwards.
 * @note Only axes whose size actually changed are claimed, so a pure width
 * drag never pins a height nobody touched. "Changed" means the box the drag
 * WROTE, not the box the container ended up measuring.
 */
function lockDraggedFlowAxes(el, before, after) {
  var id = elId(el);
  if (!id) return;
  var flow = areaFlowFor(id);
  if (flow.x !== "lock" && Math.round(before.w) !== Math.round(after.w)) {
    setAreaFlowProp(id, "x", "lock");
  }
  if (flow.y !== "lock" && Math.round(before.h) !== Math.round(after.h)) {
    setAreaFlowProp(id, "y", "lock");
  }
}

/**
 * Flips which axis one flow container's tiles run along - row or column -
 * keeping whichever direction along it is in force. See areaFlowFor().
 * @param id the container's data-resize-id
 */
function toggleAreaFlowAxisDir(id) {
  var cur = areaFlowFor(id);
  var reversed = cur.dir.indexOf("-reverse") !== -1;
  var base = cur.dir.indexOf("column") === 0 ? "row" : "column";
  setAreaFlowProp(id, "dir", reversed ? base + "-reverse" : base);
}

/**
 * Flips one flow container's tiles between running forwards and backwards
 * along whichever axis they already run on (left-to-right vs right-to-left,
 * top-to-bottom vs bottom-to-top).
 * @param id the container's data-resize-id
 */
function toggleAreaFlowReverse(id) {
  var cur = areaFlowFor(id);
  var reversed = cur.dir.indexOf("-reverse") !== -1;
  var base = reversed ? cur.dir.slice(0, -"-reverse".length) : cur.dir;
  setAreaFlowProp(id, "dir", reversed ? base : base + "-reverse");
}

/**
 * Flips which side one flow container's overflow wraps to: for a row of
 * tiles, the next line goes below (normal) or above (reverse); for a column,
 * to the right (normal) or to the left (reverse).
 * @param id the container's data-resize-id
 */
function toggleAreaFlowWrap(id) {
  setAreaFlowProp(id, "wrap", areaFlowFor(id).wrap === "reverse" ? "normal" : "reverse");
}

/**
 * True for an element that can't carry a size override of its OWN: a reel
 * tile, whose width/height is one figure shared by every tile in the reel
 * rather than anything per-tile content.sizes could hold.
 * @param el the element
 * @return true if el must never carry a size override
 * @note Dragging a tile's handles still works - it resizes all of them at
 * once, through the reel entry.
 * @note Tile roles used to be listed here as well, but a ta can resize a
 * tile's rectangle, text and button, so they're all freely resizable now: a
 * size under a shared role id resizes that piece on every sibling tile.
 */
function isResizeLockedTileRole(el) {
  return el.hasAttribute("data-reel-tile");
}

/**
 * True for one piece of an attachments/day tile's shared template - the
 * rect/icon/text/badge/button roles stamped onto every rendered tile with the
 * same id.
 * @param el the element
 * @return true if el is a tiled role element
 * @note Every geometry or style edit to one of these applies to all of them.
 */
function isTiledRoleEl(el) {
  return !!(el && el.hasAttribute &&
    (el.hasAttribute("data-extras-role") || el.hasAttribute("data-days-role") ||
     el.hasAttribute("data-gallery-role")));
}

/**
 * True for an element a ta placed onto a tile whose children are stored
 * against the TEMPLATE rather than one entry - a gallery directory tile's.
 * @param el the element
 * @return true if el is a shared tile child
 * @note One descriptor renders into every tile in the rail under the same id,
 * so it wants the same live geometry mirror a shared ROLE gets: without it,
 * nudging one copy would leave the others behind until the next reload.
 * @note A bound child is always the only element inside its own .free-wrap,
 * which is what distinguishes it from the tile's own template markup.
 */
function isSharedTileChild(el) {
  var wrap = el && el.parentElement;
  return !!(wrap && wrap.classList && wrap.classList.contains("free-wrap") &&
    wrap.parentElement && wrap.parentElement.hasAttribute &&
    wrap.parentElement.hasAttribute("data-gallery-tile"));
}

/**
 * The box an element may not be dragged out of: its own tile if it's inside
 * one, otherwise the live-area container if it's inside one.
 * @param el the element about to move
 * @return the bounding element, or null if el isn't inside one
 * @note Everything else on the page is unconstrained - only these live
 * sections have the "stops at the edge and grinds against it" rule.
 * @note A tile wins over the area because tiles nest: an element on an
 * attachment tile belongs to that tile alone, and closest() naturally gives
 * the innermost of the three.
 */
function moveBoundsContainer(el) {
  if (!el || !el.closest) return null;
  /* a reel tile bounds its contents one step more literally: what a ta drops
     on one is absolutely positioned against THAT tile, so a child dragged
     past the edge doesn't move to the tile it looks like it landed on - it
     stays this tile's child at a huge offset and rides away on the drift */
  var tile = el.closest("[data-extras-tile], [data-days-tile], [data-gallery-tile], [data-reel-tile]");
  if (tile) return tile;
  /* a login field/button/error line is the same kind of little container: its
     label, input rectangle and placeholder all move freely inside it and stop
     at its edge. Looked up from the PARENT so the container isn't its own
     bounds (a login element is freely placeable, unlike a tile).

     Matched on the input rectangle too, not just the outer element: a
     placeholder belongs to the BOX it's painted into, and once that box can
     be dragged out of its wrapper, clamping to the wrapper would drag the
     placeholder off the box on the first nudge. */
  var loginBox = el.parentElement &&
    el.parentElement.closest("[data-login-el], [data-login-fixed]");
  /* the credential rectangle is the exception: it IS its field's body,
     filling the wrapper edge to edge, so bounding it to that wrapper bounds
     it to itself and every drag clamps to zero pixels. It was the one thing
     on the login page that couldn't be moved at all - and since it covers the
     wrapper, every click on a box lands on it, so the field looked immovable
     too. Free like any other placed element instead. */
  if (loginBox && !el.hasAttribute("data-login-fixed")) return loginBox;
  var area = el.parentElement && el.parentElement.closest("[data-extras-area], [data-days-area]");
  return area || null;
}

/**
 * Clamps a proposed move offset so el's box stays inside whichever container
 * bounds it. Returns the offset unchanged for anything not inside one.
 * @param el the element being moved
 * @param tx proposed own x offset
 * @param ty proposed own y offset
 * @return {tx, ty}, clamped
 * @note Works in deltas against el's CURRENT rendered rect rather than
 * absolute coordinates, so it needs to know nothing about how that rect came
 * about - the same reason paintPos() composes rather than replaces.
 * @note An element bigger than its container pins to the top/left edge on
 * that axis instead of jittering between two impossible constraints.
 */
function clampOwnPos(el, tx, ty) {
  var box = moveBoundsContainer(el);
  if (!box) return { tx: tx, ty: ty };
  var cur = getPos(el);
  var r = el.getBoundingClientRect();
  var cr = box.getBoundingClientRect();
  var dx = tx - cur.tx, dy = ty - cur.ty;
  if (r.left + dx < cr.left) dx = cr.left - r.left;
  else if (r.right + dx > cr.right) dx = Math.max(cr.left - r.left, cr.right - r.right);
  if (r.top + dy < cr.top) dy = cr.top - r.top;
  else if (r.bottom + dy > cr.bottom) dy = Math.max(cr.top - r.top, cr.bottom - r.bottom);
  return { tx: cur.tx + dx, ty: cur.ty + dy };
}

/**
 * The largest box an element may be dragged to without leaving whichever
 * container bounds it - the resize half of clampOwnPos()'s rule.
 * @param el the element about to be resized
 * @param dir the handle's [x, y] direction, -1/0/+1 per axis (see RING_DIRS)
 * @return {w, h} maximums in css px, or null if el isn't inside a container
 * @note Only a MOVE was ever clamped, so a resize handle was the one way left
 * to get a tile's pieces out past it - obviously the rect, which starts out
 * filling its tile, but the filename and button just as easily.
 * @note Measured per HANDLE, because a resize pins the opposite edge: the
 * right handle grows away from the left edge, so it may grow until it meets
 * the container's right edge, and mirrored for the other three. An axis this
 * handle doesn't pull gets no limit - its size isn't changing, and a cap
 * would shrink an element already overhanging on an axis nobody touched.
 */
function resizeBoundsCap(el, dir) {
  var box = moveBoundsContainer(el);
  /* a tile is its own bounds (moveBoundsContainer() matches it on itself,
     since a tile can't be moved at all) - it caps against the container
     holding it instead, see tileSizeCap() */
  if (!box || box === el) return null;
  var r = el.getBoundingClientRect();
  var cr = box.getBoundingClientRect();
  return {
    w: !dir[0] ? Infinity :
      Math.max(16, dir[0] === -1 ? r.right - cr.left : cr.right - r.left),
    h: !dir[1] ? Infinity :
      Math.max(12, dir[1] === -1 ? r.bottom - cr.top : cr.bottom - r.top)
  };
}

/**
 * Reads the id an element's size/position overrides are keyed by.
 * @param el the element
 * @return its data-edit-id, data-resize-id or data-page-id
 * @note data-page-id is the page's own, and deliberately NOT part of
 * RESIZABLE_SEL: the page is styleable but not tracked. With a plain
 * data-resize-id, `<body>` matched every sweep in this file, and one saved
 * position was enough to wrap it in a .free-wrap - which stops it being
 * document.body at all (killing background propagation, so the page painted a
 * floating black rectangle instead of the browser canvas), pins it to a px
 * width, and leaves every later document.body lookup reading null. A second
 * attribute keeps the id readable while leaving body out of every sweep by
 * construction, rather than by remembering to guard each one.
 */
function elId(el) {
  return el.getAttribute("data-edit-id") || el.getAttribute("data-resize-id") ||
    el.getAttribute("data-page-id");
}

/**
 * Every element the style popover's colour rows can paint: each tracked
 * element, plus the page itself, which is styleable without being tracked.
 * @return an array of elements
 * @note The colour appliers sweep this instead of RESIZABLE_SEL; everything
 * else keeps sweeping RESIZABLE_SEL, so the page is excluded from geometry,
 * layering, grouping and delete by default rather than by a guard per system.
 */
function styleableEls() {
  var els = [].slice.call(document.querySelectorAll(RESIZABLE_SEL));
  if (document.body && document.body.hasAttribute("data-page-id")) els.push(document.body);
  return els;
}

/**
 * The selector matching every element carrying one id - the page's own
 * attribute included, so a lookup by id finds it like anything else.
 * @param id a data-edit-id, data-resize-id or data-page-id value
 * @return a css selector string
 */
function idSel(id) {
  return '[data-edit-id="' + id + '"], [data-resize-id="' + id + '"], [data-page-id="' + id + '"]';
}

/**
 * Resolves the element a click actually selects, starting from
 * `target.closest(RESIZABLE_SEL)`.
 * @param target the event's target (e.g. e.target)
 * @return the element to select, or null
 * @note A theme toggle is the one place where a RESIZABLE_SEL match (its
 * label span) nests inside another (the button). The label has no handles or
 * style rows of its own, so selecting it - which is most of the button's
 * clickable area - would hide the Background/Text colour/Change icon rows
 * entirely, hence the redirect up to the button. Its click-to-edit text entry
 * is wired directly on the label and is untouched by this.
 * @note A tile used to be a second such place, for the mirror-image reason:
 * with no id of its own, a click on the untracked markup filling most of its
 * surface selected the whole area container. It carries a real
 * data-resize-id now, so closest() lands on the tile and that IS right - it's
 * the bounds everything inside is clamped to. The rect stays reachable by
 * clicking it directly, and everything else via the ring's parent handle.
 */
function resolveSelectableTarget(target) {
  var el = target && target.closest ? target.closest(RESIZABLE_SEL) : null;
  if (el && el.classList.contains("tic-label")) {
    var toggle = el.closest("[data-theme-toggle], #themeBtn");
    if (toggle) return toggle;
  }
  /* a login failure line's message string, the second glued child - and the
     one that made the problem visible: the string fills its line edge to
     edge, so EVERY click landed on it, and as a clamped child it had nowhere
     to go. The line looked immovable when nobody had ever selected it. */
  if (el && isLoginErrorMsg(el)) return el.parentElement;
  return el;
}

/**
 * True for a theme toggle's own ".tic-label" span: a RESIZABLE_SEL match that
 * still isn't an independent element the way every other tracked descendant
 * is.
 * @param el the element
 * @return true if el is a theme toggle's label
 * @note It's permanently glued to its button, so unlike a nav link inside the
 * tracked nav bar - which should stay put if the nav moves - the label moves
 * and resizes as one piece with its button, like the plain sun/moon markup
 * beside it. Used to opt it out of that rule rather than out of
 * RESIZABLE_SEL, which would also break its click-to-edit and saved text.
 */
function isThemeToggleLabel(el) {
  return !!(el.classList && el.classList.contains("tic-label") && isThemeToggleEl(el.parentElement));
}

/**
 * True for a theme toggle's own ".tic-icon" span, the other half of the same
 * case as isThemeToggleLabel() above.
 * @param el the element
 * @return true if el is a theme toggle's icon
 * @note It's tracked so its size and colour can be edited on their own, which
 * is a different thing from being independent of the button: left out of
 * isGluedChild() it was counter-translated to stay put whenever the button
 * moved, so dragging a toggle out of the navbar slid the button away and left
 * its sun sitting in the bar. Its own move offset still applies on top, same
 * as the label's.
 */
function isThemeToggleIcon(el) {
  return !!(el && el.classList && el.classList.contains("tic-icon") &&
    isThemeToggleEl(el.parentElement));
}

/**
 * True for a light/dark toggle button itself: the nav's own #themeBtn, or a
 * placed "theme" element - both tagged data-theme-toggle.
 * @param el the element
 * @return true if el is a theme toggle button
 */
function isThemeToggleEl(el) {
  return !!(el && el.hasAttribute &&
    (el.hasAttribute("data-theme-toggle") || el.id === "themeBtn"));
}

/**
 * True for one of the login failure line's two strings - the same "tracked,
 * but not an independent element" case as isThemeToggleLabel(), one down.
 * @param el the element
 * @return true if el is a failure line's message span
 * @note The line carries two alternative wordings and shows one, so the
 * STRING isn't what a ta places or resizes - the line is. Being separately
 * tracked at all is only so each wording can be typed and styled on its own.
 */
function isLoginErrorMsg(el) {
  return !!(el && el.hasAttribute && el.hasAttribute("data-login-msg") &&
    el.parentElement && el.parentElement.hasAttribute &&
    el.parentElement.hasAttribute("data-login-el"));
}

/**
 * True for a login element's own text rather than something placed on top of
 * one: the submit button's label, a box's greyed placeholder, either failure
 * string.
 * @param el the element
 * @return true if el is a login element's own text
 * @note Each is the content of the thing it sits in - a button IS its label -
 * so none can stay behind when that thing moves. They're separately tracked
 * purely so each can be reworded and restyled, like a theme toggle's label.
 * Their own move offset still applies on top, so a label can be nudged
 * off-centre and still travel with its button.
 */
function isLoginOwnText(el) {
  if (!el || !el.classList) return false;
  return isLoginErrorMsg(el) ||
    el.classList.contains("login-submit-label") ||
    el.classList.contains("login-field-ph");
}

/**
 * True for any tracked element physically part of its parent rather than an
 * independent one sitting on top of it - a theme toggle's label, a login
 * element's own text.
 * @param el the element
 * @return true if el is glued to its parent
 * @note Both are exempt from the "no attachment between elements" rule every
 * other tracked descendant follows: they move and reflow as one piece.
 */
function isGluedChild(el) {
  return isThemeToggleLabel(el) || isThemeToggleIcon(el) || isLoginOwnText(el);
}

/**
 * True for the page itself: `<body data-page-id="box.page">`, the surface
 * everything else is painted onto.
 * @param el the element
 * @return true if el is the page
 * @note The page is STYLEABLE but not TRACKED, which is the whole shape of
 * it: a ta recolours it through the same machinery as any other surface -
 * light/dark pair, hover and click colours, opacity, undo - with no separate
 * "page settings" pane, while everything that only makes sense for something
 * ON the page can't reach it. It never moves, resizes, duplicates or
 * reorders, since there's nothing for those to be relative to, and leaving it
 * out of RESIZABLE_SEL is what enforces that.
 * @note Matched on its own attribute rather than the tag, so it's false on a
 * page whose body isn't tagged - the portal's object canvas.
 */
function isPageEl(el) {
  return !!(el && el.hasAttribute && el.hasAttribute("data-page-id"));
}

/**
 * Classifies an element so a resize drag can pick the right aspect-ratio
 * rule.
 * @param el the element
 * @return "icon", "img" or "box"
 * @note An icon never distorts, whatever happens. An image or video never
 * distorts its pixels either (object-fit: cover re-crops), but its box's
 * ratio only locks while shift is held. Everything else resizes freely.
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
 * @param el the element
 * @return {tx, ty}
 * @note This is el's own offset only; what actually paints also cancels out
 * every tracked ancestor's offset, see paintPos().
 */
function getPos(el) {
  return {
    tx: parseFloat(el.dataset.ovTx) || 0,
    ty: parseFloat(el.dataset.ovTy) || 0
  };
}

/**
 * Reads an element's current box size: its explicit override if resized, else
 * the size it was detached from flow at, else its live rendered size.
 * @param el the element
 * @return {w, h}
 * @note Layout px, not visual px, so an element with its own stylesheet
 * transform doesn't jump when a resize starts. A tile flow container is the
 * one element whose stored figures are only half the answer - see below.
 */
function getSize(el) {
  var w = parseFloat(el.dataset.ovW);
  var h = parseFloat(el.dataset.ovH);
  /* a flow container only OWNS an axis it has locked: the other is however
     tall its tiles come to, and no stored figure is that number - not a saved
     override (applyTileFlow() throws that axis' px away) and not the natW/natH
     it was detached at, a snapshot taken before the tiles even rendered. Both
     go stale the moment a tile changes, and a drag starting from a stale
     figure jumps the container to it on the first mousemove. */
  if (isFlowAreaEl(el)) {
    var flow = areaFlowFor(elId(el));
    /* offsetWidth/Height rather than a client rect, for this function's own
       layout-px-not-visual-px promise above: a container a ta has rotated
       measures its own box, not the bounding box the rotation sweeps out */
    return {
      w: flow.x === "lock" && !isNaN(w) ? w : el.offsetWidth,
      h: flow.y === "lock" && !isNaN(h) ? h : el.offsetHeight
    };
  }
  if (!isNaN(w) && !isNaN(h)) return { w: w, h: h };
  var nw = parseFloat(el.dataset.natW), nh = parseFloat(el.dataset.natH);
  /* both halves or neither: an element seeded with a natW but no natH would
     start a resize drag from {w: seed, h: NaN}, and the first mousemove would
     snap it to that stale width - which is what put the extras/days
     containers visibly past the right edge the instant they were grabbed */
  if (!isNaN(nw) && !isNaN(nh)) return { w: nw, h: nh };
  var r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
}

/**
 * The move offset of el's NEAREST tracked ancestor only, used to cancel a
 * container's translate back out of the elements inside it - moving a section
 * slides only that box, never the independent text and icons sitting in it.
 * @param el the element
 * @return {tx, ty}
 * @note Only the nearest matters because css transforms compound down the dom
 * chain on their own. A title two levels down summing BOTH the section's and
 * the card's offset would cancel the section's move twice - once via the
 * card's own painted transform propagating down - landing it exactly
 * backwards instead of standing still.
 * @note A glued child is one exception: it isn't an independent element, so
 * its parent is never cancel-worthy - it moves as one piece with what it
 * belongs to, like the untracked icon markup beside a theme label.
 * @note A live area container is the other, one step up: nothing inside it is
 * independent. Every tile role, every bound child and the placeholder are the
 * area's own content. Cancelling it out counter-translated all of them to
 * their pre-drag screen position while the tiles slid away underneath,
 * tearing each card apart and clipping the strays - "the second i move it,
 * both tiles turn into nonsense". Returning zero lets them ride along.
 */
function ancestorPos(el) {
  if (isGluedChild(el)) return { tx: 0, ty: 0 };
  var p = el.parentElement;
  while (p && p !== document.body) {
    if (p.matches && p.matches(RESIZABLE_SEL)) {
      /* a box is the third case, for the same reason a live area is the second:
         what's seated in it isn't independent of it. A ta who drags a box
         expects everything inside to travel with it - that IS what seating it
         meant - so its offset is left to compound down the dom rather than
         being cancelled back out. See the BOX CONTAINERS section. */
      if (isLiveAreaEl(p) || isBoxAreaEl(p)) return { tx: 0, ty: 0 };
      return { tx: parseFloat(p.dataset.ovTx) || 0, ty: parseFloat(p.dataset.ovTy) || 0 };
    }
    p = p.parentElement;
  }
  return { tx: 0, ty: 0 };
}

/**
 * The id of el's nearest tracked ancestor - the box it belongs to - or "" if
 * el is top-level. Same walk as ancestorPos(), returning the id.
 * @param el the element
 * @return the ancestor's data-edit-id/data-resize-id, or ""
 * @note NOT what decides el's stacking order: a tracked container is never
 * given a z-index, so it never confines what it holds.
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
 * The style popover's Flip/Rotate contribution to el's transform, read off
 * its own dataset.
 * @param el the element
 * @return a transform fragment ("" if el has no flip/rotate override)
 * @note Never read from el.style.transform: paintPos() is the only place
 * allowed to write that, and it composes this back in on every move.
 */
function flipRotateTransform(el) {
  var parts = [];
  var deg = parseFloat(el.dataset.rotate) || 0;
  if (deg) parts.push("rotate(" + deg + "deg)");
  var sx = el.dataset.flipH === "1" ? -1 : 1;
  var sy = el.dataset.flipV === "1" ? -1 : 1;
  if (sx === -1 || sy === -1) parts.push("scale(" + sx + "," + sy + ")");
  return parts.join(" ");
}

/**
 * Writes el's painted transform: its own move offset minus its tracked
 * ancestors' (see ancestorPos()), then any Flip/Rotate override, then
 * whatever stylesheet transform el already had - composed after the first
 * two rather than silently stomped by the inline style.
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
  /* the responsive layer's own delta, composed over the ta's saved offset
     rather than folded into it - see the RESPONSIVE BEHAVIOUR section. Kept
     out of getPos() on purpose: the editor's drag maths, the ring and every
     undo entry all work in the authored coordinate space, and a window resize
     must not be able to move what a ta thinks they placed. */
  /* unless the delta is being painted on the element's wrap instead, which is
     what a free-placed element gets - see paintResponsive(). Adding it here
     too would move the element twice. */
  if (el.dataset.rsOnWrap !== "1") {
    tx += parseFloat(el.dataset.rsDx) || 0;
    ty += parseFloat(el.dataset.rsDy) || 0;
  }
  var xf = tx || ty ? "translate(" + tx + "px, " + ty + "px)" : "";
  var rsScale = parseFloat(el.dataset.rsScale);
  if (rsScale > 0 && rsScale !== 1) xf = (xf ? xf + " " : "") + "scale(" + rsScale + ")";
  var ovXf = flipRotateTransform(el);
  if (ovXf) xf = (xf ? xf + " " : "") + ovXf;
  if (el.dataset.baseXf) xf = (xf ? xf + " " : "") + el.dataset.baseXf;
  /* a naturally inline element ignores transform entirely until blockified,
     the same reason moving the span itself calls detachFromFlow() first. This
     is that one step removed: el's OWN offset can be 0 and it can still need
     a transform purely to cancel a tracked ANCESTOR's move - without this the
     cancellation is a silent no-op and el drags along with its ancestor.
     inline-block is enough (nothing here needs a frozen size), and only
     applied once a transform is actually needed. */
  if (xf && getComputedStyle(el).display === "inline") el.style.display = "inline-block";
  el.style.transform = xf;
  /* a css transition on transform (eg. .card's) would make el lag behind
     the cursor for its duration, and the ring reads el's rect synchronously */
  if (xf) el.style.transition = "none";
  /* a tint/shade overlay is a sibling, not a child, so it doesn't inherit
     any of the above - it has to be handed the same box and transform or it
     stays behind at the element's old footprint, see syncElementOverlays() */
  syncElementOverlays(el);
}

/**
 * Sets el's own move offset and repaints it plus every tracked element inside
 * it, whose painted transforms cancel el's out so they visually stay put
 * while el's box slides underneath them.
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
  /* live during the drag, so an element crossing a section boundary stays
     whole under the cursor rather than only after the mouse comes up -
     applyLayerOrder()'s closing applyClipEscapes() is the full reconcile */
  releaseClipFor(el);
}

/**
 * Writes a real width/height onto an element, already detached from flow so
 * this can never reflow anything else on the page.
 * @param el the element
 * @param w new width in css px
 * @param h new height in css px
 * @note A real box rather than a transform: scale() is the whole point - the
 * box only dictates how content flows inside it, so text rewraps at its own
 * unchanged character size and an image re-crops to the new shape rather than
 * stretching its pixels.
 */
function setBox(el, w, h) {
  el.dataset.ovW = w;
  el.dataset.ovH = h;
  el.style.width = w + "px";
  el.style.height = h + "px";
  /* a resize can push an edge past a clipping ancestor just as a move can,
     see setOwnPos()'s own call */
  releaseClipFor(el);
  syncElementOverlays(el);
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
  syncElementOverlays(el);
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
  mirrorTiledRoleGeometry(el);
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
  mirrorTiledRoleGeometry(el);
}

/* the inline style properties mirrorTiledRoleStyle() copies from one tile
   role onto its siblings: purely how the piece LOOKS. Deliberately not
   geometry (mirrored separately, keyed by id rather than role) and not the
   font/text properties. That split is what makes the spec's one exception
   work: a Download and an Open button share a role but carry different ids,
   so restyling either recolours both, while their text, size and position
   stay independent. */
var TILE_STYLE_MIRROR_PROPS = [
  "background", "background-color", "background-image", "color",
  "border", "border-width", "border-style", "border-color", "border-radius",
  "box-shadow", "opacity", "fill", "stroke", "filter", "mix-blend-mode"
];

/**
 * Mirrors a tile role's live inline LOOK onto every other tile's same-role
 * element, since every rendered tile shares one role per piece and a style
 * edit to any tile is meant to apply to the shared template.
 * @param el a just-edited element, any kind
 * @note Checks both data-extras-role and data-days-role; locked and open day
 * tiles are separate templates and never mirror into each other.
 * @note The override sweeps already repaint every matching id on the NEXT
 * load; this only covers the live, same-session gap, since those inputs
 * otherwise touch only the single selected element.
 * @note Copies one property at a time rather than assigning cssText
 * wholesale, which carried width/height/transform too - dragging every
 * sibling's geometry along with a pure colour change.
 */
function mirrorTiledRoleStyle(el) {
  var attr = el.hasAttribute("data-extras-role") ? "data-extras-role"
    : el.hasAttribute("data-days-role") ? "data-days-role"
    : el.hasAttribute("data-gallery-role") ? "data-gallery-role" : null;
  if (!attr) return;
  var role = el.getAttribute(attr);
  var opColor = el.dataset.opColor, opAlpha = el.dataset.opAlpha, baseColor = el.dataset.baseColor;
  document.querySelectorAll('[' + attr + '="' + role + '"]').forEach(function (other) {
    if (other === el) return;
    TILE_STYLE_MIRROR_PROPS.forEach(function (prop) {
      var v = el.style.getPropertyValue(prop);
      if (v) other.style.setProperty(prop, v, el.style.getPropertyPriority(prop));
      else other.style.removeProperty(prop);
    });
    if (opColor === undefined) delete other.dataset.opColor; else other.dataset.opColor = opColor;
    if (opAlpha !== undefined) other.dataset.opAlpha = opAlpha;
    if (baseColor !== undefined) other.dataset.baseColor = baseColor;
  });
}

/**
 * Mirrors a just-moved or resized tile role's geometry onto every OTHER
 * element sharing its id, so nudging the icon on one tile nudges it on all of
 * them the instant it happens.
 * @param el a just-moved/resized element, any kind
 * @note Keyed by id rather than role (unlike mirrorTiledRoleStyle()) because
 * geometry is exactly what the Download/Open variants must NOT share, and
 * they differ by id while sharing a role.
 * @note The live half only: the saved override is stored under that same
 * shared id, so the load-time sweeps reproduce it for free.
 * @note Each target re-clamps against ITS OWN tile rather than copying the
 * offset blindly - the same role renders in tiles of very different widths,
 * so an offset comfortably inside one can be past the edge of a narrower
 * sibling.
 */
function mirrorTiledRoleGeometry(el) {
  if (!isTiledRoleEl(el) && !isSharedTileChild(el)) return;
  var id = elId(el);
  if (!id) return;
  var w = el.dataset.ovW, h = el.dataset.ovH;
  var tx = parseFloat(el.dataset.ovTx) || 0, ty = parseFloat(el.dataset.ovTy) || 0;
  document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (other) {
    if (other === el) return;
    if (w !== undefined || tx || ty) detachFromFlow(other);
    if (w !== undefined) setBox(other, parseFloat(w), parseFloat(h));
    setOwnPos(other, tx, ty);
    var c = clampOwnPos(other, tx, ty);
    if (c.tx !== tx || c.ty !== ty) setOwnPos(other, c.tx, c.ty);
  });
}

/**
 * Moves el to an exact {tx, ty} and persists it - used by a move drag's
 * mouseup and by undo/redo, so both go through the same code.
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
 * Resizes and (since a left/top-handle drag can shift position too)
 * repositions el to an exact {w, h, tx, ty} and persists both - used by a
 * resize drag's mouseup, a double-click reset, and undo/redo alike.
 * @param el the element
 * @param box {w, h, tx, ty}
 */
function applyResizeSide(el, box) {
  /* a tile has no box of its own to put back: "this tile is 340px wide" means
     "this container's tracks are 340px wide". Replaying one through the
     generic path wrote a width onto a single grid item and left the CONTAINER
     tiled at whatever the drag ended on - neither the state before the drag
     nor after it - and detachFromFlow() below pulled the tile out of the grid
     laying it out. */
  if (isTileBoxEl(el)) {
    setTileTrackSize(el, box.w, box.h);
    commitSize(el);
    /* the container may have taken height to fit a taller tile mid-drag (see
       growFlowAreaForTiles()); putting that back is the "area" half of the
       history entry, replayed by applyHistoryAction() once every tile is done */
    growFlowAreaForTiles(el, true);
    positionRing();
    return;
  }
  detachFromFlow(el);
  setBox(el, box.w, box.h);
  setOwnPos(el, box.tx, box.ty);
  commitSize(el);
  commitPosition(el);
  /* same reason the drag's own mouseup does it: a container's size is what its
     tiles are tiled INTO, so undoing one has to re-tile them (see
     startResizeDrag()). The axis locks the drag claimed stay claimed - undo
     puts the box back, it doesn't hand the axis back to its content. */
  if (isFlowAreaEl(el)) applyTileFlow();
  positionRing();
}

/**
 * Pushes a "move" undo entry, unless the drag changed nothing (eg a
 * double-click reset with nothing to reset). Clears the redo stack.
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
 * @param area optional {id, before, after} for the flow container a resized
 *   TILE took room from, on either axis, each side a {w, h} or null for "had no
 *   saved size" (see growFlowAreaForTiles()/setFlowAreaSavedSize())
 */
function pushResizeUndo(id, before, after, area) {
  if (before.w === after.w && before.h === after.h && before.tx === after.tx && before.ty === after.ty) return;
  var entry = { type: "resize", id: id, before: before, after: after };
  /* only when the container's own saved size actually moved: an EXPANDING axis
     (y on both dashboard areas by default) is sized by its content, so it
     follows the tiles back on its own and has nothing to record */
  if (area && !sameSavedSize(area.before, area.after)) entry.area = area;
  EDIT_UNDO.push(entry);
  EDIT_REDO.length = 0;
}

/**
 * Whether two content.sizes records describe the same box, either possibly
 * absent - "no saved size at all" is a state in its own right.
 * @param a a {w, h} or null/undefined
 * @param b a {w, h} or null/undefined
 * @return true if they mean the same thing
 */
function sameSavedSize(a, b) {
  if (!a || !b) return !a && !b;
  return a.w === b.w && a.h === b.h;
}

/**
 * Puts one flow container's saved size back to an exact record (or to none),
 * DOM and content.sizes together, and re-runs the layout that reads it.
 * @param id the container's data-resize-id
 * @param size a {w, h}, or null to go back to having no saved size
 * @note The counterpart of growFlowAreaForTiles(), which only ever grows and
 * so can't be its own inverse: undoing that has to say the old height aloud.
 */
function setFlowAreaSavedSize(id, size) {
  if (!id) return;
  saveEditedSize(id, size || null);
  flowAreasWithId(id).forEach(function (area) {
    if (size && size.h !== undefined) {
      area.style.height = size.h + "px";
      area.dataset.ovH = size.h;
    } else {
      area.style.height = "";
      delete area.dataset.ovH;
    }
    /* the width half, now that a tile drag can grow that axis too (see
       growFlowAreaForTiles()). Clearing ovW rather than leaving it behind
       matters here: it's what applyElementAnchors() reads as "a ta chose a
       width for this", so a stale one would keep the container pinned to a
       width the undo just took away. */
    if (size && size.w !== undefined) {
      area.style.width = size.w + "px";
      area.dataset.ovW = size.w;
    } else {
      area.style.width = "";
      delete area.dataset.ovW;
    }
  });
  applyTileFlow();
  if (window.applyElementAnchors) applyElementAnchors();
}

/* the last content.sizes seen by applySizeOverrides(), so applyTileFlow() can
   look up a tile's/container's saved size without being handed the whole
   content blob by every one of its callers (a tile resize mid-session updates
   this in place, see setTileTrackSize()) */
var EDIT_SIZES = {};

/**
 * Applies saved size overrides on top of the page's own default sizing, for
 * every tracked element that has one.
 * @param sizes content.sizes, {id: {w, h}}
 * @note Runs on every load, live site included: a saved size means real
 * width/height, so the element needs detaching from flow even outside the
 * editor, or a visitor's page would reflow around it. Elements with no saved
 * size are left completely untouched, in flow.
 * @note A tile role's id repeats across every rendered tile, so a size stored
 * under one applies to all - that IS the shared-template mirroring, not a bug
 * to filter out. Skipped: a reel tile (it would break its flex track) and a
 * TILE, whose saved size is a container track size applied by applyTileFlow().
 */
function applySizeOverrides(sizes) {
  sizes = sizes || {};
  EDIT_SIZES = sizes;
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var s = sizes[elId(el)];
    if (!s || s.w === undefined || isResizeLockedTileRole(el)) return;
    /* a tile's saved size isn't a box of its own: it's the track size of the
       container laying it out, applied there by applyTileFlow(). Writing a
       width onto a grid item here instead would pin one tile inside a track
       still sized by everything else, which is neither what a ta dragged nor
       something the other tiles would follow. */
    if (isTileBoxEl(el)) return;
    detachFromFlow(el);
    /* a container's HEIGHT is only its own to keep while its y axis is
       locked. With y expanding - the default for both top-level areas - the
       height is whatever its tiles come to, re-derived per render, and a
       stored px figure just fights that: too tall leaves a dead gap, too
       short clips them. Width is applied either way. */
    if (isLiveAreaEl(el)) {
      el.dataset.ovW = s.w;
      el.style.width = s.w + "px";
      if (s.h !== undefined) el.dataset.ovH = s.h;
      return;
    }
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
 * letter spacing) on top of the page's default styling, for every
 * click-to-edit field carrying one. Runs on every load, live site included.
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
    if (s.align) applyTextAlignStyle(el, s.align);
    if (s.letterSpacing) el.style.letterSpacing = s.letterSpacing;
    /* "none" is a real, meaningful override (turning OFF a template's own
       forced caps, eg a badge/tag label) just as much as "uppercase" is
       turning it on - both are non-empty strings, so this only ever skips
       an actually-cleared "" override, same convention as align/fontFamily
       above. See applyTextTransformStyle()/the toolbar's .tt-caps button. */
    if (s.textTransform) applyTextTransformStyle(el, s.textTransform);
  });
}

/* which flex justification each text alignment means, for an element that
   lays its own content out with flex instead of as running text. "justify"
   has no flex equivalent that spreads a single run of words, so it takes the
   nearest honest reading of the same intent: content pushed out to both
   edges. */
var ALIGN_JUSTIFY = { left: "flex-start", center: "center", right: "flex-end", justify: "space-between" };

/**
 * Sets one element's text alignment - the single place that decision is made,
 * so the toolbar, the datetime element's own buttons, undo/redo and the
 * load-time pass can't drift apart.
 * @param el the element
 * @param align "left"/"center"/"right"/"justify", or "" for the default
 * @note `text-align` alone silently does nothing on a flex container, and
 * every button here is one - its text becomes an anonymous flex ITEM, placed
 * by justify-content rather than text-align, which is why alignment looked
 * ignored on buttons specifically. Both properties are written, so one saved
 * value reads correctly either way with nothing extra stored.
 */
function applyTextAlignStyle(el, align) {
  el.style.textAlign = align;
  if (/flex/.test(getComputedStyle(el).display)) {
    el.style.justifyContent = align ? (ALIGN_JUSTIFY[align] || "") : "";
  }
}

/**
 * Sets one element's forced text case - the single place that decision is
 * made, same reasoning as applyTextAlignStyle() above.
 * @param el the element
 * @param value "uppercase", "none", or "" for the template's own default
 * @note Several templates already force ALL CAPS on specific labels through
 * their own css class rather than this override; this is only what a ta
 * explicitly picked for one instance on top of that.
 */
function applyTextTransformStyle(el, value) {
  el.style.textTransform = value || "";
}

/**
 * Applies saved padding overrides on top of whatever padding the stylesheet
 * gives an element. Runs on every load, live site included.
 * @param padding content.padding, {id: css padding shorthand}
 * @note Stored as one css shorthand string per id rather than four numbers:
 * it's what actually gets written, it round-trips through the snapshot as
 * plain text, and "no override" is just the absent key - the same shape every
 * other single-value override map here already has.
 */
function applyPaddingOverrides(padding) {
  padding = padding || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = padding[elId(el)];
    if (!v) return;
    el.style.padding = v;
  });
}

/**
 * Reads an element's current padding as the four side values the toolbar
 * edits, rounded to whole px.
 * @param el the element
 * @return {t, r, b, l} in px
 * @note The row only ever writes whole px, and a computed sub-pixel value
 * would show up as an unusable "11.328" in a number box.
 */
function currentPaddingValues(el) {
  var cs = getComputedStyle(el);
  return {
    t: Math.round(parseFloat(cs.paddingTop) || 0),
    r: Math.round(parseFloat(cs.paddingRight) || 0),
    b: Math.round(parseFloat(cs.paddingBottom) || 0),
    l: Math.round(parseFloat(cs.paddingLeft) || 0)
  };
}

/**
 * Applies saved move offsets on top of the page's own default flow position.
 * Runs on every load, live site included.
 * @param positions content.positions, {id: {tx, ty}}
 * @note A translate is paint-only, so a block element's flow slot is
 * untouched - but a naturally inline element ignores transform entirely until
 * blockified, so anything carrying a saved position still needs
 * detachFromFlow() first. A size override already forced that.
 * @note Two passes, so every element's cancel-out of its ancestors' offsets
 * sees those offsets already in place.
 * @note Same "one id, every element carrying it" rule as applySizeOverrides(),
 * so a tile role's offset lands on every tile; only a reel tile is skipped.
 * @note A third pass re-clamps every tile role afterwards, for the reason
 * mirrorTiledRoleGeometry() does live: one offset is painted into tiles of
 * different widths. Visitors get this too - it's what stops a mirrored icon
 * being half-clipped by a day card's overflow on a student's screen.
 */
function applyPositionOverrides(positions) {
  positions = positions || {};
  /* the live mirror the responsive fallback reads each entry's `bw` back out
     of - the container width the drag was measured against, which is the
     denominator that turns a frozen pixel offset into a proportion (see
     responsiveFallbackFor()). Kept here rather than re-read from the content
     blob so a drag saved this session is accounted for immediately. */
  EDIT_POSITIONS = positions;
  var els = document.querySelectorAll(RESIZABLE_SEL);
  els.forEach(function (el) {
    var p = positions[elId(el)];
    if (p && !isMoveLockedTileRole(el)) {
      detachFromFlow(el);
      el.dataset.ovTx = p.tx;
      el.dataset.ovTy = p.ty;
    }
  });
  els.forEach(paintPos);
  els.forEach(function (el) {
    if (!isTiledRoleEl(el) || !positions[elId(el)]) return;
    var own = getPos(el);
    var c = clampOwnPos(el, own.tx, own.ty);
    if (c.tx !== own.tx || c.ty !== own.ty) setOwnPos(el, c.tx, c.ty);
  });
}

/* content.positions as last applied, {id: {tx, ty, bw}}. See the assignment
   in applyPositionOverrides() for what reads it. */
var EDIT_POSITIONS = {};

/* every id currently deleted (data-edit-id/data-resize-id), kept in sync by
   applyHiddenOverrides()/setElementHidden() below. setHiddenVisual() checks
   this so hiding a wrapper never forces a child that's independently
   deleted back to visible, see its own doc comment. */
var HIDDEN_IDS = {};

/**
 * Hides every element a ta deleted in the visual editor, on every load, live
 * site included.
 * @param hidden array of data-edit-id/data-resize-id values to hide
 * @note A deleted id can match more than one element (the brand wordmark in
 * nav and footer); all of them hide together, same "an id is one logical
 * thing" rule as the rest of this file.
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
 * Whether el has any independently-tagged element nested inside it - eg the
 * brand link wraps the logo image and brand text, each separately editable.
 * @param el the element
 * @return true if el has a tracked descendant
 * @note Used to tell a plain leaf (a CTA button) from a wrapper other tagged
 * elements depend on staying present when it's deleted.
 * @note A login-page element is the one deliberate "no": its label, input
 * rectangle, placeholder and error strings are PARTS of it, so deleting a
 * credential box must take the whole box. On the wrapper path it would hide
 * the outline and nothing else - the real <input> would stay on the card,
 * still focusable, still typed into, still posted.
 */
function hasTrackedDescendants(el) {
  if (el.hasAttribute && el.hasAttribute("data-login-el")) return false;
  /* a theme toggle, for the same reason: its icon and wording are the
     button's own two pieces, not elements that happen to sit inside it.
     Treating it as a wrapper made "send to back" a no-op on it, and left
     deleting one showing a floating icon and label over an invisible
     button. */
  if (isThemeToggleEl(el)) return false;
  return el.querySelectorAll(RESIZABLE_SEL).length > 0;
}

/**
 * Whether el is the root of a pasted copy.
 * @param el the element
 * @return true if el is a pasted copy's root
 * @note One of the two containers that carry a rank of their own, see
 * ranksAsBlock().
 */
function isClipRoot(el) {
  return !!(el && el.hasAttribute && el.hasAttribute("data-clip-root"));
}

/**
 * Whether el is the root of a copy the ta made - a paste or a duplicate.
 * @param el the element
 * @return true if el is a copy's root
 * @note The two are marked separately (data-clip-root by the clip build,
 * data-dup-root by insertDuplicateClone()) but they answer the same question
 * here: the whole element is something that was added, so it comes and goes
 * as one piece.
 */
function isCopyRoot(el) {
  return isClipRoot(el) ||
    !!(el && el.hasAttribute && el.hasAttribute("data-dup-root"));
}

/**
 * Whether a CONTAINER holds a rank of its own, instead of only the leaves
 * inside it holding one.
 * @param el the element
 * @return true if el's own painted box competes in the layer order
 *
 * @note A container's `background` and `border` are painted by the container,
 * not by anything inside it, so a container that holds no rank has no way to
 * move them: "bring to front" on a day row lifted its tag, title, count and
 * icon to the top of the page and left the panel they sit on exactly where it
 * was, under the next row down. That's the version of the button a ta reads as
 * simply not working, since the panel IS the rectangle they selected.
 * @note So the general "a container never gets a number" rule (see
 * applyLayerOrder()) is kept for containers where the number would be
 * unobservable, and dropped where it costs a ta the thing they clicked. Two
 * cases have real stakes, and they're the same case twice: a box that paints
 * against something it OVERLAPS. A pasted copy lands 24px off its original,
 * and a box the ta has dragged or resized is out of flow by definition. Every
 * other container is an in-flow block that overlaps nothing, so where its
 * panel sits in the order can never be seen.
 * @note The cost is the one the rule exists to avoid: a ranked container is a
 * stacking context, so its leaves can no longer be ranked against elements
 * OUTSIDE it - they move as the block the layer menu already treats them as.
 * That's the honest trade for a box someone has positioned by hand, and it's
 * what "bring this to the front" means about a card in every other tool.
 * @note Being in a `.free-wrap` is not on its own enough to count as
 * positioned by hand: freezeDescendants() wraps EVERY tracked descendant of
 * whatever is being resized, so one drag on a section would otherwise hand a
 * rank - and the sealing that comes with it - to every box inside it. The
 * geometry overrides are the honest marker, since nothing but a real move or
 * resize writes one.
 */
function ranksAsBlock(el) {
  if (!el) return false;
  if (isClipRoot(el)) return true;
  var wrap = el.parentElement;
  if (!wrap || !wrap.classList || !wrap.classList.contains("free-wrap")) return false;
  var d = el.dataset || {};
  return d.ovTx !== undefined || d.ovTy !== undefined ||
    d.ovW !== undefined || d.ovH !== undefined;
}

/**
 * Applies (or removes) the "deleted" look for one element, without persisting
 * anything - setElementHidden() does that on top, and applyHiddenOverrides()
 * calls this directly on every load, since a visitor's page must never write
 * to localStorage.
 * @param el the element
 * @param hide true to hide/delete it, false to restore it
 * @note A leaf gets display:none, detached from flow first so its slot stays
 * reserved and removing it can't reflow a sibling into the gap.
 * @note A wrapper around other tagged elements can't use display:none at all:
 * css unconditionally hides every descendant, taking them down with it.
 * Moving them out to become siblings broke just as badly, dropping them out
 * of the wrapper's flex layout into the surrounding flow. Instead the wrapper
 * is made invisible but present - visibility:hidden, which descendants CAN
 * override, with visibility:visible stamped onto each tracked one.
 * @note A descendant already deleted in its own right is left alone rather
 * than forced visible, so deleting a wrapper never resurrects it.
 */
function setHiddenVisual(el, hide) {
  /* a pasted or duplicated copy is one thing the ta added, not a wrapper the
     page needs kept around, so it hides outright and takes what's inside it
     with it. Undoing a paste of the nav links used to leave all six links in
     the bar: the wrapper path below only makes the container invisible, then
     stamps visibility:visible back onto every tracked child. No
     detachFromFlow() either - the row a copy was pasted into should close
     back up when the copy goes. */
  if (isCopyRoot(el)) {
    el.style.display = hide ? "none" : "";
    return;
  }
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

/* the visual editor's stacking order, bottom to top: an explicit ordered list
   a ta controls with the ring's layer handles, not the old "whatever was
   touched last is on top" guess (which stomped its own z-index the moment two
   touched elements overlapped, since move/resize and stacking shared one
   inline property). Kept in memory so moveLayer() can shift one id without
   re-deriving everything from content.layers. */
var LAYER_ORDER = [];

/* The page's painted-in backdrops - the hero's video and scrim, the logo
   watermark - used to be handled here by a table mapping a synthetic id to a
   css selector, because they weren't tagged elements.

   That was the wrong shape. A synthetic id gets an element a z-index and
   NOTHING else: send a photo behind the watermark and the photo really did
   get the lower number, but the watermark still couldn't be clicked,
   selected, or shown with a ring - so the one move that would demonstrate the
   layering was the one it refused to make. A backdrop is an element painted
   on the page like any other; all three carry a real data-resize-id now,
   keeping the exact ids the synthetic table used so saved layers resolve.

   They need no special case anywhere: DOM order puts them behind by default,
   which is where they already sit. What's left is a migration, not a
   mechanism - a content.layers saved before they were ranked doesn't list
   them, and reconcileLayerOrder() would otherwise append them on top. */
var BACKDROP_DEFAULT_BACK_IDS = ["media.hero.video", "media.hero.scrim", "media.about.logo"];

/**
 * Every currently-rendered tracked element's id, in DOM (paint) order,
 * deduplicated.
 * @return array of ids, document order
 * @note Seeds a sane default stack for any id a saved content.layers doesn't
 * know about, so an untouched page still stacks exactly as it did before any
 * layer system existed.
 */
function domOrderIds() {
  var seen = {};
  var ids = [];
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (id && !seen[id]) { seen[id] = true; ids.push(id); }
  });
  return ids;
}

/* ids "promoted to navbar" (see toggleFixed()): these always stack above
   every non-fixed element regardless of layer order, since a sticky element
   needs to stay on top of scrolling content rather than whatever its DOM
   position sorted it to. An object keyed by id for O(1) lookup. */
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

/* ids locked against being moved (right-click "Lock element"): blocks both
   the drag-anywhere affordance and the ring's move handle, so a placed
   element can't be nudged out of position by an accidental drag. Resizing,
   text, deleting, layering and colour all still work. Same shape as
   FIXED_SET. */
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
 * Toggles one id in or out of the locked set, repaints the grey edit-mode
 * highlight, and persists the change.
 * @param id the element's data-edit-id or data-resize-id
 * @note Its own inverse, like toggleFixed(), so undo/redo just call it again.
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
 * True if el is the actual instance FIXED_SET's id refers to, not just any
 * node sharing that id.
 * @param el the element
 * @return true if el both has a fixed id AND actually sits inside <nav>
 * @note "Promote to navbar" is about the nav bar itself, but a few ids (eg
 * "nav.brand") are shared with a mirrored copy elsewhere - the footer reuses
 * it so editing the brand name updates both - and that copy was never meant
 * to inherit the nav's z-boosted treatment.
 */
function isFixedInstance(el) {
  return !!el && isFixed(elId(el)) && !!(el.closest && el.closest("nav"));
}

/* THE FIXED BAR BEATS EVERYTHING
   -----------------------------------------------------------------------
   applyLayerOrder() stamps the outermost fixed container - the navbar - one
   past every rank on the page, and nothing on the page gets past it. Every
   element INSIDE the bar therefore paints above every element outside it,
   whatever the layer order says, because the bar's z-index makes it a
   stacking context and its contents resolve inside that. The layer order goes
   on deciding the bar's own contents against each other, which is the only
   comparison left to make.

   There used to be an exception, and this is the note it left behind. An
   element a ta had dragged OUT of the bar and pinned to the body was lifted
   back over the bar (`top + z`), so that one dropped on the bar's own strip
   stayed visible instead of disappearing behind its backdrop. The cost was
   that the same element then slid OVER the navbar for the rest of the page as
   it scrolled - the bar stopped being the thing that covers the page, which is
   the one behaviour a navbar has. An element dropped on the strip is behind
   the bar now, like any other page content there; the way to put something in
   the bar is to promote it into the bar (see toggleFixed()), which is what
   that menu item is for. */

/**
 * The nearest tracked ancestor of el that is itself a fixed instance - the
 * navbar el has been promoted into.
 * @param el the element
 * @return the ancestor element, or null
 * @note Used by applyLayerOrder() to tell the one container that has to clear
 * the whole page from the ones already inside it.
 */
function fixedTrackedAncestor(el) {
  var box = el && el.parentElement && el.parentElement.closest(RESIZABLE_SEL);
  while (box) {
    if (isFixedInstance(box)) return box;
    box = box.parentElement && box.parentElement.closest(RESIZABLE_SEL);
  }
  return null;
}

/**
 * Paints the always-visible red "this is fixed" outline onto every rendered
 * element in FIXED_SET, and clears it off everything else. Only visible under
 * body.edit-mode, but harmless to run unconditionally.
 */
function applyFixedHighlight() {
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    el.classList.toggle("edit-fixed", isFixedInstance(el));
  });
}

/**
 * Marks every tagged element that is a real link or carries an "Add link" url
 * with .edit-link, so anything that navigates when clicked reads as visually
 * distinct from the plain content nested inside it.
 * @note Reruns on every setElementLink(), as applyFixedHighlight() reruns on
 * every toggleFixed().
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
 * Makes one element navigate to url when clicked.
 * @param el the element
 * @param url the link target, or "" to remove it
 * @note A real `<a>` just gets an href, so the browser's own affordances (new
 * tab, status bar, ctrl-click) work normally. In the editor, the click-to-edit
 * handler already preventDefaults before this fires, so a linked button never
 * navigates away mid-edit.
 * @note Anything else gets a click listener instead, gated on !isEditMode() so
 * clicking it in the editor still selects normally.
 * @note Guarded by a JS property, not a dataset attribute: cloneNode() copies
 * attributes but never listeners, so a duplicate would otherwise look "already
 * wired" with no listener behind it.
 */
function applyOneLink(el, url) {
  /* a gallery page action isn't somewhere to navigate to, it's something to
     DO here - so it takes the click-listener path even on a real <a>, and the
     href is stripped rather than set (an href="gallery:next" would be a broken
     navigation for anyone who ctrl-clicked it) */
  var action = galleryActionOf(url);
  if (el.tagName === "A" && !action) {
    if (url) el.href = url; else el.removeAttribute("href");
    return;
  }
  if (el.tagName === "A") el.removeAttribute("href");
  if (!el._hrLinkWired) {
    el._hrLinkWired = true;
    el.addEventListener("click", function (e) {
      if (isEditMode()) return;
      var act = galleryActionOf(el._hrLinkUrl);
      if (act) {
        e.preventDefault();
        if (window.stepGallery) window.stepGallery(act.dir, act.step);
        return;
      }
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

/* ---------------------------------------------------------------------------
   THE "APPLY NOW" LINK: one url (content.join_url) shared by every .join-link
   on the landing page - the hero's button, the nav's, the about section's.
   Deliberately not a content.links entry: they're several elements pointing
   at one thing, so a per-element link on one would silently drift the set
   apart the next time setJoinUrl() painted the shared url back over it.

   It used to be a field in the content manager's Landing page section, which
   is why the link editor pointed at it there. That section is gone, so the
   editor owns this too - the link editor and the links view both write it
   through setSharedJoinUrl(), which paints all of them at once.
   --------------------------------------------------------------------------- */

/* the current content.join_url, so the link editor has something to show
   without re-reading the snapshot (and so undo has a "before" to go back to) */
var JOIN_URL = "";

/**
 * Whether an element is one of the shared "Apply Now" buttons.
 * @param el any element
 * @return true if the element carries the .join-link class
 */
function isJoinLink(el) {
  return !!(el && el.classList && el.classList.contains("join-link"));
}

/**
 * Points every "Apply Now" on this page at a url, in the dom only.
 * @param url the shared url, empty meaning the built-in default
 */
function applyJoinUrl(url) {
  JOIN_URL = url || "";
  var href = JOIN_URL || DEFAULT_JOIN_URL;
  document.querySelectorAll(".join-link").forEach(function (a) { a.href = href; });
}

/**
 * Persists content.join_url into the preview snapshot, same draft every
 * other save*() in this file writes into.
 * @param url the shared url
 */
function saveJoinUrl(url) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.join_url = url || DEFAULT_JOIN_URL;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Changes the shared "Apply Now" url: dom, draft and undo stack, the same
 * three steps setElementLink() takes for an ordinary per-element link.
 * @param url the new url
 */
function setSharedJoinUrl(url) {
  var before = JOIN_URL;
  var after = (url || "").trim();
  if (before === after) return;
  applyJoinUrl(after);
  saveJoinUrl(after);
  EDIT_UNDO.push({ type: "joinUrl", id: "", before: before, after: after });
  EDIT_REDO.length = 0;
}

/* ---------------------------------------------------------------------------
   INLINE LINKS: a link on PART of a text field, rather than on the whole
   element the way LINKS/applyOneLink() does it.

   The two are complementary. An element link makes a whole card or button
   navigate; an inline link makes three words in the middle of a sentence
   navigate and leaves the rest alone - which is why "Apply here." on the
   login page was until now the one piece of copy a ta couldn't safely touch
   (its link was raw markup inside the field, with no ui that knew it existed).

   An inline link is just more of the field's own innerHTML, so it needs no
   storage: saveEditedField() already persists the markup verbatim and
   applyTextOverrides() restores it, so a link survives Apply, reload and
   profiles with no new plumbing, and gets undo/redo for free.
   --------------------------------------------------------------------------- */

/* what marks a piece of a field's text as linked. One class over both element
   shapes below, so css (the hover underline, the editor's dotted marker) and
   every lookup here have exactly one hook. */
var INLINE_LINK_CLASS = "txt-link";
var INLINE_LINK_SEL = ".txt-link";

/**
 * Which element an inline link inside this field has to be built out of.
 * @param field the data-edit-id text field
 * @return "a" or "span"
 * @note Normally a real `<a href>`, so ctrl-click, middle-click, status-bar
 * preview and the screen-reader link role all work with nothing simulated.
 * @note The exception is a field that IS a link or button, or sits inside
 * one. Nesting an `<a>` in either is invalid html: the parser unnests it, so
 * the link would silently fall out of the field the first time its saved
 * markup was restored. Those get a `<span data-href>` instead, navigated by
 * the delegated handler - exactly what applyOneLink() does for element links.
 */
function inlineLinkTagFor(field) {
  return field.closest && field.closest("a, button") ? "span" : "a";
}

/**
 * Reads an inline link's target, whichever shape it is (see
 * inlineLinkTagFor()).
 * @param el a .txt-link element
 * @return the url, or ""
 */
function inlineLinkHref(el) {
  return el.getAttribute("href") || el.getAttribute("data-href") || "";
}

/**
 * Points an inline link at a url, in whichever shape it already is - a real
 * `<a>` keeps using href, a span keeps using data-href.
 * @param el a .txt-link element
 * @param url the target
 */
function setInlineLinkHref(el, url) {
  if (el.tagName === "A") el.setAttribute("href", url);
  else el.setAttribute("data-href", url);
}

/**
 * Replaces a node with its own children, leaving the text it wrapped exactly
 * where it was. How an inline link is removed (and how a link that got caught
 * inside a newly created one is flattened, see applyInlineLinkToSelection()).
 * @param node the element to unwrap
 */
function unwrapInlineNode(node) {
  var parent = node.parentNode;
  if (!parent) return;
  while (node.firstChild) parent.insertBefore(node.firstChild, node);
  parent.removeChild(node);
  parent.normalize();
}

/**
 * The inline link the current text selection sits inside, if any - what makes
 * the toolbar's link button edit THAT link rather than nest a second one.
 * @param field the data-edit-id text field being edited
 * @return the link element, or null
 * @note Matches plain `<a>` markup too, not just .txt-link: a template's own
 * hand-written link should be just as editable as one placed here, which is
 * the whole point of the feature.
 */
function inlineLinkAt(field) {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var node = sel.getRangeAt(0).commonAncestorContainer;
  if (node.nodeType === 3) node = node.parentElement;
  var link = node && node.closest ? node.closest(INLINE_LINK_SEL + ", a") : null;
  /* the field itself can be the `<a>` closest() found (the "button" element
     kind is one) - that's an ELEMENT link, LINKS/setElementLink()'s business,
     not a piece of this field's text */
  if (!link || link === field || !field.contains(link)) return null;
  return link;
}

/**
 * Links whatever's currently selected inside field, or retargets the link the
 * selection is already inside.
 * @param field the data-edit-id text field being edited
 * @param url the target
 * @return true if the field's markup actually changed
 */
function applyInlineLinkToSelection(field, url) {
  var existing = inlineLinkAt(field);
  if (existing) {
    if (inlineLinkHref(existing) === url) return false;
    setInlineLinkHref(existing, url);
    existing.classList.add(INLINE_LINK_CLASS);
    return true;
  }
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  var range = sel.getRangeAt(0);
  if (range.collapsed) return false;
  var link = document.createElement(inlineLinkTagFor(field));
  link.className = INLINE_LINK_CLASS;
  setInlineLinkHref(link, url);
  if (link.tagName !== "A") {
    /* a span has to say out loud what an <a> says for free */
    link.setAttribute("role", "link");
    link.setAttribute("tabindex", "0");
  }
  try {
    range.surroundContents(link);
  } catch (e) {
    /* surroundContents() refuses a selection that only partially covers an
       element (half of a bold run, say). Extracting the contents and
       re-inserting them wrapped is the equivalent that copes - the browser
       closes and reopens the partially-covered markup around the split, which
       is the same thing execCommand would have done. */
    link.appendChild(range.extractContents());
    range.insertNode(link);
  }
  /* a link inside a link is meaningless (the two would fight over the same
     click), so anything that came along inside the selection is flattened */
  link.querySelectorAll(INLINE_LINK_SEL + ", a").forEach(unwrapInlineNode);
  sel.removeAllRanges();
  var after = document.createRange();
  after.selectNodeContents(link);
  sel.addRange(after);
  return true;
}

/**
 * Unlinks the text the selection covers, leaving the words themselves alone:
 * the link the caret sits in, or every link the selection touches if it spans
 * more than one.
 * @param field the data-edit-id text field being edited
 * @return true if the field's markup actually changed
 */
function removeInlineLinkAtSelection(field) {
  var link = inlineLinkAt(field);
  if (link) { unwrapInlineNode(link); return true; }
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return false;
  var range = sel.getRangeAt(0);
  var hit = [];
  field.querySelectorAll(INLINE_LINK_SEL + ", a").forEach(function (a) {
    if (range.intersectsNode(a)) hit.push(a);
  });
  hit.forEach(unwrapInlineNode);
  return hit.length > 0;
}

/**
 * Makes inline links navigate on the live site, and makes sure they never do
 * anywhere else. One delegated listener for the page, so a link a ta creates
 * mid-session is live the moment it exists.
 * @note Three cases: inside the portal's iframe nothing navigates (the click
 * still reaches wireTextField(), which opens the text for editing); a real
 * `<a>` on the live site is left alone; a `<span data-href>` is navigated by
 * hand, honouring ctrl/cmd/shift and middle-click as "new tab".
 */
function wireInlineLinks() {
  function navigate(e, link) {
    var url = inlineLinkHref(link);
    if (!url) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1 ||
        link.getAttribute("target") === "_blank") {
      window.open(url, "_blank", "noopener");
    } else {
      window.location.href = url;
    }
  }
  document.addEventListener("click", function (e) {
    var link = e.target.closest && e.target.closest(INLINE_LINK_SEL);
    if (!link) return;
    if (isPreviewMode()) { e.preventDefault(); return; }
    if (link.tagName === "A") return;
    navigate(e, link);
  });
  /* middle-click never fires a "click" event, and a span link is exactly the
     case where the browser has no built-in "open in new tab" of its own */
  document.addEventListener("auxclick", function (e) {
    if (e.button !== 1 || isPreviewMode()) return;
    var link = e.target.closest && e.target.closest(INLINE_LINK_SEL);
    if (link && link.tagName !== "A") navigate(e, link);
  });
  /* and a span link is focusable (role="link", tabindex 0), so it has to
     answer Enter the way a real link does */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" || isPreviewMode()) return;
    var link = e.target.closest && e.target.closest(INLINE_LINK_SEL);
    if (link && link.tagName !== "A" && !link.isContentEditable) navigate(e, link);
  });
}
wireInlineLinks();

/* the generated copy of a container's own painted surface, tagged with that
   container's id. Deliberately NOT in RESIZABLE_SEL: it's a layer, not an
   element a ta owns - it just gives the things ranked under its container
   something solid to be behind, and appears and disappears with it. */
var LAYER_SURFACE_SEL = "[data-layer-surface]";

/**
 * Whether el paints a surface something could sensibly be put behind:
 * anything with tracked elements inside it and a FULLY OPAQUE background.
 * @param el the element
 * @return true if el should carry a surface layer
 * @note "Tracked elements inside it" is asked directly rather than through
 * hasTrackedDescendants(), which answers a different question and calls a
 * theme toggle and a login button leaves on purpose, so deleting one takes
 * its pieces with it. They're still boxes with things painted on them.
 * @note Opaque is the whole test, and it's about the copy: a surface layer
 * repaints the same background over the container rather than hollowing it
 * out, so an opaque colour survives being painted twice while a translucent
 * one would composite with itself and quietly darken every faded panel. A
 * faded container therefore has nothing to be behind, which is honest.
 */
function paintsOwnSurface(el) {
  if (!el || !el.querySelectorAll || !el.querySelectorAll(RESIZABLE_SEL).length) return false;
  var cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return false;
  var nums = (cs.backgroundColor || "").match(/[\d.]+/g);
  if (!nums || nums.length < 3) return false;
  return nums.length < 4 || parseFloat(nums[3]) >= 1;
}

/**
 * Whether el establishes a stacking context of its own - ie whether a
 * negative z-index inside it resolves against EL's background or escapes to
 * an ancestor's.
 * @param el the element
 * @return true if el is a stacking context
 * @note The list is the css one; the last case is easily missed, since a flex
 * or grid item with a z-index becomes a context while still position:static.
 */
function createsStackingContext(el) {
  var cs = getComputedStyle(el);
  if (cs.position === "fixed" || cs.position === "sticky") return true;
  if (parseFloat(cs.opacity) < 1) return true;
  if (cs.transform !== "none" || cs.filter !== "none" || cs.perspective !== "none") return true;
  if (cs.isolation === "isolate" || cs.mixBlendMode !== "normal") return true;
  if ((cs.contain || "").indexOf("paint") !== -1 || (cs.contain || "").indexOf("layout") !== -1) return true;
  if ((cs.willChange || "").indexOf("transform") !== -1 ||
      (cs.willChange || "").indexOf("opacity") !== -1) return true;
  if (cs.zIndex === "auto") return false;
  if (cs.position !== "static") return true;
  var pd = el.parentElement ? getComputedStyle(el.parentElement).display : "";
  return pd.indexOf("flex") !== -1 || pd.indexOf("grid") !== -1;
}

/**
 * Whether el needs a copy of its own surface painted as a child layer.
 * @param el the element
 * @return true if el should carry a .layer-surface child
 * @note Narrower than painting one: only a stacking CONTEXT needs the copy,
 * since there the box's background paints first of all, below even the
 * negative band, and so can't be got behind any other way. A box that is not
 * one has nothing ranked under it to hold - applyLayerOrder() makes it one
 * first (see isolateLayerBox()) and this answers true on the pass after.
 * @note It used to read "a box that is not a context doesn't NEED one,
 * because a negative z-index inside it escapes to the nearest ancestor
 * context, where the box's own background covers it anyway". That's true of a
 * box sitting directly on the root and of nothing else: what a negative rank
 * escapes to is the nearest context ABOVE the box, so it lands below every
 * in-flow background in between - the box's, but also its section's and the
 * page's. Sending a day tag behind its row didn't put it behind the row, it
 * took it off the page.
 * @note Anything the layer order numbers counts as one whether it looks like
 * it yet or not, since applyLayerOrder() hands every ranked element a z-index
 * and position:relative. Asking the computed style would be a pass behind.
 */
function needsLayerSurface(el) {
  return paintsOwnSurface(el) && (!hasTrackedDescendants(el) || createsStackingContext(el));
}

/**
 * Builds, sizes and tears down the surface layers, so afterwards every box
 * that needs one has exactly one `.layer-surface` child and nothing else
 * does. Called from reconcileLayerOrder(), which every entry point into the
 * stacking order already goes through.
 * @note Rebuilt from the live computed style each pass rather than once at
 * load, because everything it reads can change: a ta recolours a card (so a
 * container that painted nothing now paints something), fades one, duplicates
 * one, or a section renders late off a fetch. The stale sweep is what makes
 * all four self-correcting.
 * @note Inserted as the FIRST child, which is also its default rank, so a
 * surface starts under everything its container holds and an untouched page
 * paints as it always did. position:relative goes on a still-static
 * container; relative alone never creates a stacking context, so this doesn't
 * wall its contents off from the rest of the page's ranking.
 */
function ensureLayerSurfaces() {
  /* stale sweep first: a surface whose container no longer paints one, whose
     container lost its id (the reel clones its tiles and strips the tracked
     attributes off the copies, see initReel()), or that arrived as a second
     copy inside a duplicated container */
  document.querySelectorAll(LAYER_SURFACE_SEL).forEach(function (s) {
    var owner = s.parentElement;
    if (owner && elId(owner) === s.getAttribute("data-layer-surface") &&
        s === owner.querySelector(":scope > " + LAYER_SURFACE_SEL) &&
        needsLayerSurface(owner)) return;
    s.remove();
  });

  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (!id || !needsLayerSurface(el)) return;
    var s = el.querySelector(":scope > " + LAYER_SURFACE_SEL);
    if (!s) {
      s = document.createElement("div");
      s.className = "layer-surface";
      s.setAttribute("data-layer-surface", id);
      s.setAttribute("aria-hidden", "true");
      el.insertBefore(s, el.firstChild);
    }
    var cs = getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";
    /* out to the container's border box, so the border is part of what an
       element can be put behind rather than a strip it still shows through */
    s.style.top = "-" + cs.borderTopWidth;
    s.style.right = "-" + cs.borderRightWidth;
    s.style.bottom = "-" + cs.borderBottomWidth;
    s.style.left = "-" + cs.borderLeftWidth;
  });
}

/**
 * Whether an element has been ranked below a container it lives in that
 * paints a surface - a ta asking for it to sit behind the panel itself, not
 * merely behind the panel's other contents.
 * @param m a member ({el, id}) from applyLayerOrder()
 * @param rank id -> its position in the layer order
 * @return the container el belongs under, or null
 * @note Ranking below the container is the trigger rather than a separate
 * flag because that's already what the layer menu means: every container is
 * seeded ahead of its children, so only a deliberate "send backward" puts
 * anything under it. Every enclosing box is checked, not just the nearest.
 * @note Returns the BOX rather than a yes/no because the caller has to make it
 * a stacking context before the negative rank means anything - see
 * isolateLayerBox(), and the note on applyLayerOrder()'s negative band.
 */
function surfaceRankedOver(m, rank) {
  if (rank[m.id] === undefined) return null;
  var box = m.el.parentElement;
  while (box && box !== document.body) {
    var id = (box.matches && box.matches(RESIZABLE_SEL)) ? elId(box) : null;
    if (id && rank[id] !== undefined && rank[m.id] < rank[id] && paintsOwnSurface(box)) return box;
    /* a negative z-index cannot leave a stacking context, so nothing outside
       the first one on the way up is reachable however the ranks compare. The
       theme toggle is exactly this: an opaque button that IS one, so its label
       going below zero landed above the button's background rather than below
       the navbar's, and the whole move looked like nothing happening. It has
       its own surface layer now. */
    if (createsStackingContext(box)) return null;
    box = box.parentElement;
  }
  return null;
}

/* marks a box applyLayerOrder() has made a stacking context on purpose, so the
   next pass can take the stamp back off before it works anything out. Cleared
   first every time rather than diffed: whether a box is a context changes what
   surfaceRankedOver() can see PAST, so a stamp left over from the last pass
   would feed into the next one's answer and the two could sit swapping. */
var LAYER_ISOLATE_ATTR = "data-layer-isolate";

/** Takes applyLayerOrder()'s own isolation stamps back off, page-wide. */
function clearLayerIsolation() {
  document.querySelectorAll("[" + LAYER_ISOLATE_ATTR + "]").forEach(function (el) {
    el.style.isolation = "";
    el.removeAttribute(LAYER_ISOLATE_ATTR);
  });
}

/**
 * Makes a box a stacking context, so a negative rank inside it resolves
 * against THIS box's background instead of escaping.
 * @param el the container something has been ranked behind
 * @note Without this, "send to back" on a day row's tag didn't put the tag
 * behind the row - it deleted it from view. The tag got a negative z-index,
 * the row was an ordinary static block and so no context at all, and a
 * negative rank that escapes lands below every in-flow background between it
 * and the root: the row's, the section's, the page's. "Behind the panel" and
 * "gone" look identical for exactly one panel and then stop.
 * @note isolation rather than a z-index, so the box still paints in its own
 * place in the flow - a number here would ALSO have hoisted it above every
 * unranked thing around it, which is a second change nobody asked for.
 * @note Only ever stamped on a box a ta has actually sent something behind, so
 * the sealing-in that comes with any stacking context costs nothing until the
 * moment it buys the move being asked for.
 */
function isolateLayerBox(el) {
  if (!el || createsStackingContext(el)) return;
  el.style.isolation = "isolate";
  el.setAttribute(LAYER_ISOLATE_ATTR, "1");
}

/**
 * Every element the stacking order covers - each tracked element, the page's
 * backdrops and every container's surface layer - in document order, tagged
 * with the id its rank is looked up by and its place in that order.
 * @return array of {el, id, dom, surface, fixed}
 * @note Iterated by ELEMENT, not by id: an id can be worn by more than one
 * element (the brand wordmark, mirrored in nav and footer), and each copy
 * gets its own z-index.
 */
function layerMembers() {
  var members = [];
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (id) members.push({ el: el, id: id });
  });
  /* document order is the tiebreak that keeps a page nobody has reordered
     painting exactly as the template laid it out */
  members.sort(function (a, b) {
    if (a.el === b.el) return 0;
    return (a.el.compareDocumentPosition(b.el) & 4) ? -1 : 1;
  });
  members.forEach(function (m, i) {
    m.dom = i;
    m.fixed = isFixedInstance(m.el);
  });
  return members;
}

/**
 * Ranks in LAYER_ORDER, id -> index. An id the saved order has never heard of
 * sorts after every one it has, by document order, so a newly added element
 * lands on top rather than in some arbitrary spot.
 * @return object mapping id to rank
 */
function layerRanks() {
  var rank = {};
  LAYER_ORDER.forEach(function (id, i) { rank[id] = i; });
  return rank;
}

/**
 * Sort comparator for two members of the one flat ranking: the ta's own
 * order, then document order for anything it has never heard of.
 * @param rank id -> rank, from layerRanks()
 * @return a comparator for layerMembers() entries
 * @note The fixed/non-fixed banding isn't in here - applyLayerOrder() splits
 * the members into those bands first and sorts each with this.
 */
function byLayerRank(rank) {
  return function (a, b) {
    var ra = rank[a.id], rb = rank[b.id];
    if (ra === undefined) ra = LAYER_ORDER.length + a.dom;
    if (rb === undefined) rb = LAYER_ORDER.length + b.dom;
    if (ra !== rb) return ra - rb;
    return a.dom - b.dom;
  };
}

/**
 * The ids one layer-menu click actually has to move, in current stacking
 * order (bottom first).
 * @param el the element
 * @return array of ids, bottom first, deduplicated
 * @note For a LEAF that's its own id. For a CONTAINER it's every ranked id
 * inside it: "send this card to the back" can only honestly mean "send
 * everything painted in this card to the back", together and in the order
 * they're in. That's also what a ta means by it - a card is its contents.
 * @note A theme toggle and a login element count as leaves here
 * (hasTrackedDescendants() calls them that on purpose) and still have pieces
 * holding ranks of their own, so those come along too, with the leaf's own id
 * under them. Dragging a toggle out of the navbar sends it to the
 * front of the page (seedUnseatedLayerRank()), and with its icon and label
 * left behind at their old ranks the button outranked its own two pieces,
 * which the next stacking pass reads as a ta having deliberately sent them
 * behind it (see surfaceRankedOver()) - so the button arrived on the page
 * empty, with both pieces painted under its own background.
 * @note Plus the container's OWN id when it holds a rank (see ranksAsBlock()),
 * because that id is what moves the panel the contents are sitting on. Left
 * out, the menu moved everything in a dragged card except the card, which is
 * the one part of it a ta is looking at. It goes at the BOTTOM of the block,
 * where a container is always seeded relative to its own children, so a card
 * brought to the front arrives with its contents still on top of it rather
 * than buried under its own background.
 * @note Nested containers are skipped for the same reason they're skipped
 * when z-index is handed out: they hold no rank, their leaves do.
 */
function layerSubtreeIds(el) {
  if (!el) return [];
  var own = elId(el);
  var leaf = !hasTrackedDescendants(el);
  var inside = layerMembers().filter(function (m) {
    return m.el !== el && el.contains(m.el) && !hasTrackedDescendants(m.el);
  });
  if (leaf && !inside.length) return own ? [own] : [];
  inside.sort(byLayerRank(layerRanks()));
  var ids = [], seen = {};
  if (own && (leaf || ranksAsBlock(el))) { seen[own] = true; ids.push(own); }
  inside.forEach(function (m) { if (!seen[m.id]) { seen[m.id] = true; ids.push(m.id); } });
  return ids;
}

/**
 * Reconciles a saved order with what's on the page right now and installs the
 * result as LAYER_ORDER: every unknown id is appended in document order, so a
 * page that's never been reordered stacks as if there were no layer system,
 * and anything added since starts out on top.
 * @param layers content.layers, ordered ids bottom to top
 * @return the reconciled order (also stored in LAYER_ORDER)
 * @note Called before any reorder as well as by applyLayerOrder(): a layer
 * button acting on an unknown id used to move it and then have every OTHER
 * unknown id appended on top a moment later, so "bring to front" on a gallery
 * tile's backdrop landed it under the very label it was asked to cover.
 */
function reconcileLayerOrder(layers) {
  /* before anything is ranked, since the surfaces are ranked too and a
     container that has only just started painting one needs its layer to
     exist before it can be given a place in the order */
  ensureLayerSurfaces();
  var order = (layers || []).slice();
  var have = {};
  order.forEach(function (id) { have[id] = true; });
  /* purely a migration: the three backdrops are ordinary tracked elements
     now, but an order saved back when they weren't ranked doesn't mention
     them, and the "append anything unknown" rule below would land them in
     FRONT of the page - exactly backwards for a backdrop. Walked in REVERSE
     because unshift() prepends: forwards would put the scrim behind the video
     and hide its darkening under the opaque clip. */
  BACKDROP_DEFAULT_BACK_IDS.slice().reverse().forEach(function (id) {
    if (!have[id] && elByAnyId(id)) { order.unshift(id); have[id] = true; }
  });
  domOrderIds().forEach(function (id) {
    if (!have[id]) { order.push(id); have[id] = true; }
  });
  LAYER_ORDER = order;
  return order;
}

/* marks an ancestor whose overflow applyClipEscapes() has released, holding
   whatever inline overflow it had before so the release can be handed back
   exactly. An attribute rather than a class so it survives the same
   rebuild-from-scratch passes LAYER_ISOLATE_ATTR does. */
var CLIP_RELEASE_ATTR = "data-clip-release";

/* marks the element that escaped, rather than the ancestor that let it: it
   is now painting over a section it isn't part of, which applyLayerOrder()
   reads to rank it over that section's contents. */
var CLIP_ESCAPED_ATTR = "data-clip-escaped";

/** Whether a ta's own drag or resize is what put el where it is. */
function hasGeometryOverride(el) {
  var d = el.dataset || {};
  return d.ovTx !== undefined || d.ovTy !== undefined ||
    d.ovW !== undefined || d.ovH !== undefined;
}

/**
 * Lifts the clip off any ancestor of el that a ta has just dragged el out
 * past, so the element stays visible instead of being cut off at the
 * container's edge.
 * @param el the element that just moved or resized
 * @note Cheap enough for a drag: it walks el's OWN ancestor chain, nothing
 * page-wide. applyClipEscapes() does the full reconcile on commit and load.
 * @note Only `hidden`/`clip` is released, never `auto`/`scroll`: a scroll
 * container overflows on purpose and unclipping one would take its
 * scrollbar - the editor's own reel strip is exactly that (see
 * .reel--editor-scroll).
 */
function releaseClipFor(el) {
  if (!el || !hasGeometryOverride(el)) return;
  var r = el.getBoundingClientRect();
  if (!r.width && !r.height) return;
  var p = el.parentElement;
  while (p && p !== document.body) {
    if (!p.hasAttribute(CLIP_RELEASE_ATTR)) {
      var ov = getComputedStyle(p).overflow;
      if (ov === "hidden" || ov === "clip") {
        var pr = p.getBoundingClientRect();
        if (r.top < pr.top - 1 || r.bottom > pr.bottom + 1 ||
            r.left < pr.left - 1 || r.right > pr.right + 1) {
          p.setAttribute(CLIP_RELEASE_ATTR, p.style.overflow || "");
          p.style.overflow = "visible";
          el.setAttribute(CLIP_ESCAPED_ATTR, "1");
        }
      }
    }
    p = p.parentElement;
  }
}

/**
 * Page-wide reconcile of releaseClipFor(): puts every released clip back,
 * then re-releases only the ones something still hangs out of.
 * @note Rebuilt from scratch each pass rather than diffed, same reasoning as
 * clearLayerIsolation(): whether an ancestor clips changes what the next
 * element's measurement sees, so a stale release would feed into it.
 * @note This is what a ta reads as a LAYER bug - drag a line of hero text
 * down into the section below and it disappears "under" that section - but
 * nothing was ever painted over it. `.hero` (and most sections here) carry
 * `overflow: hidden`, so the part of the element past the section's edge was
 * simply cut away: elementFromPoint() over it came back null, not the section.
 * No z-index can fix that, which is why this is geometry rather than ranking.
 * @note Gated on a ta's own move/resize (hasGeometryOverride()), never on
 * mere overhang: plenty of template elements are deliberately clipped by a
 * container - the About section's watermark is the standing example - and
 * unclipping those on sight would let them bleed into the page.
 * @note Runs on the live site too, not just in the editor: an element a ta
 * dragged across a section boundary has to stay whole for students as well.
 */
function applyClipEscapes() {
  document.querySelectorAll("[" + CLIP_RELEASE_ATTR + "]").forEach(function (p) {
    p.style.overflow = p.getAttribute(CLIP_RELEASE_ATTR);
    p.removeAttribute(CLIP_RELEASE_ATTR);
  });
  document.querySelectorAll("[" + CLIP_ESCAPED_ATTR + "]").forEach(function (el) {
    el.removeAttribute(CLIP_ESCAPED_ATTR);
  });
  document.querySelectorAll(RESIZABLE_SEL).forEach(releaseClipFor);
}

/**
 * Writes one element's z-index, and mirrors it onto its wrap when the wrap is
 * the thing holding the element's sticky positioning.
 * @param el the element
 * @param z the z-index to set, as a string ("" to clear)
 * @note `position: sticky` makes an element a stacking context whatever its
 * z-index is - unlike `relative`, which only does so once it has one. So the
 * moment carryStickyPosition() hands a .free-wrap the stickiness, that wrap
 * seals its element's z-index inside itself and takes the element's place in
 * the page's stacking order at its own level, which is plain document order.
 * For the navbar that is the very top of <body>, ie under everything - the
 * bar's whole stamp would be thrown away the first time a ta moved it. Giving
 * the wrap the same number puts the pair back where the one element was.
 * @note Every z-index applyLayerOrder() assigns goes through here, so there is
 * no path that sets one and forgets the wrap.
 */
function setLayerZ(el, z) {
  el.style.zIndex = z;
  var wrap = el.parentElement;
  if (wrap && wrap.hasAttribute && wrap.hasAttribute(STICKY_WRAP_ATTR)) wrap.style.zIndex = z;
}

/**
 * Applies an explicit stacking order to every tracked element and to the
 * page's backdrops: z-index is just an id's rank (bottom = 1), so the layer
 * menu is the only thing that ever reorders anything and a resize no longer
 * silently bumps an element above its neighbours. Runs on every load, live
 * site included.
 * @param layers content.layers, ordered ids bottom to top
 *
 * @note ONE flat rank for the whole page, not one scoped per container - the
 * only arrangement that answers the question a ta is actually asking. Css
 * compares z-index inside a stacking context and nowhere else, and any
 * positioned element given a z-index BECOMES one, so the moment a container
 * carries a number everything inside is sealed in with it. A scoped version
 * made "send to back" a half-truth below the first section: nothing could
 * cross between two boxes, and reaching across by dragging each element's
 * whole ancestor chain re-stacked entire SECTIONS as a side effect.
 * @note So a stacking context is only ever escaped by not creating one:
 * almost no tracked container is given an explicit z-index at any depth. It
 * stays at z-index:auto, which never establishes a context. Only a LEAF
 * competes for a number, and every leaf on the page shares one ranking - so a
 * hero caption can go behind the hero video, or a day tile's lock icon behind
 * its rect, all through the same list. A container holding no rank isn't the
 * same as being unlayerable: the menu moves everything inside it as one block.
 * @note "Almost" is ranksAsBlock(): a container that has been pasted, dragged
 * or resized is out of flow and so really does paint against boxes it
 * overlaps, and its panel is its own to move. Those DO get a number, and their
 * contents ride with them. Every container still in flow overlaps nothing, so
 * it keeps the rule and loses nothing observable by keeping it.
 * @note A surface a ta can get behind is always a real element, never a
 * container's own `background`, which is unrankable - css paints it before
 * every descendant whatever z-index they get. The hand-written ones (a tile's
 * rect, the hero's video and scrim, the about watermark) are ordinary ranked
 * leaves. The rest are generated by ensureLayerSurfaces() and are NOT ranked:
 * they're pinned at z-index:-1, the one number meaning "over this box's own
 * background, under everything in it". What gets ranked is the elements
 * beneath them, at -2 and down.
 * @note That does mean "send to back" on an element sitting directly on a
 * section takes it under that section's panel and out of sight. That's the
 * honest reading of the button, and it undoes like any other layer move.
 * @note Fixed elements get no band of their own and need none: "Promote to
 * navbar" MOVES an element into the bar, and the bar is stamped clear of the
 * whole page below, so what's left to decide is only the order the bar's own
 * contents paint in. A second band that lifted every fixed element above
 * every non-fixed one became actively wrong once the bar's surface was
 * rankable - it sorted into the fixed band above every un-promoted nav link,
 * and the dashboard's links vanished under the bar's own backdrop.
 * @note A fixed CONTAINER - nav itself - is stamped one past every rank on
 * the page even though ordinary containers get nothing, which keeps a sticky
 * bar over scrolling content however many leaves the page grows.
 * `.nav`'s hardcoded z-index: 50 stays as the no-js default. Nothing on the
 * page gets past that stamp - see THE FIXED BAR BEATS EVERYTHING above.
 */
function applyLayerOrder(layers) {
  /* back to a clean slate before anything is worked out - see the note on
     LAYER_ISOLATE_ATTR. Ahead of reconcileLayerOrder(), which builds the
     surface layers, since which boxes need one depends on which are contexts */
  clearLayerIsolation();
  reconcileLayerOrder(layers);
  /* before any z-index is worked out, since which elements have escaped
     their section is part of the answer - see the members reorder below */
  applyClipEscapes();
  var rank = layerRanks();

  /* one flat pass over every actual DOM element: a container (has tracked
     descendants of its own) gets no explicit z-index unless it's one of the
     two that paint against something they overlap, see ranksAsBlock() */
  var members = layerMembers();
  members.forEach(function (m) {
    m.assignZ = !hasTrackedDescendants(m.el) || ranksAsBlock(m.el);
  });
  members.sort(byLayerRank(rank));
  /* an element a ta has dragged clear of its own section goes to the top of
     the ordinary band, keeping its order against anything else that has also
     escaped. The flat page-wide order is seeded in dom order, so a hero
     element carries a hero-sized rank wherever it is dragged to - which put
     it under every single thing in the section it had just been dropped onto,
     the other half of "it appears under the next section's layer". Dropping
     something on top of something else leaving it on top is what the gesture
     means in every other editor.
     The top of the ordinary band and no further: clearing the section it
     landed on is the point, and the fixed navbar is above the whole band
     regardless. Still a starting rank, not a lock - the layer menu moves it
     from here like any other. */
  var escaped = [], settled = [];
  members.forEach(function (m) {
    (m.el.hasAttribute(CLIP_ESCAPED_ATTR) ? escaped : settled).push(m);
  });
  members = settled.concat(escaped);
  var top = members.length + 1;

  /* everything ranked below one of its own containers' surfaces. Those go
     BELOW zero, and are the only things that do: -1 is the surface layer
     itself, and css paints a negative-z descendant right after the background
     of whichever context it resolves in, so -2 and down is under the panel and
     under nothing else. Most negative to the lowest-ranked, so they keep the
     order the menu shows. What stops "hidden but still there" coming back is
     that a member only goes negative when there is a real opaque panel over
     it to be behind. */
  var behind = [];
  members.forEach(function (m) {
    if (!m.assignZ) return;
    var box = surfaceRankedOver(m, rank);
    if (box) { m.behindBox = box; behind.push(m); }
  });
  /* "under the panel and under nothing else" is only true while the panel's
     own box is a stacking context to be under - so make each one that isn't,
     and rebuild the surfaces now that the answer has changed for them */
  if (behind.length) {
    behind.forEach(function (m) { isolateLayerBox(m.behindBox); });
    ensureLayerSurfaces();
  }
  behind.forEach(function (m, i) { m.behindZ = -(behind.length - i + 1); });

  var z = 1;
  members.forEach(function (m) {
    /* a FIXED container has to visually clear the whole non-fixed band while
       scrolling. One past the highest number anything on the page can have, so
       it stays correct however large the page grows - nav used to lean on
       css's own z-index: 50, which stopped being enough past 50 tracked
       leaves. Ahead of the ranked path as well as the unranked one: a navbar
       the ta has dragged is a ranksAsBlock() container now, and an ordinary
       rank there would drop the bar back under the page it has to clear.

       Only the OUTERMOST fixed container gets it, never one nested inside
       another. A number on a nested one buys nothing and costs the thing
       this is for: a flex ITEM with a z-index becomes a stacking context
       even while position:static, which is exactly what `.brand` is inside
       `.nav-inner` - sealing the wordmark and logo in above the bar's own
       surface, so "send to back" on either changed nothing on screen. */
    if (hasTrackedDescendants(m.el)) {
      if (m.fixed && !fixedTrackedAncestor(m.el)) { setLayerZ(m.el, String(top)); return; }
      if (!m.assignZ) { setLayerZ(m.el, ""); return; }
    }
    if (getComputedStyle(m.el).position === "static") m.el.style.position = "relative";
    if (m.behindZ !== undefined) { setLayerZ(m.el, String(m.behindZ)); return; }
    var zi = z;
    setLayerZ(m.el, String(zi));
    /* a tint overlay is a plain untracked sibling div after its image in the
       same free-wrap: without its own z-index it stays at auto, and any
       element here with an explicit one (including its own image) paints
       above auto regardless of dom order, hiding the tint. The SAME z-index
       as its image is enough - for two elements sharing one, dom order
       decides, and the overlay is already the later sibling. */
    if (m.el.parentNode && m.el.parentNode.classList &&
        m.el.parentNode.classList.contains("free-wrap")) {
      var tintOv = m.el.parentNode.querySelector(".tint-ov");
      if (tintOv) tintOv.style.zIndex = String(zi);
      /* same reasoning, same fix, for a shade overlay (setElementShade()) */
      var shadeOv = m.el.parentNode.querySelector(".shade-ov");
      if (shadeOv) shadeOv.style.zIndex = String(zi);
    }
    z++;
  });
}

/**
 * Shifts one element one step up or down the stacking order, repaints every
 * z-index and persists the whole order.
 * @param id the element's data-edit-id or data-resize-id
 * @param dir +1 to bring forward one step, -1 to send backward one step
 * @return true if it actually moved, false at either end of its band (so
 *   pushLayerUndo() knows not to record a no-op step)
 * @note The step is over the one flat page-wide order, skipping anything the
 * element could never paint against anyway, so a click really does move it
 * past exactly one thing. A CONTAINER steps as a block, keeping its leaves'
 * order among themselves - the only thing stepping a container can mean.
 */
function moveLayer(id, dir) {
  /* reconciled first so every id involved is certain to be IN the order
     before anything is moved - see reconcileLayerOrder() */
  reconcileLayerOrder(LAYER_ORDER);
  var block = layerSubtreeIds(elByAnyId(id));
  if (!block.length) block = [id];
  var inBlock = {};
  block.forEach(function (b) { inBlock[b] = true; });

  /* one step lands past something that can actually paint against the element
     being moved. Two ids never can if they sit in different stacking contexts
     - css compares z-index inside one and nowhere else, so how their ranks
     compare decides nothing, and stepping past such an id looks exactly like
     the button doing nothing. An id with nothing rendered is skipped for the
     same reason.

     This used to ask only "same <nav>?", which caught the navbar and missed
     every other context on the page: a reel's masked track, a faded panel, a
     card the ta has dragged (ranksAsBlock()). Asking for the nearest enclosing
     context by its real css definition catches the navbar too - a sticky bar
     is one - and needs no list to be kept up to date. */
  var byId = {};
  layerMembers().forEach(function (m) { if (!byId[m.id]) byId[m.id] = m.el; });
  var stepScopes = {};
  function stepScopeOf(lid) {
    if (stepScopes.hasOwnProperty(lid)) return stepScopes[lid];
    var box = byId[lid] ? byId[lid].parentElement : null;
    var found = null;
    while (box && box !== document.body) {
      if (createsStackingContext(box)) { found = box; break; }
      box = box.parentElement;
    }
    stepScopes[lid] = found;
    return found;
  }
  var myScope = stepScopeOf(id);

  /* the nearest id on the far side of the block that shares its band: what
     one step has to end up past */
  var edge = -1;
  block.forEach(function (b) {
    var i = LAYER_ORDER.indexOf(b);
    if (i === -1) return;
    if (edge === -1 || (dir > 0 ? i > edge : i < edge)) edge = i;
  });
  if (edge === -1) return false;
  var j = edge + dir;
  while (j >= 0 && j < LAYER_ORDER.length &&
         (inBlock[LAYER_ORDER[j]] || !byId[LAYER_ORDER[j]] ||
          stepScopeOf(LAYER_ORDER[j]) !== myScope)) j += dir;
  if (j < 0 || j >= LAYER_ORDER.length) return false;

  /* lift the whole block out and drop it back on the far side of that id */
  var target = LAYER_ORDER[j];
  var rest = LAYER_ORDER.filter(function (x) { return !inBlock[x]; });
  var at = rest.indexOf(target);
  if (at === -1) return false;
  Array.prototype.splice.apply(rest, [dir > 0 ? at + 1 : at, 0].concat(block));
  LAYER_ORDER = rest;
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
 * Moves id all the way to the front or back of the PAGE, by dropping it at
 * the extreme end of LAYER_ORDER.
 * @param id the element's data-edit-id or data-resize-id
 * @param toTop true for "to top" (front), false for "to bottom" (back)
 * @return true if the order actually changed
 * @note Since the order is flat and page-wide, an end of the array really is
 * the front or back of everything painted - the section, card, tile and the
 * page's own backdrops included - which is what the button says.
 * @note A CONTAINER moves as a block, keeping its leaves' order among
 * themselves, since it holds no rank of its own.
 */
function moveLayerExtreme(id, toTop) {
  reconcileLayerOrder(LAYER_ORDER);
  var before = LAYER_ORDER.slice();
  var block = layerSubtreeIds(elByAnyId(id));
  if (!block.length) block = [id];
  /* pushed bottom-first for the front, unshifted top-first for the back, so
     either way the block lands with its own order intact */
  (toTop ? block : block.slice().reverse()).forEach(function (cid) {
    var i = LAYER_ORDER.indexOf(cid);
    if (i !== -1) LAYER_ORDER.splice(i, 1);
    if (toTop) LAYER_ORDER.push(cid); else LAYER_ORDER.unshift(cid);
  });
  if (LAYER_ORDER.join("") === before.join("")) { LAYER_ORDER = before; return false; }
  applyLayerOrder(LAYER_ORDER);
  saveLayerOrder(LAYER_ORDER);
  return true;
}

/**
 * Pushes a "layerorder" undo entry for a to-top/to-bottom jump, unless
 * moveLayerExtreme() reports a no-op.
 * @param id the element's data-edit-id or data-resize-id
 * @param toTop true for "to top", false for "to bottom"
 * @note Stores the whole before/after stack rather than an id+dir, since
 * jumping to an extreme isn't its own inverse the way a swap is.
 * @note Reconciled before the "before" side is taken, because moveLayerExtreme()
 * reconciles too and would otherwise append ids the snapshot has never heard
 * of. Undoing then restored a stack missing them, and reconcileLayerOrder()
 * put every one of them back on TOP - so undoing a layer move on a page with
 * anything newly placed on it dragged that new thing to the front as well.
 */
function pushLayerExtremeUndo(id, toTop) {
  reconcileLayerOrder(LAYER_ORDER);
  var before = LAYER_ORDER.slice();
  if (!moveLayerExtreme(id, toTop)) return;
  EDIT_UNDO.push({ type: "layerorder", before: before, after: LAYER_ORDER.slice() });
  EDIT_REDO.length = 0;
}

/**
 * Persists the whole stacking order into the preview snapshot. Rewritten
 * wholesale rather than merged, since LAYER_ORDER is always the full stack.
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

/* undo/redo for every visual editor action, a plain stack of commits - see
   applyHistoryAction() for the entry shapes. A duplicate reuses the "add"
   shape, and a fresh edit clears the redo stack, as in any text editor. */
var EDIT_UNDO = [];
var EDIT_REDO = [];

/**
 * Hands the wrap the properties that decide WHICH slot of its parent's layout
 * the element was occupying, so the wrap takes that same slot.
 * @param wrap the brand-new .free-wrap
 * @param cs the detaching element's already-read computed style
 * @note Only these four: they are the ones a flex or grid parent reads off an
 * ITEM to place it, so they belong to the slot rather than to the element, and
 * a wrap that freezes the slot without them freezes the wrong one. Everything
 * about the element's own box (its size, its margins) is already copied over
 * by detachFromFlow() itself.
 * @note `order` is the one that actually bit. `.day-row` is a grid of
 * `auto 90px 1fr` and its icon is pulled to the front with `order: -1`; the
 * wrap, matching no stylesheet rule, defaults to 0 and so sorted to the END of
 * the row. Every remaining child then slid one track along - the day tag went
 * from 90px to 35px and the title/count column from 880px to 90px, which is
 * what "moving an element out of its container resets the width of all the
 * others" was. Nothing had touched their widths at all; they were in different
 * columns.
 * @note Harmless wherever the parent lays out no items: all four properties
 * apply to flex and grid children only, and are ignored on a block child.
 */
function carryFlowSlot(wrap, cs) {
  wrap.style.order = cs.order;
  wrap.style.alignSelf = cs.alignSelf;
  wrap.style.justifySelf = cs.justifySelf;
  /* explicit grid placement, for a parent that names tracks rather than
     letting auto-placement walk them. gridArea is the shorthand for all four
     of row/column start/end, so one read covers the lot. */
  wrap.style.gridArea = cs.gridArea;
}

/* marks a .free-wrap that has taken over its element's own sticky positioning
   (see carryStickyPosition()), so applyLayerOrder() knows to mirror the
   element's z-index onto it. */
var STICKY_WRAP_ATTR = "data-sticky-wrap";

/**
 * Moves a sticky element's stickiness onto its wrap, so detaching it from flow
 * doesn't quietly turn it into a plain element parked at the top of the page.
 * @param wrap the brand-new .free-wrap
 * @param cs the detaching element's already-read computed style
 * @note detachFromFlow() makes every element it touches `position: absolute`
 * inside its wrap - that is the whole mechanism, and it is what lets a resize
 * change the element's real box without moving anything around it. On a
 * `position: sticky` element it also silently deletes the sticking: the navbar
 * is `sticky; top: 0`, so the first time a ta moved or resized it the bar
 * stopped following the page down and just sat at the top of the document,
 * scrolling away like any other block. The editor was then showing a navbar
 * that behaved like no navbar the site has ever shipped.
 * @note The wrap is the right place for it, not the element. The wrap is the
 * element's frozen slot: it is the thing still IN flow, so it is the only
 * thing that can sit at the scrollport's edge and stay there. The element goes
 * on being absolute at (0,0) inside it and rides along, which leaves
 * paintPos()/setBox() and every other bit of the editor's machinery untouched.
 * @note Copies the inset the element was actually sticking against rather than
 * assuming top: 0, and only the ones that are set - `auto` on all four is a
 * sticky element that never sticks to anything, and writing zeros in would
 * invent behaviour the page never had.
 */
function carryStickyPosition(wrap, cs) {
  if (cs.position !== "sticky") return;
  wrap.style.position = "sticky";
  ["top", "right", "bottom", "left"].forEach(function (side) {
    if (cs[side] !== "auto") wrap.style[side] = cs[side];
  });
  wrap.setAttribute(STICKY_WRAP_ATTR, "1");
}

/**
 * Takes el out of normal document flow so its real width/height can change
 * without touching anything else on the page.
 * @param el the element to detach from flow
 * @return el's wrap
 * @note An absolutely positioned box is excluded from its containing block's
 * fit-content size by definition, so however big el gets, nothing shifts
 * because of it. Only done lazily, on the first resize or a saved size.
 * @note Wraps el in a `<span class="free-wrap">` frozen to its pre-detach
 * size, so its old slot doesn't collapse or get filled by a sibling. The
 * wrap's display matches el's natural one - forcing inline-block on
 * everything would pull block siblings onto one line.
 * @note Sizes come from offsetWidth/Height (layout px) rather than the rect,
 * so an element with a stylesheet transform doesn't bake its visual size in
 * as its layout size. Svg has no offsetWidth, so icons fall back to the rect.
 */
function detachFromFlow(el, knownRect) {
  var wrap = el.parentNode;
  if (wrap && wrap.classList && wrap.classList.contains("free-wrap")) return wrap;

  /* el's exact pre-detach viewport position, so any drift the wrap/reparent
     introduces can be measured and cancelled. Accepts an already-measured
     rect: a grouped move detaches several siblings in one gesture, and an
     EARLIER sibling leaving flow can itself reflow a LATER one still waiting
     its turn, so measuring fresh here would capture the second element's
     position after the first had already nudged it. */
  var preRect = knownRect || el.getBoundingClientRect();

  /* an element already position:absolute via its OWN stylesheet rule (a tile
     rect, inset:0 over its tile) needs a different path: the normal logic
     below measures el's rendered size and turns it into an IN-FLOW block. For
     an inset:0 element that size IS its whole parent tile, so the wrap becomes
     a phantom box as tall as the tile, inserted into the tile's own flow on
     top of its real content - which is what corrupted the day tiles when a
     rect took a tiny accidental drag. Since el was never in flow, its wrap
     shouldn't be either: give the wrap the same absolute scheme. */
  if (getComputedStyle(el).position === "absolute") {
    var absAncestor = el.offsetParent || el.parentNode;
    var absParentRect = absAncestor.getBoundingClientRect();
    wrap = document.createElement("span");
    wrap.className = "free-wrap";
    wrap.style.position = "absolute";
    wrap.style.left = (preRect.left - absParentRect.left) + "px";
    wrap.style.top = (preRect.top - absParentRect.top) + "px";
    wrap.style.width = preRect.width + "px";
    wrap.style.height = preRect.height + "px";
    el.parentNode.insertBefore(wrap, el);
    wrap.appendChild(el);
    el.dataset.natW = preRect.width;
    el.dataset.natH = preRect.height;
    el.style.position = "absolute";
    el.style.top = "0";
    el.style.left = "0";
    el.style.margin = "0";
    el.style.maxWidth = "none";
    el.style.width = preRect.width + "px";
    el.style.height = preRect.height + "px";
    el.style.transition = "none";
    return wrap;
  }

  /* getBoundingClientRect keeps sub-pixel precision; offsetWidth/Height round
     to whole px, fine for a transformed element but otherwise enough to nudge
     a child's text across its wrap threshold and reflow it */
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
  /* any "inline-*" keyword is still an inline-LEVEL box: its margin does NOT
     collapse with an adjacent block sibling's. Forcing every non-"inline"
     value to a plain "block" wrap turned an inline-flex button's wrap into a
     real block box, which DOES collapse margins - shrinking the shared parent
     and reflowing everything below it. */
  var isInlineLevel = /^inline/.test(naturalDisplay);
  /* el's own margin becomes the gap flow siblings expect around its old
     slot; moved onto the wrap below so zeroing it on el (needed so its
     absolute box isn't shoved off (0,0) inside the wrap) doesn't collapse
     that spacing and pull the next sibling up into it */
  var cs = getComputedStyle(el);
  var mTop = cs.marginTop, mRight = cs.marginRight, mBottom = cs.marginBottom, mLeft = cs.marginLeft;

  wrap = document.createElement("span");
  wrap.className = "free-wrap";
  wrap.style.display = isInlineLevel ? "inline-block" : "block";
  wrap.style.width = w + "px";
  wrap.style.height = h + "px";
  wrap.style.margin = mTop + " " + mRight + " " + mBottom + " " + mLeft;
  /* an inline-block whose only child is position:absolute has no in-flow
     content, so its default baseline falls back to its own bottom margin edge
     instead of the original text's baseline. That drags the box above the
     line's baseline as pure ascent, inflating the line box and its container,
     which shifts unrelated siblings. Aligning to the line's top removes the
     wrap from that calculation entirely. */
  if (isInlineLevel) wrap.style.verticalAlign = "top";
  carryFlowSlot(wrap, cs);
  carryStickyPosition(wrap, cs);
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

  /* independently-tracked descendants get counter-translated to stay visually
     put while el moves - but that only works if el can't clip them. An
     overflow:hidden ancestor crops anything outside its OWN box however a
     child got there, so as el moved further from its start its "staying put"
     children would fall outside its new box and vanish. Forcing visible is
     scoped to exactly the containers that need it: nothing tracked inside
     means nothing can escape, so a childless element keeps its clip. */
  if (el.querySelectorAll(RESIZABLE_SEL).length > 0) {
    if (cs.overflowX === "hidden" || cs.overflowX === "clip") el.style.overflowX = "visible";
    if (cs.overflowY === "hidden" || cs.overflowY === "clip") el.style.overflowY = "visible";
  }

  /* a naturally-inline element blockifies the instant position:absolute
     lands on it, which can render its text a few px off the tight inline rect
     measured above - the line's leading now applies as a block, and shifts
     again depending on what else still shares its old line box. Rather than
     reason about which css mechanic applies, measure the result and cancel
     out the drift, so detaching is pixel-seamless unconditionally. */
  var postRect = el.getBoundingClientRect();
  var driftX = postRect.left - preRect.left, driftY = postRect.top - preRect.top;
  if (driftX || driftY) {
    el.style.left = (-driftX) + "px";
    el.style.top = (-driftY) + "px";
  }
  return wrap;
}

/* the visual editor's one selection ring: a floating frame following whichever
   tracked element was last clicked, carrying 8 resize handles and one move
   handle. One shared ring rather than per-element grips, so a hundred tagged
   elements never show overlapping handles and nested ones stay individually
   grabbable. Selection is click-based and sticky: it stays where it was
   regardless of the mouse afterwards, so an element just dragged behind
   another can still be grabbed by its move handle. */
var RING = null;
var RING_EL = null;
var RING_DRAGGING = false;
/* the ring's one layer-order button, so the popover can anchor under it */
var LAYER_BTN = null;
/* the ring's one style (color/opacity) button, so the popover can anchor under it */
var STYLE_BTN = null;
/* the ring's one "select the container around this" button, so positionRing()
   can name the container it would actually jump to */
var PARENT_BTN = null;

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
    /* the shift half is the only way a ta finds out it's there, see
       startResizeDrag() - a modifier nobody mentions is a modifier nobody
       uses, and the double-click reset below has the same problem */
    h.title = "Drag to resize, hold Shift to keep the shape. Double-click to reset.";
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

  /* "select the container around this" - see parentSelectableOf() for why a
     click alone can't always reach one */
  var par = document.createElement("span");
  par.className = "parh";
  par.title = "Select the container around this";
  par.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/>' +
    '<path d="M5 12l7-7 7 7"/></svg>';
  PARENT_BTN = par;
  par.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  par.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var up = parentSelectableOf(RING_EL);
    if (!up) return;
    RING_EL = up;
    positionRing();
  });
  RING.appendChild(par);

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
 * Whether el is button-like and so needs its own Text color control,
 * separate from its background.
 * @param el the element
 * @return true if el is a button
 * @note Covers a custom Button element and the template's own CTA links (a
 * tagged `<a class="btn">`, whose text box IS the button), plus a theme
 * toggle - a plain `<button>` the class check alone misses, whose Color row
 * already means its background, leaving its label with no other control.
 */
function isButtonEl(el) {
  return (el.tagName === "A" && el.classList.contains("btn")) || isThemeToggleEl(el);
}

/**
 * Which css property a colour override lands on for a given element.
 * @param el the element
 * @return "icon", "text", or "bg"
 * @note An icon (currentColor throughout this icon set) gets its foreground;
 * a plain text field its font colour; everything else its background, the
 * only visible surface a container has. A button's text colour is a separate
 * control, see applyTextColorOverrides().
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
 * Whether el's opacity has to fade its own background surface rather than
 * using real css opacity.
 * @param el the element
 * @return true if opacity should fade backgroundColor instead of el itself
 * @note Css opacity is a group compositing effect that fades an element's
 * WHOLE subtree - the same problem setHiddenVisual() has for delete - so a
 * wrapper with tracked children can't use it without dragging their look down
 * too. Scoped to "bg" targets, which covers every container here that can
 * hold nested tracked content; an icon and an image are always leaves.
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
 * last-known colour and opacity, both kept on its own dataset.
 * @param el the element
 * @note Colour and opacity land on the SAME css property, so re-reading an
 * already alpha-blended computed colour as the base for the next change would
 * compound - each edit fading it further - instead of composing the two.
 * @note data-op-color defaults to the element's pristine background, captured
 * once by applyColorOverrides() before either override touches it, so an
 * element with no colour override still fades its real surface.
 */
function paintSurface(el) {
  var hex = el.dataset.opColor || el.dataset.baseColor || rgbToHex(getComputedStyle(el).backgroundColor) || "#000000";
  var alpha = el.dataset.opAlpha !== undefined ? parseFloat(el.dataset.opAlpha) : 1;
  el.style.opacity = "";
  el.style.backgroundColor = hexToRgba(hex, alpha);
}

/**
 * Paints one element's colour override onto whichever css property
 * colorTarget() picks (icon and text both use el.style.color).
 * @param el the element
 * @param value a css color string, or "" to clear back to the default
 * @note A fadesOwnBackground() wrapper never writes backgroundColor here: it
 * stashes the colour on the dataset and repaints through paintSurface(), so a
 * colour change composes with the active opacity rather than resetting it.
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
 * Applies value (0-1) as el's own opacity without touching anything nested
 * inside it - see fadesOwnBackground() for why plain css opacity can't be
 * used on a wrapper.
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
  progressFill: {}, darkProgressFill: {}, progressTrack: {}, darkProgressTrack: {},
  hoverColor: {}, darkHoverColor: {}, activeColor: {}, darkActiveColor: {}
};

/**
 * Applies saved colour overrides on top of the page's own default colours.
 * Runs on every load, live site included.
 * @param colors content.colors, {id: css color string}
 * @param darkColors content.dark_colors, {id: css color string}, the explicit
 *   dark-mode override for whichever ids also have one here
 * @note Images and videos are skipped: a background colour behind an
 * object-fit: cover element is never visible.
 * @note Also captures every fadesOwnBackground() wrapper's pristine default
 * background before anything this load could have touched it, so a later fade
 * or reset always has the real template default to fall back to.
 */
function applyColorOverrides(colors, darkColors) {
  colors = colors || {};
  THEMED_OVERRIDE_MAPS.colors = colors;
  THEMED_OVERRIDE_MAPS.darkColors = darkColors || {};
  /* styleableEls(), not RESIZABLE_SEL: the page takes a color of its own
     without being a tracked element, see elId() */
  styleableEls().forEach(function (el) {
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
 * Applies saved opacity overrides on top of the page's default (fully
 * opaque). Runs on every load, live site included.
 * @param opacity content.opacity, {id: number 0-1}
 * @note Must run after applyColorOverrides(), so a fadesOwnBackground()
 * wrapper's data-base-color is already captured.
 */
function applyOpacityOverrides(opacity) {
  opacity = opacity || {};
  /* styleableEls(), same reasoning as applyColorOverrides() */
  styleableEls().forEach(function (el) {
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
 * Applies saved button text-colour overrides on top of the page's default
 * `.btn` text colour. Runs on every load, live site included.
 * @param colors content.text_color, {id: css color string}
 * @param darkColors content.dark_text_color, {id: css color string}
 * @note A button's Color row already controls its background, and css has no
 * single property meaning "whichever of background/text makes sense here", so
 * its label needs a control of its own.
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

/* ================= HOVER / CLICK COLORS =================
 *
 * A second and third colour for any element a ta can already recolour - not
 * just buttons: what it looks like under the cursor, and while it's pressed.
 *
 * Three things shape how it's stored and applied:
 *  - There is no inline :hover. The colour travels as a css custom property,
 *    with a marker attribute saying which css property it belongs on. Which
 *    of the two follows colorTarget(), the split the Color row already makes.
 *  - The two states default into each other: picking a hover colour gives the
 *    press state the same one, and picking a click colour splits them apart.
 *  - Grouped elements light up together, which is why the state is a class
 *    this file paints rather than the :hover pseudo-class - no selector can
 *    reach sideways from a hovered element to an unrelated one.
 */

/**
 * Applies saved Hover color/Click color overrides on top of the page's own
 * default hover/press feedback (.btn:hover/.btn:active in css/style.css,
 * still what an element with no pick of its own gets). Runs on every load,
 * live site included, same as applyColorOverrides().
 * @param hoverColor content.hover_color, {id: css color string}
 * @param darkHoverColor content.dark_hover_color, {id: css color string}
 * @param activeColor content.active_color, {id: css color string}
 * @param darkActiveColor content.dark_active_color, {id: css color string}
 */
function applyStateColorOverrides(hoverColor, darkHoverColor, activeColor, darkActiveColor) {
  THEMED_OVERRIDE_MAPS.hoverColor = hoverColor || {};
  THEMED_OVERRIDE_MAPS.darkHoverColor = darkHoverColor || {};
  THEMED_OVERRIDE_MAPS.activeColor = activeColor || {};
  THEMED_OVERRIDE_MAPS.darkActiveColor = darkActiveColor || {};
  /* styleableEls(), same reasoning as applyColorOverrides() */
  styleableEls().forEach(function (el) {
    paintElementStateColor(el, "hover");
    paintElementStateColor(el, "press");
  });
  wireStateColorHover();
}

/**
 * Writes one element's hover-or-press colour out as the custom property and
 * marker attribute pair the stylesheet reads, clearing both when nothing is
 * picked.
 * @param el the element
 * @param which "hover" or "press"
 * @note Split out so the popover's live swatches repaint through the exact
 * code the load-time pass uses, rather than a second copy that could drift.
 */
function paintElementStateColor(el, which) {
  var id = elId(el);
  var hover = which === "hover";
  var lv = hover ? THEMED_OVERRIDE_MAPS.hoverColor[id] : THEMED_OVERRIDE_MAPS.activeColor[id];
  var dv = hover ? THEMED_OVERRIDE_MAPS.darkHoverColor[id] : THEMED_OVERRIDE_MAPS.darkActiveColor[id];
  /* an unpicked click color follows the hover color, so one decision covers
     both states and a ta only has to think about the press separately when
     they actually want it to differ */
  if (!hover && !lv && !dv) {
    lv = THEMED_OVERRIDE_MAPS.hoverColor[id];
    dv = THEMED_OVERRIDE_MAPS.darkHoverColor[id];
  }
  var prop = hover ? "--el-hover" : "--el-press";
  var attr = hover ? "data-el-hover" : "data-el-press";
  el.style.removeProperty(prop + "-bg");
  el.style.removeProperty(prop + "-fg");
  el.removeAttribute(attr + "-bg");
  el.removeAttribute(attr + "-fg");
  if (!lv && !dv) return;
  /* a picked color paints whatever the element's own Color row paints: a
     surface for a box/card/button, the glyph or the words for an icon or a
     text field. One color per element per state, always aimed at the thing a
     ta was already recoloring, so there's nothing extra to explain. */
  var side = colorTarget(el) === "bg" ? "-bg" : "-fg";
  el.style.setProperty(prop + side, resolveThemedColor(lv, dv));
  el.setAttribute(attr + side, "1");
}

/* every element currently wearing a hover or press state class, so the next
   move of the cursor can take them back off again without re-deriving which
   ones they were (a group's members can be anywhere on the page, and the
   element that was hovered may since have been deleted or re-rendered) */
var STATE_HOVERED = [];
var STATE_PRESSED = [];
var STATE_HOVER_WIRED = false;

/* the element the style popover is currently holding in a hover/press state
   so its colour can be seen while it's being picked, see
   previewElementState() */
var STATE_PREVIEW_EL = null;

/**
 * Holds one element in its hover or press look while that colour is being
 * picked, and drops whatever was held before.
 * @param el the element, or null to just drop the current preview
 * @param which "hover", "press", or null
 * @note Only ever one at a time, and never two states at once, so the element
 * shows exactly what the row being edited controls.
 */
function previewElementState(el, which) {
  if (STATE_PREVIEW_EL) {
    STATE_PREVIEW_EL.classList.remove("el-hovered", "el-pressed");
    STATE_PREVIEW_EL = null;
  }
  if (!el || !which) return;
  el.classList.add(which === "hover" ? "el-hovered" : "el-pressed");
  STATE_PREVIEW_EL = el;
}

/**
 * Every element that shares a hover/press state with the one under the
 * cursor: the tracked element itself, each of its tracked ancestors (what
 * :hover does natively - hovering a card's title hovers the card), and every
 * member of any group those belong to.
 * @param node the event target, or null for "nothing hovered"
 * @return an array of elements
 */
function stateColorTargets(node) {
  var out = [];
  var seen = {};
  var el = node && node.closest ? node.closest(RESIZABLE_SEL) : null;
  var ids = [];
  while (el) {
    var id = elId(el);
    if (id && !seen[id]) { seen[id] = true; ids.push(id); out.push(el); }
    el = el.parentElement ? el.parentElement.closest(RESIZABLE_SEL) : null;
  }
  /* the page is the last ancestor of everything, so the pointer being anywhere
     over the document hovers it - exactly what `body:hover` means natively.
     Walked to explicitly because the page deliberately isn't a RESIZABLE_SEL
     match (see elId()), so the loop above can never land on it. */
  if (node && document.body && isPageEl(document.body)) {
    var pageId = elId(document.body);
    if (pageId && !seen[pageId]) { seen[pageId] = true; ids.push(pageId); out.push(document.body); }
  }
  ids.forEach(function (id) {
    var g = groupOf(id);
    if (!g) return;
    g.forEach(function (mate) {
      if (seen[mate]) return;
      seen[mate] = true;
      document.querySelectorAll('[data-edit-id="' + mate + '"], [data-resize-id="' + mate + '"]')
        .forEach(function (mateEl) { out.push(mateEl); });
    });
  });
  return out;
}

/**
 * Moves one of the two state classes onto a fresh set of elements, taking it
 * off whatever was wearing it before.
 * @param cls "el-hovered" or "el-pressed"
 * @param held the module array tracking who currently wears it
 * @param els the new set (see stateColorTargets())
 * @return the new set, to be stored back
 */
function setStateColorClass(cls, held, els) {
  /* whatever the style popover is holding open for the Hover/Click rows is
     not this pass's to take back off - a ta dragging a swatch has the cursor
     on the popover, so every mousemove there would otherwise strip the very
     preview they are watching, see previewElementState() */
  held.forEach(function (el) { if (el !== STATE_PREVIEW_EL) el.classList.remove(cls); });
  els.forEach(function (el) { el.classList.add(cls); });
  return els;
}

function hasPickedStateColor(el) {
  var id = elId(el);
  if (!id) return false;
  return !!(THEMED_OVERRIDE_MAPS.hoverColor[id] || THEMED_OVERRIDE_MAPS.darkHoverColor[id] ||
    THEMED_OVERRIDE_MAPS.activeColor[id] || THEMED_OVERRIDE_MAPS.darkActiveColor[id]);
}

/**
 * Wires the hover/press states once per page, delegated off the document so
 * elements that come and go are covered with no re-wiring.
 * @note Narrowed inside the visual editor rather than switched off: only an
 * element a ta has actually picked a hover or click colour for lights up
 * there (hasPickedStateColor()). Everything else stays inert, since the
 * cursor is a tool there and not a visitor's, and lighting the whole page up
 * under it would fight the ring and the drag handles - the same reason the
 * page's own stylesheet hover rules are held off in the editor.
 * @note This used to be inert in the editor outright, because the style
 * popover primes its swatches from an element's live computed colour and so
 * read back a hover colour every time it was opened by clicking its element.
 * primeStyleMenuThemedRows() now takes the state classes off for the length
 * of those reads, which closes that off and leaves no reason to hide the one
 * piece of feedback that tells a ta their pick worked.
 */
function wireStateColorHover() {
  if (STATE_HOVER_WIRED) return;
  STATE_HOVER_WIRED = true;
  var editing = isPreviewMode() && isEditMode();
  /* in the editor, only elements a ta has actually picked one of these two
     colours FOR light up. Everything else keeps the editor's "the cursor is
     a tool, not a visitor's" behaviour, which is what the page's own hover
     rules are held off for (see body.edit-mode's overrides in
     css/style.css) - a ta reaching for something to select or drag doesn't
     want the whole page reacting.
     The picked ones do light up, because otherwise the setting has no
     observable effect anywhere in the editor at all: it saved and applied
     correctly on the live page the whole time, but in the tool where it is
     chosen, hovering the element did nothing and the only feedback was the
     style popover pinning the colour on at rest - which reads as "it set the
     background, not the hover colour". That is the "hover colour setting is
     broken" report.
     What made this unsafe before was the popover priming its swatches off a
     hovered element's computed colour; primeStyleMenuThemedRows() now takes
     the state classes off while it reads, so that route is closed. */
  var targetsFor = function (node) {
    var els = stateColorTargets(node);
    return editing ? els.filter(hasPickedStateColor) : els;
  };
  document.addEventListener("mouseover", function (e) {
    STATE_HOVERED = setStateColorClass("el-hovered", STATE_HOVERED, targetsFor(e.target));
  });
  document.addEventListener("mouseleave", function () {
    STATE_HOVERED = setStateColorClass("el-hovered", STATE_HOVERED, []);
    STATE_PRESSED = setStateColorClass("el-pressed", STATE_PRESSED, []);
  });
  document.addEventListener("mousedown", function (e) {
    STATE_PRESSED = setStateColorClass("el-pressed", STATE_PRESSED, targetsFor(e.target));
  });
  /* on the window, not the document: a press that ends outside the page (or
     over the browser's own chrome) still has to let go of the pressed look */
  window.addEventListener("mouseup", function () {
    STATE_PRESSED = setStateColorClass("el-pressed", STATE_PRESSED, []);
  });
}

/**
 * Snaps an image/video's tint and shade overlays onto the element's CURRENT
 * box, so they follow it wherever a ta has since moved, resized, rotated or
 * flipped it.
 * @param el the image/video element
 * @note Both overlays are siblings of el inside its `.free-wrap`, and the
 * wrap is the element's frozen ORIGINAL slot (see detachFromFlow()) - the
 * element itself is absolutely positioned inside it and moved by a transform.
 * Sizing the overlays to the wrap (`inset: 0`, which is all the stylesheet
 * can express) therefore pinned them to where the image USED to be: drag a
 * shaded photo and the grey rectangle stayed behind, and adjusting the shade
 * on an already-transformed clip painted it over the old footprint. That is
 * the "shade does not follow the actual image, rather its original position"
 * report, and the transformed-GIF version of it.
 * @note The transform is copied rather than recomputed, so an overlay
 * rotates and flips with its element rather than staying an axis-aligned box
 * around it. Border radius comes along too, so a rounded photo isn't shaded
 * square at the corners.
 * @note Safe to call on an element with no overlays - the common case - and
 * on one not in a free-wrap at all, where there is nothing to sync.
 */
function syncElementOverlays(el) {
  var wrap = el.parentNode;
  if (!wrap || !wrap.classList || !wrap.classList.contains("free-wrap")) return;
  var ovs = wrap.querySelectorAll(".tint-ov, .shade-ov");
  if (!ovs.length) return;
  var cs = getComputedStyle(el);
  ovs.forEach(function (ov) {
    ov.style.left = el.style.left || "0px";
    ov.style.top = el.style.top || "0px";
    ov.style.width = el.style.width || (el.offsetWidth + "px");
    ov.style.height = el.style.height || (el.offsetHeight + "px");
    ov.style.transform = el.style.transform || "";
    ov.style.transformOrigin = cs.transformOrigin;
    ov.style.borderRadius = cs.borderRadius;
  });
}

/**
 * Paints (or removes) a colour tint over an image or video.
 * @param el the image/video element
 * @param hex a "#rrggbb" tint color, or "" to remove the tint
 * @note An object-fit: cover element has no visible background of its own to
 * paint over, so a tint needs a real overlay: a same-size, pointer-events:none
 * ".tint-ov" div in mix-blend-mode "color" on top of it. Forces el into its
 * own free-wrap first, so the overlay has something to size itself against.
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
  syncElementOverlays(el);
}

/**
 * Applies saved image/video tint overrides on top of the default (none). Runs
 * on every load, live site included.
 * @param tint content.tint, {id: css color string}
 * @note Only touches elKind() === "img" elements; the row is hidden for others.
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
 * Darkens (or un-darkens) an image or video with a flat black overlay - the
 * same idea as the hero's own scrim, but per-element and undoable.
 * @param el the image/video element
 * @param alpha 0 (no shade) to 1 (fully black); 0 removes the overlay
 * @note A plain opacity change would dim the whole element uniformly, which
 * reads as "faded" rather than "darkened photo". This stacks a same-size
 * black sibling in the element's free-wrap, so its pixels stay fully opaque.
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
  syncElementOverlays(el);
}

/**
 * Applies saved image/video shade overrides on top of the default (none).
 * Runs on every load, live site included.
 * @param shade content.shade, {id: number 0-1}
 * @note Only touches elKind() === "img" elements; the row is hidden for others.
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

/* the width an empty progress bar is previewed at, and the two elements (if
   any) entitled to that preview: the selected one and the hovered one.

   A bar whose bound variables come to zero paints no fill, so its fill colour
   - often the exact thing a ta selected it to change - is invisible precisely
   when they're looking at it. So while it's hovered or ringed in the editor,
   an empty bar is drawn part-filled. Strictly momentary: it's empty again the
   instant the pointer leaves, which keeps the preview readable as a preview
   rather than as the bar's real value. Editor-only and never persisted - the
   real percentage stays on the fill bar's dataset throughout. */
var PROGRESS_PREVIEW_PCT = 60;
var PROGRESS_PREVIEW_EL = null;
var PROGRESS_HOVER_EL = null;
/* wireProgressBarHoverPreview() is called from wireResizable(), which the
   object canvas and each editor surface each run once - this keeps a second
   call from stacking a duplicate pair of document listeners */
var PROGRESS_HOVER_WIRED = false;

/**
 * The width one progress bar's fill should be painted at: its real
 * percentage, or the preview width while it's empty and hovered or selected.
 * @param fillEl the bar's inner .progress-el-fill
 * @return the width to paint, as a percentage number
 * @note Everything that writes a fill width goes through this, so a repaint
 * landing mid-preview can't drop the bar to an invisible 0%, and equally
 * can't leave a preview width on a bar that no longer qualifies.
 */
function progressFillWidthFor(fillEl) {
  var pct = +(fillEl.dataset.pct || 0);
  /* only a genuinely empty bar is previewed: the moment its variables read
     anything at all, what a ta is looking at has to be the real figure */
  if (pct > 0) return pct;
  if ((PROGRESS_PREVIEW_EL && PROGRESS_PREVIEW_EL.contains(fillEl)) ||
      (PROGRESS_HOVER_EL && PROGRESS_HOVER_EL.contains(fillEl))) return PROGRESS_PREVIEW_PCT;
  return pct;
}

/**
 * Repaints each given progress bar's fill at whatever width it's entitled to
 * right now - the shared tail of both preview switches, since every change
 * has to repaint the bar losing the preview as well as the one gaining it.
 * @param bars an array of progress elements, nulls tolerated
 */
function repaintProgressFills(bars) {
  bars.forEach(function (bar) {
    var fillEl = bar && bar.querySelector(".progress-el-fill");
    if (fillEl) fillEl.style.width = progressFillWidthFor(fillEl) + "%";
  });
}

/**
 * Moves the empty-bar preview onto whatever the ring is on now (nothing, if
 * that isn't a progress element). Called from positionRing(), so every path
 * that changes the selection keeps this right for free.
 */
function syncProgressPreview() {
  var el = RING_EL && RING_EL.hasAttribute && RING_EL.hasAttribute("data-progress") ? RING_EL : null;
  if (el === PROGRESS_PREVIEW_EL) return;
  var prev = PROGRESS_PREVIEW_EL;
  PROGRESS_PREVIEW_EL = el;
  repaintProgressFills([prev, el]);
}

/**
 * The pointer's half of the same preview: moves it onto the bar under the
 * cursor, or off everything when there isn't one.
 * @param el the progress element under the pointer, or null
 */
function syncProgressHoverPreview(el) {
  if (el === PROGRESS_HOVER_EL) return;
  var prev = PROGRESS_HOVER_EL;
  PROGRESS_HOVER_EL = el;
  repaintProgressFills([prev, el]);
}

/**
 * Wires the pointer half of the empty-bar preview, delegated off the document
 * so bars placed or rebuilt mid-session need no re-wiring.
 * @note Called from wireResizable(), the visual editor's own setup and
 * nothing else's: on the live site a student's empty bar has to read as
 * empty, and filling 60% of it under their cursor would report progress
 * nobody made.
 */
function wireProgressBarHoverPreview() {
  if (PROGRESS_HOVER_WIRED) return;
  PROGRESS_HOVER_WIRED = true;
  document.addEventListener("mouseover", function (e) {
    var t = e.target;
    syncProgressHoverPreview(t && t.closest ? t.closest("[data-progress]") : null);
  });
  /* the pointer leaving the document fires no mouseover at all, so nothing
     above would ever take the last preview back off (same gap
     wireTooltipHover() covers this same way) */
  document.addEventListener("mouseleave", function () { syncProgressHoverPreview(null); });
}

/**
 * Paints one "progress" element's live fill width and its two theme-paired
 * colours.
 * @param el the element (data-progress)
 * @param d its custom-element descriptor ({varCurrent, varTotal, ...})
 * @note Split out from applyProgressBindings() so one element can be
 * repainted right away - just after it's placed, after its bindings change,
 * or after a colour edit - without re-scanning every bar on the page.
 */
function paintProgressElement(el, d) {
  var id = elId(el);
  var cur = variableNumericValue(d.varCurrent);
  var tot = variableNumericValue(d.varTotal);
  var pct = tot > 0 ? Math.max(0, Math.min(100, (cur / tot) * 100)) : 0;
  var fillEl = el.querySelector(".progress-el-fill");
  if (fillEl) {
    /* stashed on the fill bar itself, not just computed on demand, so both
       preview paths can restore the real width after temporarily forcing a
       visible one without re-running this whole calc - and so this pass can
       tell whether the bar it's repainting is one of them */
    fillEl.dataset.pct = pct;
    fillEl.style.width = progressFillWidthFor(fillEl) + "%";
  }
  var trackColor = resolveThemedColor(THEMED_OVERRIDE_MAPS.progressTrack[id], THEMED_OVERRIDE_MAPS.darkProgressTrack[id]);
  if (trackColor) el.style.background = trackColor;
  var fillColor = resolveThemedColor(THEMED_OVERRIDE_MAPS.progressFill[id], THEMED_OVERRIDE_MAPS.darkProgressFill[id]);
  if (fillColor && fillEl) fillEl.style.background = fillColor;
}

/**
 * Applies every placed "progress" element's live state on top of whatever
 * buildCustomElementNode() built it with. Runs on every load, live site
 * included, right after the DOM is rebuilt and VARIABLES refreshed from the
 * same payload - the "build with defaults, then apply overrides" two-pass
 * shape everything else here follows.
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
 * Re-resolves every colour/fill/text-colour/border/progress override already
 * on the page against whichever theme just became active, from the maps the
 * last apply pass cached - a plain re-run of those five rather than a page
 * reload, so a mid-session theme toggle repaints every ta-set colour at once.
 * @note Exposed on window so theme.js's setTheme() can call it without a
 * circular dependency: main.js loads first on every page, but not vice versa.
 */
function reapplyThemedColors() {
  applyColorOverrides(THEMED_OVERRIDE_MAPS.colors, THEMED_OVERRIDE_MAPS.darkColors);
  applyFillOverrides(THEMED_OVERRIDE_MAPS.fill, THEMED_OVERRIDE_MAPS.darkFill);
  applyTextColorOverrides(THEMED_OVERRIDE_MAPS.textColor, THEMED_OVERRIDE_MAPS.darkTextColor);
  applyBorderOverrides(THEMED_OVERRIDE_MAPS.border, THEMED_OVERRIDE_MAPS.darkBorder);
  applyProgressBindings(THEMED_OVERRIDE_MAPS.progressFill, THEMED_OVERRIDE_MAPS.darkProgressFill,
    THEMED_OVERRIDE_MAPS.progressTrack, THEMED_OVERRIDE_MAPS.darkProgressTrack);
  applyStateColorOverrides(THEMED_OVERRIDE_MAPS.hoverColor, THEMED_OVERRIDE_MAPS.darkHoverColor,
    THEMED_OVERRIDE_MAPS.activeColor, THEMED_OVERRIDE_MAPS.darkActiveColor);
  repaintInlineTextColors();
  /* a tooltip's own two colors resolve the same way (see paintTooltipBubble()),
     and one can be on show while the theme flips - the ta styling it from the
     sub-editor with the site's theme toggle a click away is exactly that case */
  refreshTooltipBubble();
}
window.reapplyThemedColors = reapplyThemedColors;

/**
 * Repaints every inline foreColor span against whichever theme is active.
 * @note Unlike the whole-element overrides, these spans carry their own
 * light/dark values on themselves rather than in a THEMED_OVERRIDE_MAPS
 * entry: one text field's innerHTML can hold any number of independently
 * coloured spans, so the id-keyed map shape doesn't fit. Those attributes
 * ride along in the same innerHTML the save/restore path already handles, so
 * they need no content column of their own.
 * @note Called once after every load and again on every theme flip.
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

/* the three per-video playback switches on a placed video's right-click menu.
   Each is a flat list of ids, the shape content.shadow already uses for a
   per-id flag - a placed video ships muted, looping and autoplaying with no
   controls, so each list only names the videos that deviate:
   - "video_no_autoplay": doesn't start on its own
   - "video_controls": shows the browser's native player chrome
   - "video_pausable": a click anywhere on the clip play/pauses it */
var VIDEO_PLAYBACK_KEYS = ["video_no_autoplay", "video_controls", "video_pausable"];

/**
 * Switches one of a video's playback options on or off, live.
 * @param el the <video> element (anything else is ignored)
 * @param key one of VIDEO_PLAYBACK_KEYS
 * @param on true to switch it on
 */
function setVideoPlaybackOption(el, key, on) {
  if (!el || el.tagName !== "VIDEO") return;
  /* every one of these is written as a real html attribute rather than as a
     js-side property or a bookkeeping map, so js/learn-reel.js's cloned reel
     tiles - cloneNode() copies attributes, never properties or listeners -
     play exactly like the tile they were copied from */
  if (key === "video_controls") { el.controls = !!on; return; }
  if (key === "video_pausable") {
    if (on) el.setAttribute("data-video-pausable", "1");
    else el.removeAttribute("data-video-pausable");
    return;
  }
  /* "video_no_autoplay". The attribute alone only decides what a FUTURE load
     does, so a clip that's already rolling has to actually be stopped (and
     one switched back to autoplay actually started) for the toggle to read as
     immediate in the editor. */
  el.autoplay = !on;
  if (on) el.pause();
  else el.play().catch(function () {});
}

/**
 * Whether one of a video's playback options is on, read straight off the
 * element rather than a parallel map.
 * @param el the <video> element
 * @param key one of VIDEO_PLAYBACK_KEYS
 * @return true if it's switched on
 * @note "The dom is the state", and the only approach that works for a cloned
 * reel tile, which carries these attributes but none of the ids they were
 * saved under.
 */
function videoPlaybackOn(el, key) {
  if (!el) return false;
  if (key === "video_controls") return !!el.controls;
  if (key === "video_pausable") return el.hasAttribute("data-video-pausable");
  return !el.autoplay;
}

/* set once wireVideoPauseClicks() has installed its delegated listener */
var VIDEO_PAUSE_WIRED = false;

/**
 * Wires the single delegated listener behind the "Click to play/pause"
 * switch. Delegated rather than per-element so a video placed mid-session -
 * and every copy learn-reel.js clones out of a tile after the override passes
 * have run - behaves like the original with no re-wiring.
 */
function wireVideoPauseClicks() {
  if (VIDEO_PAUSE_WIRED) return;
  VIDEO_PAUSE_WIRED = true;
  document.addEventListener("click", function (e) {
    /* inside the editor a click on a video is how it gets selected/styled */
    if (isEditMode()) return;
    var vid = e.target.closest && e.target.closest("[data-video-pausable]");
    if (!vid || vid.tagName !== "VIDEO") return;
    /* with the native controls on show, the browser already play/pauses on a
       click on the video (and on its own play button) - handling it here too
       would just undo whatever that click did */
    if (vid.controls) return;
    if (vid.paused) vid.play().catch(function () {});
    else vid.pause();
  });
}

/* set once wireNativeVideoMenu() has installed its delegated listener */
var VIDEO_NATIVE_MENU_WIRED = false;

/**
 * Takes the browser's own affordances off one clip: firefox's floating
 * picture-in-picture toggle, and the download/speed entries chromium tucks
 * into its overflow menu when "Show controls" is on.
 * @param el the <video> element (anything else is ignored)
 * @note None of it is the browser's to offer here. Every video on this site
 * was placed and anchored to sit exactly where it sits: popping one into a
 * floating window leaves a hole in the page, and the rest hands a visitor
 * switches the ta already decided for them through the video's own menu.
 * @note Written as attributes, not properties, for the same reason
 * setVideoPlaybackOption() is: cloneNode() copies attributes and nothing
 * else, so cloned reel tiles inherit this without being swept again.
 */
function hardenVideo(el) {
  if (!el || el.tagName !== "VIDEO") return;
  el.setAttribute("disablepictureinpicture", "");
  el.setAttribute("controlslist", "nodownload noplaybackrate noremoteplayback");
}

/**
 * Hardens every clip on the page and closes the other way into the same
 * offers: the native video context menu, which firefox would still show with
 * the corner toggle already hidden.
 * @note The sweep runs on every call, since a clip can be built long after
 * the first; the listener is delegated and installed once.
 * @note preventDefault() only, never stopPropagation(): inside the editor the
 * "Add element" menu's own contextmenu listener has to keep seeing these.
 */
function wireNativeVideoMenu() {
  document.querySelectorAll("video").forEach(hardenVideo);
  if (VIDEO_NATIVE_MENU_WIRED) return;
  VIDEO_NATIVE_MENU_WIRED = true;
  document.addEventListener("contextmenu", function (e) {
    if (e.target && e.target.tagName === "VIDEO") e.preventDefault();
  });
}

/**
 * Applies the saved per-video playback switches on top of a placed video's
 * default (autoplays, no controls, not click-pausable). Runs on every load,
 * live site included, and deliberately ahead of initAllReels() so a reel's
 * clones are copied from videos already in their final state.
 * @param noAutoplay content.video_no_autoplay, a flat array of ids
 * @param controls content.video_controls, a flat array of ids
 * @param pausable content.video_pausable, a flat array of ids
 */
function applyVideoPlaybackOverrides(noAutoplay, controls, pausable) {
  wireVideoPauseClicks();
  /* here too rather than on load alone: this pass is the one that runs after
     the content build has put every placed video on the page, and it's
     deliberately ahead of initAllReels() - so a reel's clones are copied from
     an original that's already hardened */
  wireNativeVideoMenu();
  var lists = { video_no_autoplay: noAutoplay, video_controls: controls, video_pausable: pausable };
  VIDEO_PLAYBACK_KEYS.forEach(function (key) {
    (lists[key] || []).forEach(function (id) {
      setVideoPlaybackOption(elByAnyId(id), key, true);
    });
  });
}

/**
 * Flips one of a video's playback switches from the right-click menu: live,
 * saved and undoable.
 * @param id the video's data-resize-id
 * @param key one of VIDEO_PLAYBACK_KEYS
 * @note The undo entry carries no before/after, since the toggle is its own
 * inverse - same as "shadow"/"flip_h".
 */
function toggleVideoPlayback(id, key) {
  var el = elByAnyId(id);
  if (!el) return;
  var on = !videoPlaybackOn(el, key);
  setVideoPlaybackOption(el, key, on);
  saveEditedVideoPlayback(id, key, on);
  EDIT_UNDO.push({ type: "videoplayback", id: id, key: key });
  EDIT_REDO.length = 0;
}

/**
 * Applies saved Flip/Rotate overrides on top of the page's default (no
 * transform). Runs on every load, live site included.
 * @param flipH content.flip_h, a flat array of ids
 * @param flipV content.flip_v, a flat array of ids
 * @param rotate content.rotate, {id: degrees number}
 * @note Written onto el's dataset rather than el.style.transform, since
 * paintPos() is the only place allowed to write that.
 */
function applyFlipRotateOverrides(flipH, flipV, rotate) {
  flipH = flipH || [];
  flipV = flipV || [];
  rotate = rotate || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    var h = flipH.indexOf(id) !== -1;
    var v = flipV.indexOf(id) !== -1;
    var deg = rotate[id] || 0;
    if (!h && !v && !deg) return;
    if (h) el.dataset.flipH = "1"; else delete el.dataset.flipH;
    if (v) el.dataset.flipV = "1"; else delete el.dataset.flipV;
    if (deg) el.dataset.rotate = deg; else delete el.dataset.rotate;
    paintPos(el);
  });
}

/* ---------------------------------------------------------------------------
   ELEMENT TOOLTIPS

   Any tagged element can carry a hover tooltip: right-click, "Add tooltip",
   and a small sub-editor for the words and the bubble's own look. Saved in
   content.tooltips keyed like every other override, and painted on the live
   site too - a tooltip is something a visitor reads, not editor chrome.

   ONE DESCRIPTOR PER ELEMENT, rather than the dozen parallel id-keyed maps
   the older style controls use. Those grew one knob at a time; a tooltip
   arrives as one whole thing with one panel behind it, so it stores as one.

   ONE BUBBLE, parked on the body and moved to whatever is hovered, rather
   than a ::after on each element. A pseudo-element inherits its host's
   clipping and stacking, so a tooltip on anything inside a scrolling or
   overflow:hidden container would come out cut in half - and many tagged
   elements here sit inside one. It also keeps the bubble out of every
   innerHTML the editor saves, which would otherwise write it into
   content.text.

   This replaces content.apply_tooltip, one hardcoded string shared by the
   three Apply Now buttons, which existed only because a tooltip had no
   element to click on. It does now, so those three are ordinary tooltips
   seeded with the same words.
   --------------------------------------------------------------------------- */

/* content.tooltips, {id: descriptor}. See TOOLTIP_DEFAULTS for the shape. */
var TOOLTIPS = {};

/* the one bubble (built on first use) and which element it's currently up for */
var TT_BUBBLE = null;
var TT_BUBBLE_EL = null;
/* the element whose tooltip the sub-editor is holding open: shown regardless of
   where the pointer is, so a ta can see the thing they're restyling while they
   restyle it - the same reason an empty progress bar previews a fill while it's
   the selected element, see progressFillWidthFor() */
var TT_PINNED_EL = null;
var TT_HOVER_WIRED = false;

/* what a tooltip looks like before a ta changes anything, which is deliberately
   the bubble the Apply Now buttons used to get from their own hardcoded css
   rule - the migrated ones come out looking exactly as they did. The colors
   start empty rather than at a literal hex: "" means "whatever the site's own
   surface/text color is in the theme that's on", which is what lets an
   untouched tooltip follow a theme flip on its own. */
var TOOLTIP_DEFAULTS = {
  text: "",
  pos: "top",
  bg: "", darkBg: "",
  color: "", darkColor: "",
  borderW: 0, borderColor: "", darkBorderColor: "",
  radius: 8, fontSize: 13, width: 220
};

/**
 * One element's tooltip descriptor with every field filled in, for the
 * sub-editor to prime its controls from.
 * @param id a data-edit-id/data-resize-id
 * @return a fresh object, never the stored one, so a caller can't edit the
 *   map out from under everything else by accident
 * @note Saved descriptors are written whole, but one seeded server-side or
 * left by an older shape of this feature needn't be.
 */
function tooltipDescriptor(id) {
  return Object.assign({}, TOOLTIP_DEFAULTS, TOOLTIPS[id] || {});
}

/**
 * The tooltip worth actually showing for an id: one with words in it.
 * @param id a data-edit-id/data-resize-id
 * @return the descriptor, or null
 * @note A descriptor with empty text is a draft the sub-editor is holding;
 * closeTooltipEditor() throws those away rather than saving an invisible
 * tooltip nobody can find again.
 */
function tooltipFor(id) {
  var d = id && TOOLTIPS[id];
  return d && d.text ? d : null;
}

/**
 * The element a hover should show a tooltip for: the innermost tracked
 * ancestor of node that has one.
 * @param node the event target
 * @return the element, or null if nothing in the chain has a tooltip
 * @note Walking up rather than looking only at what the pointer is over is
 * what makes a tooltip on a card fire for the text inside it too - those
 * inner pieces are separately tracked, so a plain lookup would find nothing
 * and the tooltip would appear only in the gaps between them.
 */
function tooltipTargetFor(node) {
  var el = node && node.closest ? node.closest(RESIZABLE_SEL) : null;
  while (el) {
    if (tooltipFor(elId(el))) return el;
    el = el.parentElement ? el.parentElement.closest(RESIZABLE_SEL) : null;
  }
  return null;
}

/** Builds the one shared bubble, lazily. */
function buildTooltipBubble() {
  TT_BUBBLE = document.createElement("div");
  TT_BUBBLE.className = "tt-bubble";
  document.body.appendChild(TT_BUBBLE);
}

/**
 * Paints the bubble from one descriptor.
 * @param d a tooltip descriptor
 * @note Every property is written on every paint, "" where the descriptor has
 * nothing to say: this is ONE shared node, so anything left inline from the
 * last element would leak onto the next. An empty string hands the property
 * back to the stylesheet, which is where the defaults live.
 */
function paintTooltipBubble(d) {
  var s = TT_BUBBLE.style;
  /* textContent, not innerHTML: this is plain words a ta typed into a
     textarea, and it renders on the live site */
  TT_BUBBLE.textContent = d.text || "";
  s.background = resolveThemedColor(d.bg, d.darkBg);
  s.color = resolveThemedColor(d.color, d.darkColor);
  var bw = +d.borderW || 0;
  s.border = bw
    ? bw + "px solid " + (resolveThemedColor(d.borderColor, d.darkBorderColor) || "var(--border)")
    : "";
  s.borderRadius = (d.radius === undefined ? TOOLTIP_DEFAULTS.radius : +d.radius || 0) + "px";
  s.fontSize = (+d.fontSize || TOOLTIP_DEFAULTS.fontSize) + "px";
  s.maxWidth = (+d.width || TOOLTIP_DEFAULTS.width) + "px";
}

/**
 * Puts the bubble on whichever side of an element its descriptor asks for.
 * @param el the element the tooltip belongs to
 * @param pos "top", "bottom", "left" or "right"
 * @note Clamped to the VIEWPORT rather than the document: a bubble hanging
 * off the right edge would widen the page and hand every page on the site a
 * horizontal scrollbar.
 */
function positionTooltipBubble(el, pos) {
  var r = el.getBoundingClientRect();
  var w = TT_BUBBLE.offsetWidth, h = TT_BUBBLE.offsetHeight;
  var gap = 10;
  var x = r.left + r.width / 2 - w / 2;
  var y = r.top - h - gap;
  if (pos === "bottom") {
    y = r.bottom + gap;
  } else if (pos === "left") {
    x = r.left - w - gap;
    y = r.top + r.height / 2 - h / 2;
  } else if (pos === "right") {
    x = r.right + gap;
    y = r.top + r.height / 2 - h / 2;
  }
  var maxX = document.documentElement.clientWidth - w - 6;
  var maxY = document.documentElement.clientHeight - h - 6;
  TT_BUBBLE.style.left = (Math.max(6, Math.min(x, maxX)) + window.scrollX) + "px";
  TT_BUBBLE.style.top = (Math.max(6, Math.min(y, maxY)) + window.scrollY) + "px";
}

/**
 * Shows the bubble for one element, or puts it away if that element hasn't
 * got a tooltip any more (the sub-editor's Remove button, an undo).
 * @param el the element
 */
function showTooltipFor(el) {
  var d = tooltipFor(elId(el));
  if (!d) { hideTooltipBubble(); return; }
  if (!TT_BUBBLE) buildTooltipBubble();
  TT_BUBBLE_EL = el;
  paintTooltipBubble(d);
  /* shown before it's positioned: the size it gets placed against is only real
     once it's actually in the layout */
  TT_BUBBLE.classList.add("show");
  positionTooltipBubble(el, d.pos);
}

/** Puts the bubble away. */
function hideTooltipBubble() {
  TT_BUBBLE_EL = null;
  if (TT_BUBBLE) TT_BUBBLE.classList.remove("show");
}

/** Repaints whatever bubble is on show - a theme flip, or a live edit in the sub-editor. */
function refreshTooltipBubble() {
  if (TT_BUBBLE_EL) showTooltipFor(TT_BUBBLE_EL);
}

/**
 * Wires the hover/focus behaviour once per page, delegated off the document
 * rather than bound per element - which is why nothing has to re-run when the
 * dashboard's tiles or a placed element are rebuilt: a listener on one of
 * those would go with it, and the lookup starts from the event target anyway.
 */
function wireTooltipHover() {
  if (TT_HOVER_WIRED) return;
  TT_HOVER_WIRED = true;
  document.addEventListener("mouseover", function (e) {
    /* the sub-editor is holding one open on purpose; nothing the pointer does
       gets to take that over until the panel closes */
    if (TT_PINNED_EL) return;
    /* mid-drag in the editor, a bubble popping up under the pointer is just
       noise on top of the thing being moved */
    if (RING_DRAGGING) { hideTooltipBubble(); return; }
    var el = tooltipTargetFor(e.target);
    if (!el) { hideTooltipBubble(); return; }
    if (el !== TT_BUBBLE_EL) showTooltipFor(el);
  });
  /* the pointer leaving the document fires no mouseover at all, so nothing
     above would ever put the last bubble away */
  document.addEventListener("mouseleave", function () {
    if (!TT_PINNED_EL) hideTooltipBubble();
  });
  /* the bubble is placed against where its element was when it opened, and the
     sticky nav (or any scrolling container) slides out from under that */
  window.addEventListener("scroll", function () {
    if (!TT_PINNED_EL) hideTooltipBubble();
  }, true);
  /* keyboard reach, the same :focus-visible the Apply Now tooltip answered to
     before this replaced it. Not in the editor: focus there lands on whatever
     text field a ta just clicked into, and a bubble over the words being typed
     is the one place this is actively unhelpful. */
  document.addEventListener("focusin", function (e) {
    if (TT_PINNED_EL || (isPreviewMode() && isEditMode())) return;
    var el = tooltipTargetFor(e.target);
    if (el) showTooltipFor(el);
  });
  document.addEventListener("focusout", function () {
    if (!TT_PINNED_EL) hideTooltipBubble();
  });
}

/**
 * Applies saved tooltips. Runs on every load, live site included.
 * @param map content.tooltips, {id: descriptor}
 * @note Nothing is written onto the elements themselves - tooltipTargetFor()
 * answers from this map at hover time - so this is the map plus its wiring.
 */
function applyTooltipOverrides(map) {
  TOOLTIPS = map || {};
  wireTooltipHover();
  if (TT_BUBBLE_EL && !tooltipFor(elId(TT_BUBBLE_EL))) hideTooltipBubble();
  else refreshTooltipBubble();
}

/**
 * Writes one element's tooltip into the map and the preview snapshot, and
 * repaints whatever is on show.
 * @param id the element's data-edit-id/data-resize-id
 * @param d a full descriptor, or null/one without text to remove it
 * @note A descriptor with no text is deleted rather than stored, so "no
 * tooltip" is the absence of an entry everywhere - live site, saved content
 * and the "Add/Edit tooltip" label all read it the same way.
 */
function setTooltipDescriptor(id, d) {
  if (d && d.text) TOOLTIPS[id] = d;
  else delete TOOLTIPS[id];
  saveEditedMapValue("tooltips", id, TOOLTIPS[id] || "");
  if (TT_PINNED_EL) refreshPinnedTooltip();
  else if (TT_BUBBLE_EL && elId(TT_BUBBLE_EL) === id) showTooltipFor(TT_BUBBLE_EL);
}

/**
 * Changes one field of an element's tooltip from the sub-editor, filling the
 * rest in from the defaults if this is the first thing set on a new one.
 * @param id the element's data-edit-id/data-resize-id
 * @param key a TOOLTIP_DEFAULTS field name
 * @param value its new value
 * @note Saved on every keystroke like the rest of the editor's controls; the
 * single undo entry covering the whole session is pushed on close.
 */
function setTooltipProp(id, key, value) {
  var d = Object.assign({}, TOOLTIP_DEFAULTS, TOOLTIPS[id] || {});
  d[key] = value;
  TOOLTIPS[id] = d;
  /* a draft with nothing typed in it yet is kept in memory (so the colors a ta
     dials in first survive until they type) but never written out - see
     closeTooltipEditor() for the other half of that */
  saveEditedMapValue("tooltips", id, d.text ? d : "");
  refreshPinnedTooltip();
}

/* the element the tooltip sub-editor is currently open on, and the descriptor
   that was there when it opened: one undo entry covers the whole session at the
   panel (the way one drag is one entry) rather than one per keystroke */
var TT_EDIT_EL = null;
var TT_EDIT_BEFORE = "";

/** Holds the bubble open on el for as long as the sub-editor is up. */
function pinTooltipPreview(el) {
  TT_PINNED_EL = el;
  refreshPinnedTooltip();
}

/** Repaints the held-open preview after an edit (or hides it while there are no words yet). */
function refreshPinnedTooltip() {
  if (!TT_PINNED_EL) return;
  if (tooltipFor(elId(TT_PINNED_EL))) showTooltipFor(TT_PINNED_EL);
  else hideTooltipBubble();
}

/**
 * Ends a session at the tooltip sub-editor: drops a draft that never got any
 * words, records the one undo entry for everything that did change, and lets
 * the bubble follow the pointer again. Called from hideCtxMenu(), so every
 * way the menu can close comes through here.
 */
function closeTooltipEditor() {
  if (!TT_EDIT_EL) return;
  var id = elId(TT_EDIT_EL);
  /* colors dialed in on a bubble with no words are as good as no tooltip at
     all, and an entry with no text would sit in the saved content forever
     showing nothing */
  if (TOOLTIPS[id] && !TOOLTIPS[id].text) {
    delete TOOLTIPS[id];
    saveEditedMapValue("tooltips", id, "");
  }
  var after = TOOLTIPS[id] ? JSON.stringify(TOOLTIPS[id]) : "";
  if (after !== TT_EDIT_BEFORE) {
    EDIT_UNDO.push({ type: "tooltip", id: id, before: TT_EDIT_BEFORE, after: after });
    EDIT_REDO.length = 0;
  }
  TT_EDIT_EL = null;
  TT_EDIT_BEFORE = "";
  TT_PINNED_EL = null;
  hideTooltipBubble();
}

/**
 * Swaps the right-click menu into the tooltip sub-editor for whatever
 * CTX_TARGET_ID points at.
 * @note It lives in the menu rather than the style popover for the same
 * reason the link editor does - a tooltip is something an element either has
 * or hasn't, not one more knob on something always there - and it holds the
 * bubble open throughout, so every change lands on the real element.
 */
function renderCtxMenuTooltip() {
  var id = CTX_TARGET_ID;
  var el = CTX_TARGET_EL;
  if (!id || !el) { hideCtxMenu(); return; }
  var d = tooltipDescriptor(id);
  TT_EDIT_EL = el;
  TT_EDIT_BEFORE = TOOLTIPS[id] ? JSON.stringify(TOOLTIPS[id]) : "";
  /* painted before the swatches below are primed off it, whether or not it's
     on show yet: an unset color has no value of its own to put in a picker
     (see currentColorValue()), so what the bubble actually renders as is the
     honest answer for both of them */
  if (!TT_BUBBLE) buildTooltipBubble();
  paintTooltipBubble(d);
  var liveBg = rgbToHex(getComputedStyle(TT_BUBBLE).backgroundColor) || "#222222";
  var liveFg = rgbToHex(getComputedStyle(TT_BUBBLE).color) || "#ffffff";
  var liveBorder = rgbToHex(getComputedStyle(TT_BUBBLE).borderTopColor) || liveFg;

  CTX_MENU.innerHTML =
    '<div class="ctx-title">Tooltip</div>' +
    '<div class="ctx-tt-panel">' +
      '<textarea class="ctx-tt-text" rows="2" placeholder="Shown while a visitor hovers this"></textarea>' +
      '<div class="sm-row">' +
        '<label>Where</label>' +
        '<select class="ctx-tt-pos">' +
          '<option value="top">Above</option>' +
          '<option value="bottom">Below</option>' +
          '<option value="left">Left</option>' +
          '<option value="right">Right</option>' +
        '</select>' +
      '</div>' +
      tooltipColorRowHtml("bg", "Background", "background") +
      tooltipColorRowHtml("color", "Text", "text color") +
      '<div class="sm-row">' +
        '<label>Border</label>' +
        '<input type="range" class="ctx-tt-range ctx-tt-borderW" min="0" max="6" step="1">' +
        '<span class="ctx-tt-val ctx-tt-borderW-val">0px</span>' +
        '<input type="color" class="ctx-tt-sw ctx-tt-borderColor">' +
      '</div>' +
      '<div class="sm-row sm-dark-toggle-row ctx-tt-borderColor-toggle-row">' +
        '<button type="button" class="sm-dark-toggle ctx-tt-borderColor-dark-toggle"></button>' +
      '</div>' +
      '<div class="sm-row sm-dark-row ctx-tt-borderColor-dark-row">' +
        '<label>Dark mode border</label>' +
        '<input type="color" class="ctx-tt-sw ctx-tt-borderColor-dark">' +
        '<button type="button" class="ctx-tt-reset ctx-tt-borderColor-dark-reset" title="Reset to auto">×</button>' +
      '</div>' +
      '<div class="sm-row">' +
        '<label>Corners</label>' +
        '<input type="range" class="ctx-tt-range ctx-tt-radius" min="0" max="24" step="1">' +
        '<span class="ctx-tt-val ctx-tt-radius-val">8px</span>' +
      '</div>' +
      '<div class="sm-row">' +
        '<label>Text size</label>' +
        '<input type="range" class="ctx-tt-range ctx-tt-fontSize" min="10" max="22" step="1">' +
        '<span class="ctx-tt-val ctx-tt-fontSize-val">13px</span>' +
      '</div>' +
      '<div class="sm-row">' +
        '<label>Max width</label>' +
        '<input type="range" class="ctx-tt-range ctx-tt-width" min="120" max="420" step="10">' +
        '<span class="ctx-tt-val ctx-tt-width-val">220px</span>' +
      '</div>' +
    '</div>' +
    (tooltipFor(id) ? '<button type="button" class="ctx-tt-remove">Remove tooltip</button>' : "") +
    '<button type="button" class="ctx-tt-done">Done</button>';

  var textArea = CTX_MENU.querySelector(".ctx-tt-text");
  textArea.value = d.text;
  textArea.addEventListener("input", function () {
    setTooltipProp(id, "text", textArea.value);
  });
  var posSel = CTX_MENU.querySelector(".ctx-tt-pos");
  posSel.value = d.pos;
  posSel.addEventListener("change", function () { setTooltipProp(id, "pos", posSel.value); });

  wireTooltipColorRow(id, d, "bg", "darkBg", liveBg, "background");
  wireTooltipColorRow(id, d, "color", "darkColor", liveFg, "text color");
  wireTooltipColorRow(id, d, "borderColor", "darkBorderColor", liveBorder, "border");

  /* the four sliders, all in px and all named for the descriptor field they
     write, so one loop covers them and adding a fifth is a row of markup */
  ["borderW", "radius", "fontSize", "width"].forEach(function (key) {
    var range = CTX_MENU.querySelector(".ctx-tt-" + key);
    var out = CTX_MENU.querySelector(".ctx-tt-" + key + "-val");
    range.value = d[key];
    out.textContent = d[key] + "px";
    range.addEventListener("input", function () {
      out.textContent = range.value + "px";
      setTooltipProp(id, key, +range.value);
    });
  });

  var removeBtn = CTX_MENU.querySelector(".ctx-tt-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", function () {
      setTooltipDescriptor(id, null);
      hideCtxMenu();
    });
  }
  CTX_MENU.querySelector(".ctx-tt-done").addEventListener("click", function () { hideCtxMenu(); });

  /* the menu is a different size than the root list it just replaced, and the
     bubble it holds open has to be placed against the element rather than
     against wherever it was last shown */
  clampCtxMenu();
  pinTooltipPreview(el);
  textArea.focus();
}

/**
 * One color row of the sub-editor: the swatch itself, its 🌙/☀️ button, and
 * the other theme's row collapsed underneath. Written as a helper because all
 * three of them (background, text, border) are the same row - the border one
 * just supplies its own swatch, since it shares a line with the border width.
 * @param key the descriptor's light-mode field name, also the class stem
 * @param label the row's own label
 * @param what the noun the dark row and its toggle title use
 * @return the row's html
 */
function tooltipColorRowHtml(key, label, what) {
  return '<div class="sm-row ctx-tt-' + key + '-row">' +
      '<label>' + label + '</label>' +
      '<input type="color" class="ctx-tt-sw ctx-tt-' + key + '">' +
      '<button type="button" class="ctx-tt-reset ctx-tt-' + key + '-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row ctx-tt-' + key + '-toggle-row">' +
      '<button type="button" class="sm-dark-toggle ctx-tt-' + key + '-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row ctx-tt-' + key + '-dark-row">' +
      '<label>Dark mode ' + what + '</label>' +
      '<input type="color" class="ctx-tt-sw ctx-tt-' + key + '-dark">' +
      '<button type="button" class="ctx-tt-reset ctx-tt-' + key + '-dark-reset" title="Reset to auto">×</button>' +
    '</div>';
}

/**
 * Primes and wires one colour row, doing the same light<->dark primary swap
 * the style popover does: the theme that's actually on is the one the top
 * swatch edits, and the other stays collapsed until opened or already
 * overridden. Without the swap, a ta working in dark mode - the site's own
 * default - would be picking colours they can't see the effect of.
 * @param id the element being edited
 * @param d its descriptor, filled out
 * @param key the light-mode field name, also the row's class stem
 * @param darkKey the dark-mode field name
 * @param liveHex what the bubble currently renders this colour as, for the
 *   swatch that has no explicit value of its own to show
 * @param what the noun for the toggle's title
 */
function wireTooltipColorRow(id, d, key, darkKey, liveHex, what) {
  var dark = isDarkThemeActive();
  var lightInput = CTX_MENU.querySelector(".ctx-tt-" + key);
  var darkInput = CTX_MENU.querySelector(".ctx-tt-" + key + "-dark");
  var darkRow = CTX_MENU.querySelector(".ctx-tt-" + key + "-dark-row");
  /* the border color shares its line with the border width slider, so there's
     no row of its own to collapse - the swatch itself stands in for one, the
     same substitution buildStyleMenu() makes for its own border row */
  var lightRow = CTX_MENU.querySelector(".ctx-tt-" + key + "-row") || lightInput;
  var toggle = CTX_MENU.querySelector(".ctx-tt-" + key + "-dark-toggle");
  var darkReset = CTX_MENU.querySelector(".ctx-tt-" + key + "-dark-reset");
  var lightReset = CTX_MENU.querySelector(".ctx-tt-" + key + "-reset");

  var primaryKey = dark ? darkKey : key;
  var secondaryKey = dark ? key : darkKey;
  var primaryInput = dark ? darkInput : lightInput;
  var secondaryInput = dark ? lightInput : darkInput;
  var secondaryRow = dark ? lightRow : darkRow;

  /* a swatch has no "unset" of its own to show, so an override that isn't set
     shows what the bubble actually renders as instead (liveHex), and the
     other theme's shows the variant it would auto-derive - see
     primeThemedColorRow(), which is doing exactly this for the style popover */
  primaryInput.value = isHexColor(d[primaryKey]) ? d[primaryKey] : liveHex;
  secondaryInput.value = isHexColor(d[secondaryKey])
    ? d[secondaryKey] : autoDarkVariant(primaryInput.value);
  secondaryRow.style.display = d[secondaryKey] ? "" : "none";

  toggle.textContent = dark ? "☀️" : "🌙";
  toggle.title = (dark ? "Edit light mode " : "Edit dark mode ") + what;
  toggle.addEventListener("click", function () {
    secondaryRow.style.display = secondaryRow.style.display === "none" ? "" : "none";
  });

  lightInput.addEventListener("input", function () { setTooltipProp(id, key, lightInput.value); });
  darkInput.addEventListener("input", function () { setTooltipProp(id, darkKey, darkInput.value); });
  /* the resets clear the override and put the suggestion back in the swatch,
     but leave the row where it is: collapsing it here would take the primary
     row away with it in whichever theme has that side on top */
  if (lightReset) {
    lightReset.addEventListener("click", function () {
      setTooltipProp(id, key, "");
      lightInput.value = liveHex;
    });
  }
  darkReset.addEventListener("click", function () {
    setTooltipProp(id, darkKey, "");
    darkInput.value = autoDarkVariant(lightInput.value);
  });
}

/**
 * Whether a saved colour is one of the sub-editor's own picks, ie something
 * an <input type=color> can be set to.
 * @param v the saved value
 * @return true if it's a "#rrggbb" string
 * @note A descriptor seeded elsewhere can carry a css variable or any other
 * colour string, which a swatch has no way to show.
 */
function isHexColor(v) {
  return typeof v === "string" && v.charAt(0) === "#";
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
var STYLE_HOVERCOLOR_BEFORE = "";
var STYLE_ACTIVECOLOR_BEFORE = "";
var STYLE_FILL_BEFORE = "";
var STYLE_TINT_BEFORE = "";
var STYLE_SHADE_BEFORE = 0;
var STYLE_RADIUS_BEFORE = "0";
var STYLE_BORDER_BEFORE = { w: 0, color: "#000000" };
var STYLE_ROTATE_BEFORE = "0";
/* the reel spacing sliders' pre-drag values, one undo step each per drag -
   see buildStyleMenu()'s spacing rows and primeStyleMenuReelRows() */
var STYLE_REEL_BEFORE = { gap: REEL_DEFAULT_GAP, pad: REEL_DEFAULT_PAD };

/* the same "one undo step per slider session, not per pixel" latch for the
   tile flow containers' spacing slider, see areaFlowFor()'s "gap" */
var STYLE_TILE_GAP_BEFORE = TILE_GAP_DEFAULT;
/* same "value right before this popover session's edit" convention as
   STYLE_COLOR_BEFORE etc. above, for each row's "dark mode color" sub-row */
var STYLE_DARKCOLOR_BEFORE = "";
var STYLE_DARKTEXTCOLOR_BEFORE = "";
var STYLE_DARKHOVERCOLOR_BEFORE = "";
var STYLE_DARKACTIVECOLOR_BEFORE = "";
var STYLE_DARKFILL_BEFORE = "";
var STYLE_DARKBORDER_BEFORE = "";
/* same "value right before this popover session's edit" convention, for the
   "progress" custom element's own Progress color/Bar color rows */
var STYLE_PROGRESSFILL_BEFORE = "";
var STYLE_DARKPROGRESSFILL_BEFORE = "";
var STYLE_PROGRESSTRACK_BEFORE = "";
var STYLE_DARKPROGRESSTRACK_BEFORE = "";
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
    '<div class="sm-row sm-btnstate-row sm-hovercolor-row">' +
      '<label>Hover color</label>' +
      '<input type="color" class="sm-hovercolor">' +
      '<button type="button" class="sm-hovercolor-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-btnstate-row sm-hovercolor-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-hovercolor-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-btnstate-row sm-hovercolor-dark-row">' +
      '<label>Dark mode hover</label>' +
      '<input type="color" class="sm-hovercolor-dark">' +
      '<button type="button" class="sm-hovercolor-dark-reset" title="Reset to auto">×</button>' +
    '</div>' +
    '<div class="sm-row sm-btnstate-row sm-activecolor-row">' +
      '<label>Click color</label>' +
      '<input type="color" class="sm-activecolor">' +
      '<button type="button" class="sm-activecolor-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-dark-toggle-row sm-btnstate-row sm-activecolor-toggle-row">' +
      '<button type="button" class="sm-dark-toggle sm-activecolor-dark-toggle"></button>' +
    '</div>' +
    '<div class="sm-row sm-dark-row sm-btnstate-row sm-activecolor-dark-row">' +
      '<label>Dark mode click</label>' +
      '<input type="color" class="sm-activecolor-dark">' +
      '<button type="button" class="sm-activecolor-dark-reset" title="Reset to auto">×</button>' +
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
    /* a progress bar's two COLORS live here; its two variable bindings don't
       (they're on the right-click menu, see renderCtxMenuProgressVars()) -
       what a bar measures isn't a paint decision, and burying it here made
       the one structural choice about a bar the hardest to find */
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
    '<div class="sm-row sm-transform-row sm-flip-row">' +
      '<label>Flip</label>' +
      '<button type="button" class="sm-flip-h" title="Flip horizontal">' + FLIP_ICONS.h + '</button>' +
      '<button type="button" class="sm-flip-v" title="Flip vertical">' + FLIP_ICONS.v + '</button>' +
    '</div>' +
    '<div class="sm-row sm-transform-row sm-rotate-row">' +
      '<label>Rotate</label>' +
      '<input type="range" class="sm-rotate" min="-180" max="180" step="1">' +
      '<span class="sm-rotate-val">0°</span>' +
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
    /* a reel's two spacing figures (see reelGap()/reelPad()). Both rows show
       for the panel AND for any tile inside it, since a tile is what a ta
       actually clicks on - the panel behind them is almost entirely covered.
       Which of the two is "horizontal" depends on which way the reel runs,
       so the labels are written at open time rather than baked in here. */
    '<div class="sm-row sm-reel-row sm-reel-gap-row">' +
      '<label class="sm-reel-gap-label">Horizontal spacing</label>' +
      '<input type="range" class="sm-reel-gap" min="0" max="160" step="1">' +
      '<span class="sm-reel-gap-val">20px</span>' +
    '</div>' +
    '<div class="sm-row sm-reel-row sm-reel-pad-row">' +
      '<label class="sm-reel-pad-label">Vertical spacing</label>' +
      '<input type="range" class="sm-reel-pad" min="0" max="160" step="1">' +
      '<span class="sm-reel-pad-val">0px</span>' +
    '</div>' +
    /* how far apart a tile flow container's tiles sit (see areaFlowFor()'s
       "gap"). Shown for the container AND for anything inside one, the same
       reachability rule the reel rows above follow and the right-click
       Container section already follows: the container is almost entirely
       covered by its own tiles, so what a ta clicks on is a tile. */
    '<div class="sm-row sm-tile-gap-row">' +
      '<label>Tile spacing</label>' +
      '<input type="range" class="sm-tile-gap" min="0" max="120" step="1">' +
      '<span class="sm-tile-gap-val">10px</span>' +
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
  var hoverColorInput = STYLE_MENU.querySelector(".sm-hovercolor");
  var hoverColorReset = STYLE_MENU.querySelector(".sm-hovercolor-reset");
  var hoverColorDarkToggle = STYLE_MENU.querySelector(".sm-hovercolor-dark-toggle");
  var hoverColorDarkInput = STYLE_MENU.querySelector(".sm-hovercolor-dark");
  var hoverColorDarkReset = STYLE_MENU.querySelector(".sm-hovercolor-dark-reset");
  var activeColorInput = STYLE_MENU.querySelector(".sm-activecolor");
  var activeColorReset = STYLE_MENU.querySelector(".sm-activecolor-reset");
  var activeColorDarkToggle = STYLE_MENU.querySelector(".sm-activecolor-dark-toggle");
  var activeColorDarkInput = STYLE_MENU.querySelector(".sm-activecolor-dark");
  var activeColorDarkReset = STYLE_MENU.querySelector(".sm-activecolor-dark-reset");
  var fillInput = STYLE_MENU.querySelector(".sm-fill");
  var fillReset = STYLE_MENU.querySelector(".sm-fill-reset");
  var fillDarkToggle = STYLE_MENU.querySelector(".sm-fill-dark-toggle");
  var fillDarkInput = STYLE_MENU.querySelector(".sm-fill-dark");
  var fillDarkReset = STYLE_MENU.querySelector(".sm-fill-dark-reset");
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
  var flipHBtn = STYLE_MENU.querySelector(".sm-flip-h");
  var flipVBtn = STYLE_MENU.querySelector(".sm-flip-v");
  var rotateInput = STYLE_MENU.querySelector(".sm-rotate");
  var rotateVal = STYLE_MENU.querySelector(".sm-rotate-val");
  var opacityInput = STYLE_MENU.querySelector(".sm-opacity");
  var opacityVal = STYLE_MENU.querySelector(".sm-opacity-val");
  var dtFont = STYLE_MENU.querySelector(".sm-dt-font");
  var dtFormat = STYLE_MENU.querySelector(".sm-dt-format");
  var dtPattern = STYLE_MENU.querySelector(".sm-dt-pattern");
  var dtTarget = STYLE_MENU.querySelector(".sm-dt-target");

  var themeIconBtn = STYLE_MENU.querySelector(".sm-theme-icon-btn");

  [colorInput, colorReset, colorDarkToggle, colorDarkInput, colorDarkReset,
   textColorInput, textColorReset, textColorDarkToggle, textColorDarkInput, textColorDarkReset,
   hoverColorInput, hoverColorReset, hoverColorDarkToggle, hoverColorDarkInput, hoverColorDarkReset,
   activeColorInput, activeColorReset, activeColorDarkToggle, activeColorDarkInput, activeColorDarkReset,
   fillInput, fillReset, fillDarkToggle, fillDarkInput, fillDarkReset,
   progressFillInput, progressFillReset, progressFillDarkToggle, progressFillDarkInput, progressFillDarkReset,
   progressTrackInput, progressTrackReset, progressTrackDarkToggle, progressTrackDarkInput, progressTrackDarkReset,
   tintInput, tintReset, shadeInput, radiusInput, borderW, borderColor,
   borderDarkToggle, borderColorDark, borderDarkReset,
   shadowInput, flipHBtn, flipVBtn, rotateInput, opacityInput, dtFont, dtFormat, dtPattern, dtTarget, themeIconBtn].forEach(function (el) {
    el.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  });

  /**
   * Wires one colour row's light/dark toggle: click shows (or hides)
   * whichever of the row's two swatches isn't the one currently on show.
   * @param toggleBtn the row's own toggle button
   * @param lightRow the light-mode div (always saves to the light map)
   * @param darkRow the dark-mode div (always saves to the dark map)
   * @note The default one always matches the theme rendering right now, so in
   * light mode this reveals the dark row and vice versa. Purely a visibility
   * toggle - the value underneath is set by each row's own input/reset.
   */
  function wireDarkToggle(toggleBtn, lightRow, darkRow) {
    toggleBtn.addEventListener("click", function () {
      var secondary = isDarkThemeActive() ? lightRow : darkRow;
      secondary.style.display = secondary.style.display === "none" ? "" : "none";
    });
  }
  wireDarkToggle(colorDarkToggle, STYLE_MENU.querySelector(".sm-color-row"), STYLE_MENU.querySelector(".sm-color-dark-row"));
  wireDarkToggle(textColorDarkToggle, STYLE_MENU.querySelector(".sm-textcolor-row"), STYLE_MENU.querySelector(".sm-textcolor-dark-row"));
  wireDarkToggle(hoverColorDarkToggle, STYLE_MENU.querySelector(".sm-hovercolor-row"), STYLE_MENU.querySelector(".sm-hovercolor-dark-row"));
  wireDarkToggle(activeColorDarkToggle, STYLE_MENU.querySelector(".sm-activecolor-row"), STYLE_MENU.querySelector(".sm-activecolor-dark-row"));
  wireDarkToggle(fillDarkToggle, STYLE_MENU.querySelector(".sm-fill-row"), STYLE_MENU.querySelector(".sm-fill-dark-row"));
  wireDarkToggle(progressFillDarkToggle, STYLE_MENU.querySelector(".sm-progress-fill-row"), STYLE_MENU.querySelector(".sm-progress-fill-dark-row"));
  wireDarkToggle(progressTrackDarkToggle, STYLE_MENU.querySelector(".sm-progress-track-row"), STYLE_MENU.querySelector(".sm-progress-track-dark-row"));
  wireDarkToggle(borderDarkToggle, STYLE_MENU.querySelector(".sm-border-color"), STYLE_MENU.querySelector(".sm-border-dark-row"));

  /**
   * Previews the progress bar's fill at a visible width while its colour is
   * being chosen - at a low percentage the swatch's choice is otherwise
   * invisible on the actual bar.
   * @param input the row's own <input type=color> (light or dark side)
   * @note An empty bar is already previewed at this exact width just for
   * being selected, so hovering the swatch doesn't make it jump. Purely
   * visual: the real width is restored on mouseleave and no data changes.
   */
  function wireProgressFillHoverPreview(input) {
    input.addEventListener("mouseenter", function () {
      var el = STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID);
      var fillEl = el && el.querySelector(".progress-el-fill");
      if (fillEl) fillEl.style.width = PROGRESS_PREVIEW_PCT + "%";
    });
    input.addEventListener("mouseleave", function () {
      var el = STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID);
      var fillEl = el && el.querySelector(".progress-el-fill");
      if (fillEl) fillEl.style.width = progressFillWidthFor(fillEl) + "%";
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
    pinShownThemeColor(colorInput, colorDarkInput, "colors", "darkColors", saveEditedColor, saveEditedDarkColor);
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
    pinShownThemeColor(colorInput, colorDarkInput, "colors", "darkColors", saveEditedColor, saveEditedDarkColor);
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
    pinShownThemeColor(textColorInput, textColorDarkInput, "textColor", "darkTextColor",
      saveEditedTextColor, saveEditedDarkTextColor);
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
    pinShownThemeColor(textColorInput, textColorDarkInput, "textColor", "darkTextColor",
      saveEditedTextColor, saveEditedDarkTextColor);
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

  /**
   * Wires one state-colour row (Hover or Click, each with its own light+dark
   * pair) - the same six-listener shape every other themed colour row here
   * follows, factored out since the two are identical but for which map entry
   * and undo type they write to.
   * @param lightInput/lightReset/darkInput/darkReset/darkToggle the controls
   * @param mapKey/darkMapKey THEMED_OVERRIDE_MAPS keys for this row
   * @param which "hover" or "press", for paintElementStateColor()
   * @param saveFn/darkSaveFn the light/dark persistence functions
   * @param undoType/darkUndoType the EDIT_UNDO "type" strings for this row
   * @param getBefore/setBefore/getDarkBefore/setDarkBefore accessors for this
   *   row's own STYLE_*_BEFORE vars (plain vars can't be passed by reference)
   * @note Unlike a plain colour row there's no rendered "current" value a
   * reset can read back, since these only paint during their state, so the
   * reset just clears to a neutral swatch display.
   */
  function wireButtonStateColorRow(lightInput, lightReset, darkInput, darkReset,
      mapKey, darkMapKey, which, saveFn, darkSaveFn, undoType, darkUndoType,
      getBefore, setBefore, getDarkBefore, setDarkBefore) {
    function apply(el) {
      paintElementStateColor(el, which);
      /* a click color left unpicked follows the hover color, so editing the
         hover row has to repaint the press state too - otherwise the two only
         agree again after a reload */
      if (which === "hover") paintElementStateColor(el, "press");
      /* and hold the element in the state being edited so a ta can see what
         they're picking. These are the two colors that never show at rest,
         and the editor deliberately doesn't light elements up under the
         cursor (see wireStateColorHover()), so without this the swatch would
         be the only thing that ever changed. Same "see what you're styling"
         idea as the tooltip sub-editor pinning its bubble open. */
      previewElementState(el, which);
    }
    lightInput.addEventListener("input", function () {
      if (!STYLE_MENU_ID) return;
      var el = styleMenuEl();
      if (!el) return;
      THEMED_OVERRIDE_MAPS[mapKey][STYLE_MENU_ID] = lightInput.value;
      apply(el);
      saveFn(STYLE_MENU_ID, lightInput.value);
      pinShownThemeColor(lightInput, darkInput, mapKey, darkMapKey, saveFn, darkSaveFn);
    });
    lightInput.addEventListener("change", function () {
      if (!STYLE_MENU_ID) return;
      var after = lightInput.value;
      if (after !== getBefore()) {
        EDIT_UNDO.push({ type: undoType, id: STYLE_MENU_ID, before: getBefore(), after: after });
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
      apply(el);
      saveFn(STYLE_MENU_ID, "");
      /* back to "this state is just the normal color", so show that color
         rather than a black the element never had */
      lightInput.value = currentColorValue(el);
      if (before !== "") {
        EDIT_UNDO.push({ type: undoType, id: STYLE_MENU_ID, before: before, after: "" });
        EDIT_REDO.length = 0;
      }
      setBefore("");
    });
    darkInput.addEventListener("input", function () {
      if (!STYLE_MENU_ID) return;
      var el = styleMenuEl();
      if (!el) return;
      THEMED_OVERRIDE_MAPS[darkMapKey][STYLE_MENU_ID] = darkInput.value;
      apply(el);
      darkSaveFn(STYLE_MENU_ID, darkInput.value);
      pinShownThemeColor(lightInput, darkInput, mapKey, darkMapKey, saveFn, darkSaveFn);
    });
    darkInput.addEventListener("change", function () {
      if (!STYLE_MENU_ID) return;
      var after = darkInput.value;
      if (after !== getDarkBefore()) {
        EDIT_UNDO.push({ type: darkUndoType, id: STYLE_MENU_ID, before: getDarkBefore(), after: after });
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
      darkSaveFn(STYLE_MENU_ID, "");
      apply(el);
      var after = autoDarkVariant(lightInput.value);
      darkInput.value = after;
      if (before !== "") {
        EDIT_UNDO.push({ type: darkUndoType, id: STYLE_MENU_ID, before: before, after: "" });
        EDIT_REDO.length = 0;
      }
      setDarkBefore("");
    });
  }
  wireButtonStateColorRow(hoverColorInput, hoverColorReset, hoverColorDarkInput, hoverColorDarkReset,
    "hoverColor", "darkHoverColor", "hover", saveEditedHoverColor, saveEditedDarkHoverColor,
    "hovercolor", "darkhovercolor",
    function () { return STYLE_HOVERCOLOR_BEFORE; }, function (v) { STYLE_HOVERCOLOR_BEFORE = v; },
    function () { return STYLE_DARKHOVERCOLOR_BEFORE; }, function (v) { STYLE_DARKHOVERCOLOR_BEFORE = v; });
  wireButtonStateColorRow(activeColorInput, activeColorReset, activeColorDarkInput, activeColorDarkReset,
    "activeColor", "darkActiveColor", "press", saveEditedActiveColor, saveEditedDarkActiveColor,
    "activecolor", "darkactivecolor",
    function () { return STYLE_ACTIVECOLOR_BEFORE; }, function (v) { STYLE_ACTIVECOLOR_BEFORE = v; },
    function () { return STYLE_DARKACTIVECOLOR_BEFORE; }, function (v) { STYLE_DARKACTIVECOLOR_BEFORE = v; });

  fillInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    THEMED_OVERRIDE_MAPS.fill[STYLE_MENU_ID] = fillInput.value;
    el.style.backgroundColor = resolveThemedColor(fillInput.value, THEMED_OVERRIDE_MAPS.darkFill[STYLE_MENU_ID]);
    saveEditedFill(STYLE_MENU_ID, fillInput.value);
    pinShownThemeColor(fillInput, fillDarkInput, "fill", "darkFill", saveEditedFill, saveEditedDarkFill);
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
    pinShownThemeColor(fillInput, fillDarkInput, "fill", "darkFill", saveEditedFill, saveEditedDarkFill);
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
   * Wires one progress colour row's input/change/reset for both swatches -
   * the fill/darkFill wiring's generic twin, factored out because progress
   * adds two such rows (fill, track) at once.
   * @param lightInput/lightReset/darkInput/darkReset the row's four controls
   * @param mapKey/darkMapKey THEMED_OVERRIDE_MAPS.progress* keys for this row
   * @param saveFn/saveDarkFn the row's persistence functions
   * @param type/darkType EDIT_UNDO "type" strings for this row
   * @param readCurrentFn (el) -> hex, reads the live rendered colour back
   *   after a reset
   * @param getBefore/setBefore/getDarkBefore/setDarkBefore accessors for this
   *   row's pair of session-baseline globals
   * @note There's no single setElementColor()-style setter for a two-colour
   * composite element, so every branch repaints via paintProgressElement().
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
      pinShownThemeColor(lightInput, darkInput, mapKey, darkMapKey, saveFn, saveDarkFn);
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
      pinShownThemeColor(lightInput, darkInput, mapKey, darkMapKey, saveFn, saveDarkFn);
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

  /* the reel spacing pair, both wired the same way: drag repaints the strip
     live, letting go banks one undo step for the whole drag (same
     input-then-change split every other slider in here uses). Resolved to
     the PANEL rather than to whatever's selected, so the sliders work
     identically whether a ta clicked the reel or one of its tiles. */
  [["gap", ".sm-reel-gap", ".sm-reel-gap-val"], ["pad", ".sm-reel-pad", ".sm-reel-pad-val"]]
    .forEach(function (row) {
      var key = row[0];
      var input = STYLE_MENU.querySelector(row[1]);
      var out = STYLE_MENU.querySelector(row[2]);
      input.addEventListener("input", function () {
        var panel = reelPanelOf(STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID));
        if (!panel) return;
        var px = parseInt(input.value, 10) || 0;
        out.textContent = px + "px";
        setReelSpacing(panel, key, px);
        positionRing();
      });
      input.addEventListener("change", function () {
        var panel = reelPanelOf(STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID));
        if (!panel) return;
        var after = parseInt(input.value, 10) || 0;
        if (after !== STYLE_REEL_BEFORE[key]) {
          EDIT_UNDO.push({ type: "reelSpacing", id: elId(panel), key: key,
            before: STYLE_REEL_BEFORE[key], after: after });
          EDIT_REDO.length = 0;
        }
        STYLE_REEL_BEFORE[key] = after;
      });
    });

  /* the tile flow containers' own spacing slider, wired exactly like the reel
     pair above (live on input, one undo step on change) and resolved to the
     CONTAINER rather than to whatever's selected, for the same reason: a ta
     clicks a tile, not the transparent box laying it out. */
  var tileGapInput = STYLE_MENU.querySelector(".sm-tile-gap");
  var tileGapOut = STYLE_MENU.querySelector(".sm-tile-gap-val");
  tileGapInput.addEventListener("input", function () {
    var area = styleMenuFlowArea();
    if (!area) return;
    var px = parseInt(tileGapInput.value, 10) || 0;
    tileGapOut.textContent = px + "px";
    setAreaFlowProp(elId(area), "gap", px);
  });
  tileGapInput.addEventListener("change", function () {
    var area = styleMenuFlowArea();
    if (!area) return;
    var after = parseInt(tileGapInput.value, 10) || 0;
    if (after !== STYLE_TILE_GAP_BEFORE) {
      EDIT_UNDO.push({ type: "areaGap", id: elId(area),
        before: STYLE_TILE_GAP_BEFORE, after: after });
      EDIT_REDO.length = 0;
    }
    STYLE_TILE_GAP_BEFORE = after;
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
   * Commits width and colour together, given the colour to use.
   * @note Width is always theme-independent, but the colour half needs care:
   * when light mode is the hidden swatch, its value is only an unconfirmed
   * auto-suggestion, and dragging the width slider must not promote that into
   * a real saved colour. So a width-only drag reuses the last confirmed light
   * colour from the cached map, while an edit of the light swatch itself
   * always passes its own deliberately-chosen value.
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
  /* pinShownThemeColor()'s equivalent for this row, written out by hand
     because border's maps hold {w, color} objects rather than plain colour
     strings. Same reason it exists: once one theme's border colour is
     explicit, leaving the other to autoDarkVariant() paints all but the same
     colour in both. */
  function pinShownBorderColor() {
    if (!STYLE_MENU_ID) return;
    var w = parseInt(borderW.value, 10);
    if (isDarkThemeActive()) {
      var dv = THEMED_OVERRIDE_MAPS.darkBorder[STYLE_MENU_ID];
      if (dv && dv.color) return;
      THEMED_OVERRIDE_MAPS.darkBorder[STYLE_MENU_ID] = { color: borderColorDark.value };
      saveEditedDarkBorder(STYLE_MENU_ID, borderColorDark.value);
      return;
    }
    var lv = THEMED_OVERRIDE_MAPS.border[STYLE_MENU_ID];
    if (lv && lv.color) return;
    THEMED_OVERRIDE_MAPS.border[STYLE_MENU_ID] = { w: w, color: borderColor.value };
    saveEditedBorder(STYLE_MENU_ID, w, borderColor.value);
  }
  borderW.addEventListener("input", function () { commitBorder(confirmedLightBorderColor()); });
  borderColor.addEventListener("input", function () {
    commitBorder(borderColor.value);
    pinShownBorderColor();
  });
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
    pinShownBorderColor();
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

  function toggleFlip(btn, dsKey, snapKey) {
    btn.addEventListener("click", function () {
      if (!STYLE_MENU_ID) return;
      var el = styleMenuEl();
      if (!el) return;
      var on = el.dataset[dsKey] !== "1";
      if (on) el.dataset[dsKey] = "1"; else delete el.dataset[dsKey];
      paintPos(el);
      btn.classList.toggle("active", on);
      saveEditedFlip(STYLE_MENU_ID, snapKey, on);
      EDIT_UNDO.push({ type: snapKey, id: STYLE_MENU_ID });
      EDIT_REDO.length = 0;
    });
  }
  toggleFlip(flipHBtn, "flipH", "flip_h");
  toggleFlip(flipVBtn, "flipV", "flip_v");

  rotateInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var deg = parseInt(rotateInput.value, 10) || 0;
    if (deg) el.dataset.rotate = deg; else delete el.dataset.rotate;
    paintPos(el);
    rotateVal.textContent = deg + "°";
    saveEditedRotate(STYLE_MENU_ID, deg);
  });
  rotateInput.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = rotateInput.value;
    if (after !== STYLE_ROTATE_BEFORE) {
      EDIT_UNDO.push({ type: "rotate", id: STYLE_MENU_ID, before: parseInt(STYLE_ROTATE_BEFORE, 10), after: parseInt(after, 10) });
      EDIT_REDO.length = 0;
    }
    STYLE_ROTATE_BEFORE = after;
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
      applyTextAlignStyle(el, next);
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
 * Looks up the element the popover is styling by its id, the page included -
 * every row paints through this, so the page has to resolve here or its own
 * colour rows would change nothing.
 * @param id the element's id
 * @return the element, or null if it's no longer in the document
 */
function styleMenuElById(id) {
  return document.querySelector(idSel(id));
}

/**
 * The tile flow container the popover's spacing slider should act on: the one
 * whatever it currently has selected belongs to (see flowAreaForEl()).
 * @return the container, or null if the popover isn't on one
 */
function styleMenuFlowArea() {
  return flowAreaForEl(STYLE_MENU_ID && styleMenuElById(STYLE_MENU_ID));
}

/**
 * Reads an element's current colour override as a hex string an
 * <input type=color> can display, "#000000" if none is set - the input has
 * no real "unset" state to fall back to.
 * @param el the element
 * @return a "#rrggbb" string
 */
function currentColorValue(el) {
  var cs = getComputedStyle(el);
  var live = colorTarget(el) === "bg" ? cs.backgroundColor : cs.color;
  return rgbToHex(live) || "#000000";
}

/**
 * Parses a computed colour string into 0-255 r/g/b and a 0-1 alpha.
 * @param str the computed color string
 * @return {r, g, b, a} (0-255, 0-255, 0-255, 0-1), or null if unparseable
 * @note Handles both serializations: the usual rgb()/rgba(), and "color(srgb
 * r g b / a)" with 0-1 floats, which Chromium uses when the value came from a
 * color-mix() - as all this project's --surface tokens do. A plain rgba?()
 * regex never matches that second form, silently falling back to black.
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
 * Converts a "#rrggbb" hex string to {h, s, l} (h 0-360, s/l 0-100).
 * @param hex a "#rrggbb" string
 * @return {h, s, l}, or null if unparseable
 * @note The intermediate autoDarkVariant() flips lightness in - flipping rgb
 * channels directly would shift hue and saturation too, turning a ta's navy
 * blue into a washed-out tan rather than a lighter blue.
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
 * Auto-computes a dark-mode variant of a ta-picked light colour: same hue and
 * saturation, lightness flipped around the midpoint - the same trick this
 * site's own --text/--bg/--surface variables amount to between their two
 * palettes. A near-black picked for a light background becomes near-white for
 * the dark one, so it never goes invisible in the theme it wasn't designed
 * against. The fallback whenever no explicit dark override exists.
 * @param hex a "#rrggbb" string (or any css colour the browser normalized to
 *   one via getComputedStyle - callers here always pass one of those)
 * @return a "#rrggbb" string, or the input unchanged if unparseable
 */
function autoDarkVariant(hex) {
  var c = hexToHsl(hex);
  if (!c) return hex;
  return hslToHex(c.h, c.s, 100 - c.l);
}

/**
 * Whether the page being edited is showing dark mode right now - the live
 * signal every theme-aware colour read in this file keys off.
 * @return true if dark mode is the one currently rendering
 * @note Read straight off documentElement rather than cached, since a ta can
 * flip it at any moment - the site's own toggle on a live page, or the
 * right-click "Preview in ... mode" inside the editor.
 */
function isDarkThemeActive() {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

/**
 * Resolves which of a colour override's two saved values applies right now:
 * the ta's explicit value for the active theme if they set one, else the
 * OTHER side's auto-computed variant - never the literal other-theme colour
 * unmodified, which is the bug this exists to fix.
 * @param lightVal the saved light-mode value, "" / undefined if unset
 * @param darkVal the saved dark-mode value, "" / undefined if unset
 * @return the css colour string to paint, "" if neither side is set
 * @note The two are independent optional overrides, not "a base plus an
 * override": a ta editing in dark mode - the site's default - can set only
 * the dark value, so this auto-flips in BOTH directions. Otherwise someone
 * who never edits in light mode would see every override vanish back to the
 * page default the moment a light-preferring visitor loaded the page.
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
 * Pins the ON-SCREEN theme's value for one style-popover colour row, the
 * moment a ta edits the theme that isn't on screen.
 * @param lightInput/darkInput the row's two <input type=color>s
 * @param lightMapKey/darkMapKey THEMED_OVERRIDE_MAPS keys for this row
 * @param saveLight/saveDark the row's two persistence functions
 * @note Call this at the END of BOTH of a row's input handlers. Editing the
 * shown side has already written that side's map entry by then, so this is a
 * no-op there; editing the hidden side is the case it exists for.
 * @note primeThemedColorRow() deliberately does NOT write the primary
 * swatch's live value into its map ("that would fabricate a fake explicit
 * override out of a plain live read"), which is right while nothing has been
 * edited. But once the OTHER theme gets a real value, the unwritten side
 * stops meaning "untouched" and starts meaning "auto-variant of the pick you
 * just made" - and autoDarkVariant() flips lightness around 50%, so for any
 * mid-lightness colour it hands back all but the same colour. Pick an orange
 * for dark mode from light mode and light mode went orange too, while the
 * swatch still showed the colour it used to be: the "does not save, sets the
 * same colour across both modes" report. Pinning what is already on screen
 * costs nothing visually and makes the two sides independent for real.
 * @note The inline text-colour toolbar has the same split and the same fix,
 * see applyThemedForeColor().
 */
function pinShownThemeColor(lightInput, darkInput, lightMapKey, darkMapKey, saveLight, saveDark) {
  var id = STYLE_MENU_ID;
  if (!id) return;
  var dark = isDarkThemeActive();
  var shownMap = THEMED_OVERRIDE_MAPS[dark ? darkMapKey : lightMapKey];
  if (!shownMap || shownMap[id]) return;
  var shown = (dark ? darkInput : lightInput).value;
  if (!shown) return;
  shownMap[id] = shown;
  (dark ? saveDark : saveLight)(id, shown);
}

/**
 * Reads an element's current background fill - a textbox's own surface
 * colour, separate from its font colour - as a hex string, "#ffffff" if
 * transparent or unset.
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
 * Reads a button's current text colour as a hex string, "#ffffff" if
 * unparseable - same convention as currentFillValue().
 * @param el the button element
 * @return a "#rrggbb" string
 */
function currentTextColorValue(el) {
  return rgbToHex(getComputedStyle(el).color) || "#ffffff";
}

/**
 * Reads an image/video's current tint colour as a hex string, "#ffffff" if it
 * has none - same convention as currentFillValue().
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
 * Reads an element's current uniform border radius in css px, off the live
 * computed style so an element already rounded by the stylesheet starts the
 * slider at its real look rather than 0.
 * @param el the element
 * @return a whole-number px value
 */
function currentRadiusValue(el) {
  return Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0);
}

/**
 * Reads an element's current border width and colour off the live computed
 * style.
 * @param el the element
 * @return {w, color}
 * @note A computed width resolves to 0 when border-style is "none", but this
 * project's untouched elements draw a real 1px solid border with a fully
 * transparent colour - "no borders anywhere" is achieved by hiding the
 * colour, not removing the border - which the spec does NOT zero out. Read
 * literally that shows a misleading "1px", and undo could restore it as solid
 * black once the alpha collapses. So a fully transparent colour counts as no
 * border, the same alpha check currentFillValue() makes.
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
 * Whether el currently has the shared drop-shadow applied, read off its own
 * inline style - the only place the shadow is ever written.
 * @param el the element
 * @return true if its box-shadow is set to anything other than "none"
 */
function currentShadowOn(el) {
  var v = getComputedStyle(el).boxShadow;
  return !!v && v !== "none";
}

/**
 * Fills one colour row's pair of light+dark swatches and its toggle, so that
 * whichever theme is actually rendering is always the "primary" one: shown by
 * default, its value the colour the ta can see. The other is collapsed behind
 * the toggle, so a ta who never touches it never notices it.
 * @param liveValue the colour rendered right now, always goes in the primary
 *   swatch
 * @param lightInput/darkInput the row's two <input type=color>s - fixed save
 *   targets regardless of which is primary right now
 * @param lightRow/darkRow their own row divs
 * @param toggleBtn the row's light/dark toggle button
 * @param lightMap/darkMap THEMED_OVERRIDE_MAPS.* for this row
 * @param label used in the toggle's title, eg "color"
 * @return {{lightBefore, darkBefore}} gesture-baseline values for the two
 *   physical inputs
 * @note The secondary swatch previews its own explicit override if there is
 * one, else autoDarkVariant() of the primary as a suggestion - that function
 * is self-inverse, so one formula works in either direction. Only the primary
 * side is written into the maps eagerly; the secondary stays
 * presentation-only until the ta actually edits it.
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
  /* NOT primaryMap[id] = liveValue: that would fabricate a fake "explicit
     override" out of a plain live read, and since primary/secondary swap by
     theme, a later re-open in the other direction would treat it as real and
     auto-expand the secondary row for something never set. Only an actual
     edit should write into a map. */
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
 * Re-primes the colour rows' light<->dark swap for whichever element the
 * popover is open on - the part of toggleStyleMenu() that depends on the
 * active theme, kept separate so refreshStyleMenuTheme() can re-run it alone
 * without disturbing radius/shadow/tint/opacity.
 * @param el the element the popover is open on
 * @note Which rows suit this element's KIND never changes for a given
 * element, so that gating is just recomputed here rather than threaded in.
 */
function primeStyleMenuThemedRows(el) {
  /* every live read below (currentColorValue(), currentFillValue(),
     currentBorderValue(), ...) goes through getComputedStyle, and the two
     state classes paint over exactly those properties - so an element being
     shown in its hover or press look while the popover primes would report
     that colour back as its resting one, and the next edit to any of those
     rows would save it. Held off for the duration and put straight back.
     This is what used to make hover/press feedback impossible to show in the
     editor at all (see wireStateColorHover()); with the reads fenced off,
     the feedback can stay on and the setting is finally verifiable there. */
  var wasHovered = el.classList.contains("el-hovered");
  var wasPressed = el.classList.contains("el-pressed");
  el.classList.remove("el-hovered", "el-pressed");

  var kind = elKind(el);
  var isImg = kind === "img";
  var isIcon = kind === "icon";
  var isDatetime = el.hasAttribute("data-datetime");
  var isProgress = el.hasAttribute("data-progress");
  var isExtrasArea = isLiveAreaEl(el);
  var isText = colorTarget(el) === "text";
  var isBtn = isButtonEl(el);
  /* kept in step with toggleStyleMenu()'s own copy: this one owns the border
     pair's dark row, which swaps in and out by theme and so can't just be
     hidden once with the rest of the .sm-shape-row group */
  var shapeDisplay = (isIcon || isDatetime || isPageEl(el)) ? "none" : "";

  if (!isImg && !isProgress && !isExtrasArea) {
    var colorBefore = primeThemedColorRow(currentColorValue(el),
      STYLE_MENU.querySelector(".sm-color"), STYLE_MENU.querySelector(".sm-color-dark"),
      STYLE_MENU.querySelector(".sm-color-row"), STYLE_MENU.querySelector(".sm-color-dark-row"),
      STYLE_MENU.querySelector(".sm-color-dark-toggle"), THEMED_OVERRIDE_MAPS.colors, THEMED_OVERRIDE_MAPS.darkColors, "color");
    STYLE_COLOR_BEFORE = colorBefore.lightBefore;
    STYLE_DARKCOLOR_BEFORE = colorBefore.darkBefore;
  }

  if (isProgress) {
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

  if (!isImg && !isProgress && !isExtrasArea) {
    /* unlike colour/fill, hover and click have no rendered value at rest -
       they only paint under the cursor. An unpicked one reads back as the
       colour the element already is, which is the honest answer: with nothing
       picked these states ARE the normal colour, so the swatch opens on it
       and any drag is a real change rather than a jump from an invented
       black. */
    var restingColor = currentColorValue(el);
    /* what these two WOULD paint right now, resolved for the theme in force
       (see resolveThemedColor()) exactly the way the rendered rows above read
       their live value - so the primary swatch is the colour a ta would
       actually see under the cursor, not whichever of the pair happens to be
       stored */
    var liveState = function (lightMap, darkMap) {
      var lv = lightMap[STYLE_MENU_ID], dv = darkMap[STYLE_MENU_ID];
      return (lv || dv) ? resolveThemedColor(lv, dv) : restingColor;
    };
    var hoverColorBefore = primeThemedColorRow(
      liveState(THEMED_OVERRIDE_MAPS.hoverColor, THEMED_OVERRIDE_MAPS.darkHoverColor),
      STYLE_MENU.querySelector(".sm-hovercolor"), STYLE_MENU.querySelector(".sm-hovercolor-dark"),
      STYLE_MENU.querySelector(".sm-hovercolor-row"), STYLE_MENU.querySelector(".sm-hovercolor-dark-row"),
      STYLE_MENU.querySelector(".sm-hovercolor-dark-toggle"), THEMED_OVERRIDE_MAPS.hoverColor, THEMED_OVERRIDE_MAPS.darkHoverColor, "hover color");
    STYLE_HOVERCOLOR_BEFORE = hoverColorBefore.lightBefore;
    STYLE_DARKHOVERCOLOR_BEFORE = hoverColorBefore.darkBefore;

    /* and an unpicked click color reads back as the hover color, matching
       what it actually does (see paintElementStateColor()'s fallback) rather
       than what it's stored as */
    var activeColorBefore = primeThemedColorRow(
      (THEMED_OVERRIDE_MAPS.activeColor[STYLE_MENU_ID] || THEMED_OVERRIDE_MAPS.darkActiveColor[STYLE_MENU_ID])
        ? liveState(THEMED_OVERRIDE_MAPS.activeColor, THEMED_OVERRIDE_MAPS.darkActiveColor)
        : liveState(THEMED_OVERRIDE_MAPS.hoverColor, THEMED_OVERRIDE_MAPS.darkHoverColor),
      STYLE_MENU.querySelector(".sm-activecolor"), STYLE_MENU.querySelector(".sm-activecolor-dark"),
      STYLE_MENU.querySelector(".sm-activecolor-row"), STYLE_MENU.querySelector(".sm-activecolor-dark-row"),
      STYLE_MENU.querySelector(".sm-activecolor-dark-toggle"), THEMED_OVERRIDE_MAPS.activeColor, THEMED_OVERRIDE_MAPS.darkActiveColor, "click color");
    STYLE_ACTIVECOLOR_BEFORE = activeColorBefore.lightBefore;
    STYLE_DARKACTIVECOLOR_BEFORE = activeColorBefore.darkBefore;
  }

  if (!isIcon && !isDatetime) {
    /* border width shares the always-visible row with the light swatch, so
       unlike the other rows border can't swap two whole rows by theme -
       instead the light <input> hides/shows within its row (width stays put,
       being theme-independent) while the dark row still swaps wholesale */
    var borderColor = STYLE_MENU.querySelector(".sm-border-color");
    var borderColorDark = STYLE_MENU.querySelector(".sm-border-color-dark");
    var borderDarkToggle = STYLE_MENU.querySelector(".sm-border-dark-toggle");
    var bd = currentBorderValue(el);
    STYLE_MENU.querySelector(".sm-border-w").value = bd.w;
    STYLE_MENU.querySelector(".sm-border-val").textContent = bd.w + "px";
    /* NOT writing the live value into the border maps - same reasoning as
       primeThemedColorRow(): a plain live read isn't a real override, and
       fabricating one would make the other side wrongly auto-expand later */
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

  if (wasHovered) el.classList.add("el-hovered");
  if (wasPressed) el.classList.add("el-pressed");
}

/**
 * Keeps the style popover in sync when a ta flips the site's theme while it's
 * already open on an element - without this the panel would keep showing
 * whichever mode was active when it opened. A no-op if the popover is shut.
 * @note Hooked into theme.js's setTheme() via window.refreshStyleMenuTheme,
 * the same window.-gated pattern as window.reapplyThemedColors.
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
  var isExtrasArea = isLiveAreaEl(el);
  var isText = colorTarget(el) === "text";
  var isBtn = isButtonEl(el);
  var isThemeToggle = el.hasAttribute("data-theme-toggle");
  var isPage = isPageEl(el);
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
     below, so it's worth spelling out which one this now is - and on the page,
     where "Color" alone could just as easily read as its text colour, saying
     background is what makes it unambiguous */
  STYLE_MENU.querySelector(".sm-color-label").textContent = (isBtn || isPage) ? "Background" : "Color";
  STYLE_MENU.querySelector(".sm-textcolor-row").style.display = isBtn ? "" : "none";
  STYLE_MENU.querySelector(".sm-textcolor-dark-row").style.display = isBtn ? "" : "none";
  STYLE_MENU.querySelector(".sm-textcolor-toggle-row").style.display = isBtn ? "" : "none";
  /* Hover and Click colour are offered wherever the plain Color row is, since
     they paint the same thing - a box, an icon and a heading all get a look
     under the cursor now, not just a button. Hidden exactly where Color is
     hidden and for the same reasons: an image has no surface, a progress bar
     paints its own two colours, the extras area is deliberately transparent. */
  STYLE_MENU.querySelectorAll(".sm-btnstate-row").forEach(function (row) {
    row.style.display = (isImg || isProgress || isExtrasArea) ? "none" : "";
  });
  STYLE_MENU.querySelector(".sm-theme-row").style.display = isThemeToggle ? "" : "none";
  /* a datetime element paints its own text color via the Color row, so its
     Fill row (a text field's background) would just be clutter; hide it */
  STYLE_MENU.querySelector(".sm-fill-row").style.display = (isText && !isDatetime) ? "" : "none";
  STYLE_MENU.querySelector(".sm-fill-dark-row").style.display = (isText && !isDatetime) ? "" : "none";
  STYLE_MENU.querySelector(".sm-fill-toggle-row").style.display = (isText && !isDatetime) ? "" : "none";
  STYLE_MENU.querySelector(".sm-tint-row").style.display = isImg ? "" : "none";
  STYLE_MENU.querySelector(".sm-shade-row").style.display = isImg ? "" : "none";
  /* rounding/border/shadow on the bare digits text make no more sense than
     on an icon, so hide the shape group for a datetime element too - and for
     the page, which has no edges to round or outline: a page background is
     propagated to the browser's canvas and painted over the whole window,
     body's own box (which is what a radius or a border would follow) isn't
     what a visitor ever sees. */
  var shapeDisplay = (isIcon || isDatetime || isPage) ? "none" : "";
  STYLE_MENU.querySelectorAll(".sm-shape-row").forEach(function (row) { row.style.display = shapeDisplay; });
  STYLE_MENU.querySelectorAll(".sm-dt-row").forEach(function (row) { row.style.display = isDatetime ? "" : "none"; });
  /* Flip/Rotate only make sense on a leaf shape a TA actually placed to look
     a certain way - an icon, an image/video, or a plain "Box" shape - never
     a structural container (card/section/nav/footer/button/countdown/...)
     that just happens to share the same "box" resize kind (elKind()) */
  var customData = customElementById(STYLE_MENU_ID);
  var isPlainBox = !!(customData && customData.kind === "box");
  var showTransform = isIcon || isImg || isPlainBox;
  STYLE_MENU.querySelectorAll(".sm-transform-row").forEach(function (row) { row.style.display = showTransform ? "" : "none"; });
  /* the reel spacing pair, on the panel and on its tiles alike - see
     primeStyleMenuReelRows() */
  var reelPanel = reelPanelOf(el);
  STYLE_MENU.querySelectorAll(".sm-reel-row").forEach(function (row) {
    row.style.display = reelPanel ? "" : "none";
  });
  if (reelPanel) primeStyleMenuReelRows(reelPanel);
  /* the flow containers' equivalent, on the container and on everything inside
     one alike - see flowAreaForEl() */
  var gapArea = flowAreaForEl(el);
  STYLE_MENU.querySelector(".sm-tile-gap-row").style.display = gapArea ? "" : "none";
  if (gapArea) primeStyleMenuTileGapRow(gapArea);

  var tintInput = STYLE_MENU.querySelector(".sm-tint");
  var shadeInput = STYLE_MENU.querySelector(".sm-shade");
  var shadeVal = STYLE_MENU.querySelector(".sm-shade-val");
  var radiusInput = STYLE_MENU.querySelector(".sm-radius");
  var radiusVal = STYLE_MENU.querySelector(".sm-radius-val");
  var shadowInput = STYLE_MENU.querySelector(".sm-shadow");
  var opacityInput = STYLE_MENU.querySelector(".sm-opacity");
  var opacityVal = STYLE_MENU.querySelector(".sm-opacity-val");

  if (showTransform) {
    STYLE_MENU.querySelector(".sm-flip-h").classList.toggle("active", el.dataset.flipH === "1");
    STYLE_MENU.querySelector(".sm-flip-v").classList.toggle("active", el.dataset.flipV === "1");
    var rot = parseInt(el.dataset.rotate, 10) || 0;
    STYLE_MENU.querySelector(".sm-rotate").value = rot;
    STYLE_MENU.querySelector(".sm-rotate-val").textContent = rot + "°";
    STYLE_ROTATE_BEFORE = String(rot);
  }

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

  if (!isIcon && !isDatetime && !isPage) {
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

/**
 * Fills the popover's two reel spacing rows from one reel's current state.
 * @param panel the .reel element the popover is acting on
 * @note Which slider is horizontal depends on which way the reel runs: the
 * gap is between tiles, so it follows the reel's axis, and the pad is the
 * clear space across the other one.
 * @note Split out from toggleStyleMenu() so undo/redo can refresh the sliders
 * while the popover is still open, as every other row's branch does.
 */
function primeStyleMenuReelRows(panel) {
  var d = customElementById(elId(panel));
  if (!d) return;
  var vertical = panel.classList.contains("reel--vertical");
  var gap = reelGap(d), pad = reelPad(d);
  STYLE_MENU.querySelector(".sm-reel-gap-label").textContent =
    (vertical ? "Vertical" : "Horizontal") + " spacing";
  STYLE_MENU.querySelector(".sm-reel-pad-label").textContent =
    (vertical ? "Horizontal" : "Vertical") + " spacing";
  STYLE_MENU.querySelector(".sm-reel-gap").value = gap;
  STYLE_MENU.querySelector(".sm-reel-gap-val").textContent = gap + "px";
  STYLE_MENU.querySelector(".sm-reel-pad").value = pad;
  STYLE_MENU.querySelector(".sm-reel-pad-val").textContent = pad + "px";
  STYLE_REEL_BEFORE = { gap: gap, pad: pad };
}

/**
 * Fills the popover's tile spacing slider from one flow container's current
 * gap. Split out for the same reason primeStyleMenuReelRows() is: undo/redo
 * has to refresh the slider while the popover is still open.
 * @param area the flow container the popover is acting on
 */
function primeStyleMenuTileGapRow(area) {
  var gap = areaFlowFor(elId(area)).gap;
  STYLE_MENU.querySelector(".sm-tile-gap").value = gap;
  STYLE_MENU.querySelector(".sm-tile-gap-val").textContent = gap + "px";
  STYLE_TILE_GAP_BEFORE = gap;
}

/** Closes the style popover, if open. */
function hideStyleMenu() {
  if (STYLE_MENU) STYLE_MENU.classList.remove("show");
  STYLE_MENU_ID = null;
  /* whatever was being held in its hover/press look for the Hover/Click rows
     goes back to normal, see previewElementState() */
  previewElementState(null, null);
}

/**
 * Snaps the ring onto its current element's rendered box, in document
 * coordinates - re-run on scroll and resize, since the sticky nav's document
 * position changes as the page scrolls. Also toggles .locked so the move
 * handle can dim itself for a locked element.
 */
/* how far inside the viewport edge the page's own ring sits (see
   positionRing()): flush against it, its border and its style button would be
   half-hidden behind the window edge and the scrollbar. */
var PAGE_RING_INSET = 2;

/**
 * Selects the page itself: the ring frames the viewport and its style button
 * opens onto the page's own colour rows.
 * @note This is what an empty-space click does, since on a page whose
 * background is editable there's no longer such a thing as clicking
 * "nothing" - and hiding it behind a right-click entry would leave the one
 * surface a ta most obviously wants to recolour the only one they can't click.
 * @note Falls back to plain deselection wherever the page isn't tagged: the
 * portal's object canvas has no page to recolour.
 */
function selectPage() {
  if (!elId(document.body)) { deselectAll(); return; }
  RING_EL = document.body;
  positionRing();
}

/* ---------------------------------------------------------------------------
   RESPONSIVE MODE

   The Responsive switch in the editor chrome (js/ta.js) puts the frame into a
   mode where an element can still be SELECTED but not moved, resized, styled,
   layered, deleted or typed into. Everything a click normally does to an
   element is suspended; the click's only job is to say which element the
   plane pane out in the portal is authoring bands for.

   A mode rather than a second editor, which is what this started as: the
   elements, the ring and the selection logic are all already here, and the
   only thing that genuinely differs is what a drag means. Splitting it into
   its own pane would have meant a second copy of all of that.

   The frame is deliberately obvious about being in it (see .rs-armed in
   css/style.css) - a ta whose drags silently stop working assumes the editor
   has broken, not that they flipped a switch two minutes ago.
   --------------------------------------------------------------------------- */

/* whether the Responsive switch is on. Frame-side view state only: never
   saved, and reset by any reload, exactly like the Navbar/Theme switches. */
var RESPONSIVE_MODE = false;

/* what reportSelectionToPortal() last told the portal, so it can skip the
   hops that would tell it the same thing again */
var RS_REPORTED_ID = undefined;
var RS_REPORTED_MODE = false;

/**
 * Enters or leaves responsive mode.
 * @param on true to suspend the editing affordances and author bands instead
 * @note Called from the portal chrome across the iframe boundary, the same
 * direct-call route toggleNavState()/toggleSnapping() use.
 */
function setResponsiveMode(on) {
  RESPONSIVE_MODE = !!on;
  document.body.classList.toggle("rs-armed", RESPONSIVE_MODE);
  /* any popover that edits the element has to go with the affordances that
     opened it - leaving a style popover up over a frame that won't accept
     style changes is worse than not offering it */
  hideCtxMenu();
  hideLayerMenu();
  if (window.hideStyleMenu) hideStyleMenu();
  /* the selection deliberately SURVIVES the flip in both directions: a ta
     clicks the element they want and then reaches for the switch at least as
     often as the other way round, and losing it would make the switch feel
     like it threw their work away */
  positionRing();
  reportSelectionToPortal();
}
window.setResponsiveMode = setResponsiveMode;

/**
 * Tells the portal chrome which element is selected, so the plane pane can
 * follow the frame's own selection instead of keeping a second one.
 * @note Guarded on every hop: this file also runs on the live site, where
 * there's no parent frame at all, and cross-origin access would throw.
 */
function reportSelectionToPortal() {
  var id = RING_EL ? elId(RING_EL) : null;
  /* positionRing() also runs on every scroll and resize event, and the pane
     out in the portal rebuilds its whole plane on each of these - so only
     the hops that actually change the answer are worth making */
  if (id === RS_REPORTED_ID && RESPONSIVE_MODE === RS_REPORTED_MODE) return;
  RS_REPORTED_ID = id;
  RS_REPORTED_MODE = RESPONSIVE_MODE;
  try {
    if (window.parent && window.parent !== window && window.parent.onFrameSelectionChanged) {
      window.parent.onFrameSelectionChanged(id, RESPONSIVE_MODE);
    }
  } catch (e) {}
}

/**
 * Whether an editing gesture should be refused because the frame is in
 * responsive mode.
 * @param e an optional event to swallow
 * @return true if the caller should return without doing anything
 */
function responsiveModeBlocks(e) {
  if (!RESPONSIVE_MODE) return false;
  if (e) { e.preventDefault(); e.stopPropagation(); }
  return true;
}

/** Drops the selection entirely - no ring, nothing queued for grouping. */
function deselectAll() {
  RING_EL = null;
  if (RING) RING.style.display = "none";
  /* with the selection gone, so is any preview that only existed for it, see
     syncProgressPreview() */
  syncProgressPreview();
  if (SELECTED_IDS.length) clearSelection();
}

function positionRing() {
  /* the selection may have just changed (this runs on every path that changes
     it, including the ones that clear it), and an empty progress bar shows a
     preview fill only while it's the selected element - see
     syncProgressPreview(), which no-ops unless the selection really moved */
  syncProgressPreview();
  if (!RING || !RING_EL) return;
  var page = isPageEl(RING_EL);
  /* the page is framed by the VIEWPORT, not by its own box: body's rect is
     the whole scrolling document, so a ring around it would put its corners
     and its style button thousands of pixels off-screen on a long page, with
     the ta's own click nowhere near either of them. Held in document
     coordinates like every other ring (the ring is absolutely positioned) and
     recomputed on scroll, which positionRing() is already wired to. */
  var r = page
    ? { left: PAGE_RING_INSET, top: PAGE_RING_INSET,
        width: document.documentElement.clientWidth - PAGE_RING_INSET * 2,
        height: document.documentElement.clientHeight - PAGE_RING_INSET * 2 }
    : RING_EL.getBoundingClientRect();
  RING.classList.toggle("page-ring", page);
  RING.style.display = "";
  RING.style.left = (r.left + window.scrollX) + "px";
  RING.style.top = (r.top + window.scrollY) + "px";
  RING.style.width = r.width + "px";
  RING.style.height = r.height + "px";
  RING.classList.toggle("locked", isLocked(elId(RING_EL)));
  /* deliberately NOT "reel-tile": that's a real content class (css/style.css
     gives it the tile's own surface background, border and rounding), and
     putting it on the ring painted an opaque panel straight over whatever
     tile was selected - the icon, title and body of the tile a ta had just
     clicked simply vanished until they clicked something else. */
  RING.classList.toggle("ring-reel-tile", isReelTileEl(RING_EL));
  /* the download/open button and the attachment/day icons stay forever (see
     deleteElement()'s data-extras-fixed/data-days-fixed guard), so the trash
     handle is hidden on them rather than left as a button that silently does
     nothing - everything else about them is still fully editable */
  RING.classList.toggle("undeletable",
    RING_EL.hasAttribute("data-extras-fixed") || RING_EL.hasAttribute("data-days-fixed"));
  /* a tile resizes but never moves, see isMoveLockedTileRole() */
  RING.classList.toggle("tile-box", isTileBoxEl(RING_EL));
  /* on an element barely bigger than the handles themselves, the inset row of
     them covers the whole middle of it and every later press lands on a handle
     rather than on the element - which is what made a second drag on a small
     seated element do nothing at all. The css moves them outside the ring at
     this size; the thresholds are the handle row's own footprint (a 17px button
     inset by 3, top and bottom) with a few px left over to actually grab. */
  RING.classList.toggle("ring-tiny", !page && (r.height < 56 || r.width < 72));
  /* strips the ring down to a plain outline in responsive mode: every handle
     on it edits something the mode has suspended, and a handle that silently
     refuses to drag is worse than no handle */
  RING.classList.toggle("rs-mode", RESPONSIVE_MODE);
  reportSelectionToPortal();
  var parent = parentSelectableOf(RING_EL);
  RING.classList.toggle("has-parent", !!parent);
  /* an up arrow on a reel tile reads as "move this tile up the running order",
     which is emphatically not what it does - it selects the reel around the
     tile. Naming the actual container it jumps to is the difference between a
     button whose tooltip explains it and one a ta clicks and sees nothing
     happen. */
  if (PARENT_BTN && parent) {
    PARENT_BTN.title = isPageEl(parent)
      ? "Select the page itself (its background colour)"
      : parent.classList.contains("reel")
        ? "Select the whole reel (drag the tile itself to reorder it)"
        : "Select the container around this";
  }
}

/**
 * Keeps the ring on its element for as long as that element is still moving,
 * for a drop that ends in a css transition rather than instantly.
 * @param el the element whose rect is still settling
 * @note `.reel-tile` carries `transition: transform .32s` (css/style.css), and
 * a reorder drag ends by clearing the inline translate that had been tracking
 * the cursor - so the tile EASES into its new slot over the next third of a
 * second. positionRing() read the rect it had on the frame the drag ended,
 * which is the rect from BEFORE any of that: the ring was left behind a whole
 * slot away from the tile it belongs to, and stayed there until the next
 * click moved it.
 * @note Watches the rect rather than listening for transitionend: the tile is
 * not the only thing that settles - the track relays out around it and the
 * editor's own scroll can shift - and a drop back into the slot it came from
 * transitions nothing at all, so there would be no event to end on. The
 * deadline is what ends it either way.
 * @note Repositions only on a frame where the rect actually changed, so a
 * settled element costs one rect read per frame and nothing else.
 */
function trackRingUntilSettled(el) {
  if (!el) return;
  var deadline = Date.now() + 600;
  var last = "";
  (function step() {
    /* the ring may have moved on to something else entirely mid-flight (the
       drop is over, so nothing stops the ta clicking elsewhere), and a tile
       can be deleted or re-rendered out from under this */
    if (!RING_EL || !el.isConnected || (RING_EL !== el && !el.contains(RING_EL))) return;
    var r = RING_EL.getBoundingClientRect();
    var now = r.left + "," + r.top + "," + r.width + "," + r.height;
    if (now !== last) { positionRing(); last = now; }
    if (Date.now() < deadline) requestAnimationFrame(step);
  })();
}

/**
 * The tracked element enclosing el - the one the ring's "select the container
 * around this" handle jumps to.
 * @param el the currently selected element
 * @return the enclosing tracked element, or null
 * @note Walks the same path ancestorPos() does, and skips a theme toggle's
 * label for the same reason: it isn't an independent element.
 * @note Exists because the live areas are the one place a tracked element can
 * be unreachable by clicking - a tile is covered edge to edge by its own
 * rect, and a container by its tiles. This is the way out, and the only way
 * to select a tile at all in order to resize it.
 */
function parentSelectableOf(el) {
  if (!el || isThemeToggleLabel(el) || isPageEl(el)) return null;
  var p = el.parentElement;
  while (p) {
    if (p.matches && p.matches(RESIZABLE_SEL)) return p;
    p = p.parentElement;
  }
  /* the page is the last stop, past the outermost tracked container. Named
     here rather than found by the walk because it deliberately isn't a
     RESIZABLE_SEL match. This is the main way to reach it: a full-bleed
     section covers nearly every pixel, so "click an empty spot" rarely works. */
  if (document.body && isPageEl(document.body)) return document.body;
  return null;
}

/**
 * Freezes every tracked element inside el at its exact on-screen spot, right
 * before el itself is resized.
 * @param el the element about to be resized
 * @note Without this an untouched descendant is still governed by el's own
 * layout, so growing el would drag it along - breaking "no attachment between
 * elements" exactly as a leaked move would. Moving is already immune; resizing
 * needs the same guarantee.
 * @note Each one is pinned to its nearest positioned ancestor, so a doubly
 * nested element lands relative to the closest thing that makes sense.
 * @note Two passes: read every wrap's rect FIRST, then write the pins, so
 * pinning one descendant can't shift a not-yet-pinned sibling before it gets
 * measured. A no-op past the first resize.
 * @note Skips a glued child - pinning a theme toggle's label would freeze it
 * instead of letting it reflow inside the button, and pinning a failure
 * line's message would stop the text rewrapping as the line is dragged
 * narrower, which is the whole point of resizing a line of text.
 */
function freezeDescendants(el) {
  /* a live area is the one container whose contents are MEANT to move when it
     resizes: the point of dragging its width is that the tile grid reflows to
     it. Pinning each tile's pieces to a fixed offset - the opposite guarantee
     every other container wants - froze them at their old spots while the
     tiles reflowed out from under them. */
  if (isLiveAreaEl(el)) return;
  /* a reel is the same shape of container, one step more literal: resizing
     the panel resizes the VIEWPORT its tiles drift through, and they're
     supposed to keep flowing behind it. Pinning them detached every tile from
     the flex track and left the reel visually empty the moment a handle was
     grabbed - the tiles were still there, absolutely positioned at their
     pre-drag spots inside a track that had collapsed around them. */
  if (el.classList && el.classList.contains("reel")) return;
  var wraps = [];
  el.querySelectorAll(RESIZABLE_SEL).forEach(function (d) {
    if (isGluedChild(d)) return;
    /* same reasoning one level down, for the case where the element being
       resized is something a reel happens to sit inside */
    if (isReelTileEl(d) || (d.closest && d.closest(".reel-track"))) return;
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

/* ---------------------------------------------------------------------------
   SNAPPING (SMART GUIDES)

   Canva's kind of snapping: while something is dragged, its edges and centre
   are pulled onto the edges and centres of the OTHER elements around it, and
   a pink line is drawn through whatever it lined up with, so the ta can see
   WHY it stuck.

   This used to round every drag to a fixed 8px grid, which sounds like the
   same feature and isn't: a grid only lines two things up when both already
   sit on it, and on a page of flowing text, flex rows and a self-tiling grid,
   almost nothing does. Lining a caption up under a photo means flush with
   THAT photo's edge.

   The lines a drag can stick to, per axis, are each nearby element's two
   edges and centre, plus the same three for the box the dragged element lives
   in - that last one is what gives "centred in its container". Nearby means
   "currently on screen": a line through something invisible reads as the drag
   sticking for no reason. Everything is measured once at mousedown and held
   in document coordinates, so a drag that scrolls doesn't drag its targets.

   Toggled with SHIFT+R (Canva's own rulers shortcut). Editor-only and stored
   in localStorage rather than in content: it changes how a drag BEHAVES, not
   what the page is. That key is also how the portal chrome and this code
   inside the iframe stay in agreement, and what survives Apply/Save reloads.

   Two things deliberately DON'T snap: the arrow-key nudge (1px a press, the
   precise escape hatch) and a reel tile's drag (it reorders a strip and has
   no free position to snap).
   --------------------------------------------------------------------------- */

/* how close (css px) a moving edge has to come before it's pulled in. About
   Canva's: wide enough to catch a hand-held drag, tight enough that a ta who
   means to sit a few px off an edge still can. */
var SNAP_TOL = 6;
/* two lines count as "the same line" for drawing purposes below this. Not the
   same figure as the tolerance above: that decides what a drag sticks TO,
   this only decides what already-aligned means once it has stuck, and it's
   sub-pixel purely to absorb rounding in the rects. */
var SNAP_HIT = 0.75;
/* still the old key: it's a private editor setting, and a ta who had snapping
   on shouldn't have it silently turn itself off because the feature behind it
   grew up. js/ta.js names the same string. */
var SNAP_KEY = "editor_grid_snap";
/* the drag in progress, all null between drags: what's being dragged, the
   lines it can stick to (document coordinates, measured once at mousedown),
   and the overlay the guides are drawn into. */
var SNAP_EL = null;
var SNAP_TARGETS = null;
var SNAP_LAYER = null;

/** @return true if drags should currently snap */
function snapOn() {
  try { return localStorage.getItem(SNAP_KEY) === "1"; } catch (e) { return false; }
}

/**
 * Turns snapping on or off, says which it now is (the setting has no visible
 * effect until the next drag, so the toast is the only confirmation there
 * is), and re-syncs the portal's Snap switch if this page is in the iframe.
 * @param on true to snap
 */
function setSnapping(on) {
  try { localStorage.setItem(SNAP_KEY, on ? "1" : "0"); } catch (e) {}
  if (!on) endSnapDrag();
  showEditToast(on ? "Snapping on · edges and centres · Shift+R" : "Snapping off · Shift+R");
  /* the switch in the portal chrome reads the same key, but nothing tells it
     the key changed - a shortcut pressed in here is exactly that case */
  try {
    if (window.parent !== window && window.parent.syncSnapSwitch) window.parent.syncSnapSwitch();
  } catch (e) {}
}

/** Flips snapping, from the Shift+R shortcut or the portal's Snap switch. */
function toggleSnapping() { setSnapping(!snapOn()); }

/**
 * One box's six snappable lines - both edges and the centre on each axis - in
 * DOCUMENT coordinates.
 * @param r a getBoundingClientRect()
 * @return {x1, xc, x2, y1, yc, y2}
 * @note Document rather than viewport coordinates, so a drag that scrolls
 * doesn't drag its own targets along and two elements "in the same place"
 * really are.
 */
function snapLinesOf(r) {
  var x = r.left + window.scrollX, y = r.top + window.scrollY;
  return {
    x1: x, xc: x + r.width / 2, x2: x + r.width,
    y1: y, yc: y + r.height / 2, y2: y + r.height
  };
}

/**
 * The box a dragged element is placed WITHIN, whose edges and centre it can
 * also line up against.
 * @param el the element being dragged
 * @return the framing element, or null
 * @note The tile or live area that already bounds its drag if there is one,
 * so the guides agree with the clamp rather than fighting it; otherwise the
 * nearest tracked ancestor, and failing that the page's own column.
 */
function snapFrameFor(el) {
  if (!el || !el.closest) return null;
  return moveBoundsContainer(el) ||
    (el.parentElement && el.parentElement.closest(RESIZABLE_SEL)) ||
    document.querySelector("main") ||
    document.body;
}

/**
 * Starts a snapping drag: measures everything the element could line up with,
 * once, here.
 * @param el the element being dragged or resized
 * @param skipEls other elements moving with it, or null
 * @note Cheap at mousedown and far too expensive per mousemove - which is the
 * other reason the targets are held in document coordinates: they stay true
 * for the whole drag without re-measuring.
 * @note Ancestors and descendants are left out, since an element can't line
 * up with something it contains or sits inside, and so are the other members
 * of a rigid group, which travel with it rather than standing still.
 */
function beginSnapDrag(el, skipEls) {
  SNAP_EL = el;
  SNAP_TARGETS = [];
  if (!snapOn() || !el) return;
  var skip = skipEls || [];
  var vw = window.innerWidth, vh = window.innerHeight;
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (t) {
    if (t === el || t.contains(el) || el.contains(t)) return;
    if (skip.indexOf(t) !== -1) return;
    var r = t.getBoundingClientRect();
    /* nothing laid out (a hidden tab's contents), or off screen */
    if (r.width < 2 || r.height < 2) return;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
    SNAP_TARGETS.push(snapLinesOf(r));
  });
  var frame = snapFrameFor(el);
  if (frame && frame !== el) SNAP_TARGETS.push(snapLinesOf(frame.getBoundingClientRect()));
}

/** Ends a snapping drag and takes the guides down with it. */
function endSnapDrag() {
  SNAP_EL = null;
  SNAP_TARGETS = null;
  clearSnapGuides();
}

/**
 * The pull on one axis: given where the moving lines would land unsnapped,
 * the nudge putting the closest of them onto the closest target line.
 * @param positions the moving lines' document coordinates on this axis
 * @param axis "x" or "y"
 * @return the correction to add to the drag delta
 * @note Zero when nothing is within tolerance, which is also what an
 * unsnapped drag gets, so callers need no branch of their own.
 */
function snapPull(positions, axis) {
  if (!SNAP_TARGETS || !SNAP_TARGETS.length) return 0;
  var keys = axis === "x" ? ["x1", "xc", "x2"] : ["y1", "yc", "y2"];
  var pull = 0, near = SNAP_TOL;
  SNAP_TARGETS.forEach(function (t) {
    keys.forEach(function (k) {
      positions.forEach(function (p) {
        var d = t[k] - p, a = Math.abs(d);
        /* <= so an exact 6px tie still catches, and strictly < near so the
           first of two equally close lines wins rather than the last */
        if (a <= SNAP_TOL && a < near) { near = a; pull = d; }
      });
    });
  });
  return pull;
}

/**
 * Snaps a move drag: takes the element's lines as they were at mousedown and
 * the raw pointer delta, and gives back the delta to actually apply.
 * @param lines snapLinesOf(the element's rect at mousedown)
 * @param dx the raw pointer delta, x
 * @param dy the raw pointer delta, y
 * @return {dx, dy} the deltas to apply
 * @note Each axis is pulled independently, so an element can be flush with
 * one thing horizontally and another vertically at once.
 * @note Applied before the container clamp, never after, so an element
 * dragged against a tile's edge still grinds along it rather than sticking
 * short. The clamp gets the last word, which is why the guides are painted
 * from what actually landed rather than what was proposed here.
 */
function snapMoveDelta(lines, dx, dy) {
  if (!SNAP_TARGETS || !SNAP_TARGETS.length) return { dx: dx, dy: dy };
  return {
    dx: dx + snapPull([lines.x1 + dx, lines.xc + dx, lines.x2 + dx], "x"),
    dy: dy + snapPull([lines.y1 + dy, lines.yc + dy, lines.y2 + dy], "y")
  };
}

/**
 * Snaps a resize drag: the same pull, but only ONE line moves - the edge the
 * grabbed handle pulls.
 * @param axis "x" or "y"
 * @param edge that edge's document coordinate at mousedown
 * @param d the raw pointer delta on this axis
 * @return the delta to apply
 * @note Snapped per edge rather than per size, since rounding the width would
 * only line the box up when the edge it's pinned to already was.
 */
function snapEdgeDelta(axis, edge, d) {
  if (!SNAP_TARGETS || !SNAP_TARGETS.length) return d;
  return d + snapPull([edge + d], axis);
}

/**
 * Draws a guide through every line the dragged element is currently flush
 * with, and nothing when it's flush with nothing.
 * @note Measured from where the element actually IS, not from what the snap
 * proposed: the container clamp can overrule a pull, and a guide through a
 * line the element didn't reach would be a lie about why it stopped.
 * @note Each guide runs the full extent of the two boxes it joins, so it
 * reads as "these two edges are the same edge" rather than a floating ruler
 * mark.
 */
function paintSnapGuides() {
  if (!SNAP_EL || !SNAP_TARGETS || !SNAP_TARGETS.length) { clearSnapGuides(); return; }
  var m = snapLinesOf(SNAP_EL.getBoundingClientRect());
  /* keyed by axis+position so three things sharing one edge draw one line
     spanning all of them, not three stacked on the same pixel */
  var found = {};
  [["x", ["x1", "xc", "x2"], ["y1", "y2"]], ["y", ["y1", "yc", "y2"], ["x1", "x2"]]]
    .forEach(function (spec) {
      var axis = spec[0], keys = spec[1], span = spec[2];
      SNAP_TARGETS.forEach(function (t) {
        keys.forEach(function (tk) {
          keys.forEach(function (mk) {
            if (Math.abs(t[tk] - m[mk]) > SNAP_HIT) return;
            var at = t[tk];
            var key = axis + Math.round(at);
            var from = Math.min(t[span[0]], m[span[0]]);
            var to = Math.max(t[span[1]], m[span[1]]);
            if (!found[key]) found[key] = { axis: axis, at: at, from: from, to: to };
            else {
              found[key].from = Math.min(found[key].from, from);
              found[key].to = Math.max(found[key].to, to);
            }
          });
        });
      });
    });
  drawSnapGuides(Object.keys(found).map(function (k) { return found[k]; }));
}

/**
 * Puts the guide lines on screen.
 * @param lines [{axis, at, from, to}] in document coordinates
 * @note The overlay is fixed to the viewport (a document-sized layer would
 * need re-measuring whenever anything changed height) while the lines are in
 * document coordinates, so each is converted by the current scroll as it's
 * drawn - which is also why a scroll mid-drag simply repaints.
 */
function drawSnapGuides(lines) {
  if (!lines.length) { clearSnapGuides(); return; }
  if (!SNAP_LAYER) {
    SNAP_LAYER = document.createElement("div");
    SNAP_LAYER.className = "snap-guides";
    document.body.appendChild(SNAP_LAYER);
  }
  SNAP_LAYER.innerHTML = "";
  lines.forEach(function (l) {
    var d = document.createElement("div");
    d.className = "snap-guide snap-" + l.axis;
    if (l.axis === "x") {
      d.style.left = (l.at - window.scrollX) + "px";
      d.style.top = (l.from - window.scrollY) + "px";
      d.style.height = Math.max(1, l.to - l.from) + "px";
    } else {
      d.style.top = (l.at - window.scrollY) + "px";
      d.style.left = (l.from - window.scrollX) + "px";
      d.style.width = Math.max(1, l.to - l.from) + "px";
    }
    SNAP_LAYER.appendChild(d);
  });
  SNAP_LAYER.classList.add("show");
}

/** Takes every guide down, leaving the (empty) overlay in place for reuse. */
function clearSnapGuides() {
  if (!SNAP_LAYER) return;
  SNAP_LAYER.innerHTML = "";
  SNAP_LAYER.classList.remove("show");
}

/**
 * One resize drag from whichever of the 8 handles was grabbed. A real
 * width/height change, so text reflows inside its box at its own size instead
 * of stretching.
 * @param e the handle's mousedown
 * @note Dragging a left/top handle keeps the opposite edge pinned by sliding
 * the element's own move offset while the box changes.
 * @note HOLDING SHIFT locks the box's proportions for anything at all,
 * including a tile (which locks by re-tiling its container to a proportional
 * track). An icon is locked with or without shift, since a squashed glyph is
 * never what anyone means; an image is free by default but keeps object-fit:
 * cover either way, so shift there steadies the crop rather than the pixels.
 */
function startResizeDrag(e) {
  /* the ring's handles are hidden in responsive mode (see .rs-armed in
     css/style.css), so this is the same defense in depth every other gate
     here is - a keyboard-driven or synthetic mousedown can still arrive */
  if (responsiveModeBlocks(e)) return;
  if (!RING_EL || isPageEl(RING_EL)) return;
  /* a reel tile's handles resize every tile in the reel at once, through the
     reel's own entry rather than through a size override of its own, so it
     takes its own drag entirely - see startReelTileResize() */
  if (isReelTileEl(RING_EL)) { startReelTileResize(e, RING_EL); return; }
  /* nothing else can be size-locked any more (see isResizeLockedTileRole()),
     so this is defense in depth, not the real gate */
  if (isResizeLockedTileRole(RING_EL)) return;
  e.preventDefault();
  e.stopPropagation();
  var el = RING_EL;
  var dir = RING_DIRS[e.target.getAttribute("data-dir")];
  var kind = elKind(el);
  /* a tile resizes by re-tiling its container, not by taking a box of its
     own, so it must stay exactly where the grid put it: detaching would take
     it out of that grid, and pinning its descendants would freeze them at
     their old spots while the tile changed shape underneath. A flow container
     skips freezeDescendants() for the reason it always has. */
  var tileBox = isTileBoxEl(el);
  /* a tile drag can take its container's saved height with it (see
     growFlowAreaForTiles()), and that grow-only path is not its own inverse -
     so the container's record is grabbed here, before the first mousemove
     touches it, and rides along on the history entry */
  var tileArea = tileBox ? flowAreaOf(el) : null;
  var areaId = tileArea ? elId(tileArea) : null;
  var areaBefore = areaId ? EDIT_SIZES[areaId] : null;
  var minW = 0, cap = null;
  if (tileBox) {
    cap = tileSizeCap(el);
    minW = minContentWidthOf(el);
  } else {
    detachFromFlow(el);
    freezeDescendants(el);
    /* measured once, here, not per mousemove - it's a forced reflow */
    if (isFlowAreaEl(el)) minW = flowAreaMinWidth(el);
    /* a tile's own pieces stop at that tile's edge on a resize exactly as they
       do on a move, see resizeBoundsCap(). A flow container is deliberately
       exempt: making one bigger IS how a ta makes room for more tiles, and the
       box it grows inside is content-sized and grows with it. */
    else cap = resizeBoundsCap(el, dir);
  }
  var startX = e.clientX, startY = e.clientY;
  var start = getSize(el);
  var base = getPos(el);
  /* where the edges THIS handle pulls are right now, in document coordinates:
     what they're snapped against, when snapping is on (see snapEdgeDelta()).
     A handle that doesn't pull on an axis leaves that figure unused. */
  var startRect = el.getBoundingClientRect();
  var edgeX = (dir[0] === -1 ? startRect.left : startRect.right) + window.scrollX;
  var edgeY = (dir[1] === -1 ? startRect.top : startRect.bottom) + window.scrollY;
  beginSnapDrag(el, null);
  /* the last box a mousemove actually WROTE, which is how onUp tells the axes
     the ta pulled from the ones that merely moved: a container measures an
     unlocked axis live, and dragging one NARROWER reflows its tiles onto more
     rows, so its height changes on its own. Comparing measured heights would
     read that as a height drag and claim the axis. Stays null for a handle
     click with no drag at all. */
  var dragged = null;
  RING_DRAGGING = true;

  /**
   * Whether this moment of the drag should keep the box's proportions.
   * @param ev the mousemove
   * @return true to lock the aspect ratio
   * @note Read per mousemove, not once at mousedown, so shift can be pressed
   * or released mid-drag. A zero starting side has no ratio to keep, so it
   * falls back to a free drag rather than scaling by NaN.
   */
  function aspectLocked(ev) {
    return (kind === "icon" || ev.shiftKey) && start.w > 0 && start.h > 0;
  }

  function onMove(ev) {
    /* snapped per EDGE, not per size, see snapEdgeDelta() */
    var mx = snapEdgeDelta("x", edgeX, ev.clientX - startX);
    var my = snapEdgeDelta("y", edgeY, ev.clientY - startY);
    var w = dir[0] ? Math.max(16, start.w + dir[0] * mx) : start.w;
    var h = dir[1] ? Math.max(12, start.h + dir[1] * my) : start.h;
    /* shift forces the shape to hold on ANY element (an icon holds its shape
       with or without it, see this function's doc comment). Both clamps below
       are folded into the scale FACTOR rather than applied to w/h afterwards,
       since clamping one side of an already-proportional box would silently
       break the very proportion shift was held down to keep. */
    if (aspectLocked(ev)) {
      var f;
      if (dir[0] && dir[1]) {
        /* corner drag: follow whichever axis moved more */
        f = Math.abs(w / start.w - 1) > Math.abs(h / start.h - 1) ? w / start.w : h / start.h;
      } else {
        f = dir[0] ? w / start.w : h / start.h;
      }
      /* same two clamps as the free branch below, in the same order (so the
         cap still has the last word), just folded into the factor */
      if (minW) f = Math.max(f, minW / start.w);
      if (cap) f = Math.min(f, cap.w / start.w, cap.h / start.h);
      w = start.w * f;
      h = start.h * f;
    } else {
      /* the spec's "grinds against the edge" stop, applied to sizes: a
         container refuses to go narrower than its tiles can squeeze to, and a
         tile refuses to go wider/taller than the container holding it */
      if (minW) w = Math.max(w, minW);
      if (cap) { w = Math.min(w, cap.w); h = Math.min(h, cap.h); }
    }
    if (tileBox) {
      setTileTrackSize(el, w, h);
      positionRing();
      paintSnapGuides();
      return;
    }
    dragged = { w: w, h: h };
    if (isFlowAreaEl(el) && h === start.h) {
      /* a width drag on a container must leave its height alone rather than
         pin it to whatever it measured at mousedown: dragging one narrower
         reflows its tiles onto more rows, so growing taller IS correct, and a
         frozen height clips them for the rest of the drag. The height axis
         re-derives itself once the drag settles. */
      el.dataset.ovW = w;
      el.style.width = w + "px";
    } else setBox(el, w, h);
    /* pin the opposite edge on left/top drags */
    setOwnPos(el,
      base.tx + (dir[0] === -1 ? start.w - w : 0),
      base.ty + (dir[1] === -1 ? start.h - h : 0));
    positionRing();
    paintSnapGuides();
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    RING_DRAGGING = false;
    endSnapDrag();
    var s = getSize(el), p = getPos(el);
    commitSize(el);
    commitPosition(el);
    /* a container's new size changes what its tiles have to fit into, so
       re-run the layout once the drag settles - a tile drag already did this
       on every move. The axes just dragged are claimed before that pass, since
       which axes the container owns decides whether the size committed above
       is honoured or thrown straight back away. */
    if (isFlowAreaEl(el)) {
      if (dragged) lockDraggedFlowAxes(el, start, dragged);
      applyTileFlow();
    }
    /* a tile dragged taller than its container took the container down with it
       (see growFlowAreaForTiles()); that height is the container's own saved
       size now, so it gets persisted alongside the tile's */
    if (tileBox) growFlowAreaForTiles(el, true);
    pushResizeUndo(elId(el),
      { w: start.w, h: start.h, tx: base.tx, ty: base.ty },
      { w: s.w, h: s.h, tx: p.tx, ty: p.ty },
      areaId ? { id: areaId, before: areaBefore, after: EDIT_SIZES[areaId] } : null);
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/**
 * One move drag from the ring's move handle: a pure translate on the element
 * itself, any direction.
 * @param e the handle's mousedown
 * @note A translate is paint-only, so a block element's flow slot is
 * untouched - but a naturally inline element is exempt from transform by
 * spec, so it must be detached first: that forces a blockified, absolutely
 * positioned box whose old slot is held open by its frozen wrap. A no-op past
 * the first detach.
 * @note Locked elements don't start a drag at all, so a placed element can't
 * be accidentally nudged; the handle itself is also dimmed.
 */
function startMoveDrag(e) {
  if (responsiveModeBlocks(e)) return;
  /* the page has nothing to move relative to, and its handles are hidden
     anyway - this is the same defense in depth the resize path gets above,
     see isPageEl() */
  if (!RING_EL || isPageEl(RING_EL)) return;
  /* a reel tile CAN be moved, it just moves through the reel's own running
     order rather than to a free position of its own - the handle drags it
     along the strip and drops it between two other tiles, see
     startReelTileDrag(). Same drag a grab anywhere on the tile's background
     starts (see wireResizable()), so the handle and the tile itself behave
     identically. */
  if (isReelTileEl(RING_EL)) {
    e.preventDefault();
    e.stopPropagation();
    startReelTileDrag(e, RING_EL);
    return;
  }
  /* and a flow container's tile moves the same way, through its container's
     running order rather than to a free position, see startFlowTileDrag() */
  if (isTileBoxEl(RING_EL) && flowAreaOf(RING_EL) && !isLocked(elId(RING_EL))) {
    e.preventDefault();
    e.stopPropagation();
    startFlowTileDrag(e, RING_EL);
    return;
  }
  /* see isMoveLockedTileRole() */
  if (isLocked(elId(RING_EL)) || isMoveLockedTileRole(RING_EL)) return;
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
  /* out of its box first, if it's in one, so everything below is the plain
     free-element drag it has always been - see startBoxDrag() */
  var seatBefore = startBoxDrag(el);
  var elRect = el.getBoundingClientRect();
  groupMembers.forEach(function (m) { m.preRect = m.el.getBoundingClientRect(); });
  detachFromFlow(el, elRect);
  var base = getPos(el);
  groupMembers.forEach(function (m) { detachFromFlow(m.el, m.preRect); });
  /* snapping follows the edges of the element actually being dragged; every
     other member of its group then moves by that same snapped delta, so the
     group still travels as one rigid unit rather than each piece sticking to
     its own nearest line (see groupMembersFor()). Its members are also left
     out of the targets, since they're moving too. */
  var snapFrom = snapLinesOf(elRect);
  beginSnapDrag(el, groupMembers.map(function (m) { return m.el; }));

  function onMove(ev) {
    var s = snapMoveDelta(snapFrom, ev.clientX - startX, ev.clientY - startY);
    var dx = s.dx, dy = s.dy;
    /* inside a tile/live area the drag stops dead at the container's edge
       and grinds along it rather than escaping, see clampOwnPos() */
    var c = clampOwnPos(el, base.tx + dx, base.ty + dy);
    setOwnPos(el, c.tx, c.ty);
    groupMembers.forEach(function (m) {
      var mc = clampOwnPos(m.el, m.base.tx + dx, m.base.ty + dy);
      setOwnPos(m.el, mc.tx, mc.ty);
    });
    positionRing();
    paintSnapGuides();
    trackBoxDrop(el, ev);
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    RING_DRAGGING = false;
    endSnapDrag();
    /* a seated element has no free position of its own to record, so the seat
       entry below replaces the move entry rather than joining it */
    if (finishBoxDrop(el, seatBefore)) { positionRing(); return; }
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

/**
 * One reel tile's drag: grab it anywhere on its background and carry it to a
 * different place in the strip.
 * @param e the mousedown that started it
 * @param tile the .reel-tile being dragged
 * @note A tile can't be given a free position - it lives in the reel's flex
 * track, and where it sits IS its index - so the drag reorders instead: the
 * moment its centre passes a neighbour's, the two swap for real in the dom,
 * so the strip rearranges live rather than settling only on drop.
 * @note The translate is re-derived against the tile's CURRENT slot on every
 * move, not accumulated from the start: a swap moves the slot out from under
 * it, and an offset measured against where it used to be would jump by a
 * whole tile width each time.
 */
function startReelTileDrag(e, tile) {
  var panel = reelPanelOf(tile);
  var track = tile.parentElement;
  if (!panel || !track) return;
  var vertical = panel.classList.contains("reel--vertical");
  var axis = vertical ? "Y" : "X";
  var startX = e.clientX, startY = e.clientY;
  var before = reelTileOrder(panel);
  var moving = false;
  var grab = 0; /* pointer's offset into the tile at grab time, along the axis */

  /** @return el's leading edge along the reel's axis, in viewport px. */
  function lead(el) {
    var r = el.getBoundingClientRect();
    return vertical ? r.top : r.left;
  }
  /** @return el's length along the reel's axis. */
  function span(el) {
    var r = el.getBoundingClientRect();
    return vertical ? r.height : r.width;
  }

  function onMove(ev) {
    if (!moving) {
      if (Math.abs(ev.clientX - startX) < 5 && Math.abs(ev.clientY - startY) < 5) return;
      moving = true;
      RING_DRAGGING = true;
      document.body.style.userSelect = "none";
      /* kills .reel-tile's own transform transition for the duration, so the
         tile tracks the pointer instead of easing after it */
      tile.classList.add("reel-dragging");
      grab = (vertical ? startY : startX) - lead(tile);
    }
    ev.preventDefault();
    var want = (vertical ? ev.clientY : ev.clientX) - grab;
    tile.style.transform = "";
    tile.style.transform = "translate" + axis + "(" + (want - lead(tile)) + "px)";

    /* the first tile whose middle the dragged one has passed: that's the slot
       it should take, and inserting BEFORE it is what takes it (null = past
       every other tile, ie the end of the strip) */
    var centre = want + span(tile) / 2;
    var target = null;
    Array.prototype.forEach.call(track.children, function (other) {
      if (other === tile || target) return;
      var r = other.getBoundingClientRect();
      if (centre < (vertical ? r.top + r.height / 2 : r.left + r.width / 2)) target = other;
    });
    if (target !== tile.nextElementSibling) {
      track.insertBefore(tile, target);
      /* the slot moved, so the offset that keeps the tile under the cursor
         has to be measured again against the new one */
      tile.style.transform = "";
      tile.style.transform = "translate" + axis + "(" + (want - lead(tile)) + "px)";
    }
    positionRing();
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    if (!moving) return; /* a plain click: leave the selection it already made */
    RING_DRAGGING = false;
    document.body.style.userSelect = "";
    /* the click the browser fires next must not open a text edit, same as
       every other drag, see wireResizable() */
    JUST_DRAGGED = true;
    setTimeout(function () { JUST_DRAGGED = false; }, 0);
    tile.classList.remove("reel-dragging");
    tile.style.transform = "";
    positionRing();
    /* taking .reel-dragging back off restores the tile's transform
       transition, so clearing the translate above starts a .32s ease into its
       new slot rather than putting it there - the ring has to follow it in */
    trackRingUntilSettled(tile);
    var after = reelTileOrder(panel);
    if (after.join(",") === before.join(",")) return;
    saveReelOrder(panel, after);
    EDIT_UNDO.push({ type: "reelOrder", id: elId(panel), before: before, after: after });
    EDIT_REDO.length = 0;
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/**
 * One reel tile's resize drag, from any of the ring's 8 handles. Every tile
 * in the reel follows the one being dragged, so this writes the reel's single
 * shared tile size rather than an override for the selected tile.
 * @param e the handle's mousedown
 * @param tile the .reel-tile being resized
 * @note No detach, no descendant freezing and no opposite-edge pinning: the
 * tiles stay in their track and the track re-lays them out at the new size,
 * which is exactly what "the rest mirror it" looks like.
 * @note Whatever a ta bound onto a tile keeps its own position inside it, so
 * growing a tile reveals more room around its contents rather than dragging
 * them along.
 */
function startReelTileResize(e, tile) {
  var panel = reelPanelOf(tile);
  if (!panel) return;
  e.preventDefault();
  e.stopPropagation();
  var dir = RING_DIRS[e.target.getAttribute("data-dir")];
  var startX = e.clientX, startY = e.clientY;
  var r = tile.getBoundingClientRect();
  var start = { w: r.width, h: r.height };
  var last = { w: start.w, h: start.h };
  RING_DRAGGING = true;

  function onMove(ev) {
    var w = dir[0] ? Math.max(40, start.w + dir[0] * (ev.clientX - startX)) : start.w;
    var h = dir[1] ? Math.max(40, start.h + dir[1] * (ev.clientY - startY)) : start.h;
    /* same shift-to-keep-the-shape the generic resize offers, see
       startResizeDrag()'s aspectLocked() */
    if (ev.shiftKey && start.w > 0 && start.h > 0) {
      var f;
      if (dir[0] && dir[1]) {
        f = Math.abs(w / start.w - 1) > Math.abs(h / start.h - 1) ? w / start.w : h / start.h;
      } else {
        f = dir[0] ? w / start.w : h / start.h;
      }
      w = start.w * f;
      h = start.h * f;
    }
    last = { w: Math.round(w), h: Math.round(h) };
    applyReelTileSize(panel, last.w, last.h);
    positionRing();
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    RING_DRAGGING = false;
    var beforeSize = { w: Math.round(start.w), h: Math.round(start.h) };
    if (last.w === beforeSize.w && last.h === beforeSize.h) return;
    setReelTileSize(panel, last.w, last.h);
    EDIT_UNDO.push({ type: "reelTileSize", id: elId(panel), before: beforeSize, after: last });
    EDIT_REDO.length = 0;
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
  /* a reel tile has no size of its own to restore - its box comes from the
     reel's shared tileW/tileH (see setReelTileSize()), and writing a null
     into content.sizes under a tile's id would be storing a fact about a
     thing that never had one */
  if (isReelTileEl(el)) return;
  var before = getSize(el);
  var pos = getPos(el);
  /* a tile's size isn't resetBox()'s to restore either, and for the same reason
     applyResizeSide() has its own branch for one: the size lives on the
     container's tracks (see setTileTrackSize()), so clearing it is a re-tile.
     resetBox() would instead pin the template default onto this one grid item -
     as a hard inline width, inside tracks still sized by the resize being reset
     away from - and leave every sibling tile at the old size. */
  if (isTileBoxEl(el)) {
    var tileId = elId(el);
    document.querySelectorAll('[data-resize-id="' + tileId + '"], [data-edit-id="' + tileId + '"]')
      .forEach(function (t) { delete t.dataset.ovW; delete t.dataset.ovH; });
    saveEditedSize(tileId, null);
    applyTileFlow();
    var reset = getSize(el);
    pushResizeUndo(tileId, { w: before.w, h: before.h, tx: pos.tx, ty: pos.ty },
      { w: reset.w, h: reset.h, tx: pos.tx, ty: pos.ty });
    positionRing();
    return;
  }
  resetBox(el);
  saveEditedSize(elId(el), null);
  /* a flow container's box isn't resetBox()'s to restore: its height is
     whatever its axis locks work out to (a live area is never seeded with a
     natH at all, see buildCustomElement()'s isAutoHeightArea branch, so the
     line above just wrote an invalid "NaNpx" the browser drops - leaving the
     inline height from the resize being reset still sitting there). Re-running
     the layout is what actually clears it, now that the saved size is gone. */
  if (isFlowAreaEl(el)) applyTileFlow();
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
  /* same as resetSizeDbl(): a reel tile's place in the strip is its running
     order, not a position override there'd be anything to clear */
  if (isReelTileEl(el)) return;
  var before = getPos(el);
  setOwnPos(el, 0, 0);
  saveEditedPosition(elId(el), null, null);
  pushMoveUndo(elId(el), before, { tx: 0, ty: 0 });
  positionRing();
}

/**
 * Hides (or restores) every element sharing one id and persists it.
 * @param id the element's data-edit-id or data-resize-id
 * @param hidden true to hide/delete it, false to restore it
 * @note Same "an id is one logical thing, not one DOM node" rule text edits
 * follow: deleting the brand wordmark takes it out of the nav and the footer
 * together, not just whichever copy was clicked.
 * @note The actual hide/show is setHiddenVisual()'s job; this applies it to
 * every match and persists the change.
 */
function setElementHidden(id, hidden) {
  if (hidden) HIDDEN_IDS[id] = true; else delete HIDDEN_IDS[id];
  document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
    setHiddenVisual(el, hidden);
  });
  saveEditedVisibility(id, hidden);
}

/**
 * Deletes the currently-selected element (the ring's trash handle, or the
 * Delete key), and it really is deleted.
 * @param el the element to delete (always the current RING_EL)
 * @note A wrapper around other tracked elements is handled differently by
 * setHiddenVisual(), so it can't take them down with it.
 * @note Pushed onto the same undo stack as a text edit, so Ctrl+Z brings it
 * right back.
 */
function deleteElement(el) {
  /* responsive mode can't delete anything - same defense in depth as the
     drag paths, since both routes in here (the ring's trash handle, the
     Delete key) are already gated before they call this */
  if (RESPONSIVE_MODE) return;
  /* the page can't be deleted, there'd be nothing left to look at - covers
     the ring's trash handle and the Delete/Backspace key alike (both land
     here), though the handle is hidden on it anyway, see isPageEl() */
  if (isPageEl(el)) return;
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
  /* same exception on the login page: the rectangle a credential is actually
     typed into (see buildCustomElementNode()'s "loginField" kind) stays put,
     since deleting it would leave a label hovering over nothing and no way to
     log in. The field it belongs to is deletable as a whole, and re-addable
     from the right-click menu's "Login page only" section. */
  if (el.hasAttribute("data-login-fixed")) return;
  /* a tile isn't decoration a ta placed, it's one rendering of a real piece
     of content (an attachment, a day) - and every tile of a kind shares one
     id, so "delete" here would mean "hide every day card on the page". Days
     and attachments are added and removed in the content manager. */
  if (isTileBoxEl(el)) return;
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
  /* nothing is selected any more, so nothing is being previewed either */
  syncProgressPreview();
}

/* every group of ids a ta has tied together, a flat array of id-arrays,
   mirroring content.groups. Moving, nudging or deleting one member does the
   same to the rest of its group; everything else stays independent. A group is
   a deliberate, explicit tie, not a new kind of nesting - this project's whole
   "no attachment between elements" default is the opposite. */
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
 * captured offset, ready for a move to broadcast the same delta onto.
 * @param id the element's data-edit-id or data-resize-id
 * @return an array of {id, el, base}
 * @note Locked members are left out, the same rule a direct drag follows, as
 * is anything no longer in the document.
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
  /* the first shift-click EXTENDS the current selection rather than starting
     from nothing: the ring's own element is the one a ta sees as selected, so
     it joins the queue as its first member (picking up the same
     .multi-selected highlight every other member gets) instead of being
     silently left out of the group they think they're building */
  if (!SELECTED_IDS.length && RING_EL) {
    var ringId = elId(RING_EL);
    if (ringId && ringId !== id) SELECTED_IDS.push(ringId);
  }
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
 * Ties the given ids together into a new group. Any of them already in
 * another group is pulled out of it first, so groups never overlap.
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

/* ---------------------------------------------------------------------------
   BOX CONTAINERS (the "Box" element, see buildCustomElementNode()'s "box" kind)

   The one place in this file where an element really does contain another. The
   editor's whole default is the opposite - detachFromFlow() pulls anything a ta
   touches out of flow and pins it at absolute px, placeFreeElement() appends new
   elements to body rather than nesting them, and ancestorPos() actively cancels
   a container's translate back out of its descendants, see its doc comment on
   this project's "no attachment between elements" rule.

   That rule is right for placing things freely and wrong for responsive
   behaviour: "these six nav links wrap when the window narrows" cannot be said
   about six elements pinned at six fixed coordinates. So a box is the opt-in
   exception, and the exchange is explicit - an element seated in a box gives up
   its free position, because "the box decides where this goes" and "this sits
   at exactly (x, y)" are contradictory statements.

   A box is deliberately NOT a [data-flow-area]. Those four containers (see
   isFlowAreaEl()) lay out TILES, which are one rendering of a backing content
   entry, through applyTileFlow()'s grid and its per-tile track sizing; a box
   holds arbitrary elements and lays them out with plain flexbox. Sharing the
   attribute would have dragged boxes through every tile-shaped special case in
   here - the background-less style popover, the shared-height group mirroring,
   the tile reorder drag - for no gain. It shares areaFlowFor() instead, which is
   keyed by id and already generic, so a box gets the same stacking vocabulary
   (direction, wrap, gap, alignment) and the same responsive band plumbing that
   containers already had.
   --------------------------------------------------------------------------- */

/* content.box_members, {boxId: [childId, ...]} - which elements are seated in
   which box, in the order they sit there. Mirrors GROUPS' shape and role: the
   dom is rebuilt from scratch on every load (renderCustomElements() re-places
   every custom element free, template elements come back wherever their markup
   puts them), so the seating has to be re-applied from this map rather than
   inferred from a dom that hasn't been assembled yet. */
var BOX_MEMBERS = {};

/**
 * True for a Box element - the ta-placed transparent container.
 * @param el the element
 * @return true if el is a box
 */
function isBoxAreaEl(el) {
  return !!(el && el.hasAttribute && el.hasAttribute("data-box-area"));
}

/**
 * The node that actually sits in a box: an element, or the .free-wrap around
 * it when one has been put there in place.
 * @param el the element
 * @return el, or the wrap standing in for it
 * @note detachFromFlow() wraps where it finds an element, so resizing
 * something already seated leaves the WRAP as the box's child and the element
 * a level further down (`.box-flow > .free-wrap` in css/style.css is what
 * keeps that laid out by the box). Anything asking "where does this sit in its
 * box" has to ask about the wrap in that case, or it is looking for a node the
 * box does not have.
 */
function seatNodeOf(el) {
  var p = el && el.parentElement;
  return p && p.classList && p.classList.contains("free-wrap") ? p : el;
}

/**
 * The box one element is SEATED IN, if any.
 * @param el any element
 * @return the box, or null - never el itself, even when el is a box
 * @note A box is only ever the element's own PARENT (through its .free-wrap,
 * if it has one), never just some box-area ancestor. This used to ask
 * .closest() for the nearest one, which answered for elements that are not in
 * the box at all but merely inside something that is - the theme toggle's sun
 * icon, which lives in the toggle button, which lives in the navbar's
 * .nav-right box. Everything downstream of this assumes a direct child and
 * none of it survived the mismatch: captureSeat() looked the grandchild up in
 * box.children and got -1, openBoxGhost() THREW trying to put the drag spacer
 * before a sibling that is not the box's child, and the drop seated the icon
 * one level UP, out of the button it belongs to, with no way back. A ta who
 * dragged the sun icon was left with it loose on the page and an empty pill
 * where the theme toggle had been.
 * @note An element like that now simply has no box, so dragging it takes the
 * ordinary free-element path: detachFromFlow() wraps it where it stands and it
 * moves INSIDE its button, which is the only place it means anything.
 * @note recordBoxMembers() has always read box.children, so a direct child is
 * what the saved seating map has always meant too - this makes the question
 * and the answer agree.
 */
function boxOf(el) {
  var node = el && seatNodeOf(el);
  var p = node && node.parentElement;
  return isBoxAreaEl(p) ? p : null;
}

/**
 * Whether a box currently takes elements dropped onto it (right-click >
 * "Accept dropped elements").
 * @param id the box's data-resize-id
 * @return true unless a ta has turned it off
 * @note Defaults to on, and stored as the negative (d.noDrop) so a box saved
 * before this existed reads as accepting, same backfill-free default every
 * other optional descriptor field here uses.
 */
function boxAcceptsDrops(id) {
  var d = id && customElementById(id);
  return !(d && d.noDrop);
}

/**
 * The box under a point that would take a drop right now.
 * @param x viewport px
 * @param y viewport px
 * @param moving the element being dragged, so it can't be dropped into itself
 * @return the box, or null
 */
function boxDropTargetAt(x, y, moving) {
  var boxes = [].slice.call(document.querySelectorAll("[data-box-area]"));
  var hit = null;
  boxes.forEach(function (box) {
    /* dropping a box into itself, or into one of its own descendants, would
       detach that whole subtree from the document */
    if (moving && (box === moving || moving.contains(box))) return;
    if (!boxAcceptsDrops(elId(box))) return;
    var r = box.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
    /* innermost wins: a box seated inside another box is the more specific
       answer wherever the two overlap */
    if (!hit || hit.contains(box)) hit = box;
  });
  return hit;
}

/**
 * Which existing child a drop at this point should land BEFORE.
 * @param box the target box
 * @param x viewport px
 * @param y viewport px
 * @param moving the element being dragged, skipped as a landmark
 * @return the child to insert before, or null for "at the end"
 * @note Compares against each child's centre along whichever axis the box
 * stacks on, the same rule startReelTileDrag() uses for a strip. A wrapping
 * row is still read along its main axis: the pointer's row is implied by the
 * children it has already passed.
 */
function boxDropIndexAt(box, x, y, moving) {
  var col = /column/.test(areaFlowFor(elId(box)).dir);
  var target = null;
  [].slice.call(box.children).forEach(function (child) {
    if (target || child === moving || !child.getBoundingClientRect) return;
    /* only tracked elements are landmarks. A box's other children are
       scaffolding - the drag spacer (openBoxGhost()), the caret itself
       (trackBoxDrop()), and the absolutely-positioned surface layer
       (ensureLayerSurfaces(), which covers the whole box, so its centre is the
       box's centre and it would win nearly every comparison below). Picking one
       gives insertBefore a reference node that is about to be detached, or that
       has to stay the first child. */
    if (!elId(child)) return;
    var r = child.getBoundingClientRect();
    if (col ? y < r.top + r.height / 2 : x < r.left + r.width / 2) target = child;
  });
  return target;
}

/**
 * Takes an element out of its .free-wrap and hands back where that wrap sat,
 * so seating can undo the detach that free placement did.
 * @param el the element
 * @return {left, top} in document px, or null if el wasn't free-placed
 */
function unwrapFreeElement(el) {
  var wrap = el.parentElement;
  if (!wrap || !wrap.classList || !wrap.classList.contains("free-wrap")) return null;
  var r = wrap.getBoundingClientRect();
  wrap.parentNode.insertBefore(el, wrap);
  wrap.remove();
  return { left: Math.round(r.left + window.scrollX), top: Math.round(r.top + window.scrollY) };
}

/**
 * Clears every trace of free placement off an element, so its box can lay it
 * out as an ordinary in-flow child.
 * @param el the element
 * @note Size is deliberately kept: a ta who dragged this to 200px wide meant
 * it, and flexbox honours a width on an item perfectly well. Only the things
 * that fight the container come off - the absolute scheme, the pinned corner,
 * the zeroed margin detachFromFlow() left behind, and the move offset.
 */
function clearFreePlacement(el) {
  el.style.position = "";
  el.style.top = "";
  el.style.left = "";
  el.style.margin = "";
  el.style.maxWidth = "";
  delete el.dataset.ovTx;
  delete el.dataset.ovTy;
  paintPos(el);
}

/**
 * Re-seeds a just-seated element's place in the layer order so it sits above
 * the box it has been put into, the way every container is seeded ahead of
 * its own children.
 * @param el the element that has just been seated
 * @param box the box it is now a child of
 * @note This is what stops a drop DISAPPEARING. The flat page-wide order is
 * seeded in document order, so a box drawn after the text it is later given
 * ranks above that text - and surfaceRankedOver() reads "ranked below a
 * container that paints a surface" as the ta having deliberately sent it
 * behind the panel. It is the only signal there is for that gesture, and it
 * cannot tell the two apart: the next full stacking pass handed the text a
 * negative z-index and put it under the box's own background, out of sight.
 * @note Restoring the invariant at the moment the parentage changes is what
 * keeps the "sent behind" reading honest everywhere else - afterwards, the
 * only way to rank below your own container really is to have asked for it.
 * @note Moves the element's whole layer block (see layerSubtreeIds()), so
 * seating a card carries its contents up with it in the order they were in
 * rather than stranding them under the box.
 * @note A no-op when the block already outranks the box, so seating something
 * that was drawn later than its box leaves the order completely untouched.
 */
function seedSeatedLayerRank(el, box) {
  var id = elId(el), boxId = elId(box);
  if (!id || !boxId) return;
  /* both ids certain to be IN the order before either is looked up, same
     reason moveLayer() reconciles first */
  reconcileLayerOrder(LAYER_ORDER);
  var boxAt = LAYER_ORDER.indexOf(boxId);
  if (boxAt === -1) return;
  var block = layerSubtreeIds(el);
  if (!block.length) block = [id];
  var lowest = Infinity, inBlock = {};
  block.forEach(function (b) {
    inBlock[b] = true;
    var i = LAYER_ORDER.indexOf(b);
    if (i !== -1) lowest = Math.min(lowest, i);
  });
  if (lowest > boxAt) return;
  var rest = LAYER_ORDER.filter(function (x) { return !inBlock[x]; });
  var at = rest.indexOf(boxId) + 1;
  LAYER_ORDER = rest.slice(0, at).concat(block, rest.slice(at));
  saveLayerOrder(LAYER_ORDER);
}

/**
 * Sends an element that has just been taken OUT of a box to the front of the
 * page, the counterpart of seedSeatedLayerRank().
 * @param el the element, already free
 * @note An element keeps its rank while it is seated, and that rank is a place
 * in a flat page-wide order seeded in DOCUMENT order - so a nav link sits at 13
 * of 164 not because anyone put it there but because the navbar is the first
 * thing in the markup. Inside its box that is invisible: the box paints as a
 * unit and its contents only ever compete with each other. Pull one out onto
 * the open page and it is suddenly being compared with all 164, and it lost to
 * nearly every one of them - a ta dragged a link out of the navbar, dropped it
 * over the hero, and watched it vanish behind the hero.
 * @note The front, not merely above what it was dropped on: this is the element
 * the ta is holding, and the only thing they can be sure of is that they want
 * to see it where they let go of it.
 * @note Only for a REMOVAL a ta actually asked for. The lift at the start of
 * every box drag (startBoxDrag()) goes through unseatFromBox() too, and so does
 * an undo (restoreSeat()); re-ranking there would send an element to the front
 * of the page for nothing more than a reorder inside its own box, and would
 * make undo a thing that changes the stack instead of restoring it.
 */
function seedUnseatedLayerRank(el) {
  var id = elId(el);
  if (id) moveLayerExtreme(id, true);
}

/**
 * Seats an element inside a box: the whole point of this section.
 * @param el the element to seat
 * @param box the box to seat it in
 * @param beforeEl the existing child to insert before, or null for the end
 * @return true if anything changed
 */
function seatInBox(el, box, beforeEl) {
  if (!el || !box || el === box || el.contains(box)) return false;
  var id = elId(el), boxId = elId(box);
  if (!id || !boxId) return false;
  /* measured while it is still laid out where the ta could see it, and applied
     again at the bottom of this function - see seatedWidthFor() */
  var wasWidth = seatedWidthFor(el);
  unwrapFreeElement(el);
  clearFreePlacement(el);
  /* the surface layer has to stay the box's first child - it is the box's own
     background, painted below everything the box holds, see
     ensureLayerSurfaces(). Seating in front of it would put a seated element
     underneath the box's own paint. */
  var surface = box.querySelector(":scope > [data-layer-surface]");
  if (surface && beforeEl === surface) beforeEl = surface.nextSibling;
  box.insertBefore(el, beforeEl || null);
  /* the pinned offset is gone from the dom, so the stored one has to go too -
     otherwise the next load's applyPositionOverrides() would paint it straight
     back on and shove the element out of the row it now belongs to */
  saveEditedPosition(id, null, null);
  /* before anything else reads the stacking order: el has just gained a
     container, and a container is always seeded ahead of what it holds */
  seedSeatedLayerRank(el, box);
  freezeSeatedSize(el, wasWidth);
  recordBoxMembers();
  applyBoxFlow();
  growBoxToFit(box);
  return true;
}

/**
 * Grows a box until everything seated in it fits inside it. Never shrinks one.
 * @param box the box
 * @note A box is 160x100 when it's drawn (see buildCustomElementNode()), which
 * is smaller than most things a ta drops into it. Left alone the contents just
 * overrun and the box scrolls - and a scrolled box is a bad place to arrange
 * anything, since half its children sit outside it and the gap the pointer is
 * over stops matching the gap it's pointing at (see boxDropIndexAt()).
 * @note Width first, then height: a wider box re-wraps its rows, so the height
 * it needs can only be measured once the width is settled.
 * @note Capped at the room left to the right of the box, so one very wide
 * child - a heading laid out at its max-content width - can't push the box off
 * the side of the page. Past that it overflows and scrolls, as before.
 * @note The new size is saved the same way a resize drag's is, so it survives
 * the reload; it is deliberately NOT a separate undo entry, since undoing the
 * drop that caused it and finding the box still open at that size is far less
 * confusing than a Ctrl+Z that only puts a box back to a smaller size.
 */
function growBoxToFit(box) {
  var id = box && elId(box);
  if (!id || !box.isConnected) return;
  /* only a box the ta placed. The template's own containers are boxes too (the
     navbar's link rows, see boxDropIndexAt()'s note), and those are sized by
     the stylesheet for every viewport - writing a px width and height onto one
     because something was dropped in it would pin the navbar at whatever width
     the window happened to be. */
  if (!customElementById(id)) return;
  var r = box.getBoundingClientRect();
  var room = Math.max(160, document.documentElement.clientWidth - Math.round(r.left) - 8);
  var w = Math.round(r.width), h = Math.round(r.height), grew = false;
  var overW = box.scrollWidth - box.clientWidth;
  if (overW > 0 && w < room) {
    w = Math.min(w + overW, room);
    box.style.width = w + "px";
    grew = true;
  }
  /* re-read after the width above has been applied */
  var overH = box.scrollHeight - box.clientHeight;
  if (overH > 0) {
    h = h + overH;
    box.style.height = h + "px";
    grew = true;
  }
  if (!grew) return;
  box.dataset.natW = w;
  box.dataset.natH = h;
  var d = customElementById(id);
  if (d) { d.w = w; d.h = h; }
  saveEditedSize(id, { w: w, h: h });
}

/**
 * The width a seated element should be pinned at, measured while it is still
 * where it was.
 * @param el the element about to be seated
 * @return a width in px, or 0 for "let it size itself"
 * @note A flex child with no width of its own is laid out at its MAX-CONTENT
 * size, so a paragraph that wrapped over three lines on the page lands in a box
 * as one very long line. Pinning the width it arrived with is what stops that -
 * along with .box-flow > * in css/style.css, which for the same reason no
 * longer caps a child at the box's width either.
 * @note But only where the width is doing something. An element is pinned only
 * if its content is currently being WRAPPED by it: that is the case a free
 * layout would visibly rearrange. An element merely sized by the container it
 * used to sit in - a tag filling a grid track, a nav link in the navbar's row -
 * is left to size itself, because that old width was never its own and holding
 * it to one measured under someone else's type and padding is what wrapped a
 * one-word link onto two lines.
 * @note Width only. The height then follows from the same wrapping it always
 * had, and pinning one as well would stop a box growing when a ta types another
 * line into what they just seated.
 */
function seatedWidthFor(el) {
  if (!el || el.style.width) return 0;
  var r = el.getBoundingClientRect();
  if (!r.width) return 0;
  /* what it would be if nothing constrained it, read and put straight back
     within the one frame, so nothing is ever painted at this size */
  el.style.width = "max-content";
  var natural = el.getBoundingClientRect().width;
  el.style.width = "";
  return natural > r.width + 2 ? r.width : 0;
}

/**
 * Pins a newly seated element at the width seatedWidthFor() measured for it.
 * @param el the element, already in its box
 * @param w the width, or 0 to leave it alone
 * @note Never overwrites a width that is already there: anything dragged has
 * been through detachFromFlow() and carries the ta's own, which wins.
 */
function freezeSeatedSize(el, w) {
  if (!el || !w) return;
  if (!el.dataset.natW) el.dataset.natW = w;
  if (!el.style.width) el.style.width = w + "px";
}

/**
 * Lifts an element out of whatever box it's in and puts it back at a free
 * position, the reverse of seatInBox().
 * @param el the element
 * @param left document px, defaulting to where it currently sits
 * @param top document px
 * @return true if el was actually in a box
 */
function unseatFromBox(el, left, top) {
  var box = boxOf(el);
  if (!box) return false;
  /* read while el is still IN the box, because that is the only place its real
     size exists. placeFreeElement() hangs it off <body>, and an element that
     has left its container has left everything the container was passing down
     to it: the navbar sets white-space: nowrap, so the instant "Apply Now" was
     lifted out it stopped being one line and shrank to the width of its longest
     word, and it was THAT - 44px wide and two lines tall - that got frozen on.
     Dropping it back in the navbar restored nowrap and put the words back on
     one line, but the frozen 44px stayed, so the link laid out one 77px line
     inside a 44px box and printed straight over the link beside it. */
  var r = el.getBoundingClientRect();
  if (left === undefined || top === undefined) {
    left = Math.round(r.left + window.scrollX);
    top = Math.round(r.top + window.scrollY);
  }
  placeFreeElement(el, left, top);
  /* the wrap that just went round it has no size of its own, and things that
     measure a free element measure the WRAP (captureSeat(), the snap guides).
     Left at 0x0 it reports a lifted element as a point at the top-left corner
     of where it really is. */
  freezeFreeElement(el, r.width, r.height);
  recordBoxMembers();
  applyBoxFlow();
  return true;
}

/**
 * Re-reads the seating straight off the dom into BOX_MEMBERS and persists it.
 * @note Read back rather than maintained incrementally: the dom is the truth
 * the moment anything reorders, and one query is cheaper than keeping a
 * parallel index correct across seat/unseat/delete/undo.
 */
function recordBoxMembers() {
  var map = {};
  document.querySelectorAll("[data-box-area]").forEach(function (box) {
    var boxId = elId(box);
    if (!boxId) return;
    var ids = [];
    [].slice.call(box.children).forEach(function (child) {
      var cid = elId(child);
      if (cid) ids.push(cid);
    });
    if (ids.length) map[boxId] = ids;
  });
  BOX_MEMBERS = map;
  saveBoxMembers(map);
}

/**
 * Persists the whole seating map into the preview snapshot, the same
 * localStorage draft every other override here uses. Rewritten wholesale, same
 * as saveGroups(), since BOX_MEMBERS is always the full, current picture.
 * @param map BOX_MEMBERS
 */
function saveBoxMembers(map) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.box_members = map;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Re-seats every saved member into its box on load, live site included - where
 * an element sits is real page content, not an editor affordance.
 * @param map content.box_members
 * @note Runs late, after renderCustomElements() and the tile hooks, since a
 * member can be any of those things and none of them exist before then. Any id
 * that doesn't resolve is skipped rather than dropped from the map: it may
 * simply belong to a different page of the same content blob.
 * @note An id shared by more than one element (the template deliberately gives
 * the navbar wordmark and the footer wordmark the same nav.brand, so one edit
 * changes both - see templates/index.html) seats the FIRST of them, the same
 * answer elByAnyId() gives every other id-keyed override in this file. Seating
 * both would move two elements for one drag; seating neither would silently
 * drop a ta's arrangement. See seatedElById() for the one case that needs the
 * other answer.
 */
function applyBoxMembers(map) {
  BOX_MEMBERS = map && typeof map === "object" ? map : {};
  Object.keys(BOX_MEMBERS).forEach(function (boxId) {
    var box = elByAnyId(boxId);
    if (!box || !isBoxAreaEl(box)) return;
    (BOX_MEMBERS[boxId] || []).forEach(function (childId) {
      var child = elByAnyId(childId);
      if (!child || child === box || child.contains(box)) return;
      /* the same width freeze a live drop does, for the same reason: without it
         a wrapped paragraph comes back from every reload as one long line, at
         its max-content width. See seatedWidthFor(). */
      var wasWidth = seatedWidthFor(child);
      unwrapFreeElement(child);
      clearFreePlacement(child);
      box.appendChild(child);
      freezeSeatedSize(child, wasWidth);
    });
  });
  applyBoxFlow();
}

/**
 * Lays out every box from its saved stacking, the box-shaped counterpart to
 * applyTileFlow(). Idempotent, and cheap enough to re-run after any edit.
 * @note Flexbox on every box, unconditionally - unlike a tile container there's
 * no shipped grid layout to preserve compatibility with, and a box full of
 * differently-sized elements is exactly what flex is for.
 */
function applyBoxFlow() {
  document.querySelectorAll("[data-box-area]").forEach(function (box) {
    var id = elId(box);
    if (!id) return;
    var flow = areaFlowFor(id);
    /* ONLY what somebody actually asked for. areaFlowFor() always answers with
       a complete set, filling in defaults for anything unset - writing all of
       it would overwrite the stylesheet's own layout for the containers that
       already have one (the navbar's link row is flex with its own gap long
       before this section existed), so an untouched field is written as "" and
       handed back to css. Same rule applyTileFlow() already follows for
       justify/align. */
    var saved = AREA_FLOW[id] || {}, band = RESPONSIVE_FLOW[id] || {};
    function set(k) { return band[k] !== undefined ? band[k] : saved[k]; }
    box.style.flexDirection = set("dir") !== undefined ? flow.dir : "";
    box.style.flexWrap = set("wrap") !== undefined
      ? (flow.wrap === "reverse" ? "wrap-reverse" : "wrap") : "";
    box.style.gap = set("gap") !== undefined ? flow.gap + "px" : "";
    box.style.justifyContent = flow.justify || "";
    box.style.alignItems = flow.align || "";
  });
}
window.applyBoxFlow = applyBoxFlow;

/* where the live drag would seat what it's carrying: {box, before}, or null
   for "drop it free". Recomputed on every mousemove and shown as a highlight
   on the box plus a caret in the gap it would land in, so a ta always knows
   what letting go will do BEFORE they let go. See the ALT-DROP note below for
   when it is allowed to be non-null. */
var BOX_DROP = null;

/* the caret painted between two of a box's children, one shared node */
var BOX_CARET = null;

/* the box the dragged element was seated in when the drag began, or null if it
   was free - set by startBoxDrag(), read by homeBoxUnder(). */
var BOX_DRAG_HOME = null;

/* A spacer left in the box, exactly the size of the element being dragged, for
   as long as that drag lasts - see openBoxGhost().
   Without it the lift in startBoxDrag() shrinks the box under the pointer the
   instant the drag begins, and boxDropTargetAt() then hit-tests against the
   shrunken rect: a two-item box narrowed from 98px to 45px, so the pointer that
   was over the box was over nothing, and no amount of alt could seat the
   element again. An auto-width box holding one element collapsed to 0. */
var BOX_GHOST = null;

/**
 * Holds a box's shape open while one of its children is being dragged.
 * @param box the box the child was lifted out of
 * @param rect the child's border-box rect, measured while it was still seated
 * @param beforeEl the box child the gap sits in front of, null for the end
 * @note Called AFTER the lift, never before: inserting a same-sized spacer in
 * front of a still-seated element pushes that element a whole slot along, and
 * the unseat that follows then pins it at the pushed-to spot - which is the
 * element visibly jumping away from the cursor the instant a drag starts.
 * @note Takes the border-box size, not the margin box: seatInBox() zeroes the
 * margin detachFromFlow() leaves behind, so the gap the element came out of is
 * the one it would go back into.
 */
function openBoxGhost(box, rect, beforeEl) {
  clearBoxGhost();
  BOX_GHOST = document.createElement("span");
  BOX_GHOST.className = "box-drag-ghost";
  BOX_GHOST.style.width = rect.width + "px";
  BOX_GHOST.style.height = rect.height + "px";
  box.insertBefore(BOX_GHOST, beforeEl || null);
}

/** Takes the drag spacer back out, closing the gap it held open. */
function clearBoxGhost() {
  if (BOX_GHOST && BOX_GHOST.parentNode) BOX_GHOST.parentNode.removeChild(BOX_GHOST);
  BOX_GHOST = null;
}

/**
 * The box the current drag came out of, if the pointer is still inside it.
 * @param x viewport px
 * @param y viewport px
 * @return BOX_DRAG_HOME, or null
 * @note Deliberately not routed through boxDropTargetAt(). Shuffling an element
 * that is already seated is not a "dropped element", so a box whose ta turned
 * drops off still lets its own members be reordered (see boxAcceptsDrops()),
 * and a box nested inside it doesn't steal the drop the way innermost-wins
 * would - staying inside your own box should mean staying in it.
 */
function homeBoxUnder(x, y) {
  if (!BOX_DRAG_HOME || !BOX_DRAG_HOME.isConnected) return null;
  var r = BOX_DRAG_HOME.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? BOX_DRAG_HOME : null;
}

/**
 * Recomputes and repaints the drop hint for one mousemove of a drag.
 * @param el the element being dragged
 * @param ev the mousemove
 * @note ALT-DROP: Alt is what JOINS an element to a box it did not belong to.
 * It's opt-in rather than the default because a box is a full-page-width
 * rectangle as often as it's a small one, and a plain drag passing over a big
 * background box silently swallowing the element would be both surprising and,
 * since seating throws the free position away, destructive of something a ta
 * had already placed by hand. Holding a key makes it an answer to a question
 * they asked.
 * @note An element that is ALREADY seated needs no key to be moved around
 * inside its own box: nothing is being joined, and every other reorder in this
 * file (a reel tile, a flow container's tile) is a plain drag. So a drag that
 * stays within its own box reorders, and the way out is to drag past that box's
 * edge - see homeBoxUnder(). Alt still matters for a seated element, but only
 * for moving it to a DIFFERENT box.
 */
function trackBoxDrop(el, ev) {
  /* the previous move's hint comes off FIRST, before anything is measured. The
     caret is a real flex child, not an overlay, so leaving it in would have the
     walk below both read it as one of the box's landmarks - and pick it, giving
     insertBefore a reference node this very function is about to detach - and
     measure every child right of it 2px + one gap off where it really sits. */
  clearBoxDropHint();
  var box = ev.altKey ? boxDropTargetAt(ev.clientX, ev.clientY, el)
                      : homeBoxUnder(ev.clientX, ev.clientY);
  if (!box) { BOX_DROP = null; return; }
  var before = boxDropIndexAt(box, ev.clientX, ev.clientY, el);
  BOX_DROP = { box: box, before: before };
  box.classList.add("box-drop-target");
  if (!BOX_CARET) {
    BOX_CARET = document.createElement("span");
    BOX_CARET.className = "box-drop-caret";
  }
  box.insertBefore(BOX_CARET, before || null);
}

/** Takes the drop highlight and caret back off the page. */
function clearBoxDropHint() {
  document.querySelectorAll(".box-drop-target").forEach(function (b) {
    b.classList.remove("box-drop-target");
  });
  if (BOX_CARET && BOX_CARET.parentNode) BOX_CARET.parentNode.removeChild(BOX_CARET);
}

/**
 * Snapshots where an element sits, in the one vocabulary both sides of a seat
 * undo can be expressed in.
 * @param el the element
 * @return {box, index, left, top} - box "" means free-placed
 */
function captureSeat(el) {
  var box = boxOf(el);
  if (box) {
    return {
      box: elId(box),
      /* the wrap when there is one, since that is the child the box has;
         indexing el itself there answered -1, which restoreSeat() reads as
         "no such gap" and appends to the end instead */
      index: [].slice.call(box.children).indexOf(seatNodeOf(el)),
      left: 0, top: 0
    };
  }
  var wrap = el.parentElement;
  var free = wrap && wrap.classList && wrap.classList.contains("free-wrap");
  var r = (free ? wrap : el).getBoundingClientRect();
  return {
    box: "", index: -1,
    left: Math.round(r.left + window.scrollX),
    top: Math.round(r.top + window.scrollY)
  };
}

/**
 * Resolves an id to the element a seating change should act on.
 * @param id the element's data-edit-id or data-resize-id
 * @return the element, or null
 */
function seatedElById(id) {
  var all = document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]');
  /* an id can legitimately be on more than one element - the template shares
     nav.brand between the navbar and the footer on purpose, so one edit to the
     wordmark changes both (see templates/index.html). elByAnyId() answers with
     the first in dom order, which is the right answer for every id-keyed
     override in this file; for UNSEATING it is not, because the copy that's
     actually sitting in a box is the one the ta is undoing. */
  for (var i = 0; i < all.length; i++) if (boxOf(all[i])) return all[i];
  return all[0] || null;
}

/**
 * Puts an element back into a state captureSeat() recorded - the replay half
 * of a seat undo/redo.
 * @param el the element
 * @param v a captureSeat() result
 */
function restoreSeat(el, v) {
  if (!el || !v) return;
  if (v.box) {
    var box = elByAnyId(v.box);
    if (!box) return;
    /* the recorded index counted el itself when it was already in this box, so
       inserting before the child now AT that index lands it back in the same
       gap either way */
    seatInBox(el, box, box.children[v.index] || null);
    return;
  }
  unseatFromBox(el, v.left, v.top);
  var wrap = el.parentElement;
  if (wrap && wrap.classList && wrap.classList.contains("free-wrap")) {
    wrap.style.left = v.left + "px";
    wrap.style.top = v.top + "px";
  }
}

/**
 * The end of a drag, once the pointer is up: seats what was dragged if the
 * hint said it would, and records one undo entry if the seating changed.
 * @param el the element that was dragged
 * @param before the captureSeat() taken when the drag started
 * @return true if the element was seated or unseated
 */
function finishBoxDrop(el, before) {
  var drop = BOX_DROP;
  clearBoxDropHint();
  /* the drag is over either way, so the spacer's gap closes here - before the
     seat below, which is safe because boxDropIndexAt() never returns the ghost
     as a reference node, see openBoxGhost() */
  clearBoxGhost();
  BOX_DROP = null;
  BOX_DRAG_HOME = null;
  /* a drag that never reached startBoxDrag() (its 5px threshold was never
     crossed) has nothing seated to restore */
  if (!before) before = { box: "", index: -1, left: 0, top: 0 };
  if (!drop) {
    /* dragged out of a box and dropped on open page: it's already free (the
       drag start unseated it, see startBoxDrag()), so the only thing left is
       the history entry */
    if (before.box) {
      /* it has just stopped being part of a container and started being a
         thing on the page, which is a change of who it is stacked against -
         see seedUnseatedLayerRank() */
      seedUnseatedLayerRank(el);
      EDIT_UNDO.push({ type: "seat", id: elId(el), before: before, after: captureSeat(el) });
      EDIT_REDO.length = 0;
      return true;
    }
    return false;
  }
  seatInBox(el, drop.box, drop.before);
  var after = captureSeat(el);
  /* a drag that put it back in the same gap it came from changed nothing, and
     an undo entry for it would just be one wasted press of ctrl-z. Common now
     that reordering inside a box needs no key, see trackBoxDrop(). */
  if (before.box !== after.box || before.index !== after.index) {
    EDIT_UNDO.push({ type: "seat", id: elId(el), before: before, after: after });
    EDIT_REDO.length = 0;
  }
  positionRing();
  return true;
}

/**
 * The start of a drag on something that might be seated: lifts it out of its
 * box to a free position at exactly the spot it already occupies, so every
 * drag path below it is the ordinary free-element one it always was.
 * @param el the element about to be dragged
 * @return the captureSeat() taken BEFORE the lift, for finishBoxDrop()
 * @note Lifting up front rather than on drop is what keeps this from needing
 * its own drag implementation: a seated element is an in-flow child, and
 * dragging one without lifting it would have detachFromFlow() freeze a phantom
 * wrap inside the box and leave a hole in the row for the length of the drag.
 */
function startBoxDrag(el) {
  var before = captureSeat(el);
  if (before.box) {
    /* measured while el is still seated, and the lift is done from THAT rect
       rather than from wherever el ends up: the spacer below has to go in after
       the lift (see openBoxGhost()), but it has to be the size and in the place
       the element really occupied, which only exists to be read right now */
    var box = boxOf(el);
    var rect = el.getBoundingClientRect();
    var gap = el.nextSibling;
    unseatFromBox(el, Math.round(rect.left + window.scrollX),
                  Math.round(rect.top + window.scrollY));
    /* the gap stays open for the whole drag - otherwise the box shrinks out
       from under the pointer and alt can never find it again */
    openBoxGhost(box, rect, gap);
    /* remembered so a drag that never leaves this box can reorder without Alt,
       see trackBoxDrop()'s ALT-DROP note */
    BOX_DRAG_HOME = box;
  }
  return before;
}

/**
 * Turns a box's "does an Alt-drop land in here" switch on or off.
 * @param id the box's data-resize-id
 * @param on true to accept drops
 * @note Stored as the negative on the descriptor, see boxAcceptsDrops().
 */
function setBoxAcceptsDrops(id, on) {
  var d = customElementById(id);
  if (!d) return;
  if (on) delete d.noDrop;
  else d.noDrop = true;
  saveCustomElements(CUSTOM_ELEMENTS);
  EDIT_UNDO.push({ type: "boxdrops", id: id, before: !on, after: !!on });
  EDIT_REDO.length = 0;
}

/**
 * Draws a box around a set of already-placed elements and seats all of them in
 * it, in reading order - the right-click menu's "Put N elements in a box".
 * @param ids the selected ids (2 or more)
 * @return the new box element, or null
 * @note The way anything already laid out gets into a box. Adding an empty box
 * and dragging each element in individually would mean re-placing work a ta had
 * already done by hand; this takes the arrangement as the answer and reads the
 * seating order straight off it.
 * @note The box is sized to the union of what it holds plus a small margin, and
 * placed at that union's top-left, so the moment it appears it sits exactly
 * where the elements already were.
 */
function boxSelection(ids) {
  var els = (ids || []).map(elByAnyId).filter(function (el) {
    /* a tile role and a page can't be lifted out of what owns them, and a
       locked element isn't up for rearranging at all */
    return el && !isPageEl(el) && !isLocked(elId(el)) && !isMoveLockedTileRole(el) && !isTileBoxEl(el);
  });
  if (els.length < 2) return null;
  /* reading order (top row first, then left to right within a row) rather than
     selection order: a ta shift-clicking six nav links doesn't necessarily
     click them in the order they should sit, and the arrangement on screen is
     the more reliable statement of intent. The 12px row tolerance is what makes
     a row of elements whose tops differ by a pixel or two still count as one
     row rather than sorting into a staircase. */
  var rects = els.map(function (el) { return { el: el, r: el.getBoundingClientRect() }; });
  rects.sort(function (a, b) {
    if (Math.abs(a.r.top - b.r.top) > 12) return a.r.top - b.r.top;
    return a.r.left - b.r.left;
  });
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  rects.forEach(function (x) {
    minX = Math.min(minX, x.r.left); minY = Math.min(minY, x.r.top);
    maxX = Math.max(maxX, x.r.right); maxY = Math.max(maxY, x.r.bottom);
  });
  /* every element's seating BEFORE the box exists, so one undo can put the
     whole arrangement back rather than leaving them stacked in a hidden box */
  var seats = rects.map(function (x) { return { id: elId(x.el), before: captureSeat(x.el) }; });
  var pad = 8;
  var box = addCustomElement("box",
    Math.round(minX + window.scrollX - pad), Math.round(minY + window.scrollY - pad));
  if (!box) return null;
  /* addCustomElement() pushed its own "add" entry; the boxwrap entry below
     covers the box AND the seating, so one Ctrl+Z undoes the whole action
     rather than needing two presses to get back to where the ta started */
  if (EDIT_UNDO.length && EDIT_UNDO[EDIT_UNDO.length - 1].type === "add") EDIT_UNDO.pop();
  var boxId = elId(box);
  var d = customElementById(boxId);
  var w = Math.round(maxX - minX) + pad * 2, h = Math.round(maxY - minY) + pad * 2;
  box.style.width = w + "px";
  box.style.height = h + "px";
  box.dataset.natW = w;
  box.dataset.natH = h;
  if (d) { d.w = w; d.h = h; }
  saveEditedSize(boxId, { w: w, h: h });
  /* transparent, not the box element's usual --surface-2 slab: this box is
     being drawn around existing content to give it a layout, and painting a
     panel behind that content is a styling decision the ta hasn't made. The
     editor's dashed outline still makes it visible to work with. */
  setElementColor(box, "transparent");
  saveEditedColor(boxId, "transparent");
  rects.forEach(function (x) { seatInBox(x.el, box, null); });
  EDIT_UNDO.push({ type: "boxwrap", boxId: boxId, seats: seats });
  EDIT_REDO.length = 0;
  RING_EL = box;
  positionRing();
  if (window.responsiveRepaintSoon) window.responsiveRepaintSoon();
  return box;
}

/**
 * Pushes one undo entry for a group move or nudge.
 * @param moves [{id, before, after}], one entry per member that was moved
 * @note Drops any member that didn't actually move, and collapses to a plain
 * "move" entry when only one did - so an ungrouped drag's undo history looks
 * exactly as it always has.
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
 * Looks up one variable by its stable key.
 * @param key a variable's "key"
 * @return the variable {key, name, type, value, ...}, or null if unknown
 * @note Resolution is deliberately NOT page-scoped, unlike what a picker
 * offers: a chip or progress bar keeps showing its real number wherever it
 * ends up, even bound to a page-local variable this page would never offer.
 */
function variableByKey(key) {
  /* the gallery's per-pane variables and every day/attachment tile's own
     locals are not content.variables at all - they're derived from whatever
     is placed on the page right now (see galleryVariableFor(),
     dayTileVariableFor(), extrasTileVariableFor()) - but they all resolve
     through this same lookup, so everything downstream (formula chips,
     progress bars) can be built on one without knowing the difference */
  var gv = galleryVariableFor(key);
  if (gv) return gv;
  var dv = dayTileVariableFor(key);
  if (dv) return dv;
  var ev = extrasTileVariableFor(key);
  if (ev) return ev;
  var gd = galleryDirVariableFor(key);
  if (gd) return gd;
  for (var i = 0; i < VARIABLES.length; i++) {
    if (VARIABLES[i].key === key) return VARIABLES[i];
  }
  return null;
}

/**
 * The variables a picker on THIS page should offer.
 * @param keepKey a key to keep in the list even when the page no longer
 *   offers it - whatever the control is already bound to, so filling a select
 *   can't silently swap an existing binding for something else. Optional.
 * @param scopeEl the element the picker is being opened FOR. Passing it
 *   narrows the tile locals to the one tile that element sits inside; omit it
 *   entirely (not null, which means "sits inside nothing") for every tile.
 * @return an array of variables, content ones first in content order
 * @note Two kinds. PUBLIC are content.variables, typed into the content
 * manager and offered site-wide. LOCAL exist nowhere in content and never
 * appear in the manager - they're derived from what's placed on this page
 * right now, and only this page can bind them.
 */
function pickableVariables(keepKey, scopeEl) {
  var out = VARIABLES.concat(arguments.length < 2 ? pageLocalVariables() : scopedPageLocalVariables(scopeEl));
  if (keepKey && !out.some(function (v) { return v.key === keepKey; })) {
    var kept = variableByKey(keepKey);
    if (kept) out.push(kept);
  }
  return out;
}

/**
 * The tile locals ONE PLACE on the page may pick from - pageLocalVariables()
 * cut down to the tile scopeEl is physically inside.
 * @param scopeEl the element the picker is for, or null for none
 * @return an array of variable records, possibly empty
 * @note Every day tile's locals existing at once is right for RESOLUTION (a
 * chip keeps reading Day 3's title wherever it ends up) but wrong for a
 * picker: editing a field inside Day 1's tile and being offered Day2Header
 * offers a binding that, because these fields are one shared template
 * mirrored onto every tile, isn't what the ta means. So a picker sees its own
 * tile's locals and no other's, and one opened outside every tile sees none.
 * @note The gallery's pane variables are page-level rather than
 * tile-relative, so they're offered regardless of scope.
 */
function scopedPageLocalVariables(scopeEl) {
  var out = [];
  var closest = function (sel) { return scopeEl && scopeEl.closest ? scopeEl.closest(sel) : null; };
  var dTile = closest("[data-days-tile]");
  if (dTile && dTile.dataset.daysVar) {
    Object.keys(DAYS_CHIP_VAR_SUFFIX).forEach(function (local) {
      out.push(dayTileVariableFor(TILE_VAR_PREFIX + "day:" + dTile.dataset.daysVar + ":" + local));
    });
  }
  var xTile = closest("[data-extras-tile]");
  if (xTile && xTile.dataset.extrasVar) {
    out.push(extrasTileVariableFor(TILE_VAR_PREFIX + "extras:" + xTile.dataset.extrasVar));
  }
  /* a directory tile's own name, scoped to the tile the field sits in for
     exactly the reason a day tile's locals are: the rail's label is one shared
     template rendered per directory, so offering every OTHER directory's name
     while editing it would be offering a binding that can't be what the ta
     means (see galleryDirVariableFor()) */
  var gTile = closest("[data-gallery-tile]");
  if (gTile && gTile.dataset.galleryDir) {
    out.push(galleryDirVariableFor(TILE_VAR_PREFIX + "gallerydir:" + gTile.dataset.galleryDir));
  }
  if (currentPageKey() === "gallery") out = out.concat(galleryVariableInventory());
  return out;
}

/**
 * This page's own private variables - the local half of pickableVariables().
 * @return an array of variable records, empty on a page with none
 * @note Every day tile's five locals and every attachment's filename are
 * offered on whatever page they're placed on. Unlike the gallery's pair they
 * aren't exclusive to one named page, so they aren't gated by
 * currentPageKey(): gallery variables only exist there because panes do. The
 * list grows and shrinks live as tiles are added.
 * @note The object canvas has no page of its own and reads as the landing
 * page, so an object binds whatever tiles are there plus public variables -
 * what an object built to be dropped anywhere can honestly use.
 */
function pageLocalVariables() {
  var out = dayTileVariableInventory().concat(extrasTileVariableInventory())
    .concat(galleryDirVariableInventory());
  if (currentPageKey() === "gallery") out = out.concat(galleryVariableInventory());
  return out;
}

/**
 * The identifier a ta actually types inside {...} to reference one variable.
 * @param v a variable record (see variableByKey()), or null
 * @return the token, or "" if v is falsy or has no token to offer
 * @note Not always the same as .key: a derived variable's key can hold
 * characters the notation uses as delimiters (a gallery variable's key has
 * colons in it). A real content.variables entry has no such split - its
 * ta-typed "name" IS this identifier, which is exactly why that field can't
 * contain "{", "}", ":" or whitespace.
 */
function variableNotationToken(v) {
  if (!v) return "";
  return v.derived ? (v.token || "") : (v.name || "");
}

/**
 * Finds the variable a typed {token} identifier names - the reverse of
 * variableNotationToken().
 * @param token the identifier text between "{" and the "}"/":" that follows
 * @return the matching variable record, or null if token names nothing
 * @note A plain linear scan: the list is always small, and it only runs at
 * the end of an edit session, never per keystroke.
 */
function variableByToken(token) {
  if (!token) return null;
  var pool = pickableVariables();
  for (var i = 0; i < pool.length; i++) {
    if (variableNotationToken(pool[i]) === token) return pool[i];
  }
  return null;
}

/**
 * Reads a variable's current value as a number, for the progress element's
 * fill-ratio maths.
 * @param key a variable's "key"
 * @return a number, 0 if unset/unparseable
 * @note A string/boolean/datetime variable, or a since-deleted key, reads as
 * 0 rather than throwing - the same "never crash the page over a stale
 * reference" stance taken elsewhere in this file.
 */
function variableNumericValue(key) {
  var v = variableByKey(key);
  var n = v ? parseFloat(v.value) : NaN;
  return isNaN(n) ? 0 : n;
}

/**
 * Fills a <select> with every variable matching predicate, built with real
 * DOM nodes rather than an innerHTML string, since a variable's ta-typed
 * name isn't escaped anywhere else in this file.
 * @param selectEl the <select> to fill
 * @param predicate function(variable) -> bool, which variables to include
 * @param selectedKey the value to preselect
 * @param scopeEl the element this picker is for - omit to offer every tile's
 *   locals rather than one tile's
 * @note Shared by the progress element's Current/Total selects and the text
 * toolbar's formula menu. Offers every content variable plus whatever the
 * page has of its own.
 */
function populateVariableSelect(selectEl, predicate, selectedKey, scopeEl) {
  selectEl.textContent = "";
  pickableVariables(selectedKey, scopeEl).filter(predicate).forEach(function (v) {
    var opt = document.createElement("option");
    opt.value = v.key;
    opt.textContent = v.name || v.key;
    selectEl.appendChild(opt);
  });
  selectEl.value = selectedKey;
}

/**
 * Fills a progress element's Current/Total <select> with every number-typed
 * variable.
 * @param selectEl the ".ctx-var-current"/".ctx-var-total" <select>
 * @param selectedKey the element's current d.varCurrent/d.varTotal
 * @note A fill ratio is only meaningful between two numbers, so
 * string/boolean/datetime variables don't show up as options here.
 */
function populateProgressVarSelect(selectEl, selectedKey, scopeEl) {
  populateVariableSelect(selectEl, function (v) { return v.type === "number"; }, selectedKey, scopeEl);
}

/**
 * Every operation the text toolbar's fx menu offers as a ready-made shape.
 * @note No longer a closed set of stored operations: each is shorthand for an
 * EXPRESSION the ta could have typed by hand. "value" is the only one that
 * accepts a non-number variable; every other shape reads both operands as
 * numbers. "custom" is the escape hatch, swapping the two pickers for a plain
 * text box - also what the menu falls back to when opened on something no
 * shape here can describe.
 */
var FX_OPS = {
  value: { label: "Value", needsB: false, anyType: true, build: function (a) { return a; } },
  sum: { label: "Sum (A + B)", needsB: true, build: function (a, b) { return a + " + " + b; } },
  difference: { label: "Difference (A − B)", needsB: true, build: function (a, b) { return a + " - " + b; } },
  product: { label: "Product (A × B)", needsB: true, build: function (a, b) { return a + " * " + b; } },
  quotient: { label: "Quotient (A ÷ B)", needsB: true, build: function (a, b) { return a + " / " + b; } },
  percent: { label: "Percent (A of B, as %)", needsB: true, build: function (a, b) { return a + " / " + b + ' * 100 + "%"'; } },
  fraction: { label: "“A of B”", needsB: true, build: function (a, b) { return a + ' + " of " + ' + b; } },
  custom: { label: "Custom expression…", needsB: false, anyType: true, custom: true }
};

/**
 * Escapes text being dropped into an innerHTML string.
 * @param str any value, coerced to string
 * @return str with &<>"' replaced by entities
 * @note Nothing else in this file needs it - a ta's own contentEditable
 * output is trusted verbatim - but a formula chip's text is computed from
 * live variable data, so building its markup is the one place here that turns
 * arbitrary data into HTML.
 */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ---------------------------------------------------------------------------
   THE EXPRESSION LANGUAGE INSIDE {...}

   What a ta types between the braces is a small expression, not just a name:
   {Day1Header}, {Totaldays - Daysprogressed}, {Day1Header + " - day one"}.

   The grammar is deliberately tiny and total - no property access, no calls,
   no assignment - and it is parsed and walked here rather than handed to
   eval(), so a variable name is the ONLY thing an expression can read.

     value     number literal, string literal ("..." or '...', backslash-
               escaped quotes), or a variable's own token
     operator  + - * / with the usual precedence, parentheses, unary minus
     +         concatenates when either side is a string, adds otherwise

   Numbers become text through the chip's format flags wherever they land, so
   {Daysprogressed / Totaldays * 100 + "%":.1f} reads "37.5%".

   An expression that doesn't parse, or names a variable nothing defines,
   doesn't become a chip at all: the literal "{whatever}" text stays as typed,
   which makes a misremembered name something you can see and fix in place
   rather than something that silently vanishes.
   --------------------------------------------------------------------------- */

/**
 * Splits expression source into tokens.
 * @param src the text between "{" and its flags/closing brace
 * @return an array of {t, v} tokens, or null if src contains a character
 *   this grammar has no meaning for (which leaves the ta's text alone)
 */
function fxTokenize(src) {
  var out = [];
  var i = 0;
  while (i < src.length) {
    var c = src.charAt(i);
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === "'") {
      var s = "";
      var j = i + 1;
      while (j < src.length && src.charAt(j) !== c) {
        if (src.charAt(j) === "\\" && j + 1 < src.length) { s += src.charAt(j + 1); j += 2; }
        else { s += src.charAt(j); j++; }
      }
      if (j >= src.length) return null; /* unterminated string */
      out.push({ t: "str", v: s });
      i = j + 1;
      continue;
    }
    var num = /^(?:[0-9]+\.?[0-9]*|\.[0-9]+)/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: parseFloat(num[0]) }); i += num[0].length; continue; }
    var id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
    if (id) { out.push({ t: "id", v: id[0] }); i += id[0].length; continue; }
    if ("+-*/()".indexOf(c) !== -1) { out.push({ t: c }); i++; continue; }
    return null;
  }
  return out;
}

/**
 * Parses expression source into a tree, by recursive descent over
 * fxTokenize()'s tokens.
 * @param src the text between "{" and its flags/closing brace
 * @return the root node, or null if src isn't a complete valid expression
 */
function fxParse(src) {
  var toks = fxTokenize(src);
  if (!toks || !toks.length) return null;
  var pos = 0;
  var peek = function () { return toks[pos]; };

  function primary() {
    var tk = peek();
    if (!tk) return null;
    if (tk.t === "num" || tk.t === "str") { pos++; return { t: tk.t, v: tk.v }; }
    if (tk.t === "id") { pos++; return { t: "var", v: tk.v }; }
    if (tk.t === "(") {
      pos++;
      var inner = additive();
      if (!inner || !peek() || peek().t !== ")") return null;
      pos++;
      return inner;
    }
    return null;
  }
  function unary() {
    if (peek() && peek().t === "-") {
      pos++;
      var n = unary();
      return n ? { t: "neg", a: n } : null;
    }
    return primary();
  }
  function multiplicative() {
    var node = unary();
    while (node && peek() && (peek().t === "*" || peek().t === "/")) {
      var op = toks[pos++].t;
      var rhs = unary();
      node = rhs ? { t: "bin", op: op, a: node, b: rhs } : null;
    }
    return node;
  }
  function additive() {
    var node = multiplicative();
    while (node && peek() && (peek().t === "+" || peek().t === "-")) {
      var op = toks[pos++].t;
      var rhs = multiplicative();
      node = rhs ? { t: "bin", op: op, a: node, b: rhs } : null;
    }
    return node;
  }

  var ast = additive();
  /* trailing junk ("{A B}") is a parse failure, not a prefix match */
  return (ast && pos === toks.length) ? ast : null;
}

/**
 * Reads one variable token as an expression value, applying the same per-type
 * display rules a "value" chip has always used: a number stays a number so it
 * can still be arithmetic, everything else arrives as the text it displays as.
 * @param token an identifier from an expression
 * @return a number or string, or undefined if nothing on the page defines it
 */
function fxVariableValue(token) {
  var v = variableByToken(token);
  if (!v) return undefined;
  if (v.type === "number") {
    var n = parseFloat(v.value);
    return isNaN(n) ? 0 : n;
  }
  if (v.type === "boolean") return v.value ? "Yes" : "No";
  if (v.type === "datetime") {
    var d = v.value ? new Date(v.value) : null;
    return d && !isNaN(d.getTime()) ? d.toLocaleString() : "";
  }
  return v.value == null ? "" : String(v.value);
}

/** Coerces an expression value to a number, 0 when it isn't one - same
    never-throw stance variableNumericValue() takes. */
function fxNumber(v) {
  var n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Renders a number through a chip's format flags.
 * @param n the number
 * @param fmt {decimals, comma} from parseFormatFlags()
 * @note A non-finite result reads as an em dash, the same placeholder the old
 * quotient/percent ops showed for exactly that case.
 */
function fxFormatNumber(n, fmt) {
  if (!isFinite(n)) return "—";
  var dp = fmt.decimals;
  return fmt.comma ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : n.toFixed(dp);
}

/** An expression value as display text - the one place a number turns into
    characters, so the chip's flags apply identically whether the number is
    the whole result or one piece of a concatenation. */
function fxText(v, fmt) {
  return typeof v === "number" ? fxFormatNumber(v, fmt) : String(v);
}

/**
 * Walks a parsed expression.
 * @param node an fxParse() node
 * @param fmt {decimals, comma}, for numbers concatenated into strings
 * @return a number, a string, or undefined
 * @note Returns undefined the moment any variable is unknown, which
 * propagates out so the caller can leave the ta's literal text alone rather
 * than printing a half-resolved result.
 */
function fxEval(node, fmt) {
  if (node.t === "num" || node.t === "str") return node.v;
  if (node.t === "var") return fxVariableValue(node.v);
  if (node.t === "neg") {
    var inner = fxEval(node.a, fmt);
    return inner === undefined ? undefined : -fxNumber(inner);
  }
  var a = fxEval(node.a, fmt);
  if (a === undefined) return undefined;
  var b = fxEval(node.b, fmt);
  if (b === undefined) return undefined;
  if (node.op === "+" && (typeof a === "string" || typeof b === "string")) return fxText(a, fmt) + fxText(b, fmt);
  var x = fxNumber(a);
  var y = fxNumber(b);
  if (node.op === "+") return x + y;
  if (node.op === "-") return x - y;
  if (node.op === "*") return x * y;
  return x / y;
}

/**
 * The whole pipeline: expression source plus format flags to display text.
 * @param src the expression, eg "Totaldays - Daysprogressed"
 * @param fmt {decimals, comma} from parseFormatFlags()
 * @return the text, or undefined if src doesn't parse or names an unknown
 *   variable - the signal for "this isn't a reference, leave it as typed"
 */
function fxEvaluate(src, fmt) {
  var ast = fxParse(src);
  if (!ast) return undefined;
  var v = fxEval(ast, fmt);
  return v === undefined ? undefined : fxText(v, fmt);
}

/**
 * LEGACY. Computes a formula chip's live display text from its op and operand
 * variable KEYS - the shape every chip had before they carried an expression.
 * @param op one of FX_OPS's keys
 * @param aKey variable A's key
 * @param bKey variable B's key, ignored for "value"
 * @param decimals decimal places for any numeric result
 * @param comma true to group thousands (python's "," flag)
 * @return the text to show inside the chip
 * @note Still the renderer for any such chip in already-saved content:
 * nothing rewrites them on load, and the first time a ta edits the field one
 * sits in, it becomes an expression chip like any other.
 * @note Reads current VARIABLES, so it reflects whatever was last fetched -
 * there is no live polling anywhere in this app.
 */
function formulaChipText(op, aKey, bKey, decimals, comma) {
  var dp = parseInt(decimals, 10);
  if (isNaN(dp) || dp < 0) dp = 0;
  var fmtNum = function (n) {
    return comma ? n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp }) : n.toFixed(dp);
  };
  if (op === "value") {
    var a = variableByKey(aKey);
    if (!a) return "";
    if (a.type === "number") return fmtNum(variableNumericValue(aKey));
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
    case "sum": return fmtNum(av + bv);
    case "difference": return fmtNum(av - bv);
    case "product": return fmtNum(av * bv);
    case "quotient": return bv === 0 ? "—" : fmtNum(av / bv);
    case "percent": return bv === 0 ? "—" : fmtNum(av / bv * 100) + "%";
    case "fraction": return fmtNum(av) + " of " + fmtNum(bv);
    default: return "";
  }
}

/**
 * Builds the <span> markup for an expression chip: the source and its format
 * flags baked into data-fx-* attributes, riding along inside the same
 * content.text HTML string as everything else in the field.
 * @param expr the expression source, see fxParse()
 * @param decimals decimal places for any numeric result
 * @param comma true to group thousands (python's "," flag)
 * @return an HTML string for a single <span class="fx-chip">
 * @note Same self-describing-inline-span approach as the toolbar's foreColor
 * spans. contenteditable="false" makes the browser treat it as one atomic
 * unit for caret navigation - but only OUTSIDE an edit session: a field being
 * edited holds no chips at all, just the notation text they came from.
 * @note The expression references variables by their typed token rather than
 * their internal key, because that's what the ta wrote and will see again.
 * Renaming a variable therefore breaks references to it, as renaming a named
 * range breaks a spreadsheet formula - and breaks it visibly, back into the
 * literal "{OldName}" text that says exactly what went missing.
 */
function buildExpressionChipHtml(expr, decimals, comma) {
  var dp = parseInt(decimals, 10);
  if (isNaN(dp) || dp < 0) dp = 0;
  var text = fxEvaluate(expr, { decimals: dp, comma: !!comma });
  var attrs = ' data-fx-expr="' + escapeHtml(expr) + '"' +
    ' data-fx-decimals="' + dp + '"' +
    (comma ? ' data-fx-comma="1"' : '');
  return '<span class="fx-chip" contenteditable="false"' + attrs + '>' + escapeHtml(text === undefined ? "" : text) + '</span>';
}

/**
 * The python-style format-flag suffix a chip's decimals/comma settings spell
 * out - the exact inverse of parseFormatFlags(), used to show a chip's real,
 * re-typable notation.
 * @param decimals decimal places, as stored in data-fx-decimals
 * @param comma true to include the "," thousands-separator flag
 * @return "" (no flags), or ":" plus the flag characters
 * @note Decimals of 0 - the default - omits the ".0f" clause entirely, so the
 * common case stays as clean as what a ta would type by hand.
 */
function formulaFlagString(decimals, comma) {
  var dp = parseInt(decimals, 10);
  var flags = (comma ? "," : "") + (!isNaN(dp) && dp > 0 ? "." + dp + "f" : "");
  return flags ? ":" + flags : "";
}

/**
 * The literal text one chip came from, and the text it goes back to for the
 * whole of an edit session. Retyping it character for character rebuilds the
 * same chip - that round trip is why chips can be edited as ordinary text.
 * @param chip a .fx-chip element of any kind
 * @return the "{...}" text
 * @note An expression chip gives its own source; a local chip the
 * tile-relative token its tile resolves; a legacy op chip the equivalent
 * expression, which is how a chip saved before expressions existed migrates
 * the first time its field is edited.
 */
function chipNotation(chip) {
  if (chip.dataset.fxLocal) return "{" + localChipToken(chip) + "}";
  var flags = formulaFlagString(chip.dataset.fxDecimals, chip.dataset.fxComma === "1");
  if (chip.dataset.fxExpr) return "{" + chip.dataset.fxExpr + flags + "}";
  var op = FX_OPS[chip.dataset.fxOp || "value"] || FX_OPS.value;
  var aTok = variableNotationToken(variableByKey(chip.dataset.fxA)) || chip.dataset.fxA || "?";
  var bTok = variableNotationToken(variableByKey(chip.dataset.fxB)) || chip.dataset.fxB || "?";
  return "{" + (op.build ? op.build(aTok, bTok) : aTok) + flags + "}";
}

/**
 * Repaints every formula chip's displayed text against current VARIABLES -
 * the same role for chips that repaintInlineTextColors() plays for foreColor
 * spans.
 * @note applyTextOverrides() has just set each field's innerHTML from its
 * saved snapshot, which may carry a chip's stale baked-in text, so every load
 * and every VARIABLES refresh needs to re-render from live data. Called again
 * whenever a gallery pane moves, since a chip can be built on a pane variable.
 * @note No mid-edit case to handle: a field being edited has no chips in it,
 * only the notation text they were unpacked into.
 * @note Local chips share the .fx-chip class but carry no expression and
 * resolve through repaintLocalTileContent(), so they're skipped here rather
 * than blanked and restored.
 */
function repaintFormulaChips() {
  document.querySelectorAll(".fx-chip:not([data-fx-local])").forEach(function (chip) {
    var comma = chip.dataset.fxComma === "1";
    if (chip.dataset.fxExpr) {
      var dp = parseInt(chip.dataset.fxDecimals, 10);
      var text = fxEvaluate(chip.dataset.fxExpr, { decimals: isNaN(dp) || dp < 0 ? 0 : dp, comma: comma });
      chip.textContent = text === undefined ? "" : text;
      return;
    }
    /* saved before expressions existed, see formulaChipText() */
    chip.textContent = formulaChipText(chip.dataset.fxOp, chip.dataset.fxA, chip.dataset.fxB, chip.dataset.fxDecimals, comma);
  });
}

/* ---------------------------------------------------------------------------
   TYPING {expr}/{expr:flags} BY HAND

   A chip's notation isn't only for display: it is the editable form. For the
   whole of an edit session a field holds nothing but text, which the ta can
   select, cut, retype and rearrange with no atomic anything in the way, and
   which turns back into live chips the moment they're done.

   A token that doesn't parse, or names a variable that doesn't exist, simply
   stays as the text it is. That's the point: typing "{pvar}" over "{var}"
   leaves it sitting there in plain sight rather than erasing itself. \{ and
   \} escape a literal brace that was never meant to be notation.
   --------------------------------------------------------------------------- */

/* matches either an escaped brace (\{ or \}, captured in group 1 with the
   backslash) or a whole {...} token (its body in group 2). The body excludes
   "{"/"}" so a malformed/nested run of braces can never make this greedily
   swallow more than one token's worth of text. Splitting the body into
   expression and flags is splitTokenBody()'s job, not the regex's - a ":"
   can legitimately sit inside a string literal in the expression itself. */
var VARIABLE_TOKEN_RE = /\\([{}])|\{([^{}]*)\}/g;

/**
 * Parses the flags after a {expr:flags} token's ":" - the same python-style
 * subset formulaFlagString() produces: an optional "," then an optional
 * ".Nf", in that order. A bare "{expr}" means 0 decimals and no grouping.
 * @param flags the raw text between ":" and the closing "}", or undefined
 * @return {decimals, comma}, or null if flags doesn't match this grammar -
 *   an unrecognized flag string is left as plain text rather than guessed at
 */
function parseFormatFlags(flags) {
  if (flags === undefined) return { decimals: 0, comma: false };
  var m = /^(,)?(?:\.([0-9])f)?$/.exec(flags);
  if (!m) return null;
  return { comma: !!m[1], decimals: m[2] !== undefined ? parseInt(m[2], 10) : 0 };
}

/**
 * Splits a token's body into its expression and its format flags.
 * @param body the text between "{" and "}"
 * @return {expr, flags, hasFlags}
 * @note The separator is a ":", but not just any ":": an expression can
 * contain string literals, and {Day1Header + "10:30"} has one that means
 * nothing of the sort. So this scans right to left over the colons OUTSIDE
 * every string literal and takes the first whose tail parses as flags.
 */
function splitTokenBody(body) {
  var cuts = [];
  var quote = "";
  for (var i = 0; i < body.length; i++) {
    var c = body.charAt(i);
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ":") cuts.push(i);
  }
  for (var j = cuts.length - 1; j >= 0; j--) {
    var flags = parseFormatFlags(body.slice(cuts[j] + 1));
    if (flags) return { expr: body.slice(0, cuts[j]), flags: flags, hasFlags: true };
  }
  return { expr: body, flags: { decimals: 0, comma: false }, hasFlags: false };
}

/**
 * The chip markup one {...} token should become, or null if it should stay
 * the text it is.
 * @param body the text between "{" and "}"
 * @param field the field being parsed, for the containing-tile test
 * @return an HTML string for one chip, or null
 * @note A bare token naming one of the CONTAINING TILE's own locals rebuilds
 * the tile-relative chip rather than an absolute reference: {Day1Header}
 * typed inside Day 1's tile is the template's "this day's header", which is
 * what makes it read Day 2's header on Day 2's copy. The same token typed
 * anywhere else is an ordinary absolute reference to Day 1.
 */
function chipHtmlForToken(body, field) {
  var split = splitTokenBody(body);
  var expr = split.expr.trim();
  if (!expr) return null;
  if (!split.hasFlags) {
    var local = localChipHtmlForToken(expr, field);
    if (local) return local;
  }
  /* an expression that doesn't parse, or that reaches for a variable nothing
     defines, is not a reference at all - the ta's own text stands */
  if (fxEvaluate(expr, split.flags) === undefined) return null;
  return buildExpressionChipHtml(expr, split.flags.decimals, split.flags.comma);
}

/**
 * The local-chip markup a token rebuilds, if it names something local at all
 * - the exact inverse of localChipToken().
 * @param token a bare identifier from inside {...}
 * @param field the field being parsed
 * @return an HTML string for one chip, or null if token names no local
 * @note Everything but the gallery's two pane variables is TILE-RELATIVE, so
 * the token has to match a tile the field is inside; the pane variables carry
 * their own binding and resolve from anywhere on the page.
 */
function localChipHtmlForToken(token, field) {
  var closest = function (sel) { return field && field.closest ? field.closest(sel) : null; };
  var dTile = closest("[data-days-tile]");
  var dBase = dTile && dTile.dataset.daysVar;
  if (dBase) {
    var locals = Object.keys(DAYS_CHIP_VAR_SUFFIX);
    for (var i = 0; i < locals.length; i++) {
      if (token === dBase + DAYS_CHIP_VAR_SUFFIX[locals[i]]) return buildDaysChipHtml(locals[i], token);
    }
  }
  var xTile = closest("[data-extras-tile]");
  var xBase = xTile && xTile.dataset.extrasVar;
  if (xBase && token === xBase + "Name") return buildExtrasFilenameChipHtml();
  var gTile = closest("[data-gallery-tile]");
  var gDir = gTile && gTile.dataset.galleryDir;
  if (gDir && token === galleryVarScope(gDir) + "Name") return buildGalleryDirChipHtml();
  var v = variableByToken(token);
  var g = v && v.derived ? galleryVarOf(v.key) : null;
  return g ? buildGalleryChipHtml(g.local, g.dir) : null;
}

/**
 * Scans one text node for {...} tokens and \{ \} escapes, replacing it in
 * place with a mix of plain text and new chips wherever a token resolves.
 * @param textNode a Text node currently attached to the document
 * @param field the field being parsed, for tile-relative locals
 * @return true if this node was rewritten
 * @note Anything that doesn't resolve is left completely alone as ordinary
 * text, so a stray "{" typed for any other reason is never assumed to be a
 * mistake.
 */
function parseVariableTokensInNode(textNode, field) {
  var text = textNode.nodeValue;
  if (text.indexOf("{") === -1 && text.indexOf("\\") === -1) return false;
  var frag = document.createDocumentFragment();
  var last = 0;
  var changed = false;
  var m;
  VARIABLE_TOKEN_RE.lastIndex = 0;
  while ((m = VARIABLE_TOKEN_RE.exec(text))) {
    if (m[1]) {
      /* \{ or \} - literal brace, backslash dropped */
      frag.appendChild(document.createTextNode(text.slice(last, m.index) + m[1]));
      last = VARIABLE_TOKEN_RE.lastIndex;
      changed = true;
      continue;
    }
    var html = chipHtmlForToken(m[2], field);
    if (!html) continue; /* not a reference - leave as text */
    frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    var holder = document.createElement("span");
    holder.innerHTML = html;
    frag.appendChild(holder.firstChild);
    last = VARIABLE_TOKEN_RE.lastIndex;
    changed = true;
  }
  if (!changed) return false;
  frag.appendChild(document.createTextNode(text.slice(last)));
  textNode.parentNode.replaceChild(frag, textNode);
  return true;
}

/**
 * Unpacks every chip in a field into the plain notation text it came from,
 * run the moment the field enters edit mode.
 * @param field the field about to become contentEditable
 * @note This is what makes a variable reference behave like the text it looks
 * like: for the whole session there is no contenteditable="false" atom in the
 * field, so a ta can put the caret inside "{Day1Header}", retype half of it,
 * or wrap text around it with ordinary text editing.
 * @note The previous design kept chips atomic and only swapped their LABEL to
 * the notation, which looked identical but wasn't: the only edit those braces
 * accepted was deleting the whole chip.
 */
function chipsToNotation(field) {
  field.querySelectorAll(".fx-chip").forEach(function (chip) {
    var text = chipNotation(chip);
    /* a local chip whose tile carries no variable scope at all (the trailing
       synthetic locked card) has no token to spell, and "{}" would parse
       back as nothing - leave that one atomic rather than dissolving it */
    if (text === "{}") return;
    chip.parentNode.replaceChild(document.createTextNode(text), chip);
  });
  /* a chip sat between two text nodes; with it gone they're one run of text,
     and a token typed across what used to be that seam has to read as one
     token rather than as two neighbouring halves the parser can't see */
  field.normalize();
}

/**
 * Converts every {...} token in a field back into a live chip - the exact
 * inverse of chipsToNotation().
 * @param field the data-edit-id field whose edit session just ended
 * @return true if anything in the field was rewritten
 * @note Run once, right before an edit session commits, rather than per
 * keystroke: rewriting the DOM under a focused caret is what makes a cursor
 * jump mid-sentence, and half-typed notation shouldn't resolve out from under
 * the ta anyway.
 * @note Walks a TreeWalker snapshot taken up front, so rewriting one node
 * can't disturb the walk, and normalizes first so a token split across
 * adjacent text nodes is still one token by the time the regex sees it.
 */
function parseVariableTokens(field) {
  field.normalize();
  var texts = [];
  var walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT, null, false);
  var n;
  while ((n = walker.nextNode())) {
    if (!n.parentElement || !n.parentElement.closest(".fx-chip")) texts.push(n);
  }
  var changed = false;
  texts.forEach(function (t) { if (parseVariableTokensInNode(t, field)) changed = true; });
  return changed;
}

/**
 * Builds the markup for a "filename" chip: an attachments-tile-only variant
 * of the formula chip that resolves off whichever tile it's rendered inside
 * rather than a content.variables lookup.
 * @return an HTML string for a single <span class="fx-chip">
 * @note Because it's tile-local it deliberately never appears in the content
 * manager's variables list.
 * @note It lives inside the shared tile text template, so backspacing it out
 * removes it from every tile at once, like any other template edit.
 */
function buildExtrasFilenameChipHtml() {
  return '<span class="fx-chip" contenteditable="false" data-fx-local="filename">filename</span>';
}

/**
 * Repaints every filename chip's text off the tile it's actually rendered
 * inside right now.
 * @note Needed because saved template HTML carries whichever tile's filename
 * was resolved when it was last saved - and mirrorEditedField() blindly
 * copies one tile's innerHTML onto every other tile sharing the id, which is
 * right for every other chip but would leave them all showing the edited
 * tile's filename.
 * @note Called unconditionally at the end of mirrorEditedField(), a cheap
 * no-op where no filename chip exists.
 */
function repaintExtrasFilenameChips() {
  document.querySelectorAll('.fx-chip[data-fx-local="filename"]').forEach(function (chip) {
    var tile = chip.closest("[data-extras-tile]");
    chip.textContent = (tile && tile.dataset.extrasFilename) || "";
  });
}

/* the variable-name suffix each day-tile local chip stands for, appended to
   the tile's own data-days-var scope ("Day3") to spell the whole name a ta
   sees while editing the field: ${Day3Header}, ${Day3OpensAt}, and so on.
   The filename chip's own scope lives on the attachment tile instead
   (data-extras-var, eg "Day3Attachment2" -> ${Day3Attachment2Name}), since
   an attachment tile is the thing that repeats there. */
var DAYS_CHIP_VAR_SUFFIX = {
  "day-number": "Number",
  "day-date": "OpensAt",
  "day-locked": "Locked",
  "day-title": "Header",
  "day-blurb": "Body"
};

/* what each local resolves to off its own tile's dataset, in one table so
   adding a sixth is one line rather than a fourth near-identical query loop.
   Shared by repaintDaysChips() (a chip inside its own tile) and
   dayTileVariableFor() (the same value read from anywhere on the page). */
var DAYS_CHIP_RESOLVERS = {
  "day-number": function (t) { return t.dataset.daysNumber ? "Day " + t.dataset.daysNumber : ""; },
  "day-date": function (t) { return t.dataset.daysDate || ""; },
  "day-locked": function (t) { return t.dataset.daysLocked === "1" ? "Yes" : "No"; },
  "day-title": function (t) { return t.dataset.daysTitle || ""; },
  "day-blurb": function (t) { return t.dataset.daysBlurb || ""; }
};

/**
 * The bare variable token a local chip stands for - what chipNotation() wraps
 * in braces to unpack the chip into editable text, and what
 * localChipHtmlForToken() reads to pack it back.
 * @param chip a .fx-chip element carrying data-fx-local
 * @return the token, or "" if its tile carries no variable scope
 * @note That round trip is the spec's "upon editing them, users will just see
 * the variable inline", literally. These names are per-tile and exist nowhere
 * else - not in content.variables, so they never appear in the manager's
 * list, and the only way to change what one RESOLVES to is the day panel.
 */
function localChipToken(chip) {
  var local = chip.dataset.fxLocal;
  /* the gallery's two page-level variables name their PANE BINDING, not a
     tile they sit inside - they're placed anywhere on the page (see
     buildGalleryChipHtml()) - so their scope comes off the chip itself */
  if (local === "gallery-current" || local === "gallery-total") {
    return galleryVarScope(chip.dataset.fxDir || "") + (local === "gallery-current" ? "Current" : "Total");
  }
  if (local === "gallery-dir") {
    var gTile = chip.closest("[data-gallery-tile]");
    var gDir = gTile && gTile.dataset.galleryDir;
    return gDir ? galleryVarScope(gDir) + "Name" : "";
  }
  if (local === "filename") {
    var xTile = chip.closest("[data-extras-tile]");
    var xBase = xTile && xTile.dataset.extrasVar;
    return xBase ? xBase + "Name" : "";
  }
  var suffix = DAYS_CHIP_VAR_SUFFIX[local];
  var dTile = chip.closest("[data-days-tile]");
  var dBase = dTile && dTile.dataset.daysVar;
  return (suffix && dBase) ? dBase + suffix : "";
}

/**
 * Repaints every local chip, every expression chip and every per-tile
 * attachment icon at once - the whole "this resolves differently depending on
 * live state" set. Called whenever a text field leaves edit mode, and after
 * any render or mirror that could have copied one tile's text onto another's.
 * @note repaintFormulaChips() belongs here rather than only inside
 * repaintGalleryChips(), which returns early on any page without
 * js/gallery.js - silently skipping expression-chip repainting everywhere but
 * the gallery. Harmless while a chip's text never changed after being placed,
 * but once a chip could be rebuilt from notation on blur, that gate left one
 * inserted on any other page showing its leftover "{...}" text forever.
 */
function repaintLocalTileContent() {
  repaintExtrasFilenameChips();
  repaintDaysChips();
  repaintGalleryChips();
  repaintFormulaChips();
  repaintExtrasTypeIcons();
}

/**
 * Paints each placed "attachment icon" element with the glyph for the tile
 * it's actually sitting on.
 * @note This is the tile-exclusive element the right-click menu only offers
 * inside an attachments tile: one element, but a .pdf tile draws the document
 * glyph and a link tile the chain, because the icon is a property of the
 * attachment, not of the element a ta placed.
 * @note Resolved through js/dashboard.js so the glyph set lives in one place;
 * a no-op on every page that doesn't load it.
 */
function repaintExtrasTypeIcons() {
  if (!window.attachmentIconSvgFor) return;
  document.querySelectorAll("[data-extras-typeicon]").forEach(function (el) {
    el.innerHTML = window.attachmentIconSvgFor(el.closest("[data-extras-tile]"));
  });
}

/**
 * Restores the filename chip into the shared tile text template, so a ta who
 * backspaced it out can bring it back without retyping the rest by hand.
 * @param tile the [data-extras-tile] the context menu was opened on
 * @note Goes through the same commit/mirror path a typed edit does, so undo
 * and cross-tile mirroring work identically - the restored chip then shows up
 * on every tile, like any other template edit.
 */
function insertExtrasFilenameChip(tile) {
  var field = tile.querySelector('[data-extras-role="text"]');
  if (!field) return;
  var before = field.innerHTML;
  field.innerHTML = before + (before ? " " : "") + buildExtrasFilenameChipHtml();
  commitTextFieldChange(field, before, field.innerHTML);
}

/**
 * A day tile's local chip variants (day-number/day-date/day-locked): the same
 * "resolves off whichever tile it's rendered inside" idea as the filename
 * chip, so none of these appear in the content manager's variables list.
 * @param local "day-number", "day-date", or "day-locked"
 * @param label the chip's placeholder text before it resolves
 * @return an HTML string for a single <span class="fx-chip">
 * @note day-locked reads as plain "Yes"/"No", the convention a real boolean
 * variable's chip already uses - no boolean machinery had to change, this is
 * a third local source feeding the same display rule.
 */
function buildDaysChipHtml(local, label) {
  return '<span class="fx-chip" contenteditable="false" data-fx-local="' + local + '">' + label + '</span>';
}

/**
 * Repaints every day-tile local chip off the tile it's actually rendered
 * inside, the same "undo mirrorEditedField()'s blind copy" reasoning as
 * repaintExtrasFilenameChips().
 * @note data-days-date is already the tile's pre-formatted display date, not
 * a raw ISO string, so no date formatting is duplicated here.
 */
function repaintDaysChips() {
  Object.keys(DAYS_CHIP_RESOLVERS).forEach(function (local) {
    document.querySelectorAll('.fx-chip[data-fx-local="' + local + '"]').forEach(function (chip) {
      var tile = chip.closest("[data-days-tile]");
      chip.textContent = tile ? DAYS_CHIP_RESOLVERS[local](tile) : "";
    });
  });
}

/**
 * Which field on a day tile each local chip is restored INTO.
 * @note The day/date/locked chips go to whichever generic "day tag" field the
 * template has; title and description belong to their own dedicated fields,
 * so a ta who deleted the title variable gets it back in the title field
 * rather than glued onto the day tag.
 */
var DAYS_CHIP_FIELD = {
  "day-title": '[data-days-role="open.title"]',
  "day-blurb": '[data-days-role="open.blurb"]'
};
var DAYS_CHIP_DEFAULT_FIELD = '[data-days-role="locked.title"], [data-days-role="open.daytag"]';

/**
 * Restores one local chip into the tile's matching text field, from the day
 * tile's right-click "Insert ..." actions.
 * @param tile the [data-days-tile] the context menu was opened on
 * @param local a DAYS_CHIP_VAR_SUFFIX key
 * @note Same commit/mirror path a typed edit takes, so undo and cross-tile
 * mirroring work identically. This is the whole recovery route for a deleted
 * variable: a ta can retype around it or delete it outright and still get it
 * back without hand-writing any markup.
 */
function insertDaysChip(tile, local) {
  var field = tile.querySelector(DAYS_CHIP_FIELD[local] || DAYS_CHIP_DEFAULT_FIELD);
  if (!field) return;
  var labels = {
    "day-number": "Day #", "day-date": "date", "day-locked": "locked",
    "day-title": "Title", "day-blurb": "Description"
  };
  var before = field.innerHTML;
  field.innerHTML = before + (before ? " " : "") + buildDaysChipHtml(local, labels[local] || local);
  commitTextFieldChange(field, before, field.innerHTML);
}

/* ---------------------------------------------------------------------------
   DAY TILE / ATTACHMENT TILE LOCALS, READ AS ORDINARY VARIABLE RECORDS

   The locals above only resolve for a chip physically inside their own tile -
   right for the tile's template, but it means nothing elsewhere on the page
   can read, say, Day 1's title. This section makes the same live values
   reachable from anywhere, as the gallery's own variables are: a derived
   record rather than something stored, keyed with TILE_VAR_PREFIX so it can
   never collide with a real content.variables key.

   That's what lets a chip, or typed {Day1Header} notation, reference any
   tile's data from anywhere. Offered on every page rather than gated by
   currentPageKey(), since day and extras tiles aren't exclusive to one page
   the way gallery panes are.
   --------------------------------------------------------------------------- */

/* the key prefix every tile-local variable record uses, so variableByKey()
   can recognize one before falling through to the VARIABLES array - same
   "disjoint prefix" idea as GALLERY_ACTION_PREFIX/galleryVarKey(). */
var TILE_VAR_PREFIX = "tile:";

/**
 * Every day tile currently on the page, one entry per distinct scope.
 * @return an array of {scope, tile}, tile being the first seen for that scope
 * @note A day can render as more than one tile (locked vs open template) but
 * they share a scope and so collapse to a single set of variables.
 */
function dayTileScopes() {
  var seen = {};
  var out = [];
  document.querySelectorAll("[data-days-tile]").forEach(function (tile) {
    var scope = tile.dataset.daysVar;
    if (!scope || seen[scope]) return;
    seen[scope] = true;
    out.push({ scope: scope, tile: tile });
  });
  return out;
}

/**
 * Builds the variable-shaped record one day tile local resolves to, read live
 * off whichever tile currently carries that scope.
 * @param key a key built as TILE_VAR_PREFIX + "day:" + scope + ":" + local
 * @return a {key, name, type, value} record, or null if key isn't one
 * @note Resolves to "" rather than null when no tile carries the scope (a
 * since-deleted day), so a reference reads blank instead of vanishing.
 */
function dayTileVariableFor(key) {
  var prefix = TILE_VAR_PREFIX + "day:";
  if (typeof key !== "string" || key.indexOf(prefix) !== 0) return null;
  var rest = key.slice(prefix.length);
  var cut = rest.indexOf(":");
  if (cut === -1) return null;
  var scope = rest.slice(0, cut);
  var local = rest.slice(cut + 1);
  var suffix = DAYS_CHIP_VAR_SUFFIX[local];
  var resolver = DAYS_CHIP_RESOLVERS[local];
  if (!suffix || !resolver) return null;
  var found = dayTileScopes().filter(function (s) { return s.scope === scope; })[0];
  /* derived - see variableNotationToken(). .key here is the internal
     TILE_VAR_PREFIX form (unique, disambiguated), but the token a ta
     actually types is the same bare "Day1Header" a local chip already shows
     while mid-edit, see localChipToken() */
  return { key: key, name: scope + suffix, type: "string", value: found ? resolver(found.tile) : "",
    derived: true, token: scope + suffix };
}

/**
 * Every day tile's own five local variables, in tile order - the day-tile
 * half of pageLocalVariables()'s extension. See dayTileVariableFor().
 * @return an array of variable records
 */
function dayTileVariableInventory() {
  var out = [];
  dayTileScopes().forEach(function (s) {
    Object.keys(DAYS_CHIP_VAR_SUFFIX).forEach(function (local) {
      out.push(dayTileVariableFor(TILE_VAR_PREFIX + "day:" + s.scope + ":" + local));
    });
  });
  return out;
}

/**
 * Every attachment tile currently on the page, one entry per distinct scope
 * (dataset.extrasVar, eg "Day1Attachment2") - same dedupe idea as
 * dayTileScopes().
 * @return an array of {scope, tile}
 */
function extrasTileScopes() {
  var seen = {};
  var out = [];
  document.querySelectorAll("[data-extras-tile]").forEach(function (tile) {
    var scope = tile.dataset.extrasVar;
    if (!scope || seen[scope]) return;
    seen[scope] = true;
    out.push({ scope: scope, tile: tile });
  });
  return out;
}

/**
 * Builds the variable-shaped record one attachment tile's filename resolves
 * to, read live off whichever tile carries that scope - the extras-tile
 * counterpart of dayTileVariableFor().
 * @param key a key built as TILE_VAR_PREFIX + "extras:" + scope
 * @return a {key, name, type, value} record, or null if key isn't one
 */
function extrasTileVariableFor(key) {
  var prefix = TILE_VAR_PREFIX + "extras:";
  if (typeof key !== "string" || key.indexOf(prefix) !== 0) return null;
  var scope = key.slice(prefix.length);
  if (!scope) return null;
  var found = extrasTileScopes().filter(function (s) { return s.scope === scope; })[0];
  /* derived - see variableNotationToken() */
  return { key: key, name: scope + "Name", type: "string", value: found ? (found.tile.dataset.extrasFilename || "") : "",
    derived: true, token: scope + "Name" };
}

/**
 * Every attachment tile's own filename variable, in tile order - the
 * extras-tile half of pageLocalVariables()'s extension. See
 * extrasTileVariableFor().
 * @return an array of variable records
 */
function extrasTileVariableInventory() {
  return extrasTileScopes().map(function (s) { return extrasTileVariableFor(TILE_VAR_PREFIX + "extras:" + s.scope); });
}

/**
 * Every directory tile currently in the gallery's rail, one entry per distinct
 * directory - same dedupe idea as extrasTileScopes(), keyed by the directory
 * name the tile is bound to.
 * @return an array of {scope, tile}, scope being the directory name
 */
function galleryDirTileScopes() {
  var seen = {};
  var out = [];
  document.querySelectorAll("[data-gallery-tile]").forEach(function (tile) {
    var scope = tile.dataset.galleryDir;
    if (!scope || seen[scope]) return;
    seen[scope] = true;
    out.push({ scope: scope, tile: tile });
  });
  return out;
}

/**
 * Builds the variable-shaped record one directory tile's NAME resolves to -
 * the rail's counterpart of extrasTileVariableFor(), and the record behind
 * the name chip a directory tile's label ships with.
 * @param key a key built as TILE_VAR_PREFIX + "gallerydir:" + directory name
 * @return a {key, name, type, value} record, or null if key isn't one
 * @note It could always be typed and always resolved, but nothing OFFERED
 * it: the formula picker is built from pageLocalVariables(), and the gallery
 * only contributed its two per-pane numbers - so the one variable a ta needs
 * while editing a directory tile was the one they had to already know.
 */
function galleryDirVariableFor(key) {
  var prefix = TILE_VAR_PREFIX + "gallerydir:";
  if (typeof key !== "string" || key.indexOf(prefix) !== 0) return null;
  var scope = key.slice(prefix.length);
  if (!scope) return null;
  var found = galleryDirTileScopes().filter(function (s) { return s.scope === scope; })[0];
  /* derived - see variableNotationToken(). The token is the same bare
     "Gallery2026Name" a directory label's own chip shows while mid-edit, see
     localChipToken(). */
  return { key: key, name: galleryVarScope(scope) + "Name", type: "string",
    value: found ? (found.tile.dataset.galleryDir || "") : "",
    derived: true, token: galleryVarScope(scope) + "Name" };
}

/**
 * Every directory tile's own name variable, in rail order.
 * @return an array of variable records
 */
function galleryDirVariableInventory() {
  return galleryDirTileScopes().map(function (s) {
    return galleryDirVariableFor(TILE_VAR_PREFIX + "gallerydir:" + s.scope);
  });
}

/* ---------------------------------------------------------------------------
   THE GALLERY PAGE'S OWN VARIABLES AND ACTIONS

   Both exist per PANE BINDING rather than per element: a placed pane names a
   directory, and that binding is what brings a pair of variables (which image
   it's on, how many there are) and a pair of actions (step back, step
   forward) into existence. Two directories on the page therefore means four
   variables to pick from.

   Neither is site content. The variables are LOCAL CHIPS, so they never enter
   content.variables and never appear in the content manager - they're
   meaningless anywhere but here. They DO show up in the formula picker, but
   only while editing this page, and as derived entries rather than stored
   ones. The actions aren't stored either: they're derived from whichever
   panes are placed, and an element "is" the forward button purely because its
   content.links entry points at one.
   --------------------------------------------------------------------------- */

/* the seeded pane's binding: "whatever the directory rail has selected", as
   opposed to a pane pinned to one named directory. Spelled as a constant
   rather than a bare "" everywhere so the two meanings of an empty string
   (this, versus "no directory at all") can't be confused. */
var GALLERY_SELECTED_DIR = "";

/**
 * The variable-name scope one pane binding contributes: "Gallery2026" for a
 * pane pinned to "2026", "GallerySelected" for one following the rail.
 * @param dir the binding's directory name, or "" for the rail-following one
 * @return the scope, eg "Gallery2026"
 * @note Non-alphanumerics are dropped, so a directory named "Field trip 2027"
 * still spells a token a ta can read and type back.
 */
function galleryVarScope(dir) {
  if (!dir) return "GallerySelected";
  return "Gallery" + String(dir).replace(/[^A-Za-z0-9]/g, "");
}

/**
 * Every distinct pane binding currently on the page, in the order the panes
 * were placed.
 * @return an array of directory names ("" for the rail-following binding)
 * @note Read off the live DOM rather than CUSTOM_ELEMENTS, so a just-deleted
 * pane stops offering its variables and actions immediately.
 */
function galleryPaneBindings() {
  var seen = {};
  var out = [];
  document.querySelectorAll("[data-gallery-pane]").forEach(function (pane) {
    var dir = pane.getAttribute("data-gallery-dir") || GALLERY_SELECTED_DIR;
    if (seen[dir]) return;
    seen[dir] = true;
    out.push(dir);
  });
  return out;
}

/**
 * How one binding reads in a menu: the directory's own name, or the wording
 * that explains what the rail-following binding actually does.
 * @param dir a binding's directory name
 * @return the label
 */
function galleryBindingLabel(dir) {
  return dir || "Selected directory";
}

/**
 * Builds one gallery variable chip - the page-exclusive equivalent of
 * buildDaysChipHtml(), carrying the binding it reads from in data-fx-dir
 * rather than resolving off a tile it sits inside, since these are placed
 * anywhere on the page rather than inside anything.
 * @param local "gallery-current" or "gallery-total"
 * @param dir the binding's directory name, "" for the rail-following one
 * @return an HTML string for a single <span class="fx-chip">
 */
function buildGalleryChipHtml(local, dir) {
  /* "1" is only the placeholder shown until repaintGalleryChips() resolves it
     against the pane, same as every other chip's own label */
  return '<span class="fx-chip" contenteditable="false" data-fx-local="' + escapeHtml(local) +
    '" data-fx-dir="' + escapeHtml(dir || "") + '">1</span>';
}

/**
 * Builds a directory tile's own name chip. Tile-local like the filename and
 * day chips, which is what lets one shared label template print a different
 * directory name on every tile in the rail.
 * @return an HTML string for a single <span class="fx-chip">
 */
function buildGalleryDirChipHtml() {
  return '<span class="fx-chip" contenteditable="false" data-fx-local="gallery-dir">name</span>';
}

/**
 * Repaints every gallery chip off live data: the two page-level ones through
 * js/gallery.js's hook (it owns which image each binding is on), the per-tile
 * name chip off the tile it's inside. A no-op on pages without that file.
 */
function repaintGalleryChips() {
  document.querySelectorAll('.fx-chip[data-fx-local="gallery-dir"]').forEach(function (chip) {
    var tile = chip.closest("[data-gallery-tile]");
    chip.textContent = (tile && tile.dataset.galleryDir) || "";
  });
  if (!window.galleryChipValue) return;
  document.querySelectorAll('.fx-chip[data-fx-local="gallery-current"], ' +
    '.fx-chip[data-fx-local="gallery-total"]').forEach(function (chip) {
    chip.textContent = window.galleryChipValue(chip.dataset.fxLocal, chip.dataset.fxDir || "");
  });
  /* a formula chip can be built on a pane variable too, and those read live
     off the pane, so stepping an image has to repaint them alongside the
     local chips. Kept here because js/gallery.js calls this directly on every
     step, independent of any field entering or leaving edit mode. */
  repaintFormulaChips();
}

/**
 * Appends one gallery variable chip to the end of a text field, through the
 * same commit path a typed edit takes - the gallery's answer to
 * insertDaysChip(), reached from the right-click menu.
 * @param field the [data-edit-id] text field to insert into
 * @param local "gallery-current" or "gallery-total"
 * @param dir the binding to read from
 */
function insertGalleryChip(field, local, dir) {
  if (!field) return;
  var before = field.innerHTML;
  field.innerHTML = before + (before ? " " : "") + buildGalleryChipHtml(local, dir);
  commitTextFieldChange(field, before, field.innerHTML);
}

/**
 * The key a chip or progress binding uses to name one of this page's pane
 * variables: "gallery:current" for the rail-following pane,
 * "gallery:total:2026" for one pinned to a directory.
 * @param local "gallery-current" or "gallery-total"
 * @param dir the binding's directory name, "" for the rail-following one
 * @return the key
 * @note Same prefix and shape as an action link value, with disjoint verbs so
 * the two lookups can never claim each other's strings.
 */
function galleryVarKey(local, dir) {
  return GALLERY_ACTION_PREFIX + (local === "gallery-total" ? "total" : "current") + (dir ? ":" + dir : "");
}

/**
 * Parses a variable key as one of this page's pane variables.
 * @param key a variable key from anywhere (a formula chip's data-fx-a, a
 *   progress element's varCurrent, ...)
 * @return {local, dir}, or null if it isn't a gallery variable at all
 */
function galleryVarOf(key) {
  if (typeof key !== "string" || key.indexOf(GALLERY_ACTION_PREFIX) !== 0) return null;
  var rest = key.slice(GALLERY_ACTION_PREFIX.length);
  var cut = rest.indexOf(":");
  var verb = cut === -1 ? rest : rest.slice(0, cut);
  if (verb !== "current" && verb !== "total") return null;
  return { local: "gallery-" + verb, dir: cut === -1 ? "" : rest.slice(cut + 1) };
}

/**
 * Builds the variable-shaped record one pane variable resolves to, read live
 * off js/gallery.js rather than out of any stored value - so it's a fresh
 * reading every time, and whatever is built on it repaints with the pane.
 * @param key a key from galleryVarKey()
 * @return a {key, name, type, value} record, or null if key isn't one
 */
function galleryVariableFor(key) {
  var g = galleryVarOf(key);
  if (!g) return null;
  var raw = window.galleryChipValue ? parseFloat(window.galleryChipValue(g.local, g.dir)) : NaN;
  return {
    key: key,
    name: galleryBindingLabel(g.dir) + (g.local === "gallery-total" ? " — total images" : " — current image"),
    type: "number",
    value: isNaN(raw) ? 0 : raw,
    /* derived (not a real content.variables entry) - see variableNotationToken().
       .key itself can't double as the typed {...} identifier (it has colons
       in it, the notation's own flag delimiter), so this is the same bare
       token a gallery local chip already shows while mid-edit, see
       localChipToken() */
    derived: true,
    token: galleryVarScope(g.dir) + (g.local === "gallery-total" ? "Total" : "Current")
  };
}

/**
 * Every variable this page currently offers: two per pane binding (which
 * image it's on, how many it has), in the order the bindings come in - so the
 * list goes from two to four the moment a ta places a second pane.
 * @return an array of variable records
 */
function galleryVariableInventory() {
  var out = [];
  galleryPaneBindings().forEach(function (dir) {
    out.push(galleryVariableFor(galleryVarKey("gallery-current", dir)));
    out.push(galleryVariableFor(galleryVarKey("gallery-total", dir)));
  });
  return out;
}

/* what a content.links value looks like when it points at one of this page's
   own actions instead of a url: "gallery:next" for the rail-following pane,
   "gallery:next:2026" for one pinned to a directory. A prefix rather than a
   separate content map, so an action link is stored, listed, edited, removed,
   undone and copied by every mechanism a url link already goes through - see
   applyOneLink()/pageLinkInventory(). */
var GALLERY_ACTION_PREFIX = "gallery:";

/**
 * Parses a content.links value as a gallery action.
 * @param url a links map value
 * @return {step, dir} with step -1/1, or null if it isn't an action at all
 */
function galleryActionOf(url) {
  if (typeof url !== "string" || url.indexOf(GALLERY_ACTION_PREFIX) !== 0) return null;
  var rest = url.slice(GALLERY_ACTION_PREFIX.length);
  var cut = rest.indexOf(":");
  var verb = cut === -1 ? rest : rest.slice(0, cut);
  if (verb !== "prev" && verb !== "next") return null;
  return { step: verb === "prev" ? -1 : 1, dir: cut === -1 ? "" : rest.slice(cut + 1) };
}

/**
 * A human name for one action, for the link editor and the links view -
 * "Previous image (2026)" rather than the raw "gallery:prev:2026" a ta should
 * never have to read.
 * @param url a links map value
 * @return the label, or "" if url isn't a gallery action
 */
function galleryActionLabel(url) {
  var a = galleryActionOf(url);
  if (!a) return "";
  return (a.step === -1 ? "Previous image" : "Next image") + " — " + galleryBindingLabel(a.dir);
}

/**
 * Every action this page currently offers: two per pane binding, in the same
 * order the bindings themselves come in. This is the list that grows the
 * moment a ta places another image pane.
 * @return an array of {url, label}
 */
function galleryActionInventory() {
  var out = [];
  galleryPaneBindings().forEach(function (dir) {
    ["prev", "next"].forEach(function (verb) {
      var url = GALLERY_ACTION_PREFIX + verb + (dir ? ":" + dir : "");
      out.push({ url: url, label: galleryActionLabel(url) });
    });
  });
  return out;
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

/* every distinct icon already used anywhere on the site, reused verbatim
   rather than pulling in an icon library: "icons that exist already", and not
   just the handful off one page. class="cic" for the same fixed 30x30
   accent-coloured sizing every other content icon uses. Built-in, so unlike
   CUSTOM_ICONS none of these are ever deletable from the picker. */
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
    '<path d="M8 11V8a4 4 0 0 1 7.5-2"/><path d="M12 14.5v2"/></svg>' },
  /* the gallery viewer's own two chevrons, added to the shared library so a
     back/forward arrow is available to everyone on every page, not only to
     whoever inherits the two the gallery page ships with */
  { label: "Arrow left", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>' },
  { label: "Arrow right", svg: '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' }
];

/* ta-uploaded icons/videos/fonts, shared with every ta the moment they're
   added (unlike a profile there's no separate share step), refetched whenever
   a picker opens. Each entry is {id, owner, name, url}; only its owner can
   remove it, enforced server-side too - never a built-in, never another ta's
   upload. */
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
 * Bearer-authed fetch for the shared icon/video/font asset endpoints, the
 * same token convention as uploadEditorFile() (js/ta.js's authedFetch()
 * isn't loaded on this file's pages).
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
 * Parses a raw `<svg>...</svg>` string into a real, detached svg element.
 * @param markup the svg markup
 * @return the parsed, detached svg element
 * @note document.createElement() can't build one directly - it needs the svg
 * namespace - so this goes through innerHTML on a plain div instead.
 */
function svgFromMarkup(markup) {
  var tmp = document.createElement("div");
  tmp.innerHTML = markup;
  return tmp.firstElementChild;
}

/**
 * Wraps a not-yet-inserted element in its own `.free-wrap` at (x, y) in
 * document coordinates and attaches it, so every existing resize, move,
 * delete and text-edit mechanism treats it exactly like a template element
 * dragged out of flow.
 * @param el the element to place (not yet in the document)
 * @param x left, document (page) px
 * @param y top, document (page) px
 * @return el, now attached
 * @note Appended directly to body, never nested inside page content, so
 * deleting or moving a section can't take a newly-added element with it.
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
 * Freezes a freshly-placed free element at its just-rendered size - the same
 * finishing step detachFromFlow() does on an existing element's first resize,
 * so a later double-click has a sane "as first created" size to reset to.
 * @param el the element, already filled with its real content
 * @param w width in px, if it has to be one measured earlier
 * @param h height in px, likewise
 * @note The size is worth measuring beforehand whenever el has just been moved
 * to a new parent, because a rect read afterwards is not el's size - it is the
 * size el collapsed to once it lost the styles its old parent was giving it.
 * See unseatFromBox(), which is where that bites.
 */
function freezeFreeElement(el, w, h) {
  var r = (w === undefined || h === undefined) ? el.getBoundingClientRect()
                                               : { width: w, height: h };
  el.dataset.natW = r.width;
  el.dataset.natH = r.height;
  el.style.width = r.width + "px";
  el.style.height = r.height + "px";
  el.parentNode.style.width = r.width + "px";
  el.parentNode.style.height = r.height + "px";
}

/**
 * Builds and places the DOM node for one custom-element descriptor, tagging
 * it with the same data-edit-id/data-resize-id convention every template
 * element uses - so resize, move, delete, text edit, style and undo need zero
 * special-casing for anything created here.
 * @param d {id, kind, left, top, w, h, icon, href, url, target, format}
 * @return the built, attached element
 * @note A "button" is a single tagged `<a>` with no separate inner textbox -
 * the button IS the textbox, as every other CTA on the site is - and its link
 * becomes a real href through the same "Add link" mechanism.
 * @note An "image" with a d.url is a real uploaded photo, a plain `<img>`
 * with object-fit: cover so its box dictates the crop; one saved before
 * uploads existed falls back to the flat `.ph` placeholder.
 * @note A "video" is an uploaded clip, looping muted autoplay by DEFAULT -
 * autoplay, controls and click-to-pause are per-video choices applied over
 * this afterward.
 * @note A "datetime" is a countdown or formatted static date driven by its
 * own d.target/d.format rather than a click-to-edit field.
 * @note A "theme" is a real functional light/dark toggle, always built with
 * the default sun/moon icon (a replacement is an override applied after), its
 * label an ordinary click-to-edit span nested inside.
 * @note An icon with a d.url is a ta-uploaded icon rendered as a plain `<img>`
 * rather than parsed svg. elKind() already treats any "icon."-prefixed id as
 * icon kind regardless of tag, so that needs no special-casing elsewhere.
 */
function buildCustomElement(d) {
  var el = buildCustomElementNode(d);
  placeFreeElement(el, d.left, d.top);
  /* the dashboard is two pages in one file, so a free-placed element there
     belongs to one of them: whichever half was on show when it was placed,
     defaulting to the dashboard itself. Without this they'd float over the
     gate, pinned to 0,0 at that, since the spacers they anchor to measure
     nothing while #dashApp is out of the document. A bound child needs none
     of this: it lives inside its tile and follows it. */
  if (currentPageKey() === "dashboard") {
    el.parentNode.setAttribute("data-dash-view", d.dashView === "gate" ? "gate" : "app");
  }
  if (d.w) { el.style.width = d.w + "px"; el.dataset.natW = d.w; }
  /* extrasArea/daysArea (and galleryDirArea) are always auto-height, sized
     by whatever tiles js/dashboard.js's renderExtras()/renderDays() paint
     into them - their stored d.h is just a legacy/never-updated seed value
     (nothing ever writes a new one back, height-resize isn't offered for
     these), so applying it as a fixed inline height here silently clipped
     every tile's content down to that seed's height on every load. */
  /* a login field/error line is auto-height for the same reason: its stored
     h is only there to size the spacer it anchors to (see app/db.py's
     _LOGIN_USER_ENTRY), and pinning it would clip the label or the second
     error string the moment a ta bumps the font size */
  var isAutoHeightArea = d.kind === "extrasArea" || d.kind === "daysArea" ||
    d.kind === "galleryDirArea" || d.kind === "loginField" || d.kind === "loginError";
  if (d.h && !isAutoHeightArea) { el.style.height = d.h + "px"; el.dataset.natH = d.h; }
  return el;
}

/**
 * The kind-dispatch half of buildCustomElement(): builds and fills one
 * descriptor's DOM node but doesn't place it - split out so a reel tile's
 * bound child can be built exactly as every top-level element is, then
 * appended straight into its tile instead of onto document.body.
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
    /* what makes a box the one element that really contains others: elements
       can be seated inside it (Alt-drop, see startBoxDropTracking()) and it lays
       them out rather than each of them holding a pinned coordinate. See the BOX
       CONTAINERS section for why this is a separate attribute from the tile
       containers' data-flow-area rather than the same one. */
    el.setAttribute("data-box-area", "1");
    el.className = "box-flow";
    el.style.background = "var(--surface-2)";
    el.style.width = "160px";
    el.style.height = "100px";
  } else if (d.kind === "clip") {
    /* an element pasted from another page (see pasteClipAsElement()). The only
       kind built from stored markup rather than from a recipe: there's no way
       to describe "whatever this was on the page it came from" as a recipe, and
       the markup already has its final ids, so parsing it back is both the
       whole build step and what makes the paste survive a reload. */
    var clipHolder = document.createElement("div");
    clipHolder.innerHTML = d.html || "";
    el = clipHolder.firstElementChild;
    if (!el) {
      el = document.createElement("div");
      el.setAttribute("data-resize-id", d.id);
    }
    /* marks it for isClipRoot(), the one container kind that gets a rank of
       its own. Stamped here rather than baked into the stored markup so it's
       reapplied on every load from the descriptor's own kind, and so a copy
       taken OF a paste can't inherit it without going through this branch */
    el.setAttribute("data-clip-root", "1");
  } else if (d.kind === "extrasIcon") {
    /* the attachments-tile-exclusive "Attachment icon" element (offered by
       renderCtxMenuRoot() only while the right-click landed on an attachment
       tile). Its glyph isn't baked in: repaintExtrasTypeIcons() fills it from
       whichever tile it ends up sitting on, so the same placed element draws
       a document, a photo, a slide deck or a chain link depending on what
       that tile's attachment actually is. Reuses .extras-tile-icon so it
       sizes and colours exactly like the built-in icon role beside it. */
    el = document.createElement("span");
    el.className = "extras-tile-icon";
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-extras-typeicon", "1");
    el.innerHTML = window.attachmentIconSvgFor ? window.attachmentIconSvgFor(null) : "";
  } else if (d.kind === "extrasArea") {
    /* transparent layout container for the dashboard's attachments list -
       js/dashboard.js finds it by data-resize-id and renders the tiles
       inside; this builds the empty shell. Deliberately background-less,
       unlike "box". Both axes are draggable, but what a stored size MEANS
       depends on the container's own axis locks: a locked axis keeps that
       size and fits the tiles inside it, an unlocked one is sized by its
       content and ignores the figure. Width locked, height grows. */
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-extras-area", "1");
    /* laid out by applyTileFlow()/.tile-flow: the tiles are direct children,
       one per row by default, repacking into columns as a ta narrows a tile */
    el.setAttribute("data-flow-area", "1");
    el.setAttribute("data-tile-id", "extras.tile.box");
    el.className = "tile-flow";
    el.style.width = "100%";
    el.style.minHeight = "40px";
  } else if (d.kind === "daysArea") {
    /* transparent layout container for the dashboard's day grid, same shape
       as "extrasArea" above - see it for how the axis locks decide what a
       stored size means.
       The old static #dayGrid's fixed three columns was a constant, so
       neither dragging the container narrower nor a day card wider changed
       the tiling. .tile-flow's auto-fill tracks give the same three columns
       at the page's own width while making the count a real function of
       both, and still collapse to 2 and 1 on narrow screens. */
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-days-area", "1");
    el.setAttribute("data-flow-area", "1");
    el.setAttribute("data-tile-id", "days.tile");
    /* the tile width to tile AT until a ta resizes a day card themselves -
       read by applyTileFlow() as this container's own --tile-w default,
       rather than set here, so it doesn't fight what that writes */
    el.setAttribute("data-tile-w", "320px");
    el.className = "tile-flow";
    el.style.setProperty("--tile-gap", "22px");
    el.style.width = "100%";
    el.style.minHeight = "40px";
  } else if (d.kind === "galleryDirArea") {
    /* transparent layout container for the gallery's directory rail -
       js/gallery.js renders one tile per directory inside; this builds the
       empty shell. Exactly the same shape as the dashboard's areas, and for
       the same reason: "a transparent box, with tiles in it or the text
       saying theres nothing", with each tile's coloured rectangle kept
       separate from the area. Ships stacked vertically, since that's where
       the rail has always sat, but every control works on it as usual. */
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-gallery-dirs-area", "1");
    el.setAttribute("data-flow-area", "1");
    el.setAttribute("data-tile-id", "gallery.dir.tile");
    el.className = "tile-flow";
    el.style.setProperty("--tile-gap", "8px");
    el.style.minHeight = "40px";
  } else if (d.kind === "galleryPane") {
    /* one photo/clip stage. Unlike every other kind here a page can carry
       SEVERAL, each bound to a named directory through d.dir, so a ta can
       show 2025 beside 2026. d.dir === "" is the "follow the rail" binding
       the page ships with, which is what keeps the directory tiles worth
       clicking. js/gallery.js paints the media and owns which image each
       binding is on; this only builds the empty stage. */
    el = document.createElement("div");
    el.className = "gv-stage";
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-gallery-pane", "1");
    el.setAttribute("data-gallery-dir", d.dir || "");
    var gpImg = document.createElement("img");
    gpImg.className = "gv-img";
    gpImg.alt = "";
    gpImg.setAttribute("data-gallery-media", "img");
    el.appendChild(gpImg);
    var gpVid = document.createElement("video");
    gpVid.className = "gv-img";
    gpVid.autoplay = true;
    gpVid.muted = true;
    gpVid.loop = true;
    gpVid.setAttribute("playsinline", "");
    gpVid.setAttribute("data-gallery-media", "vid");
    gpVid.hidden = true;
    hardenVideo(gpVid);
    el.appendChild(gpVid);
  } else if (d.kind === "loginField") {
    /* one of the login page's two credential boxes, the first of the three
       kinds the right-click menu only offers on that page.

       The "Username"/"Password" caption above is deliberately NOT part of it:
       that's ordinary markup with an ordinary data-edit-id, because it has no
       functionality beyond being a line of text and shouldn't inherit any of
       this kind's special handling.

       What's left is two tracked pieces rather than one opaque widget,
       because the spec asks for exactly that: the box is "a regular rectangle
       with text in it" (so the style popover's rows all work on it with no
       new plumbing), and the greyed placeholder is a plain text field rather
       than the <input>'s placeholder attribute - the only way it could be
       edited and restyled like any other text. js/login.js hides it once the
       field has a value, so it still READS as a placeholder. The real <input>
       is still real: autocomplete, masking and autofill all intact.

       The box carries data-login-fixed: a field with its rectangle deleted
       would be an <input> with nothing around it, so it's the same exception
       the attachments tile's download button makes - move and restyle it
       freely, just never delete it. The field as a WHOLE is deletable. */
    var lfName = d.field === "password" ? "password" : "username";
    el = document.createElement("div");
    el.className = "login-field";
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-login-el", "field");
    el.setAttribute("data-login-field", lfName);
    /* like a live area, this is meant to span the card it's anchored into
       rather than sit at a hand-measured width, see applyElementAnchors() */
    el.setAttribute("data-login-fill", "1");
    var lfBox = document.createElement("div");
    lfBox.className = "login-field-box";
    lfBox.setAttribute("data-resize-id", d.id + ".box");
    lfBox.setAttribute("data-login-fixed", "1");
    var lfInput = document.createElement("input");
    lfInput.className = "login-field-input";
    lfInput.type = lfName === "password" ? "password" : "text";
    lfInput.autocomplete = lfName === "password" ? "current-password" : "username";
    lfInput.setAttribute("aria-label", lfName === "password" ? "Password" : "Username");
    lfInput.setAttribute("data-login-input", lfName);
    lfBox.appendChild(lfInput);
    var lfPh = document.createElement("span");
    lfPh.className = "login-field-ph";
    lfPh.setAttribute("data-edit-id", d.id + ".placeholder");
    lfPh.textContent = lfName === "password" ? "and its password" : "the username you were given";
    lfBox.appendChild(lfPh);
    el.appendChild(lfBox);
  } else if (d.kind === "loginButton") {
    /* the login page's submit button. Everything cosmetic is a ta's to
       change - its label is a normal click-to-edit field, its box takes the
       usual style rows - but what it DOES is not: js/login.js binds the
       credential post to the data-login-el marker, not to an id or a link,
       so it can't be pointed elsewhere by accident. That's why it draws in
       the login-page outline colour in edit mode. */
    el = document.createElement("button");
    el.type = "button";
    el.className = "btn btn-primary login-submit";
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-login-el", "submit");
    el.setAttribute("data-login-fill", "1");
    var lbLabel = document.createElement("span");
    lbLabel.className = "login-submit-label";
    lbLabel.setAttribute("data-edit-id", d.id + ".label");
    lbLabel.textContent = "Log in";
    el.appendChild(lbLabel);
  } else if (d.kind === "loginError") {
    /* the login page's failure line. Invisible to a real visitor until
       something goes wrong, which is exactly why it needs the hazard hatching
       in the editor: without it a ta is looking at red text that never
       appears on the live page, with nothing to say so.

       Carries BOTH strings it can show - wrong credentials, and the "you were
       idled out" line - as two independently editable fields rather than one
       js/login.js overwrites at runtime: a ta who reworded the failure
       shouldn't find it silently replaced on an expired bounce, and the
       expired copy would otherwise be the one string here nobody could edit.
       Only one shows on the real page; edit mode shows both. */
    el = document.createElement("div");
    el.className = "login-error";
    el.setAttribute("data-resize-id", d.id);
    el.setAttribute("data-login-el", "error");
    /* spans the card like the fields above it, so its two strings wrap the
       same way the old .form-msg paragraph did, see applyElementAnchors() */
    el.setAttribute("data-login-fill", "1");
    var leBad = document.createElement("span");
    leBad.className = "login-error-msg";
    leBad.setAttribute("data-edit-id", d.id + ".text");
    leBad.setAttribute("data-login-msg", "bad");
    leBad.textContent = "Wrong username or password. Check with a staff member.";
    el.appendChild(leBad);
    var leExpired = document.createElement("span");
    leExpired.className = "login-error-msg";
    leExpired.setAttribute("data-edit-id", d.id + ".expired");
    leExpired.setAttribute("data-login-msg", "expired");
    leExpired.textContent = "You were logged out after a while of inactivity. Log in again.";
    el.appendChild(leExpired);
  } else if (d.kind === "navPortal" || d.kind === "navDashboard" || d.kind === "navLogout") {
    /* the landing page's three nav buttons, offered by the right-click menu
       on that page only and only for the navbar state currently on show: an
       Access portal button belongs to the signed-out navbar, Dashboard and
       Log out to the signed-in one, and offering either in the wrong state
       would be offering to place something the page can never show.

       Shaped like the ordinary "button" kind, with one difference: what it
       DOES is wired to its data-nav-el marker rather than its id or href, so
       it can't be pointed elsewhere by accident and a placed copy works the
       moment it lands. Hence the page-exclusive outline colour in edit mode.

       Which session state it shows in is the kind's default and the ta's
       choice: the kind decides where it STARTS, and the "Shown to" switch can
       override that per element, all the way to "everyone". A button dropped
       mid-page isn't a navbar button any more, and a ta who put one there
       generally means page furniture every reader gets. */
    var navKind = d.kind === "navPortal" ? "portal" :
      d.kind === "navDashboard" ? "dashboard" : "logout";
    el = document.createElement(navKind === "logout" ? "button" : "a");
    el.className = navKind === "logout" ? "btn btn-ghost" : "btn btn-accent2";
    if (navKind === "logout") el.type = "button";
    else el.href = navKind === "portal" ? "login.html" : "dashboard.html";
    el.setAttribute("data-edit-id", d.id);
    el.setAttribute("data-nav-el", navKind);
    /* "both" means carrying no marker at all, which is exactly what an element
       that belongs to neither state looks like to applyNavState() - no special
       case needed there, it only ever visits [data-nav-state] elements */
    var navState = navStateForDescriptor(d);
    if (navState !== "both") el.setAttribute("data-nav-state", navState);
    el.textContent = navKind === "portal" ? "Access portal" :
      navKind === "dashboard" ? "Dashboard" : "Log out";
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
    hardenVideo(el);
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
    /* the outer div IS the track rectangle: radius, border and the opacity
       slider all already work generically on any data-resize-id div, so
       rounding it into a pill needs no new plumbing. overflow:hidden clips
       the inner fill bar to whatever shape the radius picks.

       Its two colours (this div's background is the track, the child's the
       fill) are independent of the generic Color row, which skips
       data-progress elements. They're painted, along with the live fill width
       off the two bound variables, by applyProgressBindings() - not here.
       This only builds the static structure with placeholder colours. */
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
    /* a real, functional light/dark toggle, not a decorative copy: clicking
       it anywhere calls the same setTheme() the nav's own #themeBtn does, so
       every instance and the live nav toggle always agree.

       Always starts on the auto sun/moon swap - a ta's fixed replacement is a
       per-id override applied afterward, the same two-pass shape every other
       kind follows. That matters because the nav's static #themeBtn isn't a
       custom element at all and needs the same override pass, so one shared
       mechanism covers both.

       The label is a normal click-to-edit field defaulting to the live
       theme's own wording until a ta types over it. The sun/moon pair lives
       in its own ".tic-icon" span, a tracked element in its own right, so the
       icon resizes and recolours independently of the button and the label. */
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
 * Appends el into tileEl at (x, y) - the reel-tile equivalent of
 * placeFreeElement(), same absolute setup and same ".free-wrap" span, just
 * appended into tileEl instead of document.body.
 * @param tileEl the reel-tile div to append into
 * @param el the built, unplaced element (see buildCustomElementNode())
 * @param x left, tile-relative px
 * @param y top, tile-relative px
 * @return el
 * @note Using the same wrap convention means detachFromFlow()'s "already
 * free" short-circuit recognises a bound child immediately, so every later
 * move, resize and delete on it needs zero reel-specific code - it works as
 * it would for any other element, just anchored to its tile.
 */
function placeInTile(tileEl, el, x, y) {
  var wrap = document.createElement("span");
  wrap.className = "free-wrap";
  /* marks this wrap as holding a BOUND CHILD rather than one of the tile's
     own template pieces. Both end up in a .free-wrap, and
     renderTileChildren() clears the children before rebuilding, so without
     something to tell them apart it would take the tile's own rect and label
     too. Harmless right after a fresh innerHTML; the gallery rail's shared
     children are rebuilt into LIVE tiles, where it isn't. */
  wrap.dataset.tileChild = "1";
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
 * Builds a reel's whole DOM subtree: a resizable, movable, deletable panel
 * and a fixed set of content tiles inside its track.
 * @param d {id, orientation, tileW, tileH, gap, pad, tiles: [{id, children}]}
 * @return the unplaced panel element, placed by the caller like every kind
 * @note Tiles are individually selectable and stylable, but marked
 * data-reel-tile so they're excluded from every path that would detach them
 * out of the flex track. Dragging and resizing are still available - they
 * just run through the reel: a drag reorders the track, and a resize sets the
 * one tile size every tile in the reel shares.
 * @note Whatever a ta has dropped onto a tile is built and appended straight
 * into that tile, so it's a real DOM descendant that travels with it once the
 * reel starts scrolling - not a page element that happens to overlap it.
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
      /* click-to-edit is an EDITOR affordance, so it's gated exactly the way
         renderTileChildren() (the rebuild path for these same children) and
         wireClickToEdit()'s own call site are: without this gate a reel's
         bound textboxes/buttons came out contenteditable on the live page
         too, since this builder runs on every load, not just in the editor */
      if ((childD.kind === "text" || childD.kind === "button") &&
          ((isPreviewMode() && isEditMode()) || isObjectMode())) wireTextField(childEl);
    });
    track.appendChild(tile);
  });
  applyReelSpacing(panel, d);
  return panel;
}

/**
 * How far apart a reel's tiles sit along the axis they're laid out on.
 * @param d the reel's custom-element entry
 * @return px
 * @note Horizontal for a horizontal reel, vertical for a vertical one, which
 * is why the style popover labels the same slider differently depending on
 * which way the reel runs.
 */
function reelGap(d) {
  return d && d.gap !== undefined ? d.gap : REEL_DEFAULT_GAP;
}

/**
 * How much clear space a reel keeps between its tiles' borders and its own,
 * across the axis the tiles DON'T run along: above/below the strip on a
 * horizontal reel, left/right of it on a vertical one.
 * @param d the reel's custom-element entry
 * @return px
 */
function reelPad(d) {
  return d && d.pad !== undefined ? d.pad : REEL_DEFAULT_PAD;
}

/**
 * Paints a reel's two spacing figures onto its track: the gap as the flex
 * gap (which is the between-tiles axis either way round), the pad as track
 * padding on the other axis only.
 * @param panel the .reel element
 * @param d its custom-element entry
 * @note Inline rather than a stylesheet rule, because every reel carries its
 * own pair - and inline is what survives js/learn-reel.js cloning the tiles,
 * since padding and gap sit on the track rather than on anything cloned.
 */
function applyReelSpacing(panel, d) {
  var track = panel.querySelector(".reel-track");
  if (!track) return;
  var pad = reelPad(d);
  track.style.gap = reelGap(d) + "px";
  track.style.padding = panel.classList.contains("reel--vertical")
    ? "0 " + pad + "px" : pad + "px 0";
}

/**
 * Sets one of a reel's spacing figures, live and saved.
 * @param panel the .reel element
 * @param key "gap" or "pad"
 * @param px the new value
 * @note Both live on the reel's own entry rather than a per-id override map:
 * they describe the strip as a whole, and there's no single element they
 * could be keyed to, since the track isn't a tracked element.
 */
function setReelSpacing(panel, key, px) {
  var d = customElementById(elId(panel));
  if (!d) return;
  d[key] = px;
  applyReelSpacing(panel, d);
  saveCustomElements(CUSTOM_ELEMENTS);
}

/**
 * Resizes every tile in a reel at once.
 * @param panel the .reel element
 * @param w new tile width in px
 * @param h new tile height in px
 * @note Per the spec a ta resizes ONE tile and the rest mirror it - the same
 * shared-template rule a day tile role follows, except a reel's tiles share
 * one stored size on the reel entry rather than a per-id entry, so there's
 * nothing to mirror across ids: painting them all here IS the mirror.
 * @note Includes the cloned loop copies, plain markup with their tracked
 * attributes stripped, which would otherwise keep the old size live.
 */
function applyReelTileSize(panel, w, h) {
  panel.querySelectorAll(".reel-tile").forEach(function (t) {
    t.style.width = w + "px";
    t.style.height = h + "px";
  });
}

/**
 * applyReelTileSize() plus the save: the tail end of a tile resize drag, and
 * of undo/redo replaying one.
 * @param panel the .reel element
 * @param w new tile width in px
 * @param h new tile height in px
 */
function setReelTileSize(panel, w, h) {
  var d = customElementById(elId(panel));
  applyReelTileSize(panel, w, h);
  if (!d) return;
  d.tileW = w;
  d.tileH = h;
  saveCustomElements(CUSTOM_ELEMENTS);
}

/**
 * The ids of a reel's tiles, in the order they currently sit in the track.
 * @param panel the .reel element
 * @return array of tile ids
 */
function reelTileOrder(panel) {
  return Array.prototype.map.call(panel.querySelectorAll(".reel-tile[data-resize-id]"),
    function (t) { return t.getAttribute("data-resize-id"); });
}

/**
 * Persists the order a reel's tiles are in, by reordering the entry's own
 * tiles[] to match.
 * @param panel the .reel element
 * @param ids tile ids in their new order
 * @note Each tile keeps its id and its bound children - they're the same
 * objects, just moved - so nothing about a tile's contents is rewritten,
 * which is why a reorder is a cheap edit and not a rebuild.
 */
function saveReelOrder(panel, ids) {
  var d = customElementById(elId(panel));
  if (!d || !d.tiles) return;
  var byId = {};
  d.tiles.forEach(function (t) { byId[t.id] = t; });
  var reordered = [];
  ids.forEach(function (id) { if (byId[id]) { reordered.push(byId[id]); delete byId[id]; } });
  /* anything the dom didn't account for keeps its place at the end rather
     than being dropped - a tiles[] entry with no element on this page is not
     something a reorder should be able to delete */
  d.tiles.forEach(function (t) { if (byId[t.id]) reordered.push(t); });
  d.tiles = reordered;
  saveCustomElements(CUSTOM_ELEMENTS);
}

/**
 * Puts a reel's tiles into the given order, in the dom and in the saved
 * entry: what undo/redo replays for a reorder drag (see startReelTileDrag()).
 * @param panel the .reel element
 * @param ids tile ids in the wanted order
 */
function applyReelOrder(panel, ids) {
  var track = panel.querySelector(".reel-track");
  if (!track) return;
  ids.forEach(function (id) {
    var tile = track.querySelector('.reel-tile[data-resize-id="' + id + '"]');
    if (tile) track.appendChild(tile);
  });
  saveReelOrder(panel, reelTileOrder(panel));
}

/**
 * Recreates every custom element a ta has added via the right-click "Add
 * element" menu, on every load, live site included.
 * @param list content.custom_elements
 * @note These don't exist in the template at all, so unlike a text or size
 * override there's no markup to lay something on top of - the element has to
 * be built first. Called before every apply pass, so they find these by id
 * exactly like a template element.
 * @note CUSTOM_ELEMENTS stays the FULL, unscoped list, since every save path
 * expects the whole current list; only the DOM building is filtered to this
 * page, so a page never renders another's elements but never drops them from
 * what gets saved back either.
 */
function renderCustomElements(list) {
  CUSTOM_ELEMENTS = (list || []).slice();
  var page = currentPageKey();
  CUSTOM_ELEMENTS.filter(function (d) { return !d.page || d.page === page; }).forEach(buildCustomElement);
}

/**
 * True for a placed element whose position is not a frozen pixel at all: one
 * carrying a stored `d.anchor`, whose left and top applyElementAnchors() below
 * re-reads off a live in-flow spacer on every layout pass.
 * @param el the element
 * @return true if an anchor selector pins it
 * @note The whole seeded set is anchored - the four login controls, the
 * dashboard's progress bar and its two tile areas, the landing page's reel and
 * the gallery's five - so this covers every page but says nothing about an
 * element a ta placed themselves, which is frozen exactly as before.
 */
function isAnchoredEl(el) {
  var id = el && elId(el);
  var d = id ? customElementById(id) : null;
  return !!(d && d.anchor);
}

/**
 * True for an element whose free-placed pixel offset was actually AUTHORED -
 * committed by a ta at a container width we recorded, or stored on a placed
 * element - as opposed to one produced by the live layout a moment ago.
 * @param el the element
 * @return true if its offset came from a stored number
 * @note The distinction matters only to responsiveFallbackFor(), which turns
 * a frozen pixel back into a proportion by dividing it by the width it was
 * frozen at. A committed drag records that width in `bw`
 * (saveEditedPosition()), and a placed element carries its own left/top; an
 * element freezeDescendants() pinned a moment ago carries neither, because
 * its offset is not frozen at any width - it is simply where the browser had
 * just laid it out, at whatever width the ta's window happens to be.
 */
function hasAuthoredOffset(el) {
  var id = el && elId(el);
  if (!id) return false;
  if (EDIT_POSITIONS[id]) return true;
  var d = customElementById(id);
  return !!(d && (d.left !== undefined || d.top !== undefined));
}

/**
 * Re-pins any custom element carrying a stored `d.anchor` selector to that
 * in-flow anchor's real, current position, instead of trusting the element's
 * stored left/top verbatim.
 * @note d.left/d.top for a migrated element is a document-pixel offset
 * hand-measured once against one window. Content that used to sit in flow
 * doesn't stay put at a fixed pixel: anything above it that changes height -
 * the hero, sized in vh, on a taller window - drags the real heading down
 * without moving the frozen pixel, so the two overlap. The spacer still
 * reserves real in-flow space, so re-reading its live rect keeps the element
 * aligned at any window size without making the whole system responsive.
 * @note Never touches a ta's own drag: a manual move is a separate translate
 * on top of this base position, so re-anchoring can't fight it.
 * @note Must run after every apply pass that could change layout height above
 * the anchor, so its rect already reflects whatever a ta customized.
 */
function applyElementAnchors() {
  /* every position below is a document coordinate read off a live spacer, so
     this can't run while a two-state page has both of its states in flow at
     once - the spare half is above these spacers and pushes them down by its
     own full height, which would pin the reel (or the dashboard's progress bar
     and tile areas) that far down the page. Deferred to the moment the layout
     is the real one again, see withStateViewsLaidOut(). */
  if (STATE_VIEWS_LAID_OUT) { ANCHOR_PASS_PENDING = true; return; }
  CUSTOM_ELEMENTS.forEach(function (d) {
    if (!d.anchor) return;
    var anchor = document.querySelector(d.anchor);
    var el = elByAnyId(d.id);
    var wrap = el && el.parentElement;
    if (!anchor || !wrap || !wrap.classList.contains("free-wrap")) return;
    var r = anchor.getBoundingClientRect();
    wrap.style.left = (r.left + window.scrollX) + "px";
    wrap.style.top = (r.top + window.scrollY) + "px";
    /* a live area's WIDTH is anchor-driven too, not just its position. Its
       seeded d.w is a hand-measured 1160, but the spacer it anchors to is a
       real in-flow child of the section's .wrap, whose content width is
       whatever the shared page column resolves to (1076 at 1440px). Pinning
       to the stale figure hung the grid ~84px past the column its own heading
       lines up with. Only when a ta hasn't dragged a width of their own -
       recorded as ovW, and an explicit choice always wins.

       The progress bar is anchored the same way and was seeded with the same
       stale 1160, so it overhung by the same ~84px, past the window entirely
       on a narrower one. Same fix: a bar pinned to a full-width spacer is
       meant to span that column, whatever it measures today. */
    /* a login field/button spans its auth card for exactly the same reason a
       live area spans its section: the card's width is whatever the shared
       column resolves to today, not the hand-measured seed in app/db.py */
    /* the gallery's photo stage spans the column beside its rail for the same
       reason: the .gv row it anchors into is whatever the shared page column
       resolves to today, not the hand-measured seed in app/db.py */
    if ((isLiveAreaEl(el) || el.hasAttribute("data-progress") ||
         el.hasAttribute("data-login-fill") || el.hasAttribute("data-gallery-pane")) &&
        el.dataset.ovW === undefined) {
      var colW = anchor.getBoundingClientRect().width;
      el.style.width = colW + "px";
      /* and this IS the element's natural size now, not just what it's
         painted at: natW is what getSize() falls back to when a resize starts
         and what a double-click resets to, so leaving the seeded d.w meant
         the first mousemove snapped the element to that stale figure. natH
         follows so getSize() sees a complete pair. */
      el.dataset.natW = colW;
      if (el.dataset.natH === undefined) el.dataset.natH = el.getBoundingClientRect().height;
      /* a login field's input rectangle rides along. It's a plain block child,
         so it fills the field for free RIGHT UP UNTIL something detaches it
         (a saved position, a saved size, a nudge in the editor) - after which
         it's absolutely positioned at a frozen px width and stops following the
         field entirely, which is what left one credential box visibly narrower
         than the other. Only while the ta hasn't dragged a width of their own:
         an explicit choice wins here exactly as it does for the field. */
      var lfBox = el.querySelector(":scope > .free-wrap > .login-field-box, :scope > .login-field-box");
      if (lfBox && lfBox.dataset.ovW === undefined && getComputedStyle(lfBox).position === "absolute") {
        lfBox.style.width = colW + "px";
        lfBox.dataset.natW = colW;
        if (lfBox.parentElement.classList.contains("free-wrap")) lfBox.parentElement.style.width = colW + "px";
      }
    }
  });
}

/* re-runs applyElementAnchors() whenever the browser window is resized, since
   a vh-sized section above an anchored element changes height live as the
   window resizes, not just between page loads. One listener for the page's
   whole lifetime is enough - applyElementAnchors() itself is a safe no-op
   before the first real content load (CUSTOM_ELEMENTS starts empty).

   Once per animation frame, NOT on a trailing timer: an anchored element is
   absolutely positioned at a document coordinate, so until the pass re-reads
   its spacer it stays where the OLD width put it - visibly adrift from the
   card it belongs to. On a 150ms trailing debounce every zoom step reset the
   timer, so the login fields flew loose of their card for as long as the ta
   kept zooming and only snapped back once they stopped. A frame-throttled
   pass tracks the layout instead, and there are only a handful of anchored
   elements on a page to re-read. The trailing pass stays as well: heights
   that resolve a frame or two later (font swaps, rewrapped text) move the
   spacers again after the last resize event. */
(function () {
  var timer = null, frame = null;
  window.addEventListener("resize", function () {
    if (frame === null) frame = requestAnimationFrame(function () {
      frame = null;
      applyElementAnchors();
    });
    if (timer) clearTimeout(timer);
    timer = setTimeout(applyElementAnchors, 150);
  });
  /* the first pass runs the instant the content lands, well before the page
     above has settled: photos and videos are still unsized and the webfonts
     haven't swapped in. Anything anchored below that gets measured against a
     layout that isn't final and stays there, since nothing re-measured until
     a resize - which is how the reel ended up 64px below its own heading.
     Both are cheap and idempotent, so they simply run again once the layout
     is real. */
  window.addEventListener("load", applyElementAnchors);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyElementAnchors);
})();

/* ---------------------------------------------------------------------------
   RESPONSIVE BEHAVIOUR

   Everything a ta places is stored as an absolute pixel offset and an absolute
   pixel box, measured against ONE viewport width - whatever their own window
   happened to be (see editorTargetWidth() in js/ta.js, and the section comment
   above it spelling out why the editor lays the frame out at that width rather
   than at the pane's). That geometry is exactly right at that width and wrong
   at every other one: an element 600px from the left edge is centred on a
   1440px page and hanging off a 768px one.

   This section is what happens instead. Two layers, in this order:

     1. responsiveFallbackFor() - the automatic one. Applies to EVERY tracked
        element, with no authoring at all: offsets scale with the container
        they were measured in, and boxes clamp so nothing overhangs. This is
        what makes an untouched page broadly correct at widths nobody edited
        it at, and it is deliberately the layer that does the heavy lifting.

     2. content.responsive - the per-element override on top, drawn as bands
        along a width axis in the editor's Responsive mode (see the RESPONSIVE
        PLANE section in js/ta.js). A band names the properties in force
        across a stretch of widths.

   Three rules decide what a stack of bands resolves to, all of them chosen in
   the design conversation this came out of:

     UNION      every band covering the current width applies at once. A band
                that hides and a band that recolours both fire; the recolour
                is invisible under the hide, which is the wanted answer rather
                than a conflict to resolve. Only two bands setting the SAME
                property need a tiebreak, and there the later one in the array
                (drawn later, higher in the pane's list) wins.

     HOLD       a width no band covers does not snap back to the authored
                geometry - it keeps the value of the nearest band on the WIDE
                side of it, taken at that band's narrow edge. So a band that
                shrinks to 60% between 800 and 900 leaves the element at 60%
                all the way down to 320 without anyone drawing a second band.

                Resolved by looking along the axis, never by remembering what
                the element was doing a moment ago: state that depended on
                which direction the window was dragged from would render a
                fresh load at 700px differently from a drag down to 700px.

     RAMP       a band with ramp "linear" interpolates each numeric property
                from its value at `from` (the narrow edge) to its value in
                `propsTo` at `to`. ramp "none" holds one flat value across the
                whole band, which is the same thing with a zero-length ramp.

   Runs last in applySharedOverridePasses(), and again on every resize, so it
   is always painting on top of finished geometry. It never writes to the
   saved override datasets (ovTx/ovW/...) - those stay the ta's authored
   answer, and everything here is a separate layer composed over them, so
   resizing a visitor's window can't rewrite what a ta saved.
   --------------------------------------------------------------------------- */

/* content.responsive, {id: {axis, regions}} - only elements a ta has actually
   drawn bands for */
var RESPONSIVE = {};

/* content.responsive_waivers, {"<id>|<rule>": reason} - see runResponsiveDrc() */
var RESPONSIVE_WAIVERS = {};

/* the viewport width the saved geometry was authored against, used as the
   denominator for the fallback's proportional scaling whenever a position
   entry doesn't carry its own measured container width (`bw`). Overwritten
   from content.authored_width on load; this figure is only what a blob saved
   before that field existed is assumed to have been drawn at. */
var AUTHORED_WIDTH = 1440;

/* the smallest and largest widths the plane can be drawn over, and so the
   range every resolved value is clamped into. Shared with the pane in
   js/ta.js through window.RESPONSIVE_RANGE so the two can't drift. */
var RESPONSIVE_RANGE = { min: 320, max: 2560 };
window.RESPONSIVE_RANGE = RESPONSIVE_RANGE;

/* the widths css/style.css already reflows the page at, drawn as snap guides
   on the plane. A band edge that misses one of these by a few px gives a
   visitor two separate layout jolts a hair apart instead of one - see the
   @media blocks in css/style.css, which this list mirrors. */
var RESPONSIVE_BREAKPOINTS = [540, 700, 860, 940, 1000, 1150, 1300];
window.RESPONSIVE_BREAKPOINTS = RESPONSIVE_BREAKPOINTS;

/* every property a band can carry, and how to resolve it.
     num   interpolates on a "linear" ramp; anything else is held flat
     paint how paintResponsive() writes it, or null for the ones read by
           another system instead of painted directly (the flow fields are
           merged into areaFlowFor(), position into paintResponsivePos()) */
var RESPONSIVE_PROPS = {
  hide:      { num: false },
  hideMode:  { num: false },
  scale:     { num: true },
  widthPct:  { num: true },
  minW:      { num: true },
  maxW:      { num: true },
  minH:      { num: true },
  maxH:      { num: true },
  fontSize:  { num: true },
  opacity:   { num: true },
  radius:    { num: true },
  color:     { num: false },
  textColor: { num: false },
  padding:   { num: false },
  anchor:    { num: false },
  overflow:  { num: false },
  /* container fields, merged into areaFlowFor() rather than painted */
  dir:       { num: false, flow: true },
  wrap:      { num: false, flow: true },
  gap:       { num: true,  flow: true },
  justify:   { num: false, flow: true },
  align:     { num: false, flow: true },
  /* CHILD fields: authored on a container, painted onto what's inside it (see
     paintContainerChildProps()). The three above them - dir/wrap/gap - are the
     container asking the BROWSER to lay its children out, which flexbox does
     for free. These three have no css equivalent that still lets a child hold
     an override of its own, so the container resolves them and reaches in. */
  childHide:      { num: false, child: true },
  childScale:     { num: true,  child: true },
  childFontScale: { num: true,  child: true }
};

/* resolved flow overrides for this frame, {id: {dir, wrap, gap, justify,
   align}}. areaFlowFor() merges this over a container's saved area_flow, so a
   band changing a container's stacking flows through applyTileFlow() and the
   whole tile pipeline without any of it knowing this section exists. */
var RESPONSIVE_FLOW = {};

/* the containers whose bands say something about their CHILDREN this frame,
   [{el, props}]. Held as a list rather than a map because a shared id can be
   two real containers on one page (see applyResponsiveBehaviour()). */
var RESPONSIVE_CHILD = [];

/* every element painted by the last paintContainerChildProps() pass, so a
   container that stops asking for something can have it taken back off. Without
   this, hiding a box's children at 400px would leave them hidden for the rest
   of the session once the window went wide again - the container simply stops
   mentioning them, and nothing else on the page owns those properties. */
var RESPONSIVE_CHILD_PAINTED = [];

/**
 * Paints what each container asks of its own children.
 * @note The third of the three ways a container can affect what's inside it,
 * and the only one that needs code here. The first is that a child measures
 * ITSELF against its container (responsiveAxisEl()); the second is that the
 * container hands flexbox a direction/wrap/gap and the browser does the work
 * (areaFlowFor()). Neither can express "hide what's in here" or "shrink the
 * text in here", because css has no way to say that which a child can still
 * override per element - so the container resolves it and writes it on.
 * @note Direct children only, never the whole subtree: a box holding a card
 * holding a title should hand its answer to the card, and let the card's own
 * bands decide what happens to the title. Reaching all the way down would take
 * that decision away from every container in between.
 */
function paintContainerChildProps() {
  /* everything the last pass wrote comes off first, so a container that has
     stopped asking is actually undone rather than just not-re-applied */
  RESPONSIVE_CHILD_PAINTED.forEach(function (kid) {
    if (kid.dataset.rsChildHide === "1") {
      kid.style.display = kid.dataset.rsChildDisplay || "";
      delete kid.dataset.rsChildDisplay;
      delete kid.dataset.rsChildHide;
    }
    if (kid.dataset.rsChildScale !== undefined) {
      delete kid.dataset.rsChildScale;
      /* rsScale is paintResponsive()'s own field: only give it back if this
         pass is what put the value there */
      delete kid.dataset.rsScale;
      paintPos(kid);
    }
    if (kid.dataset.rsChildFont !== undefined) {
      kid.style.fontSize = kid.dataset.rsChildFontWas || "";
      delete kid.dataset.rsChildFontWas;
      delete kid.dataset.rsChildFont;
    }
  });
  RESPONSIVE_CHILD_PAINTED = [];
  RESPONSIVE_CHILD.forEach(function (entry) {
    var p = entry.props;
    [].slice.call(entry.el.children).forEach(function (kid) {
      /* the drop caret is this file's own furniture, not page content */
      if (kid.classList && kid.classList.contains("box-drop-caret")) return;
      var touched = false;
      if (p.childHide) {
        if (kid.dataset.rsChildDisplay === undefined) {
          kid.dataset.rsChildDisplay = kid.style.display || "";
        }
        kid.dataset.rsChildHide = "1";
        kid.style.display = "none";
        touched = true;
      }
      if (p.childScale > 0 && p.childScale !== 1) {
        kid.dataset.rsChildScale = p.childScale;
        kid.dataset.rsScale = p.childScale;
        paintPos(kid);
        touched = true;
      }
      if (p.childFontScale > 0 && p.childFontScale !== 1) {
        if (kid.dataset.rsChildFontWas === undefined) {
          kid.dataset.rsChildFontWas = kid.style.fontSize || "";
        }
        /* off the COMPUTED size, so this composes with whatever the stylesheet
           or the ta's own font-size override already resolved to rather than
           needing to know which of them won */
        var base = parseFloat(getComputedStyle(kid).fontSize);
        if (base > 0) {
          kid.style.fontSize = (base * p.childFontScale) + "px";
          kid.dataset.rsChildFont = p.childFontScale;
          touched = true;
        }
      }
      if (touched) RESPONSIVE_CHILD_PAINTED.push(kid);
    });
  });
}

/**
 * Loads content.responsive/content.responsive_waivers/content.authored_width
 * into this section, so the resolver has something to resolve against.
 * @param map content.responsive
 * @param waivers content.responsive_waivers
 * @param authoredWidth content.authored_width, the viewport the blob's
 *   geometry was drawn at
 */
function applyResponsiveOverrides(map, waivers, authoredWidth) {
  RESPONSIVE = map && typeof map === "object" ? map : {};
  RESPONSIVE_WAIVERS = waivers && typeof waivers === "object" ? waivers : {};
  if (authoredWidth > 0) AUTHORED_WIDTH = authoredWidth;
  applyResponsiveBehaviour();
}

/**
 * The element whose width one element's bands are measured against.
 * @param el the element
 * @param axis "auto", "viewport" or "parent"
 * @return an element to measure, or null to mean the window itself
 * @note "auto" is the default and picks per element, the way the design
 * conversation settled it: an element sitting in a flow container is measured
 * against THAT container, because a tile in a six-across row has ~280px to
 * work with on a 1400px page and keying its bands off the window would be
 * asking a ta to do the tiles-per-row arithmetic in their head. Anything not
 * in a container - free-placed, nav chrome, the page itself - is measured
 * against the window, which is the only meaningful box it has.
 * @note A container's own bands are measured against ITS parent, never
 * itself: an element that resized itself in response to its own width would
 * be a feedback loop, which is the same reason css container queries refuse
 * to let an element query itself.
 */
function responsiveAxisEl(el, axis) {
  if (axis === "viewport") return null;
  /* a box counts as a container here exactly as a tile area does - it's the
     box a seated element actually has to fit inside, and it's checked FIRST
     because a box can itself be seated inside a tile area, in which case the
     box is the more specific answer. See the BOX CONTAINERS section. */
  var seat = boxOf(el);
  if (seat) return seat;
  var area = flowAreaForEl(el);
  /* a container resolves against its own parent container, one step up */
  if (area === el) area = el.parentElement ? flowAreaForEl(el.parentElement) : null;
  if (area && area !== el) return area;
  if (axis === "parent") {
    var p = el.parentElement;
    while (p && p !== document.body) {
      if (p.classList && p.classList.contains("free-wrap")) { p = p.parentElement; continue; }
      return p;
    }
  }
  return null;
}

/**
 * The width one element's bands are being measured against right now.
 * @param el the element
 * @param axis "auto", "viewport" or "parent"
 * @return a width in css px
 */
function responsiveAxisWidth(el, axis) {
  var host = responsiveAxisEl(el, axis);
  if (host) {
    var w = host.getBoundingClientRect().width;
    /* a container mid-rebuild can measure zero, and resolving every band
       against 0 would hide half the page for one frame */
    if (w > 0) return w;
  }
  /* innerWidth, NOT documentElement.clientWidth: a `@media (max-width: 940px)`
     query is evaluated against the full viewport INCLUDING the scrollbar,
     while clientWidth excludes it. The plane's snap guides are the stylesheet's
     own breakpoints (see RESPONSIVE_BREAKPOINTS), so a ta dropping a band edge
     exactly on 940 and the css rule at 940 have to fire at the same window
     size - measuring the narrower box made every such band switch roughly a
     scrollbar's width early, which on a page whose css reflows at that same
     number reads as the two fighting each other.
     Deliberately only the BAND AXIS. responsiveFallbackFor()'s overhang math
     stays on clientWidth, because "is this element off the visible area" is a
     question about the box the visitor can actually see. */
  return window.innerWidth || document.documentElement.clientWidth || AUTHORED_WIDTH;
}

/**
 * One band's contribution at a given width.
 * @param region a content.responsive region ({from, to, ramp, props, propsTo})
 * @param w the width being resolved, assumed inside [from, to]
 * @return a props object
 * @note Only numeric properties interpolate. A ramp between two colours or
 * two flex directions has no meaning, so those hold their `props` value for
 * the whole band and only swap at its edge.
 */
function responsiveRegionProps(region, w) {
  var props = region.props || {};
  if (region.ramp !== "linear" || !region.propsTo) return props;
  var span = region.to - region.from;
  var t = span > 0 ? (w - region.from) / span : 0;
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  var out = {};
  Object.keys(props).forEach(function (k) { out[k] = props[k]; });
  Object.keys(region.propsTo).forEach(function (k) {
    var spec = RESPONSIVE_PROPS[k];
    var a = props[k], b = region.propsTo[k];
    if (spec && spec.num && isFinite(a) && isFinite(b)) out[k] = a + (b - a) * t;
    else if (out[k] === undefined) out[k] = b;
  });
  return out;
}

/**
 * Resolves every band on one element down to the properties in force at a
 * width, applying the union/tiebreak/hold rules in this section's header.
 * @param id the element's data-edit-id/data-resize-id
 * @param w the width to resolve at
 * @return a props object (empty if the element has no bands at all)
 */
function resolveResponsiveProps(id, w) {
  var entry = RESPONSIVE[id];
  if (!entry || !entry.regions || !entry.regions.length) return {};
  var out = {};
  var covered = {};
  /* UNION, in array order, so a later band setting the same property wins */
  entry.regions.forEach(function (r) {
    if (w < r.from || w > r.to) return;
    var props = responsiveRegionProps(r, w);
    Object.keys(props).forEach(function (k) {
      out[k] = props[k];
      covered[k] = true;
    });
  });
  /* HOLD: for anything no covering band set, the nearest band on the wide
     side keeps its narrow-edge value. Nearest means smallest `from` at or
     above w - walk them all rather than assuming the array is sorted, since
     bands are stored in draw order (which is also their tiebreak order) and
     a ta can draw a wide one after a narrow one. */
  entry.regions.forEach(function (r) {
    if (r.from < w) return;
    var props = responsiveRegionProps(r, r.from);
    Object.keys(props).forEach(function (k) {
      if (covered[k]) return;
      var held = out["__from_" + k];
      if (held !== undefined && held <= r.from) return;
      out[k] = props[k];
      out["__from_" + k] = r.from;
    });
  });
  Object.keys(out).forEach(function (k) { if (k.indexOf("__from_") === 0) delete out[k]; });
  return out;
}
window.resolveResponsiveProps = resolveResponsiveProps;

/**
 * The automatic layer under every band: what an element with no authoring at
 * all should do as its container changes width.
 *
 * A ta's saved {tx, ty} is a pixel offset measured inside a container of a
 * particular width - `bw`, recorded by the drag that saved it (see
 * saveEditedPos()). The same offset inside a container half that wide is not
 * the same placement, it's the same NUMBER, which is the whole bug this
 * feature exists to fix. So the offset travels as a proportion of the
 * container instead: an element a third of the way across stays a third of
 * the way across.
 *
 * On top of that, two clamps that only ever pull things back on screen:
 * a box wider than its container is capped to it, and an element whose right
 * edge would land past the container's is slid back inside. Between them
 * these are what stop an unauthored page overflowing horizontally at widths
 * nobody drew a band for - which, on the day this ships, is every width.
 *
 * @param el the element
 * @param axisW the width its container measures right now
 * @return {dx, dy, maxW} - a position delta to compose over the saved
 *   offset, and a width cap (0 for none)
 * @note Returns a DELTA, never an absolute position. The saved offset stays
 * the ta's authored answer and this rides on top, so nothing here can leak
 * back into what gets saved.
 */
function responsiveFallbackFor(el, axisW) {
  var out = { dx: 0, dy: 0, maxW: 0 };
  var id = elId(el);
  var saved = id ? EDIT_POSITIONS[id] : null;
  var host = responsiveAxisEl(el, "auto");
  /* an element with no flow container is measured against the viewport, and
     the viewport is a real box with a real left edge (0) - not "no box".
     Leaving this null sent every free-placed element down the in-flow branch
     below, which scales only the drag delta: the landing page's placed portal
     button has a leftward drag saved on it, so shrinking that delta pushed the
     button RIGHT as the page narrowed, off the edge it was already past. */
  var hostRect = host ? host.getBoundingClientRect()
    : { left: 0, width: document.documentElement.clientWidth || window.innerWidth || axisW };
  var hostW = hostRect.width || axisW;
  if (!(hostW > 0)) return out;

  /* the proportional offset, and WHICH number is proportional depends on how
     the element is positioned - the two cases are genuinely different:

       free-placed (its wrap is a .free-wrap carrying an absolute left, which
       covers both a placed custom element and anything detachFromFlow() has
       pulled out of flow) - its ENTIRE offset inside the host is a frozen
       pixel measured at one width, so the whole thing scales. This is the
       case that was leaving the nav's placed portal button 271px off the
       right of a 375px page.

       still in flow - the layout already puts it in the right place at any
       width, and only the ta's drag delta on top of that is a frozen pixel.
       Scaling the whole offset here would move the part the browser had
       already got right, twice.

     `bw` is the container width the drag measured; an entry saved before that
     field existed falls back to the blob's authoring viewport, which is the
     best guess available and still far better than treating the pixel as
     absolute. */
  var base = (saved && saved.bw > 0) ? saved.bw : AUTHORED_WIDTH;
  var ratio = hostW / base;
  var freePlaced = !!(el.parentElement && el.parentElement.classList.contains("free-wrap"));
  /* an anchored element is the one free-placed thing whose offset is NOT a
     frozen pixel measured at one width: applyElementAnchors() re-reads it off
     a live spacer every pass, so it already tracks the card or column it
     belongs to exactly, at every width, before this layer runs at all.
     Scaling it proportionally on top of that applies the same correction
     twice, and the second one is pure error - which is what put all four
     login controls 273px off the right of their card on a 1920 window, the
     dashboard's progress bar and both tile areas 147px off their column, and
     the gallery's next arrow 429px off its stage. Narrower than the authoring
     width it goes the other way and they drift left instead. Note this is the
     automatic layer only: a band that authors an anchor of its own is an
     explicit choice and still lands, see paintResponsive(). */
  var anchored = isAnchoredEl(el);
  /* a reel tile's contents sit at fixed offsets inside their OWN tile, and
     that tile lives in a track which deliberately runs wider than the mask
     over it and scrolls (see initReel()/.reel--editor-scroll). "Overhanging
     the container" is the resting state of every tile past the first
     screenful, not a fault to correct - so both halves of this layer sit out
     here, exactly as they do for an anchored element and for the same
     reason: something else already owns where this sits.
     Without the exemption the clamp below slid every off-screen tile's
     title, body and icon back to the mask's own right edge, stacking the
     contents of tiles 4, 5 and 6 on top of one another in one unreadable
     pile - the "entries at the edge of this scrolling gallery are
     overlapped" report. It fired on a plain page load, before any editing,
     since the seeded tile children are free-placed to begin with. */
  var inReelTrack = !!(el.closest && el.closest(".reel-track"));
  /* isFinite guards a container measured mid-rebuild; a ratio of exactly 1 is
     the authoring width itself, where this whole layer must be a no-op */
  /* and the same exemption, for the same reason, for a free-placed element
     whose offset nothing ever authored. `base` above is a guess - the blob's
     authoring width - taken on the understanding that SOME ta once froze this
     pixel at SOME width. detachFromFlow() and freezeDescendants() break that
     understanding: grabbing a container's resize handle pins every tracked
     element inside it at the spot the browser had just laid it out, at the
     ta's current window width, and those pins are not authored at 1440 or at
     anything else. Scaling them by hostW/1440 is arithmetic on a number that
     was never a measurement: it is what threw the navbar apart the instant a
     handle was touched, sliding the brand and the theme button right by
     hostW/1440 of their offsets while the six nav links - measured against
     their own 547px row - collapsed left into a pile on top of each other,
     each by 62% of how far along the row it sat. An authored offset still
     scales exactly as before, so a ta's own drag is untouched. */
  if (isFinite(ratio) && ratio !== 1 && !anchored && !inReelTrack) {
    if (freePlaced && hostRect && hasAuthoredOffset(el)) {
      var prev = parseFloat(el.dataset.rsDx) || 0;
      var authoredLeft = el.getBoundingClientRect().left - hostRect.left - prev;
      out.dx = authoredLeft * (ratio - 1);
    } else if (saved && saved.tx) {
      out.dx = saved.tx * (ratio - 1);
    }
  }
  /* vertical is deliberately left alone. Height is content-driven - a section
     that rewraps onto more lines pushes everything below it down by the right
     amount on its own - so scaling a vertical offset by a WIDTH ratio would
     be applying an unrelated number to an axis that was already correct. */

  /* the box cap, for the two kinds of element that carry a frozen pixel width
     and so cannot resize themselves: one a ta dragged (ovW), and one placed
     free of the document flow, whose seeded width (natW) was hand-measured at
     one viewport and has been that number ever since - the landing page's
     "What You'll Learn" reel is the standing example, seeded at 1160px and
     overhanging a 375px page by 785 of them.

     Deliberately NOT applied to a template element sized by the stylesheet:
     those already resize on their own, and capping them would make this pass
     self-referential, since getSize() falls back to a live rect for them and
     the cap would then be computed from a width the previous cap produced. */
  var ownW = parseFloat(el.dataset.ovW);
  if (!(ownW > 0) && el.parentElement && el.parentElement.classList.contains("free-wrap")) {
    ownW = parseFloat(el.dataset.natW);
  }
  if (ownW > 0 && ownW > hostW) out.maxW = Math.floor(hostW);

  /* and finally slide anything still overhanging back inside its container.
     Measured off the live rect rather than derived from the saved offset:
     `tx` is a translate DELTA, not a position, so it says nothing on its own
     about where the element's left edge actually is. This pass's own delta
     from the previous frame comes back out of that measurement, or each
     frame would be correcting a position the last frame had already
     corrected and the element would creep leftwards on every resize event.

     Only for an element this layer actually positions - free-placed, or
     carrying a ta's drag. A template element still in normal flow that is too
     wide for its column has a WIDTH problem, and sliding it left with a
     transform doesn't fix that, it just moves the overhang to the other side
     and drags the element out of the column it is supposed to line up with.
     (That is exactly what happened when this clamp was briefly applied to
     everything: the landing page's About heading was pulled 320px out of its
     section and the page got wider, not narrower.) */
  /* and anchored elements sit out the clamp too: a spacer is by definition
     inside the layout, so an element pinned to one cannot overhang unless a
     ta gave it a width wider than the column - which is the width cap's job
     just above, not a position's. Sliding one here would only re-introduce
     the drift the exemption above exists to remove. */
  if (!anchored && !inReelTrack && (freePlaced || (saved && saved.tx))) {
    var prevDx = parseFloat(el.dataset.rsDx) || 0;
    var r = el.getBoundingClientRect();
    var effW = out.maxW ? Math.min(r.width, out.maxW) : r.width;
    var left = r.left - hostRect.left - prevDx;
    var over = (left + out.dx + effW) - hostW;
    if (over > 0) out.dx -= over;
    /* never past the other edge in the process: a box wider than its
       container would otherwise be pushed off the left instead of the right */
    if (left + out.dx < 0) out.dx = -left;
  }
  return out;
}

/**
 * Writes one element's resolved responsive layer onto the dom.
 *
 * Everything here goes into `rs*` datasets and inline styles kept separate
 * from the saved override datasets (ovTx/ovW/...), and every inline property
 * this touches is stashed on first write so it can be handed back untouched
 * when a resize moves off the band that set it. That stash is what lets this
 * pass run last over finished geometry without permanently stomping whatever
 * applySizeOverrides() and friends put there.
 * @param el the element
 * @param props a resolveResponsiveProps() result
 * @param fallback a responsiveFallbackFor() result
 */
function paintResponsive(el, props, fallback) {
  var stash;
  try { stash = JSON.parse(el.dataset.rsStash || "{}"); } catch (e) { stash = {}; }

  /* records el's pre-responsive inline value for one css property once, then
     writes the new one. A null value hands the stashed original back. */
  function put(cssProp, value) {
    if (value === null || value === undefined || value === "") {
      if (stash[cssProp] !== undefined) {
        el.style.setProperty(cssProp, stash[cssProp]);
        if (!stash[cssProp]) el.style.removeProperty(cssProp);
        delete stash[cssProp];
      }
      return;
    }
    if (stash[cssProp] === undefined) stash[cssProp] = el.style.getPropertyValue(cssProp);
    el.style.setProperty(cssProp, value);
  }

  /* hide comes first and short-circuits nothing else on purpose: a band that
     hides AND recolours resolves to both, the recolour simply lands on an
     element nobody can see. That's the union rule doing what it should. */
  if (props.hide) {
    put(props.hideMode === "hidden" ? "visibility" : "display",
        props.hideMode === "hidden" ? "hidden" : "none");
  } else {
    put("display", null);
    put("visibility", null);
  }

  var capW = props.maxW !== undefined ? props.maxW : fallback.maxW;
  put("max-width", capW > 0 ? capW + "px" : null);
  put("min-width", props.minW > 0 ? props.minW + "px" : null);
  put("max-height", props.maxH > 0 ? props.maxH + "px" : null);
  put("min-height", props.minH > 0 ? props.minH + "px" : null);
  put("width", props.widthPct > 0 ? props.widthPct + "%" : null);
  put("font-size", props.fontSize > 0 ? props.fontSize + "px" : null);
  put("opacity", props.opacity !== undefined ? props.opacity : null);
  put("border-radius", props.radius >= 0 && props.radius !== undefined ? props.radius + "px" : null);
  put("padding", props.padding || null);
  put("overflow", props.overflow || null);
  /* a scroll container that doesn't say so is invisible to a visitor, so the
     one overflow value that produces a scrollbar gets the shared edge fade
     the stylesheet defines for it */
  el.classList.toggle("rs-scrolls", props.overflow === "auto");

  /* colour lands on whichever property the existing colour system already
     picked for this kind of element (an icon's foreground, a text field's
     font colour, a container's background), so a band and the style popover
     are painting the same surface rather than two different ones. Goes
     through put() like everything else, which is what hands the popover's own
     value back the moment the band stops covering this width. */
  var colorProp = colorTarget(el) === "bg" ? "background-color" : "color";
  put(colorProp, props.color ? resolveThemedColor(props.color, "") : null);
  /* a button is the one element with two independently controlled surfaces,
     so its label colour is a separate band property rather than the same one */
  if (colorProp !== "color") put("color", props.textColor ? resolveThemedColor(props.textColor, "") : null);

  el.dataset.rsStash = JSON.stringify(stash);

  /* position and scale ride the transform paintPos() already composes, rather
     than a second one that would stomp it */
  var dx = fallback.dx, dy = fallback.dy;
  if (props.anchor === "right") dx = responsiveAnchorDelta(el, "right");
  else if (props.anchor === "center") dx = responsiveAnchorDelta(el, "center");
  var scale = props.scale > 0 ? props.scale : 0;
  if (dx || dy) { el.dataset.rsDx = dx; el.dataset.rsDy = dy; }
  else { delete el.dataset.rsDx; delete el.dataset.rsDy; }
  if (scale && scale !== 1) el.dataset.rsScale = scale;
  else delete el.dataset.rsScale;

  /* a free-placed element is moved by its WRAP, not by its own transform.
     The wrap is an absolutely positioned box sitting at a frozen document
     left, and that box is what the document measures its scrollable width
     against - so translating only the element inside it slid the visible
     button back on screen while leaving a 567px-wide empty box behind it,
     and the page still scrolled sideways to nothing. Moving the wrap moves
     the box as well as the paint.

     The scale deliberately stays on the element: the wrap is the slot the
     element was detached into, and scaling the slot would move everything
     measured from it rather than shrink what's in it. */
  var wrap = el.parentElement;
  var onWrap = !!(wrap && wrap.classList.contains("free-wrap"));
  if (onWrap) {
    wrap.style.transform = (dx || dy) ? "translate(" + dx + "px, " + dy + "px)" : "";
    el.dataset.rsOnWrap = "1";
  } else {
    delete el.dataset.rsOnWrap;
  }
  paintPos(el);
}

/**
 * The horizontal delta that pins an element to one side of its container
 * instead of letting the proportional fallback slide it.
 * @param el the element
 * @param which "right" or "center"
 * @return a delta in css px to compose over the saved offset
 * @note Measured off the live container every pass rather than stored, for
 * the same reason applyElementAnchors() re-reads its spacer: the container's
 * width is whatever the shared page column resolves to today.
 */
function responsiveAnchorDelta(el, which) {
  var id = elId(el);
  var saved = id ? EDIT_POSITIONS[id] : null;
  var host = responsiveAxisEl(el, "auto");
  var hostW = host ? host.getBoundingClientRect().width : (document.documentElement.clientWidth || 0);
  var base = saved && saved.bw > 0 ? saved.bw : AUTHORED_WIDTH;
  if (!(hostW > 0) || !(base > 0)) return 0;
  /* right: hold the gap the element had to the container's right edge at the
     width it was drawn at, which is the whole container's change in width */
  if (which === "right") return hostW - base;
  return (hostW - base) / 2;
}

/**
 * Resolves and paints the responsive layer for every tracked element on the
 * page. Idempotent and cheap enough to run on every resize frame: it reads
 * live rects and writes only what changed.
 * @note Runs LAST in applySharedOverridePasses() so it composes over finished
 * geometry, and again on resize because a container's width changes without
 * any override pass running at all.
 */
function applyResponsiveBehaviour() {
  RESPONSIVE_FLOW = {};
  RESPONSIVE_CHILD = [];
  var els = [].slice.call(document.querySelectorAll(RESIZABLE_SEL));
  var flowTouched = false;
  els.forEach(function (el) {
    var id = elId(el);
    if (!id) return;
    /* an element the ta deleted stays deleted - applyHiddenOverrides() owns
       that, and a band must never be able to bring one back */
    if (HIDDEN_IDS[id]) return;
    var entry = RESPONSIVE[id];
    var axisW = responsiveAxisWidth(el, entry && entry.axis ? entry.axis : "auto");
    var props = resolveResponsiveProps(id, axisW);
    /* the flow fields are the container's business, not this element's box:
       peel them off into RESPONSIVE_FLOW for areaFlowFor() to merge */
    var flow = null, kids = null;
    Object.keys(props).forEach(function (k) {
      var spec = RESPONSIVE_PROPS[k];
      if (!spec) return;
      if (spec.flow) {
        if (!flow) flow = {};
        flow[k] = props[k];
        delete props[k];
      } else if (spec.child) {
        /* not this element's own box either: it describes what this element
           does to whatever is inside it, see paintContainerChildProps() */
        if (!kids) kids = {};
        kids[k] = props[k];
        delete props[k];
      }
    });
    if (flow) { RESPONSIVE_FLOW[id] = flow; flowTouched = true; }
    /* kept per ELEMENT, not per id: a shared id (nav.brand is on the navbar and
       the footer, deliberately) is two real containers with two sets of real
       children, and both have to be painted */
    if (kids) RESPONSIVE_CHILD.push({ el: el, props: kids });
    paintResponsive(el, props, responsiveFallbackFor(el, axisW));
  });
  /* only re-lay the tiles when the resolved flow overrides actually CHANGED.
     applyTileFlow() rebuilds every flow area it finds, which is far too much
     work for every frame of a window drag - and worse, it changes container
     sizes, which is exactly what the ResizeObserver below is watching for, so
     running it unconditionally would have each pass schedule the next one for
     as long as the page was open. */
  var sig = JSON.stringify(RESPONSIVE_FLOW);
  if (sig !== RESPONSIVE_FLOW_SIG) {
    RESPONSIVE_FLOW_SIG = sig;
    applyTileFlow();
    /* boxes read the same resolved flow through the same areaFlowFor(), so
       they re-lay under the same signature guard and for the same reason - see
       the BOX CONTAINERS section */
    applyBoxFlow();
  }
  /* dead last, and after the flow pass above: what a container does TO its
     children is resolved from the container's own bands, so it has to see the
     layout those bands just produced */
  paintContainerChildProps();
}
window.applyResponsiveBehaviour = applyResponsiveBehaviour;

/* the previous pass's RESPONSIVE_FLOW, serialised, so applyResponsiveBehaviour()
   can tell a real change from a re-resolve to the same answer - including the
   pass that drops the last override, which still has to re-lay the tiles once
   to clear it */
var RESPONSIVE_FLOW_SIG = "{}";

/* ---- design rule check ----

   The same idea as a pcb drc, and the name a ta asked for it by: a fixed set
   of rules, each with a severity, each waivable with a reason, run over the
   whole page at one width and reported rather than enforced. A ta can always
   overrule one - the point is that they see it first.

   Deliberately NOT checking sibling overlap, which a normal drc would: this
   editor is free placement, elements are MEANT to sit on top of each other
   (an icon on a card, a label over a photo), and flagging that would bury the
   five rules below in noise nobody would read past. */

/* the minimum comfortable touch target and the smallest readable body text,
   both the widely used accessibility floors rather than anything this site
   invented. See runResponsiveDrc(). */
var DRC_MIN_TOUCH = 44;
var DRC_MIN_FONT = 12;

/* how far past an edge an element has to reach before it counts as
   overhanging. Sub-pixel layout rounding puts full-width elements a fraction
   over routinely, and reporting those buries the real findings. */
var DRC_EDGE_SLACK = 2;

/**
 * Whether el sits inside something that scrolls horizontally, and so is
 * allowed to be outside the viewport.
 * @param el the element
 * @return true if any ancestor clips or scrolls its overflow
 * @note Stops at body: the document's own scrolling is the thing the overflow
 * rule is actually about, so treating it as an excuse would switch the rule
 * off entirely.
 */
function inScrollingAncestor(el) {
  var p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    var ox = getComputedStyle(p).overflowX;
    if (ox === "auto" || ox === "scroll" || ox === "hidden") return true;
    p = p.parentElement;
  }
  return false;
}

/**
 * Runs the design rule check over every tracked element at the width the page
 * is laid out at right now.
 * @return an array of {id, rule, sev, msg}, sev being "err" or "warn"
 * @note Resolves the responsive layer first rather than trusting whatever the
 * last rAF painted, so a caller that has just changed the frame's width gets
 * an answer about THAT width instead of the previous one.
 */
function runResponsiveDrc() {
  applyResponsiveBehaviour();
  var out = [];
  var vw = document.documentElement.clientWidth || window.innerWidth;
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (!id || HIDDEN_IDS[id]) return;
    var cs = getComputedStyle(el);
    var hidden = cs.display === "none" || cs.visibility === "hidden";
    /* something a visitor can act on that this width has taken away entirely.
       Only flagged for elements carrying a link, since those are the ones
       where hiding removes a route through the site rather than a decoration. */
    if (hidden) {
      if (LINKS[id]) {
        out.push({ id: id, rule: "hidden-link", sev: "warn",
                   msg: "Link hidden at this width, with no other route to it" });
      }
      return;
    }
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    /* an element inside something that scrolls is MEANT to sit outside the
       viewport - that's what a scroll container is. The reel's own strip is
       the standing example: every tile past the first legitimately measures
       hundreds of px off the left, and reporting each one would bury the real
       findings under a page of noise. The scroller ITSELF is still checked,
       which is where a genuine overflow shows up anyway. */
    if (inScrollingAncestor(el)) return;
    /* past the right edge of the window. The single most common way a page
       authored at one width breaks at another, and the one the automatic
       fallback in responsiveFallbackFor() exists to prevent - so anything
       still reaching here is genuinely worth a ta's attention. */
    /* a 2px tolerance, not a hairline one. Sub-pixel layout rounding routinely
       puts a full-width element a fraction past the edge, and a panel full of
       "overhangs by 1px" rows is a panel a ta stops reading. */
    if (r.right > vw + DRC_EDGE_SLACK) {
      out.push({ id: id, rule: "overflow", sev: "err",
                 msg: "Overhangs the right edge by " + Math.round(r.right - vw) + "px" });
    }
    if (r.left < -DRC_EDGE_SLACK) {
      out.push({ id: id, rule: "offscreen", sev: "err",
                 msg: "Sits " + Math.round(-r.left) + "px off the left edge" });
    }
    /* a tap target too small to hit reliably. Buttons and linked elements
       only: a 12px icon that isn't clickable is a decoration, not a target. */
    if ((LINKS[id] || isButtonEl(el)) && (r.width < DRC_MIN_TOUCH || r.height < DRC_MIN_TOUCH)) {
      out.push({ id: id, rule: "touch-target", sev: "warn",
                 msg: "Tap target is " + Math.round(r.width) + "x" + Math.round(r.height) +
                      ", under " + DRC_MIN_TOUCH + "px" });
    }
    var fs = parseFloat(cs.fontSize);
    if (el.hasAttribute("data-edit-id") && fs && fs < DRC_MIN_FONT && (el.textContent || "").trim()) {
      out.push({ id: id, rule: "tiny-text", sev: "warn",
                 msg: "Text is " + Math.round(fs) + "px, under the " + DRC_MIN_FONT + "px floor" });
    }
  });
  /* a violation the ta has already looked at and accepted stays off the list
     until the rule or the element changes - a panel that can never reach zero
     is a panel nobody reads */
  return out.filter(function (v) { return !RESPONSIVE_WAIVERS[v.id + "|" + v.rule]; });
}
window.runResponsiveDrc = runResponsiveDrc;

/**
 * Selects one element by id and scrolls it into view, so a click on a drc
 * violation out in the portal lands the ta on the element it is about.
 * @param id the element's data-edit-id/data-resize-id
 * @return true if the element was found
 */
function selectResponsiveElement(id) {
  var el = elByAnyId(id);
  if (!el) return false;
  RING_EL = el;
  positionRing();
  try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { el.scrollIntoView(); }
  return true;
}
window.selectResponsiveElement = selectResponsiveElement;

/**
 * A short human name for one element, for the plane pane's header and the drc
 * list - both of which would otherwise be showing raw dotted ids.
 * @param id the element's data-edit-id/data-resize-id
 * @return a label string
 * @note Falls back through the element's own words, then its kind, then the
 * id itself: a placed rectangle has no text to name it by, and an id like
 * "extras.tile.icon" is more use than "(no name)".
 */
function responsiveElementLabel(id) {
  var el = elByAnyId(id);
  if (!el) return id;
  var text = (el.textContent || "").trim().replace(/\s+/g, " ");
  /* a stray character or two is not a name - the theme toggle's label came out
     as "w", which tells a ta reading a drc row nothing at all. Fall through to
     the kind or the id, both of which at least identify the thing. */
  if (text.length < 3) text = "";
  if (text && text.length <= 32) return text;
  if (text) return text.slice(0, 30) + "...";
  var kind = elKind(el);
  return kind ? kind.charAt(0).toUpperCase() + kind.slice(1) : id;
}
window.responsiveElementLabel = responsiveElementLabel;

/**
 * The width one element's bands are currently being measured against, for the
 * plane pane's "measured against" caption - the number a ta is drawing edges
 * in, which for anything inside a container is NOT the window's width.
 * @param id the element's data-edit-id/data-resize-id
 * @param axis "auto", "viewport" or "parent"
 * @return {w, host} - the width, and a short name for what was measured
 */
function responsiveAxisReadout(id, axis) {
  var el = elByAnyId(id);
  if (!el) return { w: 0, host: "" };
  var hostEl = responsiveAxisEl(el, axis || "auto");
  return {
    w: Math.round(responsiveAxisWidth(el, axis || "auto")),
    host: hostEl ? (elId(hostEl) || "its container") : "the window"
  };
}
window.responsiveAxisReadout = responsiveAxisReadout;

/* re-resolves every band whenever the window changes size, on the same
   debounce and for the same reason as the anchor pass above it - except this
   one also has to catch a CONTAINER changing width without the window
   doing so (a tile row rewrapping, a section's column resolving differently),
   which is what the ResizeObserver is for. Both funnel through one
   rAF-coalesced call so a drag across the whole screen paints once a frame
   rather than once an event. */
(function () {
  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      applyResponsiveBehaviour();
    });
  }
  window.addEventListener("resize", schedule);
  window.addEventListener("load", schedule);
  window.responsiveRepaintSoon = schedule;
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(schedule);
    /* observe the containers bands are measured against, not every element -
       observing an element this pass then RESIZES is a feedback loop */
    window.observeResponsiveHosts = function () {
      try { ro.disconnect(); } catch (e) {}
      /* flow containers and the body, and nothing else. Every other candidate
         (.free-wrap, .wrap) is both numerous and something this pass can
         itself resize, which would have the observer re-firing on the pass's
         own output - the containers below are the only boxes bands are
         actually measured against, so they're the only ones worth watching. */
      document.querySelectorAll("[data-flow-area], [data-box-area]").forEach(function (host) {
        try { ro.observe(host); } catch (e) {}
      });
      try { ro.observe(document.body); } catch (e) {}
    };
  } else {
    window.observeResponsiveHosts = function () {};
  }
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
 * Persists the whole extras list into the shared snapshot, the same
 * merge-one-field-in shape as saveCustomElements().
 * @param list js/dashboard.js's EXTRAS array
 * @note Needed so a bound child added onto an attachments tile survives
 * Apply/reload, since content.extras otherwise isn't a field this file ever
 * writes to.
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
 * Persists the whole gallery block into the shared snapshot - the gallery
 * page's equivalent of saveExtras(), so a rail a ta reordered from the editor
 * survives Apply/reload.
 * @param gallery content.gallery, {years, images, video, ...}
 * @note Written wholesale rather than key-by-key, because the caller always
 * hands over the complete object it is itself rendering from.
 */
function saveGallery(gallery) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.gallery = gallery;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}
window.saveGallery = saveGallery;

/**
 * Looks up any element by its id, the page's own included - the same query
 * every override in this file uses to find its target.
 * @param id the element's id
 * @return the element, or null if none match
 * @note First match only: an id shared by mirrored elements resolves to
 * whichever comes first in the DOM, which is fine here since mirrored
 * elements are always kept identical by design.
 */
function elByAnyId(id) {
  return document.querySelector(idSel(id));
}

/**
 * A fresh suffix to append to every id in a duplicated subtree.
 * @return a fresh suffix, "~dupk3j2x1a4b" or similar
 * @note Checking just the root id against the live dom isn't enough: one
 * duplicate renames a whole subtree at once, and two unrelated duplicates
 * could otherwise land on the same nested id if both picked the same small
 * counter. The "~" is deliberately not a character any hand-written id uses,
 * so a duplicate's id can never collide with a genuine one.
 */
function uniqueDupSuffix() {
  return "~dup" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Clones sourceEl (or its whole .free-wrap, if it's been individually moved
 * or resized) and gives the clone and every tracked descendant a fresh id.
 * @param sourceEl the element (or one of its mirrored instances) to clone
 * @param suffix see uniqueDupSuffix()
 * @return {clone, wrap, pairs, rootEl}: clone is the node to insert, wrap the
 *   original's .free-wrap parent if it has one, pairs every {old, new, el} id
 *   remap, and rootEl the pairs entry corresponding to sourceEl itself
 * @note One suffix for every id in the subtree, so nested ids stay unique
 * relative to each other exactly as they were - two elements that mirrored
 * each other still do within the clone, just not with the original.
 * @note Any DOM id="..." attribute is stripped, since the clone doesn't
 * inherit that element's singleton role.
 * @note Pure: doesn't touch the DOM, storage or undo.
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
  var pairs = remapTrackedIds(clone, suffix);
  var rootEl = null;
  pairs.forEach(function (p) { if (p.old === sourceId && !rootEl) rootEl = p.el; });
  return { clone: clone, wrap: wrap, pairs: pairs, rootEl: rootEl };
}

/**
 * Renames root and every tracked element inside it by appending one shared
 * suffix - the id-remap half of buildDuplicateClone(). Mutates root in place.
 * @param root the subtree's root node (itself remapped if it's tracked)
 * @param suffix see uniqueDupSuffix()
 * @return every {old, new, el} remap made, in document order
 * @note Split out because the clipboard has to do the same remap to a subtree
 * parsed out of stored markup rather than cloned off a live node.
 */
function remapTrackedIds(root, suffix) {
  var tracked = [];
  if (root.matches && root.matches(RESIZABLE_SEL)) tracked.push(root);
  root.querySelectorAll(RESIZABLE_SEL).forEach(function (e) { tracked.push(e); });
  var pairs = [];
  tracked.forEach(function (el) {
    var oldId = elId(el);
    var newId = oldId + suffix;
    if (el.hasAttribute("data-edit-id")) el.setAttribute("data-edit-id", newId);
    if (el.hasAttribute("data-resize-id")) el.setAttribute("data-resize-id", newId);
    pairs.push({ old: oldId, new: newId, el: el });
  });
  return pairs;
}

/**
 * Inserts a built duplicate into the dom.
 * @param sourceEl the element that was duplicated
 * @param built the object buildDuplicateClone() returned
 * @note A still-in-flow source gets its clone dropped in as a plain sibling,
 * so it slots naturally into whatever layout the two now share - no
 * coordinate maths. A detached source gets its whole wrap cloned beside the
 * original and nudged +24px so the copy doesn't land exactly on top of it.
 */
function insertDuplicateClone(sourceEl, built) {
  /* marks the copy's own root for isCopyRoot(), the same job data-clip-root
     does for a paste. Stamped here rather than baked into the clone so a
     reload's renderDuplicates() gets it too. */
  if (built.rootEl) built.rootEl.setAttribute("data-dup-root", "1");
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
 * One-time copy of every per-id override from a duplicate's old ids to its
 * new ones, so the copy starts out identical instead of snapping back to the
 * template default.
 * @param pairs the {old, new} id pairs from buildDuplicateClone()
 * @param skipMaps optional map names NOT to carry over - the clipboard passes
 *   ["positions"], since an offset that meant something relative to the
 *   source's place would only drag the pasted copy away from where it landed
 * @note Only ever called when a duplicate is created, never on a later
 * reload: every map is permanently keyed by the new ids afterwards, so
 * redoing it would blow away any independent edit made to the duplicate.
 * @note text_styles gets a shallow copy rather than a shared reference, since
 * the savers mutate that object in place - sharing it would leak a later font
 * change on either copy onto the other.
 */
function copyDuplicateOverrides(pairs, skipMaps) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snap;
  try { snap = raw ? JSON.parse(raw) : {}; } catch (e) { snap = {}; }
  var skip = skipMaps || [];
  var plainMaps = ["sizes", "positions", "font_sizes", "colors", "opacity", "text", "fill", "tint", "shade", "radius", "border", "links", "text_color", "theme_icons", "dark_colors", "dark_text_color", "dark_fill", "dark_border", "progress_fill", "dark_progress_fill", "progress_track", "dark_progress_track", "rotate", "hover_color", "dark_hover_color", "active_color", "dark_active_color", "padding", "tooltips"];
  var flatLists = ["shadow", "flip_h", "flip_v"].concat(VIDEO_PLAYBACK_KEYS);
  pairs.forEach(function (p) {
    plainMaps.forEach(function (m) {
      if (skip.indexOf(m) !== -1) return;
      if (snap[m] && snap[m][p.old] !== undefined) {
        snap[m] = snap[m] || {};
        snap[m][p.new] = snap[m][p.old];
      }
    });
    if (snap.text_styles && snap.text_styles[p.old]) {
      snap.text_styles = snap.text_styles || {};
      snap.text_styles[p.new] = Object.assign({}, snap.text_styles[p.old]);
    }
    flatLists.forEach(function (m) {
      if (Array.isArray(snap[m]) && snap[m].indexOf(p.old) !== -1 && snap[m].indexOf(p.new) === -1) {
        snap[m].push(p.new);
      }
    });
    /* the always-on-top group (the right-click "Promote to navbar", see
       FIXED_SET) - without it a copy of a navbar element came out as a plain
       element that just happened to be sitting in the bar. Live set as well
       as the snapshot, since nothing re-reads fixed_elements before the next
       load. LOCKED_SET is deliberately not carried over: a paste is selected
       for dragging straight away, and a locked copy couldn't be moved. */
    if (FIXED_SET[p.old]) {
      FIXED_SET[p.new] = true;
      snap.fixed_elements = Object.keys(FIXED_SET);
    }
  });
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snap)); } catch (e) {}
}

/**
 * Registers a duplicate so it survives a reload: content.duplicates is a flat
 * list of {sourceId, suffix}, just enough to redo the same clone and remap on
 * every future load.
 * @param sourceId the id that was duplicated
 * @param suffix see uniqueDupSuffix()
 * @note The style and text overrides for its ids are already in the normal
 * maps by then, so this only has to recreate the DOM structure.
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
 * Duplicates one element from the right-click menu: clones it with a fresh id
 * on itself and every tracked element inside, drops the copy next to the
 * original, copies over existing overrides so it starts out identical,
 * registers it so it survives a reload, and wires up click-to-edit on every
 * text field in the copy (dom clones don't carry js listeners).
 * @param sourceEl the specific element node that was right-clicked - not just
 *   its id, which a mirrored element can share with another node
 * @return the new copy's own live node, so a caller like the Ctrl+V handler
 *   can select it
 * @note Undo/redo reuses the plain "add" entry shape: undoing hides the new
 * element, redoing unhides it, and neither side ever has to rebuild or
 * discard the content.duplicates entry.
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
  return built.rootEl;
}

/* ---------------------------------------------------------------------------
   THE EDITOR CLIPBOARD

   Ctrl+C used to hold the copied element in a plain variable, so the copy died
   the moment the iframe navigated to another page - which made "copy this from
   the landing page onto the dashboard", the one thing a clipboard is for, the
   one thing it couldn't do.

   It's a localStorage entry now, so it outlives the page it came from. Not the
   real system clipboard: that needs a permission prompt to read, and anything
   else the ta copied while working would silently overwrite their element.

   What's stored is the markup, not a reference, and a paste rebuilds it as a
   free-placed custom element wherever it lands. Free-placed is also what makes
   a paste survive a reload: a duplicate is re-cloned from its source id and
   would have nothing to clone on a page the source doesn't exist on, whereas a
   custom element carries everything it needs to rebuild itself.
   --------------------------------------------------------------------------- */

/* one element, shared by every page of the editor. Deliberately its own key
   rather than a field inside the content snapshot: a copied element isn't
   content until it's actually pasted, and it must never ride along into an
   Apply, a saved profile, or a preview. */
var EDITOR_CLIP_KEY = "editor_clipboard";

/* how far a paste lands from whatever it was pasted off, in both axes. Small
   enough that the copy still overlaps the original (so it reads as "that's a
   second one of those", not "something new appeared over there"), big enough
   that the corner sticking out is unmistakable. Same 24px insertDuplicateClone()
   already nudges an out-of-flow duplicate by, so a Duplicate and a paste of the
   same element sit in the same place. */
var PASTE_OFFSET = 24;

/* the last element pasted from the clipboard entry currently held, so a run of
   pastes cascades down the diagonal instead of dropping every copy on the same
   spot. Cleared by a fresh Ctrl+C (a new copy anchors to its OWN source) and
   never persisted - it's a within-session convenience, and the id it holds may
   not even exist on the next page the ta pastes onto, which pasteAnchorEl()
   checks for rather than assumes. */
var LAST_PASTE_ID = null;

/**
 * Strips the bits of a copied subtree that only meant something where it came
 * from, so the markup can be dropped onto any page.
 * @param root the cloned subtree to clean, mutated in place
 * @note Removed: dom id="..." (a singleton role the copy doesn't inherit);
 * the editor-only outline classes, recomputed per page anyway;
 * contenteditable, in case the source was mid-edit; and
 * data-nav-state/data-dash-view, which mark an element as belonging to one
 * state of a two-state page - on any other page nothing flips that state back
 * on, so a copy carrying one in could arrive hidden.
 * @note Also the ROOT's own drag offset, since a paste is placed where it's
 * dropped. Kept on everything below the root, where an offset is a real part
 * of how the thing is arranged internally.
 */
function stripClipAttrs(root) {
  var all = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
  all.forEach(function (el) {
    if (!el.removeAttribute) return;
    el.removeAttribute("id");
    el.removeAttribute("contenteditable");
    el.removeAttribute("data-nav-state");
    el.removeAttribute("data-dash-view");
    el.classList.remove("edit-fixed", "edit-link", "edit-locked", "nav-state-off", "dash-view-off");
  });
  delete root.dataset.ovTx;
  delete root.dataset.ovTy;
}

/**
 * Ctrl+C: puts one element on the editor's clipboard, its markup frozen at
 * the size it's currently rendered at - so a paste looks like what was copied
 * even when the source was in-flow and got its width from the column it sat
 * in, which the free-placed copy has no equivalent of.
 * @param sourceEl the element to copy (RING_EL)
 * @return true if it was stored
 * @note Measured off offsetWidth/Height where available rather than the
 * bounding rect, which for a rotated element reports the box its corners
 * sweep out rather than the box itself.
 */
function copyElementToClipboard(sourceEl) {
  var sourceId = elId(sourceEl);
  if (!sourceId) return false;
  var rect = sourceEl.getBoundingClientRect();
  var w = sourceEl.offsetWidth || rect.width;
  var h = sourceEl.offsetHeight || rect.height;
  var clone = sourceEl.cloneNode(true);
  stripClipAttrs(clone);
  clone.style.width = w + "px";
  clone.style.height = h + "px";
  var clip = { page: currentPageKey(), sourceId: sourceId, html: clone.outerHTML };
  try { localStorage.setItem(EDITOR_CLIP_KEY, JSON.stringify(clip)); } catch (e) { return false; }
  /* a new copy starts its own cascade: the first paste of THIS element belongs
     next to this element, not next to whatever was pasted last */
  LAST_PASTE_ID = null;
  return true;
}

/** @return the element currently on the editor clipboard, or null */
function readEditorClip() {
  var raw;
  try { raw = localStorage.getItem(EDITOR_CLIP_KEY); } catch (e) { raw = null; }
  if (!raw) return null;
  try {
    var clip = JSON.parse(raw);
    return clip && clip.html ? clip : null;
  } catch (e) { return null; }
}

/**
 * What a paste should be measured from: the previous paste of the same clip
 * if it's still on this page, so a run of Ctrl+V walks down the diagonal
 * rather than piling every copy on one spot - otherwise the element that was
 * copied, if the ta is still on the page it came from.
 * @param clip see readEditorClip()
 * @return the element to place the next paste relative to, or null
 * @note Null on any other page, where there's nothing on screen for the copy
 * to sit near and the drop falls back to the pointer.
 */
function pasteAnchorEl(clip) {
  var prev = LAST_PASTE_ID && elByAnyId(LAST_PASTE_ID);
  if (prev) return prev;
  if (clip.page !== currentPageKey()) return null;
  return (clip.sourceId && elByAnyId(clip.sourceId)) || null;
}

/**
 * Ctrl+V: pastes whatever's on the editor clipboard, landing PASTE_OFFSET px
 * down-and-right of whatever it was pasted off, so the copy overlaps the
 * original with one corner clear - the "there are two of these now" read
 * every other design tool gives you.
 * @param x fallback drop point (the pointer), document px, used only when
 *   there's no anchor on this page
 * @param y fallback drop point, document px
 * @return the pasted element, or null if the clipboard was empty
 * @note That drop point is why a same-page paste no longer routes through
 * duplicateElement(). A duplicate is inserted into the source's own FLOW
 * position, right for the Duplicate button but the one thing a paste must not
 * do: flow decides where the copy goes, so it lands a full element away - a
 * duplicated hero image appeared 342px down the page - and reflows everything
 * below on the way. A paste is rebuilt free-placed instead, so it takes the
 * coordinates it's given and costs the page no layout at all.
 * @note The exception is an element in the fixed navbar, which stays on
 * duplicateElement(): the bar doesn't scroll with the document, so a copy
 * pinned to document coordinates would slide out from under it.
 */
function pasteEditorClip(x, y) {
  var clip = readEditorClip();
  if (!clip) return null;
  var anchor = pasteAnchorEl(clip);
  var pasted;
  if (anchor && anchor.closest && anchor.closest("nav")) {
    pasted = duplicateElement(anchor);
  } else {
    if (anchor) {
      var r = anchor.getBoundingClientRect();
      x = r.left + window.scrollX + PASTE_OFFSET;
      y = r.top + window.scrollY + PASTE_OFFSET;
    }
    pasted = pasteClipAsElement(clip, x, y);
  }
  LAST_PASTE_ID = pasted ? elId(pasted) : null;
  return pasted;
}

/**
 * Rebuilds a stored clipboard entry as a brand new free-placed element:
 * parses the markup, gives it and everything tracked inside fresh ids, copies
 * the source's overrides onto those ids, and registers the whole thing in
 * content.custom_elements as a "clip" so it rebuilds on every future load.
 * @param clip see readEditorClip()
 * @param x drop point, document px
 * @param y drop point, document px
 * @return the pasted element, or null if the stored markup was unusable
 */
function pasteClipAsElement(clip, x, y) {
  var holder = document.createElement("div");
  holder.innerHTML = clip.html;
  var node = holder.firstElementChild;
  if (!node || !node.matches(RESIZABLE_SEL)) return null;
  var suffix = uniqueDupSuffix();
  var pairs = remapTrackedIds(node, suffix);
  var rootId = elId(node);
  if (!rootId) return null;
  /* before the element is built, so the text/size/color overrides are already
     in the snapshot when the build's own passes read them. The root's saved
     POSITION is the one thing deliberately left behind - it's an offset from
     wherever the source sat in its own page, and the paste has its own drop
     point (everything below the root keeps its offsets, which are part of how
     the copied thing is arranged inside itself) */
  copyDuplicateOverrides([pairs[0]], ["positions"]);
  if (pairs.length > 1) copyDuplicateOverrides(pairs.slice(1));
  var el = addCustomElement("clip", x, y, { rootId: rootId, html: node.outerHTML });
  if (!el) return null;
  /* the copied markup still carries the inline transforms the source was
     painted with, including the offsets nested elements use to cancel out a
     move of an ancestor (see paintPos()/ancestorPos()). The paste's root
     hasn't been moved anywhere, so there's nothing to cancel: repainting the
     subtree recomputes every one of them from scratch. */
  paintPos(el);
  el.querySelectorAll(RESIZABLE_SEL).forEach(paintPos);
  /* markup carries no js listeners, so every link inside the paste needs its
     own click handler re-wired, exactly as duplicateElement() does for a clone */
  pairs.forEach(function (p) {
    var linkUrl = LINKS[p.old];
    if (linkUrl) {
      LINKS[p.new] = linkUrl;
      var live = elByAnyId(p.new);
      if (live) applyOneLink(live, linkUrl);
    }
  });
  applyFixedHighlight();
  applyLinkHighlight();
  applyLockHighlight();
  return el;
}

/**
 * Recreates every duplicate a ta has made via the right-click "Duplicate"
 * option, on every load, live site included.
 * @param list content.duplicates
 * @note Unlike a custom element, built from a structured recipe, a duplicate
 * is reconstructed by re-cloning whatever its source id currently renders as,
 * so it always matches the source's own markup even if that markup changed.
 * @note Runs in repeated capped passes so a duplicate-of-a-duplicate renders
 * correctly regardless of array order: each pass renders whatever has a
 * findable source, stopping once a full pass makes no progress.
 * @note Called before applyHiddenOverrides() specifically, so a duplicate of
 * a since-deleted source is still cloned from what it looked like before it
 * was hidden.
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
 * Uploads one file for the "Add element" menu, to the same ta-only
 * /api/upload endpoint every other upload on the site posts to.
 * @param file the File object from the picker
 * @return a promise resolving to the uploaded file's url
 * @note Reads the token straight out of localStorage rather than going
 * through js/ta.js, which never loads on this file's pages; same-origin, so
 * the token is there whether this runs in the portal tab or its iframe.
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
 * Looks up a placed custom element's own data entry by id, for the right-click
 * "Edit date/time" flow.
 * @param id the element's id
 * @return the CUSTOM_ELEMENTS entry, or null if none match
 * @note Unlike elByAnyId(), which finds the live DOM node, this finds the
 * plain data object held for it.
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
var BOUND_TILE_SELECTORS = ['[data-reel-tile="1"]', '[data-extras-tile="1"]', '[data-days-tile="1"]',
  '[data-gallery-tile="1"]'];

/**
 * Finds the box a new element being placed at document (x, y) should be
 * seated in, instead of landing as an independent page element floating over
 * it.
 * @param x drop point left, document px
 * @param y drop point top, document px
 * @return the box under the point, or null
 * @note The box counterpart of findBoundTileHit() just below, and there for
 * the same reason: "add an element inside this container" is what a ta means
 * by right-clicking inside one, and answering it with a free element pinned
 * on top instead is what made a new box look like it had deleted the text
 * already in the container. It hadn't - a box is an opaque panel and lands at
 * the top of the stacking order, so it was simply covering it.
 * @note No Alt here, unlike a DRAG into a box (see trackBoxDrop()'s ALT-DROP
 * note). The key guards a drag because seating throws away a free position
 * the ta had already arranged by hand; a brand-new element has no such
 * position to lose, which is exactly why adding over a TILE has always bound
 * to it with no key either.
 * @note The point only, never the new element's hitbox: a box that merely
 * overlaps a corner of what is being placed hasn't been pointed at, and
 * swallowing an element on that basis is the surprise the Alt rule exists to
 * avoid.
 */
function findBoxDropHit(x, y) {
  return boxDropTargetAt(x - window.scrollX, y - window.scrollY, null);
}

/**
 * Finds the tile a new element being placed at document (x, y) should bind
 * into, instead of landing as an independent page element.
 * @param x drop point left, document px
 * @param y drop point top, document px
 * @param kind the element kind being added
 * @return the hit tile element, or null if neither the cursor nor the hitbox
 *   touches any tracked tile
 * @note Tested against the drop point itself, or - for kinds with a known
 * fixed placed size - the element's about-to-be-placed hitbox. Cursor alone
 * is the fallback for every other kind, since text, buttons and icons size
 * themselves from their own content, so there's nothing to hit-test until
 * after they're built.
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
 * Finishes wiring a freshly built element identically whether it landed as a
 * top-level page element or bound into a tile: text fields get click-to-edit,
 * a theme toggle gets its nested label wired and synced to the live theme,
 * and a button's initial link is applied as a real href.
 * @param el the built, placed element
 * @param d its descriptor (already has final left/top/w/h)
 * @param kind the element kind
 * @param extra the same extra addCustomElement() was called with
 */
function finishAddedElement(el, d, kind, extra) {
  if (kind === "text" || kind === "button") wireTextField(el);
  if (kind === "navPortal" || kind === "navDashboard" || kind === "navLogout") {
    /* its label is the element itself (single tagged node, same as "button"),
       so one wireTextField() call makes it typeable straight away; the click
       behaviour needs no wiring at all, wireNavButtons() is delegated. This
       just brings the new button up to date with the current state - which for
       a Dashboard button means its href and role wording. */
    wireTextField(el);
    applyNavSessionState();
  }
  if (kind === "clip") {
    /* a paste can be anything, including a whole subtree of text fields (a
       card with a heading and a paragraph in it), so every tagged node in
       there gets click-to-edit wiring, not just the root */
    if (el.hasAttribute("data-edit-id")) wireTextField(el);
    el.querySelectorAll("[data-edit-id]").forEach(wireTextField);
  }
  /* an attachment icon only knows which glyph to draw once it's actually
     placed inside a tile, see repaintExtrasTypeIcons() */
  if (kind === "extrasIcon") repaintExtrasTypeIcons();
  if (kind === "reel" && window.initReel) {
    /* every other kind is live the instant it's built, but a reel's
       drift/hover/loop only starts once js/learn-reel.js clones and wires it,
       normally once at page load - a freshly placed one needs that call made
       directly or it just sits as a static row of tiles until the next
       reload. Runs AFTER freezeFreeElement() has frozen the panel at its
       pre-clone size, so the clones overflow into that box instead of
       growing it. */
    window.initReel(el);
  }
  if (kind === "progress") {
    /* paints its real fill width/colors off the two just-defaulted variable
       bindings right away - VARIABLES is already populated from the initial
       page load by the time a ta can interactively add one, so there's no
       need to wait for the next full reload's applyProgressBindings() pass */
    paintProgressElement(el, d);
  }
  if (kind === "loginField" || kind === "loginButton" || kind === "loginError") {
    /* same shape as "theme" just below: the element a ta placed carries only
       data-resize-id, and the click-to-edit fields are the spans nested
       inside it (the box's placeholder, the button's label, the failure
       line's two strings), so each of those needs its own wireTextField()
       call to be typeable straight away rather than only after the next
       reload. */
    el.querySelectorAll("[data-edit-id]").forEach(wireTextField);
    /* and the new box has to start out showing its placeholder / hidden,
       which is js/login.js's job (this page's own script, same window.-hook
       convention window.renderExtras uses on the dashboard) */
    if (window.refreshLoginPage) window.refreshLoginPage();
    /* a failure line placed while the State switch is on "Timed out" has to
       land showing the timed-out wording, or the one thing the ta is looking
       at the page FOR comes up as the other string */
    applyLoginView(LOGIN_VIEW);
  }
  if (kind === "galleryPane") {
    /* a brand new stage is empty markup until js/gallery.js paints the
       directory it was just bound to into it - and placing one also creates
       that binding's two variables and two link actions, so the counter/arrow
       chips already on the page need repainting too (see renderGallery()) */
    if (window.renderGallery) window.renderGallery();
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
 * Adds one new element via the right-click "Add element" menu, built through
 * the exact same construction that recreates it on every future load, then
 * frozen at its just-rendered size and pushed onto content.custom_elements so
 * it round-trips through Apply and profiles like everything else.
 * @param kind "text", "button", "box", "image", "video", "icon", "datetime",
 *   "theme", or "reel"
 * @param x left, document px (where the menu was opened)
 * @param y top, document px
 * @param extra {icon, url} for "icon", {href} for "button", {url} for
 *   "image"/"video"; "datetime" takes sensible defaults (countdown, 30 days
 *   out) and is configured from the style popover afterward; {orientation}
 *   for "reel"
 * @return the new element
 * @note Always lands on top of the stacking order, as a ta would expect from
 * something they just placed.
 * @note If the drop point (or, for box/image/video, the new element's own
 * hitbox) lands on a tile, delegates to addBoundElement() instead.
 */
function addCustomElement(kind, x, y, extra) {
  extra = extra || {};
  var uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  /* "icon."-prefixed ids are what elKind() reads to treat an element as an
     icon (aspect ratio locked on resize, icon-shaped style popover), so the
     attachment type icon takes that prefix too - it IS an icon, just one
     whose glyph is resolved per tile, see buildCustomElementNode() */
  var prefix = kind === "icon" ? "icon.custom." : kind === "extrasIcon" ? "icon.extras." : "custom." + kind + ".";
  var d = { id: prefix + uid, kind: kind, page: currentPageKey(), left: Math.round(x), top: Math.round(y) };
  /* on the dashboard, WHICH of its two pages this was placed on (see
     applyDashView()); anywhere else the page has only one and this stays off
     the descriptor entirely */
  if (currentPageKey() === "dashboard" && dashView() === "gate") d.dashView = "gate";
  if (kind === "icon") { d.icon = extra.icon; d.url = extra.url; }
  if (kind === "image" || kind === "video") d.url = extra.url;
  /* which credential this box collects, picked before placing (the right-
     click menu offers "Username box" and "Password box" as two separate
     entries, see renderCtxMenuRoot()); it decides the input type, the
     autocomplete hint and the default placeholder text, so it's baked into
     the descriptor rather than resolved at render time */
  if (kind === "loginField") d.field = extra.field === "password" ? "password" : "username";
  /* which directory this stage flips through, picked before placing (the
     right-click menu lists every directory the content manager currently has,
     see renderCtxMenuGalleryDirPicker()) - it decides which images the pane
     shows AND which pair of page-exclusive variables/link actions it brings
     into existence, so it's baked into the descriptor rather than resolved at
     render time. "" is the seeded pane's "follow the rail" binding. */
  if (kind === "galleryPane") d.dir = extra.dir || "";
  /* a paste keeps the id its markup was already remapped to, rather than being
     handed a fresh "custom.clip.*" one: everything inside the stored html is
     namespaced under that root id, and the override maps were copied across
     under it too (see pasteClipAsElement()) */
  if (kind === "clip") {
    d.id = extra.rootId || d.id;
    d.html = extra.html;
  }
  if (kind === "datetime") {
    d.target = extra.target || new Date(Date.now() + 30 * 86400000).toISOString();
    d.format = extra.format || "countdown";
    d.strftime = extra.strftime || "";
  }
  if (kind === "progress") {
    /* binds to the two builtin variables by default (see
       DEFAULT_CONTENT["variables"] in app/db.py); re-bindable afterward from
       the right-click menu's "Bind variables..." sub-view (see
       renderCtxMenuProgressVars()), same "sensible defaults, configure after"
       pattern as datetime just above. */
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

  /* extra.tile is an explicit "bind to this tile, wherever the cursor is"
     (see handleCtxAdd()'s extrasIcon branch); everything else resolves its
     owner from the drop point/hitbox, see findBoundTileHit() */
  var tileHit = kind === "reel" ? null : (extra.tile || findBoundTileHit(x, y, kind));
  if (tileHit) return addBoundElement(tileHit, kind, d, extra);

  var el = buildCustomElement(d);
  freezeFreeElement(el);
  d.w = parseFloat(el.dataset.natW);
  d.h = parseFloat(el.dataset.natH);
  CUSTOM_ELEMENTS.push(d);
  saveCustomElements(CUSTOM_ELEMENTS);
  LAYER_ORDER.push(d.id);
  /* dropped inside a box: join it, exactly as an Alt-drag into one would, so
     the box lays the new element out beside what it already holds instead of
     leaving it floating over the top. AFTER the push above, so the id that
     seatInBox() reconciles against is already in the order and can't be
     appended to it a second time. */
  var boxHit = findBoxDropHit(x, y);
  if (boxHit) {
    seatInBox(el, boxHit, boxDropIndexAt(boxHit, x - window.scrollX, y - window.scrollY, el));
  }
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
 * Resolves which content array actually owns tileEl, so addBoundElement() can
 * push a new bound child onto it and persist it regardless of tile kind.
 * @param tileEl a tile matching one of BOUND_TILE_SELECTORS
 * @return {children, persist()}, or null if no matching owner is found
 * @note A reel tile's owner is its reel entry's own tiles[].children; an
 * attachments tile's is the matching content.extras[] entry's children; a day
 * tile's is the matching content.days[] entry's.
 * @note The last two only exist as globals on the student dashboard, which is
 * also the only place their selectors ever match, so referencing them here is
 * safe.
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
  /* a gallery directory tile's owner is the TEMPLATE, not the directory: there
     is no per-directory entry to hang anything off (content.gallery.years is a
     list of bare strings), and every tile in the rail is one rendering of one
     shared template anyway - so what's placed on one is placed on all of them,
     the same way the rect and the label already are. See TILE_CHILDREN. */
  if (tileEl.hasAttribute("data-gallery-tile")) {
    var gid = tileId || "gallery.dir.tile";
    var gChildren = tileChildrenFor(gid).slice();
    return { children: gChildren, persist: function () {
      saveTileChildren(gid, gChildren);
      /* the drop landed on one tile, but what was saved belongs to all of
         them, so every sibling is given the same child right now rather than
         only on the next render - the live half of the same mirror
         mirrorTiledRoleGeometry() does for a role's geometry */
      document.querySelectorAll('[data-gallery-tile]').forEach(function (other) {
        if (other !== tileEl) renderTileChildren(other, gChildren);
      });
    } };
  }
  return null;
}

/**
 * The "drop landed on a tracked tile" branch of addCustomElement(): the same
 * descriptor and the same builder, but appended into tileEl rather than
 * document.body, and persisted nested inside the owning tile's own children
 * array instead of as a new top-level entry.
 * @param tileEl the hit tile DOM node (see findBoundTileHit())
 * @param kind the element kind being added
 * @param d its descriptor, left/top still in page coordinates at this point
 * @param extra see addCustomElement()
 * @return the built, bound (or, on fallback, unbound) element
 * @note That nesting is what makes bound content travel with its tile through
 * reel scrolling or a shared-template re-render.
 * @note Falls back to the unbound path if no owner is found - it shouldn't
 * happen, but a silently dropped element would be a worse failure than a
 * stray top-level one.
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

  /* tile-relative, and never outside the tile: the drop point can genuinely
     sit outside it (an element bound by its HITBOX rather than the cursor,
     see findBoundTileHit(), or a tile-scoped kind bound explicitly, see
     handleCtxAdd()), and a bound child is supposed to live within its
     tile's bounds from the moment it's placed - the same rule clampOwnPos()
     enforces for every move afterward. */
  var tileRect = tileEl.getBoundingClientRect();
  var edge = 8;
  d.left = Math.round(Math.max(0, Math.min(d.left - (tileRect.left + window.scrollX), Math.max(0, tileRect.width - edge))));
  d.top = Math.round(Math.max(0, Math.min(d.top - (tileRect.top + window.scrollY), Math.max(0, tileRect.height - edge))));

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
 * Rebuilds every bound child inside tileEl from its saved descriptors - the
 * attachments/day tile equivalent of what buildReelElement() does for a reel
 * tile's children on every render.
 * @param tileEl a tile matching one of BOUND_TILE_SELECTORS
 * @param children the tile's own saved children array (may be empty)
 * @note Called right after a tile's shared-template pieces are built, since
 * those renderers rebuild the tile's innerHTML from scratch every call.
 * @note Repainting their saved overrides is the caller's job, once for the
 * whole area - see applyLiveAreaOverrides().
 */
function renderTileChildren(tileEl, children) {
  /* only the wraps holding bound children, never the ones detachFromFlow() put
     around the tile's own rect/icon/text/button - see placeInTile() */
  tileEl.querySelectorAll(":scope > .free-wrap[data-tile-child]").forEach(function (w) { w.remove(); });
  (children || []).forEach(function (d) {
    var el = buildCustomElementNode(d);
    placeInTile(tileEl, el, d.left || 0, d.top || 0);
    if (d.w) el.style.width = d.w + "px";
    if (d.h) el.style.height = d.h + "px";
    if ((d.kind === "text" || d.kind === "button") && isPreviewMode() && isEditMode()) wireTextField(el);
    if (d.kind === "progress") paintProgressElement(el, d);
    if (d.kind === "button" && d.id && LINKS[d.id]) applyOneLink(el, LINKS[d.id]);
  });
}
window.renderTileChildren = renderTileChildren;

/**
 * Re-runs the generic override sweeps over a live area that has just rebuilt
 * its tiles, then repaints every per-tile local chip and attachment icon.
 * @param data the full content blob (for the override maps)
 * @note Needed because an extras/days area renders AFTER the shared sweep
 * pass already ran once, against a DOM with none of these tiles in it. Every
 * tile role and bound child would otherwise come out at raw template
 * geometry, silently dropping every move a ta has saved.
 * @note The sweeps are plain document-wide queries keyed by id, so re-running
 * them is both safe and exactly what makes the shared template mirror: one
 * saved {tx,ty} lands on every rendered tile's icon at once.
 */
function applyLiveAreaOverrides(data) {
  if (!data) return;
  applyTextOverrides(data.text || {});
  applyAreaFlowOverrides(data.area_flow);
  applyTileChildrenOverrides(data.tile_children);
  /* the tiles are tiled to their real track width BEFORE the size sweep.
     applySizeOverrides() detaches every element carrying a saved size, and
     detachFromFlow() freezes its wrap at whatever it measures AT THAT MOMENT
     - so running it first froze the wraps inside a day card against a card
     that was still a full-width grid item, leaving ~1030px slots inside a
     card about to become ~340px. That stale figure then became the card's own
     min-content width and snapped the tile to full width on the first
     mousemove of any resize. EDIT_SIZES is seeded by hand because it's the
     one thing this pass needs out of the sizes map. */
  EDIT_SIZES = data.sizes || {};
  applyTileFlow();
  applySizeOverrides(data.sizes);
  /* between the size and position sweeps, not after both. It reads the sizes
     just loaded, and what it does with them - how many columns, therefore how
     wide a tile, therefore how much room an element inside one has - is
     exactly what the position pass then clamps against. The other way round,
     that pass clamps every saved offset against a grid still at its pre-load
     defaults, silently rewriting offsets that are legal once the real layout
     lands. */
  applyTileFlow();
  applyFontSizeOverrides(data.font_sizes);
  applyTextStyleOverrides(data.text_styles);
  applyPaddingOverrides(data.padding);
  applyPositionOverrides(data.positions);
  applyColorOverrides(data.colors, data.dark_colors);
  applyRadiusOverrides(data.radius);
  applyHiddenOverrides(data.hidden);
  /* again, now that everything is painted: a y-locked container's mirrored
     height is measured from its tiles' real natural heights, which the sweeps
     above (a resized icon, a hidden row, a longer filename) can change */
  applyTileFlow();
  repaintLocalTileContent();
  /* the tiles in here were rebuilt from scratch a moment ago, so every one of
     them came back carrying none of the responsive layer - same reason every
     other sweep above is re-run over them. The host observer goes with it: the
     containers it was watching are not the containers now in the dom. */
  applyResponsiveBehaviour();
  if (window.observeResponsiveHosts) window.observeResponsiveHosts();
}
window.applyLiveAreaOverrides = applyLiveAreaOverrides;

/**
 * Drops a saved object onto the canvas at (x, y): every part is rebuilt under
 * a freshly suffixed id, offset so the object's own bounding box lands with
 * its top-left at (x, y) regardless of where its parts sat in the mini editor.
 * @param objData the object's stored bundle (an object row's "data")
 * @param x left, document px (where the menu was opened)
 * @param y top, document px
 * @note Every per-id override the bundle carries - sizes, positions, colours,
 * even its internal groupings and stacking order - is remapped onto the new
 * ids and merged into the live snapshot, the same trick a plain duplicate
 * uses, just sourced from a separate bundle rather than the same document.
 * @note Every part not already tied together by an internal grouping still
 * ends up in one all-parts group, so a placed object moves as a single rigid
 * unit - the whole point of placing one.
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

  var page = currentPageKey();
  var newParts = parts.map(function (p) {
    var np = Object.assign({}, p);
    np.id = idMap[p.id];
    np.page = page;
    np.left = Math.round((p.left || 0) + dx);
    np.top = Math.round((p.top || 0) + dy);
    return np;
  });
  snap.custom_elements = (snap.custom_elements || []).concat(newParts);

  var plainMaps = ["sizes", "positions", "font_sizes", "colors", "opacity", "text", "fill", "tint", "shade", "radius", "border", "links", "text_color", "theme_icons", "dark_colors", "dark_text_color", "dark_fill", "dark_border", "progress_fill", "dark_progress_fill", "progress_track", "dark_progress_track", "padding", "tooltips"];
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
  ["shadow", "locked"].concat(VIDEO_PLAYBACK_KEYS).forEach(function (m) {
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

  /* land the whole placed object above everything already on the canvas.
     applyLayerOrder() appends any id MISSING from content.layers straight
     after whatever IS listed, so a layers array holding only the new ids
     would leave every pre-existing element - never explicitly listed itself -
     appended after them, on top of the object just placed. Resolving the full
     effective order first is what guarantees the new ids land last. */
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
  applyPaddingOverrides(snap.padding);
  applyPositionOverrides(snap.positions);
  applyColorOverrides(snap.colors, snap.dark_colors);
  applyFillOverrides(snap.fill, snap.dark_fill);
  applyTextColorOverrides(snap.text_color, snap.dark_text_color);
  applyStateColorOverrides(snap.hover_color, snap.dark_hover_color, snap.active_color, snap.dark_active_color);
  applyTintOverrides(snap.tint);
  applyShadeOverrides(snap.shade);
  applyVideoPlaybackOverrides(snap.video_no_autoplay, snap.video_controls, snap.video_pausable);
  applyRadiusOverrides(snap.radius);
  applyBorderOverrides(snap.border, snap.dark_border);
  applyShadowOverrides(snap.shadow);
  applyOpacityOverrides(snap.opacity);
  applyFlipRotateOverrides(snap.flip_h, snap.flip_v, snap.rotate);
  applyTooltipOverrides(snap.tooltips);
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

/* the attachments/day tile a ta most recently clicked into, so a right-click
   on the AREA around the tiles (rather than precisely on one) still knows
   which tile its "insert variable" actions should act on - the spec's "they
   have to right click the area ... and it will automatically be treated as
   part of the tile the user has selected, or had selected last". Session
   state only, never persisted, and re-validated on use since either tile can
   be thrown away by the next renderExtras()/renderDays(). */
var LAST_TILE = { extras: null, days: null };

/**
 * Records whichever tiles el sits inside as the current ones, for the
 * "or had selected last" fallback above. Called from the editor's own
 * selection mousedown and from every right-click, so simply clicking a tile
 * is enough - a ta never has to know the fallback exists.
 * @param el the just-selected/right-clicked element (null is ignored)
 */
function noteTileSelection(el) {
  if (!el || !el.closest) return;
  var x = el.closest("[data-extras-tile]");
  if (x) LAST_TILE.extras = x;
  var d = el.closest("[data-days-tile]");
  if (d) LAST_TILE.days = d;
}

/**
 * The tile the context menu's tile-scoped actions should act on: the one the
 * right-click landed inside, else the last one selected - but only when the
 * click landed somewhere inside the live area that owns these tiles at all.
 * @param kind "extras" or "days"
 * @return the tile element, or null
 * @note That last condition keeps these per-tile variables invisible "outside
 * the tile": right-clicking elsewhere offers nothing about them.
 */
function ctxTileFor(kind) {
  if (!CTX_TARGET_EL || !CTX_TARGET_EL.closest) return null;
  var direct = CTX_TARGET_EL.closest(kind === "extras" ? "[data-extras-tile]" : "[data-days-tile]");
  if (direct) return direct;
  if (!CTX_TARGET_EL.closest("[data-extras-area], [data-days-area]")) return null;
  var last = LAST_TILE[kind];
  return last && last.isConnected ? last : null;
}

/**
 * The tile flow container the context menu's Container section should act on:
 * the innermost one the right-click landed inside.
 * @return the container element, or null if the click wasn't inside one
 * @note So a right-click on a day card's attachment offers that day's
 * sub-area, while one on the card itself offers the days area around it.
 */
function ctxFlowArea() {
  if (!CTX_TARGET_EL || !CTX_TARGET_EL.closest) return null;
  return CTX_TARGET_EL.closest("[data-flow-area]");
}

/** Builds the context menu once, lazily. */
function buildCtxMenu() {
  CTX_MENU = document.createElement("div");
  CTX_MENU.className = "ctx-menu";
  document.body.appendChild(CTX_MENU);
}

/**
 * The right-click menu's second line, for an element that only exists in one
 * of the landing page's two navbar states - "" for everything else, which on
 * every page but the landing page is everything.
 * @return the note's html, or "" if the element isn't state-bound
 * @note The landing page ships two navbars and shows one, and "one" means
 * display:none on the whole <nav> - so an element belongs to a state either
 * by carrying data-nav-state itself or by sitting inside a navbar that does.
 * @note The editor has always rendered this faithfully, but faithfully isn't
 * legibly. Both halves need an element to have LEFT the navbar visually: drag
 * the "Schedule" link into the hero and it's still a child of the signed-out
 * <nav>. It then looks like ordinary hero content while staying invisible to
 * every signed-in visitor - and since a ta works with the switch on whichever
 * state they're building, the only way to find out was to publish.
 * @note So: say it, on the element, as they look at it. Not a warning - this
 * is often deliberate - just the fact, plus what they can do about it: a
 * placed nav button is re-pointed by the "Shown to" switch below this note,
 * and anything else is pointed at the portal's Navbar switch.
 */
function ctxNavStateNoteHtml() {
  if (!CTX_TARGET_EL) return "";
  var holder = CTX_TARGET_EL.closest("[data-nav-state]");
  if (!holder) return "";
  var state = holder.getAttribute("data-nav-state");
  if (state !== "in" && state !== "out") return "";
  var own = holder === CTX_TARGET_EL;
  /* a placed nav button carries its own marker and can be re-pointed right
     here, so it gets sent to the switch that does it rather than to the Navbar
     toggle, which only changes which state you're LOOKING at */
  var placed = own && CTX_TARGET_EL.hasAttribute("data-nav-el") &&
    !!customElementById(CTX_TARGET_ID);
  return '<div class="ctx-note">' +
    (state === "out"
      ? "Signed-out visitors only – a signed-in visitor never sees this."
      : "Signed-in visitors only – a signed-out visitor never sees this.") +
    (own ? "" : " It's inside that navbar, wherever it's been dragged to.") +
    (placed
      ? " Change that with Shown to, below."
      : " Use the Navbar switch to look at the other state.") +
    '</div>';
}

/**
 * Renders the menu's root list: an optional "This element" section first,
 * only when the menu was opened on an existing tagged element, then the seven
 * things that can be added (an eighth, Reel, lives inside "Object...").
 * @note Duplicate is left out for the countdown box, the info tiles, anything
 * containing them, and any placed "datetime" element: all three render their
 * content from structured data rather than static markup a generic clone can
 * carry over, so a duplicate would come out empty - or frozen, un-ticking -
 * the moment it's reconstructed on a reload rather than just copied visually.
 * @note A datetime element's own format, pattern, target and style are edited
 * from the style popover, not here.
 */
function renderCtxMenuRoot() {
  /* a right-click somewhere else re-renders this list without the menu ever
     hiding, so the tooltip sub-view's session has to be closed out here too -
     same reason ICON_REPLACE_TARGET is cleared on the way back to this list */
  closeTooltipEditor();
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
    var extrasTile = ctxTileFor("extras");
    var isDaysFixed = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-days-fixed");
    var isDaysRole = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-days-role");
    var daysTile = ctxTileFor("days");
    /* a day/attachment tile: undeletable (see deleteElement()) and not
       duplicable either - a copy would render nothing, since what a tile
       shows comes from the day/attachment it was rendered FOR, not from its
       own markup, exactly the reasoning that already excludes the countdown
       and logistics tiles below */
    var isTileBox = CTX_TARGET_EL && isTileBoxEl(CTX_TARGET_EL);
    /* a directory tile's label is a shared template like every other tile
       text, so its name chip is restorable the same way a day tile's is (see
       insertDaysChip()) - a ta who backspaced it out gets it back without
       hand-writing markup */
    var galleryTile = CTX_TARGET_EL && CTX_TARGET_EL.closest &&
      CTX_TARGET_EL.closest("[data-gallery-tile]");
    /* the page's own two variables per image pane, insertable into whichever
       text field was right-clicked. Gated on there being a field to insert
       INTO, since a chip is a piece of a text field's markup and nothing else
       - "the progress button is just a normal text element or button with the
       variables nested inside" */
    var galleryVarField = currentPageKey() === "gallery" && CTX_TARGET_EL &&
      CTX_TARGET_EL.hasAttribute("data-edit-id") && galleryPaneBindings().length;
    /* the login field's own input rectangle, undeletable for the same reason
       the attachments tile's download button is - see deleteElement() */
    var isLoginFixed = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-login-fixed");
    /* the failure line has two strings but only ever shows one (see
       buildCustomElementNode()'s "loginError" kind). The portal's State switch
       is the way to say which, and this is the same flip offered on the
       element itself - a ta who's right-clicked the line to edit its wording
       is already looking at the thing the switch is about */
    var loginErrorEl = CTX_TARGET_EL && CTX_TARGET_EL.closest &&
      CTX_TARGET_EL.closest('[data-login-el="error"]');
    var isSpecial = isDatetime || isTile || isTileBox || isExtrasFixed || isDaysFixed || isLoginFixed || CTX_TARGET_ID.indexOf("logistics.") === 0 || CTX_TARGET_ID.indexOf("countdown.") === 0 ||
      (CTX_TARGET_EL && CTX_TARGET_EL.querySelector && CTX_TARGET_EL.querySelector("#heroCountdown, #logisticsGrid"));
    /* a progress bar is a readout, not a control: it displays two variables
       (see renderCtxMenuProgressVars(), offered in its place below) and has
       no click behavior of its own, so offering to make one navigate
       somewhere was just a wrong affordance - the caption text next to a bar
       is where a link belongs if one is wanted at all */
    var isProgress = CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-progress");
    toggleHtml =
      '<div class="ctx-title">This element</div>' +
      ((isSpecial || isExtrasRole || isDaysRole ||
        (CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-gallery-role")))
        ? "" : '<button type="button" data-dup="1">Duplicate</button>') +
      (isSpecial ? "" : '<button type="button" data-delete="1">Delete</button>') +
      (extrasTile ? '<button type="button" data-extras-add-filename="1">Create textbox with filename variable</button>' : "") +
      (loginErrorEl ? '<button type="button" data-login-msg-swap="1">' +
        (loginViewIsExpired()
          ? "Show wrong-password wording" : "Show timed-out wording") +
        '</button>' : "") +
      (galleryTile ? '<button type="button" data-gallery-add-name="1">Insert directory name</button>' : "") +
      (galleryVarField ? '<button type="button" data-gallery-vars="1">Insert gallery variable...</button>' : "") +
      (daysTile ? '<button type="button" data-days-add-number="1">Insert day number</button>' +
        '<button type="button" data-days-add-date="1">Insert unlock date</button>' +
        '<button type="button" data-days-add-locked="1">Insert locked-state text</button>' +
        '<button type="button" data-days-add-title="1">Insert title variable</button>' +
        '<button type="button" data-days-add-blurb="1">Insert description variable</button>' : "") +
      (isProgress ? '<button type="button" data-progress-vars="1">Bind variables...</button>' :
        '<button type="button" data-link-edit="1">' +
        /* an "Apply Now" always has one (content.join_url, see
           setSharedJoinUrl()), it just isn't a content.links entry */
        /* "Edit" for a template link too, not just a ta-set one: the nav's
           links and the brand already go somewhere, and offering to "add" a
           link to them read as though they didn't */
        (elementLinkTarget(CTX_TARGET_EL, CTX_TARGET_ID) || isJoinLink(CTX_TARGET_EL)
          ? "Edit link" : "Add link") +
        '</button>') +
      /* every tagged element can carry one, on every page - a tooltip is just
         words about whatever it's on, so there's nothing to gate it on (see
         the ELEMENT TOOLTIPS section). Sat next to the link row because the
         two are the same kind of thing: something an element either has or
         hasn't, edited in its own sub-view of this menu. */
      '<button type="button" data-tooltip-edit="1">' +
      (tooltipFor(CTX_TARGET_ID) ? "Edit tooltip" : "Add tooltip") +
      '</button>' +
      '<button type="button" data-lock-toggle="1">' +
      (isLocked(CTX_TARGET_ID) ? "Unlock element" : "Lock element") +
      '</button>' +
      '<button type="button" data-fixed-toggle="1">' +
      (isFixed(CTX_TARGET_ID) ? "Remove from navbar" : "Promote to navbar") +
      '</button>' +
      (groupOf(CTX_TARGET_ID) ? '<button type="button" data-ungroup="1">Ungroup</button>' : "") +
      /* the way OUT of a box that doesn't need a drag: a box tight around
         what it holds leaves nowhere obvious to drag to, and the element
         lands back at a free position exactly where it sits. See
         unseatFromBox(). */
      (CTX_TARGET_EL && boxOf(CTX_TARGET_EL)
        ? '<button type="button" data-box-unseat="1">Take out of box</button>' : "");
    /* how this clip plays, in its own labelled section rather than mixed into
       the generic list - none of it applies to any other kind of element. A
       placed video has always been a muted, looping, autoplaying wallpaper
       clip; these three hand back the ordinary html5 behaviours it was
       hiding, one at a time. Every label names the state it's in FIRST and
       what clicking does second, the same shape the Container section uses. */    if (CTX_TARGET_EL && CTX_TARGET_EL.tagName === "VIDEO") {
      toggleHtml += '<div class="ctx-title">Video</div>' +
        '<button type="button" data-video-play="video_no_autoplay">Autoplay: ' +
        (videoPlaybackOn(CTX_TARGET_EL, "video_no_autoplay")
          ? "off &rarr; play on load" : "on &rarr; wait for the visitor") +
        '</button>' +
        '<button type="button" data-video-play="video_controls">Player controls: ' +
        (videoPlaybackOn(CTX_TARGET_EL, "video_controls")
          ? "shown &rarr; hide" : "hidden &rarr; show") +
        '</button>' +
        '<button type="button" data-video-play="video_pausable">Click to play/pause: ' +
        (videoPlaybackOn(CTX_TARGET_EL, "video_pausable")
          ? "on &rarr; off" : "off &rarr; on") +
        '</button>';
    }
    /* a PLACED nav button's "Shown to" switch. Only offered for a placed one:
       the navbars' own buttons are template markup inside a <nav> that IS one
       state, so there's nothing to choose there.

       Same "current -> next" wording as every other switch here, and
       deliberately right under the note explaining what the current state
       costs - the moment a ta reads "a signed-in visitor never sees this" is
       the moment they want to change it. */
    if (CTX_TARGET_EL && CTX_TARGET_EL.hasAttribute("data-nav-el") &&
        customElementById(CTX_TARGET_ID)) {
      var navShown = navStateForDescriptor(customElementById(CTX_TARGET_ID));
      toggleHtml += '<div class="ctx-title">Session</div>' +
        '<button type="button" data-nav-shown="1">Shown to: ' +
        (navShown === "out" ? "signed-out visitors only &rarr; everyone"
          : navShown === "both" ? "everyone &rarr; signed-in visitors only"
          : "signed-in visitors only &rarr; signed-out visitors only") +
        '</button>';
    }
  }
  if (SELECTED_IDS.length >= 2) {
    toggleHtml += '<div class="ctx-title">Selection</div>' +
      '<button type="button" data-group="1">Group ' + SELECTED_IDS.length + ' elements</button>' +
      /* the other way to get things into a box, and the one that matters for
         anything already laid out: rather than adding an empty box and dragging
         each element in, draw the box around what's already there. See
         boxSelection(). */
      '<button type="button" data-box-wrap="1">Put ' + SELECTED_IDS.length + ' elements in a box</button>';
  }
  /* a box's own "does a drop land in here" switch. Offered on the box and on
     anything seated in one, for the same reachability reason the Container
     section below is: a box is usually covered by what it holds. */
  var dropBox = CTX_TARGET_EL && (isBoxAreaEl(CTX_TARGET_EL) ? CTX_TARGET_EL : boxOf(CTX_TARGET_EL));
  if (dropBox) {
    toggleHtml += '<div class="ctx-title">Box</div>' +
      '<button type="button" data-box-drops="1">Alt-drop into this box: ' +
      (boxAcceptsDrops(elId(dropBox)) ? "on &rarr; off" : "off &rarr; on") + '</button>';
  }
  /* the tile containers' own per-axis "keep this size" / "grow to fit"
     switch (see areaFlowFor()). Offered on the container itself AND on
     anything inside one, since the container is usually completely covered by
     its tiles - the same reachability problem the ring's parent handle solves
     for selection, see parentSelectableOf(). */
  var flowArea = ctxFlowArea();
  if (flowArea) {
    var flowId = elId(flowArea);
    var flowState = areaFlowFor(flowId);
    /* the stacking half of the same section (see areaFlowFor()): which axis
       the tiles run along, which way along it, and which side a full line
       overflows to. Every label names the state it's in FIRST and what
       clicking does second, same "current &rarr; next" shape as the two axis
       locks above, and the overflow one words itself against whichever axis
       is actually in force - "below/above" reads as nonsense on a column. */
    var isCol = flowState.dir.indexOf("column") === 0;
    var isRev = flowState.dir.indexOf("-reverse") !== -1;
    toggleHtml += '<div class="ctx-title">Container</div>' +
      '<button type="button" data-flow-axis="x">Width: ' +
      (flowState.x === "lock" ? "locked &rarr; grow to fit tiles" : "grows to fit &rarr; lock size") +
      '</button>' +
      '<button type="button" data-flow-axis="y">Height: ' +
      (flowState.y === "lock" ? "locked &rarr; grow to fit tiles" : "grows to fit &rarr; lock size") +
      '</button>' +
      '<button type="button" data-flow-dir="axis">Tiles: ' +
      (isCol ? "stacked vertically &rarr; side by side" : "side by side &rarr; stacked vertically") +
      '</button>' +
      '<button type="button" data-flow-dir="reverse">Order: ' +
      (isRev
        ? (isCol ? "bottom to top &rarr; top to bottom" : "right to left &rarr; left to right")
        : (isCol ? "top to bottom &rarr; bottom to top" : "left to right &rarr; right to left")) +
      '</button>' +
      '<button type="button" data-flow-wrap="1">Overflow: ' +
      (flowState.wrap === "reverse"
        ? (isCol ? "wraps left &rarr; wrap right" : "wraps above &rarr; wrap below")
        : (isCol ? "wraps right &rarr; wrap left" : "wraps below &rarr; wrap above")) +
      '</button>';
  }
  /* the one element kind that only exists inside an attachments tile: it
     draws whatever icon THAT tile's attachment type calls for (see
     buildCustomElementNode()'s "extrasIcon" kind), so offering it anywhere
     else would place something with nothing to resolve against. Labelled as
     tile-only right in the button, since it behaves unlike every other entry
     in this list. */
  var extrasIconTile = ctxTileFor("extras");
  CTX_MENU.innerHTML =
    /* which element this menu is actually about. Everything else in the editor
       identifies an element by pointing at it - the ring, the dashed outlines,
       the handles - which is fine until two of them overlap, or one is
       transparent, or a container's ring sits exactly where its content's ring
       does: then there's no way to say WHICH thing is selected, to yourself or
       to anyone else. The id is the same string content.* is keyed by, so it's
       also the one name that means anything outside the page. */
    (CTX_TARGET_ID
      ? '<div class="ctx-title ctx-what">' + escapeHtml(CTX_TARGET_ID) + '</div>'
      : "") +
    ctxNavStateNoteHtml() +
    toggleHtml +
    '<div class="ctx-title">Add element</div>' +
    (extrasIconTile ? '<button type="button" data-add="extrasIcon">Attachment icon (this tile only)</button>' : "") +
    '<button type="button" data-add="text">Textbox</button>' +
    '<button type="button" data-add="box">Box</button>' +
    '<button type="button" data-add="image">Image</button>' +
    '<button type="button" data-add="video">Video</button>' +
    '<button type="button" data-add="icon">Icon</button>' +
    '<button type="button" data-add="button">Button</button>' +
    '<button type="button" data-add="datetime">Date/time</button>' +
    '<button type="button" data-add="progress">Progress bar</button>' +
    '<button type="button" data-add="object">Object...</button>' +
    /* the login page's own three kinds, in their own labelled section rather
       than mixed into the generic list above: a credential box or a submit
       button has nothing to resolve against on any other page, exactly the
       reasoning that already keeps "Attachment icon" tile-scoped. The
       heading IS the indicator that these are page-exclusive; they also draw
       in their own outline colour once placed, see css/style.css's
       [data-login-el] rule. */
    (currentPageKey() === "login"
      ? '<div class="ctx-title">Login page only</div>' +
        '<button type="button" data-add="loginUsername">Username box</button>' +
        '<button type="button" data-add="loginPassword">Password box</button>' +
        '<button type="button" data-add="loginButton">Log in button</button>' +
        /* one kind, two names: the line it places carries both wordings and
           shows the one the portal's State switch is on, so naming it "Error
           message" while the editor is showing the timed-out page would be
           offering something other than what lands. The name is also the
           clearest signal the switch did anything to this menu at all. */
        '<button type="button" data-add="loginError">' +
        (loginViewIsExpired() ? "Timed-out message" : "Error message") +
        '</button>'
      : "") +
    /* the gallery's own kind, in its own labelled section for the same reason
       the login page's are: a photo stage has nothing to resolve against on
       any other page. Several can be placed, each bound to its own directory -
       which is what makes this the entry point for "we can add multiple and
       link them to a certain year or directory". */
    (currentPageKey() === "gallery"
      ? '<div class="ctx-title">Gallery page only</div>' +
        '<button type="button" data-add="galleryPane">Image pane...</button>'
      : "") +
    /* the landing page's own three, split the same way and gated one step
       further: which of them can be placed depends on which navbar is on show,
       since a Log out button has nothing to do on the page a signed-out
       visitor sees and an Access portal button has nothing to do on the one a
       signed-in visitor sees. The heading names the state so it's clear which
       half of the page is being added to. */
    (currentPageKey() === "index"
      ? '<div class="ctx-title">Landing page navbar (' +
          (navStateIsIn() ? "signed in" : "signed out") + ')</div>' +
        (navStateIsIn()
          ? '<button type="button" data-add="navDashboard">Dashboard button</button>' +
            '<button type="button" data-add="navLogout">Log out button</button>'
          : '<button type="button" data-add="navPortal">Access portal button</button>')
      : "") +
    /* page-scoped rather than element-scoped, so it sits in its own section
       below "Add element" instead of under "This element" - see
       renderCtxMenuLinkList() for why the whole link inventory belongs in
       the editor at all */
    '<div class="ctx-title">This page</div>' +
    '<button type="button" data-link-list="1">Links on this page</button>' +
    /* the page's own background, straight to the colour rows. Clicking an
       empty spot selects the page too (see selectPage()), and the ring's
       parent handle steps up to it from any container - but on a page whose
       sections run full-bleed there may be no empty spot to click, so this is
       the one entry point that's always there. */
    '<button type="button" data-page-bg="1">Page background...</button>' +
    /* the editor's own way to look at the other theme. The site's real
       light/dark button can't do this job inside the editor - there every
       click on it is a ta selecting, dragging or retyping it, and flipping the
       page underneath them made the button itself look broken (see the
       edit-mode guard in js/theme.js). This goes through the same setTheme(),
       so ta-picked dark colours, the sun/moon icons and the style popover's
       light/dark swatch swap all follow exactly as they do for a visitor. */
    '<button type="button" data-theme-preview="1">Preview in ' +
    (isDarkThemeActive() ? "light" : "dark") + ' mode</button>';
  CTX_MENU.querySelectorAll("button[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () { handleCtxAdd(btn.getAttribute("data-add")); });
  });
  var pageBgBtn = CTX_MENU.querySelector("[data-page-bg]");
  if (pageBgBtn) {
    pageBgBtn.addEventListener("click", function () {
      hideCtxMenu();
      selectPage();
      /* toggleStyleMenu() is a toggle, so an already-open popover (left over
         from whatever was selected before) has to be closed first or this
         would just close it again and open nothing */
      hideStyleMenu();
      if (RING_EL && STYLE_BTN) toggleStyleMenu(STYLE_BTN);
    });
  }
  var themePreviewBtn = CTX_MENU.querySelector("[data-theme-preview]");
  if (themePreviewBtn) {
    themePreviewBtn.addEventListener("click", function () {
      var next = isDarkThemeActive() ? "light" : "dark";
      if (window.setSiteTheme) window.setSiteTheme(next);
      /* the portal's Theme switch is the same control by another route, and
         nothing else tells it a flip happened in here - same reason
         setSnapping() calls back out to syncSnapSwitch() */
      try {
        if (window.parent !== window && window.parent.noteEditorTheme) window.parent.noteEditorTheme(next);
      } catch (e) {}
      hideCtxMenu();
    });
  }
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
  var loginMsgSwapBtn = CTX_MENU.querySelector("[data-login-msg-swap]");
  if (loginMsgSwapBtn) {
    loginMsgSwapBtn.addEventListener("click", function () {
      /* a pure view toggle - which state of the login page a ta is currently
         looking at. Never saved: what a real visitor sees is decided by what
         actually happened to them, see js/login.js.

         Goes through the page-wide toggle rather than flipping this one
         element's class, so it and the portal's State switch can't end up
         disagreeing about which state is on show - which they would the
         moment either was used, since the switch also renames what the "Add
         element" menu would place. */
      toggleLoginView();
      hideCtxMenu();
    });
  }
  var extrasFilenameBtn = CTX_MENU.querySelector("[data-extras-add-filename]");
  if (extrasFilenameBtn) {
    extrasFilenameBtn.addEventListener("click", function () {
      var tile = ctxTileFor("extras");
      if (tile) insertExtrasFilenameChip(tile);
      hideCtxMenu();
    });
  }
  var galleryNameBtn = CTX_MENU.querySelector("[data-gallery-add-name]");
  if (galleryNameBtn) {
    galleryNameBtn.addEventListener("click", function () {
      var tile = CTX_TARGET_EL && CTX_TARGET_EL.closest("[data-gallery-tile]");
      var field = tile && tile.querySelector('[data-gallery-role="label"]');
      if (field) {
        var before = field.innerHTML;
        field.innerHTML = before + (before ? " " : "") + buildGalleryDirChipHtml();
        commitTextFieldChange(field, before, field.innerHTML);
      }
      hideCtxMenu();
    });
  }
  var galleryVarsBtn = CTX_MENU.querySelector("[data-gallery-vars]");
  if (galleryVarsBtn) {
    galleryVarsBtn.addEventListener("click", function () { renderCtxMenuGalleryVars(); });
  }
  [["data-days-add-number", "day-number"], ["data-days-add-date", "day-date"],
   ["data-days-add-locked", "day-locked"], ["data-days-add-title", "day-title"],
   ["data-days-add-blurb", "day-blurb"]].forEach(function (pair) {
    var btn = CTX_MENU.querySelector("[" + pair[0] + "]");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var tile = ctxTileFor("days");
      if (tile) insertDaysChip(tile, pair[1]);
      hideCtxMenu();
    });
  });
  CTX_MENU.querySelectorAll("[data-flow-axis]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var area = ctxFlowArea();
      if (area) toggleAreaFlowAxis(elId(area), btn.getAttribute("data-flow-axis"));
      hideCtxMenu();
    });
  });
  CTX_MENU.querySelectorAll("[data-flow-dir]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var area = ctxFlowArea();
      if (!area) { hideCtxMenu(); return; }
      if (btn.getAttribute("data-flow-dir") === "reverse") toggleAreaFlowReverse(elId(area));
      else toggleAreaFlowAxisDir(elId(area));
      hideCtxMenu();
    });
  });
  var flowWrapBtn = CTX_MENU.querySelector("[data-flow-wrap]");
  if (flowWrapBtn) {
    flowWrapBtn.addEventListener("click", function () {
      var area = ctxFlowArea();
      if (area) toggleAreaFlowWrap(elId(area));
      hideCtxMenu();
    });
  }
  var navShownBtn = CTX_MENU.querySelector("[data-nav-shown]");
  if (navShownBtn) {
    navShownBtn.addEventListener("click", function () {
      cycleCustomElementNavState(CTX_TARGET_ID);
      hideCtxMenu();
    });
  }
  CTX_MENU.querySelectorAll("[data-video-play]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      toggleVideoPlayback(CTX_TARGET_ID, btn.getAttribute("data-video-play"));
      hideCtxMenu();
    });
  });
  var linkEditBtn = CTX_MENU.querySelector("[data-link-edit]");
  if (linkEditBtn) {
    linkEditBtn.addEventListener("click", function () { renderCtxMenuLinkEditor(); });
  }
  var tooltipBtn = CTX_MENU.querySelector("[data-tooltip-edit]");
  if (tooltipBtn) {
    tooltipBtn.addEventListener("click", function () { renderCtxMenuTooltip(); });
  }
  var progressVarsBtn = CTX_MENU.querySelector("[data-progress-vars]");
  if (progressVarsBtn) {
    progressVarsBtn.addEventListener("click", function () { renderCtxMenuProgressVars(); });
  }
  var linkListBtn = CTX_MENU.querySelector("[data-link-list]");
  if (linkListBtn) {
    linkListBtn.addEventListener("click", function () { renderCtxMenuLinkList(); });
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
  var boxWrapBtn = CTX_MENU.querySelector("[data-box-wrap]");
  if (boxWrapBtn) {
    boxWrapBtn.addEventListener("click", function () {
      boxSelection(SELECTED_IDS);
      clearSelection();
      hideCtxMenu();
    });
  }
  var unseatBtn = CTX_MENU.querySelector("[data-box-unseat]");
  if (unseatBtn) {
    unseatBtn.addEventListener("click", function () {
      var el = CTX_TARGET_EL;
      if (!el) return hideCtxMenu();
      var before = captureSeat(el);
      if (unseatFromBox(el)) {
        /* same as dragging it out and dropping it, so it lands in front of the
           page the same way - see seedUnseatedLayerRank() */
        seedUnseatedLayerRank(el);
        EDIT_UNDO.push({ type: "seat", id: elId(el), before: before, after: captureSeat(el) });
        EDIT_REDO.length = 0;
        positionRing();
        if (window.responsiveRepaintSoon) window.responsiveRepaintSoon();
      }
      hideCtxMenu();
    });
  }
  var dropsBtn = CTX_MENU.querySelector("[data-box-drops]");
  if (dropsBtn) {
    dropsBtn.addEventListener("click", function () {
      var el = CTX_TARGET_EL;
      var box = el && (isBoxAreaEl(el) ? el : boxOf(el));
      if (box) setBoxAcceptsDrops(elId(box), !boxAcceptsDrops(elId(box)));
      hideCtxMenu();
    });
  }
}

/**
 * Swaps the menu into its link-editor sub-view, for whatever element
 * CTX_TARGET_ID points at.
 * @note Works the same for every kind: a real `<a>` gets a real href,
 * anything else gets a click listener that navigates outside the editor. A
 * "Remove link" button only shows once one is set.
 * @note Opens on what the element already does, always: the target it has -
 * counting the template's own href, not just a ta-set one - spelled out at
 * the top, in the box, and ticked in the action list if it's one of those.
 * This view used to answer "what is this link?" with an empty box whatever
 * the element pointed at, which read as "there isn't one".
 */
function renderCtxMenuLinkEditor() {
  var id = CTX_TARGET_ID;
  /* every "Apply Now" shares one url rather than carrying its own, so this
     box edits that one instead for any of them - see setSharedJoinUrl() */
  var joinLink = isJoinLink(CTX_TARGET_EL);
  if (joinLink) return renderCtxMenuJoinLinkEditor();
  var current = LINKS[id] || "";
  /* what the element does with no ta link on it at all: the template's own
     href. Shown and editable like any other target - overriding it is exactly
     what typing in this box means - but tracked separately so the line at the
     top can say whose link it is. */
  var builtin = current ? "" : elementLinkTarget(CTX_TARGET_EL, id);
  var now = current || builtin;
  var fixed = hasFixedLink(id);
  /* the gallery's own actions, offered above the url box rather than instead
     of it: an element on that page can still be pointed at an ordinary url,
     it can just also be made to step an image pane. Each is one click, since
     "which pane, forwards or backwards" is the entire decision - this is the
     "CUSTOM LINK selection" the ta asked for, and it's what makes any button
     they like into the back or forward button. */
  var actions = currentPageKey() === "gallery" ? galleryActionInventory() : [];
  CTX_MENU.innerHTML =
    '<div class="ctx-file-msg">' +
    (now
      ? escapeHtml((galleryActionOf(now) ? "Does: " : "Goes to: ") + linkTargetLabel(now)) +
        (builtin ? " (the page's own link)" : "")
      : "Doesn't link anywhere yet.") +
    '</div>' +
    (actions.length
      ? '<div class="ctx-title">This page</div>' +
        actions.map(function (a, i) {
          return '<button type="button" data-gallery-action="' + i + '"' +
            (now === a.url ? ' class="ctx-on"' : "") + '>' + escapeHtml(a.label) + '</button>';
        }).join("")
      : "") +
    /* no url box on the two arrows the image pane ships with: a url typed
       there would quietly replace the action, which is the removal
       hasFixedLink() exists to prevent, just by another route. Everything
       they can be - one pane's arrow or another's - is in the list above. */
    (fixed
      ? '<div class="ctx-file-msg">This arrow came with the image pane. Point it at a different pane if you like; it always steps one.</div>'
      : '<div class="ctx-title">Element link</div>' +
        '<input type="url" class="ctx-link-input" placeholder="https://...">' +
        '<div class="ctx-link-msg"></div>' +
        '<button type="button" class="ctx-link-save">Save</button>' +
        (current ? '<button type="button" class="ctx-link-remove">Remove link</button>' : ""));
  CTX_MENU.querySelectorAll("[data-gallery-action]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setElementLink(id, actions[+btn.getAttribute("data-gallery-action")].url);
      hideCtxMenu();
    });
  });
  var input = CTX_MENU.querySelector(".ctx-link-input");
  if (!input) return;
  /* an action link has no url to show, and putting its raw token in the box
     would invite a ta to edit it into something meaningless - the line at the
     top says what it does instead */
  input.value = galleryActionOf(now) ? "" : now;
  input.focus();
  var msg = CTX_MENU.querySelector(".ctx-link-msg");
  function save() {
    var res = resolveLinkInput(input.value);
    /* the one case worth stopping on rather than saving something wrong: they
       named an element that doesn't go anywhere, so there's nothing to copy */
    if (res.error) { msg.textContent = res.error; return; }
    setElementLink(id, res.url);
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
 * The link editor's "Apply Now" variant: same url box, pointed at the one
 * shared content.join_url every one of those buttons reads (see
 * setSharedJoinUrl()) rather than at this element's own link. No "Remove
 * link" - a button with nowhere to go isn't a state this offers; clearing
 * the box puts the built-in default back.
 */
function renderCtxMenuJoinLinkEditor() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">"Apply Now" link</div>' +
    '<input type="url" class="ctx-link-input" placeholder="https://...">' +
    '<button type="button" class="ctx-link-save">Save</button>' +
    '<div class="ctx-file-msg">Every Apply Now button on this page shares it.</div>';
  var input = CTX_MENU.querySelector(".ctx-link-input");
  input.value = JOIN_URL;
  input.focus();
  function save() {
    setSharedJoinUrl(input.value);
    hideCtxMenu();
  }
  CTX_MENU.querySelector(".ctx-link-save").addEventListener("click", save);
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); save(); }
  });
}

/* tagged elements that navigate on their own with no content.links entry
   behind them, because a real click handler elsewhere does the work - the
   dashboard's logout(), the landing page's own sign-out wiring. The links view
   LISTS these, since "what does Log out actually do?" is exactly the question
   it exists to answer, but never lets one be edited: a url layered on top
   would just fight the handler already wired to it. Keyed by id.

   A nav button a ta PLACES is covered without being listed: its behaviour is
   keyed off data-nav-el rather than its id, so navButtonAction() answers for
   any number of them. */
var BUILTIN_LINK_ACTIONS = {
  "dash.nav.logout": "Logs out, back to login.html",
  "navin.nav.logout": "Logs out, stays on this page"
};

/**
 * What a landing-page nav button does, for the links view (see
 * pageLinkInventory()). Keyed off the data-nav-el marker rather than the id,
 * so a placed copy of one reads the same as the one that ships with the page.
 * @param el a tracked element
 * @return the description, or "" if el isn't a nav button
 */
function navButtonAction(el) {
  var kind = el.getAttribute && el.getAttribute("data-nav-el");
  if (kind === "portal") return "Goes to login.html";
  if (kind === "dashboard") return "Goes to the dashboard for whoever is signed in";
  if (kind === "logout") return "Logs out, stays on this page";
  return "";
}

/* the gallery's own two arrows: the seed ships the buttons AND the links that
   make them step the pane, so the action is part of what those elements are
   rather than something a ta added. Re-pointable - a ta running two panes can
   aim an arrow at either - but never removable: clearing one leaves an arrow
   that looks exactly as it did and does nothing, on a page whose whole point
   is flipping through photos, with nothing on screen to say why. Listed under
   "Built in" for that reason. Keyed by id. */
var FIXED_LINK_IDS = { "seed.gallery.prev": 1, "seed.gallery.next": 1 };

/**
 * Whether an element's link is part of what the element is, rather than
 * something a ta put on it and can take back off.
 * @param id a data-edit-id/data-resize-id
 * @return true if the link can be re-pointed but not removed
 */
function hasFixedLink(id) {
  return !!FIXED_LINK_IDS[id];
}

/**
 * Where one element actually goes when clicked, whether or not a ta decided
 * it: their own content.links entry first, then the url every "Apply Now"
 * shares, then the template's own href.
 * @param el the element, or null if it isn't on this page
 * @param id its data-edit-id/data-resize-id
 * @return the target, "" if it has none
 * @note The link editor used to read content.links and nothing else, so every
 * element that ships with a link opened an empty box offering to "add" a link
 * it already had, with no way to see the target it really has.
 */
function elementLinkTarget(el, id) {
  if (LINKS[id]) return LINKS[id];
  if (isJoinLink(el)) return JOIN_URL;
  if (!el) return "";
  /* data-builtin-href is where a template link's real target survives the
     editor, see stashBuiltinHref()/neuterLink() */
  return el.getAttribute("href") || el.getAttribute("data-builtin-href") || "";
}

/**
 * How one link target reads to a ta: an action by what it does, anything else
 * as the url it is.
 * @param url a links map value or href
 * @return the label
 */
function linkTargetLabel(url) {
  return galleryActionLabel(url) || url;
}

/**
 * Works out what a ta meant by whatever they typed into a link box.
 * @param text the raw box contents
 * @return {url, error} - error non-empty means don't save, say this instead
 * @note Anything that doesn't name an element on this page is taken at face
 * value. But the links view lists every row by its id, that id is the obvious
 * thing to copy when the question is "how do I make THIS button do what THAT
 * one does", and typing one used to be saved as a url and send the visitor to
 * a 404. Naming an element now means what it looks like it means.
 */
function resolveLinkInput(text) {
  var v = (text || "").trim();
  if (!v) return { url: "", error: "" };
  /* nothing that couldn't BE an id is looked up: ids are dotted words (see
     idSel()), and idSel() drops whatever it's given straight into an
     attribute selector - a pasted url with a quote or a bracket in it would
     throw out of querySelector() and take the save with it */
  if (!/^[A-Za-z0-9._:-]+$/.test(v)) return { url: v, error: "" };
  var named = styleMenuElById(v);
  /* hasOwnProperty, not a truth test: LINKS is a plain object, so "toString"
     or "constructor" would otherwise "have a link" and hand back a function
     to save as a url */
  var known = Object.prototype.hasOwnProperty.call(LINKS, v);
  if (!named && !known) return { url: v, error: "" };
  var target = elementLinkTarget(named, v);
  if (typeof target !== "string") target = "";
  if (!target) {
    return { url: "", error: '"' + v + '" is an element on this page, but it doesn\'t link anywhere itself yet.' };
  }
  return { url: target, error: "" };
}

/**
 * Collects every link that exists on this page right now, split into the
 * three groups the links view renders as its sections.
 * @return {set, builtin, inline, elsewhere}, each an array of
 *   {id, el, url, editable, removable, note}
 * @note Why the built-in group matters: this inventory used to live in the
 * content manager, which could only know about content.links - so a ta
 * looking up where the nav's link scrolls to, or what "Log out" does, found
 * an empty list, because nobody had "added" those, the templates ship with
 * them. Reading them off the live DOM is the only place all of them are
 * visible at once, next to the elements they belong to.
 * @note One row per id even where an id renders more than once, pointing at
 * the first instance. Inline links are the exception: they're pieces of text,
 * so several in one field are several rows, listed read-only since the place
 * to change one is the text toolbar with the words selected.
 */
function pageLinkInventory() {
  var seen = {};
  var set = [];
  var builtin = [];
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (!id || seen[id]) return;
    seen[id] = true;
    if (LINKS[id]) {
      /* a gallery page action reads as what it does, not as its raw token, and
         has no url to type over - but it's still a ta's own link, so it stays
         removable exactly like any other entry they set */
      var actionLabel = galleryActionLabel(LINKS[id]);
      if (actionLabel) {
        /* the pane's own two arrows are seeded with theirs and can't be left
           pointing at nothing (see hasFixedLink()), so they're listed with
           the other things this view explains rather than hands over */
        var arow = { id: id, el: el, url: "", editable: false,
          removable: !hasFixedLink(id), note: actionLabel };
        if (hasFixedLink(id)) builtin.push(arow); else set.push(arow);
        return;
      }
      set.push({ id: id, el: el, url: LINKS[id], editable: true, removable: true, note: "" });
      return;
    }
    var action = BUILTIN_LINK_ACTIONS[id] || navButtonAction(el);
    if (action) {
      builtin.push({ id: id, el: el, url: "", editable: false, removable: false, note: action });
      return;
    }
    /* data-builtin-href is where a template link's real target survives the
       editor, since every preview/editor load strips the live href off the
       nav's own links so a ta can't navigate the iframe away - see
       stashBuiltinHref()/neuterLink() */
    var href = el.getAttribute("href") || el.getAttribute("data-builtin-href") || "";
    if (!href) return;
    if (isJoinLink(el)) {
      /* every "Apply Now" shares one href (content.join_url), so editing one
         row here edits the url all of them read - marked so buildLinkListRow()
         saves it through setSharedJoinUrl() rather than dropping a per-element
         override on this one, which would silently drift the set apart on the
         next load */
      builtin.push({ id: id, el: el, url: href, editable: true, removable: false,
        join: true, note: "" });
      return;
    }
    builtin.push({ id: id, el: el, url: href, editable: true, removable: false, note: "" });
  });

  /* content.links is one flat, site-wide map (no page scoping), so a link set
     on the dashboard is still in LINKS while the landing page is open. Listed
     last, unreachable by "show me" but still editable/removable, so an entry
     left behind on a since-deleted element can't become invisible junk that
     only the other page can clear. */
  var elsewhere = Object.keys(LINKS).filter(function (id) { return !seen[id]; }).map(function (id) {
    return { id: id, el: null, url: LINKS[id], editable: true, removable: true, note: "" };
  });

  /* every linked run of words inside a text field. Read off the live dom like
     everything else here, which is all it takes: an inline link has no
     content.links entry to look up, it IS the field's markup. */
  var inline = [];
  document.querySelectorAll(INLINE_LINK_SEL).forEach(function (link) {
    var field = link.closest("[data-edit-id]");
    if (!field) return;
    /* the row points at the FIELD, not at the link inside it: only tracked
       elements can be selected (revealElement() puts the ring on whatever it's
       handed), and the field is what a ta has to be looking at anyway before
       they can select the words and press the toolbar's link button */
    inline.push({
      id: elId(field), el: field, url: inlineLinkHref(link), editable: false, removable: false,
      note: '"' + (link.textContent || "").replace(/\s+/g, " ").trim() +
        '" — select these words and use the toolbar\'s link button'
    });
  });

  function byId(a, b) { return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0); }
  return {
    set: set.sort(byId), builtin: builtin.sort(byId),
    inline: inline.sort(byId), elsewhere: elsewhere.sort(byId)
  };
}

/**
 * A short, recognizable name for one links-view row: whatever text the
 * element actually shows, which is how a ta thinks of it, falling back to the
 * raw id for anything with no text of its own.
 * @param el the element, or null for an entry with none on this page
 * @param id its data-edit-id/data-resize-id
 * @return the label text
 */
function linkRowLabel(el, id) {
  var text = el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
  if (!text) return id;
  return text.length > 34 ? text.slice(0, 33) + "…" : text;
}

/**
 * Scrolls one element into view and selects it - the "click through to the
 * element itself" half of the links view.
 * @param el the element to reveal
 * @note A row can name something a ta has no way to spot by eye - a link on a
 * small icon inside a tile, an element far off screen - so the list has to be
 * able to put the selection straight onto it.
 */
function revealElement(el) {
  if (!el) return;
  hideCtxMenu();
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  RING_EL = el;
  positionRing();
}

/**
 * Builds one links-view row: the element's name on the left (click to select
 * it), and on the right either an editable url plus remove button, or a plain
 * read-only note for anything this view deliberately doesn't own.
 * @param entry one pageLinkInventory() entry
 * @return the row element
 * @note Built as real DOM nodes rather than an innerHTML string, since a
 * row's label is a ta's own typed text and nothing else here escapes that.
 */
function buildLinkListRow(entry) {
  var row = document.createElement("div");
  row.className = "ctx-lnk-row";

  var go = document.createElement("button");
  go.type = "button";
  go.className = "ctx-lnk-go";
  go.disabled = !entry.el;
  go.title = entry.el ? "Show me this element" : "Set on another page";
  var name = document.createElement("span");
  name.className = "ctx-lnk-name";
  name.textContent = linkRowLabel(entry.el, entry.id);
  var idLine = document.createElement("span");
  idLine.className = "ctx-lnk-id";
  idLine.textContent = entry.id;
  go.appendChild(name);
  go.appendChild(idLine);
  go.addEventListener("click", function () {
    /* an id is the one name for an element that means anything outside the
       page, and this list is where a ta reads it - so it's selectable text
       (see the .ctx-lnk-name rule in css/style.css), and a drag that ends
       inside this button is someone copying it, not asking to be shown the
       element. Acting on that click would close the menu and drop the
       selection at the exact moment they reached for ctrl-c. */
    var sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.anchorNode && go.contains(sel.anchorNode)) return;
    revealElement(entry.el);
  });
  row.appendChild(go);

  if (!entry.editable) {
    var note = document.createElement("div");
    note.className = "ctx-lnk-note";
    note.textContent = entry.note + (entry.url ? " — " + entry.url : "");
    row.appendChild(note);
    /* a built-in link has nothing to remove (it's markup, see
       BUILTIN_LINK_ACTIONS), but a gallery action a ta pointed an element at
       is theirs to take back off it again */
    if (entry.removable) {
      var noteDel = document.createElement("button");
      noteDel.type = "button";
      noteDel.className = "ctx-lnk-del";
      noteDel.title = "Remove this link";
      noteDel.textContent = "×";
      noteDel.addEventListener("click", function () {
        setElementLink(entry.id, "");
        renderCtxMenuLinkList();
      });
      row.appendChild(noteDel);
    }
    return row;
  }

  var edit = document.createElement("div");
  edit.className = "ctx-lnk-edit";
  var input = document.createElement("input");
  input.type = "url";
  input.className = "ctx-lnk-url";
  input.value = entry.url;
  input.placeholder = "https://...";
  input.setAttribute("aria-label", "Link target for " + entry.id);
  /* change (not input) so a half-typed url is never committed as an undo
     step, same as the style popover's own text fields */
  input.addEventListener("change", function () {
    var res = resolveLinkInput(input.value);
    /* naming another element here means the same thing it means in the link
       editor - point this row wherever that one points - and the same one
       case is worth refusing rather than saving something broken */
    if (res.error) { renderCtxMenuLinkList(res.error); return; }
    var next = res.url;
    /* an "Apply Now" row edits the one url all of them share and never
       changes section, see the join branch in pageLinkInventory() */
    if (entry.join) {
      setSharedJoinUrl(next);
      renderCtxMenuLinkList();
      return;
    }
    /* re-render only when this row is about to change SECTION - a template
       link picking up a ta's own url for the first time moves into "Set
       here" and gains a remove button, and clearing one moves back out.
       Editing an already-set url in place doesn't, and rebuilding the list
       under the ta's cursor there would just eat the next click (change
       fires on blur, before it lands). */
    var regroups = !entry.removable || !next;
    setElementLink(entry.id, next);
    if (regroups) renderCtxMenuLinkList();
    else entry.url = next;
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
  });
  edit.appendChild(input);
  if (entry.removable) {
    var del = document.createElement("button");
    del.type = "button";
    del.className = "ctx-lnk-del";
    del.title = "Remove this link";
    del.textContent = "×";
    del.addEventListener("click", function () {
      setElementLink(entry.id, "");
      renderCtxMenuLinkList();
    });
    edit.appendChild(del);
  }
  row.appendChild(edit);
  return row;
}

/**
 * Swaps the menu into its links sub-view: everything on the page that
 * navigates, in one list, each row clickable through to the element itself.
 * @param msg optional line to show above the list, for a row that refused to
 *   save what was typed into it
 * @note Re-renders in place after every edit, so a template link that just
 * got a ta's own url moves up into "Set here" immediately rather than only on
 * the next open.
 * @note Clearing a ta-set url off a template link drops the override, not the
 * template's href: the element loses its live target for the rest of the
 * session and gets it back on the next load, since the href is markup.
 */
function renderCtxMenuLinkList(msg) {
  var inv = pageLinkInventory();
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Links on this page</div>' +
    /* a row has no room to explain itself, so one refusing to save what was
       typed into it says so up here instead */
    (typeof msg === "string" && msg ? '<div class="ctx-file-msg">' + escapeHtml(msg) + '</div>' : "") +
    '<div class="ctx-lnk-list"></div>' +
    '<button type="button" class="ctx-lnk-back">Back</button>';
  var list = CTX_MENU.querySelector(".ctx-lnk-list");
  CTX_MENU.querySelector(".ctx-lnk-back").addEventListener("click", renderCtxMenuRoot);

  function addSection(title, rows) {
    if (!rows.length) return;
    var head = document.createElement("div");
    head.className = "ctx-title ctx-lnk-head";
    head.textContent = title;
    list.appendChild(head);
    rows.forEach(function (entry) { list.appendChild(buildLinkListRow(entry)); });
  }
  addSection("Set here", inv.set);
  addSection("Built in", inv.builtin);
  addSection("Inside text", inv.inline);
  addSection("Set on another page", inv.elsewhere);

  /* the gallery's own actions, listed whether or not anything currently points
     at one: this is the "what can I make a button DO on this page?" half of
     the question, and placing another image pane is what makes the list grow.
     Read-only here - an action is attached to an element from that element's
     own link editor, which is where the ta already is when they want one. */
  var actions = galleryActionInventory();
  if (actions.length) {
    var head = document.createElement("div");
    head.className = "ctx-title ctx-lnk-head";
    head.textContent = "Actions on this page";
    list.appendChild(head);
    actions.forEach(function (a) {
      var arow = document.createElement("div");
      arow.className = "ctx-lnk-row";
      var name = document.createElement("span");
      name.className = "ctx-lnk-name";
      name.textContent = a.label;
      var note = document.createElement("div");
      note.className = "ctx-lnk-note";
      note.textContent = 'Right-click any element, open its link, and pick this to point it here';
      arow.appendChild(name);
      arow.appendChild(note);
      list.appendChild(arow);
    });
  }

  if (!inv.set.length && !inv.builtin.length && !inv.inline.length && !inv.elsewhere.length) {
    var msg = document.createElement("div");
    msg.className = "ctx-file-msg";
    msg.textContent = 'Nothing on this page links anywhere yet. Right-click an element and choose "Add link".';
    list.appendChild(msg);
  }
  clampCtxMenu();
}

/**
 * Swaps the menu into its gallery-variable sub-view: one row per pane binding
 * on the page, each offering the two things a binding knows about itself -
 * which image it's on, and how many it has.
 * @note A sub-view rather than a flat list of buttons like the day tile's
 * chips get, because this list GROWS with the page: two directories already
 * means four entries, and eight would bury sixteen in the root menu.
 * @note The chips land in whichever field was right-clicked, as ordinary
 * markup inside it, so the surrounding words and styling stay the ta's -
 * which is the whole point of the variables being nested inside a normal
 * text element.
 */
function renderCtxMenuGalleryVars() {
  var field = CTX_TARGET_EL;
  var rows = [];
  galleryPaneBindings().forEach(function (dir) {
    /* named exactly as the formula menu names the same two, see
       galleryVariableFor() - one variable shouldn't read as two different
       things depending on which menu a ta reached it from */
    ["gallery-current", "gallery-total"].forEach(function (local) {
      rows.push({ local: local, dir: dir, label: galleryVariableFor(galleryVarKey(local, dir)).name });
    });
  });
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Insert gallery variable</div>' +
    rows.map(function (r, i) {
      return '<button type="button" data-gvar="' + i + '">' + escapeHtml(r.label) + '</button>';
    }).join("") +
    '<button type="button" class="ctx-lnk-back">Back</button>';
  CTX_MENU.querySelectorAll("[data-gvar]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var r = rows[+btn.getAttribute("data-gvar")];
      insertGalleryChip(field, r.local, r.dir);
      hideCtxMenu();
    });
  });
  CTX_MENU.querySelector(".ctx-lnk-back").addEventListener("click", renderCtxMenuRoot);
  clampCtxMenu();
}

/**
 * Swaps the menu into the image pane's directory picker: which directory the
 * new stage flips through, chosen before it's placed the same way a login
 * box's username/password is.
 * @note "Selected directory" is offered first and is what the page ships
 * with - a pane that follows the rail, the only binding that makes the rail's
 * tiles worth clicking.
 */
function renderCtxMenuGalleryDirPicker() {
  var dirs = (window.galleryDirNames ? window.galleryDirNames() : []).slice();
  var rows = [{ dir: "", label: "Selected directory (follows the rail)" }].concat(
    dirs.map(function (d) { return { dir: d, label: d }; }));
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Which directory?</div>' +
    rows.map(function (r, i) {
      return '<button type="button" data-gdir="' + i + '">' + escapeHtml(r.label) + '</button>';
    }).join("") +
    (dirs.length ? "" : '<div class="ctx-file-msg">No named directories yet — add one in the ' +
      'content manager\'s Gallery section.</div>') +
    '<button type="button" class="ctx-lnk-back">Back</button>';
  CTX_MENU.querySelectorAll("[data-gdir]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      addCustomElement("galleryPane", CTX_POS.x, CTX_POS.y,
        { dir: rows[+btn.getAttribute("data-gdir")].dir });
      hideCtxMenu();
    });
  });
  CTX_MENU.querySelector(".ctx-lnk-back").addEventListener("click", renderCtxMenuRoot);
  clampCtxMenu();
}

/**
 * Commits one progress element's Current/Total binding: updates the
 * descriptor, repersists it, repaints just this element's fill ratio, and
 * pushes one undo step.
 * @param id the element's data-resize-id
 * @param field "varCurrent" or "varTotal"
 * @param key the variable key to bind to
 * @note Called from the right-click menu's Variables sub-view, the only place
 * a bar's bindings are chosen - the style popover owns its two COLOURS and
 * nothing else, since what a bar is measuring isn't a paint decision.
 */
function setProgressVar(id, field, key) {
  var d = customElementById(id);
  var el = elByAnyId(id);
  if (!d || !el) return;
  var before = { varCurrent: d.varCurrent, varTotal: d.varTotal };
  if (before[field] === key) return;
  d[field] = key;
  saveCustomElements(CUSTOM_ELEMENTS);
  paintProgressElement(el, d);
  EDIT_UNDO.push({
    type: "progressvar", id: id, before: before,
    after: { varCurrent: d.varCurrent, varTotal: d.varTotal }
  });
  EDIT_REDO.length = 0;
}

/**
 * Swaps the menu into its progress-bar Variables sub-view: the two number
 * variables the bar's fill ratio is "Current of Total" between.
 * @note Lives on the right-click menu rather than the style popover, where it
 * used to, because a binding isn't styling - burying "what is this bar even
 * measuring" among the paint controls made the one structural choice the
 * hardest to find.
 * @note Both selects list every number-typed variable this page can bind to:
 * the content manager's own site-wide ones, plus whatever the page
 * contributes - so on the gallery a bar can measure a pane's own "which image
 * of how many".
 */
function renderCtxMenuProgressVars() {
  var id = CTX_TARGET_ID;
  var d = customElementById(id) || {};
  /* scoped to the bar itself: a bar sitting inside Day 1's tile binds Day 1's
     own numbers, not every day's, see pickableVariables() */
  var scopeEl = elByAnyId(id);
  var numbers = pickableVariables(d.varCurrent, scopeEl).filter(function (v) { return v.type === "number"; });
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Progress bar variables</div>' +
    (numbers.length ?
      '<div class="ctx-var-row"><label>Current</label><select class="ctx-var-current"></select></div>' +
      '<div class="ctx-var-row"><label>Total</label><select class="ctx-var-total"></select></div>' +
      '<div class="ctx-file-msg">Every number variable this page can use.</div>' :
      '<div class="ctx-file-msg">No number variables yet. Add one in the content manager’s Variables section.</div>') +
    '<button type="button" class="ctx-lnk-back">Back</button>';
  CTX_MENU.querySelector(".ctx-lnk-back").addEventListener("click", renderCtxMenuRoot);
  if (!numbers.length) return;

  var current = CTX_MENU.querySelector(".ctx-var-current");
  var total = CTX_MENU.querySelector(".ctx-var-total");
  populateProgressVarSelect(current, d.varCurrent || "", scopeEl);
  populateProgressVarSelect(total, d.varTotal || "", scopeEl);
  current.addEventListener("change", function () { setProgressVar(id, "varCurrent", current.value); });
  total.addEventListener("change", function () { setProgressVar(id, "varTotal", total.value); });
}

/**
 * Swaps the menu into its icon-picker sub-view: the built-in library plus
 * whatever custom icons any ta has uploaded, refetched every time this opens
 * so a teammate's just-added icon shows up without a reload.
 * @note A custom icon shows a delete "x" only for the ta who added it,
 * enforced server-side too - never a built-in, never another ta's upload.
 * @note The file input at the bottom uploads a new one, shared immediately,
 * the same round trip as a video or image.
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
        /* inline the uploaded file's real svg markup rather than dropping
           the url into an <img>: an <img> can't be recoloured through css,
           and "svg only, so it can be recoloured later" is the rule this
           picker enforces. Deliberately no <img> fallback - an upload whose
           markup won't parse is refused rather than placed as a permanently
           uncolourable element. */
        fetchSvgMarkup(ic.url).then(function (svg) {
          if (!svg) {
            msg.textContent = '"' + ic.name + '" isn\'t usable as an icon (SVG only). Remove it and re-upload an .svg.';
            return;
          }
          if (replacing) replaceThemeIcon(ICON_REPLACE_TARGET, svg);
          else addCustomElement("icon", CTX_POS.x, CTX_POS.y, { icon: svg });
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
 * Opens the icon picker in "replace" mode, anchored under a theme toggle's
 * "Change icon" row rather than at a right-click point: picking an icon there
 * replaces this toggle's icon instead of adding a new element.
 * @param id the theme-toggle element's id (STYLE_MENU_ID)
 * @note Positioned and clamped the same way the right-click menu is, just
 * measured off the target element's own box, since there's no click point.
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
 * Re-classes a picked icon's root tags to "tic" before it lands in a theme
 * toggle.
 * @param markup raw icon markup (one or more root <svg>/<img> tags)
 * @return the same markup with every root tag's class forced to "tic"
 * @note The picker's markup carries the standalone-icon class, wrong here on
 * two counts: too big for a 40px toggle, and its own accent colour would
 * override the inherited currentColor stroke, permanently locking the icon's
 * colour and defeating the toggle's own colour control.
 * @note Works on every direct child, not just the first, since the legacy
 * non-svg fallback path hands this a plain <img>.
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
 * the toggle's own id.
 * @param id the theme-toggle element's id
 * @param svgMarkup the new icon's markup, or "" to clear back to the default
 *   sun/moon swap
 * @note A shared per-id map rather than a custom-element-only field, since
 * the real nav toggle isn't a custom element at all and still needs its icon
 * override to survive a reload.
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
 * Applies saved theme-toggle icon overrides on top of every toggle's built-in
 * default sun/moon pair. Runs on every load, live site included.
 * @param map content.theme_icons, {id: svgMarkup}
 * @note Covers the nav's real #themeBtn and every placed "theme" element in
 * one pass, both selected the way js/theme.js already selects them.
 * @note Only the ".tic-icon" wrapper's innerHTML is replaced, never the
 * button's: that wrapper is its own tracked element, so its saved size,
 * position and colour survive an icon swap untouched.
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
 * Swaps a theme toggle's icon for a newly picked one, live in the dom and in
 * content.theme_icons, so it survives a reload like every other field.
 * @param id the theme-toggle element's id
 * @param svgMarkup the new icon's raw <svg>...</svg> (or <img>) markup
 * @note The markup is re-classed first, so it fits and recolours like the
 * toggle's own default rather than the standalone-icon picker's fixed look.
 * @note Only the ".tic-icon" wrapper is replaced, so the button's box and its
 * label are never touched by an icon swap.
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
 * ta-uploaded icon the way a built-in one already is.
 * @param url the uploaded icon's url
 * @return a promise resolving to the svg markup string, or null
 * @note Resolves null rather than rejecting on any failure, so a caller can
 * fall back without breaking the "Add element" flow.
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
 * Swaps the menu into its "Add image" sub-view: a real file picker, the same
 * "choose a file, it uploads immediately" pattern as every other upload input
 * on the site, rather than the earlier flat placeholder box.
 * @note The menu stays open with a status line during the upload so a slow
 * connection doesn't look broken, then closes and drops the image on success.
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
 * Swaps the menu into its "Add object" sub-view: two built-in entries, then
 * every object saved to the shared library, each rebuilt as a group of
 * freshly-idd elements at the point the menu was opened.
 * @note The Light/Dark toggle and the reel pair are "for fun" extras rather
 * than everyday building blocks, which is why they sit here rather than
 * cluttering the root list.
 * @note Built the same in both the real Visual editor and the object mini
 * editor, so an object can be built out of other saved objects.
 * @note A trailing "New object..." opens one in its own tab; saving it there
 * refreshes this picker without a reload, via the storage listener.
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
  if (kind === "extrasIcon") {
    /* tile-scoped by definition, so it binds to the tile the menu was opened
       for rather than to whatever the cursor happens to be over - the menu
       only offers it when there IS such a tile, see renderCtxMenuRoot() */
    addCustomElement(kind, CTX_POS.x, CTX_POS.y, { tile: ctxTileFor("extras") });
    hideCtxMenu();
    return;
  }
  if (kind === "button") { renderCtxMenuButtonLink(); return; }
  /* the username and password boxes are two separate entries in the menu
     rather than one that asks which: they're different things (different
     input type, different autocomplete hint, different value js/login.js
     posts), and a ta placing one always already knows which they want */
  if (kind === "loginUsername" || kind === "loginPassword") {
    addCustomElement("loginField", CTX_POS.x, CTX_POS.y,
      { field: kind === "loginPassword" ? "password" : "username" });
    hideCtxMenu();
    return;
  }
  /* which directory a new stage is bound to is the entire decision behind
     placing one, so it's asked up front rather than configured afterward -
     same shape as the login boxes just above */
  if (kind === "galleryPane") { renderCtxMenuGalleryDirPicker(); return; }
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
 * Shows the "Add element" menu at (x, y), resetting it to the root list even
 * if it was left mid sub-view. Clamped to stay inside the viewport, so a
 * right-click near an edge doesn't render it partly off-screen.
 * @param x left, document px
 * @param y top, document px
 * @param targetId the right-clicked element's id, or null for empty space
 * @param targetEl the actual right-clicked element, or null for empty space
 */
function showCtxMenu(x, y, targetId, targetEl) {
  if (!CTX_MENU) buildCtxMenu();
  CTX_POS = { x: x, y: y };
  CTX_TARGET_ID = targetId || null;
  CTX_TARGET_EL = targetEl || null;
  ICON_REPLACE_TARGET = null;
  renderCtxMenuRoot();
  CTX_MENU.classList.add("show");
  clampCtxMenu();
}

/**
 * Keeps the menu fully on screen at CTX_POS, its size measured as it
 * currently stands. Called on every open, and again by any sub-view whose
 * content is a different SIZE than the root list it replaced - the links view
 * is much wider, so a right-click near the right edge would otherwise leave
 * half of it past the window with no way to reach the url fields.
 */
function clampCtxMenu() {
  var w = CTX_MENU.offsetWidth, h = CTX_MENU.offsetHeight;
  var maxX = window.scrollX + document.documentElement.clientWidth - w - 6;
  var maxY = window.scrollY + document.documentElement.clientHeight - h - 6;
  CTX_MENU.style.left = Math.max(0, Math.min(CTX_POS.x, maxX)) + "px";
  CTX_MENU.style.top = Math.max(0, Math.min(CTX_POS.y, maxY)) + "px";
}

/** Hides the "Add element" menu. */
function hideCtxMenu() {
  /* the tooltip sub-view holds a bubble open and a draft in memory for as long
     as it's up, and this is every way it can close (an outside click, Escape,
     its own Done button, another right-click) - see closeTooltipEditor() */
  closeTooltipEditor();
  if (CTX_MENU) CTX_MENU.classList.remove("show");
  ICON_REPLACE_TARGET = null;
}

/**
 * Wires up the right-click "Add element" menu, only called in the portal's
 * Visual editor tab. Replaces the browser's own context menu throughout.
 * @note Also owns the outside-click and Escape dismissal for the ring's
 * layer-order popover, since both are the same kind of floating menu and only
 * ever exist together in this tab.
 */
function wireAddElementMenu() {
  document.addEventListener("contextmenu", function (e) {
    /* replaces the browser's own menu even mid-edit (contentEditable), since
       right-clicking while typing is exactly how a chip (day number/date/
       locked-state, filename, etc) gets re-inserted at the caret via this
       same menu's "Insert ..." buttons */
    e.preventDefault();
    var t = resolveSelectableTarget(e.target);
    /* every entry on this menu edits the element (add, duplicate, delete,
       link, tooltip, promote, lock), so in responsive mode the menu has
       nothing left to offer - and the right-click still selects, which is the
       one thing that does still mean something */
    if (RESPONSIVE_MODE) {
      if (t) { RING_EL = t; positionRing(); }
      return;
    }
    /* a right-click counts as "selecting" a tile too, so the tile-scoped
       actions work on first try without a separate left-click first */
    noteTileSelection(t);
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
    var hadMenu = false;
    if (CTX_MENU && CTX_MENU.classList.contains("show")) { hideCtxMenu(); hadMenu = true; }
    if (LAYER_MENU && LAYER_MENU.classList.contains("show")) { hideLayerMenu(); hadMenu = true; }
    if (STYLE_MENU && STYLE_MENU.classList.contains("show")) { hideStyleMenu(); hadMenu = true; }
    if (FX_MENU && FX_MENU.classList.contains("show")) { closeFormulaMenu(); hadMenu = true; }
    if (hadMenu) { if (SELECTED_IDS.length) clearSelection(); return; }
    /* with nothing open to close, Escape drops the selection itself. It has to
       be able to: an empty-space click now SELECTS something (the page, see
       selectPage()) rather than deselecting, so without this there'd be no way
       left to put the ring away at all. Escape mid-edit belongs to the text
       field, which reverts and blurs on it (see wireClickToEdit()) - one key
       press, one thing. */
    var active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    deselectAll();
  });
  /* the object editor stamps this key after a successful save - the value
     doesn't matter, only the change. "storage" fires only in OTHER same-origin
     tabs, which is exactly what's wanted: the object editor notifying this
     one. Re-fetches the library so a freshly-saved object is placeable right
     away, and re-renders the picker if it's currently showing. */
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
 * element attaches the ring to it, and it stays there until a different
 * tracked element is clicked or empty space clears it, whatever the mouse
 * hovers over in between. Only called in the portal's Visual editor tab.
 * @note That stickiness matters once an element ends up behind another: a
 * click-drag on its own body can only reach whichever element is topmost at
 * that pixel, but the ring's move handle floats above everything, so a
 * selected-but-covered element can still be dragged by it.
 * @note Moving doesn't need the handle either - dragging anywhere on the
 * element moves it, with a small threshold so a plain click still clicks.
 */
function wireResizable() {
  buildRing();
  /* here rather than at either page-init site: this is the one function
     every editor surface (each page's preview frame, the object canvas) runs
     and no live page ever does, which is exactly the preview's audience -
     see wireProgressBarHoverPreview() */
  wireProgressBarHoverPreview();
  window.addEventListener("scroll", positionRing, true);
  window.addEventListener("resize", positionRing);
  /* the snap guides are fixed to the viewport but held in document
     coordinates, so they have to be redrawn whenever the page moves under
     them - a drag near the bottom edge scrolls the frame. A no-op with no
     drag in progress, see paintSnapGuides(). */
  window.addEventListener("scroll", paintSnapGuides, true);

  /* drag-anywhere move, delegated so it covers rerendered content too */
  document.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    if (RING.contains(e.target)) return;
    var el = resolveSelectableTarget(e.target);
    if (!el) {
      /* clicked away from every tracked element: that's a click on the page
         itself, so the page is what gets selected (see selectPage()) - unless
         the click actually landed in one of the selected element's own
         floating popovers (layer/style menus, the right-click add-element
         menu, the rich text toolbar), which aren't part of the page content
         at all and still count as "still using the selection" */
      if ((!LAYER_MENU || !LAYER_MENU.contains(e.target)) &&
          (!STYLE_MENU || !STYLE_MENU.contains(e.target)) &&
          (!CTX_MENU || !CTX_MENU.contains(e.target)) &&
          (!TEXT_TOOLBAR || !TEXT_TOOLBAR.contains(e.target)) &&
          (!FX_MENU || !FX_MENU.contains(e.target))) {
        /* the grouping queue goes either way: it only ever exists relative to
           a live selection, see toggleSelected() */
        if (SELECTED_IDS.length) clearSelection();
        selectPage();
      }
      return;
    }
    /* remember which tile this click was inside, so a later right-click on
       the area around the tiles still knows which one to act on, see
       ctxTileFor() */
    noteTileSelection(el);
    /* mid-edit: leave the mouse to text selection/caret placement. Tested on
       the real event target, not just the resolved element: a glued child
       resolves UP to its parent (see resolveSelectableTarget()), which isn't
       itself contentEditable, so dragging across the text to select a few
       words would otherwise drag the whole element instead. */
    if (el.isContentEditable || (e.target && e.target.isContentEditable)) return;
    /* a plain (no-shift) click starts a fresh selection: whatever was queued
       for grouping is dropped the moment the ta moves on to a normal click,
       rather than lingering (still outlined green) until Escape. Only
       shift-held clicks keep building the queue, see toggleSelected(). */
    if (!e.shiftKey && SELECTED_IDS.length) clearSelection();
    /* a reel tile is grabbed by its background and carried to a new place in
       the strip (see startReelTileDrag()), rather than dragged to a free
       position of its own the way everything below is - it lives in the
       reel's flex track, and detaching it out of that track is exactly what
       must never happen to it. Group-selection is skipped for the same
       reason: a rigid group move would drag it out of the reel. */
    if (isReelTileEl(el)) {
      RING_EL = el;
      positionRing();
      startReelTileDrag(e, el);
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

    /* responsive mode stops here, having done the one thing a click still
       means in it: pick the element the plane pane is authoring. Deliberately
       after the selection above and before every drag path below, so
       selecting still works exactly as it always did and nothing else does. */
    if (RESPONSIVE_MODE) { e.preventDefault(); return; }
    /* locked: don't even start tracking a possible drag, see isLocked() */
    if (isLocked(elId(el))) return;
    /* a flow container's tile is grabbed by its background and carried to a
       new place in the running order, exactly like the reel tile just above -
       see startFlowTileDrag() */
    if (isTileBoxEl(el) && flowAreaOf(el)) { startFlowTileDrag(e, el); return; }
    /* every other tile selects (so its resize handles and style popover are
       reachable) but never drags, see isMoveLockedTileRole() */
    if (isMoveLockedTileRole(el)) return;

    var startX = e.clientX, startY = e.clientY;
    var base = getPos(el);
    var moving = false;
    /* captured on the first real mousemove, not here: a plain click must not
       lift a seated element out of its box, see startBoxDrag() */
    var seatBefore = null;
    /* set once the drag really starts, see snapLinesOf() */
    var snapFrom = null;
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
        seatBefore = startBoxDrag(el);
        var elRect = el.getBoundingClientRect();
        groupMembers.forEach(function (m) { m.preRect = m.el.getBoundingClientRect(); });
        detachFromFlow(el, elRect);
        groupMembers.forEach(function (m) { detachFromFlow(m.el, m.preRect); });
        /* base was read before the lift, when a seated element still had no
           offset of its own; re-read so the drag tracks from where it now is */
        base = getPos(el);
        /* nothing has moved yet at this point (the 5px threshold above is a
           pointer travel, not an element one), so this rect is still the
           element's pre-drag corner, same as the handle drag's - see
           startMoveDrag() */
        snapFrom = snapLinesOf(elRect);
        beginSnapDrag(el, groupMembers.map(function (m) { return m.el; }));
      }
      ev.preventDefault();
      var s = snapMoveDelta(snapFrom, ev.clientX - startX, ev.clientY - startY);
      var dx = s.dx, dy = s.dy;
      /* same edge-clamp a handle drag gets, see clampOwnPos() */
      var c = clampOwnPos(el, base.tx + dx, base.ty + dy);
      setOwnPos(el, c.tx, c.ty);
      groupMembers.forEach(function (m) {
        var mc = clampOwnPos(m.el, m.base.tx + dx, m.base.ty + dy);
        setOwnPos(m.el, mc.tx, mc.ty);
      });
      positionRing();
      paintSnapGuides();
      trackBoxDrop(el, ev);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (!moving) return; /* plain click, let it click/edit as normal */
      RING_DRAGGING = false;
      endSnapDrag();
      document.body.style.userSelect = "";
      JUST_DRAGGED = true;
      setTimeout(function () { JUST_DRAGGED = false; }, 0);
      /* see the same call in startMoveDrag(): a seat entry replaces the move
         entry, since a seated element has no free position to record */
      if (finishBoxDrop(el, seatBefore)) { positionRing(); return; }
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
    if (!RING_EL || RESPONSIVE_MODE) return;
    var active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    e.preventDefault();
    deleteElement(RING_EL);
  });

  /* Shift+R turns snapping on and off (see the SNAPPING section). Canva's
     shortcut, which is its rulers-and-guides toggle - it has no separate one
     for snapping itself - and it's free here, where the portal's own Snap
     switch is the same setting from outside the frame. Same "not while text
     is being typed" guard as every shortcut above; unlike them it doesn't
     need a selection, since it's about the next drag, not this element. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "r" && e.key !== "R") return;
    if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
    var active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    e.preventDefault();
    toggleSnapping();
  });

  /* Arrow keys nudge whatever the ring is on, 1px a press, 10px with shift,
     for lining something up more precisely than a drag can manage. Same
     guards as Delete above, plus its own one-entry-per-press undo step, since
     each press is already a discrete action rather than a gesture.
     Deliberately NOT snapped: this is the one way to place something a few px
     off a neighbour's edge without turning snapping off. */
  var ARROW_DELTAS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
  document.addEventListener("keydown", function (e) {
    var d = ARROW_DELTAS[e.key];
    if (!d) return;
    if (!RING_EL || RESPONSIVE_MODE || isPageEl(RING_EL) || isLocked(elId(RING_EL)) ||
        isMoveLockedTileRole(RING_EL)) return;
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
    /* a nudge honours the container edge exactly like a drag does, so
       holding an arrow key can't walk a tile's icon out of its tile */
    var after = clampOwnPos(el, before.tx + d[0] * step, before.ty + d[1] * step);
    setOwnPos(el, after.tx, after.ty);
    positionRing();
    commitPosition(el);
    var moves = [{ id: elId(el), before: before, after: after }];
    members.forEach(function (m) {
      detachFromFlow(m.el, m.preRect);
      var mAfter = clampOwnPos(m.el, m.base.tx + d[0] * step, m.base.ty + d[1] * step);
      setOwnPos(m.el, mAfter.tx, mAfter.ty);
      commitPosition(m.el);
      moves.push({ id: m.id, before: m.base, after: mAfter });
    });
    pushGroupMoveUndo(moves);
  });

  /* Ctrl/Cmd+C copies whatever the ring is on, under the same eligibility
     rule the Duplicate button applies - a reel tile, a tile role, a datetime
     element and the countdown tiles all render from structured data a generic
     clone can't carry over, so none are copyable here either. Ctrl/Cmd+V
     pastes and selects the fresh copy so it can be dragged straight away.
     Both are no-ops while a text field is mid-edit or focus sits in a real
     form control, so normal text copy/paste there still works.

     The copy goes to the localStorage clipboard rather than a variable here,
     so it can be pasted onto a different page. The pointer position is only
     the fallback: a paste with its original on screen is placed just off it. */
  var pointer = null;
  document.addEventListener("mousemove", function (e) {
    pointer = { x: e.pageX, y: e.pageY };
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "c" && e.key !== "C" && e.key !== "v" && e.key !== "V") return;
    if (!(e.ctrlKey || e.metaKey) || RESPONSIVE_MODE) return;
    var active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    if (e.key === "c" || e.key === "C") {
      if (!RING_EL || !isDuplicatable(RING_EL)) return;
      if (copyElementToClipboard(RING_EL)) showEditToast("Copied — paste on any page");
      return;
    }
    if (!readEditorClip()) return;
    e.preventDefault();
    /* a paste with the pointer parked off-page (straight after a page load,
       say) still has to land somewhere visible */
    var at = pointer || {
      x: window.scrollX + window.innerWidth / 2,
      y: window.scrollY + window.innerHeight / 3
    };
    var newEl = pasteEditorClip(at.x, at.y);
    if (newEl) {
      RING_EL = newEl;
      positionRing();
    }
  });
}

/**
 * Briefly flashes a one-line message at the bottom of the editor.
 * @param msg the text to show
 * @note Only used where an action has no visible result of its own - copying
 * an element being the case it was written for, since the page looks
 * identical afterward and the whole point is the copy surviving to the next
 * page.
 */
function showEditToast(msg) {
  var t = document.getElementById("editToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "editToast";
    t.className = "edit-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._hideTimer);
  t._hideTimer = setTimeout(function () { t.classList.remove("show"); }, 1600);
}

/**
 * Whether el is eligible for duplication - the same rule renderCtxMenuRoot()
 * applies to show or hide its own "Duplicate" button.
 * @param el a tracked element (data-edit-id/data-resize-id), eg RING_EL
 * @note Kept as a separate check rather than shared code, since the two need
 * different combinations of the same flags: Delete there only checks
 * isSpecial, Duplicate checks isSpecial plus the tile-role flags.
 */
function isDuplicatable(el) {
  if (!el) return false;
  /* a second page pasted onto the first one is meaningless, see isPageEl() */
  if (isPageEl(el)) return false;
  var id = elId(el);
  var targetData = id && customElementById(id);
  var isDatetime = targetData && targetData.kind === "datetime";
  var isTile = el.hasAttribute("data-reel-tile");
  var isExtrasFixed = el.hasAttribute("data-extras-fixed");
  var isExtrasRole = el.hasAttribute("data-extras-role");
  var isDaysFixed = el.hasAttribute("data-days-fixed");
  var isDaysRole = el.hasAttribute("data-days-role");
  /* a login field's own input rectangle: undeletable (see deleteElement())
     and not duplicable either - a second copy inside the same field would be
     a second box js/login.js never reads. Adding another FIELD is what the
     right-click menu's "Login page only" section is for. */
  var isLoginFixed = el.hasAttribute("data-login-fixed");
  /* a gallery directory tile and its two roles, for the same reason an
     attachment tile's are: what a tile shows comes from the directory it was
     rendered FOR, so a copy would be an orphan outside the shared-template
     system. Copy/paste (this function's caller) has to refuse them exactly as
     the right-click menu's own Duplicate row already does - isTileBoxEl()
     covers the day/attachment tile boxes there too. */
  var isGalleryRole = el.hasAttribute("data-gallery-role");
  var isSpecial = isDatetime || isTile || isTileBoxEl(el) || isExtrasFixed || isDaysFixed || isLoginFixed ||
    (id && (id.indexOf("logistics.") === 0 || id.indexOf("countdown.") === 0)) ||
    (el.querySelector && el.querySelector("#heroCountdown, #logisticsGrid"));
  return !(isSpecial || isExtrasRole || isDaysRole || isGalleryRole);
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

/* a small curated set rather than every Google Font under the sun. The first
   three are the site's own, referenced by css variable rather than by name so
   this list never names a typeface that could go stale. The rest are common
   system fonts needing no extra request, keeping the "one student, one week,
   no build step" feel rather than a font-picker megabundle. */
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
 * The generated css font-family name a ta-uploaded font is referenced by,
 * both in the toolbar's select and in a saved text style.
 * @param id the custom font asset's id
 * @return the css font-family name
 * @note Just the asset's own id, so it's always unique and never collides
 * with a built-in TEXT_FONTS value.
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
 * actually renders it, injected straight into <head>.
 * @param family the css font-family name (see customFontFamily())
 * @param url the uploaded font file's url
 * @note Unlike an icon or image, which just need a url in a src, a font needs
 * a page-wide declaration before anything can reference it by name.
 * @note Runs both in the editor and on every ordinary page load, since a real
 * visitor's browser needs the same declaration, not just the portal tab.
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

/* the toolbar's "link the selected words" / "unlink them again" pair (see
   buildTextToolbar()), same minimal stroke-icon style as ALIGN_ICONS above:
   a chain link, and the same chain with a stroke through it. */
var LINK_ICONS = {
  link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>' +
    '<path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
  unlink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>' +
    '<path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>' +
    '<line x1="3" y1="3" x2="21" y2="21"/></svg>'
};

/* the style popover's Flip horizontal/Flip vertical buttons (buildStyleMenu(),
   icon/image/video/box elements only, see toggleStyleMenu()): two arrows
   pointing away from a mirror axis, same minimal stroke-icon style as
   ALIGN_ICONS just above. */
var FLIP_ICONS = {
  h: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 3v18"/><path d="M17 8l3 4-3 4"/><path d="M7 8l-3 4 3 4"/></svg>',
  v: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M3 12h18"/><path d="M8 7l4-3 4 3"/><path d="M8 17l4 3 4-3"/></svg>'
};

/**
 * Applies a foreColor pick to the current selection inside fieldEl, then tags
 * whichever spans now carry that colour as belonging to the theme that's
 * active right now - the same independent-per-theme model as the style
 * popover's Color row.
 * @param fieldEl the contenteditable text field being edited
 * @param hex the "#rrggbb" just picked from a colour input
 * @param forDark which theme this pick is for; defaults to whichever is
 *   actually active right now
 * @note There's no separate "edit the other theme" toggle here: a ta gets
 * that by flipping the site's own theme button and picking again, which is
 * the workflow the popover's design already settled on.
 * @note Re-tags by colour VALUE, not node identity: execCommand is free to
 * split, merge or replace the spans under the selection however it likes, so
 * there's no reliable "the nodes I just touched" to diff against. Any span
 * showing exactly that colour, however it got there, IS that theme's colour
 * for that span - and a field is small enough to re-scan on every pick.
 * @note Runs execCommand even when tagging the theme that ISN'T showing,
 * since that's the only way to get a concrete span to tag. The wrong colour
 * briefly paints and is immediately corrected back by repaintInlineTextColors().
 */
function applyThemedForeColor(fieldEl, hex, forDark) {
  var active = isDarkThemeActive();
  var dark = forDark === undefined ? active : forDark;
  /* what the selection is painted RIGHT NOW, read before execCommand
     repaints it, and only when the pick is for the theme that ISN'T on
     screen - that's the one case the pin below has anything to do. */
  var shown = "";
  if (dark !== active) {
    try { shown = rgbToHex(document.queryCommandValue("foreColor")); } catch (e) {}
  }
  document.execCommand("styleWithCSS", false, true);
  document.execCommand("foreColor", false, hex);
  fieldEl.querySelectorAll("[style*='color']").forEach(function (span) {
    if (rgbToHex(span.style.color) !== hex.toLowerCase()) return;
    if (dark) span.dataset.darkColor = hex;
    else span.dataset.lightColor = hex;
    /* a span tagged for one theme only leaves the other side to
       resolveThemedColor()'s auto-variant, which is the right default for a
       ta who has only ever edited in one theme - but NOT for one who just
       went out of their way to open the other theme's swatch and pick a
       colour there. That gesture says the two are being set apart on
       purpose, so the theme still on screen stops being a guess and keeps
       exactly what it is showing.
       Without this, picking a dark colour from light mode retagged the span
       for dark only and left light rendering autoDarkVariant() of the new
       pick - which for any mid-lightness colour (lightness flips around 50%)
       comes back all but identical, so the pick appeared to apply to BOTH
       themes at once and the light-mode colour the ta never touched was
       silently gone. That is the "does not persist, and sets the same colour
       across both modes" report. */
    if (dark === active || !shown) return;
    var shownKey = active ? "darkColor" : "lightColor";
    if (!span.dataset[shownKey]) span.dataset[shownKey] = shown;
  });
  repaintInlineTextColors();
}

/**
 * Finds the theme-tagged span touching the current selection inside fieldEl,
 * so the toolbar's secondary colour input can prefill with that span's
 * explicit other-theme value rather than a blind auto-variant guess.
 * @param fieldEl the contenteditable text field being edited
 * @return the tagged span element, or null if the selection isn't inside one
 * @note Two cases, since a tagged span can sit on either side of the
 * selection's common ancestor: a collapsed selection walks UP from that
 * ancestor, while a selection that wraps the whole span from outside - which
 * is what this editor's own click-to-edit produces, since it auto-selects the
 * field's entire contents - falls back to checking whether exactly one tagged
 * descendant is intersected.
 * @note A selection spanning several differently-tagged spans resolves to the
 * one it starts in, or null when ambiguous. Fine for priming a swatch: the
 * actual pick always re-tags whatever is really selected.
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
 * Builds the floating text toolbar once, lazily, the same singleton pattern
 * as the selection ring.
 * @note Every button's mousedown is swallowed before it can steal focus - and
 * the field's selection with it - from the field being edited. The font
 * <select> can't have its mousedown prevented without breaking the native
 * dropdown, so its blur is special-cased instead.
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
    '<button type="button" class="tt-caps" title="Force ALL CAPS">Aa</button>' +
    '<button type="button" class="tt-link" title="Link the selected text">' + LINK_ICONS.link + '</button>' +
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
    '<button type="button" class="tt-pad" title="Padding (space between this text and its own edges)">Pad</button>' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="tt-fx" title="Insert a live value from a variable">ƒx</button>' +
    /* the link editor itself, a full-width row of its own that only appears
       once the link button is pressed (the toolbar is flex-wrap, so a 100%
       wide child always lands on its own line). Kept inside TEXT_TOOLBAR
       rather than floating separately so the field's blur handler already
       treats typing a url as "still editing" with no extra plumbing, exactly
       like the font dropdown and the colour pickers. */
    '<span class="tt-linkbar">' +
      '<input type="url" class="tt-link-input" placeholder="https://...">' +
      '<button type="button" class="tt-link-ok" title="Apply">Link</button>' +
      '<button type="button" class="tt-link-rm" title="Remove this link">' + LINK_ICONS.unlink + '</button>' +
    '</span>' +
    /* the padding editor, same full-width row as the link editor above and
       hidden the same way until its button is pressed. Four sides rather than
       one number because that's what padding is for here: pushing a button's
       wording off one particular edge is the common case, an even inset the
       other - hence the link toggle, which drives all four at once.

       Each box wears its side's letter and lights that edge on the real
       element while hovered. Four bare numbers in a row are only readable if
       you already know the order, and the one person who does is whoever
       wrote them. */
    '<span class="tt-padbar">' +
      '<label class="tt-pad-title">PAD</label>' +
      '<label class="tt-pad-cell" title="Top padding"><span>T</span>' +
        '<input type="number" class="tt-pad-in" data-side="t" min="0" max="200"></label>' +
      '<label class="tt-pad-cell" title="Right padding"><span>R</span>' +
        '<input type="number" class="tt-pad-in" data-side="r" min="0" max="200"></label>' +
      '<label class="tt-pad-cell" title="Bottom padding"><span>B</span>' +
        '<input type="number" class="tt-pad-in" data-side="b" min="0" max="200"></label>' +
      '<label class="tt-pad-cell" title="Left padding"><span>L</span>' +
        '<input type="number" class="tt-pad-in" data-side="l" min="0" max="200"></label>' +
      '<button type="button" class="tt-pad-lock" title="Change all four sides together">LINK</button>' +
      '<button type="button" class="tt-pad-rm" title="Back to the default padding">×</button>' +
    '</span>';
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
  /* both swatches guard against an <input type=color> footgun: opening the
     native picker and confirming it fires "input"/"change" even if the user
     never moved off the pre-filled value - which for the secondary swatch is
     often just an auto-variant SUGGESTION. Unguarded, a ta merely opening the
     toggle to see what the other theme looks like would silently bake that
     guess in. dataset.baseline tracks the value as of the last prime or
     commit, so only a real change past that point counts. */
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
      applyTextAlignStyle(el, next);
      saveTextStyle(id, "align", next);
      EDIT_UNDO.push({ type: "align", id: id, before: before, after: next });
      EDIT_REDO.length = 0;
      updateTextToolbarState();
    });
  });

  TEXT_TOOLBAR.querySelector(".tt-caps").addEventListener("click", function () {
    if (!TEXT_TOOLBAR_EL) return;
    var el = TEXT_TOOLBAR_EL;
    var id = el.getAttribute("data-edit-id");
    var before = el.style.textTransform || "";
    var want = getComputedStyle(el).textTransform === "uppercase" ? "none" : "uppercase";
    /* if forcing the opposite case actually matches what the template would
       already show with no override at all, clear the override outright
       rather than writing a redundant explicit one - same "never store more
       than the real difference" restraint every other saveTextStyle() call
       already takes */
    el.style.textTransform = "";
    var templateDefault = getComputedStyle(el).textTransform;
    var next = want === templateDefault ? "" : want;
    applyTextTransformStyle(el, next);
    saveTextStyle(id, "textTransform", next);
    EDIT_UNDO.push({ type: "texttransform", id: id, before: before, after: next });
    EDIT_REDO.length = 0;
    updateTextToolbarState();
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
    openFormulaMenu(TEXT_TOOLBAR_EL);
  });

  /* the padding editor. Its own row, opened and closed by the Pad button the
     same way the link editor's is, so the toolbar stays one line until a ta
     actually wants it. */
  TEXT_TOOLBAR.querySelector(".tt-pad").addEventListener("click", function () {
    var bar = TEXT_TOOLBAR.querySelector(".tt-padbar");
    var open = !bar.classList.contains("show");
    bar.classList.toggle("show", open);
    this.classList.toggle("active", open);
    if (open) primeTextToolbarPadding();
    positionTextToolbar();
  });
  TEXT_TOOLBAR.querySelector(".tt-pad-lock").addEventListener("click", function () {
    this.classList.toggle("active");
  });
  TEXT_TOOLBAR.querySelectorAll(".tt-pad-in").forEach(function (input) {
    /* the number inputs can't have their mousedown swallowed the way the
       buttons do (that would block typing into them and dragging the spinner),
       so just keep it off the drag-anywhere handler underneath, same
       special-case the font <select> already gets */
    input.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    /* light the edge this box drives, on the element itself. Hover shows it,
       focus keeps it: a box you've clicked into is the one you're about to
       type a number at, so it stays lit while the pointer wanders off to
       nothing in particular. */
    var side = input.getAttribute("data-side");
    var cell = input.parentElement;
    /* the letter is part of the box, so clicking it has to behave like
       clicking the box: kept off the drag-anywhere handler, but NOT
       preventDefault()ed, which is what hands focus on to the input */
    cell.addEventListener("mousedown", function (e) { e.stopPropagation(); });
    cell.addEventListener("mouseenter", function () { showPadSideHint(side); });
    cell.addEventListener("mouseleave", function () {
      if (document.activeElement !== input) hidePadSideHint();
    });
    input.addEventListener("focus", function () { showPadSideHint(side); });
    input.addEventListener("blur", function () { hidePadSideHint(); });
    input.addEventListener("input", function () {
      if (!TEXT_TOOLBAR_EL) return;
      if (TEXT_TOOLBAR.querySelector(".tt-pad-lock").classList.contains("active")) {
        TEXT_TOOLBAR.querySelectorAll(".tt-pad-in").forEach(function (other) {
          if (other !== input) other.value = input.value;
        });
      }
      writeTextToolbarPadding();
    });
    /* one undo entry per settled value, not one per keystroke, same rule the
       colour swatches follow (input paints, change records) */
    input.addEventListener("change", function () {
      if (!TEXT_TOOLBAR_EL) return;
      var after = TEXT_TOOLBAR_EL.style.padding || "";
      if (after !== TEXT_PADDING_BEFORE) {
        EDIT_UNDO.push({ type: "padding", id: elId(TEXT_TOOLBAR_EL), before: TEXT_PADDING_BEFORE, after: after });
        EDIT_REDO.length = 0;
      }
      TEXT_PADDING_BEFORE = after;
    });
  });
  TEXT_TOOLBAR.querySelector(".tt-pad-rm").addEventListener("click", function () {
    if (!TEXT_TOOLBAR_EL) return;
    var el = TEXT_TOOLBAR_EL;
    var before = el.style.padding || "";
    el.style.padding = "";
    savePadding(elId(el), "");
    primeTextToolbarPadding();
    if (before !== "") {
      EDIT_UNDO.push({ type: "padding", id: elId(el), before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    TEXT_PADDING_BEFORE = "";
    positionRing();
  });

  /* the inline link editor (see the INLINE LINKS section above). The one
     thing it has to be careful about is the selection: the moment focus moves
     to the url input, the document selection is the input's own, so the words
     that were selected in the field are gone. The range is cloned when the
     bar opens and restored just before the link is applied - a Range keeps
     tracking its text through dom changes, it's only the SELECTION that gets
     taken away. */
  var linkBar = TEXT_TOOLBAR.querySelector(".tt-linkbar");
  var linkInput = TEXT_TOOLBAR.querySelector(".tt-link-input");
  var linkRange = null;
  linkInput.addEventListener("mousedown", function (e) { e.stopPropagation(); });

  function closeLinkBar() {
    linkBar.classList.remove("show");
    linkRange = null;
    positionTextToolbar();
  }

  function commitInlineLink(url) {
    var field = TEXT_TOOLBAR_EL;
    if (!field) return;
    var before = field.innerHTML;
    var sel = window.getSelection();
    if (linkRange) { sel.removeAllRanges(); sel.addRange(linkRange); }
    var changed = url
      ? applyInlineLinkToSelection(field, url)
      : removeInlineLinkAtSelection(field);
    closeLinkBar();
    field.focus();
    if (!changed) return;
    /* same commit path a typed edit takes, so an inline link is one undo step
       and lands in the preview snapshot like any other text change */
    commitTextFieldChange(field, before, field.innerHTML);
    positionRing();
    updateTextToolbarState();
  }

  TEXT_TOOLBAR.querySelector(".tt-link").addEventListener("click", function () {
    if (!TEXT_TOOLBAR_EL || this.disabled) return;
    if (linkBar.classList.contains("show")) { closeLinkBar(); return; }
    var sel = window.getSelection();
    linkRange = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    var existing = inlineLinkAt(TEXT_TOOLBAR_EL);
    linkInput.value = existing ? inlineLinkHref(existing) : "";
    TEXT_TOOLBAR.querySelector(".tt-link-rm").style.display = existing ? "" : "none";
    linkBar.classList.add("show");
    /* the bar is a whole extra row, so the toolbar has to re-park itself or
       it would now be covering the text being linked */
    positionTextToolbar();
    linkInput.focus();
    linkInput.select();
  });

  TEXT_TOOLBAR.querySelector(".tt-link-ok").addEventListener("click", function () {
    var url = linkInput.value.trim();
    if (url) commitInlineLink(url);
    else closeLinkBar();
  });
  TEXT_TOOLBAR.querySelector(".tt-link-rm").addEventListener("click", function () {
    commitInlineLink("");
  });
  linkInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var url = linkInput.value.trim();
      if (url) commitInlineLink(url);
      else closeLinkBar();
    }
    if (e.key === "Escape") { e.preventDefault(); closeLinkBar(); if (TEXT_TOOLBAR_EL) TEXT_TOOLBAR_EL.focus(); }
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
    updateCapsToggleLock(el);
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
        updateCapsToggleLock(el);
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
        updateCapsToggleLock(el);
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
 * Refreshes the toolbar's pressed look to match the current selection and
 * field.
 * @note Bold/italic/underline read from document.queryCommandState(), only
 * meaningful with the field focused. Align reads the field's own inline
 * override rather than its computed style, so a field that merely inherits
 * centre alignment doesn't show as active until a ta sets it here.
 * @note The colour swatches follow the same primary/secondary split as the
 * style popover: the primary always shows what's painted now, the secondary
 * the other theme's EXPLICIT value if the selection sits in a tagged span
 * that has one, else a suggestion, hidden until the toggle reveals it - a
 * fresh suggestion never counts as "the ta set this".
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
  TEXT_TOOLBAR.querySelector(".tt-caps").classList.toggle("active",
    getComputedStyle(TEXT_TOOLBAR_EL).textTransform === "uppercase");
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

  /* the link button needs something to act ON: either words to wrap, or a
     link the caret is already sitting in to retarget. Offered greyed out
     rather than hidden, so it's always in the same place and its tooltip
     still explains what it wants. Same logistics.* exclusion as ƒx just
     above, and for the same reason: those two fields save as plain
     textContent, so any markup put in them is stripped on the way out. */
  var sel = window.getSelection();
  var hasWords = !!(sel && sel.rangeCount && !sel.getRangeAt(0).collapsed);
  var inLink = !!inlineLinkAt(TEXT_TOOLBAR_EL);
  var linkBtn = TEXT_TOOLBAR.querySelector(".tt-link");
  linkBtn.disabled = id.indexOf("logistics.") === 0 || (!hasWords && !inLink);
  linkBtn.classList.toggle("active", inLink);
  linkBtn.title = inLink ? "Edit this link" : "Link the selected text";
}

/**
 * Best-effort check for whether a font has real glyphs of its own for a run
 * of text, rather than the browser silently substituting another font's.
 * @param family a css font-family value, as currently applied to a field
 * @return a Promise resolving {hasUpper, hasLower}
 * @note The same "measure against a neutral sentinel" trick font-load
 * detectors use, aimed at glyph coverage instead of load state: if a stack
 * with a monospace fallback measures a string at exactly the width monospace
 * alone does, the family never contributed its own glyphs.
 * @note Every built-in choice measures differently from that baseline either
 * way, so this only has real work to do on a ta-uploaded display font.
 */
function fontCaseCoverage(family) {
  var upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var lower = "abcdefghijklmnopqrstuvwxyz";
  if (!fontCaseCoverage._ctx) fontCaseCoverage._ctx = document.createElement("canvas").getContext("2d");
  var ctx = fontCaseCoverage._ctx;
  var probe = function () {
    ctx.font = "48px " + family + ", monospace";
    var famUpper = ctx.measureText(upper).width;
    var famLower = ctx.measureText(lower).width;
    ctx.font = "48px monospace";
    return {
      hasUpper: Math.abs(famUpper - ctx.measureText(upper).width) > 0.5,
      hasLower: Math.abs(famLower - ctx.measureText(lower).width) > 0.5
    };
  };
  var loaded;
  try { loaded = document.fonts.load("48px " + family); } catch (e) { loaded = Promise.resolve(); }
  /* document.fonts.ready as a second wait: .load() resolving only means the
     request settled, not that every font in the stack is necessarily usable
     yet in every browser - same double-wait belt-and-suspenders a couple of
     other font-swap spots in this file already use */
  return Promise.resolve(loaded).then(function () { return document.fonts.ready; }).then(probe, probe);
}

/**
 * Locks or unlocks the toolbar's caps toggle for the field being edited, off
 * a live glyph-coverage check of whatever font is applied to it.
 * @param el the field currently being edited
 * @note A font missing an entire case can't honestly render the other state:
 * turning caps off on an uppercase-only display font wouldn't reveal real
 * lowercase, just whatever the browser substitutes - so the toggle disables
 * itself rather than offering a control that can only show broken text.
 * @note Runs async, since glyph measurement needs the font to have loaded. By
 * the time it resolves the ta may have blurred the field or changed font, so
 * it re-checks this is still the same field before touching the button.
 */
function updateCapsToggleLock(el) {
  if (!TEXT_TOOLBAR) return;
  var btn = TEXT_TOOLBAR.querySelector(".tt-caps");
  btn.disabled = false;
  btn.title = "Force ALL CAPS";
  var family = getComputedStyle(el).fontFamily;
  fontCaseCoverage(family).then(function (cov) {
    if (TEXT_TOOLBAR_EL !== el || (cov.hasUpper && cov.hasLower)) return;
    btn.disabled = true;
    btn.title = cov.hasLower ?
      "This font has no uppercase letterforms of its own - caps unavailable" :
      "This font has no lowercase letterforms of its own - always shown in caps";
  });
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
  updateCapsToggleLock(el);
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
  /* shown (and thus laid out) before measuring, see positionTextToolbar() */
  TEXT_TOOLBAR.classList.add("show");
  positionTextToolbar();
}

/**
 * Parks the toolbar just above the field it's editing (below if there's no
 * room), clamped inside the viewport.
 * @note Split out of showTextToolbar() because the toolbar's height isn't
 * fixed for the life of a session: opening the link bar adds a row, and a
 * toolbar positioned for its old height would overlap the very text being
 * linked.
 * @note Every caller re-measures rather than caching, since the toolbar also
 * wraps onto extra rows on its own past a certain width.
 */
function positionTextToolbar() {
  if (!TEXT_TOOLBAR || !TEXT_TOOLBAR_EL) return;
  var r = TEXT_TOOLBAR_EL.getBoundingClientRect();
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
  if (!TEXT_TOOLBAR) return;
  TEXT_TOOLBAR.classList.remove("show");
  /* the link bar is per-edit-session state (it holds a cloned range into the
     field that just went away), so it never carries over into the next one */
  TEXT_TOOLBAR.querySelector(".tt-linkbar").classList.remove("show");
  /* the padding row isn't per-session state the way the link bar is, but a
     row left open would reposition the next field's toolbar for a control
     nobody asked for; the Pad button reopens it in one click */
  TEXT_TOOLBAR.querySelector(".tt-padbar").classList.remove("show");
  TEXT_TOOLBAR.querySelector(".tt-pad").classList.remove("active");
  hidePadSideHint();
}

/* the padding the field being edited had when its last settled value was
   recorded, so the number boxes can push one undo entry per value rather than
   one per keystroke - same split every colour swatch in this editor uses */
var TEXT_PADDING_BEFORE = "";

/**
 * Fills the toolbar's four padding boxes in from the field's current padding
 * (its own override if it has one, otherwise whatever the stylesheet gives
 * it, so the numbers always start from what a ta can actually see).
 */
function primeTextToolbarPadding() {
  if (!TEXT_TOOLBAR || !TEXT_TOOLBAR_EL) return;
  var p = currentPaddingValues(TEXT_TOOLBAR_EL);
  TEXT_TOOLBAR.querySelectorAll(".tt-pad-in").forEach(function (input) {
    input.value = p[input.getAttribute("data-side")];
  });
  TEXT_PADDING_BEFORE = TEXT_TOOLBAR_EL.style.padding || "";
}

/**
 * Writes the four boxes back onto the field and into the snapshot, as one
 * css shorthand (see applyPaddingOverrides()). Runs on every keystroke, so
 * the field resizes under the cursor as the number changes; the ring is
 * repositioned with it since padding is real box geometry, not paint.
 */
function writeTextToolbarPadding() {
  if (!TEXT_TOOLBAR || !TEXT_TOOLBAR_EL) return;
  var el = TEXT_TOOLBAR_EL;
  var side = {};
  TEXT_TOOLBAR.querySelectorAll(".tt-pad-in").forEach(function (input) {
    side[input.getAttribute("data-side")] = Math.max(0, Math.min(200, parseInt(input.value, 10) || 0));
  });
  var value = side.t + "px " + side.r + "px " + side.b + "px " + side.l + "px";
  el.style.padding = value;
  savePadding(elId(el), value);
  positionRing();
  /* the band being pointed at is the thing that just changed size, so it has
     to be redrawn with it or it'd sit over the old edge */
  if (PAD_HINT_SIDE) showPadSideHint(PAD_HINT_SIDE);
}

/* the overlay that shows which edge a padding box belongs to, and the side
   it's currently showing (kept so writeTextToolbarPadding() can redraw it as
   the number changes). Same lazy-singleton, appended-once shape as the snap
   guides. */
var PAD_HINT = null;
var PAD_HINT_SIDE = "";

/**
 * Lays a band over one side's padding on the field being edited: "t", "r",
 * "b" or "l". The band is the padding itself, so it grows and shrinks as the
 * number does and a ta can see the space they're actually buying. A side set
 * to 0 has no band to draw, so it falls back to a hairline on that edge -
 * still an answer to "which one is this", which is the question being asked.
 */
function showPadSideHint(side) {
  var el = TEXT_TOOLBAR_EL;
  if (!el) { hidePadSideHint(); return; }
  if (!PAD_HINT) {
    PAD_HINT = document.createElement("div");
    PAD_HINT.className = "pad-hint";
    document.body.appendChild(PAD_HINT);
  }
  var r = el.getBoundingClientRect();
  var cs = getComputedStyle(el);
  var widths = {
    t: parseFloat(cs.paddingTop) || 0,
    r: parseFloat(cs.paddingRight) || 0,
    b: parseFloat(cs.paddingBottom) || 0,
    l: parseFloat(cs.paddingLeft) || 0
  };
  var band = Math.max(widths[side] || 0, 2);
  var s = PAD_HINT.style;
  if (side === "t" || side === "b") {
    s.left = r.left + "px";
    s.width = r.width + "px";
    s.height = band + "px";
    s.top = (side === "t" ? r.top : r.bottom - band) + "px";
  } else {
    s.top = r.top + "px";
    s.height = r.height + "px";
    s.width = band + "px";
    s.left = (side === "l" ? r.left : r.right - band) + "px";
  }
  PAD_HINT_SIDE = side;
  PAD_HINT.classList.add("show");
}

/** Takes the padding band away (pointer left the box, or the toolbar closed). */
function hidePadSideHint() {
  PAD_HINT_SIDE = "";
  if (PAD_HINT) PAD_HINT.classList.remove("show");
}

/* the text toolbar's "ƒx" button's own popover: builds a {...} reference and
   writes it, as ORDINARY TEXT, into the field currently being edited (see
   writeFormulaMenuToken()). It doesn't produce chips: a field mid-edit holds
   no chips at all, only notation (see chipsToNotation()), and the notation
   this writes is exactly what a ta could have typed by hand. Same lazy-
   singleton pattern as TEXT_TOOLBAR/STYLE_MENU. */
var FX_MENU = null;
/* the data-edit-id field the menu is currently acting on */
var FX_MENU_FIELD = null;
/* the {...} run of text the menu opened ON - {node, start, end} into one of
   the field's text nodes - or null when it's inserting a new one. This is
   what replaces the old "the chip <span> being edited": with references
   living as text mid-edit, "the one under the caret" is a text range. */
var FX_MENU_TOKEN = null;
/* the field's selection at the moment the menu opened (insert case only) -
   picking a variable in the menu's own <select>s moves real browser focus
   (and the selection) away from the field, so the caret position has to be
   captured up front and restored when the token is written */
var FX_MENU_RANGE = null;

/** Builds the formula menu once, lazily. */
function buildFormulaMenu() {
  FX_MENU = document.createElement("div");
  FX_MENU.className = "fx-menu";
  FX_MENU.innerHTML =
    '<label class="fxm-row">Insert<select class="fxm-op"></select></label>' +
    '<label class="fxm-row fxm-a-row">Variable<select class="fxm-a"></select></label>' +
    '<label class="fxm-row fxm-b-row">Of<select class="fxm-b"></select></label>' +
    '<label class="fxm-row fxm-expr-row">Expression<input type="text" class="fxm-expr" spellcheck="false"></label>' +
    '<label class="fxm-row fxm-dec-row">Decimals<input type="number" class="fxm-decimals" min="0" max="6" value="0"></label>' +
    '<label class="fxm-row fxm-comma-row"><input type="checkbox" class="fxm-comma"> Thousands separator (1,000)</label>' +
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
     the whole time these are used. The op/variable/expression/decimals
     controls DO need real focus to open/type, so those only get their
     mousedown's bubbling stopped, not prevented - same split TEXT_TOOLBAR's
     font <select> and color <input>s already use. */
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
  FX_MENU.querySelector(".fxm-remove").addEventListener("click", removeFormulaMenuToken);
}

/**
 * Shows or hides the menu's rows and refills its selects for whichever shape
 * is now picked: "value" is the only one that accepts a non-number variable
 * and has no second operand, every other needs two numbers, and "custom"
 * needs neither since the ta writes the expression themselves.
 * @note The Decimals row's visibility follows the picked variable's type for
 * "value", and is always hidden for "fraction", which is whole numbers.
 * @note Both selects are SCOPED to the field being edited: a field inside Day
 * 1's tile offers Day 1's locals and no other day's. Offering every day's at
 * once was offering bindings that, on a template mirrored across every tile,
 * were never the one the ta meant.
 */
function refreshFormulaMenuRows() {
  var op = FX_MENU.querySelector(".fxm-op").value;
  var meta = FX_OPS[op] || FX_OPS.value;
  var scopeEl = FX_MENU_FIELD;
  var aSelect = FX_MENU.querySelector(".fxm-a");
  var aPredicate = meta.anyType ? function () { return true; } : function (v) { return v.type === "number"; };
  var curA = aSelect.value;
  /* the content manager's variables plus whatever THIS field can see of the
     page's own - on the gallery that's its panes' numbers too */
  var poolA = pickableVariables(curA, scopeEl);
  var aStillValid = curA && poolA.some(function (v) { return v.key === curA && aPredicate(v); });
  var firstA = (poolA.filter(aPredicate)[0] || {}).key || "";
  populateVariableSelect(aSelect, aPredicate, aStillValid ? curA : firstA, scopeEl);

  FX_MENU.querySelector(".fxm-a-row").style.display = meta.custom ? "none" : "";
  FX_MENU.querySelector(".fxm-b-row").style.display = (meta.needsB && !meta.custom) ? "" : "none";
  FX_MENU.querySelector(".fxm-expr-row").style.display = meta.custom ? "" : "none";
  if (meta.needsB) {
    var bSelect = FX_MENU.querySelector(".fxm-b");
    var curB = bSelect.value;
    var numberPredicate = function (v) { return v.type === "number"; };
    var poolB = pickableVariables(curB, scopeEl);
    var bStillValid = curB && poolB.some(function (v) { return v.key === curB && numberPredicate(v); });
    var firstB = (poolB.filter(numberPredicate)[0] || {}).key || "";
    populateVariableSelect(bSelect, numberPredicate, bStillValid ? curB : firstB, scopeEl);
  }

  var aVar = variableByKey(aSelect.value);
  var showDecimals = meta.custom || (op !== "fraction" && (meta.needsB || (aVar && aVar.type === "number")));
  FX_MENU.querySelector(".fxm-dec-row").style.display = showDecimals ? "" : "none";
  FX_MENU.querySelector(".fxm-comma-row").style.display = showDecimals ? "" : "none";
}

/**
 * The {...} run of text the caret is sitting in, if any - what the menu opens
 * ON rather than beside.
 * @param field the field being edited
 * @return {node, start, end, body}, or null
 * @note Replaces the old "did the ta click an fx-chip" test: mid-edit a
 * reference is text, so the equivalent question is whether the caret is
 * inside one of this text node's tokens.
 */
function tokenAtSelection(field) {
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  var r = sel.getRangeAt(0);
  var node = r.startContainer;
  if (!node || node.nodeType !== 3 || !field.contains(node)) return null;
  var text = node.nodeValue;
  var off = r.startOffset;
  var m;
  VARIABLE_TOKEN_RE.lastIndex = 0;
  while ((m = VARIABLE_TOKEN_RE.exec(text))) {
    if (m[1]) continue; /* an escaped brace isn't a reference */
    if (off >= m.index && off <= m.index + m[0].length) {
      return { node: node, start: m.index, end: m.index + m[0].length, body: m[2] };
    }
  }
  return null;
}

/**
 * Reads one expression back into the menu's own controls, so a reference
 * built here - or typed by hand in the same shape - can be reopened and
 * adjusted with the pickers rather than only as raw text.
 * @param expr the expression source
 * @return {op, a, b} with a/b as variable tokens, or null
 * @note Anything the ready-made shapes can't describe falls through to null,
 * which puts the menu into "custom" mode with the expression in the box.
 */
function decomposeExpression(expr) {
  var ast = fxParse(expr);
  if (!ast) return null;
  if (ast.t === "var") return { op: "value", a: ast.v, b: "" };
  var pair = { "+": "sum", "-": "difference", "*": "product", "/": "quotient" };
  if (ast.t === "bin" && pair[ast.op] && ast.a.t === "var" && ast.b.t === "var") {
    return { op: pair[ast.op], a: ast.a.v, b: ast.b.v };
  }
  /* percent: A / B * 100 + "%" */
  if (ast.t === "bin" && ast.op === "+" && ast.b.t === "str" && ast.b.v === "%" &&
      ast.a.t === "bin" && ast.a.op === "*" && ast.a.b.t === "num" && ast.a.b.v === 100 &&
      ast.a.a.t === "bin" && ast.a.a.op === "/" && ast.a.a.a.t === "var" && ast.a.a.b.t === "var") {
    return { op: "percent", a: ast.a.a.a.v, b: ast.a.a.b.v };
  }
  /* fraction: A + " of " + B */
  if (ast.t === "bin" && ast.op === "+" && ast.b.t === "var" &&
      ast.a.t === "bin" && ast.a.op === "+" && ast.a.a.t === "var" &&
      ast.a.b.t === "str" && ast.a.b.v === " of ") {
    return { op: "fraction", a: ast.a.a.v, b: ast.b.v };
  }
  return null;
}

/** The <select> value (a variable key) that stands for one typed token. */
function selectKeyForToken(token) {
  var v = variableByToken(token);
  return v ? v.key : "";
}

/**
 * Opens the formula menu on the field being edited: if the caret sits inside
 * a {...} reference the menu prefills from it and replaces it on OK,
 * otherwise it inserts a new one at the caret.
 * @param fieldEl the data-edit-id field being edited
 * @note Only ever called while fieldEl is already mid-edit, from the
 * toolbar's fx button - there are no chips left to click mid-edit.
 */
function openFormulaMenu(fieldEl) {
  if (!FX_MENU) buildFormulaMenu();
  FX_MENU_FIELD = fieldEl;
  var token = tokenAtSelection(fieldEl);
  FX_MENU_TOKEN = token;
  var sel = window.getSelection();
  FX_MENU_RANGE = (!token && sel && sel.rangeCount) ? sel.getRangeAt(0).cloneRange() : null;

  var split = token ? splitTokenBody(token.body) : null;
  var shape = split ? decomposeExpression(split.expr.trim()) : null;
  var opSelect = FX_MENU.querySelector(".fxm-op");
  var exprInput = FX_MENU.querySelector(".fxm-expr");
  opSelect.value = token ? (shape ? shape.op : "custom") : "value";
  exprInput.value = (split && !shape) ? split.expr.trim() : "";
  refreshFormulaMenuRows();
  if (shape) {
    var aKey = selectKeyForToken(shape.a);
    var bKey = selectKeyForToken(shape.b);
    if (aKey) FX_MENU.querySelector(".fxm-a").value = aKey;
    if (bKey) FX_MENU.querySelector(".fxm-b").value = bKey;
    /* a reference this field's own picker doesn't offer (Day 2's header,
       typed by hand inside Day 1's tile) has no option to select - fall back
       to showing the expression itself rather than silently rebinding it to
       whatever the select happens to be sitting on */
    if ((aKey && FX_MENU.querySelector(".fxm-a").value !== aKey) ||
        (bKey && FX_OPS[shape.op].needsB && FX_MENU.querySelector(".fxm-b").value !== bKey)) {
      opSelect.value = "custom";
      exprInput.value = split.expr.trim();
      refreshFormulaMenuRows();
    }
  }
  FX_MENU.querySelector(".fxm-decimals").value = split ? String(split.flags.decimals) : "0";
  FX_MENU.querySelector(".fxm-comma").checked = !!(split && split.flags.comma);
  FX_MENU.querySelector(".fxm-ok").textContent = token ? "Update" : "Insert";
  FX_MENU.querySelector(".fxm-remove").style.display = token ? "" : "none";

  FX_MENU.classList.add("show");
  var anchor = TEXT_TOOLBAR_EL || fieldEl;
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
  FX_MENU_TOKEN = null;
  FX_MENU_RANGE = null;
  if (FX_MENU) FX_MENU.classList.remove("show");
}

/**
 * Writes the menu's result into the field as plain text - replacing the token
 * it opened on, or inserting at the caret position captured when it opened.
 * @param text the "{...}" notation, or "" to delete the token
 * @note Deliberately does NOT commit: the field is still mid-edit and what's
 * been written is notation, not a chip. Its blur handler parses and commits
 * once, so using the menu is one undo step alongside everything else typed in
 * the same session, and no half-edited notation is ever mirrored onto the
 * other tiles sharing this template.
 */
function writeFormulaMenuToken(text) {
  var field = FX_MENU_FIELD;
  var token = FX_MENU_TOKEN;
  var range = document.createRange();
  if (token && token.node.parentNode) {
    range.setStart(token.node, Math.min(token.start, token.node.nodeValue.length));
    range.setEnd(token.node, Math.min(token.end, token.node.nodeValue.length));
  } else if (FX_MENU_RANGE) {
    range = FX_MENU_RANGE;
  } else {
    range.selectNodeContents(field);
    range.collapse(false);
  }
  range.deleteContents();
  var node = document.createTextNode(text);
  range.insertNode(node);
  closeFormulaMenu();
  field.focus();
  var after = document.createRange();
  after.setStartAfter(node);
  after.collapse(true);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(after);
}

/**
 * Applies the menu's current picks, as the notation they stand for. A
 * ready-made shape spells itself out through its own FX_OPS .build (so
 * "Percent" writes {A / B * 100 + "%"}, which the ta can then go on to edit
 * by hand like anything else); "custom" takes the expression verbatim.
 */
function commitFormulaMenu() {
  if (!FX_MENU_FIELD) return;
  var op = FX_MENU.querySelector(".fxm-op").value;
  var meta = FX_OPS[op] || FX_OPS.value;
  var decimals = parseInt(FX_MENU.querySelector(".fxm-decimals").value, 10);
  if (isNaN(decimals) || decimals < 0) decimals = 0;
  var comma = FX_MENU.querySelector(".fxm-comma").checked;
  var expr;
  if (meta.custom) {
    expr = FX_MENU.querySelector(".fxm-expr").value.trim();
  } else {
    var aTok = variableNotationToken(variableByKey(FX_MENU.querySelector(".fxm-a").value));
    var bTok = meta.needsB ? variableNotationToken(variableByKey(FX_MENU.querySelector(".fxm-b").value)) : "";
    if (!aTok || (meta.needsB && !bTok)) return; /* nothing pickable on this page yet */
    expr = meta.build(aTok, bTok);
  }
  if (!expr) return;
  writeFormulaMenuToken("{" + expr + formulaFlagString(decimals, comma) + "}");
}

/** Deletes the reference the menu opened on. */
function removeFormulaMenuToken() {
  if (!FX_MENU_FIELD || !FX_MENU_TOKEN) return;
  writeFormulaMenuToken("");
}

/**
 * Whether a field paints a background of its own, and so already has a colour
 * its text was written to be legible against.
 * @param el the field about to be edited
 * @return true if the element paints its own background
 * @note Decides whether an open edit gets the flat editing backdrop behind
 * it. Text with nothing behind it wants that; a button or tinted card must
 * keep what it has, since the backdrop would replace a designed pairing with
 * a colour the text was never chosen for - green button, dark label,
 * surface-coloured backdrop, and the wording vanishes into it.
 * @note Computed style rather than el.style, so a stylesheet rule or a saved
 * override counts the same as an inline one. A gradient counts as painted.
 */
function hasOwnBackdrop(el) {
  var cs = window.getComputedStyle(el);
  if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
  var bg = cs.backgroundColor;
  if (!bg || bg === "transparent") return false;
  var parts = bg.match(/^rgba?\(([^)]+)\)$/);
  /* a keyword or any form this doesn't recognise: something was asked for, so
     treat it as painted and leave it alone - the worse mistake of the two is
     covering up a real colour */
  if (!parts) return true;
  var vals = parts[1].split(/[,\/\s]+/);
  return !(vals.length > 3 && parseFloat(vals[3]) === 0);
}

/**
 * Wires up one data-edit-id element as a click-to-edit field.
 * @param el the element to wire up
 * @note Shared by wireClickToEdit()'s initial pass over every template field
 * and by addCustomElement() for one created on the fly, so a brand new field
 * behaves exactly like one that's been there since the template loaded.
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
    /* nothing to intercept mid-edit any more: the field holds only text (see
       chipsToNotation()), so every click just places a caret, including
       inside a {...} reference. Reconfiguring one through the ƒx menu is the
       toolbar button, which reads whichever reference the caret is in - see
       tokenAtSelection(). */
    if (el.isContentEditable) return;
    /* responsive mode doesn't change what a field SAYS, so a click on one
       selects it like a click on any other element and stops there. The
       mousedown handler in wireResizable() has already done that selecting
       by the time this runs. */
    if (RESPONSIVE_MODE) { e.preventDefault(); e.stopPropagation(); return; }
    /* shift-click already toggled group-selection in the mousedown handler
       above (wireResizable(), which runs for every tracked element,
       text fields included, and fires before this click event does); this
       just has to stop the edit from ALSO opening, not toggle a second
       time (that would just cancel the mousedown handler's own toggle) */
    if (e.shiftKey) { e.preventDefault(); e.stopPropagation(); return; }
    e.preventDefault();
    e.stopPropagation();
    /* captured BEFORE the chips are unpacked, so "before" is the field's
       real committed markup: blur packs the notation straight back into
       chips, and a click-in/click-out with no typing therefore diffs as no
       change at all */
    beforeEdit = el.innerHTML;
    el.contentEditable = "true";
    /* asked BEFORE ".editing" goes on, so the answer is about the field as it
       looks on the live page rather than as the editor has already dressed it */
    if (!hasOwnBackdrop(el)) el.classList.add("editing-backdrop");
    el.classList.add("editing");
    /* every chip becomes the plain {variable} text it came from for as long
       as the field is being edited - ordinary, selectable, retypable text
       with no atomic nodes in the way - and blur turns it all back into
       resolved chips, see chipsToNotation()/parseVariableTokens() */
    chipsToNotation(el);
    showTextToolbar(el);
    el.focus();
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    /* re-primed now that the whole field is selected: showTextToolbar() ran
       before this, when the selection was still wherever the click left it,
       so anything keyed off the selection (the link button, see
       updateTextToolbarState()) was reading the wrong state */
    updateTextToolbarState();
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
    el.classList.remove("editing-backdrop");
    hideTextToolbar();
    /* packs every {...} the field now holds - the ones chipsToNotation()
       unpacked on the way in, plus anything the ta typed or pasted - back
       into live chips, see parseVariableTokens(). Notation that names
       nothing simply stays the text it is. */
    parseVariableTokens(el);
    repaintLocalTileContent();
    /* the edit may have changed el's own rendered size (more/less text),
       so the ring needs to catch up if it's sitting on this field */
    positionRing();
    commitTextFieldChange(el, beforeEdit, el.innerHTML);
  });

  el.addEventListener("keyup", updateTextToolbarState);
  el.addEventListener("mouseup", updateTextToolbarState);
}

/**
 * Commits a text field's edit session: pushes an undo step if anything
 * changed, persists, and syncs any elements sharing the same data-edit-id.
 * @param el the data-edit-id field
 * @param before its innerHTML at the start of the edit session
 * @param after its innerHTML now
 * @note Called both from the blur handler for a typed edit and from the
 * right-click menu's chip-restoring actions, which run on a field that ISN'T
 * being edited - a chip is just more of the field's innerHTML, so both paths
 * commit identically and get undo for free with no separate action type.
 * @note The fx menu deliberately doesn't come through here: it writes into a
 * field already mid-edit, and that field's own blur commits the lot as one.
 */
function commitTextFieldChange(el, before, after) {
  if (after !== before) {
    EDIT_UNDO.push({ type: "text", id: el.getAttribute("data-edit-id"), before: before, after: after });
    EDIT_REDO.length = 0;
  }
  saveEditedField(el.getAttribute("data-edit-id"), after, el.getAttribute("data-default-html"));
  mirrorEditedField(el.getAttribute("data-edit-id"), after, el);
}

/* the <input type> values that carry a real native undo stack of their own -
   ie the ones a ta types free text into. Everything else the editor puts in an
   <input> (the style popover's colour swatches, its radius/opacity/rotate
   sliders, its checkboxes) has no per-control history for ctrl+z to reach,
   which is the whole point of ownsNativeUndo() below. */
var NATIVE_UNDO_INPUT_TYPES = {
  text: 1, search: 1, url: 1, tel: 1, email: 1, password: 1, number: 1, date: 1, time: 1
};

/**
 * Whether ctrl+z belongs to the focused control rather than the editor's own
 * history. True only where the browser really has something to undo - a field
 * being typed into - since taking the shortcut off it would eat keystrokes.
 * @param el the focused element (document.activeElement)
 * @return true if the control should keep the shortcut for itself
 * @note The blanket "any INPUT, TEXTAREA or SELECT" this used to be swallowed
 * the shortcut on controls with no native history at all, and the style
 * popover is built almost entirely from those: change a colour and focus
 * stays on the input that committed it, so every ctrl+z after hit this guard
 * silently. The edit WAS on the stack and the portal's Undo button would have
 * replayed it; from the keyboard colours just looked un-undoable.
 */
function ownsNativeUndo(el) {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName !== "INPUT") return false;
  return !!NATIVE_UNDO_INPUT_TYPES[(el.getAttribute("type") || "text").toLowerCase()];
}

/**
 * Turns every data-edit-id element into a click-to-edit field, only called in
 * the portal's Visual editor tab with &edit=1 set.
 * @note Edits save straight into the preview_content snapshot the portal
 * already restores unsaved work from: the iframe is same-origin with the
 * portal tab and shares it, so no postMessage plumbing is needed to get an
 * edit back out.
 */
function wireClickToEdit() {
  document.body.classList.add("edit-mode");
  document.querySelectorAll("[data-edit-id]").forEach(wireTextField);

  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (ownsNativeUndo(document.activeElement)) return;
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
  repaintLocalTileContent();
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
 * Replays one undo/redo stack entry.
 * @param action the stack entry
 * @param side "before" or "after", which side of the action to restore
 * @note "before"/"after" mean whatever state of the element that side
 * represents - "before" for an undo, "after" for a redo - for every type:
 *  - "text": innerHTML
 *  - "delete": existed (before) vs hidden (after)
 *  - "move": {tx, ty}
 *  - "resize": {w, h, tx, ty}, since a resize can also shift position. A TILE
 *    resize carries an extra action.area for the container whose saved height
 *    the drag changed on the way past
 *  - "fontsize": css font-size, or "" for the template default
 *  - "align"/"letterspacing"/"texttransform": the css value, or ""
 *  - "fontfamily": {family, url} (url only for a ta-uploaded font)
 *  - "add": the same shape as "delete" with the two sides swapped
 *  - "layer": no value, just replays moveLayer(id, +-dir)
 *  - "layerorder": full LAYER_ORDER snapshots on both sides, since a to-top
 *    jump isn't its own inverse the way an adjacent swap is
 *  - "fixed": no value either - toggleFixed(id) is its own inverse
 *  - "datetime": {target, format, strftime}
 *  - "darkcolor"/"darktextcolor"/"darkfill": a css colour, or "" for the
 *    auto-computed variant
 *  - "darkborder": same, since only the colour half of Border is themed
 *  - "flip_h"/"flip_v": no value, self-inverse like "shadow"
 *  - "rotate": whole-number degrees, or 0 for the default
 *  - "hovercolor"/"activecolor" and their dark pairs: as "fill"/"darkfill"
 *  - "navstate": "out"/"in"/"both" - three states, so unlike the toggles it
 *    stores a real value on each side
 *  - "videoplayback": no value, one of a video's three switches (action.key)
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
  /* the three reel-wide edits (see startReelTileDrag()/startReelTileResize()/
     buildStyleMenu()'s spacing rows): all keyed by the PANEL's id, since
     what they change belongs to the reel as a whole even when the drag that
     made the change started on one tile */
  if (action.type === "reelOrder" || action.type === "reelTileSize" || action.type === "reelSpacing") {
    var reelEl = elByAnyId(action.id);
    if (!reelEl) return;
    if (action.type === "reelOrder") applyReelOrder(reelEl, val);
    else if (action.type === "reelTileSize") setReelTileSize(reelEl, val.w, val.h);
    else setReelSpacing(reelEl, action.key, val);
    if (STYLE_MENU_ID && STYLE_MENU && STYLE_MENU.classList.contains("show") &&
        reelPanelOf(styleMenuElById(STYLE_MENU_ID)) === reelEl) {
      primeStyleMenuReelRows(reelEl);
    }
    positionRing();
    return;
  }
  /* a flow container's tile spacing (see areaFlowFor()'s "gap"), keyed by the
     CONTAINER's id even though the popover that changed it was usually opened
     on a tile - same "this belongs to the layout as a whole" reasoning as the
     three reel-wide edits just above */
  /* a flow container's running order (see startFlowTileDrag()). Both sides are
     the tile ELEMENTS themselves rather than any id - see applyFlowTileOrder()
     for why, and for what happens to an entry a re-render has invalidated */
  if (action.type === "flowOrder") {
    applyFlowTileOrder(action.area, val);
    positionRing();
    return;
  }
  /* seating an element in a box, or lifting it back out - see restoreSeat(),
     which takes either side of the entry and puts the element back into it */
  if (action.type === "seat") {
    restoreSeat(seatedElById(action.id), val);
    positionRing();
    if (window.responsiveRepaintSoon) window.responsiveRepaintSoon();
    return;
  }
  /* "Put N elements in a box": one entry covering the box AND every element's
     seating, so a single press undoes the whole action - see boxSelection().
     Undoing puts each element back where it was and hides the box (the same
     "before" state a delete leaves behind, see addCustomElement()); redoing
     brings the box back and re-seats them in the order they were seated. */
  if (action.type === "boxwrap") {
    var wrapBox = elByAnyId(action.boxId);
    if (side === "before") {
      action.seats.forEach(function (s) { restoreSeat(seatedElById(s.id), s.before); });
      setElementHidden(action.boxId, true);
    } else {
      setElementHidden(action.boxId, false);
      if (wrapBox) action.seats.forEach(function (s) {
        var el = seatedElById(s.id);
        if (el) seatInBox(el, wrapBox, null);
      });
    }
    positionRing();
    if (window.responsiveRepaintSoon) window.responsiveRepaintSoon();
    return;
  }
  /* a box's "does an Alt-drop land in here" switch, see setBoxAcceptsDrops().
     val is the stored negative, so it goes straight onto the descriptor. */
  if (action.type === "boxdrops") {
    var dropsD = customElementById(action.id);
    if (dropsD) {
      if (val) dropsD.noDrop = true;
      else delete dropsD.noDrop;
      saveCustomElements(CUSTOM_ELEMENTS);
    }
    return;
  }
  if (action.type === "areaGap") {
    setAreaFlowProp(action.id, "gap", val);
    var gapEl = elByAnyId(action.id);
    if (gapEl && STYLE_MENU_ID && STYLE_MENU && STYLE_MENU.classList.contains("show") &&
        flowAreaForEl(styleMenuElById(STYLE_MENU_ID)) === gapEl) {
      primeStyleMenuTileGapRow(gapEl);
    }
    positionRing();
    return;
  }
  if (action.type === "locked") {
    toggleLocked(action.id);
    return;
  }
  /* one entry per session at the tooltip sub-editor, not per keystroke: both
     sides are the whole descriptor as json ("" for "there wasn't one"), since
     a tooltip is edited as one thing, see closeTooltipEditor() */
  if (action.type === "tooltip") {
    setTooltipDescriptor(action.id, val ? JSON.parse(val) : null);
    return;
  }
  if (action.type === "padding") {
    var padEl = elByAnyId(action.id);
    if (!padEl) return;
    padEl.style.padding = val || "";
    savePadding(action.id, val || "");
    if (TEXT_TOOLBAR_EL === padEl) primeTextToolbarPadding();
    positionRing();
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
    /* after every tile, not before: applyResizeSide() re-runs
       growFlowAreaForTiles() as it puts each one back, and that only ever grows
       the container - so the recorded height has to be the last word */
    if (action.area) setFlowAreaSavedSize(action.area.id, action.area[side]);
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
      applyTextAlignStyle(styleEl, val);
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
  if (action.type === "texttransform") {
    var ttEl = elByAnyId(action.id);
    if (!ttEl) return;
    applyTextTransformStyle(ttEl, val);
    saveTextStyle(action.id, "textTransform", val);
    if (TEXT_TOOLBAR_EL === ttEl) updateTextToolbarState();
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
      updateCapsToggleLock(fontEl);
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
  /* no id: the shared "Apply Now" url isn't keyed to an element, see
     setSharedJoinUrl() */
  if (action.type === "joinUrl") {
    applyJoinUrl(val || "");
    saveJoinUrl(val || "");
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
    /* no open control to sync back, unlike every color/size action around
       this one: the Current/Total selects live in the right-click menu (see
       renderCtxMenuProgressVars()), which is already closed by the time an
       undo can be triggered - it's rebuilt from the descriptor on every open */
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
  if (action.type === "hovercolor" || action.type === "activecolor") {
    var bscEl = styleMenuElById(action.id);
    if (!bscEl) return;
    var bscMapKey = action.type === "hovercolor" ? "hoverColor" : "activeColor";
    var bscSaveFn = action.type === "hovercolor" ? saveEditedHoverColor : saveEditedActiveColor;
    THEMED_OVERRIDE_MAPS[bscMapKey][action.id] = val || "";
    bscSaveFn(action.id, val || "");
    /* both states repaint either way: an unpicked click color follows the
       hover color, so undoing a hover pick has to take the press state back
       with it (see paintElementStateColor()) */
    paintElementStateColor(bscEl, "hover");
    paintElementStateColor(bscEl, "press");
    if (STYLE_MENU_ID === action.id) {
      var bscSel = action.type === "hovercolor" ? ".sm-hovercolor" : ".sm-activecolor";
      STYLE_MENU.querySelector(bscSel).value = val || currentColorValue(bscEl);
      if (action.type === "hovercolor") STYLE_HOVERCOLOR_BEFORE = val || "";
      else STYLE_ACTIVECOLOR_BEFORE = val || "";
    }
    return;
  }
  if (action.type === "darkhovercolor" || action.type === "darkactivecolor") {
    var dbscEl = styleMenuElById(action.id);
    if (!dbscEl) return;
    var dbscMapKey = action.type === "darkhovercolor" ? "darkHoverColor" : "darkActiveColor";
    var dbscLightMapKey = action.type === "darkhovercolor" ? "hoverColor" : "activeColor";
    var dbscSaveFn = action.type === "darkhovercolor" ? saveEditedDarkHoverColor : saveEditedDarkActiveColor;
    THEMED_OVERRIDE_MAPS[dbscMapKey][action.id] = val || "";
    dbscSaveFn(action.id, val || "");
    var dbscLv = THEMED_OVERRIDE_MAPS[dbscLightMapKey][action.id];
    paintElementStateColor(dbscEl, "hover");
    paintElementStateColor(dbscEl, "press");
    if (STYLE_MENU_ID === action.id) {
      var dbscSel = action.type === "darkhovercolor" ? ".sm-hovercolor-dark" : ".sm-activecolor-dark";
      var dbscBase = dbscLv || currentColorValue(dbscEl);
      STYLE_MENU.querySelector(dbscSel).value = val || autoDarkVariant(dbscBase);
      if (action.type === "darkhovercolor") STYLE_DARKHOVERCOLOR_BEFORE = val || "";
      else STYLE_DARKACTIVECOLOR_BEFORE = val || "";
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
  if (action.type === "navstate") {
    /* a real before/after value rather than a self-inverse flip, since this
       one has three states and "the other one" isn't defined */
    setCustomElementNavState(action.id, val);
    return;
  }
  if (action.type === "videoplayback") {
    var vpEl = elByAnyId(action.id);
    if (!vpEl) return;
    /* self-inverse like "shadow" above: either side of the action just flips
       whichever way the switch is currently sitting */
    var vpOn = !videoPlaybackOn(vpEl, action.key);
    setVideoPlaybackOption(vpEl, action.key, vpOn);
    saveEditedVideoPlayback(action.id, action.key, vpOn);
    return;
  }
  if (action.type === "flip_h" || action.type === "flip_v") {
    var flipEl = styleMenuElById(action.id);
    if (!flipEl) return;
    var dsKey = action.type === "flip_h" ? "flipH" : "flipV";
    var flipOn = flipEl.dataset[dsKey] !== "1";
    if (flipOn) flipEl.dataset[dsKey] = "1"; else delete flipEl.dataset[dsKey];
    paintPos(flipEl);
    saveEditedFlip(action.id, action.type, flipOn);
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(action.type === "flip_h" ? ".sm-flip-h" : ".sm-flip-v").classList.toggle("active", flipOn);
    }
    return;
  }
  if (action.type === "rotate") {
    var rotEl = styleMenuElById(action.id);
    if (!rotEl) return;
    var deg = parseInt(val, 10) || 0;
    if (deg) rotEl.dataset.rotate = deg; else delete rotEl.dataset.rotate;
    paintPos(rotEl);
    saveEditedRotate(action.id, deg);
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-rotate").value = deg;
      STYLE_MENU.querySelector(".sm-rotate-val").textContent = deg + "°";
      STYLE_ROTATE_BEFORE = String(deg);
    }
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
 * Persists one click-to-edit change into the preview snapshot, so it
 * round-trips through the same unsaved-draft mechanism as every other
 * in-progress portal edit.
 * @param id the element's data-edit-id
 * @param html the element's current innerHTML
 * @param defaultHtml the template's original innerHTML for that element
 * @note Logistics tile text goes straight into content.logistics, since that
 * array - not the template - is what those tiles render from, so an override
 * keyed by id would be read by nothing.
 * @note Everything else keeps using content.text, dropping the key entirely
 * once edited back to the default, so saved blobs carry no no-op overrides.
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
    var isOverride = html.trim() !== (defaultHtml || "").trim();
    if (!isOverride) delete snapshot.text[id];
    else snapshot.text[id] = html;
    markTextOverridden(id, isOverride);
  }

  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Keeps a field's data-overridden flag in step with whether it actually has a
 * saved override right now - the same stamp applyTextOverrides() makes once
 * per load, applied the moment an edit changes the answer.
 * @param id the field's data-edit-id
 * @param on whether a saved override now exists for it
 * @note It's what makes a ta's wording survive on the two elements that
 * rewrite their own text underneath them: a theme toggle's label, rewritten
 * on every flip, and the navbar's Dashboard link, rewritten per role.
 * @note Both already ask the flag and leave an overridden field alone - but
 * they were asking a flag last computed at page load, so wording typed DURING
 * the session read as "no override". Type your own words onto the toggle,
 * flip the theme, and they were gone until the next reload.
 * @note Stale the other way too: clear a field back to the template's wording
 * and the override is dropped, but the flag stayed at "1".
 * @note Applied to every element sharing the id, for the same reason their
 * text is mirrored: a mirrored field is the same field.
 */
function markTextOverridden(id, on) {
  document.querySelectorAll('[data-edit-id="' + id + '"]').forEach(function (el) {
    if (on) el.dataset.overridden = "1";
    else delete el.dataset.overridden;
  });
}

/**
 * Persists one flow container's axis locks (see toggleAreaFlowAxis()) into
 * the preview snapshot, same shape/draft as every other override here.
 * @param id the container's data-resize-id
 * @param flow {x, y}, each "lock" or "expand"
 */
function saveAreaFlow(id, flow) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.area_flow || typeof snapshot.area_flow !== "object") snapshot.area_flow = {};
  snapshot.area_flow[id] = flow;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a resize-handle drag into the preview snapshot, the same draft
 * saveEditedField() uses, so a resized element round-trips through
 * Apply/profiles exactly like an edited caption.
 * @param id the element's data-edit-id or data-resize-id
 * @param size the new size ({w, h}), or null to clear back to the default
 */
function saveEditedSize(id, size) {
  /* EDIT_SIZES is the live mirror of content.sizes applyTileFlow() reads a
     container's locked height and a tile's track size back out of, so it has
     to learn about a resize at the same moment the snapshot does. Leaving it
     stale is what snapped the tile containers back the instant a drag was let
     go: onUp committed the new height, then re-ran applyTileFlow(), which
     found the PREVIOUS height still in the map and pinned it straight back. */
  if (size == null) delete EDIT_SIZES[id];
  else EDIT_SIZES[id] = size;
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
 * Persists one whole-field text style property into the preview snapshot, the
 * same draft every other override uses.
 * @param id the element's data-edit-id
 * @param prop "fontFamily", "align", or "letterSpacing"
 * @param value the new css value, or "" to clear back to the default
 * @note Grouped per id under one object rather than three top-level maps,
 * since they're all "how this text field is styled" - unlike a resize or font
 * size, which already have dedicated maps.
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
 * Persists one element's padding into the preview snapshot.
 * @param id the element's data-edit-id or data-resize-id
 * @param value a css padding shorthand, or "" to clear back to the default
 * @note A map of its own rather than a fourth key under text_styles: padding
 * is box geometry, not typography - it applies to anything with edges.
 */
function savePadding(id, value) { saveEditedMapValue("padding", id, value); }

/**
 * Persists a font choice into the preview snapshot - as saveTextStyle(), but
 * carrying the font file's url alongside a ta-uploaded font's family name.
 * @param id the element's data-edit-id
 * @param family the css font-family name, or "" to clear back to the default
 * @param url the custom font's file url, or "" for a built-in
 * @note A built-in never needs a url, but a custom font's @font-face has to
 * be re-declared on every future load, including for a visitor who never
 * opens the portal - so the url travels with the saved style rather than
 * being looked up from the ta-only asset list at render time.
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
  /* `bw` is the width of the container this offset was measured inside, saved
     alongside it because tx alone doesn't say what it's a third of. It's the
     denominator responsiveFallbackFor() turns the frozen pixel back into a
     proportion with, and without it every drag would have to be assumed to
     have happened at the blob-wide AUTHORED_WIDTH - right for the ta who set
     that, wrong for every other window that has edited since. */
  else snapshot.positions[id] = { tx: tx, ty: ty, bw: responsivePosBaseWidth(id) };
  /* the same question one level up, for every override that ISN'T a position:
     a saved width or font size is equally a figure measured at one viewport,
     and the fallback needs a viewport to compare today's against */
  snapshot.authored_width = document.documentElement.clientWidth || window.innerWidth || 0;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * The width of the container one element's offsets are measured inside, for
 * saveEditedPosition() to record with the drag.
 * @param id the element's data-edit-id/data-resize-id
 * @return a width in css px, or 0 if the element isn't in the dom
 * @note Deliberately the same responsiveAxisEl() the resolver uses, so the
 * number written here and the number divided by later are the same
 * measurement of the same box.
 */
function responsivePosBaseWidth(id) {
  var el = elByAnyId(id);
  if (!el) return 0;
  var host = responsiveAxisEl(el, "auto");
  var w = host ? host.getBoundingClientRect().width : (document.documentElement.clientWidth || 0);
  return w > 0 ? Math.round(w) : 0;
}

/**
 * Persists a delete or restore into the preview snapshot. * @param id the element's data-edit-id or data-resize-id
 * @param hidden true to hide/delete it, false to restore it
 * @note Stored as a flat list of hidden ids rather than a per-id boolean map,
 * so an untouched blob's "hidden" key doesn't need to exist at all.
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
 * Persists a dark-mode colour override into the preview snapshot, the same
 * draft as saveEditedColor().
 * @param id the element's data-edit-id or data-resize-id
 * @param value a css colour string, or "" to clear back to the auto variant
 * @note "" falls back to the light colour's auto-computed variant rather than
 * to no colour at all, and is only meaningful on an id that already has a
 * light-mode colour saved.
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
 * Persists a textbox's background fill into the preview snapshot.
 * @param id the element's data-edit-id
 * @param value a css colour string, or "" to clear back to no fill
 * @note A separate map from content.colors, since a text field's "Color" row
 * already means its font colour; fill is its surface.
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
 * deleting the key entirely when cleared.
 * @param mapKey the snapshot's top-level key, eg "progress_fill"
 * @param id the element's data-resize-id
 * @param value any truthy value to store, or "" to delete the key
 * @note The shared body every saveEdited*() above hand-wrote per map,
 * factored out only for the newer progress-colour maps rather than
 * retrofitted onto the older ones.
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
 * Persists a Hover colour or Click colour pick into the preview snapshot.
 * @param id the button's data-edit-id
 * @param value a css colour string, or "" to clear back to the default
 *   shared hover/press darken effect
 * @note See applyStateColorOverrides() for why these paint as css custom
 * properties rather than a plain inline style.
 */
function saveEditedHoverColor(id, value) { saveEditedMapValue("hover_color", id, value); }

/**
 * Persists a dark-mode override for the row above, same idea as
 * saveEditedDarkColor() but for content.dark_hover_color.
 * @param id the button's data-edit-id
 * @param value a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkHoverColor(id, value) { saveEditedMapValue("dark_hover_color", id, value); }

/**
 * Persists a button's Click color pick, same idea as saveEditedHoverColor()
 * but for the pressed (:active) state.
 * @param id the button's data-edit-id
 * @param value a css color string, or "" to clear back to the default
 *   shared hover/press darken effect
 */
function saveEditedActiveColor(id, value) { saveEditedMapValue("active_color", id, value); }

/**
 * Persists a dark-mode override for the row above, same idea as
 * saveEditedDarkColor() but for content.dark_active_color.
 * @param id the button's data-edit-id
 * @param value a css color string, or "" to clear back to the auto variant
 */
function saveEditedDarkActiveColor(id, value) { saveEditedMapValue("dark_active_color", id, value); }

/**
 * Persists a button's text-colour change into the preview snapshot.
 * @param id the button's data-edit-id
 * @param value a css colour string, or "" to clear back to the default
 * @note A separate map from content.colors, since a button's "Color" row
 * already means its background; this is its label.
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
 * Persists a dark-mode border-colour override into content.dark_border, the
 * same draft as saveEditedBorder().
 * @param id the element's data-edit-id or data-resize-id
 * @param color a css colour string, or "" to clear back to the auto variant
 * @note Only ever stores {color}: border width isn't theme-dependent, so the
 * light side's own w always wins.
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
 * Persists one of a video's playback switches (see VIDEO_PLAYBACK_KEYS) into
 * the preview snapshot, same flat-list-of-ids shape as saveEditedShadow()
 * just above, one list per switch.
 * @param id the video's data-resize-id
 * @param key one of VIDEO_PLAYBACK_KEYS, which is also the content key
 * @param on true to add the video to that list, false to drop it
 */
function saveEditedVideoPlayback(id, key, on) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!Array.isArray(snapshot[key])) snapshot[key] = [];
  var vpIdx = snapshot[key].indexOf(id);
  if (on && vpIdx === -1) snapshot[key].push(id);
  else if (!on && vpIdx !== -1) snapshot[key].splice(vpIdx, 1);
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists the style popover's Flip horizontal/Flip vertical toggle into
 * the preview snapshot, same shape/reasoning as saveEditedShadow() just
 * above - a flat list of ids per axis.
 * @param id the element's data-edit-id or data-resize-id
 * @param key "flip_h" or "flip_v"
 * @param on true to add the flip, false to remove it
 */
function saveEditedFlip(id, key, on) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!Array.isArray(snapshot[key])) snapshot[key] = [];
  var idx = snapshot[key].indexOf(id);
  if (on && idx === -1) snapshot[key].push(id);
  else if (!on && idx !== -1) snapshot[key].splice(idx, 1);
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a rotation change from the style popover's Rotate slider, same
 * shape/reasoning as saveEditedRadius() - an id-keyed degrees map, cleared
 * back to the template default (0) rather than stored as an explicit 0.
 * @param id the element's data-edit-id or data-resize-id
 * @param deg a whole-number degrees value, 0 to clear
 */
function saveEditedRotate(id, deg) {
  var raw;
  try { raw = localStorage.getItem(snapshotKey()); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.rotate || typeof snapshot.rotate !== "object") snapshot.rotate = {};
  if (!deg) delete snapshot.rotate[id];
  else snapshot.rotate[id] = deg;
  try { localStorage.setItem(snapshotKey(), JSON.stringify(snapshot)); } catch (e) {}
}

/* ---------------------------------------------------------------------------
   THE LANDING PAGE'S TWO NAVBARS

   templates/index.html ships two complete <nav> elements, one for a signed-out
   visitor and one for someone already signed in, and exactly one is in the
   document at a time - so on the live site this is invisible.

   It used to be one nav that rewrote itself: the same button changed its own
   text and href on load, and a hidden Log out button was un-hidden beside it.
   That worked for a visitor and was unreachable for a ta - the editor previews
   the page as a stranger sees it, so the signed-in nav could never be looked
   at, let alone styled - and the self-rewriting button needed a special case
   to stop one state's saved override being applied in the other.

   Two real navbars with no shared ids fixes both: each state is an ordinary
   page edited with the ordinary tools, and the portal's Navbar switch is the
   only new concept. The cost, deliberately accepted, is that they really are
   separate - a wording change to one has to be made in the other too.
   --------------------------------------------------------------------------- */

/* which navbar is currently in the document flow: "out" (signed out) or "in"
   (signed in). Decided by the session on a real visit (applyNavSessionState()),
   and by hand in the visual editor, where a ta is always "signed out" as far as
   the preview is concerned. Editor-only view state, never saved: what a real
   visitor sees is decided by whether they're actually logged in, exactly like
   the login page's two failure strings. */
var NAV_STATE = "out";

/** @return true while the signed-in navbar is the one on show */
function navStateIsIn() { return NAV_STATE === "in"; }

/**
 * Shows the navbar for one state and takes the other out of the document,
 * along with any placed element belonging to a specific state - a placed Log
 * out button is meaningless on a signed-out page, so it follows its navbar.
 * @param state "out" or "in"
 * @note Toggles a class rather than writing an inline display, so it can't
 * fight the inline display a deleted element already carries: an element
 * that's both deleted and in the inactive state stays deleted when the state
 * comes back.
 * @note Also called from the portal across the iframe boundary on every
 * editor frame load, to put back the navbar its switch was left on, since a
 * reload here always starts signed out.
 */
function applyNavState(state) {
  NAV_STATE = state === "in" ? "in" : "out";
  document.querySelectorAll("[data-nav-state]").forEach(function (el) {
    setStateViewOff(el, "nav-state-off", el.getAttribute("data-nav-state") !== NAV_STATE);
  });
}

/**
 * Which session state(s) a placed nav button is shown in.
 * @param d the element's custom_elements entry
 * @return "out", "in" or "both"
 * @note The kind supplies the default, and for a button that stays in the
 * navbar that's the whole answer. What it couldn't express is the case this
 * was written for: an Access portal button dropped mid-page as a call to
 * action. Read as a navbar button it's signed-out-only and every logged-in
 * visitor loses it; read as page furniture it should just be there. Only the
 * ta knows which they meant, so d.navState records it.
 * @note Absent - every element placed before this existed - means the kind's
 * default, so nothing already on a page moves.
 */
function navStateForDescriptor(d) {
  if (!d) return "both";
  if (d.navState === "out" || d.navState === "in" || d.navState === "both") return d.navState;
  return d.kind === "navPortal" ? "out" : "in";
}

/**
 * Writes a placed nav button's "Shown to" choice: onto the descriptor so it
 * survives Apply, onto the live element, and then through applyNavState() so
 * the editor immediately shows what the current switch would show.
 * @param id the element's id
 * @param state "out", "in" or "both"
 */
function setCustomElementNavState(id, state) {
  var d = customElementById(id);
  var el = elByAnyId(id);
  if (!d) return;
  d.navState = state === "out" || state === "in" ? state : "both";
  if (el) {
    if (d.navState === "both") el.removeAttribute("data-nav-state");
    else el.setAttribute("data-nav-state", d.navState);
    /* an element leaving the marker set keeps whatever "off" class its last
       state left on it, and applyNavState() below won't visit it any more to
       take it back off - so clear it here, on the element AND on its wrap, the
       same pair setStateViewOff() works on */
    if (d.navState === "both") setStateViewOff(el, "nav-state-off", false);
  }
  saveCustomElements(CUSTOM_ELEMENTS);
  applyNavState(NAV_STATE);
}

/* the three "Shown to" states in the order one button steps through them, so
   every state is two clicks from every other one - "both" sits between the two
   exclusive ones because that's the useful middle, not because it's a default */
var NAV_STATE_CYCLE = ["out", "both", "in"];

/**
 * Steps a placed nav button through its three "Shown to" states. Undoable as a
 * plain before/after pair.
 * @param id the element's id
 */
function cycleCustomElementNavState(id) {
  var d = customElementById(id);
  if (!d) return;
  var from = navStateForDescriptor(d);
  var to = NAV_STATE_CYCLE[(NAV_STATE_CYCLE.indexOf(from) + 1) % NAV_STATE_CYCLE.length];
  setCustomElementNavState(id, to);
  EDIT_UNDO.push({ type: "navstate", id: id, before: from, after: to });
  EDIT_REDO.length = 0;
}

/**
 * Takes one half of a two-state page out of the document, or puts it back -
 * the one primitive behind applyNavState() and applyDashView().
 * @param el the element carrying the state marker
 * @param cls the state's own "off" class (see STATE_VIEW_OFF_CLASSES)
 * @param off true to take it out of the document, false to put it back
 * @note Follows the element out of flow if a ta has moved it: once detached
 * it's the .free-wrap that holds its place, so hiding the element alone would
 * leave that wrap behind as an empty gap the size of what just left. The
 * class comes off both before anything is added back, so the pair can't end
 * up half-hidden when a detach happens between two passes.
 */
function setStateViewOff(el, cls, off) {
  var parent = el.parentNode;
  var wrap = parent && parent.classList && parent.classList.contains("free-wrap") ? parent : null;
  el.classList.remove(cls);
  if (wrap) wrap.classList.remove(cls);
  if (off) (wrap || el).classList.add(cls);
}

/* every class that takes one state's markup right out of the document while
   its counterpart is on show: the landing page's two navbars, and the student
   dashboard's gate/app pair (see applyDashView()) */
var STATE_VIEW_OFF_CLASSES = ["nav-state-off", "dash-view-off"];

/* true only while withStateViewsLaidOut() has both sides of a two-state page
   in the document at once, and true again once an anchor pass has been asked
   for during that window - see applyElementAnchors() for what the pair is for */
var STATE_VIEWS_LAID_OUT = false;
var ANCHOR_PASS_PENDING = false;

/**
 * Runs fn with BOTH sides of every two-state page in the document, then puts
 * the inactive ones back.
 * @param fn the work to run
 * @note The override pipeline measures elements as it applies saved geometry,
 * and an element inside a display:none navbar measures zero - so a size saved
 * in one state would come back as a 0x0 box on any load starting in the
 * other. Laying both out costs nothing visually: this is one synchronous
 * block, so the browser never paints the both-at-once state.
 * @note What it does cost is that the extra half is REAL flow while it's in
 * there, pushing everything below it down. Every measurement the pipeline
 * takes is a width or a height, which that shift doesn't touch; the one pass
 * that reads document COORDINATES is applyElementAnchors(), so it sits out
 * this window and runs once at the end against the real layout.
 */
function withStateViewsLaidOut(fn) {
  var off = [];
  STATE_VIEW_OFF_CLASSES.forEach(function (cls) {
    document.querySelectorAll("." + cls).forEach(function (el) {
      off.push({ el: el, cls: cls });
      el.classList.remove(cls);
    });
  });
  STATE_VIEWS_LAID_OUT = true;
  try {
    fn();
  } finally {
    STATE_VIEWS_LAID_OUT = false;
    off.forEach(function (o) { o.el.classList.add(o.cls); });
    if (ANCHOR_PASS_PENDING) {
      ANCHOR_PASS_PENDING = false;
      applyElementAnchors();
    }
  }
}

/**
 * Flips which navbar the visual editor is showing (and therefore editing).
 * Driven from the Navbar switch beside the portal's page tabs, which reaches in
 * here across the iframe boundary (js/ta.js's toggleEditorNavState()) the same
 * way its Undo/Redo buttons reach in for ClickEditHistory. Landing page only.
 */
function toggleNavState() {
  applyNavState(navStateIsIn() ? "out" : "in");
  /* the selection can't stay parked on something that just left the page */
  if (RING_EL && RING_EL.closest && RING_EL.closest(".nav-state-off")) {
    RING_EL = null;
    RING.style.display = "none";
  }
  positionRing();
  /* the page just got 0px taller or shorter (the two navbars are the same
     height), but an anchored element re-pins for free and it costs nothing to
     be right if a ta has resized one of the navbars */
  applyElementAnchors();
}

/**
 * Picks the navbar this visit should see, and fills in the signed-in one's
 * role-dependent details. Called once on DOMContentLoaded (so the right nav is
 * up before the content fetch resolves) and again after every override pass,
 * since a placed nav button only exists after renderCustomElements() has run.
 */
function applyNavSessionState() {
  if (!document.querySelector("[data-nav-state]")) return;
  if (isPreviewMode()) {
    /* previewing isn't a real visit: don't let a nav button, the brand logo,
       or "See more in the gallery" wander the ta off into another page while
       they're just checking their edits (the gallery gets its own preview tab,
       separate from the landing page, see js/preview.js). The navbar on show
       stays whatever the editor's own toggle last chose. */
    document.querySelectorAll("[data-nav-el]").forEach(function (el) { neuterLink(el, false); });
    document.querySelectorAll(".brand").forEach(function (el) { neuterLink(el, false); });
    neuterLink(document.getElementById("galleryLink"));
    applyNavState(NAV_STATE);
    return;
  }
  var session = localStorage.getItem("session");
  var role = localStorage.getItem("role");
  applyNavState(session && role ? "in" : "out");
  if (!session || !role) return;
  document.querySelectorAll('[data-nav-el="dashboard"]').forEach(function (el) {
    el.setAttribute("href", role === "ta" ? "instructor.html" : "dashboard.html");
    /* "Dashboard" is only the default wording - a ta who typed their own
       stays typed. data-overridden is applyTextOverrides()' own record of
       whether a saved override exists, the same signal refreshThemeToggles()
       uses to decide whether a theme button's label is still its to write. */
    if (el.dataset.overridden !== "1") {
      el.textContent = role === "ta" ? "Staff Portal" : "Dashboard";
    }
  });
}

/* ---------------------------------------------------------------------------
   THE STUDENT DASHBOARD'S TWO PAGES

   templates/dashboard.html carries two pages, exactly one ever in the
   document: the dashboard itself and the locked-out page a visitor with no
   session gets. On a real visit gateCheck() picks; in the editor the ta always
   has a session, so the gate could never be looked at, let alone styled - the
   same dead end the signed-in navbar was in, fixed the same way, with a switch
   beside the portal's page tabs.

   Both halves are ordinary tagged markup, so the gate's badge, heading and
   button are click-to-edit like anything else. Placed elements are split too,
   by the half that was on show when they were placed - they have to be, since
   the dashboard's own progress bar and tile areas ARE placed elements and
   would otherwise float over the locked-out page.
   --------------------------------------------------------------------------- */

/* which half of the dashboard is in the document flow: "app" or "gate".
   Decided by the session on a real visit (gateCheck()), and by hand in the
   visual editor. Editor-only view state, never saved: what a real student
   sees is decided by whether they're actually logged in. */
var DASH_VIEW = "app";

/**
 * Shows one half of the dashboard page and takes the other out of the
 * document.
 * @param view "app" or "gate"
 * @note Toggles a class rather than an inline display, for the same reason
 * applyNavState() does: it can't then be silently undone by the inline
 * display a deleted element already carries.
 * @note Also called from the portal across the iframe boundary on every
 * editor frame load, to put back the view its switch was left on - a reload
 * here always starts on the dashboard.
 */
function applyDashView(view) {
  DASH_VIEW = view === "gate" ? "gate" : "app";
  document.querySelectorAll("[data-dash-view]").forEach(function (el) {
    setStateViewOff(el, "dash-view-off", el.getAttribute("data-dash-view") !== DASH_VIEW);
  });
}

/** @return the dashboard half the page is currently showing, "app" or "gate" */
function dashView() { return DASH_VIEW; }

/**
 * Picks the half of the dashboard this visit should see - the session's job
 * on a real visit, the editor's switch in the portal - exactly as
 * applyNavSessionState() picks the navbar. A no-op on every other page.
 * @note Called from the same two places for the same reasons: once on
 * DOMContentLoaded so the right half is up before the fetch resolves, and
 * again after every override pass, since a placed element only carries its
 * data-dash-view marker once renderCustomElements() has rebuilt it.
 */
function applyDashSessionState() {
  if (!document.querySelector("[data-dash-view]")) return;
  if (isPreviewMode()) {
    /* previewing isn't a real visit, and a ta is signed in on every one of
       them - leaving the session to decide here would make the locked-out
       page unreachable in the editor. What's on show stays whatever the
       portal's own Page switch last chose (js/ta.js's toggleEditorDashView()),
       same as the navbar switch one function up. */
    applyDashView(DASH_VIEW);
    return;
  }
  applyDashView(localStorage.getItem("session") ? "app" : "gate");
}

/**
 * Flips which half of the dashboard the editor is showing, driven from the
 * Page switch beside the portal's tabs - the dashboard's exact counterpart to
 * toggleNavState(), down to the selection and re-anchor handling.
 * @note The two halves are wildly different heights, so anything pinned to an
 * in-flow spacer has to re-pin here or it lands on top of the gate.
 */
function toggleDashView() {
  applyDashView(DASH_VIEW === "gate" ? "app" : "gate");
  /* the selection can't stay parked on something that just left the page */
  if (RING_EL && RING_EL.closest && RING_EL.closest(".dash-view-off")) {
    RING_EL = null;
    RING.style.display = "none";
  }
  positionRing();
  applyElementAnchors();
}

/* ---------------------------------------------------------------------------
   THE LOGIN PAGE'S TIMED-OUT VIEW

   The login page has two states a visitor can arrive in: the ordinary one, and
   the one they get bounced to when idle.js signs them out mid-session
   (?expired=1, see refreshLoginPage() in js/login.js). The only difference
   between them is which of the failure line's two strings is showing - the
   line carries both as separately editable fields rather than one js/login.js
   rewrites at runtime, so a ta who reworded the failure doesn't find their
   wording silently replaced on an expired bounce.

   That second string was the one piece of the page nobody could look at
   properly: it's shown by a state the editor never enters, so reaching it
   meant knowing about a right-click entry on one specific element. Now it's a
   switch beside the portal's page tabs, next to the two that solve the same
   problem for the landing page's signed-in navbar and the dashboard's
   locked-out half - the third instance of "one page, two states, only one of
   them reachable while editing".

   Page-wide rather than per element, which is what the old right-click entry
   was: the switch says which state the ta is looking at, so every failure line
   on the page answers to it, and the "Add element" menu names what it would
   place accordingly. View state, never saved - what a real visitor sees is
   decided by what actually happened to them.
   --------------------------------------------------------------------------- */

/* which state the login page is being looked at in: "normal" or "expired" */
var LOGIN_VIEW = "normal";

/** @return true while the timed-out wording is the one on show */
function loginViewIsExpired() { return LOGIN_VIEW === "expired"; }

/**
 * Shows one of the failure line's two strings on every failure line on the
 * page.
 * @param view "normal" or "expired"
 * @note A class rather than an inline display, for the reason applyNavState()
 * gives: it can't then be undone by the inline display a hidden element
 * already carries. Its whole effect lives under body.edit-mode (see
 * css/style.css), so this is inert on a real visit - which is why it can be
 * re-asserted unconditionally after every override pass.
 * @note Also called from the portal across the iframe boundary on every editor
 * frame load, to put back the state its switch was left on: a reload here
 * always starts in the ordinary one.
 */
function applyLoginView(view) {
  LOGIN_VIEW = view === "expired" ? "expired" : "normal";
  document.querySelectorAll('[data-login-el="error"]').forEach(function (el) {
    el.classList.toggle("edit-show-expired", LOGIN_VIEW === "expired");
  });
}

/**
 * Flips which of the two states the editor is showing, driven from the State
 * switch beside the portal's tabs or from the failure line's own right-click
 * entry - the login page's counterpart to toggleNavState()/toggleDashView().
 * @note The two strings are different lengths, so the line can wrap to a
 * different height and anything anchored below it has to re-pin - the same
 * reason its siblings re-anchor, at a much smaller scale.
 */
function toggleLoginView() {
  applyLoginView(loginViewIsExpired() ? "normal" : "expired");
  positionRing();
  applyElementAnchors();
  /* the portal's State switch is this same control by another route, and
     nothing else tells it a flip happened in here - same reason setSnapping()
     calls back out to syncSnapSwitch() */
  try {
    if (window.parent !== window && window.parent.noteEditorLoginView) {
      window.parent.noteEditorLoginView(LOGIN_VIEW);
    }
  } catch (e) {}
}

/* an inline edit isn't committed until the field blurs (the "blur" handler in
   the click-to-edit wiring above, which packs the chips back up and writes the
   snapshot) - so a ta timed out mid-sentence used to lose that sentence, even
   though every finished edit around it was already safe. Blurring here runs
   that handler normally, exactly as clicking away would. Registered on every
   page carrying this file: idle.js's flushAutosaves() reaches into the
   editor's iframe, and this is the work living in there. */
(window.IdleSaveHooks = window.IdleSaveHooks || []).push(function () {
  var el = document.activeElement;
  if (el && el.isContentEditable && el.blur) el.blur();
});

/**
 * Wires the three nav buttons' actual behaviour, delegated off document and
 * keyed on data-nav-el rather than an id or href - so a button placed from
 * the right-click menu works the instant it lands, with no re-wiring.
 * @note Only Log out needs a handler at all: Access portal and Dashboard are
 * real links with real hrefs, which is what makes ctrl-click and the status
 * bar work.
 */
function wireNavButtons() {
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-nav-el]");
    if (!el) return;
    if (isPreviewMode()) { e.preventDefault(); return; }
    if (el.getAttribute("data-nav-el") !== "logout") return;
    e.preventDefault();
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("last_active");
    /* straight back to the signed-out navbar, no reload: same page, same
       scroll position, just no longer signed in */
    applyNavSessionState();
  });
}
wireNavButtons();

/**
 * The shared tail of a real page's content load: every generic apply pass
 * plus the edit-mode-gated wiring, factored out so each page's
 * DOMContentLoaded handler runs the same pipeline rather than copies that
 * could quietly drift apart.
 * @param data the fetched content dict
 * @param textMap click-to-edit overrides to apply, defaults to data.text -
 *   index.html passes its own merged copy, and the others just let this
 *   default
 * @note Landing-page-only concerns (hero countdown, logistics, home images,
 * join url) stay in that page's own handler, called before this.
 */
function applySharedEditorOverrides(data, textMap) {
  /* every pass below that applies saved geometry measures the element it's
     applying to, and a two-state page keeps one of its two states out of the
     document (the landing page's spare navbar, the dashboard's spare half) -
     so the whole pipeline runs with both laid out and the inactive one is put
     back at the end, see withStateViewsLaidOut(). A no-op on the other pages. */
  withStateViewsLaidOut(function () { applySharedOverridePasses(data, textMap); });
  applyNavSessionState();
  applyDashSessionState();
  /* and the third two-state page, whose failure lines were just rebuilt by
     renderCustomElements() and came back showing the ordinary wording no
     matter which state the portal's State switch is on */
  applyLoginView(LOGIN_VIEW);
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
 * Every apply*Overrides() pass, in the order they have to run in. Split out of
 * applySharedEditorOverrides() only so the whole run can be wrapped, see
 * withStateViewsLaidOut(); nothing else should call this directly.
 * @param data see applySharedEditorOverrides()
 * @param textMap see applySharedEditorOverrides()
 */
function applySharedOverridePasses(data, textMap) {
  renderCustomElements(data.custom_elements);
  renderDuplicates(data.duplicates);
  applyTextOverrides(textMap !== undefined ? textMap : (data.text || {}));
  repaintInlineTextColors();
  applyThemeIconOverrides(data.theme_icons);
  if (window.refreshThemeToggles) window.refreshThemeToggles();
  /* a first anchor pass BEFORE the size/position sweeps as well as the real
     one at the end. Those sweeps are what detach elements from flow, and
     detachFromFlow() freezes an element at the width it measures right then -
     while an anchored element is still at its hand-measured seed width, since
     widening it to the column it anchors into is exactly what this pass does.
     That's how the login page's password box came out 300px wide inside a
     350px field, on the live page as much as in the editor. Idempotent and
     cheap, and the closing pass still has the last word. */
  applyElementAnchors();
  applySizeOverrides(data.sizes);
  applyFontSizeOverrides(data.font_sizes);
  applyTextStyleOverrides(data.text_styles);
  applyPaddingOverrides(data.padding);
  applyPositionOverrides(data.positions);
  applyColorOverrides(data.colors, data.dark_colors);
  applyFillOverrides(data.fill, data.dark_fill);
  applyTextColorOverrides(data.text_color, data.dark_text_color);
  applyStateColorOverrides(data.hover_color, data.dark_hover_color, data.active_color, data.dark_active_color);
  applyTintOverrides(data.tint);
  applyShadeOverrides(data.shade);
  applyVideoPlaybackOverrides(data.video_no_autoplay, data.video_controls, data.video_pausable);
  applyRadiusOverrides(data.radius);
  applyBorderOverrides(data.border, data.dark_border);
  VARIABLES = data.variables || [];
  /* before the renderExtras/renderDays hooks below, which build the tiles
     these containers lay out - see applyTileFlow() */
  applyAreaFlowOverrides(data.area_flow);
  applyTileChildrenOverrides(data.tile_children);
  applyProgressBindings(data.progress_fill, data.dark_progress_fill, data.progress_track, data.dark_progress_track);
  repaintFormulaChips();
  applyShadowOverrides(data.shadow);
  applyOpacityOverrides(data.opacity);
  applyFlipRotateOverrides(data.flip_h, data.flip_v, data.rotate);
  applyTooltipOverrides(data.tooltips);
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
  /* same cross-script hook for the gallery page's directory rail and image
     panes (see buildCustomElementNode()'s "galleryDirArea"/"galleryPane"
     kinds): js/gallery.js owns which directories exist, which image each pane
     is on, and what the two page variables therefore read - and only this pass
     knows when those elements actually exist in the dom */
  if (window.renderGallery) window.renderGallery();
  /* the tiles only exist once the hooks above have run, so the earlier
     applyLayerOrder() swept a dom containing none of them and every piece of
     every tile came out with no rank - just the stylesheet's no-js defaults.
     Sending a tile's lock icon behind its rect therefore held only until the
     next pass rebuilt the tiles and threw the assigned z-index away with
     them, which in the portal is the very next edit. Re-run over the finished
     dom: it's idempotent, and the order is the one already reconciled. */
  applyLayerOrder(LAYER_ORDER);
  applyFixedHighlight();
  /* same cross-script hook, for the login page's own four placed elements
     (see buildCustomElementNode()'s "loginField"/"loginButton"/"loginError"
     kinds): js/login.js owns their live behaviour - placeholder visibility,
     which error string is showing - and only this pass knows when they
     actually exist in the dom */
  if (window.refreshLoginPage) window.refreshLoginPage();
  /* after every hook above, since a seated member can be a custom element, a
     tile role or a piece of template markup and none of them are all in the dom
     until here - and before the responsive pass below, which measures a seated
     element against the box it has just been put into. See applyBoxMembers(). */
  applyBoxMembers(data.box_members);
  /* dead last, over finished geometry. Everything above writes an element's
     authored box and offset; this reads those and composes today's width on
     top of them, so it has to see the final answer rather than an
     intermediate one - and it's also the only pass here that has to keep
     running long after the load, on every resize (see the RESPONSIVE
     BEHAVIOUR section). The hooks above build the day/extras/gallery tiles,
     which is why the host observer is re-armed after them and not before. */
  applyResponsiveOverrides(data.responsive, data.responsive_waivers, data.authored_width);
  if (window.observeResponsiveHosts) window.observeResponsiveHosts();
}

/**
 * Boots the shared visual-editor engine on the student dashboard, identified
 * by its #dashProgressAnchor spacer.
 * @note Unlike the landing page there's no hardcoded countdown or hero markup
 * to hydrate: the days and extras lists stay js/dashboard.js's own separate
 * rendering, untouched by this file. This only wires the generic override
 * pipeline every placed element needs - the progress bar, plus the nav and
 * footer chrome it shares with index.html.
 * @note Gated into edit affordances the same isPreviewMode() && isEditMode()
 * way every page is, so a real student never sees drag handles.
 */
function initDashboardPage() {
  /* the page ships with BOTH halves out of the document and dashboard.js's
     own handler normally puts one back, but it isn't guaranteed to run before
     this fetch resolves - so pick a half here too, or applyElementAnchors()
     measures the spacers with nothing laid out at all and pins the progress
     and tile areas to 0,0 with nothing to re-run the pass. Safe to call
     twice: gateCheck() is idempotent. */
  if (window.gateCheck) window.gateCheck();
  fetchContent()
    .then(function (data) {
      /* same legacy contact_text fallback index.html's own DOMContentLoaded
         handler applies - see applySharedEditorOverrides()'s doc comment -
         so an old blob saved before the footer became click-to-edit shows
         its real contact line here too, not the template's hardcoded
         default, now that the footer (a shared "footer.contact" id) also
         renders on this page. */
      var textMap = data.text ? Object.assign({}, data.text) : {};
      if (textMap["footer.contact"] === undefined && data.contact_text) {
        textMap["footer.contact"] = data.contact_text;
      }
      applySharedEditorOverrides(data, textMap);
    })
    .catch(function () {});
}

/**
 * Boots the shared visual-editor engine on the login page, identified by its
 * #loginCard auth card.
 * @note Nothing to hydrate beyond the generic pipeline: the form is four
 * ordinary placed elements which renderCustomElements() builds like any
 * other, and everything around them is plain click-to-edit template markup.
 * js/login.js wires the real behaviour on top, off the same hook.
 * @note Gated into edit affordances the same way every page is, so a real
 * visitor never sees a drag handle - and js/login.js refuses to post
 * credentials at all inside the portal's preview iframe.
 */
function initLoginPage() {
  fetchContent()
    .then(function (data) { applySharedEditorOverrides(data); })
    .catch(function () {
      /* the content api being unreachable must not take the login page down
         with it: every other page degrades to its own hardcoded template
         copy here, but this page's form IS content now, so js/login.js puts
         a plain unstyled one up instead of leaving an empty card. Only on
         this path - a ta who deliberately deleted a field on a working site
         is making a real choice, and this must never undo it. */
      if (window.buildLoginFallback) window.buildLoginFallback();
    });
}

/**
 * Boots the shared visual-editor engine on the gallery page, identified by
 * its #galleryDirsAnchor spacer.
 * @note Nothing to hydrate beyond the generic pipeline: the viewer is five
 * ordinary placed elements, and everything around them is plain
 * click-to-edit template markup. js/gallery.js wires the real behaviour on
 * top, off the same window.renderGallery hook.
 * @note Gated into edit affordances the same way every page is, so a real
 * visitor flipping through photos never sees a drag handle.
 */
function initGalleryPage() {
  fetchContent()
    .then(function (data) { applySharedEditorOverrides(data); })
    .catch(function () {
      /* the content api being unreachable must not take the gallery down with
         it: js/gallery.js falls back to its own hardcoded directory list, but
         it needs the placed elements to render into first, so the seeded
         viewer is rebuilt from this file's own copy of them */
      if (window.buildGalleryFallback) window.buildGalleryFallback();
    });
}

/**
 * Boots the shared visual-editor engine on the not-found page, identified by
 * its #notFoundAnchor spacer.
 * @note Nothing to hydrate beyond the generic pipeline: the whole page is
 * plain click-to-edit template markup plus whatever a ta has placed on it.
 * @note Gated into edit affordances the same way every page is, so a visitor
 * who mistyped a url gets the page and no drag handles. Worth having at all
 * because this is the one page nobody arrives at on purpose: whatever it says
 * is the site's answer to someone already lost, and a ta should write it.
 */
function initNotFoundPage() {
  fetchContent()
    .then(function (data) { applySharedEditorOverrides(data); })
    .catch(function () {
      /* the content api being unreachable must not take this page down too -
         it's the page most likely to be reached WHILE something is broken.
         The template's own copy is already on screen and says the right
         thing, so there's nothing to rebuild, unlike the login page's form
         or the gallery's viewer: just leave it standing. */
      applyTextOverrides({});
    });
}

/**
 * Boots the reusable-object mini editor's blank canvas.
 * @note No landing-page markup to render, so this skips straight to the same
 * generic apply and wire pass index.html runs, just against the object
 * canvas's own scene rather than the real page's content.
 * @note Always wired as if &edit=1 were set, unlike index.html's own gate: an
 * object canvas only ever exists to be edited, with no "look-only" mode the
 * way a page preview has.
 */
function initObjectCanvas() {
  /* the canvas scene and the site's own variables come from two different
     places (localStorage vs /api/content, see fetchObjectContent() and the
     VARIABLES note below), so both are awaited together before anything is
     painted - applyProgressBindings() below reads VARIABLES for every bar's
     fill ratio, and a second later-resolving fetch would leave them all at 0 */
  Promise.all([
    fetchObjectContent(),
    fetchContent().then(function (site) { return site.variables || []; }, function () { return []; })
  ]).then(function (loaded) {
    var data = loaded[0];
    var siteVars = loaded[1];
    renderCustomElements(data.custom_elements);
    renderDuplicates(data.duplicates);
    applyTextOverrides(data.text || {});
    repaintInlineTextColors();
    applyThemeIconOverrides(data.theme_icons);
    if (window.refreshThemeToggles) window.refreshThemeToggles();
    applySizeOverrides(data.sizes);
    applyFontSizeOverrides(data.font_sizes);
    applyTextStyleOverrides(data.text_styles);
    applyPaddingOverrides(data.padding);
    applyPositionOverrides(data.positions);
    applyColorOverrides(data.colors, data.dark_colors);
    applyFillOverrides(data.fill, data.dark_fill);
    applyTextColorOverrides(data.text_color, data.dark_text_color);
    applyStateColorOverrides(data.hover_color, data.dark_hover_color, data.active_color, data.dark_active_color);
    applyTintOverrides(data.tint);
    applyShadeOverrides(data.shade);
    applyVideoPlaybackOverrides(data.video_no_autoplay, data.video_controls, data.video_pausable);
    applyRadiusOverrides(data.radius);
    applyBorderOverrides(data.border, data.dark_border);
    /* the one thing an object canvas does NOT read out of its own scene:
       variables are global site content (the content manager's Variables
       section), not something an object carries around with it, and the
       "object_content" scene has no variables key at all - so a progress bar
       placed on a canvas used to find an empty VARIABLES and offer nothing to
       bind to at all. Pulled from the real content blob instead, so every bar
       on every editor surface picks from the same list. */
    VARIABLES = siteVars;
    applyProgressBindings(data.progress_fill, data.dark_progress_fill, data.progress_track, data.dark_progress_track);
    repaintFormulaChips();
    applyShadowOverrides(data.shadow);
    applyOpacityOverrides(data.opacity);
    applyFlipRotateOverrides(data.flip_h, data.flip_v, data.rotate);
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
    /* an object's scene carries its own seating, same as the page blob does */
    applyBoxMembers(data.box_members);
    wireResizable();
    wireClickToEdit();
    wireAddElementMenu();
  });
}

document.addEventListener("DOMContentLoaded", function () {
  /* ahead of every return below (the object canvas has clips on it too), and
     without waiting on the content fetch: the videos already in the markup
     can be hovered the moment the page paints, which is all firefox needs to
     put its pip toggle up over one */
  wireNativeVideoMenu();

  /* the object mini editor first has to resolve which saved object this
     session is editing and stash its data into localStorage before the canvas
     can render it - an async server round trip, so initObjectCanvas() isn't
     safe to call yet and would race that fetch. object-editor.js calls it
     itself once that's settled. */
  if (isObjectMode()) return;

  /* before the content fetch resolves, so the right navbar is up on the first
     paint rather than the page visibly swapping one for the other. Runs again
     at the end of every override pass, once any placed nav button exists. */
  applyNavSessionState();

  var slot = document.getElementById("heroCountdown");
  var grid = document.getElementById("logisticsGrid");
  if (!slot) {
    /* not the landing page - the other four this engine is wired onto are the
       dashboard, the login page, the gallery and the not-found page, each
       recognised by its own marker below.

       Every page this file can edit needs a line here: one whose marker isn't
       listed still renders, since its markup and theme.js don't depend on any
       of this, but it never gets a content fetch - so no saved text, no placed
       elements, and no editor at all inside the portal's iframe. That's
       exactly what 404.html did until this line was added. */
    if (document.getElementById("dashProgressAnchor")) initDashboardPage();
    else if (document.getElementById("loginCard")) initLoginPage();
    else if (document.getElementById("galleryDirsAnchor")) initGalleryPage();
    else if (document.getElementById("notFoundAnchor")) initNotFoundPage();
    return;
  }

  function renderTiles(list) {
    if (!grid) return;
    grid.innerHTML = "";
    list.forEach(function (t, i) { grid.appendChild(logisticsTile(t, i)); });
  }

  function setJoinUrl(url) {
    applyJoinUrl(url);
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
      applyTextOverrides({});
      if (window.initAllReels) window.initAllReels();
    });
});
