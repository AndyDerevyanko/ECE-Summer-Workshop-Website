// dashboard: date-gates each day so it unlocks the morning we run it
// no server yet, session is just a localStorage key

// keep dates in sync with main.js. each day unlocks 9am that date
var DAYS = [
  { d: "2026-07-13", tag: "Day 1", title: "Welcome + Electronics Basics",
    blurb: "Breadboards, the multimeter, and your first lit-up LED.",
    files: ["Day 1 slides", "Starter kit checklist"] },
  { d: "2026-07-14", tag: "Day 2", title: "Sensors & Signals",
    blurb: "Reading the world: buttons, light sensors, and a bit of code.",
    files: ["Day 2 slides", "sensor_demo.ino"] },
  { d: "2026-07-15", tag: "Day 3", title: "Motors & Motion",
    blurb: "Making things move without the magic smoke escaping.",
    files: ["Day 3 slides", "motor_test.ino"] },
  { d: "2026-07-16", tag: "Day 4", title: "Build: Line-Tracking Robot",
    blurb: "The big one. Put it all together into a robot that follows a line.",
    files: ["Day 4 slides", "linebot_template.ino", "Wiring diagram"] },
  { d: "2026-07-17", tag: "Day 5", title: "Competition + Certificates",
    blurb: "Race day, prizes, and your certificate of completion.",
    files: ["Day 5 slides", "Competition rules"] }
];

// unlock time is 9am that morning
function startOfDay(dateStr) {
  return new Date(dateStr + "T09:00:00");
}
function isUnlocked(dateStr) {
  return new Date() >= startOfDay(dateStr);
}
function isToday(dateStr) {
  var n = new Date();
  var d = new Date(dateStr + "T00:00:00");
  return n.getFullYear() === d.getFullYear() &&
         n.getMonth() === d.getMonth() &&
         n.getDate() === d.getDate();
}
function fmtDate(dateStr) {
  var d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

// no session, bounce to the gate
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

function renderDays() {
  var grid = document.getElementById("dayGrid");
  if (!grid) return 0;
  var html = "";
  var unlockedCount = 0;

  DAYS.forEach(function (day) {
    var open = isUnlocked(day.d);
    var today = isToday(day.d);
    if (open) unlockedCount++;

    var badge = open
      ? (today ? '<span class="badge today">Today</span>' : '<span class="badge open">Open</span>')
      : '<span class="badge locked">Locked</span>';

    var body;
    if (open) {
      // href is # since the real files don't exist yet
      var chips = day.files.map(function (f) {
        return '<a class="chip" href="#" onclick="return false;">&darr; ' + f + '</a>';
      }).join("");
      body = '<p class="muted">' + day.blurb + '</p>' +
             '<div class="links">' + chips + '</div>';
    } else {
      body = '<p class="muted">Unlocks ' + fmtDate(day.d) + ' at 9:00 AM.</p>' +
             '<div class="lock-overlay">[locked] Revealed the morning of the session.</div>';
    }

    html +=
      '<div class="day-card ' + (open ? '' : 'locked') + '">' +
        '<div style="display:flex;justify-content:space-between;align-items:center">' +
          '<span class="daytag">' + day.tag + ' &middot; ' + fmtDate(day.d) + '</span>' + badge +
        '</div>' +
        '<h3>' + (open ? day.title : '???') + '</h3>' +
        body +
      '</div>';
  });

  grid.innerHTML = html;
  return unlockedCount;
}

function renderProgress(unlockedCount) {
  var fill = document.getElementById("progFill");
  var label = document.getElementById("progLabel");
  var pct = Math.round((unlockedCount / DAYS.length) * 100);
  if (fill) setTimeout(function () { fill.style.width = pct + "%"; }, 150);
  if (label) label.textContent = unlockedCount + " of " + DAYS.length + " days unlocked (" + pct + "%)";
}

// resources follow the same gating, locked days stay hidden
function renderResources() {
  var list = document.getElementById("resList");
  if (!list) return;
  var rows = "";
  var any = false;
  DAYS.forEach(function (day) {
    if (!isUnlocked(day.d)) return;
    any = true;
    day.files.forEach(function (f) {
      var icon = /\.ino$/.test(f) ? "&lt;/&gt;" : (/diagram|wiring/i.test(f) ? "[img]" : "[doc]");
      rows +=
        '<div class="res-row">' +
          '<span class="ricon">' + icon + '</span>' +
          '<span><span class="rname">' + f + '</span><br>' +
            '<span class="rmeta">' + day.tag + '</span></span>' +
          '<a class="btn btn-ghost" href="#" onclick="return false;">Download</a>' +
        '</div>';
    });
  });
  list.innerHTML = any
    ? rows
    : '<p class="muted"><strong>Nothing here yet.</strong></p>';
}

function logout() {
  localStorage.removeItem("session");
  window.location.href = "login.html";
}

document.addEventListener("DOMContentLoaded", function () {
  var session = gateCheck();
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
  if (!session) return;

  var unlocked = renderDays();
  renderProgress(unlocked);
  renderResources();
});
