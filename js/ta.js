/* ta portal. everything edits the in-memory STATE object below; loaded from
   and saved to /api/content, which is the single source of truth. */

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
    contact_text: "Questions? hardware.robotics@utoronto.ca",
    join_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    apply_tooltip: "Applications open once the workshop dates are confirmed, check back soon.",
    logistics: [
      { big: "2 weeks", lbl: "Tentative start date", icon: false },
      { big: "4 hours", lbl: "1:30pm–5:30pm", icon: false },
      { big: "SFB520", lbl: "Sandford Fleming", icon: false },
      { big: "", lbl: "Certificate of completion", icon: true }
    ]
  };
}

/* fills in fields that may be missing from content saved before these were
   added (or before the workshop-dates tile got folded into the generic
   logistics list), so older saved blobs don't blow up the ta portal */
function normalizeState() {
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
  if (STATE.contact_text === undefined) STATE.contact_text = "Questions? hardware.robotics@utoronto.ca";
  if (STATE.join_url === undefined) STATE.join_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  if (STATE.apply_tooltip === undefined) {
    STATE.apply_tooltip = "Applications open once the workshop dates are confirmed, check back soon.";
  }
  if (!STATE.total_days) STATE.total_days = 10;
}

var STATE = seed();

var PROFILES = [];  /* saved drafts from /api/profiles */
var EDITING = null; /* null = editing the live site, else the open profile */

function authHeaders() {
  return { "Authorization": "Bearer " + (localStorage.getItem("token") || "") };
}

/* server says the session's gone (idle timeout, or the account got
   removed), clear local state and bounce to login with a message instead
   of quietly failing every button on the page */
function handleExpiredSession() {
  localStorage.removeItem("session");
  localStorage.removeItem("role");
  localStorage.removeItem("token");
  localStorage.removeItem("last_active");
  window.location.href = "login.html?expired=1";
}

/* fetch with the auth header attached; on a 401 it handles the redirect
   itself and rejects, so callers only need to handle other failures */
function authedFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, authHeaders());
  return fetch(url, opts).then(function (res) {
    if (res.status === 401) { handleExpiredSession(); throw new Error("expired"); }
    return res;
  });
}

function showMsg(text, ok) {
  var el = document.getElementById("taMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/* uploads one file, resolves to the {type:"file", name, url} attachment entry */
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

/* datetime-local wants local time, toISOString gives utc */
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
function isLink(item) { return item && typeof item === "object" && item.type === "link"; }
function itemLabel(item) {
  if (isLink(item)) return item.value;
  if (item && typeof item === "object") return item.name;
  return item;
}
/* picks an icon off the file extension in the attachment's name, same
   rule as js/dashboard.js. falls back to a generic file glyph. */
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

/* builds one read-only preview tile, same markup as the real one on index.html */
function logisticsPreviewTile(t) {
  var card = document.createElement("div");
  card.className = "card stat ta-live-stat";
  var big = document.createElement("div");
  big.className = "big";
  if (t.icon) big.innerHTML = CHECK_ICON_SVG;
  else big.textContent = t.big;
  var lbl = document.createElement("div");
  lbl.className = "lbl";
  lbl.textContent = t.lbl;
  card.appendChild(big);
  card.appendChild(lbl);
  return card;
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

function formatDateRange(start, end) {
  if (!start || !end) return "No dates set yet";
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var s = new Date(start + "T00:00:00");
  var e = new Date(end + "T00:00:00");
  return months[s.getMonth()] + " " + s.getDate() + " to " +
    months[e.getMonth()] + " " + e.getDate() + ", " + e.getFullYear();
}

var previewTickHandle = null;

/* ticks the preview clock digits every second, same math as js/main.js */
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

/* mirrors STATE back into the "current selection" preview box */
function renderPreview() {
  var slot = document.getElementById("previewCountdown");
  if (!slot) return;
  if (previewTickHandle) { clearInterval(previewTickHandle); previewTickHandle = null; }

  var showClock = STATE.timer_mode === "actual" && STATE.timer_target;
  slot.innerHTML = showClock ? CD_CLOCK_HTML : CD_TBA_HTML;
  if (showClock) tickPreviewCountdown(STATE.timer_target);

  var logisticsSlot = document.getElementById("previewLogistics");
  if (logisticsSlot) {
    logisticsSlot.innerHTML = "";
    STATE.logistics.forEach(function (t) { logisticsSlot.appendChild(logisticsPreviewTile(t)); });
  }

  var contactPreview = document.getElementById("previewContact");
  if (contactPreview) contactPreview.textContent = STATE.contact_text;
}

/* only ta keys get in here */
function gateCheck() {
  var ok = localStorage.getItem("session") && localStorage.getItem("role") === "ta";
  var app = document.getElementById("taApp");
  var gate = document.getElementById("taGate");
  if (app) app.style.display = ok ? "block" : "none";
  if (gate) gate.style.display = ok ? "none" : "block";
  return ok;
}

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

/* editable list of the "4 hours", "SFB520", certificate, etc tiles */
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

/* push STATE into the landing page controls */
function syncLanding() {
  var radios = document.querySelectorAll('input[name="cdMode"]');
  radios.forEach(function (r) { r.checked = r.value === STATE.timer_mode; });
  document.getElementById("cdTarget").value = STATE.timer_target;
  document.getElementById("contactInput").value = STATE.contact_text;
  document.getElementById("joinUrlInput").value = STATE.join_url;
  document.getElementById("applyTooltipInput").value = STATE.apply_tooltip;
}

function renderAll() {
  document.getElementById("totalDaysInput").value = STATE.total_days;
  renderPanels();
  renderExtras();
  renderLogistics();
  syncLanding();
  renderPreview();
}

/* fetch the live content into the editor */
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

/* what a profile is called in the list. shared ones from another ta get
   their owner's name in front. */
function profileLabel(p) {
  if (p.mine) return p.name;
  if (/^Profile \d+$/.test(p.name)) return p.owner + "'s " + p.name;
  return p.owner + "'s \"" + p.name + "\" profile";
}

/* next free default name for a new profile of mine */
function nextProfileName() {
  var n = 0;
  PROFILES.forEach(function (p) {
    var m = p.mine && p.name.match(/^Profile (\d+)$/);
    if (m && +m[1] > n) n = +m[1];
  });
  return "Profile " + (n + 1);
}

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

/* swaps the action buttons and the banner between live mode and profile mode */
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

/* loads a profile into the editor. edits stay on a local copy until saved */
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

function backToLive(skipConfirm) {
  if (!skipConfirm && !confirm("Go back to the live content? Unsaved profile edits are discarded.")) return;
  EDITING = null;
  loadLive();
  syncProfileBar();
  renderProfiles();
}

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

  loadLive();
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
  document.getElementById("contactInput").addEventListener("input", function () { STATE.contact_text = this.value; renderPreview(); });
  document.getElementById("joinUrlInput").addEventListener("input", function () { STATE.join_url = this.value; });
  document.getElementById("applyTooltipInput").addEventListener("input", function () { STATE.apply_tooltip = this.value; });

  /* apply = make what's on screen live for students. in profile mode it
     also saves the profile first so the two can't drift apart. */
  function applyContent() {
    if (EDITING && !confirm('Apply "' + profileLabel(EDITING) + '" to the live site? Students will see it right away.')) return;
    showMsg("Applying...", true);
    authedFetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(STATE)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("apply failed");
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

  /* save = stash what's on screen in a profile, live site untouched */
  function saveToProfile() {
    if (EDITING) {
      updateProfile(EDITING.id, { data: STATE }, function () {
        EDITING.data = JSON.parse(JSON.stringify(STATE));
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
        showMsg('Saved as "' + name + '". The live site is unchanged.', true);
      })
      .catch(function (err) {
        if (err.message === "expired") return;
        showMsg("Couldn't save. Check you're still logged in and try again.", false);
      });
  }

  document.getElementById("taApply").addEventListener("click", applyContent);
  document.getElementById("taSave").addEventListener("click", saveToProfile);

  document.getElementById("taReset").addEventListener("click", function () {
    if (!confirm("Reset everything back to how it was last saved? This throws away your edits.")) return;
    if (EDITING) {
      STATE = JSON.parse(JSON.stringify(EDITING.data));
      normalizeState();
      renderAll();
      showMsg("Reset to the profile's last saved version.", true);
      return;
    }
    loadLive("Reset to the last saved version.");
  });
});
