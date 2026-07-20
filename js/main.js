/* landing page: countdown + workshop dates, both driven by whatever the
   ta portal last saved (see /api/content). scroll-reveal and the hero
   floaties were removed earlier, this file is countdown-only now. */

var CD_TBA_HTML =
  '<div class="countdown cd-tba">' +
    '<svg class="cd-cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>' +
    '<div><span class="cd-label accent">Date and time</span>' +
    '<b class="cd-tba-txt">To be announced</b></div>' +
  '</div>';

var CHECK_ICON_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>';

/* builds one logistics tile ("2 weeks", "4 hours", "SFB520", certificate, etc) */
function logisticsTile(t) {
  var card = document.createElement("div");
  card.className = "card stat";
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

var CD_CLOCK_HTML =
  '<div class="countdown" id="countdown">' +
    '<span class="cd-label">Workshop begins in</span>' +
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
var DEFAULT_CONTACT = "Questions? hardware.robotics@utoronto.ca";
var DEFAULT_JOIN_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

function formatDateRange(start, end) {
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var s = new Date(start + "T00:00:00");
  var e = new Date(end + "T00:00:00");
  return months[s.getMonth()] + " " + s.getDate() + " to " +
    months[e.getMonth()] + " " + e.getDate() + ", " + e.getFullYear();
}

/* content saved before the workshop-dates tile got folded into the generic
   logistics list has no "logistics" key at all, just the old date_mode/
   weeks_label fields. build a first tile out of those so the real saved
   dates don't disappear on students until a ta re-saves from the portal. */
function resolveLogistics(data) {
  if (data.logistics) return data.logistics;
  var lbl = (data.date_mode === "confirmed" && data.start_date && data.end_date) ?
    formatDateRange(data.start_date, data.end_date) : "Tentative start date";
  var tiles = DEFAULT_LOGISTICS.slice();
  tiles[0] = { big: data.weeks_label || "2 weeks", lbl: lbl, icon: false };
  return tiles;
}

/* counts down to target (an iso datetime string), updates the clock digits every second */
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

/* still logged in from a previous visit? point the nav link back at your
   portal and show a log out button, instead of always saying "Access
   portal", which read as having been logged out */
function updatePortalLink() {
  var link = document.getElementById("portalLink");
  var outBtn = document.getElementById("logoutBtn");
  var navJoin = document.getElementById("navJoinLink");
  if (!link) return;
  var session = localStorage.getItem("session");
  var role = localStorage.getItem("role");
  if (!session || !role) return;
  link.textContent = role === "ta" ? "TA portal" : "Dashboard";
  link.href = role === "ta" ? "instructor.html" : "dashboard.html";
  /* Join Us next to Gallery would be a dead prompt to sign up again,
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
  var contactLine = document.getElementById("contactLine");
  if (!slot) return;

  function renderTiles(list) {
    if (!grid) return;
    grid.innerHTML = "";
    list.forEach(function (t) { grid.appendChild(logisticsTile(t)); });
  }

  function setJoinUrl(url) {
    document.querySelectorAll(".join-link").forEach(function (a) { a.href = url; });
  }

  fetch("/api/content")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (data.timer_mode === "actual" && data.timer_target) {
        slot.innerHTML = CD_CLOCK_HTML;
        startCountdown(data.timer_target);
      } else {
        slot.innerHTML = CD_TBA_HTML;
      }

      renderTiles(resolveLogistics(data));
      if (contactLine) contactLine.textContent = data.contact_text || DEFAULT_CONTACT;
      setJoinUrl(data.join_url || DEFAULT_JOIN_URL);
    })
    .catch(function () {
      slot.innerHTML = CD_TBA_HTML;
      renderTiles(DEFAULT_LOGISTICS);
      if (contactLine) contactLine.textContent = DEFAULT_CONTACT;
      setJoinUrl(DEFAULT_JOIN_URL);
    });
});
