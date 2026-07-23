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
 * Reads the id an element's size/position overrides are keyed by.
 * @param el the element
 * @return its data-edit-id or data-resize-id
 */
function elId(el) {
  return el.getAttribute("data-edit-id") || el.getAttribute("data-resize-id");
}

/**
 * Classifies an element so a resize drag can pick the right aspect-ratio
 * rule: an icon never distorts no matter what (its box's own ratio always
 * locked); an image never distorts its pixels either (object-fit: cover
 * re-crops instead), but its box's ratio is only locked while shift is
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
  if (tag === "img") return "img";
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
 * @param el the element
 * @return {tx, ty}
 */
function ancestorPos(el) {
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
  document.querySelectorAll("[data-edit-id]").forEach(function (el) {
    var id = el.getAttribute("data-edit-id");
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
  document.querySelectorAll("[data-edit-id]").forEach(function (el) {
    var s = styles[el.getAttribute("data-edit-id")];
    if (!s) return;
    if (s.fontFamily) el.style.fontFamily = s.fontFamily;
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

/**
 * Hides every element a ta deleted in the visual editor (see
 * deleteElement()), on every load, live site included, same as
 * applyTextOverrides(). A deleted id can match more than one element
 * (mirrored text like the brand wordmark, nav + footer); all of them hide
 * together, same "an id is one logical thing" rule as the rest of this file.
 * @param hidden array of data-edit-id/data-resize-id values to hide
 */
function applyHiddenOverrides(hidden) {
  (hidden || []).forEach(function (id) {
    document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
      el.style.display = "none";
    });
  });
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

/**
 * Every currently-rendered tracked element's id, in DOM (paint) order,
 * deduplicated. Seeds a sane default stack for any id a saved content.layers
 * list doesn't know about yet (a fresh blob, or a template id added since
 * it was saved), so an untouched page's stacking still matches exactly what
 * it looked like before any layer system existed.
 * @return array of ids, document order
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

/**
 * Applies an explicit stacking order to every tracked element: z-index is
 * just an id's position in the list (bottom = 1), so the layer up/down
 * handles (see moveLayer()) are the only thing that ever reorders elements,
 * resizing or moving one no longer silently bumps it above its neighbours.
 * Reconciles the saved list with what's actually on the page first: any id
 * missing from it is appended in DOM order (see domOrderIds()), so a page
 * that's never had anything reordered still stacks exactly as if there were
 * no layer system at all. Runs on every load, live site included, same as
 * applyTextOverrides(). Forces position:relative on a still-static element
 * first, z-index has no effect otherwise.
 * @param layers content.layers, ordered ids bottom to top
 */
function applyLayerOrder(layers) {
  var order = (layers || []).slice();
  var have = {};
  order.forEach(function (id) { have[id] = true; });
  domOrderIds().forEach(function (id) {
    if (!have[id]) { order.push(id); have[id] = true; }
  });
  LAYER_ORDER = order;
  order.forEach(function (id, i) {
    document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.zIndex = String(i + 1);
    });
  });
}

/**
 * Shifts one element one step up or down the stacking order (a plain
 * adjacent swap with its neighbour, so repeated clicks walk it further each
 * time, see the ring's .lyu/.lyd handles), repaints every element's z-index,
 * and persists the whole order. A no-op at either end of the stack.
 * @param id the element's data-edit-id or data-resize-id
 * @param dir +1 to bring forward one step, -1 to send backward one step
 */
function moveLayer(id, dir) {
  var i = LAYER_ORDER.indexOf(id);
  if (i === -1) { LAYER_ORDER.push(id); i = LAYER_ORDER.length - 1; }
  var j = i + dir;
  if (j < 0 || j >= LAYER_ORDER.length) return;
  var tmp = LAYER_ORDER[i];
  LAYER_ORDER[i] = LAYER_ORDER[j];
  LAYER_ORDER[j] = tmp;
  applyLayerOrder(LAYER_ORDER);
  saveLayerOrder(LAYER_ORDER);
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.layers = order;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/* undo/redo for click-to-edit and delete, a plain stack of commits: a text
   edit is {type:"text", id, before, after}, a delete is {type:"delete", id}.
   a fresh edit clears the redo stack, same convention as any text editor. */
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
function detachFromFlow(el) {
  var wrap = el.parentNode;
  if (wrap && wrap.classList && wrap.classList.contains("free-wrap")) return wrap;

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

  wrap = document.createElement("span");
  wrap.className = "free-wrap";
  wrap.style.display = naturalDisplay === "inline" ? "inline-block" : "block";
  wrap.style.width = w + "px";
  wrap.style.height = h + "px";
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
  return wrap;
}

/* the visual editor's one selection ring: a floating frame that follows
   whatever tracked element the mouse is over, carrying 8 resize handles
   (all four corners + all four edges, so any direction works) and one
   move handle. one shared ring instead of per-element grips, so a
   hundred-odd tagged elements never show overlapping handles at once and
   nested elements (an icon in a card in a section) stay individually
   grabbable: whichever one the cursor is actually over owns the ring. */
var RING = null;
var RING_EL = null;
var RING_DRAGGING = false;

/* handle name -> [x edge, y edge] it drags: -1 left/top, 1 right/bottom */
var RING_DIRS = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0],
  se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0]
};

/**
 * Builds the ring and its handles once, appended to body: 8 resize handles,
 * a move handle, a delete handle, and the two layer handles (bring forward/
 * send backward one step, see moveLayer()).
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

  var lyUp = document.createElement("span");
  lyUp.className = "lyh lyu";
  lyUp.title = "Bring forward";
  lyUp.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>';
  lyUp.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  lyUp.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (RING_EL) moveLayer(elId(RING_EL), 1);
  });
  RING.appendChild(lyUp);

  var lyDn = document.createElement("span");
  lyDn.className = "lyh lyd";
  lyDn.title = "Send backward";
  lyDn.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  lyDn.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
  lyDn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (RING_EL) moveLayer(elId(RING_EL), -1);
  });
  RING.appendChild(lyDn);

  document.body.appendChild(RING);
}

/**
 * Snaps the ring onto its current element's rendered box. Document
 * coordinates (rect + scroll), re-run on scroll/resize since the sticky
 * nav's document position changes as the page scrolls.
 */
function positionRing() {
  if (!RING || !RING_EL) return;
  var r = RING_EL.getBoundingClientRect();
  RING.style.display = "";
  RING.style.left = (r.left + window.scrollX) + "px";
  RING.style.top = (r.top + window.scrollY) + "px";
  RING.style.width = r.width + "px";
  RING.style.height = r.height + "px";
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
 * ancestor's.
 * @param el the element about to be resized
 */
function freezeDescendants(el) {
  var wraps = [];
  el.querySelectorAll(RESIZABLE_SEL).forEach(function (d) {
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
  if (!RING_EL) return;
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
    saveEditedSize(elId(el), { w: Math.round(s.w), h: Math.round(s.h) });
    if (p.tx || p.ty) saveEditedPosition(elId(el), Math.round(p.tx), Math.round(p.ty));
    else saveEditedPosition(elId(el), null, null);
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
 * put, see setOwnPos().
 * @param e the handle's mousedown
 */
function startMoveDrag(e) {
  if (!RING_EL) return;
  e.preventDefault();
  e.stopPropagation();
  var el = RING_EL;
  detachFromFlow(el);
  var startX = e.clientX, startY = e.clientY;
  var base = getPos(el);
  RING_DRAGGING = true;

  function onMove(ev) {
    setOwnPos(el, base.tx + (ev.clientX - startX), base.ty + (ev.clientY - startY));
    positionRing();
  }
  function onUp() {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    RING_DRAGGING = false;
    var p = getPos(el);
    if (p.tx || p.ty) saveEditedPosition(elId(el), Math.round(p.tx), Math.round(p.ty));
    else saveEditedPosition(elId(el), null, null);
  }
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
}

/** Double-click on a resize handle: back to the template's own size. */
function resetSizeDbl(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!RING_EL) return;
  resetBox(RING_EL);
  saveEditedSize(elId(RING_EL), null);
  positionRing();
}

/** Double-click on the move handle: back to the template's own spot. */
function resetPosDbl(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!RING_EL) return;
  setOwnPos(RING_EL, 0, 0);
  saveEditedPosition(elId(RING_EL), null, null);
  positionRing();
}

/**
 * Hides (or restores) every element sharing one data-edit-id/data-resize-id
 * and persists it, same "an id is one logical thing, not one specific DOM
 * node" rule mirrorEditedField() already applies to text (deleting the brand
 * wordmark takes it out of the nav and the footer together, not just
 * whichever copy was clicked). display:none rather than removing the node so
 * undo has something to restore.
 * @param id the element's data-edit-id or data-resize-id
 * @param hidden true to hide/delete it, false to restore it
 */
function setElementHidden(id, hidden) {
  document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
    el.style.display = hidden ? "none" : "";
  });
  saveEditedVisibility(id, hidden);
}

/**
 * Deletes the currently-selected element (ring's trash handle, or the
 * Delete/Backspace key, see wireResizable()). Pushed onto the same undo
 * stack as a text edit so Ctrl+Z brings it right back.
 * @param el the element to delete (always the current RING_EL)
 */
function deleteElement(el) {
  var id = elId(el);
  if (!id) return;
  setElementHidden(id, true);
  EDIT_UNDO.push({ type: "delete", id: id });
  EDIT_REDO.length = 0;
  hideTextToolbar();
  RING_EL = null;
  if (RING) RING.style.display = "none";
}

/* every custom element a ta has added via the right-click "Add element"
   menu this load, {id, kind, left, top, w, h, icon, href}, mirrors
   content.custom_elements exactly (see renderCustomElements()) */
var CUSTOM_ELEMENTS = [];

/* a handful of the site's own icons, reused verbatim (same paths as
   templates/index.html's learn cards, the countdown calendar, and the
   logistics checkmark, see CHECK_ICON_SVG above) rather than pulling in an
   icon library: "icons that exist already", not new ones. class="cic" for
   the same fixed 30x30 accent-colored sizing every other content icon on
   the site already uses. */
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
    '<path d="M12 12l9-5M12 12v10M12 12L3 7" /></svg>' }
];

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
 * the site follows; its href stays "#" (dead, like the login page's own
 * "Sign up" link) with the entered link only stashed on the dataset for
 * now, real navigation is a later step. An "image" with a `d.url` is a real
 * uploaded photo (see uploadImageFile()/renderCtxMenuImagePicker()), a plain
 * `<img>` with the site's usual object-fit: cover so its box dictates the
 * crop rather than stretching the pixels; one saved before real uploads
 * existed (no `d.url`) still falls back to the site's flat `.ph` placeholder
 * box (see the Media bullets in CLAUDE.md).
 * @param d {id, kind, left, top, w, h, icon, href, url}
 * @return the built, attached element
 */
function buildCustomElement(d) {
  var el;
  if (d.kind === "text") {
    el = document.createElement("div");
    el.setAttribute("data-edit-id", d.id);
    el.textContent = "Text";
  } else if (d.kind === "button") {
    el = document.createElement("a");
    el.className = "btn";
    el.href = "#";
    el.addEventListener("click", function (e) { if (!el.isContentEditable) e.preventDefault(); });
    el.setAttribute("data-edit-id", d.id);
    el.textContent = "Button";
    if (d.href) el.dataset.pendingHref = d.href;
  } else if (d.kind === "box") {
    el = document.createElement("div");
    el.setAttribute("data-resize-id", d.id);
    el.style.background = "var(--surface-2)";
    el.style.width = "160px";
    el.style.height = "100px";
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
  } else {
    el = svgFromMarkup(d.icon || ICON_LIBRARY[0].svg);
    el.setAttribute("data-resize-id", d.id);
  }
  placeFreeElement(el, d.left, d.top);
  if (d.w) { el.style.width = d.w + "px"; el.dataset.natW = d.w; }
  if (d.h) { el.style.height = d.h + "px"; el.dataset.natH = d.h; }
  return el;
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
 * Persists the whole custom_elements list into the preview snapshot, the
 * same localStorage draft every other override here uses. Rewritten
 * wholesale (not merged) since the in-memory CUSTOM_ELEMENTS array is
 * always the full, current list.
 * @param list CUSTOM_ELEMENTS
 */
function saveCustomElements(list) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.custom_elements = list;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Uploads one image file for the "Add element" menu's Image option, the
 * same ta-only /api/upload endpoint every other upload on the site already
 * posts to (attachments, gallery, hero video, home images). Reads the
 * session token straight out of localStorage rather than going through
 * js/ta.js's authedFetch()/authHeaders(), since this file runs on pages
 * that never load ta.js; same-origin, so the token's already there whether
 * this runs in the ta's real portal tab or the preview iframe it shares
 * localStorage with.
 * @param file the File object from the picker
 * @return a promise resolving to the uploaded file's url
 */
function uploadImageFile(file) {
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
 * Adds one new element via the visual editor's right-click "Add element"
 * menu (see wireAddElementMenu()): built through buildCustomElement(), the
 * exact same construction that recreates it on every future load, then
 * measured/frozen at its just-rendered size and pushed onto
 * content.custom_elements so it round-trips through Apply/profiles like
 * everything else the editor creates. Always lands on the very top of the
 * stacking order (see moveLayer()), matching what a ta would expect from
 * something they just placed.
 * @param kind "text", "button", "box", "image", or "icon"
 * @param x left, document px (where the menu was opened)
 * @param y top, document px
 * @param extra {icon} for kind "icon", {href} for kind "button", {url} for
 *   kind "image" (the uploaded file's url, see uploadImageFile())
 * @return the new element
 */
function addCustomElement(kind, x, y, extra) {
  extra = extra || {};
  var uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var d = { id: (kind === "icon" ? "icon.custom." : "custom." + kind + ".") + uid, kind: kind, left: Math.round(x), top: Math.round(y) };
  if (kind === "icon") d.icon = extra.icon;
  if (kind === "button") d.href = extra.href || "";
  if (kind === "image") d.url = extra.url;
  var el = buildCustomElement(d);
  freezeFreeElement(el);
  d.w = parseFloat(el.dataset.natW);
  d.h = parseFloat(el.dataset.natH);
  CUSTOM_ELEMENTS.push(d);
  saveCustomElements(CUSTOM_ELEMENTS);
  LAYER_ORDER.push(d.id);
  applyLayerOrder(LAYER_ORDER);
  saveLayerOrder(LAYER_ORDER);
  if (kind === "text" || kind === "button") wireTextField(el);
  return el;
}

/* the one floating right-click "Add element" menu, same singleton pattern
   as the ring/text toolbar */
var CTX_MENU = null;
var CTX_POS = { x: 0, y: 0 };

/** Builds the context menu once, lazily. */
function buildCtxMenu() {
  CTX_MENU = document.createElement("div");
  CTX_MENU.className = "ctx-menu";
  document.body.appendChild(CTX_MENU);
}

/** Renders the menu's root list: the 5 things that can be added. */
function renderCtxMenuRoot() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Add element</div>' +
    '<button type="button" data-add="text">Textbox</button>' +
    '<button type="button" data-add="box">Box</button>' +
    '<button type="button" data-add="image">Image</button>' +
    '<button type="button" data-add="icon">Icon</button>' +
    '<button type="button" data-add="button">Button</button>';
  CTX_MENU.querySelectorAll("button[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () { handleCtxAdd(btn.getAttribute("data-add")); });
  });
}

/** Swaps the menu into its icon-picker sub-view (one of ICON_LIBRARY). */
function renderCtxMenuIconPicker() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Choose an icon</div>' +
    '<div class="ctx-icons">' +
      ICON_LIBRARY.map(function (ic, i) {
        return '<button type="button" class="ctx-icon-btn" data-icon="' + i + '" title="' + ic.label + '">' + ic.svg + '</button>';
      }).join("") +
    '</div>';
  CTX_MENU.querySelectorAll(".ctx-icon-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ic = ICON_LIBRARY[parseInt(btn.getAttribute("data-icon"), 10)];
      addCustomElement("icon", CTX_POS.x, CTX_POS.y, { icon: ic.svg });
      hideCtxMenu();
    });
  });
}

/**
 * Swaps the menu into its "Add button" sub-view: a link field for later
 * (see buildCustomElement()'s doc comment), not a live one yet.
 */
function renderCtxMenuButtonLink() {
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Add button</div>' +
    '<input type="url" class="ctx-link-input" placeholder="Link (not active yet)">' +
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
 * uploadImageFile()), same "choose a file, it uploads immediately" pattern
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
    uploadImageFile(file)
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
 * Handles a click on one of the root menu's 5 options: textbox/box add
 * immediately and close the menu, icon/button/image swap to a picker/link/
 * file sub-view first.
 * @param kind "text", "box", "image", "icon", or "button"
 */
function handleCtxAdd(kind) {
  if (kind === "icon") { renderCtxMenuIconPicker(); return; }
  if (kind === "button") { renderCtxMenuButtonLink(); return; }
  if (kind === "image") { renderCtxMenuImagePicker(); return; }
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
 */
function showCtxMenu(x, y) {
  if (!CTX_MENU) buildCtxMenu();
  CTX_POS = { x: x, y: y };
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
}

/**
 * Wires up the right-click "Add element" menu, only called in the ta
 * portal's Visual editor tab alongside wireResizable()/wireClickToEdit().
 * Replaces the browser's own context menu everywhere in the editor.
 */
function wireAddElementMenu() {
  document.addEventListener("contextmenu", function (e) {
    /* mid-edit, leave the browser's own menu alone so right-click paste/
       spellcheck still works while actually typing */
    if (e.target.closest && e.target.closest("[contenteditable='true']")) return;
    e.preventDefault();
    showCtxMenu(e.pageX, e.pageY);
  });
  /* mousedown (not click) so this runs and reads e.target BEFORE a menu
     button's own click handler gets a chance to rewrite CTX_MENU's
     children (eg swapping to the icon-picker sub-view), which would
     otherwise make a stale e.target read as "outside" the menu on the
     click that follows and close it out from under itself */
  document.addEventListener("mousedown", function (e) {
    if (CTX_MENU && CTX_MENU.classList.contains("show") && !CTX_MENU.contains(e.target)) hideCtxMenu();
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && CTX_MENU && CTX_MENU.classList.contains("show")) hideCtxMenu();
  });
}

/* set for one tick after a body-drag move ends, so the click that the
   browser fires right after mouseup doesn't also open a text edit */
var JUST_DRAGGED = false;

/**
 * Sets up the visual editor's shared selection ring: hovering any tagged
 * element (text field, image, icon, card, nav, section, footer, button,
 * day row, tile, anything carrying a data-edit-id or data-resize-id)
 * attaches the ring to it. Buttons are single tagged elements, so their
 * text box IS the button itself; every other text field is its own box,
 * fully independent of whatever container it sits in. Moving doesn't need
 * the handle: dragging anywhere on the element itself moves it too, with
 * a small threshold so a plain click still clicks (and still opens a text
 * edit). Only called in the ta portal's Visual editor tab alongside
 * wireClickToEdit().
 */
function wireResizable() {
  buildRing();
  document.addEventListener("mouseover", function (e) {
    if (RING_DRAGGING) return;
    if (RING.contains(e.target)) return;
    var t = e.target.closest ? e.target.closest(RESIZABLE_SEL) : null;
    if (t && t !== RING_EL) {
      RING_EL = t;
      positionRing();
    }
  });
  window.addEventListener("scroll", positionRing, true);
  window.addEventListener("resize", positionRing);

  /* drag-anywhere move, delegated so it covers rerendered content too */
  document.addEventListener("mousedown", function (e) {
    if (e.button !== 0) return;
    if (RING.contains(e.target)) return;
    var el = e.target.closest ? e.target.closest(RESIZABLE_SEL) : null;
    if (!el) return;
    /* mid-edit: leave the mouse to text selection/caret placement */
    if (el.isContentEditable) return;

    var startX = e.clientX, startY = e.clientY;
    var base = getPos(el);
    var moving = false;

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
           startMoveDrag()'s doc comment */
        detachFromFlow(el);
      }
      ev.preventDefault();
      setOwnPos(el, base.tx + (ev.clientX - startX), base.ty + (ev.clientY - startY));
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
      if (p.tx || p.ty) saveEditedPosition(elId(el), Math.round(p.tx), Math.round(p.ty));
      else saveEditedPosition(elId(el), null, null);
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
    '<span class="tt-sep"></span>' +
    '<button type="button" class="fs-dn" title="Smaller text">A-</button>' +
    '<button type="button" class="fs-up" title="Larger text">A+</button>' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="tt-bold" title="Bold"><b>B</b></button>' +
    '<button type="button" class="tt-italic" title="Italic"><i>I</i></button>' +
    '<button type="button" class="tt-underline" title="Underline"><u>U</u></button>' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="tt-align" data-align="left" title="Align left">' + ALIGN_ICONS.left + '</button>' +
    '<button type="button" class="tt-align" data-align="center" title="Align center">' + ALIGN_ICONS.center + '</button>' +
    '<button type="button" class="tt-align" data-align="right" title="Align right">' + ALIGN_ICONS.right + '</button>' +
    '<button type="button" class="tt-align" data-align="justify" title="Justify">' + ALIGN_ICONS.justify + '</button>' +
    '<span class="tt-sep"></span>' +
    '<button type="button" class="ls-dn" title="Tighter letter spacing">Sp-</button>' +
    '<button type="button" class="ls-up" title="Wider letter spacing">Sp+</button>';
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
      var cur = parseFloat(getComputedStyle(TEXT_TOOLBAR_EL).fontSize) || 16;
      var next = Math.max(8, Math.min(120, Math.round(cur + (cls === "fs-dn" ? -2 : 2))));
      TEXT_TOOLBAR_EL.style.fontSize = next + "px";
      saveFontSize(TEXT_TOOLBAR_EL.getAttribute("data-edit-id"), next + "px");
      positionRing();
    });
  });

  [["tt-bold", "bold"], ["tt-italic", "italic"], ["tt-underline", "underline"]].forEach(function (pair) {
    TEXT_TOOLBAR.querySelector("." + pair[0]).addEventListener("click", function () {
      document.execCommand(pair[1]);
      updateTextToolbarState();
    });
  });

  TEXT_TOOLBAR.querySelectorAll(".tt-align").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (!TEXT_TOOLBAR_EL) return;
      var align = btn.getAttribute("data-align");
      /* clicking the already-active alignment turns it back off (back to
         the template's own default), same toggle feel as everything else
         in this editor rather than a one-way ratchet */
      var next = TEXT_TOOLBAR_EL.style.textAlign === align ? "" : align;
      TEXT_TOOLBAR_EL.style.textAlign = next;
      saveTextStyle(TEXT_TOOLBAR_EL.getAttribute("data-edit-id"), "align", next);
      updateTextToolbarState();
    });
  });

  ["ls-dn", "ls-up"].forEach(function (cls) {
    TEXT_TOOLBAR.querySelector("." + cls).addEventListener("click", function () {
      if (!TEXT_TOOLBAR_EL) return;
      var cur = parseFloat(getComputedStyle(TEXT_TOOLBAR_EL).letterSpacing) || 0;
      var next = Math.max(-2, Math.min(8, Math.round((cur + (cls === "ls-dn" ? -0.5 : 0.5)) * 10) / 10));
      var val = next === 0 ? "" : next + "px";
      TEXT_TOOLBAR_EL.style.letterSpacing = val;
      saveTextStyle(TEXT_TOOLBAR_EL.getAttribute("data-edit-id"), "letterSpacing", val);
    });
  });

  TEXT_TOOLBAR.querySelector(".tt-font").addEventListener("change", function () {
    if (!TEXT_TOOLBAR_EL) return;
    var val = this.value;
    TEXT_TOOLBAR_EL.style.fontFamily = val;
    saveTextStyle(TEXT_TOOLBAR_EL.getAttribute("data-edit-id"), "fontFamily", val);
    TEXT_TOOLBAR_EL.focus();
  });
}

/**
 * Refreshes the toolbar's pressed/active look to match the current
 * selection and field: bold/italic/underline read from
 * document.queryCommandState() (only meaningful with the field focused),
 * align reads the field's own inline override (not its computed style, so a
 * field that merely inherits center alignment from a parent doesn't show as
 * "active" until a ta actually sets it here).
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
  updateTextToolbarState();
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
    /* focus moved to the toolbar itself (eg opening the font dropdown),
       not away from the field: don't end the edit, that control's own
       handler runs and hands focus straight back */
    if (e.relatedTarget && TEXT_TOOLBAR && TEXT_TOOLBAR.contains(e.relatedTarget)) return;
    el.contentEditable = "false";
    el.classList.remove("editing");
    hideTextToolbar();
    /* the edit may have changed el's own rendered size (more/less text),
       so the ring needs to catch up if it's sitting on this field */
    positionRing();
    var after = el.innerHTML;
    if (after !== beforeEdit) {
      EDIT_UNDO.push({ type: "text", id: el.getAttribute("data-edit-id"), before: beforeEdit, after: after });
      EDIT_REDO.length = 0;
    }
    saveEditedField(el.getAttribute("data-edit-id"), after, el.getAttribute("data-default-html"));
    mirrorEditedField(el.getAttribute("data-edit-id"), after, el);
  });

  el.addEventListener("keyup", updateTextToolbarState);
  el.addEventListener("mouseup", updateTextToolbarState);
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
 * Replays one undo/redo stack entry, either a text commit ({type:"text",
 * id, before, after}) or a delete ({type:"delete", id}: "before" means it
 * existed, "after" means it was deleted, so undo shows it and redo hides it
 * again).
 * @param action the stack entry
 * @param side "before" or "after", which side of the action to restore
 */
function applyHistoryAction(action, side) {
  if (action.type === "delete") {
    setElementHidden(action.id, side === "after");
    return;
  }
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.sizes || typeof snapshot.sizes !== "object") snapshot.sizes = {};
  if (size == null) delete snapshot.sizes[id];
  else snapshot.sizes[id] = size;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a font-size bump from the A-/A+ buttons (see showTextToolbar())
 * into the preview snapshot, the same draft everything else here uses.
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.text_styles || typeof snapshot.text_styles !== "object") snapshot.text_styles = {};
  if (!snapshot.text_styles[id]) snapshot.text_styles[id] = {};
  if (value) snapshot.text_styles[id][prop] = value;
  else delete snapshot.text_styles[id][prop];
  if (!Object.keys(snapshot.text_styles[id]).length) delete snapshot.text_styles[id];
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.positions || typeof snapshot.positions !== "object") snapshot.positions = {};
  if (tx == null || ty == null) delete snapshot.positions[id];
  else snapshot.positions[id] = { tx: tx, ty: ty };
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!Array.isArray(snapshot.hidden)) snapshot.hidden = [];
  var idx = snapshot.hidden.indexOf(id);
  if (hidden) { if (idx === -1) snapshot.hidden.push(id); }
  else if (idx !== -1) snapshot.hidden.splice(idx, 1);
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
      renderCustomElements(data.custom_elements);
      applyTextOverrides(textMap);
      applySizeOverrides(data.sizes);
      applyFontSizeOverrides(data.font_sizes);
      applyTextStyleOverrides(data.text_styles);
      applyPositionOverrides(data.positions);
      applyHiddenOverrides(data.hidden);
      applyLayerOrder(data.layers);
      if (isPreviewMode() && isEditMode()) { wireResizable(); wireClickToEdit(); wireAddElementMenu(); }
    })
    .catch(function () {
      slot.innerHTML = CD_TBA_HTML;
      renderTiles(DEFAULT_LOGISTICS);
      setJoinUrl(DEFAULT_JOIN_URL);
      setApplyTooltip(DEFAULT_APPLY_TOOLTIP);
      applyTextOverrides({});
    });
});
