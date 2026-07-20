/* ta portal. everything edits the in-memory STATE object below; loaded from
   and saved to /api/content, which is the single source of truth. */

/**
 * Returns a fresh default content blob, used for a brand-new profile and
 * to fill in missing fields in normalizeState().
 * @return the default content shape
 */
function seed() {
  return {
    total_days: 10,
    days: [
      { day: 1, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] },
      { day: 2, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] }
    ],
    extras: [],
    timer_mode: "tentative", /* tentative | actual */
    timer_target: "",
    join_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    apply_tooltip: "Applications open once the workshop dates are confirmed, check back soon.",
    logistics: [
      { big: "2 weeks", lbl: "Tentative start date", icon: false },
      { big: "4 hours", lbl: "1:30pm–5:30pm", icon: false },
      { big: "SFB520", lbl: "Sandford Fleming", icon: false },
      { big: "", lbl: "Certificate of completion", icon: true }
    ],
    gallery: {
      years: ["2026", "2025"],
      images: {
        "2026": ["assets/gallery/group-main-2026.png"],
        "2025": ["assets/gallery/group_photo_2025.jpg"]
      }
    },
    /* click-to-edit overrides for hardcoded landing page copy (hero, about,
       schedule, etc), keyed by the data-edit-id on the element in
       index.html. empty means "show the page's own default text". set from
       the click-to-edit ui in preview.html, see js/main.js's editMode(). */
    text: {}
  };
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
 * Reverses one level of "typed/pasted as utf-8, misread as windows-1252"
 * mojibake (eg. an en dash that shows up as "Ã¢â‚¬â€œ"), without touching
 * genuinely accented text: only fires if every character in the string
 * maps to a single cp1252 byte AND those bytes form valid utf-8, which
 * plain latin-1 text almost never does by chance. A snapshot that got
 * corrupted before ever reaching the server (eg. a stale unsaved draft
 * restored by tryRestoreFromPreview()) fixes itself here instead of
 * resurfacing forever.
 * @param str the string to check/repair
 * @return the repaired string, or the original untouched if it wasn't mojibake
 */
function repairMojibake(str) {
  if (typeof str !== "string" || !str.length) return str;
  /* a snapshot can get corrupted more than once (typed, saved corrupted,
     loaded and resaved corrupted again), so keep unwrapping a level at a
     time until nothing changes, capped so a weird string can't loop forever */
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
 * corrupted text anywhere in a loaded/restored blob (day panels, extras,
 * logistics labels, etc) fixes itself.
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
 * Fills in fields that may be missing from content saved before these were
 * added (or before the workshop-dates tile got folded into the generic
 * logistics list), so older saved blobs don't blow up the ta portal.
 */
function normalizeState() {
  STATE = repairMojibakeDeep(STATE);
  var oldDatesLbl = (STATE.date_mode === "confirmed" && STATE.start_date && STATE.end_date) ?
    formatDateRange(STATE.start_date, STATE.end_date) : "Tentative start date";
  var oldWeeksBig = STATE.weeks_label || "2 weeks";
  var hadDateFields = STATE.weeks_label !== undefined || STATE.date_mode !== undefined;

  if (!Array.isArray(STATE.logistics) || !STATE.logistics.length) {
    STATE.logistics = seed().logistics;
    STATE.logistics[0].big = oldWeeksBig;
    STATE.logistics[0].lbl = oldDatesLbl;
  } else if (hadDateFields) {
    STATE.logistics.unshift({ big: oldWeeksBig, lbl: oldDatesLbl, icon: false });
  }

  delete STATE.weeks_label;
  delete STATE.date_mode;
  delete STATE.start_date;
  delete STATE.end_date;
  if (STATE.join_url === undefined) STATE.join_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  if (STATE.apply_tooltip === undefined) {
    STATE.apply_tooltip = "Applications open once the workshop dates are confirmed, check back soon.";
  }
  if (!STATE.total_days) STATE.total_days = 10;
  if (!STATE.gallery || !Array.isArray(STATE.gallery.years)) STATE.gallery = seed().gallery;

  if (!STATE.text || typeof STATE.text !== "object") STATE.text = {};
  /* footer contact line used to be its own field, edited from a dedicated
     input in this section; now it's click-to-edit like the rest of the
     landing page copy, so fold any already-saved value in once and stop
     tracking it separately */
  if (STATE.text["footer.contact"] === undefined && STATE.contact_text) {
    STATE.text["footer.contact"] = STATE.contact_text;
  }
  delete STATE.contact_text;
}

var STATE = seed();

var PROFILES = [];  /* saved drafts from /api/profiles */
var EDITING = null; /* null = editing the live site, else the open profile */

var previewWindow = null; /* the tab opened by openPreview(), if still around */

/* "manager" (the form-based content manager) or "editor" (the embedded
   click-to-edit iframe), see showMode(). Both views edit the same STATE. */
var TA_MODE = "manager";

/**
 * Builds the Authorization header for a ta-only request.
 * @return a {Authorization} headers object
 */
function authHeaders() {
  return { "Authorization": "Bearer " + (localStorage.getItem("token") || "") };
}

/**
 * The server says the session's gone (idle timeout, or the account got
 * removed): clears local state and bounces to login with a message instead
 * of quietly failing every button on the page.
 */
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
  var el = document.getElementById("taMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/**
 * Uploads one file.
 * @param file the File object from a file input
 * @return a promise resolving to the {type:"file", name, url} attachment entry
 */
function uploadFile(file) {
  var fd = new FormData();
  fd.append("file", file);
  return authedFetch("/api/upload", { method: "POST", body: fd })
    .then(function (res) {
      if (!res.ok) throw new Error("upload failed");
      return res.json();
    })
    .then(function (data) {
      return { type: "file", name: data.name, url: data.url };
    });
}

/**
 * Formats the current moment for a datetime-local input (which wants local
 * time; toISOString gives utc).
 * @return a "yyyy-mm-ddThh:mm" local timestamp
 */
function nowLocal() {
  var n = new Date();
  var p = function (x) { return (x < 10 ? "0" : "") + x; };
  return n.getFullYear() + "-" + p(n.getMonth() + 1) + "-" + p(n.getDate()) +
    "T" + p(n.getHours()) + ":" + p(n.getMinutes());
}

var X_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

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

var LINK_SVG_BTN =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>';

var LINK_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>';

var FILE_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>';

var IMAGE_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>' +
  '<path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';

var DOC_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>' +
  '<path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>';

var SLIDES_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="M7 21l5-5 5 5"/></svg>';

var VID_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-3v10l-6-3"/></svg>';

var IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "tiff", "heic"];
var DOC_EXTS = ["pdf", "doc", "docx", "txt", "rtf", "odt", "pages"];
var SLIDES_EXTS = ["ppt", "pptx", "key", "odp"];

/* three-node share glyph, next to "shared" on a profile row */
var SHARE_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/>' +
  '<path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>';

/* attachments are a plain filename string (legacy), a {type:"link", value}
   object, or a {type:"file", name, url} object for an uploaded file */

/**
 * Checks whether an attachment is a link entry.
 * @param item an attachment (string or {type, ...} object)
 * @return true if it's a {type:"link", value} entry
 */
function isLink(item) { return item && typeof item === "object" && item.type === "link"; }

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

/**
 * Picks an icon off the file extension in the attachment's name, same rule
 * as js/dashboard.js. Falls back to a generic file glyph.
 * @param item an attachment (string or {type, ...} object)
 * @return an inline svg icon string
 */
function itemIcon(item) {
  if (isLink(item)) return LINK_SVG_CHIP;
  var name = itemLabel(item) || "";
  var m = /\.([a-z0-9]+)$/i.exec(name);
  var ext = m ? m[1].toLowerCase() : "";
  if (IMAGE_EXTS.indexOf(ext) !== -1) return IMAGE_SVG_CHIP;
  if (DOC_EXTS.indexOf(ext) !== -1) return DOC_SVG_CHIP;
  if (SLIDES_EXTS.indexOf(ext) !== -1) return SLIDES_SVG_CHIP;
  return FILE_SVG_CHIP;
}

var CHECK_ICON_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>';

/**
 * Builds one preview tile, same markup as the real one on index.html, but
 * click-to-edit: the big text and label are editable right here, and a
 * commit writes straight back into the tile data (STATE.logistics, since
 * this is a reference into that array) and refreshes the input list below
 * (renderLogistics()) so the two views of the same data never drift apart.
 * @param t {big, lbl, icon} tile data, a reference into STATE.logistics
 * @return the tile's card element
 */
function logisticsPreviewTile(t) {
  var card = document.createElement("div");
  card.className = "card stat ta-live-stat";
  var big = document.createElement("div");
  big.className = "big";
  if (t.icon) {
    big.innerHTML = CHECK_ICON_SVG;
  } else {
    big.textContent = t.big;
    wireInlineEdit(big, function (text) { t.big = text; renderLogistics(); });
  }
  var lbl = document.createElement("div");
  lbl.className = "lbl";
  lbl.textContent = t.lbl;
  wireInlineEdit(lbl, function (text) { t.lbl = text; renderLogistics(); });
  card.appendChild(big);
  card.appendChild(lbl);
  return card;
}

/**
 * Turns one element into a click-to-edit text field: click makes it
 * contenteditable, Enter/blur commits (calling onCommit with the new
 * text), Escape cancels back to whatever it said before this edit. A
 * smaller, local sibling of js/main.js's wireClickToEdit(): this edits
 * STATE directly (no localStorage/undo stack) since it's mirroring fields
 * that already have their own input in the form below, not a hardcoded
 * page default the way index.html's copy is.
 * @param el the element to make editable
 * @param onCommit called with the trimmed text once an edit is committed
 */
function wireInlineEdit(el, onCommit) {
  el.classList.add("inline-editable");
  var before = "";
  el.addEventListener("click", function () {
    if (el.isContentEditable) return;
    before = el.textContent;
    el.contentEditable = "true";
    el.classList.add("editing");
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
    if (e.key === "Escape") { e.preventDefault(); el.textContent = before; el.blur(); }
  });
  el.addEventListener("blur", function () {
    if (!el.isContentEditable) return;
    el.contentEditable = "false";
    el.classList.remove("editing");
    if (el.textContent !== before) onCommit(el.textContent);
  });
}

/* same markup as the hero on index.html, tba box vs the (still stubbed) real clock */
var CD_TBA_HTML =
  '<div class="countdown cd-tba">' +
    '<svg class="cd-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>' +
    '<div><span class="cd-label accent">Date and time</span>' +
    '<b class="cd-tba-txt">To be announced</b></div>' +
  '</div>';

var CD_CLOCK_HTML =
  '<div class="countdown">' +
    '<span class="cd-label">Workshop begins in</span>' +
    '<div class="cd-clock">' +
      '<div class="cd-unit"><b id="pv-cd-d">00</b><span>days</span></div>' +
      '<div class="cd-unit"><b id="pv-cd-h">00</b><span>hrs</span></div>' +
      '<div class="cd-unit"><b id="pv-cd-m">00</b><span>min</span></div>' +
      '<div class="cd-unit"><b id="pv-cd-s">00</b><span>sec</span></div>' +
    '</div>' +
  '</div>';

/**
 * Formats a date range as "Mon D to Mon D, YYYY".
 * @param start iso date string (yyyy-mm-dd)
 * @param end iso date string (yyyy-mm-dd)
 * @return the formatted range, or a placeholder if either date is missing
 */
function formatDateRange(start, end) {
  if (!start || !end) return "No dates set yet";
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var s = new Date(start + "T00:00:00");
  var e = new Date(end + "T00:00:00");
  return months[s.getMonth()] + " " + s.getDate() + " to " +
    months[e.getMonth()] + " " + e.getDate() + ", " + e.getFullYear();
}

var previewTickHandle = null;

/**
 * Ticks the preview clock digits every second, same math as js/main.js.
 * @param target iso datetime string to count down to
 */
function tickPreviewCountdown(target) {
  var targetMs = new Date(target).getTime();
  function tick() {
    var diff = targetMs - Date.now();
    if (diff < 0) diff = 0;
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    var dEl = document.getElementById("pv-cd-d");
    var hEl = document.getElementById("pv-cd-h");
    var mEl = document.getElementById("pv-cd-m");
    var sEl = document.getElementById("pv-cd-s");
    if (dEl) dEl.textContent = p(d);
    if (hEl) hEl.textContent = p(h);
    if (mEl) mEl.textContent = p(m);
    if (sEl) sEl.textContent = p(s);
  }
  tick();
  previewTickHandle = setInterval(tick, 1000);
}

/**
 * Reads a countdown text override from STATE.text (the same map the visual
 * editor's click-to-edit fields write into, see js/main.js's
 * saveEditedField()), falling back to the template's own default.
 * @param id the data-edit-id key
 * @param fallback the template's own default text
 * @return the text to render
 */
function countdownText(id, fallback) {
  return (STATE.text && STATE.text[id] !== undefined) ? STATE.text[id] : fallback;
}

/**
 * Wires one countdown label/text node in the mini preview so a click edits
 * it in place, writing straight into STATE.text under the same key the
 * visual editor's click-to-edit fields use (js/main.js's data-edit-id
 * "countdown.tba.label"/"countdown.tba.text"/"countdown.clock.label"), so
 * an edit made here or there shows up in both places, same idea as
 * wireInlineEdit() for logistics tiles. Deletes the key (falls back to the
 * default) if edited back to match it, same rule saveEditedField() uses.
 * @param el the element to wire
 * @param id the STATE.text key
 * @param fallback the template's own default text
 */
function wireCountdownEdit(el, id, fallback) {
  el.classList.add("inline-editable");
  var before = "";
  el.addEventListener("click", function () {
    if (el.isContentEditable) return;
    before = el.textContent;
    el.contentEditable = "true";
    el.classList.add("editing");
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
    if (e.key === "Escape") { e.preventDefault(); el.textContent = before; el.blur(); }
  });
  el.addEventListener("blur", function () {
    if (!el.isContentEditable) return;
    el.contentEditable = "false";
    el.classList.remove("editing");
    var after = el.textContent;
    if (after === before) return;
    if (!STATE.text || typeof STATE.text !== "object") STATE.text = {};
    if (after.trim() === fallback.trim()) delete STATE.text[id];
    else STATE.text[id] = after;
  });
}

/** Mirrors STATE back into the "current selection" preview box. */
function renderPreview() {
  var slot = document.getElementById("previewCountdown");
  if (!slot) return;
  if (previewTickHandle) { clearInterval(previewTickHandle); previewTickHandle = null; }

  var showClock = STATE.timer_mode === "actual" && STATE.timer_target;
  slot.innerHTML = showClock ? CD_CLOCK_HTML : CD_TBA_HTML;

  if (showClock) {
    tickPreviewCountdown(STATE.timer_target);
    var clockLabel = slot.querySelector(".cd-label");
    if (clockLabel) {
      clockLabel.textContent = countdownText("countdown.clock.label", "Workshop begins in");
      wireCountdownEdit(clockLabel, "countdown.clock.label", "Workshop begins in");
    }
  } else {
    var tbaLabel = slot.querySelector(".cd-label");
    var tbaText = slot.querySelector(".cd-tba-txt");
    if (tbaLabel) {
      tbaLabel.textContent = countdownText("countdown.tba.label", "Date and time");
      wireCountdownEdit(tbaLabel, "countdown.tba.label", "Date and time");
    }
    if (tbaText) {
      tbaText.textContent = countdownText("countdown.tba.text", "To be announced");
      wireCountdownEdit(tbaText, "countdown.tba.text", "To be announced");
    }
  }

  var logisticsSlot = document.getElementById("previewLogistics");
  if (logisticsSlot) {
    logisticsSlot.innerHTML = "";
    STATE.logistics.forEach(function (t) { logisticsSlot.appendChild(logisticsPreviewTile(t)); });
  }
}

/**
 * Only ta keys get in here.
 * @return true if a ta is logged in
 */
function gateCheck() {
  var ok = localStorage.getItem("session") && localStorage.getItem("role") === "ta";
  var app = document.getElementById("taApp");
  var gate = document.getElementById("taGate");
  if (app) app.style.display = ok ? "block" : "none";
  if (gate) gate.style.display = ok ? "none" : "block";
  return ok;
}

/** Renders every day panel editor into #panelList and wires up its controls. */
function renderPanels() {
  var list = document.getElementById("panelList");
  if (!list) return;
  var html = "";

  STATE.days.forEach(function (d, i) {
    var chips = d.files.map(function (f, j) {
      return '<span class="ta-file">' + itemIcon(f) + itemLabel(f) +
        '<button class="p-frm" data-f="' + j + '" type="button" aria-label="Remove file">' +
        X_SVG + '</button></span>';
    }).join("");

    html +=
      '<div class="ta-panel" data-i="' + i + '">' +
        '<div class="ta-panel-head">' +
          '<span class="daytag">Day ' + d.day + '</span>' +
          '<span class="badge ' + (d.unlocked ? 'open">' + UNLOCK_SVG + 'Open' : 'locked">' + LOCK_SVG + 'Locked') + '</span>' +
          '<button class="btn btn-ghost p-del" type="button">Remove panel</button>' +
        '</div>' +
        '<div class="ta-row">' +
          '<div class="field"><label>Day #</label>' +
            '<input type="number" min="1" class="p-day" value="' + d.day + '"></div>' +
          '<div class="field"><label>Date shown on card</label>' +
            '<input type="date" class="p-date" value="' + d.date + '"></div>' +
        '</div>' +
        '<div class="ta-row">' +
          '<div class="field"><label>Opens at</label>' +
            '<input type="datetime-local" class="p-open" value="' + d.opens_at + '"></div>' +
          '<div class="field"><label>&nbsp;</label>' +
            '<button class="btn btn-primary p-now" type="button">' +
              (d.unlocked ? 'Close right now' : 'Open right now') + '</button></div>' +
        '</div>' +
        '<div class="field"><label>Title</label>' +
          '<input type="text" class="p-title" value="' + d.title + '"></div>' +
        '<div class="field"><label>Description</label>' +
          '<textarea class="p-blurb" rows="3">' + d.blurb + '</textarea></div>' +
        '<div class="field"><label>Attachments</label>' +
          '<div class="ta-files">' + chips + '</div>' +
          '<label class="btn btn-ghost ta-upload">' +
            '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
            ' Add file<input type="file" class="p-file" multiple hidden></label> ' +
          '<button class="btn btn-ghost p-link-btn" type="button">' + LINK_SVG_BTN + ' Add link</button>' +
          '<div class="ta-link-row p-link-row" style="display:none">' +
            '<input type="url" class="p-link-input" placeholder="https://...">' +
            '<button class="btn btn-primary p-link-add" type="button">Add</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  });

  list.innerHTML = html;

  /* wire every panel back to its STATE entry */
  var panels = list.querySelectorAll(".ta-panel");
  panels.forEach(function (p) {
    var d = STATE.days[+p.getAttribute("data-i")];

    p.querySelector(".p-day").addEventListener("input", function () { d.day = +this.value || 1; });
    p.querySelector(".p-date").addEventListener("input", function () { d.date = this.value; });
    p.querySelector(".p-open").addEventListener("input", function () { d.opens_at = this.value; });
    p.querySelector(".p-title").addEventListener("input", function () { d.title = this.value; });
    p.querySelector(".p-blurb").addEventListener("input", function () { d.blurb = this.value; });

    p.querySelector(".p-now").addEventListener("click", function () {
      if (d.unlocked) {
        if (!confirm("Close Day " + d.day + " for students right now?")) return;
        d.unlocked = false;
      } else {
        if (!confirm("Open Day " + d.day + " for students right now?")) return;
        d.unlocked = true;
        d.opens_at = nowLocal();
      }
      renderPanels();
    });

    p.querySelector(".p-del").addEventListener("click", function () {
      if (!confirm("Remove the Day " + d.day + " panel?")) return;
      STATE.days.splice(STATE.days.indexOf(d), 1);
      renderPanels();
    });

    p.querySelector(".p-file").addEventListener("change", function () {
      var files = Array.prototype.slice.call(this.files);
      if (!files.length) return;
      showMsg("Uploading...", true);
      Promise.all(files.map(uploadFile))
        .then(function (items) {
          items.forEach(function (it) { d.files.push(it); });
          showMsg("Uploaded. Don't forget to save your changes.", true);
          renderPanels();
        })
        .catch(function (err) {
          if (err.message === "expired") return;
          showMsg("Couldn't upload one of the files. Try again.", false);
        });
    });

    p.querySelectorAll(".p-frm").forEach(function (btn) {
      btn.addEventListener("click", function () {
        d.files.splice(+this.getAttribute("data-f"), 1);
        renderPanels();
      });
    });

    var linkRow = p.querySelector(".p-link-row");
    var linkInput = p.querySelector(".p-link-input");
    p.querySelector(".p-link-btn").addEventListener("click", function () {
      linkRow.style.display = "flex";
      linkInput.focus();
    });
    function addPanelLink() {
      var v = linkInput.value.trim();
      if (!v) return;
      d.files.push({ type: "link", value: v });
      renderPanels();
    }
    p.querySelector(".p-link-add").addEventListener("click", addPanelLink);
    linkInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addPanelLink(); }
    });
  });
}

/** Renders the editable "Extra attachments" list into #extraList. */
function renderExtras() {
  var list = document.getElementById("extraList");
  if (!list) return;
  if (!STATE.extras.length) {
    list.innerHTML = '<p class="muted"><strong>Nothing here yet.</strong></p>';
    return;
  }
  var rows = "";
  STATE.extras.forEach(function (f, i) {
    rows +=
      '<div class="res-row">' +
        itemIcon(f) +
        '<span class="rname">' + itemLabel(f) + '</span>' +
        '<button class="btn btn-ghost e-rm" data-f="' + i + '" type="button">Remove</button>' +
      '</div>';
  });
  list.innerHTML = rows;
  list.querySelectorAll(".e-rm").forEach(function (btn) {
    btn.addEventListener("click", function () {
      STATE.extras.splice(+this.getAttribute("data-f"), 1);
      renderExtras();
    });
  });
}

/** Renders the editable list of the "4 hours", "SFB520", certificate, etc tiles. */
function renderLogistics() {
  var list = document.getElementById("logisticsList");
  if (!list) return;
  var html = "";

  STATE.logistics.forEach(function (t, i) {
    html +=
      '<div class="ta-panel" data-i="' + i + '">' +
        '<div class="ta-panel-head">' +
          '<span class="daytag">Tile ' + (i + 1) + '</span>' +
          '<button class="btn btn-ghost lg-del" type="button">Remove tile</button>' +
        '</div>' +
        '<div class="ta-row">' +
          '<div class="field"><label>Big text</label>' +
            '<input type="text" class="lg-big" value="' + t.big + '" ' + (t.icon ? "disabled" : "") + '></div>' +
          '<div class="field"><label>Label text</label>' +
            '<input type="text" class="lg-lbl" value="' + t.lbl + '"></div>' +
        '</div>' +
        '<label class="ta-radio"><input type="checkbox" class="lg-icon" ' + (t.icon ? "checked" : "") + '>' +
          ' Show a checkmark icon instead of the big text</label>' +
      '</div>';
  });

  list.innerHTML = html;

  var panels = list.querySelectorAll(".ta-panel");
  panels.forEach(function (p) {
    var t = STATE.logistics[+p.getAttribute("data-i")];
    var bigInput = p.querySelector(".lg-big");

    bigInput.addEventListener("input", function () { t.big = this.value; renderPreview(); });
    p.querySelector(".lg-lbl").addEventListener("input", function () { t.lbl = this.value; renderPreview(); });
    p.querySelector(".lg-icon").addEventListener("change", function () {
      t.icon = this.checked;
      bigInput.disabled = t.icon;
      renderPreview();
    });
    p.querySelector(".lg-del").addEventListener("click", function () {
      if (!confirm("Remove this tile?")) return;
      STATE.logistics.splice(STATE.logistics.indexOf(t), 1);
      renderLogistics();
      renderPreview();
    });
  });
}

/**
 * Checks whether a gallery url is a video clip.
 * @param u the media url
 * @return true if it's a .MOV clip
 */
function isVidUrl(u) { return /\.mov$/i.test(u); }

var PREV_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

var NEXT_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

/* which image each year's mini viewer is sitting on, survives rerenders */
var GY_IDX = {};

/**
 * Renders the editable per-year photo/clip lists shown on gallery.html.
 * One image at a time per year, same flip-through idea as the public
 * gallery page.
 */
function renderGallery() {
  var list = document.getElementById("galleryList");
  if (!list) return;
  var html = "";

  STATE.gallery.years.forEach(function (y) {
    var imgs = STATE.gallery.images[y] || [];
    var i = GY_IDX[y] || 0;
    if (i >= imgs.length) i = imgs.length ? imgs.length - 1 : 0;
    GY_IDX[y] = i;

    var viewer = "";
    if (imgs.length) {
      var cur = imgs[i];
      var media = isVidUrl(cur) ?
        '<video class="gy-media" src="' + cur + '" autoplay muted loop playsinline></video>' :
        '<img class="gy-media" src="' + cur + '" alt="">';
      viewer =
        '<div class="gy-stage">' +
          '<button class="gy-arrow gy-prev" type="button" aria-label="Previous image">' + PREV_SVG + '</button>' +
          media +
          '<button class="gy-arrow gy-next" type="button" aria-label="Next image">' + NEXT_SVG + '</button>' +
        '</div>' +
        '<div class="gy-bar">' +
          '<span class="gy-count">' + (i + 1) + ' / ' + imgs.length + '</span>' +
          '<span class="gy-kind">' + (isVidUrl(cur) ? VID_SVG_CHIP + 'Video clip' : IMAGE_SVG_CHIP + 'Photo') + '</span>' +
          '<button class="btn btn-ghost gy-rm" type="button">Remove</button>' +
        '</div>';
    } else {
      viewer = '<p class="muted">No images yet.</p>';
    }

    html +=
      '<div class="ta-panel" data-year="' + y + '">' +
        '<div class="ta-panel-head">' +
          '<span class="daytag">' + y + '</span>' +
          '<button class="btn btn-ghost gy-del" type="button">Remove year</button>' +
        '</div>' +
        viewer +
        '<label class="btn btn-ghost ta-upload">' +
          '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
          ' Add image<input type="file" class="gy-file" accept="image/*,video/*" multiple hidden></label> ' +
        '<button class="btn btn-ghost gy-link-btn" type="button">' + LINK_SVG_BTN + ' Add by URL</button>' +
        '<div class="ta-link-row gy-link-row" style="display:none">' +
          '<input type="url" class="gy-link-input" placeholder="https://... or assets/gallery/...">' +
          '<button class="btn btn-primary gy-link-add" type="button">Add</button>' +
        '</div>' +
      '</div>';
  });

  list.innerHTML = html || '<p class="muted">No years yet.</p>';

  list.querySelectorAll(".ta-panel").forEach(function (p) {
    var y = p.getAttribute("data-year");
    var imgs = STATE.gallery.images[y] || [];

    p.querySelector(".gy-del").addEventListener("click", function () {
      if (!confirm('Remove the "' + y + '" year and all its images from the gallery?')) return;
      STATE.gallery.years.splice(STATE.gallery.years.indexOf(y), 1);
      delete STATE.gallery.images[y];
      delete GY_IDX[y];
      renderGallery();
    });

    var prevBtn = p.querySelector(".gy-prev");
    if (prevBtn) prevBtn.addEventListener("click", function () {
      GY_IDX[y] = (GY_IDX[y] - 1 + imgs.length) % imgs.length; /* wraps */
      renderGallery();
    });
    var nextBtn = p.querySelector(".gy-next");
    if (nextBtn) nextBtn.addEventListener("click", function () {
      GY_IDX[y] = (GY_IDX[y] + 1) % imgs.length;
      renderGallery();
    });

    var rmBtn = p.querySelector(".gy-rm");
    if (rmBtn) rmBtn.addEventListener("click", function () {
      imgs.splice(GY_IDX[y], 1);
      renderGallery();
    });

    p.querySelector(".gy-file").addEventListener("change", function () {
      var files = Array.prototype.slice.call(this.files);
      if (!files.length) return;
      showMsg("Uploading...", true);
      Promise.all(files.map(uploadFile))
        .then(function (items) {
          items.forEach(function (it) { STATE.gallery.images[y].push(it.url); });
          GY_IDX[y] = STATE.gallery.images[y].length - 1; /* show what was just added */
          showMsg("Uploaded. Don't forget to save your changes.", true);
          renderGallery();
        })
        .catch(function (err) {
          if (err.message === "expired") return;
          showMsg("Couldn't upload one of the files. Try again.", false);
        });
    });

    var linkRow = p.querySelector(".gy-link-row");
    var linkInput = p.querySelector(".gy-link-input");
    p.querySelector(".gy-link-btn").addEventListener("click", function () {
      linkRow.style.display = "flex";
      linkInput.focus();
    });
    function addGalleryLink() {
      var v = linkInput.value.trim();
      if (!v) return;
      STATE.gallery.images[y].push(v);
      GY_IDX[y] = STATE.gallery.images[y].length - 1;
      linkInput.value = "";
      renderGallery();
    }
    p.querySelector(".gy-link-add").addEventListener("click", addGalleryLink);
    linkInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addGalleryLink(); }
    });
  });
}

/** Pushes STATE into the landing page controls' input values. */
function syncLanding() {
  var radios = document.querySelectorAll('input[name="cdMode"]');
  radios.forEach(function (r) { r.checked = r.value === STATE.timer_mode; });
  document.getElementById("cdTarget").value = STATE.timer_target;
  document.getElementById("joinUrlInput").value = STATE.join_url;
  document.getElementById("applyTooltipInput").value = STATE.apply_tooltip;
}

/** Re-renders every editor section from STATE. */
function renderAll() {
  document.getElementById("totalDaysInput").value = STATE.total_days;
  renderPanels();
  renderExtras();
  renderLogistics();
  renderGallery();
  syncLanding();
  renderPreview();
}

/**
 * Snapshots the in-editor STATE (and which profile, if any, is being
 * edited) into localStorage and opens preview.html (or, if a preview tab
 * from an earlier click is still open, refreshes it) so the ta can see
 * unsaved edits rendered in the real landing page and dashboard before
 * applying them. The snapshot also doubles as a "keep my edits" draft:
 * see tryRestoreFromPreview(). Pulls in whatever the Visual editor tab's
 * iframe last wrote first, if that's the tab currently open, so clicking
 * Preview from there can't clobber an in-progress click-to-edit with the
 * parent's now-stale copy of STATE.
 */
function openPreview() {
  if (TA_MODE === "editor") pullStateFromEditor();
  writePreviewSnapshot();
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.reload();
    previewWindow.focus();
  } else {
    previewWindow = window.open("preview.html", "ta_preview");
  }
}

/* which page the Visual editor tab's iframe is pointed at */
var EDITOR_TAB_PAGES = {
  landing: "index.html?preview=1&edit=1",
  dashboard: "dashboard.html?preview=1&edit=1",
  gallery: "gallery.html?preview=1&edit=1"
};
var editorSubTab = "landing";

/**
 * Points the Visual editor's iframe at the given sub-tab's page and marks
 * it active.
 * @param name "landing", "dashboard", or "gallery"
 */
function showEditorSubTab(name) {
  if (!EDITOR_TAB_PAGES[name]) name = "landing";
  editorSubTab = name;
  var frame = document.getElementById("edFrame");
  if (frame) frame.src = EDITOR_TAB_PAGES[name];
  document.querySelectorAll("#edSubTabs .pv-tab").forEach(function (btn) {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
  });
}

/** Reloads the Visual editor's iframe on its current sub-tab, so it picks up whatever's newest in the shared snapshot. */
function reloadEditorFrame() {
  var frame = document.getElementById("edFrame");
  if (frame && frame.contentWindow) frame.contentWindow.location.reload();
}

/**
 * Reads whatever the Visual editor's iframe last wrote into the shared
 * localStorage snapshot (js/main.js's saveEditedField()) back into STATE,
 * the same way tryRestoreFromPreview() does for a fresh page load. The
 * iframe is a separate document, so its edits only ever land in
 * localStorage, never directly in this page's STATE variable; call this
 * before reading STATE (Apply/Save/Reset/Preview, or switching back to
 * the Content manager tab) whenever the Visual editor was the active tab,
 * so an in-progress click-to-edit is never silently dropped.
 */
function pullStateFromEditor() {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  if (!raw) return;
  try { STATE = JSON.parse(raw); } catch (e) { return; }
  var editingRaw;
  try { editingRaw = localStorage.getItem("preview_editing"); } catch (e) { editingRaw = null; }
  EDITING = editingRaw ? JSON.parse(editingRaw) : null;
  normalizeState();
}

/**
 * Switches between the Content manager form and the Visual editor iframe.
 * Both are views of the same in-memory STATE/EDITING, not two separate
 * drafts: leaving the Visual editor tab pulls its edits back into STATE
 * (see pullStateFromEditor()) before showing the form, and entering it
 * pushes the current STATE into the shared snapshot the iframe reads.
 * This is also how a profile opened via the Profiles list carries over:
 * whichever tab you're on, it's the same STATE/EDITING underneath.
 * @param mode "manager" or "editor"
 */
function showMode(mode) {
  if (mode !== "editor") mode = "manager";
  if (mode === TA_MODE) return;
  if (TA_MODE === "editor") {
    pullStateFromEditor();
    renderAll();
    syncProfileBar();
  }
  TA_MODE = mode;
  document.getElementById("managerView").style.display = mode === "manager" ? "block" : "none";
  document.getElementById("editorView").style.display = mode === "editor" ? "block" : "none";
  document.getElementById("taModeTitle").textContent = mode === "editor" ? "Visual editor" : "Content manager";
  document.getElementById("taModeShell").className = "ta-mode-shell mode-" + mode;
  document.querySelectorAll("#taModeTabs .ta-mode-tab").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-mode") === mode);
  });
  if (mode === "editor") {
    writePreviewSnapshot();
    showEditorSubTab(editorSubTab);
  }
}

/**
 * Reads the Visual editor iframe's undo/redo stack (js/main.js's
 * window.ClickEditHistory) and enables/disables the toolbar buttons to
 * match. Polled on an interval since edits happen inside the iframe with
 * no event wired back out.
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
 * Snapshots STATE (and the open profile, if any) into localStorage, the
 * hand-off preview.html and the Visual editor's iframe both read from and
 * tryRestoreFromPreview() restores back out of.
 */
function writePreviewSnapshot() {
  try {
    localStorage.setItem("preview_content", JSON.stringify(STATE));
    if (EDITING) localStorage.setItem("preview_editing", JSON.stringify(EDITING));
    else localStorage.removeItem("preview_editing");
  } catch (e) {}
}

/** Clears the unsaved-edits snapshot used by the Preview button/page. */
function clearPreviewSnapshot() {
  try {
    localStorage.removeItem("preview_content");
    localStorage.removeItem("preview_editing");
  } catch (e) {}
}

/**
 * If the ta previewed unsaved edits and came back (a fresh page load of
 * instructor.html, e.g. via the preview page's "Content manager" link)
 * without applying or resetting them first, restores STATE from that
 * snapshot instead of fetching the live content, so a trip through
 * Preview never discards in-progress work.
 * @return true if STATE was restored from a snapshot
 */
function tryRestoreFromPreview() {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  if (!raw) return false;
  try {
    STATE = JSON.parse(raw);
  } catch (e) {
    return false;
  }
  var editingRaw;
  try { editingRaw = localStorage.getItem("preview_editing"); } catch (e) { editingRaw = null; }
  EDITING = editingRaw ? JSON.parse(editingRaw) : null;
  normalizeState();
  renderAll();
  syncProfileBar();
  showMsg("Restored your unsaved edits from before you previewed them.", true);
  return true;
}

/**
 * Fetches the live content into the editor.
 * @param okMsg status message to show on success (skipped if omitted)
 * @return the underlying fetch promise
 */
function loadLive(okMsg) {
  return fetch("/api/content")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      STATE = data;
      normalizeState();
      renderAll();
      if (okMsg) showMsg(okMsg, true);
    })
    .catch(function () {
      showMsg("Couldn't load saved content, showing defaults.", false);
      renderAll();
    });
}

/**
 * What a profile is called in the list. Shared ones from another ta get
 * their owner's name in front.
 * @param p a profile {owner, name, mine, shared, ...}
 * @return the display label
 */
function profileLabel(p) {
  if (p.mine) return p.name;
  if (/^Profile \d+$/.test(p.name)) return p.owner + "'s " + p.name;
  return p.owner + "'s \"" + p.name + "\" profile";
}

/**
 * Next free default name for a new profile of mine.
 * @return e.g. "Profile 3"
 */
function nextProfileName() {
  var n = 0;
  PROFILES.forEach(function (p) {
    var m = p.mine && p.name.match(/^Profile (\d+)$/);
    if (m && +m[1] > n) n = +m[1];
  });
  return "Profile " + (n + 1);
}

/**
 * Patches a profile on the server.
 * @param id the profile's id
 * @param fields the fields to update ({name, data, shared}, any subset)
 * @param onOk called with no args on success
 */
function updateProfile(id, fields, onOk) {
  authedFetch("/api/profiles/" + id, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields)
  })
    .then(function (res) {
      if (!res.ok) throw new Error("update failed");
      if (onOk) onOk();
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't update the profile. Check you're still logged in.", false);
    });
}

/** Swaps the action buttons and the banner between live mode and profile mode. */
function syncProfileBar() {
  var bar = document.getElementById("profileBar");
  var txt = document.getElementById("profileBarText");
  var apply = document.getElementById("taApply");
  var save = document.getElementById("taSave");
  if (EDITING) {
    bar.style.display = "block";
    txt.textContent = 'Editing "' + profileLabel(EDITING) + '". Students see none of this until you apply it.';
    apply.textContent = "Apply this profile";
    save.textContent = "Save profile";
  } else {
    bar.style.display = "none";
    apply.textContent = "Apply changes";
    save.textContent = "Save to profile";
  }
}

/**
 * Loads a profile into the editor. Edits stay on a local copy until saved.
 * @param p the profile to open
 */
function openProfile(p) {
  EDITING = p;
  STATE = JSON.parse(JSON.stringify(p.data));
  normalizeState();
  renderAll();
  syncProfileBar();
  renderProfiles();
  showMsg('Opened "' + profileLabel(p) + '".', true);
  window.scrollTo(0, 0);
}

/**
 * Leaves profile mode and reloads the live content into the editor.
 * @param skipConfirm true to skip the "discard unsaved edits" confirm dialog
 */
function backToLive(skipConfirm) {
  if (!skipConfirm && !confirm("Go back to the live content? Unsaved profile edits are discarded.")) return;
  EDITING = null;
  clearPreviewSnapshot();
  loadLive().then(function () {
    if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
  });
  syncProfileBar();
  renderProfiles();
}

/**
 * Loads this ta's profiles (plus any shared by others) into PROFILES and re-renders the list.
 * @return the underlying fetch promise
 */
function fetchProfiles() {
  return authedFetch("/api/profiles")
    .then(function (res) {
      if (!res.ok) throw new Error("profiles failed");
      return res.json();
    })
    .then(function (list) {
      PROFILES = list;
      renderProfiles();
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      var el = document.getElementById("profileList");
      if (el) el.innerHTML = '<p class="muted"><strong>Couldn\'t load profiles.</strong></p>';
    });
}

/** Renders the profiles list into #profileList and wires up its controls. */
function renderProfiles() {
  var list = document.getElementById("profileList");
  if (!list) return;
  if (!PROFILES.length) {
    list.innerHTML = '<p class="muted"><strong>No profiles yet.</strong></p>';
    return;
  }

  var html = "";
  PROFILES.forEach(function (p, i) {
    var open = EDITING && EDITING.id === p.id;
    html += '<div class="res-row prof-row" data-i="' + i + '">';
    if (p.mine) {
      html += '<input type="text" class="pr-name" value="' + p.name + '" aria-label="Profile name">';
    } else {
      html += '<span class="rname">' + profileLabel(p) + '</span>';
    }
    if (p.shared) {
      html += '<span class="shared-flag" title="Every TA can see and edit this profile">' + SHARE_SVG_CHIP + 'shared</span>' +
        '<button class="btn btn-ghost pr-unshare" type="button">Unshare</button>';
    }
    html += '<span class="prof-btns">' +
      '<button class="btn btn-ghost pr-edit" type="button"' + (open ? " disabled" : "") + '>' +
      (open ? "Editing" : "Edit") + '</button>';
    if (p.mine) {
      if (!p.shared) html += '<button class="btn btn-ghost pr-share" type="button">Share</button>';
      html += '<button class="btn btn-ghost pr-del" type="button">Delete</button>';
    }
    html += '</span></div>';
  });
  list.innerHTML = html;

  list.querySelectorAll(".prof-row").forEach(function (row) {
    var p = PROFILES[+row.getAttribute("data-i")];

    var nameInput = row.querySelector(".pr-name");
    if (nameInput) nameInput.addEventListener("change", function () {
      var v = this.value.trim();
      if (!v || v === p.name) { this.value = p.name; return; }
      updateProfile(p.id, { name: v }, function () {
        p.name = v;
        if (EDITING && EDITING.id === p.id) syncProfileBar();
      });
    });

    row.querySelector(".pr-edit").addEventListener("click", function () {
      if (EDITING && EDITING.id === p.id) return;
      if (!confirm('Open "' + profileLabel(p) + '" in the editor? Unsaved edits here are discarded.')) return;
      openProfile(p);
    });

    var shareBtn = row.querySelector(".pr-share");
    if (shareBtn) shareBtn.addEventListener("click", function () {
      updateProfile(p.id, { shared: true }, function () {
        p.shared = true;
        renderProfiles();
        showMsg('Shared. Every TA can see "' + p.name + '" now.', true);
      });
    });

    /* unlike sharing (owner only), any ta who can see a shared profile can
       take it back off the shared list, no need to track down the owner */
    var unshareBtn = row.querySelector(".pr-unshare");
    if (unshareBtn) unshareBtn.addEventListener("click", function () {
      updateProfile(p.id, { shared: false }, function () {
        p.shared = false;
        renderProfiles();
        showMsg('Unshared "' + p.name + '".', true);
      });
    });

    var delBtn = row.querySelector(".pr-del");
    if (delBtn) delBtn.addEventListener("click", function () {
      if (!confirm('Delete "' + p.name + '"? This can\'t be undone.')) return;
      authedFetch("/api/profiles/" + p.id, { method: "DELETE" })
        .then(function (res) {
          if (!res.ok) throw new Error("delete failed");
          PROFILES.splice(PROFILES.indexOf(p), 1);
          if (EDITING && EDITING.id === p.id) backToLive(true);
          renderProfiles();
          showMsg("Profile deleted.", true);
        })
        .catch(function (err) {
          if (err.message === "expired") return;
          showMsg("Couldn't delete that profile.", false);
        });
    });
  });
}

/**
 * Apply = make what's on screen live for students. In profile mode it
 * also saves the profile first so the two can't drift apart. Works from
 * either tab: if the Visual editor is open, pulls in whatever it's
 * written to the shared snapshot first, so an in-progress click-to-edit
 * isn't dropped.
 */
function applyContent() {
  if (TA_MODE === "editor") pullStateFromEditor();
  if (EDITING && !confirm('Apply "' + profileLabel(EDITING) + '" to the live site? Students will see it right away.')) return;
  showMsg("Applying...", true);
  authedFetch("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(STATE)
  })
    .then(function (res) {
      if (!res.ok) throw new Error("apply failed");
      renderAll();
      if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
      else clearPreviewSnapshot();
      if (EDITING) {
        EDITING.data = JSON.parse(JSON.stringify(STATE));
        updateProfile(EDITING.id, { data: STATE });
        showMsg("Profile applied. Students see it now.", true);
      } else {
        showMsg("Applied. Students see this now.", true);
      }
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't apply. Check you're still logged in and try again.", false);
    });
}

/** Save = stash what's on screen in a profile, live site untouched. Same editor-tab pull as applyContent(). */
function saveToProfile() {
  if (TA_MODE === "editor") pullStateFromEditor();
  if (EDITING) {
    updateProfile(EDITING.id, { data: STATE }, function () {
      EDITING.data = JSON.parse(JSON.stringify(STATE));
      renderAll();
      showMsg("Profile saved. The live site is unchanged.", true);
    });
    return;
  }
  var name = nextProfileName();
  showMsg("Saving...", true);
  authedFetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, data: STATE })
  })
    .then(function (res) {
      if (!res.ok) throw new Error("save failed");
      return fetchProfiles();
    })
    .then(function () {
      renderAll();
      showMsg('Saved as "' + name + '". The live site is unchanged.', true);
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't save. Check you're still logged in and try again.", false);
    });
}

/**
 * Reset = throw away unsaved edits: back to the live site, or the open
 * profile's last saved data if one's being edited. Doesn't need an
 * editor-tab pull first, unlike the other three actions: it's discarding
 * whatever's unsaved anyway, in either tab.
 */
function resetContent() {
  if (!confirm("Reset everything back to how it was last saved? This throws away your edits.")) return;
  clearPreviewSnapshot();
  if (EDITING) {
    STATE = JSON.parse(JSON.stringify(EDITING.data));
    normalizeState();
    renderAll();
    if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
    showMsg("Reset to the profile's last saved version.", true);
    return;
  }
  loadLive("Reset to the last saved version.").then(function () {
    if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
  });
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

  if (!tryRestoreFromPreview()) loadLive();
  fetchProfiles();

  document.getElementById("profileBack").addEventListener("click", function () {
    backToLive();
  });

  document.getElementById("totalDaysInput").addEventListener("input", function () {
    STATE.total_days = +this.value || 1;
  });

  document.getElementById("addPanel").addEventListener("click", function () {
    var next = STATE.days.length ? STATE.days[STATE.days.length - 1].day + 1 : 1;
    STATE.days.push({ day: next, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] });
    renderPanels();
  });

  document.getElementById("addLogistics").addEventListener("click", function () {
    STATE.logistics.push({ big: "", lbl: "", icon: false });
    renderLogistics();
    renderPreview();
  });

  document.getElementById("addGalleryYear").addEventListener("click", function () {
    var input = document.getElementById("newYearInput");
    var y = input.value.trim();
    if (!y) return;
    if (STATE.gallery.years.indexOf(y) !== -1) { showMsg("That year already exists.", false); return; }
    STATE.gallery.years.unshift(y);
    STATE.gallery.images[y] = [];
    input.value = "";
    renderGallery();
  });

  document.getElementById("extraFile").addEventListener("change", function () {
    var files = Array.prototype.slice.call(this.files);
    this.value = "";
    if (!files.length) return;
    showMsg("Uploading...", true);
    Promise.all(files.map(uploadFile))
      .then(function (items) {
        items.forEach(function (it) { STATE.extras.push(it); });
        showMsg("Uploaded. Don't forget to save your changes.", true);
        renderExtras();
      })
      .catch(function (err) {
        if (err.message === "expired") return;
        showMsg("Couldn't upload one of the files. Try again.", false);
      });
  });

  var extraLinkRow = document.getElementById("extraLinkRow");
  var extraLinkInput = document.getElementById("extraLinkInput");
  document.getElementById("extraLinkBtn").addEventListener("click", function () {
    extraLinkRow.style.display = "flex";
    extraLinkInput.focus();
  });
  function addExtraLink() {
    var v = extraLinkInput.value.trim();
    if (!v) return;
    STATE.extras.push({ type: "link", value: v });
    extraLinkInput.value = "";
    extraLinkRow.style.display = "none";
    renderExtras();
  }
  document.getElementById("extraLinkAdd").addEventListener("click", addExtraLink);
  extraLinkInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addExtraLink(); }
  });

  document.querySelectorAll('input[name="cdMode"]').forEach(function (r) {
    r.addEventListener("change", function () { STATE.timer_mode = this.value; renderPreview(); });
  });
  document.getElementById("cdTarget").addEventListener("input", function () { STATE.timer_target = this.value; renderPreview(); });
  document.getElementById("joinUrlInput").addEventListener("input", function () { STATE.join_url = this.value; });
  document.getElementById("applyTooltipInput").addEventListener("input", function () { STATE.apply_tooltip = this.value; });

  document.getElementById("taPreview").addEventListener("click", openPreview);
  document.getElementById("taApply").addEventListener("click", applyContent);
  document.getElementById("taSave").addEventListener("click", saveToProfile);
  document.getElementById("taReset").addEventListener("click", resetContent);

  /* Content manager <-> Visual editor tabs, both views of the same STATE */
  document.querySelectorAll("#taModeTabs .ta-mode-tab").forEach(function (btn) {
    btn.addEventListener("click", function () { showMode(this.getAttribute("data-mode")); });
  });

  /* landing/dashboard/gallery sub-tabs inside the Visual editor */
  document.querySelectorAll("#edSubTabs .pv-tab").forEach(function (btn) {
    btn.addEventListener("click", function () { showEditorSubTab(this.getAttribute("data-tab")); });
  });

  document.getElementById("edUndo").addEventListener("click", function () {
    var frame = document.getElementById("edFrame");
    if (frame.contentWindow.ClickEditHistory) frame.contentWindow.ClickEditHistory.undo();
    syncUndoButtons();
  });
  document.getElementById("edRedo").addEventListener("click", function () {
    var frame = document.getElementById("edFrame");
    if (frame.contentWindow.ClickEditHistory) frame.contentWindow.ClickEditHistory.redo();
    syncUndoButtons();
  });
  setInterval(syncUndoButtons, 400);

  /* the Day panels/Extras/Gallery/Landing/Profiles nav links only make
     sense in the Content manager view, so jump back to it before the
     browser scrolls to the target anchor */
  document.querySelectorAll("#taSectionNav a").forEach(function (a) {
    a.addEventListener("click", function () { showMode("manager"); });
  });

  /* lets preview.html's "Visual editor" link (?tab=editor) land straight
     on that tab instead of the content manager */
  if (/[?&]tab=editor(&|$)/.test(window.location.search)) showMode("editor");
});
