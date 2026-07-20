/* dashboard: renders day panels from content fetched off /api/content */

/* full length of the workshop, drives the progress denominator. set from
   /api/content (ta portal, "Total workshop days"), this is just the
   fallback if that's missing. */
var TOTAL_DAYS = 10;

/* filled in by loadContent() before renderDays()/renderExtras() run */
var DAYS = [];
var EXTRAS = [];

/* attachments are a plain filename string (legacy), a {type:"link", value}
   object, or a {type:"file", name, url} object for an uploaded file */

/**
 * Checks whether an attachment is a link entry.
 * @param item an attachment (string or {type, ...} object)
 * @return true if it's a {type:"link", value} entry
 */
function isLink(item) { return item && typeof item === "object" && item.type === "link"; }

/**
 * Returns the href an attachment chip should point at.
 * @param item an attachment (string or {type, ...} object)
 * @return the link's url, or "#" for anything unrecognized
 */
function itemHref(item) {
  if (isLink(item)) return item.value;
  if (item && typeof item === "object") return item.url;
  return "#";
}

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

var LINK_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8"/></svg>';

var IMAGE_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>' +
  '<path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';

var DOC_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>' +
  '<path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>';

var SLIDES_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="M7 21l5-5 5 5"/></svg>';

var FILE_SVG =
  '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/></svg>';

var IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "tiff", "heic"];
var DOC_EXTS = ["pdf", "doc", "docx", "txt", "rtf", "odt", "pages"];
var SLIDES_EXTS = ["ppt", "pptx", "key", "odp"];

/**
 * Picks an icon off the file extension in the attachment's name (or the
 * filename itself, for the legacy plain-string shape). Falls back to a
 * generic file glyph for anything not recognized (zip, mp3, xlsx, etc).
 * @param item an attachment (string or {type, ...} object)
 * @return an inline svg icon string
 */
function itemIcon(item) {
  if (isLink(item)) return LINK_SVG;
  var name = itemLabel(item) || "";
  var m = /\.([a-z0-9]+)$/i.exec(name);
  var ext = m ? m[1].toLowerCase() : "";
  if (IMAGE_EXTS.indexOf(ext) !== -1) return IMAGE_SVG;
  if (DOC_EXTS.indexOf(ext) !== -1) return DOC_SVG;
  if (SLIDES_EXTS.indexOf(ext) !== -1) return SLIDES_SVG;
  return FILE_SVG;
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

/**
 * Checks whether this page was opened from the ta portal's preview page
 * (see js/preview.js, js/ta.js) rather than by a real student.
 * @return true if ?preview=1 is set
 */
function isPreviewMode() {
  return /[?&]preview=1(&|$)/.test(window.location.search);
}

/**
 * Resolves to the site content: the ta portal's unsaved snapshot in
 * preview mode, otherwise the live content from /api/content.
 * @return a promise resolving to the content object
 */
function fetchContent() {
  if (isPreviewMode()) {
    try {
      var raw = localStorage.getItem("preview_content");
      if (raw) return Promise.resolve(JSON.parse(raw));
    } catch (e) {}
  }
  return fetch("/api/content").then(function (res) { return res.json(); });
}

/**
 * Formats a day panel's date for its card ("Mon, Jan 5").
 * @param dateStr iso date string (yyyy-mm-dd)
 * @return the formatted date
 */
function fmtDate(dateStr) {
  var d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * Shows the dashboard if logged in, otherwise the gate.
 * @return the logged-in username, or null if there's no session
 */
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

/**
 * Builds a locked "available soon" day card.
 * @param dayNum the day number to show on the card
 * @return the card's html
 */
function soonCard(dayNum) {
  return '<div class="day-card soon">' +
    '<span class="soon-lock">' + LOCK_SVG + '</span>' +
    '<h3>Day ' + dayNum + '</h3>' +
    '<p class="muted">This module will be available soon</p>' +
    '<span class="badge locked">' + LOCK_SVG + 'Locked</span>' +
  '</div>';
}

/**
 * Renders every day panel into #dayGrid: unlocked panels with their
 * content, locked ones as a "soon" card, plus one trailing locked card for
 * the next day once everything so far is open.
 * @return how many day panels are currently unlocked
 */
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
      return '<a class="chip" href="' + itemHref(f) + '" target="_blank" rel="noopener">' + itemIcon(f) + ' ' + itemLabel(f) + '</a>';
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

/**
 * Fills in the "N of TOTAL_DAYS days unlocked" progress bar.
 * @param unlockedCount how many day panels are unlocked
 */
function renderProgress(unlockedCount) {
  var fill = document.getElementById("progFill");
  var label = document.getElementById("progLabel");
  var pct = Math.round((unlockedCount / TOTAL_DAYS) * 100);
  if (fill) setTimeout(function () { fill.style.width = pct + "%"; }, 150);
  if (label) label.textContent = unlockedCount + " of " + TOTAL_DAYS + " days unlocked (" + pct + "%)";
}

/** Renders the "Extra attachments" list into #resList. */
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
        itemIcon(f) +
        '<span><span class="rname">' + itemLabel(f) + '</span></span>' +
        '<a class="btn btn-ghost" href="' + itemHref(f) + '" target="_blank" rel="noopener">' +
          (isLink(f) ? "Open" : "Download") +
        '</a>' +
      '</div>';
  });
  list.innerHTML = rows;
}

/** Clears the session and sends the student back to the login page. */
function logout() {
  localStorage.removeItem("session");
  localStorage.removeItem("role");
  localStorage.removeItem("token");
  localStorage.removeItem("last_active");
  window.location.href = "login.html";
}

/**
 * Strips a link's href and swallows its clicks, so it can't navigate the
 * preview iframe away to a page a real student there shouldn't reach.
 * @param el the link/button to neuter
 */
function neuterLink(el) {
  if (!el) return;
  el.removeAttribute("href");
  el.style.opacity = ".5";
  el.style.cursor = "default";
  el.addEventListener("click", function (e) { e.preventDefault(); });
}

document.addEventListener("DOMContentLoaded", function () {
  var session = gateCheck();
  var logoutBtn = document.getElementById("logoutBtn");
  if (isPreviewMode()) {
    /* previewing isn't a real visit: don't let the brand logo wander the
       ta off to another page, and don't let "Log out" fire for real either,
       since it'd clear the session localStorage shares with the ta's own
       portal tab, ending their actual login just from clicking a preview */
    neuterLink(document.querySelector(".brand"));
    neuterLink(logoutBtn);
  } else if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  if (!session) return;

  fetchContent()
    .then(function (data) {
      DAYS = data.days;
      EXTRAS = data.extras;
      TOTAL_DAYS = data.total_days || TOTAL_DAYS;
      var unlocked = renderDays();
      renderProgress(unlocked);
      renderExtras();
    });
});
