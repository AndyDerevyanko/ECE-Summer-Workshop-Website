/* ta portal. everything edits the STATE object below and nothing else. */
/* the backend will eventually read STATE, for now it just lives in memory. */

function seed() {
  return {
    days: [
      { day: 1, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] },
      { day: 2, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] }
    ],
    extras: [],
    timer_mode: "tentative", /* tentative | actual */
    timer_target: "",
    start_date: "",
    end_date: ""
  };
}

var STATE = seed();

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
      return '<span class="ta-file">' + f +
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
            '<button class="btn btn-primary p-now" type="button">Open right now</button></div>' +
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
            ' Add file<input type="file" class="p-file" multiple hidden></label>' +
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
      if (!confirm("Open Day " + d.day + " for students right now?")) return;
      d.unlocked = true;
      d.opens_at = nowLocal();
      renderPanels();
    });

    p.querySelector(".p-del").addEventListener("click", function () {
      if (!confirm("Remove the Day " + d.day + " panel?")) return;
      STATE.days.splice(STATE.days.indexOf(d), 1);
      renderPanels();
    });

    p.querySelector(".p-file").addEventListener("change", function () {
      for (var k = 0; k < this.files.length; k++) d.files.push(this.files[k].name);
      renderPanels();
    });

    p.querySelectorAll(".p-frm").forEach(function (btn) {
      btn.addEventListener("click", function () {
        d.files.splice(+this.getAttribute("data-f"), 1);
        renderPanels();
      });
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
        '<span><span class="rname">' + f + '</span></span>' +
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

/* push STATE into the landing page controls */
function syncLanding() {
  var radios = document.querySelectorAll('input[name="cdMode"]');
  radios.forEach(function (r) { r.checked = r.value === STATE.timer_mode; });
  document.getElementById("cdTarget").value = STATE.timer_target;
  document.getElementById("dateStart").value = STATE.start_date;
  document.getElementById("dateEnd").value = STATE.end_date;
}

document.addEventListener("DOMContentLoaded", function () {
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    window.location.href = "login.html";
  });
  if (!gateCheck()) return;

  renderPanels();
  renderExtras();
  syncLanding();

  document.getElementById("addPanel").addEventListener("click", function () {
    var next = STATE.days.length ? STATE.days[STATE.days.length - 1].day + 1 : 1;
    STATE.days.push({ day: next, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] });
    renderPanels();
  });

  document.getElementById("extraFile").addEventListener("change", function () {
    for (var k = 0; k < this.files.length; k++) STATE.extras.push(this.files[k].name);
    this.value = "";
    renderExtras();
  });

  document.querySelectorAll('input[name="cdMode"]').forEach(function (r) {
    r.addEventListener("change", function () { STATE.timer_mode = this.value; });
  });
  document.getElementById("cdTarget").addEventListener("input", function () { STATE.timer_target = this.value; });
  document.getElementById("dateStart").addEventListener("input", function () { STATE.start_date = this.value; });
  document.getElementById("dateEnd").addEventListener("input", function () { STATE.end_date = this.value; });

  /* apply and save don't go anywhere yet, the backend will take STATE later */
  document.getElementById("taApply").addEventListener("click", function () {});
  document.getElementById("taSave").addEventListener("click", function () {});

  document.getElementById("taReset").addEventListener("click", function () {
    if (!confirm("Reset everything back to how it was? This throws away your edits.")) return;
    STATE = seed();
    renderPanels();
    renderExtras();
    syncLanding();
  });
});
