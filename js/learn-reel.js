/**
 * Sets up (or, for reduced motion, skips) one reel's drift/scroll behavior.
 * @param wrap the reel's panel element (.reel)
 * @note Safe to call twice - only the first call does anything, and a second
 * content load never changes an already-built reel's markup.
 */
function initReel(wrap) {
  var track = wrap.querySelector(".reel-track");
  if (!track || track.dataset.reelInit) return;
  track.dataset.reelInit = "1";

  var vertical = wrap.classList.contains("reel--vertical");
  var axis = vertical ? "Y" : "X";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  /* the object mini editor runs this same engine on a blank canvas, where
     autoplay would fight editing exactly as it does on the real page */
  var editorStatic = (isPreviewMode() && isEditMode()) || isObjectMode();

  /* reduced motion wins over the editor's manual-scroll mode below: falls
     back to the static grid, every tile visible at once, no scrolling */
  if (reducedMotion) {
    wrap.classList.add("static-grid");
    /* the static grid sizes tiles via its own css grid columns, but the
       inline style set at build time beats a stylesheet rule, so clear it */
    Array.prototype.forEach.call(track.querySelectorAll(".reel-tile"), function (t) {
      t.style.width = "";
      t.style.height = "";
    });
    return;
  }

  if (editorStatic) {
    /* one plain set of tiles, scrolled manually - no cloned loop buffer. The
       wrap-around reads naturally while autoplaying, but a ta scrolling
       through tiles to edit them doesn't expect the strip to loop out from
       under them, and every other list in the editor stops at its ends. */
    wrap.classList.add("reel--editor-scroll");
    return;
  }

  var originalCount = track.children.length;
  /* enough spare track that a fast hover-home never runs it dry at EITHER
     end: three sets ahead of rest, plus the one behind that onEnter()'s
     wind-back borrows from (see trackTransform()) */
  var REPEATS = 5;
  for (var r = 1; r < REPEATS; r++) {
    for (var i = 0; i < originalCount; i++) {
      var clone = track.children[i].cloneNode(true);
      stripTrackedAttrs(clone);
      clone.setAttribute("aria-hidden", "true");
      track.appendChild(clone);
    }
  }

  var firstTile = track.children[0];
  var lastOriginalTile = track.children[originalCount - 1];
  var setSpan = 0;
  var mask = wrap.querySelector(".reel-mask");

  /** Remeasures how far one full set of tiles (+ its trailing gap) spans, along the reel's own axis, for the drift loop. */
  function measure() {
    var trackStyle = getComputedStyle(track);
    var gap = parseFloat(vertical ? (trackStyle.rowGap || trackStyle.gap) : (trackStyle.columnGap || trackStyle.gap)) || 0;
    setSpan = vertical ?
      (lastOriginalTile.offsetTop + lastOriginalTile.offsetHeight) - firstTile.offsetTop + gap :
      (lastOriginalTile.offsetLeft + lastOriginalTile.offsetWidth) - firstTile.offsetLeft + gap;
  }
  measure();

  var baseSpeed = 88; /* px/sec */
  var HOMING_RATE = 9; /* per-second ease-toward-target rate, see homing tick() below */
  var anim = null; /* the compositor-driven idle-drift Web Animation, while not hovering any tile */
  var rafId = null; /* the input-driven homing/hold rAF loop, while hovering one */
  var hoverPos = 0; /* pos, but only meaningful while rafId owns it (see onEnter/tick/onLeave) */

  /** @return current drift position (px scrolled into the loop), read from the compositor animation. */
  function driftPos() {
    if (!anim || setSpan <= 0) return 0;
    var dur = (setSpan / baseSpeed) * 1000;
    var ct = anim.currentTime || 0;
    return ((ct % dur) + dur) % dur / dur * setSpan;
  }

  /**
   * The track's transform for a given drift position.
   * @param pos px scrolled into the loop
   * @return the translate() for this reel's own axis
   * @note Rests one whole tile set further along than pos implies, parking
   * it on the second copy. Invisible (every copy is identical), and it buys
   * a full set of track BEHIND the drift for onEnter()'s wind-back to borrow
   * from - without it a tile hovered near the loop's origin only came part
   * of the way back into view, or never moved at all.
   */
  function trackTransform(pos) {
    return "translate" + axis + "(" + (-(pos + setSpan)) + "px)";
  }

  /**
   * (Re)starts the idle drift as a fresh looping Web Animation, picking up
   * from `fromPos` so handing back off from a hover doesn't visibly jump.
   * @param fromPos px into the loop to resume from
   */
  function startDrift(fromPos) {
    if (anim) anim.cancel();
    if (setSpan <= 0) return;
    var dur = (setSpan / baseSpeed) * 1000;
    anim = track.animate(
      [{ transform: trackTransform(0) }, { transform: trackTransform(setSpan) }],
      { duration: dur, iterations: Infinity, easing: "linear" }
    );
    anim.currentTime = ((fromPos % setSpan) + setSpan) % setSpan / setSpan * dur;
  }

  startDrift(0);

  window.addEventListener("resize", function () {
    var resumeFrom = rafId ? null : driftPos(); /* mid-hover: measure() alone is enough, the rAF loop owns pos */
    measure();
    if (resumeFrom !== null) startDrift(resumeFrom);
  });

  /**
   * Homes the drift toward fully revealing `el` (or freezes in place if it's
   * already on screen) and pops it up, handing the track from the idle Web
   * Animation to a rAF loop for the hover's duration.
   * @param el the hovered tile
   * @note Works on both edges of the mask: a tile still entering is pulled
   * in by speeding the drift up, one on its way out is brought back by
   * running it backwards, so half-visible tiles read the same at either end.
   */
  function onEnter(el) {
    /* driftPos() only means anything while the Web Animation owns the track;
       mid-hover hoverPos is already live, and reading a cancelled anim would
       snap the position back to 0 */
    if (anim) hoverPos = driftPos();
    /* pin the track to where the drift actually reached BEFORE handing over.
       cancel() drops its transform out of the computed style at once, so
       without this the measurements below read the tile at whatever stale
       transform the last hover left, and that gap was being subtracted from
       the wind-back - landing it short, or skipping it entirely. */
    track.style.transform = trackTransform(hoverPos);
    if (anim) { anim.cancel(); anim = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }

    var maskRect = mask.getBoundingClientRect();
    /* placed from layout offsets against the track's rect, not the tile's
       own bounding rect: a tile still easing out of a previous scale(1.08)
       measures up to 4% too big mid-flight. The track only ever carries a
       translate, so its rect is safe to anchor to. */
    var trackRect = track.getBoundingClientRect();
    var tileStart = vertical ?
      trackRect.top + (el.offsetTop - track.offsetTop) :
      trackRect.left + (el.offsetLeft - track.offsetLeft);
    var tileEnd = tileStart + (vertical ? el.offsetHeight : el.offsetWidth);
    /* matches the mask-image stop on .reel-mask: a tile parked inside that
       band is on screen but still visibly faded, which reads as "not all the
       way back" to anyone looking at it */
    var margin = 64;
    /* how far past each edge the tile hangs. Only one can be positive unless
       the tile is bigger than the mask, in which case the near edge wins:
       reading one starts at its beginning. */
    var overflow = tileEnd - ((vertical ? maskRect.bottom : maskRect.right) - margin);
    var underflow = ((vertical ? maskRect.top : maskRect.left) + margin) - tileStart;
    var targetPos = hoverPos;
    if (underflow > 0) targetPos = hoverPos - underflow;
    else if (overflow > 0) targetPos = hoverPos + overflow;
    el.classList.add("popped");

    var lastTime = null;
    function tick(time) {
      if (lastTime === null) lastTime = time;
      var dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      var dist = targetPos - hoverPos;
      if (Math.abs(dist) < 0.4) hoverPos = targetPos;
      else hoverPos += dist * Math.min(1, HOMING_RATE * dt);

      track.style.transform = trackTransform(hoverPos);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  /** Un-pops `el` and hands the drift back to a fresh Web Animation from wherever the hover left off. */
  function onLeave(el) {
    el.classList.remove("popped");
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    startDrift(hoverPos);
  }

  Array.prototype.forEach.call(track.querySelectorAll(".reel-tile"), function (el) {
    el.addEventListener("mouseenter", function () { onEnter(el); });
    el.addEventListener("mouseleave", function () { onLeave(el); });
  });
}

/** Sets up every reel currently on the page - see initReel(). */
function initAllReels() {
  document.querySelectorAll(".reel").forEach(function (wrap) { initReel(wrap); });
}

/**
 * Strips every data-edit-id/data-resize-id (and plain id) off `el` and its
 * descendants, so a cloned tile never fights the original over the editor's
 * click-to-edit/resize wiring - it's a purely visual echo filling the loop.
 * @param el the cloned tile root
 */
function stripTrackedAttrs(el) {
  el.removeAttribute("data-edit-id");
  el.removeAttribute("data-resize-id");
  el.removeAttribute("id");
  el.querySelectorAll("[data-edit-id], [data-resize-id], [id]").forEach(function (child) {
    child.removeAttribute("data-edit-id");
    child.removeAttribute("data-resize-id");
    child.removeAttribute("id");
  });
}
