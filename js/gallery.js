/* gallery viewer, one photo or clip at a time */
/* media lists come from /api/content (content.gallery), ta-editable from instructor.html */

/* used if /api/content can't be reached, same shape/values as DEFAULT_CONTENT in app/db.py */
var DEFAULT_GALLERY = {
  years: ["2026", "2025"],
  images: {
    "2026": ["assets/gallery/group-main-2026.png"],
    "2025": ["assets/gallery/group_photo_2025.jpg"]
  }
};

var PHOTOS = {};
var YEARS = [];
var year = "";
var idx = 0;

var img = document.getElementById("gvImg");
var vid = document.getElementById("gvVid");
var count = document.getElementById("gvCount");
var yearLbl = document.getElementById("gvYear");
var yearsWrap = document.getElementById("gvYears");

/**
 * Checks whether this page was opened from the ta portal's preview page
 * (see js/preview.js, js/ta.js) rather than by a real visitor. The gallery
 * gets its own preview tab, separate from the landing page, so unsaved
 * gallery edits (new years/images not yet applied) can be checked on their
 * own instead of only showing whatever was last saved live.
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
 * Strips a link's href and swallows its clicks, so it can't navigate the
 * preview iframe away to a page a real visitor there shouldn't reach.
 * @param el the link to neuter
 */
function neuterLink(el) {
  if (!el) return;
  el.removeAttribute("href");
  el.style.opacity = ".5";
  el.style.cursor = "default";
  el.addEventListener("click", function (e) { e.preventDefault(); });
}

/**
 * Checks whether a gallery url is a video clip.
 * @param u the media url
 * @return true if it's a .MOV clip
 */
function isVid(u) { return /\.mov$/i.test(u); }

/** Shows the current photo/clip for the selected year and updates the counter. */
function show() {
  var list = PHOTOS[year] || [];
  if (!list.length) {
    img.hidden = true;
    vid.hidden = true;
    count.textContent = "0 / 0";
    return;
  }
  var cur = list[idx];
  if (isVid(cur)) {
    img.hidden = true;
    vid.hidden = false;
    vid.src = cur;
    vid.play();
  } else {
    vid.pause();
    vid.removeAttribute("src");
    vid.hidden = true;
    img.hidden = false;
    img.src = cur;
  }
  count.textContent = (idx + 1) + " / " + list.length;
  /* preload neighbouring photos so the arrows feel instant */
  var n = list.length;
  var nxt = list[(idx + 1) % n];
  var prv = list[(idx - 1 + n) % n];
  if (!isVid(nxt)) new Image().src = nxt;
  if (!isVid(prv)) new Image().src = prv;
}

/**
 * Moves the viewer forward or back within the current year's list, wrapping at both ends.
 * @param d -1 for previous, 1 for next
 */
function step(d) {
  var list = PHOTOS[year] || [];
  if (!list.length) return;
  idx = (idx + d + list.length) % list.length; /* wraps around at both ends */
  show();
}

/** Rebuilds the year rail from whatever years the ta portal last saved. */
function renderYearRail() {
  if (!yearsWrap) return;
  yearsWrap.innerHTML = YEARS.map(function (y) {
    return '<button class="gv-year' + (y === year ? ' active' : '') + '" data-year="' + y + '" type="button">' + y + '</button>';
  }).join("");
  yearsWrap.querySelectorAll(".gv-year").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var y = this.getAttribute("data-year");
      if (y === year) return;
      year = y;
      idx = 0;
      yearsWrap.querySelectorAll(".gv-year").forEach(function (b) { b.classList.remove("active"); });
      this.classList.add("active");
      if (yearLbl) yearLbl.textContent = year;
      show();
    });
  });
}

document.getElementById("gvPrev").addEventListener("click", function () { step(-1); });
document.getElementById("gvNext").addEventListener("click", function () { step(1); });
img.addEventListener("click", function () { step(1); });
vid.addEventListener("click", function () { step(1); });

document.addEventListener("keydown", function (e) {
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});

function init(gallery) {
  YEARS = gallery.years || [];
  PHOTOS = gallery.images || {};
  year = YEARS[0] || "";
  idx = 0;
  if (yearLbl) yearLbl.textContent = year;
  renderYearRail();
  show();
}

if (isPreviewMode()) {
  /* previewing isn't a real visit: the gallery is its own preview tab now,
     don't let the brand logo or the other nav links wander the ta off to
     a non-preview page while they're just checking unsaved gallery edits */
  neuterLink(document.querySelector(".brand"));
  neuterLink(document.querySelector(".nav-back"));
  document.querySelectorAll(".nav-links a").forEach(neuterLink);
}

fetchContent()
  .then(function (data) { init(data.gallery || DEFAULT_GALLERY); })
  .catch(function () { init(DEFAULT_GALLERY); });
