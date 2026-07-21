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
      var raw = localStorage.getItem("preview_content");
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
 * @param textMap {id: overrideHtml}, from content.text
 */
function applyTextOverrides(textMap) {
  var skipPortalLink = !isPreviewMode() && localStorage.getItem("session") && localStorage.getItem("role");
  document.querySelectorAll("[data-edit-id]").forEach(function (el) {
    if (skipPortalLink && el.id === "portalLink") return;
    el.setAttribute("data-default-html", el.innerHTML);
    var id = el.getAttribute("data-edit-id");
    if (textMap && textMap[id] !== undefined) el.innerHTML = textMap[id];
  });
}

/* every element that can be resized/moved in the visual editor: text
   fields (data-edit-id) and every other tagged box - images, icons, cards,
   nav, sections, footer, buttons, day rows, tiles (data-resize-id). */
var RESIZABLE_SEL = "[data-edit-id], [data-resize-id]";

/**
 * Reads an element's current resize/move state (scale + translate) off its
 * own dataset, defaulting to the identity transform the first time. Kept on
 * the element itself (not a separate map) so it survives being wrapped and
 * is easy to inspect in devtools.
 * @param el the element
 * @return {tx, ty, sx, sy}
 */
function getXf(el) {
  return {
    tx: parseFloat(el.dataset.xfTx) || 0,
    ty: parseFloat(el.dataset.xfTy) || 0,
    sx: parseFloat(el.dataset.xfSx) || 1,
    sy: parseFloat(el.dataset.xfSy) || 1
  };
}

/**
 * Reads an element's saved explicit box size, if any (see setBoxWH()): a
 * text field resizes its own width only (font stays whatever the A-/A+
 * buttons set, text just reflows inside), an image resizes both width and
 * height directly, off the element's own dataset.
 * @param el the element
 * @return {w, h}, either undefined when there's no override (natural/auto)
 */
function getBoxWH(el) {
  return {
    w: el.dataset.xfW !== undefined ? parseFloat(el.dataset.xfW) : undefined,
    h: el.dataset.xfH !== undefined ? parseFloat(el.dataset.xfH) : undefined
  };
}

/**
 * Elevates el's paint order above its untouched siblings once any
 * resize/move override is active (a transform, or an explicit box size),
 * matching what a ta dragging it would expect to see ("the thing I just
 * touched is on top"): a transform/size change alone doesn't change
 * stacking order, so a resized/moved element would otherwise get visually
 * clipped by (and lose clicks to) whatever normally comes after it in the
 * DOM the moment it grows or moves into that element's space. Only
 * touches `position` if el doesn't already have one of its own (eg. the
 * sticky nav): z-index has no effect without a position, but forcing one
 * would stomp on it. Reverts once every override is back to the template
 * default.
 * @param el the element
 */
function syncStacking(el) {
  var xf = getXf(el);
  var wh = getBoxWH(el);
  var isDefault = xf.tx === 0 && xf.ty === 0 && xf.sx === 1 && xf.sy === 1 &&
    wh.w === undefined && wh.h === undefined;
  if (isDefault) {
    el.style.zIndex = "";
  } else {
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.style.zIndex = "9999";
  }
}

/**
 * Writes a resize/move state onto an element as a single `transform`
 * (translate for position, scale for size), with `transform-origin: top
 * left` so scaling grows away from the dragged corner instead of from the
 * center. A transform is purely a paint-time effect: it never changes the
 * element's box for layout purposes, so it can never push, shrink, or
 * otherwise affect any other element on the page, unlike changing width/
 * height/left/top directly would. It also means the browser's own hit
 * testing (clicks, hover) automatically follows el's scaled/moved box
 * rather than its original one - almost for free, see syncStacking() for
 * the one thing that isn't free (paint order).
 * Also repositions el's own resize/move grips (see positionGrips()), if
 * it has any: they're anchored to el's wrap, a plain sibling that doesn't
 * share el's transform, so without this they'd stay behind at el's
 * pre-transform corner instead of tracking where it visually is now.
 * @param el the element
 * @param tx horizontal offset in css px
 * @param ty vertical offset in css px
 * @param sx horizontal scale factor (1 = original size)
 * @param sy vertical scale factor (1 = original size)
 */
function setXf(el, tx, ty, sx, sy) {
  sx = Math.max(.2, Math.min(6, sx));
  sy = Math.max(.2, Math.min(6, sy));
  el.dataset.xfTx = tx;
  el.dataset.xfTy = ty;
  el.dataset.xfSx = sx;
  el.dataset.xfSy = sy;
  el.style.transformOrigin = "top left";
  el.style.transform = "translate(" + tx + "px, " + ty + "px) scale(" + sx + ", " + sy + ")";
  syncStacking(el);
  var wrap = el.parentNode;
  if (wrap && wrap.classList && wrap.classList.contains("resize-wrap")) positionGrips(el, wrap);
}

/**
 * Writes an explicit width (text fields) or width+height (images) onto an
 * element as real box dimensions, not a transform. A ta reported that
 * scaling a text field's box via `scale()` visually stretched the letters
 * themselves; this instead resizes the box only; the font stays whatever
 * size it already was (see the A-/A+ controls) and the text just reflows
 * inside the new width. For an image, both dimensions are settable
 * independently and `object-fit: contain` plus a black background take
 * over from the page's own default `cover` sizing, so a box resized to a
 * different aspect ratio than the photo itself shows letterbox bars
 * instead of stretching or cropping it.
 * @param el the element
 * @param w new width in css px, or null to clear back to the template default
 * @param h new height in css px (images only), or null/undefined to leave auto
 */
function setBoxWH(el, w, h) {
  if (w == null) {
    delete el.dataset.xfW;
    el.style.width = "";
  } else {
    el.dataset.xfW = w;
    el.style.width = w + "px";
  }
  if (el.tagName === "IMG") {
    if (h == null) {
      delete el.dataset.xfH;
      el.style.height = "";
      el.style.objectFit = "";
      el.style.background = "";
    } else {
      el.dataset.xfH = h;
      el.style.height = h + "px";
      el.style.objectFit = "contain";
      el.style.background = "#000";
    }
  }
  syncStacking(el);
  var wrap = el.parentNode;
  if (wrap && wrap.classList && wrap.classList.contains("resize-wrap")) positionGrips(el, wrap);
}

/**
 * Moves el's resize-grip/move-grip (children of wrap) to sit exactly at
 * el's current rendered corners. Needed because the grips are positioned
 * relative to wrap, which never moves or scales (it's just there to give
 * them somewhere to anchor without landing inside el's own innerHTML), so
 * once el has a transform on it, its actual visual corners are somewhere
 * else entirely. Both rects are viewport-relative, so their difference is
 * unaffected by page scroll. Grips are inset just inside el's own box
 * (never straddling past its edge): an element pinned flush against the
 * very edge of the viewport (eg. the sticky nav, always at y=0) has no
 * room above/left of it for a handle that pokes outward to render into,
 * which would make it literally unreachable by mouse.
 * @param el the resizable/movable element
 * @param wrap el's resize-wrap
 */
function positionGrips(el, wrap) {
  var elRect = el.getBoundingClientRect();
  var wrapRect = wrap.getBoundingClientRect();
  var resizeGrip = wrap.querySelector(":scope > .resize-grip");
  var moveGrip = wrap.querySelector(":scope > .move-grip");
  if (resizeGrip) {
    resizeGrip.style.left = (elRect.right - wrapRect.left - 15) + "px";
    resizeGrip.style.top = (elRect.bottom - wrapRect.top - 15) + "px";
  }
  if (moveGrip) {
    moveGrip.style.left = (elRect.left - wrapRect.left + 2) + "px";
    moveGrip.style.top = (elRect.top - wrapRect.top + 2) + "px";
  }
}

/**
 * Applies saved size overrides (from a resize-handle drag, see
 * wireResizeGrip()) on top of the page's own default sizing, for every
 * resizable/movable element. Runs on every load (live site included), same
 * as applyTextOverrides(). Icons/boxes/cards were saved as a `{sx, sy}`
 * scale (a transform, so it never reflows anything else on the page, see
 * setXf()); text fields and images were saved as an explicit `{w}`/`{w, h}`
 * box size instead (see setBoxWH()).
 * @param sizes content.sizes, {id: {sx, sy}} or {id: {w}} or {id: {w, h}}
 */
function applySizeOverrides(sizes) {
  sizes = sizes || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = el.getAttribute("data-edit-id") || el.getAttribute("data-resize-id");
    var s = sizes[id];
    if (!s) return;
    if (s.sx !== undefined) {
      var cur = getXf(el);
      setXf(el, cur.tx, cur.ty, s.sx, s.sy);
    } else if (s.w !== undefined) {
      setBoxWH(el, s.w, s.h);
    }
  });
}

/**
 * Applies saved font-size overrides (from the A-/A+ buttons, see
 * ensureFontSizeCtl()) on top of the page's own default type scale, for
 * every click-to-edit text field that carries one.
 * @param sizes content.font_sizes, {id: px}
 */
function applyFontSizeOverrides(sizes) {
  sizes = sizes || {};
  document.querySelectorAll("[data-edit-id]").forEach(function (el) {
    var id = el.getAttribute("data-edit-id");
    if (sizes[id]) el.style.fontSize = sizes[id];
  });
}

/**
 * Applies saved move offsets (from a move-handle drag, see wireMovable())
 * on top of the page's own default flow position, for every resizable/
 * movable element. Runs on every load, live site included, same as
 * applyTextOverrides(). A transform, so it never reflows anything else on
 * the page, see setXf().
 * @param positions content.positions, {id: {tx, ty}}
 */
function applyPositionOverrides(positions) {
  positions = positions || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = el.getAttribute("data-edit-id") || el.getAttribute("data-resize-id");
    var p = positions[id];
    if (!p) return;
    var cur = getXf(el);
    setXf(el, p.tx, p.ty, cur.sx, cur.sy);
  });
}

/* undo/redo for click-to-edit, a plain stack of {id, before, after} commits.
   a fresh edit clears the redo stack, same convention as any text editor. */
var EDIT_UNDO = [];
var EDIT_REDO = [];

/**
 * Wraps el in a positioned <span class="resize-wrap"> (skipped if already
 * wrapped), purely so the resize/move grips have somewhere to anchor
 * (position:absolute) without landing inside el's own innerHTML (which
 * would corrupt a contenteditable field's saved text, or fail outright on
 * a void element like <img>). Wrapping happens once per element, at
 * wireResizable() time; the wrap and grips stay in the DOM for the rest of
 * the edit session regardless of whether that particular element is the
 * one currently being text-edited (see .resize-wrap:hover in
 * css/style.css for how the grips show themselves). The wrap's own
 * display is matched to el's natural one (block stays block, inline
 * becomes inline-block): forcing every wrap to inline-block regardless
 * used to pull block-level siblings (eg. a heading and the paragraph
 * under it) onto the same line the moment both got wrapped, since two
 * inline-block boxes sit side by side instead of stacking. Resizing
 * itself never touches the wrap's box at all (see setXf()), so unlike an
 * earlier version of this, the wrap needs no flex/grid/max-width
 * overrides to make a size stick. Also kills any of el's own CSS
 * transitions (eg. `.card`'s hover-lift `transition: transform .2s`):
 * left running, a transition means el's rendered box lags behind whatever
 * `setXf()` just set for the next ~200ms, so positionGrips() (which reads
 * el's rect synchronously, right after writing the transform) would place
 * the grips wherever el was mid-animation rather than its true final
 * spot, and nothing re-syncs them once the transition settles.
 * @param el the element to make resizable
 * @return the wrap element
 */
function ensureResizeWrap(el) {
  var wrap = el.parentNode;
  if (wrap && wrap.classList && wrap.classList.contains("resize-wrap")) return wrap;

  var naturalDisplay = getComputedStyle(el).display;
  /* a css transform has no effect at all on a plain (non-replaced) inline
     box, per spec (an <img>/<svg> is a "replaced" element and isn't
     affected by this, only a bare <span>/<a>/<b> etc is): without this, a
     short inline text field like a nav link or the countdown's "Date and
     time" label would silently ignore every resize/move drag, its dataset
     and transform style updating fine but nothing moving on screen */
  if (naturalDisplay === "inline") el.style.display = "inline-block";
  wrap = document.createElement("span");
  wrap.className = "resize-wrap";
  wrap.style.display = naturalDisplay === "inline" ? "inline-block" : "block";
  el.parentNode.insertBefore(wrap, el);
  wrap.appendChild(el);
  el.style.transition = "none";
  return wrap;
}

/**
 * Classifies a resizable/movable element so wireResizeGrip() can pick the
 * right resize behavior for it: a plain text field (data-edit-id, no
 * data-resize-id) resizes its own box width only, leaving its font size
 * alone (see the A-/A+ controls) rather than visually stretching the
 * letters; an icon (data-resize-id starting "icon.") is scaled uniformly
 * so it never distorts; an <img> keeps its own aspect ratio and
 * letterboxes instead of stretching (see setBoxWH()); everything else
 * (cards, nav, sections, buttons...) scales freely via transform, same as
 * before.
 * @param el the element
 * @return "text", "icon", "image", or "box"
 */
function elResizeKind(el) {
  if (el.tagName === "IMG") return "image";
  var rid = el.getAttribute("data-resize-id") || "";
  if (rid.indexOf("icon.") === 0) return "icon";
  if (el.hasAttribute("data-edit-id") && !el.hasAttribute("data-resize-id")) return "text";
  return "box";
}

/**
 * Gives el a drag handle (bottom-right corner of its wrap) to resize it,
 * behavior depending on elResizeKind(el): a text field's box gets an
 * explicit width (setBoxWH()), an image's box gets an explicit width and
 * height (letterboxed, setBoxWH()), an icon scales up/down uniformly (both
 * axes locked to the same factor so it never distorts), and everything
 * else scales its two axes independently via a CSS transform. Scaling via
 * transform, rather than changing width/height, is a purely visual/
 * paint-time effect: el's box for layout purposes never changes size, so
 * no other element on the page ever gets pushed, shrunk, or otherwise
 * reflowed by it, and the browser's own hit testing (clicks, hover, the
 * grip itself) automatically follows the scaled box for free.
 * @param el the element to make resizable
 * @param onCommit called with the new size ({sx, sy} for icon/box, {w} for
 *   text, {w, h} for image) once a drag ends, or null if double-clicking
 *   the grip reset it back to default
 */
function wireResizeGrip(el, onCommit) {
  var wrap = ensureResizeWrap(el);
  if (wrap.querySelector(":scope > .resize-grip")) return;

  var kind = elResizeKind(el);
  var grip = document.createElement("span");
  grip.className = "resize-grip";
  grip.setAttribute("contenteditable", "false");
  grip.title = "Drag to resize";
  wrap.appendChild(grip);
  positionGrips(el, wrap);

  grip.addEventListener("mousedown", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var startX = e.clientX, startY = e.clientY;
    var rect = el.getBoundingClientRect(); // el's current (possibly already resized) rendered size
    var startW = rect.width, startH = rect.height;
    var base = getXf(el);

    function onMove(ev) {
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (kind === "text") {
        setBoxWH(el, Math.max(40, startW + dx));
      } else if (kind === "image") {
        setBoxWH(el, Math.max(20, startW + dx), Math.max(20, startH + dy));
      } else if (kind === "icon") {
        var newW = startW + dx, newH = startH + dy;
        var ratio = Math.sqrt((newW * newW + newH * newH) / (startW * startW + startH * startH));
        setXf(el, base.tx, base.ty, base.sx * ratio, base.sy * ratio);
      } else {
        var newW2 = Math.max(20, startW + dx);
        var newH2 = Math.max(16, startH + dy);
        setXf(el, base.tx, base.ty, base.sx * (newW2 / startW), base.sy * (newH2 / startH));
      }
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (kind === "text") {
        onCommit({ w: parseFloat(el.dataset.xfW) });
      } else if (kind === "image") {
        onCommit({ w: parseFloat(el.dataset.xfW), h: parseFloat(el.dataset.xfH) });
      } else {
        var t = getXf(el);
        onCommit({ sx: t.sx, sy: t.sy });
      }
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  grip.addEventListener("dblclick", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (kind === "text") {
      setBoxWH(el, null);
    } else if (kind === "image") {
      setBoxWH(el, null, null);
    } else {
      var base = getXf(el);
      setXf(el, base.tx, base.ty, 1, 1);
    }
    onCommit(null);
  });
}

/**
 * Gives el a second drag handle (top-left corner of its wrap, opposite the
 * resize grip) that moves it with a CSS transform (translate), letting it
 * be dragged off its normal flow position. Like the resize grip, this is
 * purely visual: el's box for layout purposes doesn't move, so nothing
 * else on the page reflows to fill the gap or make room, el just visibly
 * floats from where it used to sit (and its hit box moves right along
 * with it).
 * @param el the element to make movable
 * @param onCommit called with (x, y) once a drag ends, or (null, null) if
 *   double-clicking the handle reset it back to place
 */
function wireMoveGrip(el, onCommit) {
  var wrap = ensureResizeWrap(el);
  if (wrap.querySelector(":scope > .move-grip")) return;

  var grip = document.createElement("span");
  grip.className = "move-grip";
  grip.setAttribute("contenteditable", "false");
  grip.title = "Drag to move";
  wrap.appendChild(grip);
  positionGrips(el, wrap);

  grip.addEventListener("mousedown", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var startX = e.clientX, startY = e.clientY;
    var base = getXf(el);

    function onMove(ev) {
      setXf(el, base.tx + (ev.clientX - startX), base.ty + (ev.clientY - startY), base.sx, base.sy);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      var t = getXf(el);
      onCommit(t.tx, t.ty);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  grip.addEventListener("dblclick", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var base = getXf(el);
    setXf(el, 0, 0, base.sx, base.sy);
    onCommit(null, null);
  });
}

/**
 * Makes every tagged element on the page (text field, image, icon, card,
 * nav, section, footer, button, anything carrying a data-edit-id or
 * data-resize-id, ie. everything except the fixed background grid/vignette
 * and the hero's own background video) both resizable and movable via drag
 * handles, only called in the ta portal's Visual editor tab alongside
 * wireClickToEdit().
 */
function wireResizable() {
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = el.getAttribute("data-edit-id") || el.getAttribute("data-resize-id");
    wireResizeGrip(el, function (size) { saveEditedSize(id, size); });
    wireMoveGrip(el, function (x, y) { saveEditedPosition(id, x, y); });
  });
}

/**
 * Adds the A-/A+ font-size buttons to a text field's resize wrap, if it
 * doesn't have them yet. Mousedown on the buttons is swallowed before it
 * can steal focus away from el, so bumping the size repeatedly doesn't
 * blur (and thereby end) the current edit.
 * @param el the text field being edited
 * @param wrap el's resize-wrap
 * @return the control, existing or newly created
 */
function ensureFontSizeCtl(el, wrap) {
  var ctl = wrap.querySelector(":scope > .font-size-ctl");
  if (ctl) return ctl;

  ctl = document.createElement("span");
  ctl.className = "font-size-ctl";
  ctl.setAttribute("contenteditable", "false");
  ctl.innerHTML =
    '<button type="button" class="fs-dn" title="Smaller text">A-</button>' +
    '<button type="button" class="fs-up" title="Larger text">A+</button>';
  wrap.appendChild(ctl);

  var id = el.getAttribute("data-edit-id");
  function bump(delta) {
    var cur = parseFloat(getComputedStyle(el).fontSize) || 16;
    var next = Math.max(8, Math.min(120, Math.round(cur + delta)));
    el.style.fontSize = next + "px";
    saveFontSize(id, next + "px");
  }
  ["fs-dn", "fs-up"].forEach(function (cls) {
    var btn = ctl.querySelector("." + cls);
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      bump(cls === "fs-dn" ? -2 : 2);
    });
  });
  return ctl;
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
  document.querySelectorAll("[data-edit-id]").forEach(function (el) {
    /* undo neuterLink()'s dimming, if any: an editable element should look
       normal (own hover affordance) rather than disabled */
    el.style.opacity = "";
    el.style.cursor = "";

    var beforeEdit = "";
    el.addEventListener("click", function (e) {
      if (el.isContentEditable) return; /* already editing, let the caret land normally */
      e.preventDefault();
      e.stopPropagation();
      beforeEdit = el.innerHTML;
      el.contentEditable = "true";
      el.classList.add("editing");
      /* el was already wrapped by wireResizable(); light up its resize grip
         and reveal the A-/A+ font-size buttons while text is being edited */
      if (el.parentNode.classList.contains("resize-wrap")) {
        el.parentNode.classList.add("has-editing");
        ensureFontSizeCtl(el, el.parentNode);
      }
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

    el.addEventListener("blur", function () {
      if (!el.isContentEditable) return;
      el.contentEditable = "false";
      el.classList.remove("editing");
      if (el.parentNode.classList.contains("resize-wrap")) {
        el.parentNode.classList.remove("has-editing");
        /* the edit may have changed el's own natural size (more/less text),
           which shifts its rendered corners relative to its wrap even
           though no transform changed, so the grips need to catch up too */
        positionGrips(el, el.parentNode);
      }
      var after = el.innerHTML;
      if (after !== beforeEdit) {
        EDIT_UNDO.push({ id: el.getAttribute("data-edit-id"), before: beforeEdit, after: after });
        EDIT_REDO.length = 0;
      }
      saveEditedField(el.getAttribute("data-edit-id"), after, el.getAttribute("data-default-html"));
      mirrorEditedField(el.getAttribute("data-edit-id"), after, el);
    });
  });

  document.addEventListener("keydown", function (e) {
    if (!(e.ctrlKey || e.metaKey)) return;
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
 * Writes one undo/redo stack entry's text back onto its element and saves it.
 * @param action {id, before, after}
 * @param side "before" or "after", which side of the action to restore
 */
function applyHistoryAction(action, side) {
  var els = document.querySelectorAll('[data-edit-id="' + action.id + '"]');
  if (!els.length) return;
  els.forEach(function (el) { el.innerHTML = action[side]; });
  saveEditedField(action.id, action[side], els[0].getAttribute("data-default-html"));
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
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

  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a resize-handle drag (see wireResizeGrip()) into the preview
 * snapshot, the same localStorage draft saveEditedField() uses, so a
 * resized element round-trips through Apply/profiles exactly like an
 * edited caption does.
 * @param id the element's data-edit-id or data-resize-id
 * @param size the new size ({sx, sy}, {w}, or {w, h}, see wireResizeGrip()),
 *   or null to clear back to the template default
 */
function saveEditedSize(id, size) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.sizes || typeof snapshot.sizes !== "object") snapshot.sizes = {};
  if (size == null) delete snapshot.sizes[id];
  else snapshot.sizes[id] = size;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a font-size bump from the A-/A+ buttons (see
 * ensureFontSizeCtl()) into the preview snapshot, the same draft
 * everything else here uses.
 * @param id the element's data-edit-id
 * @param px new font-size (css px string)
 */
function saveFontSize(id, px) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.font_sizes || typeof snapshot.font_sizes !== "object") snapshot.font_sizes = {};
  snapshot.font_sizes[id] = px;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a move-handle drag (see wireMoveGrip()) into the preview
 * snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param tx new horizontal offset in css px, or null to clear back to place
 * @param ty new vertical offset in css px, or null to clear back to place
 */
function saveEditedPosition(id, tx, ty) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.positions || typeof snapshot.positions !== "object") snapshot.positions = {};
  if (tx == null || ty == null) delete snapshot.positions[id];
  else snapshot.positions[id] = { tx: tx, ty: ty };
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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

document.addEventListener("DOMContentLoaded", function () {
  updatePortalLink();

  var slot = document.getElementById("heroCountdown");
  var grid = document.getElementById("logisticsGrid");
  if (!slot) return;

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
      applyTextOverrides(textMap);
      applySizeOverrides(data.sizes);
      applyFontSizeOverrides(data.font_sizes);
      applyPositionOverrides(data.positions);
      if (isPreviewMode() && isEditMode()) { wireResizable(); wireClickToEdit(); }
    })
    .catch(function () {
      slot.innerHTML = CD_TBA_HTML;
      renderTiles(DEFAULT_LOGISTICS);
      setJoinUrl(DEFAULT_JOIN_URL);
      setApplyTooltip(DEFAULT_APPLY_TOOLTIP);
      applyTextOverrides({});
    });
});
