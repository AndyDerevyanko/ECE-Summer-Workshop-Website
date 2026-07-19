/* ta portal. everything edits the in-memory STATE object below; loaded from
   and saved to /api/content, which is the single source of truth. */

function seed() {
  return {
    days: [
      { day: 1, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] },
      { day: 2, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] }
    ],
    extras: [],
    timer_mode: "tentative", /* tentative | actual */
    timer_target: "",
    date_mode: "tentative", /* tentative | confirmed */
    start_date: "",
    end_date: "",
    weeks_label: "2 weeks",
    logistics: [
      { big: "4 hours", lbl: "1:30pm–5:30pm", icon: false },
      { big: "SFB520", lbl: "Sandford Fleming", icon: false },
      { big: "", lbl: "Certificate of completion", icon: true }
    ]
  };
}

/* fills in fields that may be missing from content saved before these
   were added, so older saved blobs don't blow up the ta portal */
function normalizeState() {
  if (!STATE.weeks_label) STATE.weeks_label = "2 weeks";
  if (!STATE.logistics) STATE.logistics = seed().logistics;
}

var STATE = seed();

function authHeaders() {
  return { "Authorization": "Bearer " + (localStorage.getItem("token") || "") };
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
  return fetch("/api/upload", { method: "POST", headers: authHeaders(), body: fd })
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

/* attachments are a plain filename string (legacy), a {type:"link", value}
   object, or a {type:"file", name, url} object for an uploaded file */
function isLink(item) { return item && typeof item === "object" && item.type === "link"; }
function itemLabel(item) {
  if (isLink(item)) return item.value;
  if (item && typeof item === "object") return item.name;
  return item;
}
function itemIcon(item) { return isLink(item) ? LINK_SVG_CHIP : FILE_SVG_CHIP; }

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

  var lbl = document.getElementById("previewStatLbl");
  lbl.textContent = STATE.date_mode === "confirmed" ?
    formatDateRange(STATE.start_date, STATE.end_date) : "Tentative start date";

  var weeksBig = document.getElementById("previewWeeksBig");
  if (weeksBig) weeksBig.textContent = STATE.weeks_label || "2 weeks";

  var logisticsSlot = document.getElementById("previewLogistics");
  if (logisticsSlot) {
    logisticsSlot.innerHTML = "";
    STATE.logistics.forEach(function (t) { logisticsSlot.appendChild(logisticsPreviewTile(t)); });
  }
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
          '<span class="badge ' + (d.unlocked ? 'open">Open' : 'locked">Locked') + '</span>' +
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
        .catch(function () {
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
  var dateRadios = document.querySelectorAll('input[name="dateMode"]');
  dateRadios.forEach(function (r) { r.checked = r.value === STATE.date_mode; });
  document.getElementById("dateStart").value = STATE.start_date;
  document.getElementById("dateEnd").value = STATE.end_date;
  document.getElementById("weeksLabelInput").value = STATE.weeks_label;
}

document.addEventListener("DOMContentLoaded", function () {
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    window.location.href = "login.html";
  });
  if (!gateCheck()) return;

  fetch("/api/content")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      STATE = data;
      normalizeState();
      renderPanels();
      renderExtras();
      renderLogistics();
      syncLanding();
      renderPreview();
    })
    .catch(function () {
      showMsg("Couldn't load saved content, showing defaults.", false);
      renderPanels();
      renderExtras();
      renderLogistics();
      syncLanding();
      renderPreview();
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
      .catch(function () {
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
  document.querySelectorAll('input[name="dateMode"]').forEach(function (r) {
    r.addEventListener("change", function () { STATE.date_mode = this.value; renderPreview(); });
  });
  document.getElementById("dateStart").addEventListener("input", function () { STATE.start_date = this.value; renderPreview(); });
  document.getElementById("dateEnd").addEventListener("input", function () { STATE.end_date = this.value; renderPreview(); });
  document.getElementById("weeksLabelInput").addEventListener("input", function () { STATE.weeks_label = this.value; renderPreview(); });

  function saveContent() {
    showMsg("Saving...", true);
    fetch("/api/content", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, authHeaders()),
      body: JSON.stringify(STATE)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("save failed");
        showMsg("Saved. Students will see this now.", true);
      })
      .catch(function () {
        showMsg("Couldn't save. Check you're still logged in and try again.", false);
      });
  }

  document.getElementById("taApply").addEventListener("click", saveContent);
  document.getElementById("taSave").addEventListener("click", saveContent);

  document.getElementById("taReset").addEventListener("click", function () {
    if (!confirm("Reset everything back to how it was last saved? This throws away your edits.")) return;
    fetch("/api/content")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        STATE = data;
        normalizeState();
        renderPanels();
        renderExtras();
        renderLogistics();
        syncLanding();
        renderPreview();
        showMsg("Reset to the last saved version.", true);
      });
  });
});
