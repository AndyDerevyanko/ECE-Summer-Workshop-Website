/* gallery viewer, one photo or clip at a time. Media lists come from
   /api/content (content.gallery), ta-editable from instructor.html.

   This file owns no markup: the rail, the stages, the arrows and the counter
   are all placed custom elements built by main.js, so a ta can move, restyle
   and delete every one of them. What's left here is the part that can't be an
   element - which directories exist, which image each pane sits on, and what
   the page's two variables therefore read. */

var DEFAULT_GALLERY = {
  video: { autoplay: true, controls: false, pausable: false },
  video_opts: {},
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

/* which image each pane BINDING is on, keyed by directory ("" for the
   rail-following one). Keyed by binding, not element, so two panes on the same
   directory stay in step - they're two views of one thing. */
var GALLERY_IDX = {};

/**
 * Whether this page was opened from the portal's preview rather than by a
 * real visitor.
 * @return true if ?preview=1 is set
 * @note The gallery gets its own preview tab so unsaved directory/image edits
 * can be checked on their own.
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

/* the baseline every clip plays by, out of content.gallery.video. Held here
   rather than read off GALLERY_CONTENT each time so the fallback path, which
   never sees a content blob, paints from the same defaults. */
var GALLERY_VIDEO_OPTS = { autoplay: true, controls: false, pausable: false };

/* the per-clip choices on top of it, {url: {autoplay, controls, pausable}},
   straight out of content.gallery.video_opts (the checkboxes under a clip in
   the content manager's Gallery section) */
var GALLERY_VIDEO_BY_URL = {};

/**
 * Loads the gallery's video playback settings out of a content blob.
 * @param gallery content.gallery
 * @note A blob saved before these existed has no "video" key, so anything
 * missing falls back to how the gallery always behaved: muted clips that
 * start on their own, loop, and show no player chrome.
 */
function initGalleryVideoOpts(gallery) {
  var v = (gallery && gallery.video) || {};
  GALLERY_VIDEO_OPTS = {
    autoplay: v.autoplay !== false,
    controls: !!v.controls,
    pausable: !!v.pausable
  };
  GALLERY_VIDEO_BY_URL = (gallery && gallery.video_opts) || {};
}

/**
 * How one clip plays: its own saved settings if a ta set any, else the
 * gallery-wide baseline.
 * @param url the clip's media url
 * @return {autoplay, controls, pausable}
 * @note All-or-nothing per clip rather than per flag, because that's what the
 * content manager writes. Per-flag merging would allow a clip that "inherits
 * autoplay but not controls" - a state no ui can show.
 */
function galleryVideoOptsFor(url) {
  var own = url && GALLERY_VIDEO_BY_URL[url];
  if (!own) return GALLERY_VIDEO_OPTS;
  return {
    autoplay: own.autoplay !== false,
    controls: !!own.controls,
    pausable: !!own.pausable
  };
}

/**
 * Every directory name currently defined, in content-manager order.
 * @return an array of directory names
 * @note Exposed to main.js so the right-click "Image pane..." picker can
 * offer them without knowing anything about gallery content.
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
 * Reads one of the page's two exclusive variables for one pane binding.
 * @param local "gallery-current" or "gallery-total"
 * @param dir the binding's directory name, "" for the rail-following one
 * @return the value as a display string
 * @note Lives here because only this file knows where each binding is.
 */
function galleryChipValue(local, dir) {
  var list = listFor(dir);
  if (local === "gallery-total") return String(list.length);
  return String(list.length ? (GALLERY_IDX[dir] || 0) + 1 : 0);
}
window.galleryChipValue = galleryChipValue;

/**
 * Moves one pane binding through its directory, wrapping at both ends - what
 * a "gallery:prev"/"gallery:next" action does when clicked.
 * @param dir the binding's directory name, "" for the rail-following one
 * @param step -1 for previous, 1 for next
 * @note Any number of buttons can point at the same action; all land here.
 */
function stepGallery(dir, step) {
  var list = listFor(dir);
  if (!list.length) return;
  GALLERY_IDX[dir] = ((GALLERY_IDX[dir] || 0) + step + list.length) % list.length;
  paintPanes();
}
window.stepGallery = stepGallery;

/**
 * Paints every placed pane with whichever media its binding is on, repaints
 * the variable chips, and preloads each pane's neighbours so arrows feel
 * instant.
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
      var vopts = galleryVideoOptsFor(cur);
      img.hidden = true;
      vid.hidden = false;
      vid.controls = vopts.controls;
      vid.autoplay = vopts.autoplay;
      if (vid.getAttribute("src") !== cur) vid.src = cur;
      /* a fresh start either way: autoplay off waits on the visitor (the
         first frame is already up, so the pane doesn't go black), and
         autoplay on has to be asked for - the attribute only covers a clip
         that was in the markup at load */
      if (vopts.autoplay) vid.play().catch(function () {});
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
   name chip. Computed here since script order guarantees main.js has run. */
var DEFAULT_GALLERY_LABEL_HTML = buildGalleryDirChipHtml();
var DEFAULT_GALLERY_EMPTY_HTML = "<strong>No directories yet.</strong>";

/**
 * Builds one directory tile's markup.
 * @param dir the directory name
 * @param style {rectColor, rectDarkColor, rectRadius} (reads "gallery.dir.*")
 * @param labelHtml content.text["gallery.dir.label"], or undefined for the
 *   shared default
 * @return an HTML string for one tile
 * @note The rect and label are INDEPENDENT SIBLINGS, not nested, so deleting
 * the rect never cascades into the text on top of it. Both carry a shared
 * fixed id: this is one template rendered per directory, so a style or text
 * edit to any tile applies to all of them, as with the dashboard's tiles.
 * @note The label defaults to a name chip rather than the literal text, so
 * the template can be restyled and typed around without one tile's edit
 * overwriting another directory's actual name.
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

/* the full /api/content response, stashed so renderDirs() can read the
   colors/radius/text/hidden itself: main.js's sweeps run against whatever is
   in the DOM at the time, and these tiles are built later. */
var GALLERY_CONTENT = null;

/**
 * Renders the rail's live area: the empty-state text plus one tile per
 * directory, inside the placed "galleryDirArea" element.
 * @note Rebuilds the whole area's innerHTML each run - this section is small
 * enough that incremental diffing isn't worth it.
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

  /* the tiles are DIRECT children of the area: the area itself is the tile
     flow container, and a wrapper would become the thing tiles laid out
     inside, leaving the container a ta resizes with nothing to arrange. The
     empty-state text isn't a tile, so it spans the line - it borrows
     .extras-empty from the dashboard verbatim so the three live areas can't
     drift apart. */
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

  /* whatever a ta dropped onto a directory tile, rebuilt into EVERY tile: the
     rail has no per-directory entry to hang a child off, so these belong to
     the shared template. Repainting their overrides is the job of
     applyLiveAreaOverrides() below. */
  if (window.renderTileChildren && window.tileChildrenFor) {
    var dirChildren = window.tileChildrenFor("gallery.dir.tile");
    host.querySelectorAll("[data-gallery-tile]").forEach(function (tileEl) {
      window.renderTileChildren(tileEl, dirChildren);
    });
  }

  /* click-to-edit text wiring is a one-time, non-delegated pass (js/main.js's
     wireClickToEdit(), already run by the time the content fetch gets here),
     so these just-built tiles need wiring by hand, same as the dashboard's */
  if (isGalleryPreview() && isEditMode()) {
    host.querySelectorAll("[data-edit-id]").forEach(wireTextField);
  }

  /* same "these tiles didn't exist when the sweeps ran" repaint the dashboard
     areas need, see applyLiveAreaOverrides() in js/main.js */
  if (window.applyLiveAreaOverrides) window.applyLiveAreaOverrides(data);

  /* host is out of flow, so grow the in-flow spacer it anchors to, then
     re-anchor once more so the stage beside it sees the corrected rect */
  var anchor = document.getElementById("galleryDirsAnchor");
  if (anchor) anchor.style.minHeight = host.offsetHeight + "px";
  if (window.applyElementAnchors) window.applyElementAnchors();
}

/**
 * Rebuilds everything this file owns: the rail's tiles, then each pane's
 * media and the chips that read off them.
 * @note Called via the window.renderGallery hook once main.js has built the
 * elements, and again whenever a ta places a new pane.
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
 * first one. Split out so the fallback below can feed it the hardcoded
 * default without going near the network.
 * @param gallery content.gallery, {years, images}
 */
function initGalleryContent(gallery) {
  DIRS = (gallery && gallery.years) || [];
  PHOTOS = (gallery && gallery.images) || {};
  initGalleryVideoOpts(gallery);
  if (DIRS.indexOf(selectedDir) === -1) selectedDir = DIRS[0] || "";
}

/**
 * Puts the rail into the order its tiles are now in, after a ta dragged one
 * elsewhere in the visual editor.
 * @param slots each tile's original index in DIRS, in the tiles' new order
 * @note The order IS content - it's what a visitor sees and what "the first
 * directory" means - so it's written back to content.gallery.years and saved.
 * @note The dom is already in the new order, so nothing re-renders.
 */
function reorderGalleryDirs(slots) {
  var out = [];
  var taken = {};
  slots.forEach(function (i) {
    if (i >= 0 && i < DIRS.length && !taken[i]) { taken[i] = true; out.push(DIRS[i]); }
  });
  /* a directory the rail didn't account for keeps its place at the end rather
     than being deleted by a reorder - same stance js/main.js's
     reorderBySlots() takes for every other tile list */
  DIRS.forEach(function (d, i) { if (!taken[i]) out.push(d); });
  DIRS = out;
  if (GALLERY_CONTENT && GALLERY_CONTENT.gallery) {
    GALLERY_CONTENT.gallery.years = DIRS.slice();
    if (window.saveGallery) window.saveGallery(GALLERY_CONTENT.gallery);
  }
}
window.reorderGalleryDirs = reorderGalleryDirs;

/**
 * Points the rail at a different directory.
 * @param dir the directory to select
 * @note Only panes bound to "" move with it, and their index resets: "image
 * 40 of 57" means nothing in a directory that has eleven.
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

/* clicking a tile selects it, clicking a pane steps it forward - both
   delegated off document, so tiles and panes rendered later work with no
   re-wiring. Inert in the visual editor, where a click selects an element. */
document.addEventListener("click", function (e) {
  if (isEditMode && isEditMode()) return;
  var tile = e.target.closest && e.target.closest("[data-gallery-tile]");
  if (tile) { selectDir(tile.getAttribute("data-gallery-dir") || ""); return; }
  var pane = e.target.closest && e.target.closest("[data-gallery-pane]");
  if (!pane) return;
  /* a click on the clip ITSELF belongs to the player once a ta has handed the
     visitor any control over playback: stepping to the next image on the same
     click that pauses would make both unusable */
  var vid = e.target.closest('[data-gallery-media="vid"]');
  /* whichever clip this pane is actually sitting on - paintPanes() puts its
     url on the element, so the settings that decide this are the same ones it
     painted with, even with two panes on different clips side by side */
  var vopts = vid ? galleryVideoOptsFor(vid.getAttribute("src")) : null;
  if (vid && !vid.hidden && (vopts.controls || vopts.pausable)) {
    /* with the native controls up the browser already play/pauses on a click
       on the video, so this only has to cover the controls-free case */
    if (!vopts.controls) {
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
 * Renders the seeded viewer from main.js's own copy of the gallery elements,
 * for the one case where /api/content is unreachable - the page's content IS
 * those elements now, so otherwise it would load as an empty column.
 * @note Only on that path: a ta who deliberately deleted the rail made a real
 * choice, and this must never undo it.
 */
function buildGalleryFallback() {
  GALLERY_CONTENT = { text: {}, colors: {}, dark_colors: {}, radius: {}, hidden: [] };
  initGalleryContent(DEFAULT_GALLERY);
  renderGallery();
}
window.buildGalleryFallback = buildGalleryFallback;

document.addEventListener("DOMContentLoaded", function () {
  if (isGalleryPreview()) {
    /* previewing isn't a real visit: don't let the nav wander the ta off to a
       non-preview page. dim=false - the nav is editable here, so it has to
       render in its real colours rather than looking half-disabled. */
    neuterLink(document.querySelector(".brand"), false);
    neuterLink(document.querySelector(".nav-back"), false);
    document.querySelectorAll(".nav-links a").forEach(function (a) { neuterLink(a, false); });
  }

  /* the directory list rides along in the content blob main.js already
     fetches, and that pipeline builds the elements rendered into here - so
     stash it and let main.js's window.renderGallery hook do the rendering,
     rather than racing it with a second fetch */
  fetchContent()
    .then(function (data) {
      GALLERY_CONTENT = data;
      initGalleryContent(data.gallery || DEFAULT_GALLERY);
      renderGallery();
    })
    .catch(function () { buildGalleryFallback(); });
});
