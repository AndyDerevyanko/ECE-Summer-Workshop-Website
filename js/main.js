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
      setHiddenVisual(el, true);
    });
  });
}

/**
 * Whether el has any independently-tagged element nested inside it (eg the
 * brand link wraps the logo image and brand text, each separately
 * resizable/editable). Used to tell a plain leaf link (a hero CTA button,
 * nothing tracked nested inside it) from a wrapper link other tagged
 * elements depend on staying visible when it's deleted.
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
 * visitor's page must never write to localStorage). A plain element gets
 * display:none, detached from flow first (see detachFromFlow()) so its own
 * slot stays reserved and removing it can never reflow a sibling into the
 * gap, same "no attachment between elements" guarantee a move/resize
 * already gets. A link wrapping other independently-tagged elements (eg the
 * brand link around the logo image and brand text) can't use display:none
 * at all, css unconditionally hides every descendant of a hidden element
 * too, which would take the logo and text down with it even though neither
 * was the thing actually selected for deletion, and physically moving them
 * out to become the link's own siblings (an earlier attempt at this) broke
 * just as badly: it dropped them out of whatever flex/inline layout the
 * link used to arrange them, straight into the surrounding nav's own flow,
 * visibly reshuffling everything else in it. Instead the link is made
 * inert: pointer-events:none on the link itself (so it can no longer be
 * hovered, clicked, or targeted by the ring/right-click menu, and a real
 * visitor's click no longer navigates), with pointer-events:auto on its
 * tracked children so they stay independently hoverable/editable exactly as
 * before. Nothing moves, nothing's hidden, so the link's own layout role is
 * completely undisturbed.
 * @param el the element
 * @param hide true to hide/delete it, false to restore it
 */
function setHiddenVisual(el, hide) {
  if (el.tagName === "A" && hasTrackedDescendants(el)) {
    el.style.pointerEvents = hide ? "none" : "";
    el.classList.toggle("el-deleted", hide);
    el.querySelectorAll(RESIZABLE_SEL).forEach(function (child) {
      child.style.pointerEvents = hide ? "auto" : "";
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.fixed_elements = ids;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.locked = ids;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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
 * just an id's rank within its own local stacking scope (bottom = 1), so
 * the layer menu (see moveLayer()/moveLayerExtreme()) is the only thing
 * that ever reorders elements, resizing or moving one no longer silently
 * bumps it above its neighbours. Scoped per nearest tracked ancestor (see
 * nearestTrackedAncestorId()), NOT one page-wide z-index: css only ever
 * compares z-index within the same stacking context, so an icon inside one
 * card and a button inside an unrelated section were never actually
 * competing for the same visual "front", a single global counter across
 * both just changed numbers with no visible effect. Reconciles the saved
 * order with what's actually on the page first: any id missing from it is
 * appended in DOM order (see domOrderIds()), so a page that's never had
 * anything reordered still stacks exactly as if there were no layer system
 * at all. Within each scope, fixed elements (FIXED_SET, see
 * setFixedElements()) are always stacked above every non-fixed one there:
 * the scope's members are split into two bands, non-fixed first then
 * fixed, each keeping its own relative order, so within either group
 * elements are still individually reorderable (see moveLayer()) but no
 * fixed element's z-index can ever fall below a non-fixed sibling's. Runs
 * on every load, live site included, same as applyTextOverrides(). Forces
 * position:relative on a still-static element first, z-index has no effect
 * otherwise.
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
  var rank = {};
  order.forEach(function (id, i) { rank[id] = i; });

  /* group every actual DOM element by its own stacking scope (its nearest
     tracked ancestor, see nearestTrackedAncestorId()) rather than stamping
     one page-wide z-index: z-index is only ever compared within the SAME
     stacking context, so ranking an icon against an unrelated button three
     sections away (which the old flat pass did) had no visual effect,
     that's why "bring forward" so often did nothing. Grouped by DOM
     element, not just id, since a mirrored id (eg the brand wordmark,
     shared by the nav and footer) sits in two different scopes at once. */
  var scopes = {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var id = elId(el);
    if (!id) return;
    var scope = nearestTrackedAncestorId(el);
    (scopes[scope] = scopes[scope] || []).push({ el: el, id: id });
  });
  Object.keys(scopes).forEach(function (scope) {
    var members = scopes[scope];
    var nonFixed = members.filter(function (m) { return !isFixed(m.id); });
    var fixed = members.filter(function (m) { return isFixed(m.id); });
    var byRank = function (a, b) { return (rank[a.id] || 0) - (rank[b.id] || 0); };
    nonFixed.sort(byRank);
    fixed.sort(byRank);
    var z = 1;
    nonFixed.concat(fixed).forEach(function (m) {
      if (getComputedStyle(m.el).position === "static") m.el.style.position = "relative";
      m.el.style.zIndex = String(z);
      z++;
    });
  });
}

/**
 * Shifts one element one step up or down the stacking order (a plain
 * adjacent swap with its neighbour, so repeated clicks walk it further each
 * time, see the layer menu's Up/Down buttons), repaints every element's z-index,
 * and persists the whole order. A no-op at either end of the stack. Only
 * ever swaps with the nearest neighbour in the SAME fixed/non-fixed group
 * AND the same stacking scope (see nearestTrackedAncestorId()), skipping
 * over any others in between: swapping past an element in a different
 * scope (eg a totally different section, or id's own parent container)
 * would change LAYER_ORDER without changing anything visible, since they
 * were never being compared against each other in the first place.
 * @param id the element's data-edit-id or data-resize-id
 * @param dir +1 to bring forward one step, -1 to send backward one step
 * @return true if it actually moved, false at either end of its group (so
 *   pushLayerUndo() knows not to record a no-op step)
 */
function moveLayer(id, dir) {
  var el = document.querySelector('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]');
  var scope = el ? nearestTrackedAncestorId(el) : "";
  function scopeOf(otherId) {
    var oe = document.querySelector('[data-edit-id="' + otherId + '"], [data-resize-id="' + otherId + '"]');
    return oe ? nearestTrackedAncestorId(oe) : "";
  }
  var i = LAYER_ORDER.indexOf(id);
  if (i === -1) { LAYER_ORDER.push(id); i = LAYER_ORDER.length - 1; }
  var group = isFixed(id);
  var j = i + dir;
  while (j >= 0 && j < LAYER_ORDER.length &&
         (isFixed(LAYER_ORDER[j]) !== group || scopeOf(LAYER_ORDER[j]) !== scope)) j += dir;
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  snapshot.layers = order;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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
 * Which css property a color override actually lands on, for a given
 * element: an icon (svg, currentColor stroke/fill throughout this
 * codebase's icon set) gets its foreground color; a plain click-to-edit
 * text field gets its font color; everything else (cards, sections, nav,
 * footer, buttons, the countdown box) gets its background color, since
 * that's the only visible surface a resize-id container has.
 * @param el the element
 * @return "icon", "text", or "bg"
 */
function colorTarget(el) {
  if (elKind(el) === "icon") return "icon";
  var isButton = el.tagName === "A" && el.classList.contains("btn");
  if (el.hasAttribute("data-edit-id") && !isButton) return "text";
  return "bg";
}

/**
 * Paints one element's color override onto whichever css property
 * colorTarget() says it should (icon/text color both use el.style.color,
 * currentColor is how every svg icon in this codebase is drawn).
 * @param el the element
 * @param value a css color string, or "" to clear back to the template default
 */
function setElementColor(el, value) {
  if (colorTarget(el) === "bg") el.style.backgroundColor = value;
  else el.style.color = value;
}

/**
 * Applies saved color overrides (from the style popover, see
 * buildStyleMenu()) on top of the page's own default colors. Runs on every
 * load, live site included, same as applyTextOverrides(). Images/videos
 * are deliberately skipped: a background color painted behind an
 * object-fit: cover element is never visible, there's nothing for a color
 * picker to usefully do there.
 * @param colors content.colors, {id: css color string}
 */
function applyColorOverrides(colors) {
  colors = colors || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = colors[elId(el)];
    if (!v || elKind(el) === "img") return;
    setElementColor(el, v);
  });
}

/**
 * Applies saved opacity overrides (from the style popover's slider) on top
 * of the page's own default (fully opaque). Runs on every load, live site
 * included, same as applyTextOverrides().
 * @param opacity content.opacity, {id: number 0-1}
 */
function applyOpacityOverrides(opacity) {
  opacity = opacity || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = opacity[elId(el)];
    if (v === undefined || v === null) return;
    el.style.opacity = String(v);
  });
}

/**
 * Applies saved textbox background-fill overrides (from the style
 * popover's Fill control) on top of the page's own default (no fill).
 * Runs on every load, live site included, same as applyColorOverrides().
 * @param fill content.fill, {id: css color string}
 */
function applyFillOverrides(fill) {
  fill = fill || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = fill[elId(el)];
    if (!v) return;
    el.style.backgroundColor = v;
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
 */
function applyBorderOverrides(border) {
  border = border || {};
  document.querySelectorAll(RESIZABLE_SEL).forEach(function (el) {
    var v = border[elId(el)];
    if (!v || !v.w) return;
    el.style.border = v.w + "px solid " + v.color;
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
var STYLE_FILL_BEFORE = "";
var STYLE_RADIUS_BEFORE = "0";
var STYLE_BORDER_BEFORE = { w: 0, color: "#000000" };

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
      '<label>Color</label>' +
      '<input type="color" class="sm-color">' +
      '<button type="button" class="sm-color-reset" title="Reset to default">×</button>' +
    '</div>' +
    '<div class="sm-row sm-fill-row">' +
      '<label>Fill</label>' +
      '<input type="color" class="sm-fill">' +
      '<button type="button" class="sm-fill-reset" title="Reset to default">×</button>' +
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
    '<div class="sm-row sm-shape-row sm-shadow-row">' +
      '<label>Shadow</label>' +
      '<input type="checkbox" class="sm-shadow">' +
    '</div>' +
    '<div class="sm-row">' +
      '<label>Opacity</label>' +
      '<input type="range" class="sm-opacity" min="10" max="100" step="1">' +
      '<span class="sm-opacity-val">100%</span>' +
    '</div>';
  document.body.appendChild(STYLE_MENU);

  var colorInput = STYLE_MENU.querySelector(".sm-color");
  var colorReset = STYLE_MENU.querySelector(".sm-color-reset");
  var fillInput = STYLE_MENU.querySelector(".sm-fill");
  var fillReset = STYLE_MENU.querySelector(".sm-fill-reset");
  var radiusInput = STYLE_MENU.querySelector(".sm-radius");
  var radiusVal = STYLE_MENU.querySelector(".sm-radius-val");
  var borderW = STYLE_MENU.querySelector(".sm-border-w");
  var borderVal = STYLE_MENU.querySelector(".sm-border-val");
  var borderColor = STYLE_MENU.querySelector(".sm-border-color");
  var shadowInput = STYLE_MENU.querySelector(".sm-shadow");
  var opacityInput = STYLE_MENU.querySelector(".sm-opacity");
  var opacityVal = STYLE_MENU.querySelector(".sm-opacity-val");

  [colorInput, colorReset, fillInput, fillReset, radiusInput, borderW, borderColor, shadowInput, opacityInput].forEach(function (el) {
    el.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  });

  colorInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    setElementColor(el, colorInput.value);
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
    setElementColor(el, "");
    saveEditedColor(STYLE_MENU_ID, "");
    var after = currentColorValue(el);
    colorInput.value = after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "color", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_COLOR_BEFORE = "";
  });

  fillInput.addEventListener("input", function () {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    el.style.backgroundColor = fillInput.value;
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
    el.style.backgroundColor = "";
    saveEditedFill(STYLE_MENU_ID, "");
    var after = currentFillValue(el);
    fillInput.value = after;
    if (before !== "") {
      EDIT_UNDO.push({ type: "fill", id: STYLE_MENU_ID, before: before, after: "" });
      EDIT_REDO.length = 0;
    }
    STYLE_FILL_BEFORE = "";
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

  function commitBorder() {
    if (!STYLE_MENU_ID) return;
    var el = styleMenuEl();
    if (!el) return;
    var w = parseInt(borderW.value, 10);
    if (w > 0) el.style.border = w + "px solid " + borderColor.value;
    else el.style.border = "none";
    borderVal.textContent = w + "px";
    saveEditedBorder(STYLE_MENU_ID, w, borderColor.value);
  }
  borderW.addEventListener("input", commitBorder);
  borderColor.addEventListener("input", commitBorder);
  borderW.addEventListener("change", function () {
    if (!STYLE_MENU_ID) return;
    var after = { w: parseInt(borderW.value, 10), color: borderColor.value };
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
    var v = (parseFloat(opacityInput.value) / 100).toFixed(2);
    el.style.opacity = v;
    opacityVal.textContent = opacityInput.value + "%";
    saveEditedOpacity(STYLE_MENU_ID, parseFloat(v));
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
 * Converts a computed "rgb(r, g, b)"/"rgba(r, g, b, a)" string to a
 * "#rrggbb" hex string an <input type=color> can take as its value.
 * @param rgb the computed color string
 * @return a hex string, or "" if it couldn't be parsed (eg "transparent")
 */
function rgbToHex(rgb) {
  var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb || "");
  if (!m) return "";
  function hex(n) { return ("0" + parseInt(n, 10).toString(16)).slice(-2); }
  return "#" + hex(m[1]) + hex(m[2]) + hex(m[3]);
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
  var cs = getComputedStyle(el).backgroundColor;
  var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(cs || "");
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return "#ffffff";
  return rgbToHex(cs) || "#ffffff";
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
  var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(cs.borderTopColor || "");
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === 0)) return { w: 0, color: "#000000" };
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
  var isText = colorTarget(el) === "text";
  STYLE_MENU.querySelector(".sm-color-row").style.display = isImg ? "none" : "";
  STYLE_MENU.querySelector(".sm-fill-row").style.display = isText ? "" : "none";
  var shapeDisplay = isIcon ? "none" : "";
  STYLE_MENU.querySelectorAll(".sm-shape-row").forEach(function (row) { row.style.display = shapeDisplay; });

  var colorInput = STYLE_MENU.querySelector(".sm-color");
  var fillInput = STYLE_MENU.querySelector(".sm-fill");
  var radiusInput = STYLE_MENU.querySelector(".sm-radius");
  var radiusVal = STYLE_MENU.querySelector(".sm-radius-val");
  var borderW = STYLE_MENU.querySelector(".sm-border-w");
  var borderVal = STYLE_MENU.querySelector(".sm-border-val");
  var borderColor = STYLE_MENU.querySelector(".sm-border-color");
  var shadowInput = STYLE_MENU.querySelector(".sm-shadow");
  var opacityInput = STYLE_MENU.querySelector(".sm-opacity");
  var opacityVal = STYLE_MENU.querySelector(".sm-opacity-val");

  colorInput.value = currentColorValue(el);
  STYLE_COLOR_BEFORE = colorInput.value;

  if (isText) {
    fillInput.value = currentFillValue(el);
    STYLE_FILL_BEFORE = fillInput.value;
  }

  if (!isIcon) {
    var rad = currentRadiusValue(el);
    radiusInput.value = rad;
    radiusVal.textContent = rad + "px";
    STYLE_RADIUS_BEFORE = String(rad);

    var bd = currentBorderValue(el);
    borderW.value = bd.w;
    borderVal.textContent = bd.w + "px";
    borderColor.value = bd.color;
    STYLE_BORDER_BEFORE = bd;

    shadowInput.checked = currentShadowOn(el);
  }

  var op = Math.round((parseFloat(getComputedStyle(el).opacity) || 1) * 100);
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
  if (!RING_EL || isLocked(elId(RING_EL))) return;
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
    commitPosition(el);
    pushMoveUndo(elId(el), base, p);
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
 * (display:none for a plain element, inert-but-present for a link wrapping
 * other tracked elements, see its doc comment); this just applies that to
 * every matching element and persists the change.
 * @param id the element's data-edit-id or data-resize-id
 * @param hidden true to hide/delete it, false to restore it
 */
function setElementHidden(id, hidden) {
  document.querySelectorAll('[data-edit-id="' + id + '"], [data-resize-id="' + id + '"]').forEach(function (el) {
    setHiddenVisual(el, hidden);
  });
  saveEditedVisibility(id, hidden);
}

/**
 * Deletes the currently-selected element (ring's trash handle, or the
 * Delete/Backspace key, see wireResizable()), and it really is deleted, same
 * as anything else in the editor (see setHiddenVisual() for how a link
 * wrapping other tracked elements, eg the brand link around the logo image
 * and brand text, is handled differently so it can't take them down with
 * it). Pushed onto the same undo stack as a text edit so Ctrl+Z brings it
 * right back.
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
 * `<video>`, same object-fit: cover. An icon (the catch-all last branch)
 * with a `d.url` is a ta-uploaded icon (see fetchCustomAssets()) rendered as
 * a plain `<img>` rather than parsed svg markup; `elKind()` already treats
 * any "icon."-prefixed id as icon kind (locked aspect ratio) regardless of
 * tag, so this needs no special-casing anywhere else.
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snap;
  try { snap = raw ? JSON.parse(raw) : {}; } catch (e) { snap = {}; }
  var plainMaps = ["sizes", "positions", "font_sizes", "colors", "opacity", "text", "fill", "radius", "border", "links"];
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
  try { localStorage.setItem("preview_content", JSON.stringify(snap)); } catch (e) {}
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snap;
  try { snap = raw ? JSON.parse(raw) : {}; } catch (e) { snap = {}; }
  if (!Array.isArray(snap.duplicates)) snap.duplicates = [];
  snap.duplicates.push({ sourceId: sourceId, suffix: suffix });
  try { localStorage.setItem("preview_content", JSON.stringify(snap)); } catch (e) {}
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
 * Adds one new element via the visual editor's right-click "Add element"
 * menu (see wireAddElementMenu()): built through buildCustomElement(), the
 * exact same construction that recreates it on every future load, then
 * measured/frozen at its just-rendered size and pushed onto
 * content.custom_elements so it round-trips through Apply/profiles like
 * everything else the editor creates. Always lands on the very top of the
 * stacking order (see moveLayer()), matching what a ta would expect from
 * something they just placed.
 * @param kind "text", "button", "box", "image", "video", or "icon"
 * @param x left, document px (where the menu was opened)
 * @param y top, document px
 * @param extra {icon, url} for kind "icon" (a built-in's svg markup, or an
 *   uploaded one's url), {href} for kind "button", {url} for kind "image"/
 *   "video" (the uploaded file's url, see uploadEditorFile())
 * @return the new element
 */
function addCustomElement(kind, x, y, extra) {
  extra = extra || {};
  var uid = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var d = { id: (kind === "icon" ? "icon.custom." : "custom." + kind + ".") + uid, kind: kind, left: Math.round(x), top: Math.round(y) };
  if (kind === "icon") { d.icon = extra.icon; d.url = extra.url; }
  if (kind === "image" || kind === "video") d.url = extra.url;
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
  /* a button's own initial link (see LINKS/applyOneLink()) is part of its
     creation, not a separately undoable step: undoing the "add" below
     just hides the button, href and all, so redoing brings the same link
     straight back with no extra bookkeeping needed here */
  if (kind === "button" && extra.href) {
    applyOneLink(el, extra.href);
    LINKS[d.id] = extra.href;
    saveEditedLink(d.id, extra.href);
    applyLinkHighlight();
  }
  /* undoing an add just hides the new element again (setElementHidden(),
     same "before" state a delete leaves behind), rather than actually
     unbuilding it: the element and its content.custom_elements entry both
     stay around either way, so redo can just unhide it instead of having
     to rebuild it from scratch. */
  EDIT_UNDO.push({ type: "add", id: d.id });
  EDIT_REDO.length = 0;
  return el;
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
 * Remove from navbar, then the 6 things that can be added. Duplicate is
 * left out for the countdown box/info tiles (ids starting "countdown."/
 * "logistics.") and anything containing #heroCountdown/#logisticsGrid
 * (eg the whole logistics section): those render their content from their
 * own structured content fields (content.logistics, the countdown's text
 * overrides) via getElementById(), not static template markup a generic
 * clone can carry over, so a duplicate of one would come out empty (or
 * carry dead, un-restorable copies of their nested ids) the moment it's
 * reconstructed on a reload rather than just visually copied in the
 * moment, see duplicateElement()'s doc comment.
 */
function renderCtxMenuRoot() {
  var toggleHtml = "";
  if (CTX_TARGET_ID) {
    var isSpecial = CTX_TARGET_ID.indexOf("logistics.") === 0 || CTX_TARGET_ID.indexOf("countdown.") === 0 ||
      (CTX_TARGET_EL && CTX_TARGET_EL.querySelector && CTX_TARGET_EL.querySelector("#heroCountdown, #logisticsGrid"));
    toggleHtml =
      '<div class="ctx-title">This element</div>' +
      (isSpecial ? "" : '<button type="button" data-dup="1">Duplicate</button>') +
      '<button type="button" data-link-edit="1">' +
      (LINKS[CTX_TARGET_ID] ? "Edit link" : "Add link") +
      '</button>' +
      '<button type="button" data-lock-toggle="1">' +
      (isLocked(CTX_TARGET_ID) ? "Unlock element" : "Lock element") +
      '</button>' +
      '<button type="button" data-fixed-toggle="1">' +
      (isFixed(CTX_TARGET_ID) ? "Remove from navbar" : "Promote to navbar") +
      '</button>';
  }
  CTX_MENU.innerHTML =
    toggleHtml +
    '<div class="ctx-title">Add element</div>' +
    '<button type="button" data-add="text">Textbox</button>' +
    '<button type="button" data-add="box">Box</button>' +
    '<button type="button" data-add="image">Image</button>' +
    '<button type="button" data-add="video">Video</button>' +
    '<button type="button" data-add="icon">Icon</button>' +
    '<button type="button" data-add="button">Button</button>';
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
  CTX_MENU.innerHTML =
    '<div class="ctx-title">Choose an icon</div>' +
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
      addCustomElement("icon", CTX_POS.x, CTX_POS.y, { icon: ic.svg });
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
          addCustomElement("icon", CTX_POS.x, CTX_POS.y, svg ? { icon: svg } : { url: ic.url });
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
 * Handles a click on one of the root menu's 6 options: textbox/box add
 * immediately and close the menu, icon/button/image/video swap to a
 * picker/link/file sub-view first.
 * @param kind "text", "box", "image", "video", "icon", or "button"
 */
function handleCtxAdd(kind) {
  if (kind === "icon") { renderCtxMenuIconPicker(); return; }
  if (kind === "button") { renderCtxMenuButtonLink(); return; }
  if (kind === "image") { renderCtxMenuImagePicker(); return; }
  if (kind === "video") { renderCtxMenuVideoPicker(); return; }
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
    var t = e.target.closest ? e.target.closest(RESIZABLE_SEL) : null;
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
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (CTX_MENU && CTX_MENU.classList.contains("show")) hideCtxMenu();
    if (LAYER_MENU && LAYER_MENU.classList.contains("show")) hideLayerMenu();
    if (STYLE_MENU && STYLE_MENU.classList.contains("show")) hideStyleMenu();
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
    /* locked: don't even start tracking a possible drag, see isLocked() */
    if (isLocked(elId(el))) return;

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
      commitPosition(el);
      pushMoveUndo(elId(el), base, p);
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
    if (!RING_EL || isLocked(elId(RING_EL))) return;
    var active = document.activeElement;
    if (active && (active.isContentEditable || active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    e.preventDefault();
    var el = RING_EL;
    var step = e.shiftKey ? 10 : 1;
    detachFromFlow(el);
    var before = getPos(el);
    var after = { tx: before.tx + d[0] * step, ty: before.ty + d[1] * step };
    setOwnPos(el, after.tx, after.ty);
    positionRing();
    commitPosition(el);
    pushMoveUndo(elId(el), before, after);
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
  var colorInput = TEXT_TOOLBAR.querySelector(".tt-color");
  colorInput.addEventListener("mousedown", function (e) { e.stopPropagation(); });
  colorInput.addEventListener("input", function () {
    document.execCommand("foreColor", false, colorInput.value);
  });
  colorInput.addEventListener("change", function () {
    if (TEXT_TOOLBAR_EL) TEXT_TOOLBAR_EL.focus();
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
  var curColor = "";
  try { curColor = document.queryCommandValue("foreColor"); } catch (e) {}
  TEXT_TOOLBAR.querySelector(".tt-color").value = rgbToHex(curColor) || "#000000";
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
  if (action.type === "fontsize") {
    var fsEl = document.querySelector('[data-edit-id="' + action.id + '"]');
    if (!fsEl) return;
    fsEl.style.fontSize = val || "";
    saveFontSize(action.id, val || "");
    return;
  }
  if (action.type === "align" || action.type === "letterspacing") {
    var styleEl = document.querySelector('[data-edit-id="' + action.id + '"]');
    if (!styleEl) return;
    if (action.type === "align") {
      styleEl.style.textAlign = val;
      saveTextStyle(action.id, "align", val);
      if (TEXT_TOOLBAR_EL === styleEl) updateTextToolbarState();
    } else {
      styleEl.style.letterSpacing = val;
      saveTextStyle(action.id, "letterSpacing", val);
    }
    return;
  }
  if (action.type === "fontfamily") {
    var fontEl = document.querySelector('[data-edit-id="' + action.id + '"]');
    if (!fontEl) return;
    if (val.url) ensureFontFace(val.family, val.url);
    fontEl.style.fontFamily = val.family;
    saveFontFamily(action.id, val.family, val.url);
    if (TEXT_TOOLBAR_EL === fontEl) {
      TEXT_TOOLBAR.querySelector(".tt-font").value = val.family;
      updateFontDeleteButton();
    }
    return;
  }
  if (action.type === "color") {
    var colorEl = styleMenuElById(action.id);
    if (!colorEl) return;
    setElementColor(colorEl, val || "");
    saveEditedColor(action.id, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-color").value = currentColorValue(colorEl);
      STYLE_COLOR_BEFORE = val || "";
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
    fillEl.style.backgroundColor = val || "";
    saveEditedFill(action.id, val || "");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-fill").value = currentFillValue(fillEl);
      STYLE_FILL_BEFORE = val || "";
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
    if (bw > 0) bdEl.style.border = bw + "px solid " + val.color;
    else bdEl.style.border = "none";
    saveEditedBorder(action.id, bw, val ? val.color : "#000000");
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-border-w").value = bw;
      STYLE_MENU.querySelector(".sm-border-val").textContent = bw + "px";
      STYLE_MENU.querySelector(".sm-border-color").value = val ? val.color : "#000000";
      STYLE_BORDER_BEFORE = { w: bw, color: val ? val.color : "#000000" };
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
    opEl.style.opacity = (pct / 100).toFixed(2);
    saveEditedOpacity(action.id, pct / 100);
    if (STYLE_MENU_ID === action.id) {
      STYLE_MENU.querySelector(".sm-opacity").value = pct;
      STYLE_MENU.querySelector(".sm-opacity-val").textContent = pct + "%";
      STYLE_OPACITY_BEFORE = String(pct);
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
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
 * Persists a color pick from the style popover (see buildStyleMenu()) into
 * the preview snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param value a css color string, or "" to clear back to the template default
 */
function saveEditedColor(id, value) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.colors || typeof snapshot.colors !== "object") snapshot.colors = {};
  if (!value) delete snapshot.colors[id];
  else snapshot.colors[id] = value;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists an opacity change from the style popover's slider into the
 * preview snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param value a number 0-1, or null/1 to clear back to the template default
 */
function saveEditedOpacity(id, value) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.opacity || typeof snapshot.opacity !== "object") snapshot.opacity = {};
  if (value === null || value === undefined || value >= 1) delete snapshot.opacity[id];
  else snapshot.opacity[id] = value;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.fill || typeof snapshot.fill !== "object") snapshot.fill = {};
  if (!value) delete snapshot.fill[id];
  else snapshot.fill[id] = value;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a border-radius change from the style popover's Radius slider.
 * @param id the element's data-edit-id or data-resize-id
 * @param px a whole-number px value, 0 to clear back to the template default
 */
function saveEditedRadius(id, px) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.radius || typeof snapshot.radius !== "object") snapshot.radius = {};
  if (!px) delete snapshot.radius[id];
  else snapshot.radius[id] = px;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a border width/color change from the style popover's Border row.
 * @param id the element's data-edit-id or data-resize-id
 * @param w border width in css px, 0 to clear back to no border
 * @param color a css color string (ignored when w is 0)
 */
function saveEditedBorder(id, w, color) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.border || typeof snapshot.border !== "object") snapshot.border = {};
  if (!w) delete snapshot.border[id];
  else snapshot.border[id] = { w: w, color: color };
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
}

/**
 * Persists a right-click "Add link"/"Edit link" change into the preview
 * snapshot, the same draft everything else here uses.
 * @param id the element's data-edit-id or data-resize-id
 * @param url the link target, or "" to clear it
 */
function saveEditedLink(id, url) {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!snapshot.links || typeof snapshot.links !== "object") snapshot.links = {};
  if (!url) delete snapshot.links[id];
  else snapshot.links[id] = url;
  try { localStorage.setItem("preview_content", JSON.stringify(snapshot)); } catch (e) {}
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
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  var snapshot;
  try { snapshot = raw ? JSON.parse(raw) : {}; } catch (e) { snapshot = {}; }
  if (!Array.isArray(snapshot.shadow)) snapshot.shadow = [];
  var idx = snapshot.shadow.indexOf(id);
  if (on && idx === -1) snapshot.shadow.push(id);
  else if (!on && idx !== -1) snapshot.shadow.splice(idx, 1);
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
      renderDuplicates(data.duplicates);
      applyTextOverrides(textMap);
      applySizeOverrides(data.sizes);
      applyFontSizeOverrides(data.font_sizes);
      applyTextStyleOverrides(data.text_styles);
      applyPositionOverrides(data.positions);
      applyColorOverrides(data.colors);
      applyFillOverrides(data.fill);
      applyRadiusOverrides(data.radius);
      applyBorderOverrides(data.border);
      applyShadowOverrides(data.shadow);
      applyOpacityOverrides(data.opacity);
      applyHiddenOverrides(data.hidden);
      setFixedElements(data.fixed_elements);
      setLockedElements(data.locked);
      setLinks(data.links);
      applyLayerOrder(data.layers);
      applyFixedHighlight();
      applyLinkHighlight();
      applyLockHighlight();
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
