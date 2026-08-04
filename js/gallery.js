/* gallery viewer, one photo or clip at a time.
   Media lists come from /api/content (content.gallery), ta-editable from
   instructor.html's Gallery section.

   This file no longer owns any markup. The directory rail, the photo stage(s),
   the arrows and the counter are all placed custom elements built by
   js/main.js (see buildCustomElementNode()'s "galleryDirArea"/"galleryPane"
   kinds and app/db.py's _GALLERY_ENTRIES), exactly like the student
   dashboard's tile areas - so a ta can move, resize, restyle, delete and
   re-add every one of them from the visual editor. What's left here is the
   part that can't be expressed as an element: which directories exist, which
   image each pane is sitting on, and what the page's own two variables
   therefore read. */

/* used if /api/content can't be reached, same shape/values as DEFAULT_CONTENT
   in app/db.py. "years" is the storage key a directory list has always had -
   the names in it are free text now (a ta can call one "Field trip"), the key
   just isn't worth a migration to rename. */
var DEFAULT_GALLERY = {
  video: { autoplay: true, controls: false, pausable: false },
  years: ["2026", "2025"],
  images: {
    "2026": ["assets/gallery/group-main-2026.png"],
    "2025": ["assets/gallery/group_photo_2025.jpg"]
  }
};

var PHOTOS = {};
var DIRS = [];

/* which directory the RAIL has selected. Only panes bound to "" (the seeded
   one, see _GALLERY_PANE_ENTRY) follow it; a pane a ta pinned to a directory
   ignores it entirely, which is what lets one page show 2025 beside 2026. */
var selectedDir = "";

/* which image each pane BINDING is sitting on, keyed by directory name ("" for
   the rail-following binding). Keyed by binding rather than by element so two
   panes showing the same directory stay in step - they're two views of one
   thing, and the page's variables/actions name that thing, not the elements. */
var GALLERY_IDX = {};

/**
 * Checks whether this page was opened from the ta portal's preview page
 * (see js/preview.js, js/ta.js) rather than by a real visitor. The gallery
 * gets its own preview tab, separate from the landing page, so unsaved
 * gallery edits (new directories/images not yet applied) can be checked on
 * their own instead of only showing whatever was last saved live.
 * @return true if ?preview=1 is set
 */
function isGalleryPreview() {
  return /[?&]preview=1(&|$)/.test(window.location.search);
}

/**
 * Checks whether a gallery url is a video clip.
 * @param u the media url
 * @return true if it's a .MOV clip
 */
function isVid(u) { return /\.mov$/i.test(u); }

/* how a clip plays inside an image pane, straight out of content.gallery.video
   (the content manager's Gallery section). Held here rather than read off
   GALLERY_CONTENT every time so the fallback path, which never sees a content
   blob at all, has the same defaults to paint from. */
var GALLERY_VIDEO_OPTS = { autoplay: true, controls: false, pausable: false };

/**
 * Loads the gallery's video playback settings out of a content blob. A blob
 * saved before these existed has no "video" key at all, so anything missing
 * falls back to how the gallery has always behaved: muted clips that start on
 * their own, loop, and show no player chrome.
 * @param gallery content.gallery
 */
function initGalleryVideoOpts(gallery) {
  var v = (gallery && gallery.video) || {};
  GALLERY_VIDEO_OPTS = {
    autoplay: v.autoplay !== false,
    controls: !!v.controls,
    pausable: !!v.pausable
  };
}

/**
 * Every directory name currently defined, in the order the content manager
 * lists them. Exposed to js/main.js so the right-click menu's "Image pane..."
 * picker can offer them without knowing anything about gallery content.
 * @return an array of directory names
 */
function galleryDirNames() { return DIRS.slice(); }
window.galleryDirNames = galleryDirNames;

/**
 * Which directory one pane binding actually resolves to right now: itself, or
 * whatever the rail has selected for the "" binding.
 * @param dir a binding's directory name
 * @return the real directory name
 */
function resolveDir(dir) { return dir || selectedDir; }

/**
 * The image list one binding is flipping through.
 * @param dir a binding's directory name
 * @return an array of media urls (empty if the directory is gone/empty)
 */
function listFor(dir) { return PHOTOS[resolveDir(dir)] || []; }

/**
 * Reads one of the page's two exclusive variables for one pane binding - what
 * js/main.js's gallery chips (${Gallery2026Current}/${Gallery2026Total}) print.
 * Kept here rather than in main.js because only this file knows where each
 * binding currently is; main.js just asks.
 * @param local "gallery-current" or "gallery-total"
 * @param dir the binding's directory name, "" for the rail-following one
 * @return the value as a display string
 */
function galleryChipValue(local, dir) {
  var list = listFor(dir);
  if (local === "gallery-total") return String(list.length);
  return String(list.length ? (GALLERY_IDX[dir] || 0) + 1 : 0);
}
window.galleryChipValue = galleryChipValue;

/**
 * Moves one pane binding forward or back through its directory, wrapping at
 * both ends - what an element linked to a "gallery:prev"/"gallery:next" action
 * actually does when clicked (see applyOneLink() in js/main.js). Any number of
 * buttons can be pointed at the same action; they all land here.
 * @param dir the binding's directory name, "" for the rail-following one
 * @param step -1 for previous, 1 for next
 */
function stepGallery(dir, step) {
  var list = listFor(dir);
  if (!list.length) return;
  GALLERY_IDX[dir] = ((GALLERY_IDX[dir] || 0) + step + list.length) % list.length;
  paintPanes();
}
window.stepGallery = stepGallery;

/**
 * Paints every placed image pane with whichever media its binding is on, and
 * repaints the page's variable chips to match. Preloads each pane's
 * neighbouring photos so the arrows feel instant, same as the old viewer did.
 */
function paintPanes() {
  document.querySelectorAll("[data-gallery-pane]").forEach(function (pane) {
    var dir = pane.getAttribute("data-gallery-dir") || "";
    var list = listFor(dir);
    var img = pane.querySelector('[data-gallery-media="img"]');
    var vid = pane.querySelector('[data-gallery-media="vid"]');
    if (!img || !vid) return;
    if (!list.length) {
      img.hidden = true;
      vid.pause();
      vid.removeAttribute("src");
      vid.hidden = true;
      return;
    }
    var i = GALLERY_IDX[dir] || 0;
    if (i >= list.length) { i = 0; GALLERY_IDX[dir] = 0; }
    var cur = list[i];
    if (isVid(cur)) {
      img.hidden = true;
      vid.hidden = false;
      vid.controls = GALLERY_VIDEO_OPTS.controls;
      vid.autoplay = GALLERY_VIDEO_OPTS.autoplay;
      if (vid.getAttribute("src") !== cur) vid.src = cur;
      /* flipping to a clip is a fresh start either way: autoplay off means it
         waits on the visitor (its first frame is already showing, so the pane
         doesn't go black), and autoplay on has to be asked for explicitly -
         the attribute alone only covers a clip that was in the markup at load */
      if (GALLERY_VIDEO_OPTS.autoplay) vid.play().catch(function () {});
      else vid.pause();
    } else {
      vid.pause();
      vid.removeAttribute("src");
      vid.hidden = true;
      img.hidden = false;
      img.src = cur;
    }
    var n = list.length;
    var nxt = list[(i + 1) % n];
    var prv = list[(i - 1 + n) % n];
    if (!isVid(nxt)) new Image().src = nxt;
    if (!isVid(prv)) new Image().src = prv;
  });
  if (window.repaintGalleryChips) window.repaintGalleryChips();
}

/* the shared template default for a directory tile's label - just the local
   name chip (js/main.js's buildGalleryDirChipHtml(), the rail's equivalent of
   the attachment filename chip), computed once here since main.js is
   guaranteed to have already run (script tag order) by the time this file's
   own top-level code executes. */
var DEFAULT_GALLERY_LABEL_HTML = buildGalleryDirChipHtml();
var DEFAULT_GALLERY_EMPTY_HTML = "<strong>No directories yet.</strong>";

/**
 * Builds one directory tile's markup: a wrapper (data-gallery-tile, bound to
 * this specific directory via data-gallery-dir, tracked under the shared
 * "gallery.dir.tile" id so a ta can resize it and re-tile the rail around it)
 * holding TWO INDEPENDENT SIBLING elements - the coloured rect and the label -
 * rather than nesting the label inside the rect, so a ta deleting the rect
 * never cascades into deleting the text on top of it. Both carry a SHARED,
 * fixed id, so this is one shared template rendered once per directory: a
 * style or text edit to any single tile applies to all of them, live and after
 * reload alike, exactly like the attachments tiles on the dashboard (see
 * buildExtrasTileHtml() in js/dashboard.js).
 *
 * The label defaults to a name chip rather than to the directory's literal
 * text: the words are real content a ta types in the content manager, and
 * routing them through a variable means the shared template can be restyled,
 * moved and typed around without any one tile's edit being able to overwrite
 * another directory's actual name - the same treatment a day tile's title got.
 * @param dir the directory name
 * @param style {rectColor, rectDarkColor, rectRadius} (reads "gallery.dir.*")
 * @param labelHtml content.text["gallery.dir.label"], or undefined for the
 *   shared default
 * @return an HTML string for one tile
 */
function buildGalleryDirTileHtml(dir, style, labelHtml) {
  var rectStyle = "";
  if (style.rectColor || style.rectDarkColor) {
    rectStyle += "background-color:" + resolveThemedColor(style.rectColor, style.rectDarkColor) + ";";
  }
  if (style.rectRadius) rectStyle += "border-radius:" + style.rectRadius + "px;";
  return (
    '<div class="gv-year' + (dir === selectedDir ? " active" : "") + '" data-gallery-tile="1"' +
      ' data-resize-id="gallery.dir.tile" data-gallery-dir="' + escapeHtml(dir) + '"' +
      ' role="button" tabindex="0">' +
      '<div class="gv-year-rect" data-resize-id="gallery.dir.rect" data-gallery-role="rect"' +
        (rectStyle ? ' style="' + rectStyle + '"' : "") + ' aria-hidden="true"></div>' +
      '<span class="gv-year-label" data-edit-id="gallery.dir.label" data-gallery-role="label" ' +
        'data-default-html="' + escapeHtml(DEFAULT_GALLERY_LABEL_HTML) + '">' +
        (labelHtml !== undefined ? labelHtml : DEFAULT_GALLERY_LABEL_HTML) +
      '</span>' +
    '</div>'
  );
}

/* the full /api/content response, stashed so renderDirs() can read
   content.colors/radius/text/hidden itself - it can't rely on js/main.js's own
   sweeps to paint its tiles, since those run against whatever's already in the
   DOM at the time they're called and these tiles are built later. Same
   reasoning (and same fix, applyLiveAreaOverrides()) as EXTRAS_CONTENT in
   js/dashboard.js. */
var GALLERY_CONTENT = null;

/**
 * Renders the directory rail's live area: the always-present empty-state text
 * plus one tile per directory, inside the placed "galleryDirArea" custom
 * element. Rebuilds the whole area's innerHTML every time it runs, same "no
 * incremental diffing, this section is small" reasoning as renderExtras().
 */
function renderDirs() {
  var host = document.querySelector("[data-gallery-dirs-area]");
  if (!host || !GALLERY_CONTENT) return;
  var data = GALLERY_CONTENT;
  var text = data.text || {};
  var colors = data.colors || {}, darkColors = data.dark_colors || {}, radius = data.radius || {};
  var style = {
    rectColor: colors["gallery.dir.rect"], rectDarkColor: darkColors["gallery.dir.rect"],
    rectRadius: radius["gallery.dir.rect"]
  };
  var emptyHtml = text["gallery.dirs.empty"] !== undefined
    ? text["gallery.dirs.empty"] : DEFAULT_GALLERY_EMPTY_HTML;

  /* the tiles are DIRECT children of the area, not wrapped in a list of their
     own: the area itself is the tile flow container (see applyTileFlow() in
     js/main.js), and an intermediate wrapper would be the thing the tiles
     actually tiled inside, leaving the container a ta resizes with nothing to
     lay out. The empty-state text isn't a tile, so it spans the whole line.
     It borrows .extras-empty/.has-attachments verbatim from the dashboard's
     own placeholder rather than getting a near-identical rule of its own: the
     behaviour wanted is exactly the same one ("hidden to a visitor once there
     IS content, still faintly visible in the editor so it stays reachable"),
     and one rule means the three live areas can't drift apart. */
  var html =
    '<p class="muted extras-empty tile-flow-full' + (DIRS.length ? " has-attachments" : "") +
      '" data-edit-id="gallery.dirs.empty" ' +
      'data-default-html="' + escapeHtml(DEFAULT_GALLERY_EMPTY_HTML) + '">' + emptyHtml + '</p>';
  html += DIRS.map(function (dir) {
    return buildGalleryDirTileHtml(dir, style, text["gallery.dir.label"]);
  }).join("");
  host.innerHTML = html;

  /* every deletable role in the template - a plain prefix test rather than a
     list of ids, so a role added to the template later doesn't silently stop
     honouring a ta's delete */
  (data.hidden || []).forEach(function (id) {
    if (!/^gallery\./.test(id)) return;
    host.querySelectorAll('[data-resize-id="' + id + '"], [data-edit-id="' + id + '"]').forEach(function (el) {
      setHiddenVisual(el, true);
    });
  });

  /* click-to-edit text wiring is a one-time, non-delegated pass (js/main.js's
     wireClickToEdit(), already run by the time the content fetch gets here),
     so these just-built tiles need wiring by hand, same as the dashboard's */
  if (isGalleryPreview() && isEditMode()) {
    host.querySelectorAll("[data-edit-id]").forEach(wireTextField);
  }

  /* same "these tiles didn't exist when the sweeps ran" repaint the dashboard
     areas need, see applyLiveAreaOverrides() in js/main.js */
  if (window.applyLiveAreaOverrides) window.applyLiveAreaOverrides(data);

  /* host is out of flow (it's absolutely positioned inside its .free-wrap),
     so grow the in-flow spacer it anchors to, then re-anchor everything once
     more so the stage beside it picks up its now-correct rect - see
     renderExtras()'s matching comment in js/dashboard.js */
  var anchor = document.getElementById("galleryDirsAnchor");
  if (anchor) anchor.style.minHeight = host.offsetHeight + "px";
  if (window.applyElementAnchors) window.applyElementAnchors();
}

/**
 * Rebuilds everything this file owns: the rail's tiles, then each pane's
 * media and the variable chips that read off them. Called via the
 * window.renderGallery hook from js/main.js's applySharedOverridePasses()
 * (which is what builds the elements being rendered into) and again whenever
 * a ta places a new pane.
 */
function renderGallery() {
  renderDirs();
  paintPanes();
  /* a pane is as tall as a ta dragged it, and the section below has to start
     under it - same in-flow spacer growth the rail just did for itself */
  var pane = document.querySelector("[data-gallery-pane]");
  var paneAnchor = document.getElementById("galleryPaneAnchor");
  if (pane && paneAnchor) {
    var h = pane.getBoundingClientRect().height;
    if (h) paneAnchor.style.minHeight = h + "px";
  }
}
window.renderGallery = renderGallery;

/**
 * Loads the directory list out of a content blob and points the rail at the
 * first one. Split from renderGallery() so the fallback path below can feed it
 * the hardcoded default without going near the network.
 * @param gallery content.gallery, {years, images}
 */
function initGalleryContent(gallery) {
  DIRS = (gallery && gallery.years) || [];
  PHOTOS = (gallery && gallery.images) || {};
  initGalleryVideoOpts(gallery);
  if (DIRS.indexOf(selectedDir) === -1) selectedDir = DIRS[0] || "";
}

/**
 * Points the rail at a different directory. Only panes bound to "" move with
 * it; their index resets, since "image 40 of 57" means nothing in a directory
 * that has eleven.
 * @param dir the directory to select
 */
function selectDir(dir) {
  if (dir === selectedDir) return;
  selectedDir = dir;
  GALLERY_IDX[""] = 0;
  document.querySelectorAll("[data-gallery-tile]").forEach(function (tile) {
    tile.classList.toggle("active", tile.getAttribute("data-gallery-dir") === selectedDir);
  });
  paintPanes();
}

/* clicking a directory tile selects it, clicking a pane steps it forward -
   both delegated off document, so tiles and panes rendered later (or placed
   mid-session by a ta) work with no re-wiring, the same convention
   wireNavButtons() follows. Inert inside the visual editor, where a click is
   how an element gets selected and edited. */
document.addEventListener("click", function (e) {
  if (isEditMode && isEditMode()) return;
  var tile = e.target.closest && e.target.closest("[data-gallery-tile]");
  if (tile) { selectDir(tile.getAttribute("data-gallery-dir") || ""); return; }
  var pane = e.target.closest && e.target.closest("[data-gallery-pane]");
  if (!pane) return;
  /* a click on the clip ITSELF belongs to the player as soon as a ta has
     handed the visitor any control over playback: stepping to the next image
     on the same click that pauses (or that reaches for the scrub bar) would
     make both unusable. Everywhere else in the pane still steps as always. */
  var vid = e.target.closest('[data-gallery-media="vid"]');
  if (vid && !vid.hidden && (GALLERY_VIDEO_OPTS.controls || GALLERY_VIDEO_OPTS.pausable)) {
    /* with the native controls up the browser already play/pauses on a click
       on the video, so this only has to cover the controls-free case */
    if (!GALLERY_VIDEO_OPTS.controls) {
      if (vid.paused) vid.play().catch(function () {});
      else vid.pause();
    }
    return;
  }
  stepGallery(pane.getAttribute("data-gallery-dir") || "", 1);
});

document.addEventListener("keydown", function (e) {
  if (isEditMode && isEditMode()) return;
  /* the arrow keys drive the rail-following pane, the one the page ships with
     and the only binding a visitor can be said to be "looking at" */
  if (e.key === "ArrowLeft") stepGallery("", -1);
  if (e.key === "ArrowRight") stepGallery("", 1);
});

/**
 * Renders the seeded viewer from js/main.js's own copy of the gallery
 * elements, for the one case where /api/content is unreachable: the page's
 * content IS those elements now, so without this the gallery would load as an
 * empty column rather than degrading to its hardcoded default photo. Only on
 * that path - a ta who deliberately deleted the rail is making a real choice,
 * and this must never undo it.
 */
function buildGalleryFallback() {
  GALLERY_CONTENT = { text: {}, colors: {}, dark_colors: {}, radius: {}, hidden: [] };
  initGalleryContent(DEFAULT_GALLERY);
  renderGallery();
}
window.buildGalleryFallback = buildGalleryFallback;

document.addEventListener("DOMContentLoaded", function () {
  if (isGalleryPreview()) {
    /* previewing isn't a real visit: don't let the brand logo or the other nav
       links wander the ta off to a non-preview page while they're just
       checking unsaved gallery edits. dim=false throughout: the nav is
       editable in the visual editor, so it has to render in its real colours
       rather than looking half-disabled (see neuterLink() in js/main.js). */
    neuterLink(document.querySelector(".brand"), false);
    neuterLink(document.querySelector(".nav-back"), false);
    document.querySelectorAll(".nav-links a").forEach(function (a) { neuterLink(a, false); });
  }

  /* the directory list rides along in the same content blob js/main.js is
     already fetching for the override pipeline, and that pipeline is what
     builds the elements rendered into here - so this stashes the content and
     lets main.js's window.renderGallery hook do the rendering, rather than
     racing it with a second fetch of its own (the mistake js/dashboard.js used
     to make, see its EXTRAS_CONTENT note). */
  fetchContent()
    .then(function (data) {
      GALLERY_CONTENT = data;
      initGalleryContent(data.gallery || DEFAULT_GALLERY);
      renderGallery();
    })
    .catch(function () { buildGalleryFallback(); });
});
