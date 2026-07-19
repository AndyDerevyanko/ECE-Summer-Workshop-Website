/* dashboard: renders day panels from content fetched off /api/content */

/* full length of the workshop, drives the progress denominator. fixed by
   the workshop schedule, not something the ta portal edits. */
var TOTAL_DAYS = 10;

/* filled in by loadContent() before renderDays()/renderExtras() run */
var DAYS = [];
var EXTRAS = [];

/* attachments are a plain filename string (legacy), a {type:"link", value}
   object, or a {type:"file", name, url} object for an uploaded file */
function isLink(item) { return item && typeof item === "object" && item.type === "link"; }
function itemHref(item) {
  if (isLink(item)) return item.value;
  if (item && typeof item === "object") return item.url;
  return "#";
}
function itemLabel(item) {
  if (isLink(item)) return item.value;
  if (item && typeof item === "object") return item.name;
  return item;
}

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

function fmtDate(dateStr) {
  var d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/* no session, bounce to the gate */
function gateCheck() {
  var session = localStorage.getItem("session");
  var app = document.getElementById("dashApp");
  var gate = document.getElementById("dashGate");
  if (!session) {
    if (app) app.style.display = "none";
    if (gate) gate.style.display = "block";
    return null;
  }
  if (gate) gate.style.display = "none";
  if (app) app.style.display = "block";
  return session;
}

function soonCard(dayNum) {
  return '<div class="day-card soon">' +
    '<span class="soon-lock">' + LOCK_SVG + '</span>' +
    '<h3>Day ' + dayNum + '</h3>' +
    '<p class="muted">This module will be available soon</p>' +
    '<span class="badge locked">' + LOCK_SVG + 'Locked</span>' +
  '</div>';
}

function renderDays() {
  var grid = document.getElementById("dayGrid");
  if (!grid) return 0;
  var html = "";
  var unlockedCount = 0;
  var allOpen = true;

  DAYS.forEach(function (day) {
    if (!day.unlocked) {
      allOpen = false;
      html += soonCard(day.day);
      return;
    }
    unlockedCount++;
    var chips = day.files.map(function (f) {
      return '<a class="chip" href="' + itemHref(f) + '" target="_blank" rel="noopener">&darr; ' + itemLabel(f) + '</a>';
    }).join("");
    html +=
      '<div class="day-card">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span class="daytag">Day ' + day.day +
            (day.date ? ' &middot; ' + fmtDate(day.date) : '') + '</span>' +
          '<span class="badge open">' + UNLOCK_SVG + 'Open</span>' +
        '</div>' +
        '<h3>' + day.title + '</h3>' +
        '<p class="muted">' + day.blurb + '</p>' +
        '<div class="links">' + chips + '</div>' +
      '</div>';
  });

  /* once every panel is open, one locked card trails for the next day */
  if (allOpen && DAYS.length < TOTAL_DAYS) {
    html += soonCard(DAYS.length + 1);
  }

  grid.innerHTML = html;
  return unlockedCount;
}

function renderProgress(unlockedCount) {
  var fill = document.getElementById("progFill");
  var label = document.getElementById("progLabel");
  var pct = Math.round((unlockedCount / TOTAL_DAYS) * 100);
  if (fill) setTimeout(function () { fill.style.width = pct + "%"; }, 150);
  if (label) label.textContent = unlockedCount + " of " + TOTAL_DAYS + " days unlocked (" + pct + "%)";
}

function renderExtras() {
  var list = document.getElementById("resList");
  if (!list) return;
  if (!EXTRAS.length) {
    list.innerHTML = '<p class="muted"><strong>Nothing here yet.</strong></p>';
    return;
  }
  var rows = "";
  EXTRAS.forEach(function (f) {
    rows +=
      '<div class="res-row">' +
        '<span><span class="rname">' + itemLabel(f) + '</span></span>' +
        '<a class="btn btn-ghost" href="' + itemHref(f) + '" target="_blank" rel="noopener">' +
          (isLink(f) ? "Open" : "Download") +
        '</a>' +
      '</div>';
  });
  list.innerHTML = rows;
}

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
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
  if (!session) return;

  fetch("/api/content")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      DAYS = data.days;
      EXTRAS = data.extras;
      var unlocked = renderDays();
      renderProgress(unlocked);
      renderExtras();
    });
});
