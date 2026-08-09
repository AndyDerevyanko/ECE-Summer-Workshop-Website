/* ta portal. everything edits the in-memory STATE object below; loaded from
   and saved to /api/content, which is the single source of truth. */

/* the landing page's photo slots' default urls, same keys/values as
   home_images in DEFAULT_CONTENT, app/db.py. No ui here edits these any more
   (the content manager's "Site images" list went with the rest of the Landing
   page section) - they're kept so normalizeState() can fill the key in on a
   blob saved before it existed, exactly as before. */
var HOME_IMAGE_DEFAULTS = {
  about_hero: "assets/gallery/group-main-alt.jpeg",
  about_1: "assets/gallery/class-closeup.jpeg",
  about_2: "assets/gallery/robot-closeup.png",
  about_3: "assets/gallery/class-2.jpeg",
  certificate: "assets/certificate.png"
};

/* same default set js/main.js/app/db.py fall back to (NAV_FIXED_IDS): the
   nav bar and everything inside it, promoted to "fixed" by default so it
   always stacks above every non-fixed element and shows the red "fixed"
   hitbox, see toggleFixed() in js/main.js. also what normalizeState() below
   backfills for a content blob saved before this feature existed. */
var NAV_FIXED_IDS = [
  "box.nav", "box.brand", "img.brand.nav", "nav.brand",
  "nav.link.about", "nav.link.gallery", "nav.link.learn",
  "nav.link.schedule", "nav.link.prizes", "nav.link.apply",
  "nav.portal", "box.themeBtn",
  /* and the same again for the landing page's signed-in navbar, which is a
     separate navbar with its own ids, see applyNavSessionState() in
     js/main.js */
  "navin.box.nav", "navin.box.brand", "navin.img.brand.nav", "navin.nav.brand",
  "navin.nav.link.about", "navin.nav.link.gallery", "navin.nav.link.learn",
  "navin.nav.link.schedule", "navin.nav.link.prizes",
  "navin.box.themeBtn", "navin.nav.dashboard", "navin.nav.logout"
];

/**
 * Returns a fresh default content blob, used for a brand-new profile and
 * to fill in missing fields in normalizeState().
 * @return the default content shape
 */
function seed() {
  return {
    days: [
      { day: 1, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] },
      { day: 2, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [] }
    ],
    extras: [],
    /* named, typed values other elements (right now, just the student
       dashboard's progress bar) can bind to, see renderVariables() below
       and app/db.py's DEFAULT_CONTENT["variables"] (same shape). type is
       "string"/"number"/"boolean"/"datetime". "builtin" ones can be
       renamed but never removed/retyped; "computed" ones have no
       ta-editable value at all, "value" is overwritten server-side on
       every load (see _refresh_computed_variables() in app/db.py). Everything
       in here is site-wide: what this list holds is exactly what every page's
       visual editor offers to bind. */
    variables: [
      {
        key: "total_days", name: "Total days", type: "number", value: 10,
        description: "\"__ of TOTAL days unlocked\" progress bar on student dashboard",
        builtin: true, computed: false
      },
      {
        key: "days_progressed", name: "Days progressed", type: "number", value: 0,
        description: "The day number the workshop is currently on (count of unlocked days), calculated automatically",
        builtin: true, computed: true
      }
    ],
    timer_mode: "tentative", /* tentative | actual */
    timer_target: "",
    join_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    hero_video_url: "assets/cover-video.mp4",
    home_images: Object.assign({}, HOME_IMAGE_DEFAULTS),
    logistics: [
      { big: "2 weeks", lbl: "Tentative start date", icon: false },
      { big: "4 hours", lbl: "1:30pm–5:30pm", icon: false },
      { big: "SFB520", lbl: "Sandford Fleming", icon: false },
      { big: "", lbl: "Certificate of completion", icon: true }
    ],
    gallery: {
      /* how a clip plays inside a gallery image pane, one choice for the whole
         gallery (see the Gallery section's "Video clips" card in
         instructor.html and paintPanes() in js/gallery.js) */
      video: { autoplay: true, controls: false, pausable: false },
      years: ["2026", "2025"],
      images: {
        "2026": ["assets/gallery/group-main-2026.png"],
        "2025": ["assets/gallery/group_photo_2025.jpg"]
      }
    },
    /* click-to-edit overrides for hardcoded landing page copy (hero, about,
       schedule, etc), keyed by the data-edit-id on the element in
       index.html. empty means "show the page's own default text". set from
       the click-to-edit ui in preview.html, see js/main.js's editMode(). */
    text: {},
    /* resize-handle drags in the visual editor, keyed by data-edit-id (text
       boxes) or data-resize-id (images/icons), {id: {w, h}} in css px */
    sizes: {},
    /* A-/A+ font-size bumps in the visual editor, keyed by data-edit-id */
    font_sizes: {},
    /* text toolbar's font/align/letter-spacing, keyed by data-edit-id,
       {id: {fontFamily, align, letterSpacing}} */
    text_styles: {},
    /* text toolbar's padding row, keyed by data-edit-id/data-resize-id, a css
       padding shorthand string */
    padding: {},
    /* move-handle drags in the visual editor, keyed the same way as sizes,
       {id: {tx, ty}} translate offsets in css px */
    positions: {},
    /* elements deleted in the visual editor (js/main.js's deleteElement()),
       a flat list of data-edit-id/data-resize-id values to hide */
    hidden: [],
    /* elements added via the visual editor's right-click "Add element" menu,
       not present in the template at all, see renderCustomElements() in
       js/main.js */
    custom_elements: [],
    /* visual editor stacking order, ordered ids bottom to top, see
       applyLayerOrder()/moveLayer() in js/main.js */
    layers: [],
    /* ids "promoted to navbar" via the visual editor's right-click menu,
       always stacked above every non-fixed element, see toggleFixed() in
       js/main.js. defaults to the nav bar and everything inside it. */
    fixed_elements: NAV_FIXED_IDS.slice(),
    /* visual editor style popover's color picker, keyed by data-edit-id/
       data-resize-id, a css color string, see setElementColor() in
       js/main.js */
    colors: {},
    /* visual editor style popover's opacity slider, keyed by data-edit-id/
       data-resize-id, a number 0-1 */
    opacity: {},
    /* ids locked against being moved via the visual editor's right-click
       menu, see toggleLocked() in js/main.js. flat list, same shape as
       fixed_elements */
    locked: [],
    /* elements duplicated via the visual editor's right-click "Duplicate"
       option, {sourceId, suffix} pairs, see renderDuplicates() in
       js/main.js */
    duplicates: [],
    /* visual editor style popover's Fill control, keyed by data-edit-id,
       a textbox's own background surface, separate from colors (its font
       color), see applyFillOverrides() in js/main.js */
    fill: {},
    /* visual editor style popover's Radius slider, keyed by data-edit-id/
       data-resize-id, a whole-number px value */
    radius: {},
    /* visual editor style popover's Border row, keyed by data-edit-id/
       data-resize-id, {w, color} */
    border: {},
    /* ids with the shared drop-shadow (style popover's Shadow checkbox)
       turned on, flat list, same shape as fixed_elements/locked */
    shadow: [],
    /* the three per-video playback switches on a placed video's right-click
       menu, flat lists of ids in the same shape as shadow above - a placed
       video autoplays muted on a loop with no player chrome, so each list
       only names the clips that deviate. See VIDEO_PLAYBACK_KEYS in
       js/main.js; the gallery's panes have their own equivalent setting in
       the Gallery section (STATE.gallery.video). */
    video_no_autoplay: [],
    video_controls: [],
    video_pausable: [],
    /* right-click "Add link"/"Edit link" targets, keyed by data-edit-id/
       data-resize-id, a url string, see applyOneLink() in js/main.js */
    links: {},
    /* dark-mode overrides for colors/text_color/fill/border above, same
       keys, each optional - an unset id still gets an auto-computed dark
       variant rather than keeping its literal light-mode color, see
       resolveThemedColor() in js/main.js */
    dark_colors: {},
    dark_text_color: {},
    dark_fill: {},
    dark_border: {},
    /* "progress" custom element's two colors (fill, track), same paired
       light/dark shape as colors/dark_colors above, see js/main.js's
       resolveThemedColor()/applyProgressBindings() */
    progress_fill: {},
    dark_progress_fill: {},
    progress_track: {},
    dark_progress_track: {},
    /* per-element hover tooltips, keyed by data-edit-id/data-resize-id, one
       whole descriptor each (the words plus where the bubble sits and how it
       looks) rather than a map per property - added and edited from the visual
       editor's right-click menu, see the ELEMENT TOOLTIPS section in
       js/main.js. This is what replaced the old apply_tooltip field that used
       to live in the Landing page section of this page. */
    tooltips: {}
  };
}

/* windows-1252's 0x80-0x9f block, the only range where it disagrees with
   latin-1 (euro sign, smart quotes, en/em dash, etc). used by
   repairMojibake() to reverse text that got typed as utf-8 then saved
   somewhere that read those bytes back as cp1252. */
var CP1252_C1 = [
  0x20AC, 0x81, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021,
  0x02C6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8D, 0x017D, 0x8F,
  0x90, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x9D, 0x017E, 0x0178
];

/**
 * Reverses one level of "typed/pasted as utf-8, misread as windows-1252"
 * mojibake (eg. an en dash that shows up as "Ã¢â‚¬â€œ"), without touching
 * genuinely accented text: only fires if every character in the string
 * maps to a single cp1252 byte AND those bytes form valid utf-8, which
 * plain latin-1 text almost never does by chance. A snapshot that got
 * corrupted before ever reaching the server (eg. a stale unsaved draft
 * restored by tryRestoreFromPreview()) fixes itself here instead of
 * resurfacing forever.
 * @param str the string to check/repair
 * @return the repaired string, or the original untouched if it wasn't mojibake
 */
function repairMojibake(str) {
  if (typeof str !== "string" || !str.length) return str;
  /* a snapshot can get corrupted more than once (typed, saved corrupted,
     loaded and resaved corrupted again), so keep unwrapping a level at a
     time until nothing changes, capped so a weird string can't loop forever */
  for (var pass = 0; pass < 4; pass++) {
    var next = repairMojibakeOnce(str);
    if (next === str) break;
    str = next;
  }
  return str;
}

/**
 * Reverses a single level of the mojibake described in repairMojibake().
 * @param str the string to check/repair
 * @return the repaired string, or the original untouched if it isn't mojibake
 */
function repairMojibakeOnce(str) {
  var hasHighChar = false;
  for (var j = 0; j < str.length; j++) {
    if (str.charCodeAt(j) > 0x7f) { hasHighChar = true; break; }
  }
  if (!hasHighChar) return str;
  var bytes = [];
  for (var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if (code <= 0x7f || (code >= 0xa0 && code <= 0xff)) {
      bytes.push(code);
    } else {
      var b = CP1252_C1.indexOf(code);
      if (b === -1) return str; /* not representable as a single cp1252 byte, wasn't mojibake */
      bytes.push(0x80 + b);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
  } catch (e) {
    return str; /* not valid utf-8 once reinterpreted, so it wasn't mojibake */
  }
}

/**
 * Walks a content blob and runs repairMojibake() on every string in it, so
 * corrupted text anywhere in a loaded/restored blob (day panels, extras,
 * logistics labels, etc) fixes itself.
 * @param val any content value (object, array, string, or other)
 * @return the same shape with any mojibake strings repaired
 */
function repairMojibakeDeep(val) {
  if (typeof val === "string") return repairMojibake(val);
  if (Array.isArray(val)) return val.map(repairMojibakeDeep);
  if (val && typeof val === "object") {
    var out = {};
    for (var k in val) out[k] = repairMojibakeDeep(val[k]);
    return out;
  }
  return val;
}

/**
 * Fills in fields that may be missing from content saved before these were
 * added (or before the workshop-dates tile got folded into the generic
 * logistics list), so older saved blobs don't blow up the ta portal.
 */
function normalizeState() {
  STATE = repairMojibakeDeep(STATE);
  var oldDatesLbl = (STATE.date_mode === "confirmed" && STATE.start_date && STATE.end_date) ?
    formatDateRange(STATE.start_date, STATE.end_date) : "Tentative start date";
  var oldWeeksBig = STATE.weeks_label || "2 weeks";
  var hadDateFields = STATE.weeks_label !== undefined || STATE.date_mode !== undefined;

  if (!Array.isArray(STATE.logistics) || !STATE.logistics.length) {
    STATE.logistics = seed().logistics;
    STATE.logistics[0].big = oldWeeksBig;
    STATE.logistics[0].lbl = oldDatesLbl;
  } else if (hadDateFields) {
    STATE.logistics.unshift({ big: oldWeeksBig, lbl: oldDatesLbl, icon: false });
  }

  delete STATE.weeks_label;
  delete STATE.date_mode;
  delete STATE.start_date;
  delete STATE.end_date;
  /* nothing here should ever be handed a blob with no day panels/extras
     array at all, but if one turns up (an old save, a hand-edited profile),
     the manager's renderers and its "New panel" button both walk these
     unguarded, so an undefined here takes the whole section down rather
     than showing an empty one */
  if (!Array.isArray(STATE.days)) STATE.days = seed().days;
  if (!Array.isArray(STATE.extras)) STATE.extras = [];
  if (STATE.join_url === undefined) STATE.join_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  /* a blob saved before variables existed gets the full seeded pair; one
     that already has some (even just custom ones a ta added) still needs
     either builtin backfilled in if somehow missing, same "never let an
     old save crash on a since-added field" stance as everything above */
  if (!Array.isArray(STATE.variables)) {
    STATE.variables = seed().variables;
  } else {
    seed().variables.forEach(function (sv) {
      if (!STATE.variables.some(function (v) { return v.key === sv.key; })) STATE.variables.push(sv);
    });
  }
  if (STATE.hero_video_url === undefined) STATE.hero_video_url = "assets/cover-video.mp4";
  if (!STATE.home_images || typeof STATE.home_images !== "object") STATE.home_images = {};
  STATE.home_images = Object.assign({}, HOME_IMAGE_DEFAULTS, STATE.home_images);
  if (!STATE.gallery || !Array.isArray(STATE.gallery.years)) STATE.gallery = seed().gallery;
  /* a blob saved before the video switches existed has a gallery but no
     "video" key in it, so the fallback above never fires for it - same
     "never let an old save crash on a since-added field" top-up every other
     key here gets, and the defaults are how the gallery has always behaved */
  var galleryVideo = STATE.gallery.video || {};
  STATE.gallery.video = {
    autoplay: galleryVideo.autoplay !== false,
    controls: !!galleryVideo.controls,
    pausable: !!galleryVideo.pausable
  };

  if (!STATE.text || typeof STATE.text !== "object") STATE.text = {};
  if (!STATE.sizes || typeof STATE.sizes !== "object") STATE.sizes = {};
  if (!STATE.font_sizes || typeof STATE.font_sizes !== "object") STATE.font_sizes = {};
  if (!STATE.text_styles || typeof STATE.text_styles !== "object") STATE.text_styles = {};
  if (!STATE.padding || typeof STATE.padding !== "object") STATE.padding = {};
  if (!STATE.positions || typeof STATE.positions !== "object") STATE.positions = {};
  if (!Array.isArray(STATE.hidden)) STATE.hidden = [];
  if (!Array.isArray(STATE.custom_elements)) STATE.custom_elements = [];
  if (!Array.isArray(STATE.layers)) STATE.layers = [];
  if (!Array.isArray(STATE.fixed_elements)) STATE.fixed_elements = NAV_FIXED_IDS.slice();
  /* the same one-time top-up _migrate_landing_nav_states() does server side,
     for a draft that never went through it: an unsaved snapshot left in
     localStorage from before the landing page's signed-in navbar existed has a
     fixed_elements list, so the fallback above doesn't fire, and its navbar
     would come up missing the red "fixed" hitboxes the signed-out one has.
     Marker-gated exactly like the server's meta flag, so a ta who deliberately
     un-promotes one of these ids doesn't get it forced back on the next load. */
  if (!STATE.migrations || typeof STATE.migrations !== "object") STATE.migrations = {};
  if (!STATE.migrations.landing_nav_states) {
    STATE.migrations.landing_nav_states = true;
    NAV_FIXED_IDS.forEach(function (id) {
      if (id.indexOf("navin.") === 0 && STATE.fixed_elements.indexOf(id) === -1) {
        STATE.fixed_elements.push(id);
      }
    });
  }
  if (!STATE.colors || typeof STATE.colors !== "object") STATE.colors = {};
  if (!STATE.opacity || typeof STATE.opacity !== "object") STATE.opacity = {};
  if (!Array.isArray(STATE.locked)) STATE.locked = [];
  if (!Array.isArray(STATE.duplicates)) STATE.duplicates = [];
  if (!STATE.fill || typeof STATE.fill !== "object") STATE.fill = {};
  if (!STATE.radius || typeof STATE.radius !== "object") STATE.radius = {};
  if (!STATE.border || typeof STATE.border !== "object") STATE.border = {};
  if (!Array.isArray(STATE.shadow)) STATE.shadow = [];
  ["video_no_autoplay", "video_controls", "video_pausable"].forEach(function (k) {
    if (!Array.isArray(STATE[k])) STATE[k] = [];
  });
  if (!STATE.links || typeof STATE.links !== "object") STATE.links = {};
  if (!STATE.dark_colors || typeof STATE.dark_colors !== "object") STATE.dark_colors = {};
  if (!STATE.dark_text_color || typeof STATE.dark_text_color !== "object") STATE.dark_text_color = {};
  if (!STATE.dark_fill || typeof STATE.dark_fill !== "object") STATE.dark_fill = {};
  if (!STATE.dark_border || typeof STATE.dark_border !== "object") STATE.dark_border = {};
  if (!STATE.progress_fill || typeof STATE.progress_fill !== "object") STATE.progress_fill = {};
  if (!STATE.dark_progress_fill || typeof STATE.dark_progress_fill !== "object") STATE.dark_progress_fill = {};
  if (!STATE.progress_track || typeof STATE.progress_track !== "object") STATE.progress_track = {};
  if (!STATE.dark_progress_track || typeof STATE.dark_progress_track !== "object") STATE.dark_progress_track = {};
  if (!STATE.tooltips || typeof STATE.tooltips !== "object") STATE.tooltips = {};
  /* footer contact line used to be its own field, edited from a dedicated
     input in this section; now it's click-to-edit like the rest of the
     landing page copy, so fold any already-saved value in once and stop
     tracking it separately */
  if (STATE.text["footer.contact"] === undefined && STATE.contact_text) {
    STATE.text["footer.contact"] = STATE.contact_text;
  }
  delete STATE.contact_text;
  /* the Apply Now hover tooltip was the same kind of leftover: one string, one
     form field, because a tooltip had no element in the editor to click on.
     Every element can carry its own now (see STATE.tooltips above), so an
     already-saved value folds into one per Apply Now button and the field goes
     away. The server does the same fold for the live site, see
     _migrate_apply_tooltip() in app/db.py - this is for a draft or a profile
     that's already in a ta's hands here. */
  if (STATE.apply_tooltip) {
    APPLY_TOOLTIP_IDS.forEach(function (id) {
      if (!STATE.tooltips[id]) STATE.tooltips[id] = { text: STATE.apply_tooltip, pos: "bottom" };
    });
  }
  delete STATE.apply_tooltip;
}

/* the three Apply Now buttons on the landing page (templates/index.html), by
   data-edit-id: the nav one, the hero's, and the one under the prizes. The
   only place this list is needed is the one-time fold above. */
var APPLY_TOOLTIP_IDS = ["nav.link.apply", "hero.cta.primary", "prizes.cta"];

/* seed() is a PLACEHOLDER, not content: it's what STATE holds for the few
   hundred ms between this file parsing and /api/content (or a restored
   preview snapshot) coming back, and it holds none of this site's actual
   panels/extras/gallery/visual edits. STATE_LOADED says whether that has
   happened yet, and guards the two places a wrong answer is destructive:
   writePreviewSnapshot() (publishing the placeholder as the draft the
   Visual editor's iframe renders and Apply/Save read back out of) and
   showMode() (entering the editor tab before there's anything to edit).
   CONTENT_READY resolves at the same moment, for callers that would rather
   wait than be turned away - see whenContentReady(). */
var STATE = seed();
var STATE_LOADED = false;
var CONTENT_READY = null;

var PROFILES = [];  /* saved drafts from /api/profiles */
var EDITING = null; /* null = editing the live site, else the open profile */

var previewWindow = null; /* the tab opened by openPreview(), if still around */

/* "manager" (the form-based content manager) or "editor" (the embedded
   click-to-edit iframe), see showMode(). Both views edit the same STATE. */
var TA_MODE = "manager";

/**
 * Builds the Authorization header for a ta-only request.
 * @return a {Authorization} headers object
 */
function authHeaders() {
  return { "Authorization": "Bearer " + (localStorage.getItem("token") || "") };
}

/**
 * The server says the session's gone (idle timeout, or the account got
 * removed): clears local state and bounces to login with a message instead
 * of quietly failing every button on the page.
 */
function handleExpiredSession() {
  localStorage.removeItem("session");
  localStorage.removeItem("role");
  localStorage.removeItem("token");
  localStorage.removeItem("last_active");
  window.location.href = "login.html?expired=1";
}

/**
 * Fetch with the auth header attached; on a 401 it handles the redirect
 * itself and rejects, so callers only need to handle other failures.
 * @param url request url
 * @param opts fetch options
 * @return a promise resolving to the response (rejects on 401)
 */
function authedFetch(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({}, opts.headers, authHeaders());
  return fetch(url, opts).then(function (res) {
    if (res.status === 401) { handleExpiredSession(); throw new Error("expired"); }
    return res;
  });
}

/**
 * Shows a status message under the action row.
 * @param text message to show
 * @param ok true for a success style, false for an error style
 */
function showMsg(text, ok) {
  var el = document.getElementById("taMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/**
 * Same thing for the gallery's "Add a directory" row, which has its own
 * message line under the field: the shared one above sits with the
 * Apply/Save buttons at the very top of the page, far enough from this
 * section that a complaint about what was just typed there can go unseen.
 * @param text the message ("" clears it)
 * @param ok true for the good colour, false for the error one
 */
function showGalleryMsg(text, ok) {
  var el = document.getElementById("galleryMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "form-msg " + (ok ? "ok" : "err");
}

/**
 * A stable id for a new extras entry, so js/main.js's attachments-tile area
 * has something durable to bind dropped elements to across reorders/deletes.
 * @return a fresh random id
 */
function newExtraId() {
  return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
    Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Uploads one file.
 * @param file the File object from a file input
 * @return a promise resolving to the {type:"file", name, url, id, children} attachment entry
 */
function uploadFile(file) {
  var fd = new FormData();
  fd.append("file", file);
  return authedFetch("/api/upload", { method: "POST", body: fd })
    .then(function (res) {
      if (!res.ok) throw new Error("upload failed");
      return res.json();
    })
    .then(function (data) {
      return { type: "file", name: data.name, url: data.url, id: newExtraId(), children: [] };
    });
}

/**
 * Formats the current moment for a datetime-local input (which wants local
 * time; toISOString gives utc).
 * @return a "yyyy-mm-ddThh:mm" local timestamp
 */
function nowLocal() {
  var n = new Date();
  var p = function (x) { return (x < 10 ? "0" : "") + x; };
  return n.getFullYear() + "-" + p(n.getMonth() + 1) + "-" + p(n.getDate()) +
    "T" + p(n.getHours()) + ":" + p(n.getMinutes());
}

var X_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

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

var IMAGE_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/>' +
  '<path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>';

var DOC_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>' +
  '<path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>';

var SLIDES_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="M7 21l5-5 5 5"/></svg>';

var VID_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-3v10l-6-3"/></svg>';

var IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif", "tiff", "heic"];
var DOC_EXTS = ["pdf", "doc", "docx", "txt", "rtf", "odt", "pages"];
var SLIDES_EXTS = ["ppt", "pptx", "key", "odp"];

/* three-node share glyph, next to "shared" on a profile row */
var SHARE_SVG_CHIP =
  '<svg class="tf-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/>' +
  '<path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/></svg>';

/* attachments are a plain filename string (legacy), a {type:"link", value}
   object, or a {type:"file", name, url} object for an uploaded file */

/**
 * Checks whether an attachment is a link entry.
 * @param item an attachment (string or {type, ...} object)
 * @return true if it's a {type:"link", value} entry
 */
function isLink(item) { return item && typeof item === "object" && item.type === "link"; }

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

/**
 * Picks an icon off the file extension in the attachment's name, same rule
 * as js/dashboard.js. Falls back to a generic file glyph.
 * @param item an attachment (string or {type, ...} object)
 * @return an inline svg icon string
 */
function itemIcon(item) {
  if (isLink(item)) return LINK_SVG_CHIP;
  var name = itemLabel(item) || "";
  var m = /\.([a-z0-9]+)$/i.exec(name);
  var ext = m ? m[1].toLowerCase() : "";
  if (IMAGE_EXTS.indexOf(ext) !== -1) return IMAGE_SVG_CHIP;
  if (DOC_EXTS.indexOf(ext) !== -1) return DOC_SVG_CHIP;
  if (SLIDES_EXTS.indexOf(ext) !== -1) return SLIDES_SVG_CHIP;
  return FILE_SVG_CHIP;
}

/**
 * Formats a date range as "Mon D to Mon D, YYYY".
 * @param start iso date string (yyyy-mm-dd)
 * @param end iso date string (yyyy-mm-dd)
 * @return the formatted range, or a placeholder if either date is missing
 */
function formatDateRange(start, end) {
  if (!start || !end) return "No dates set yet";
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var s = new Date(start + "T00:00:00");
  var e = new Date(end + "T00:00:00");
  return months[s.getMonth()] + " " + s.getDate() + " to " +
    months[e.getMonth()] + " " + e.getDate() + ", " + e.getFullYear();
}

/**
 * Only ta keys get in here.
 * @return true if a ta is logged in
 */
function gateCheck() {
  var ok = localStorage.getItem("session") && localStorage.getItem("role") === "ta";
  var app = document.getElementById("taApp");
  var gate = document.getElementById("taGate");
  if (app) app.style.display = ok ? "block" : "none";
  if (gate) gate.style.display = ok ? "none" : "block";
  return ok;
}

/**
 * Picks a key for a freshly-added variable that doesn't collide with any
 * existing one: the base word, or base_2/base_3/... the first time it
 * would. A key is the stable, typeable identifier a formula/binding refers
 * to (see the Variables section's "easy to name" ask) - unlike "name" (the
 * freely-renameable display label a ta edits directly), it's never
 * hand-typed, just picked once here and left alone.
 * @param base a starting key (plain lowercase word, no spaces)
 * @return a key not already used by any STATE.variables entry
 */
function uniqueVariableKey(base) {
  var existing = STATE.variables.map(function (v) { return v.key; });
  if (existing.indexOf(base) === -1) return base;
  var n = 2;
  while (existing.indexOf(base + "_" + n) !== -1) n++;
  return base + "_" + n;
}

/* how a variable's "page" scope reads in its card below - the same page keys
   js/main.js's currentPageKey() hands out. */
var VARIABLE_PAGE_LABELS = {
  index: "landing page",
  dashboard: "student dashboard",
  gallery: "gallery page",
  login: "login page"
};

/**
 * Renders every named variable into #variablesList and wires up its
 * controls - name/description/type/value all write straight back into the
 * matching STATE.variables[i] entry, same "the input already IS the state"
 * pattern renderPanels() uses for day panels just below. A builtin's type
 * can't be changed (it's load-bearing for whatever's already bound to it,
 * eg the progress bar's Current/Total selects, see js/main.js) and only a
 * non-builtin can be removed at all. A computed one has no editable value
 * at all - shows its live, server-calculated number instead of an input,
 * see _refresh_computed_variables() in app/db.py.
 */
function renderVariables() {
  var list = document.getElementById("variablesList");
  if (!list) return;
  var html = "";

  STATE.variables.forEach(function (v, i) {
    var typeOptions = ["string", "number", "boolean", "datetime"].map(function (t) {
      return '<option value="' + t + '"' + (v.type === t ? " selected" : "") + '>' +
        t.charAt(0).toUpperCase() + t.slice(1) + '</option>';
    }).join("");

    var valueField;
    if (v.computed && v.key === "days_progressed") {
      /* the one computed variable that's also ta-editable: typing a number
         here is a shortcut for opening/closing days 1..N in bulk (see the
         .v-days-progressed handler below) rather than a second, disconnected
         value - v.value itself stays fully server-recomputed from
         STATE.days on every save/load (_refresh_computed_variables() in
         app/db.py), same as it always has. */
      valueField = '<div class="field"><label>Value</label>' +
        '<input type="number" min="0" max="' + STATE.days.length + '" class="v-days-progressed" ' +
        'value="' + (v.value === null || v.value === undefined ? 0 : v.value) + '">' +
        '<p class="muted" style="margin:6px 0 0">Opens/closes days 1..N to match, same as each day\'s own Open/Close button.</p></div>';
    } else if (v.computed) {
      valueField = '<div class="field"><label>Value</label>' +
        '<p class="muted" style="margin:6px 0 0">' +
        (v.value === null || v.value === undefined ? "0" : v.value) +
        ' &middot; calculated automatically</p></div>';
    } else if (v.type === "boolean") {
      valueField = '<div class="field"><label class="ta-radio">' +
        '<input type="checkbox" class="v-value-bool"' + (v.value ? " checked" : "") + '> On</label></div>';
    } else if (v.type === "datetime") {
      valueField = '<div class="field"><label>Value</label>' +
        '<input type="datetime-local" class="v-value-input" value="' + (v.value || "") + '"></div>';
    } else if (v.type === "number") {
      valueField = '<div class="field"><label>Value</label>' +
        '<input type="number" class="v-value-input" value="' + (v.value === undefined || v.value === null ? 0 : v.value) + '"></div>';
    } else {
      valueField = '<div class="field"><label>Value</label>' +
        '<input type="text" class="v-value-input" value="' + (v.value || "") + '"></div>';
    }

    html +=
      '<div class="ta-card ta-card-hl" data-i="' + i + '" style="margin-bottom:14px">' +
        '<div class="ta-row">' +
          '<div class="field"><label>Name</label>' +
            '<input type="text" class="v-name" value="' + v.name + '"></div>' +
          '<div class="field"><label>Type</label>' +
            '<select class="v-type"' + (v.builtin ? " disabled" : "") + '>' + typeOptions + '</select></div>' +
        '</div>' +
        '<div class="field"><label>Description</label>' +
          '<textarea class="v-desc" rows="2">' + (v.description || "") + '</textarea></div>' +
        /* a scoped variable (only the two builtins are, see the seed above)
           says so, since otherwise the only way to find out is to go looking
           for it on another page's visual editor and not find it */
        (v.page ? '<p class="muted" style="margin:-4px 0 14px">Only offered on the ' +
          (VARIABLE_PAGE_LABELS[v.page] || v.page) + ' in the visual editor.</p>' : "") +
        valueField +
        (v.builtin ? "" : '<button class="btn btn-ghost v-del" type="button" style="margin-top:10px">Remove variable</button>') +
      '</div>';
  });

  list.innerHTML = html;

  list.querySelectorAll(".ta-card").forEach(function (card) {
    var v = STATE.variables[+card.getAttribute("data-i")];

    card.querySelector(".v-name").addEventListener("input", function () { v.name = this.value; });
    card.querySelector(".v-desc").addEventListener("input", function () { v.description = this.value; });

    if (!v.builtin) {
      card.querySelector(".v-type").addEventListener("change", function () {
        v.type = this.value;
        v.value = v.type === "boolean" ? false : "";
        renderVariables();
      });
    }

    var boolInput = card.querySelector(".v-value-bool");
    if (boolInput) boolInput.addEventListener("change", function () { v.value = this.checked; });
    var valueInput = card.querySelector(".v-value-input");
    if (valueInput) {
      valueInput.addEventListener("input", function () {
        v.value = v.type === "number" ? (+this.value || 0) : this.value;
      });
    }
    var daysProgressedInput = card.querySelector(".v-days-progressed");
    if (daysProgressedInput) {
      daysProgressedInput.addEventListener("change", function () {
        var n = Math.max(0, Math.min(STATE.days.length, +this.value || 0));
        STATE.days.forEach(function (d) { d.unlocked = d.day <= n; });
        renderPanels();
        renderVariables();
      });
    }

    var delBtn = card.querySelector(".v-del");
    if (delBtn) {
      delBtn.addEventListener("click", function () {
        if (!confirm('Remove the "' + v.name + '" variable?')) return;
        STATE.variables.splice(STATE.variables.indexOf(v), 1);
        renderVariables();
      });
    }
  });
}

/* NOTE: links used to be listed and edited here too (a "Links" section under
   Day panels). They aren't anymore: a link only means anything next to the
   element it's on, so the whole inventory lives in the Visual editor's own
   right-click menu instead ("This page > Links on this page", see
   renderCtxMenuLinkList() in js/main.js) - which can also show the links
   this page never knew about, the ones baked into the templates (the nav's
   own scroll links, the brand, "Log out"), not just the ones a ta added.
   STATE.links is still the same content.links map, just edited from there. */

/**
 * Builds the little "variable · string" tag shown next to a day panel field
 * whose value isn't just text on a card anymore: on the student dashboard
 * that field renders through a per-tile variable inside an ordinary,
 * restyleable text box (see buildDayOpenTileHtml() in js/dashboard.js), and
 * THIS field is the only place its value can be changed - a ta editing the
 * dashboard in the visual editor sees ${Day3Header} inline and can move,
 * resize and restyle the box around it, but never overwrite the words. The
 * tag says which name that is, so the two views are obviously the same thing.
 * @param name the variable's name, without the ${} wrapper
 * @return an HTML string for one tag
 */
function varFlag(name) {
  return '<span class="ta-varflag" title="Shown on the student dashboard as the ' +
    '${' + name + '} variable. Edit its value here; its box is styled in the visual editor.">' +
    'variable &middot; string <code>${' + name + '}</code></span>';
}

/** Renders every day panel editor into #panelList and wires up its controls. */
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
          '<span class="badge ' + (d.unlocked ? 'open">' + UNLOCK_SVG + 'Open' : 'locked">' + LOCK_SVG + 'Locked') + '</span>' +
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
        '<div class="field"><label>Title' + varFlag("Day" + d.day + "Header") + '</label>' +
          '<input type="text" class="p-title" value="' + d.title + '"></div>' +
        '<div class="field"><label>Description' + varFlag("Day" + d.day + "Body") + '</label>' +
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

    p.querySelector(".p-day").addEventListener("input", function () {
      d.day = +this.value || 1;
      /* the two variable names are built off the day number (see varFlag()),
         so retype the day and the tags have to follow immediately - a full
         renderPanels() here would steal focus out of the field mid-typing */
      var names = ["Day" + d.day + "Header", "Day" + d.day + "Body"];
      p.querySelectorAll(".ta-varflag code").forEach(function (code, i) {
        code.textContent = "${" + names[i] + "}";
      });
    });
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
        .catch(function (err) {
          if (err.message === "expired") return;
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

/** Renders the editable "Extra attachments" list into #extraList. */
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

/**
 * Checks whether a gallery url is a video clip.
 * @param u the media url
 * @return true if it's a .MOV clip
 */
function isVidUrl(u) { return /\.mov$/i.test(u); }

/**
 * Escapes a value being dropped into a double-quoted attribute in one of this
 * file's innerHTML strings. Needed since directory names became free text (see
 * renderGallery()): "2026" could never break out of an attribute, but a name a
 * ta types themselves can.
 * @param str any value, coerced to string
 * @return str with &<>" replaced by entities
 */
function escapeAttr(str) {
  return String(str).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

var PREV_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

var NEXT_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

var UP_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 15l7-7 7 7"/></svg>';

var DOWN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 9l-7 7-7-7"/></svg>';

/* drag handle, six dots */
var GRIP_SVG =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/>' +
  '<circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';

/* which image each year's mini viewer is sitting on, survives rerenders */
var GY_IDX = {};

/* which years are currently showing the reorder list instead of the
   single-image viewer, survives rerenders */
var GY_REORDER = {};

/**
 * Renames one gallery directory everywhere it's referenced at once: the
 * directory list itself, its image list, and - crucially - every visual-editor
 * thing that names it by string. An image pane a ta bound to "2026"
 * (custom_elements[].dir) and a back/forward button pointed at that pane's
 * action (links, "gallery:next:2026") both have to follow the rename, or a
 * directory a ta simply retitled would silently leave a blank stage and two
 * dead arrows behind it.
 *
 * Editor state is only remapped in STATE, not in the editor iframe: renaming
 * happens in the content manager, and the iframe reloads off STATE the next
 * time it's opened. That's the same one-way flow every other Content tab edit
 * already has.
 * @param from the current directory name
 * @param to the new name
 */
function renameGalleryDir(from, to) {
  var i = STATE.gallery.years.indexOf(from);
  if (i === -1) return;
  STATE.gallery.years[i] = to;
  STATE.gallery.images[to] = STATE.gallery.images[from] || [];
  delete STATE.gallery.images[from];
  GY_IDX[to] = GY_IDX[from] || 0;
  delete GY_IDX[from];
  if (GY_REORDER[from]) GY_REORDER[to] = true;
  delete GY_REORDER[from];

  (STATE.custom_elements || []).forEach(function (c) {
    if (c.kind === "galleryPane" && c.dir === from) c.dir = to;
  });
  Object.keys(STATE.links || {}).forEach(function (id) {
    var v = STATE.links[id];
    if (typeof v !== "string") return;
    if (v === "gallery:prev:" + from) STATE.links[id] = "gallery:prev:" + to;
    else if (v === "gallery:next:" + from) STATE.links[id] = "gallery:next:" + to;
  });
}

/* the Gallery section's "Video clips" card: each checkbox paired with the
   content.gallery.video flag it drives (see paintPanes() in js/gallery.js) */
var GALLERY_VIDEO_INPUTS = [
  ["galleryVideoAutoplay", "autoplay"],
  ["galleryVideoControls", "controls"],
  ["galleryVideoPausable", "pausable"]
];

/**
 * Pushes STATE into the Gallery section's "Video clips" checkboxes - split
 * from renderGallery() below because these three are static markup in
 * instructor.html rather than part of the directory list it rebuilds.
 */
function syncGalleryVideo() {
  GALLERY_VIDEO_INPUTS.forEach(function (pair) {
    var box = document.getElementById(pair[0]);
    if (box) box.checked = !!STATE.gallery.video[pair[1]];
  });
}

/**
 * Renders the editable per-directory photo/clip lists shown on gallery.html.
 * One image at a time per directory, same flip-through idea as the public
 * gallery page. A directory with 2+ images gets a "Reorder" toggle that swaps
 * the viewer for a flat list of filenames, no <img>/<video> elements, so
 * dragging things around never has to render every photo at once (some of
 * these are 8-20mb phone shots, a thumbnail grid of all of them would lag).
 *
 * A directory is just a NAME with images under it - "2026" and "Field trip"
 * are equally valid - so its name is an ordinary editable input here rather
 * than a fixed label, the same "the input already IS the state" pattern the
 * rest of this page uses. content.gallery.years keeps its key for storage
 * compatibility; it's a list of directory names, not of years.
 */
function renderGallery() {
  var list = document.getElementById("galleryList");
  if (!list) return;
  var html = "";

  STATE.gallery.years.forEach(function (y) {
    var imgs = STATE.gallery.images[y] || [];
    var i = GY_IDX[y] || 0;
    if (i >= imgs.length) i = imgs.length ? imgs.length - 1 : 0;
    GY_IDX[y] = i;
    var reordering = GY_REORDER[y] && imgs.length > 1;

    var viewer = "";
    if (!imgs.length) {
      viewer = '<p class="muted">No images yet.</p>';
    } else if (reordering) {
      viewer = '<ul class="gy-reorder-list">' +
        imgs.map(function (u, idx) {
          var name = u.split("/").pop();
          return '<li class="gy-reorder-row" draggable="true" data-idx="' + idx + '">' +
            '<span class="gy-ro-handle">' + GRIP_SVG + '</span>' +
            '<span class="gy-ro-num">' + (idx + 1) + '</span>' +
            (isVidUrl(u) ? VID_SVG_CHIP : IMAGE_SVG_CHIP) +
            '<span class="gy-ro-name">' + name + '</span>' +
            '<span class="gy-ro-move">' +
              '<button class="gy-ro-up" type="button" aria-label="Move up"' + (idx === 0 ? " disabled" : "") + '>' + UP_SVG + '</button>' +
              '<button class="gy-ro-down" type="button" aria-label="Move down"' + (idx === imgs.length - 1 ? " disabled" : "") + '>' + DOWN_SVG + '</button>' +
            '</span>' +
          '</li>';
        }).join("") +
      '</ul>';
    } else {
      var cur = imgs[i];
      var media = isVidUrl(cur) ?
        '<video class="gy-media" src="' + cur + '" autoplay muted loop playsinline></video>' :
        '<img class="gy-media" src="' + cur + '" alt="">';
      viewer =
        '<div class="gy-stage">' +
          '<button class="gy-arrow gy-prev" type="button" aria-label="Previous image">' + PREV_SVG + '</button>' +
          media +
          '<button class="gy-arrow gy-next" type="button" aria-label="Next image">' + NEXT_SVG + '</button>' +
        '</div>' +
        '<div class="gy-bar">' +
          '<span class="gy-count">' + (i + 1) + ' / ' + imgs.length + '</span>' +
          '<span class="gy-kind">' + (isVidUrl(cur) ? VID_SVG_CHIP + 'Video clip' : IMAGE_SVG_CHIP + 'Photo') + '</span>' +
          '<button class="btn btn-ghost gy-rm" type="button">Remove</button>' +
        '</div>';
    }

    html +=
      '<div class="ta-panel" data-year="' + escapeAttr(y) + '">' +
        '<div class="ta-panel-head">' +
          '<input class="gy-name pw-edit-input" type="text" value="' + escapeAttr(y) +
            '" aria-label="Directory name">' +
          (imgs.length > 1 ? '<button class="btn btn-ghost gy-reorder-btn" type="button">' +
            (reordering ? "Done reordering" : "Reorder") + '</button>' : "") +
          '<button class="btn btn-ghost gy-del" type="button">Remove directory</button>' +
        '</div>' +
        viewer +
        '<label class="btn btn-ghost ta-upload">' +
          '<svg class="iic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>' +
          ' Add image<input type="file" class="gy-file" accept="image/*,video/*" multiple hidden></label> ' +
        '<button class="btn btn-ghost gy-link-btn" type="button">' + LINK_SVG_BTN + ' Add by URL</button>' +
        '<div class="ta-link-row gy-link-row" style="display:none">' +
          '<input type="url" class="gy-link-input" placeholder="https://... or assets/gallery/...">' +
          '<button class="btn btn-primary gy-link-add" type="button">Add</button>' +
        '</div>' +
      '</div>';
  });

  list.innerHTML = html || '<p class="muted">No directories yet.</p>';

  list.querySelectorAll(".ta-panel").forEach(function (p) {
    var y = p.getAttribute("data-year");
    var imgs = STATE.gallery.images[y] || [];

    p.querySelector(".gy-name").addEventListener("change", function () {
      var next = this.value.trim();
      /* an empty or already-taken name is refused rather than applied and
         reported: the input is the state here, so accepting it would leave
         two directories that can't be told apart in every picker on the site */
      if (!next || next === y) { this.value = y; return; }
      if (STATE.gallery.years.indexOf(next) !== -1) {
        showMsg("There's already a directory called \"" + next + "\".", false);
        this.value = y;
        return;
      }
      renameGalleryDir(y, next);
      renderGallery();
    });

    p.querySelector(".gy-del").addEventListener("click", function () {
      if (!confirm('Remove the "' + y + '" directory and all its images from the gallery?')) return;
      STATE.gallery.years.splice(STATE.gallery.years.indexOf(y), 1);
      delete STATE.gallery.images[y];
      delete GY_IDX[y];
      delete GY_REORDER[y];
      renderGallery();
    });

    var prevBtn = p.querySelector(".gy-prev");
    if (prevBtn) prevBtn.addEventListener("click", function () {
      GY_IDX[y] = (GY_IDX[y] - 1 + imgs.length) % imgs.length; /* wraps */
      renderGallery();
    });
    var nextBtn = p.querySelector(".gy-next");
    if (nextBtn) nextBtn.addEventListener("click", function () {
      GY_IDX[y] = (GY_IDX[y] + 1) % imgs.length;
      renderGallery();
    });

    var rmBtn = p.querySelector(".gy-rm");
    if (rmBtn) rmBtn.addEventListener("click", function () {
      imgs.splice(GY_IDX[y], 1);
      renderGallery();
    });

    var reorderBtn = p.querySelector(".gy-reorder-btn");
    if (reorderBtn) reorderBtn.addEventListener("click", function () {
      GY_REORDER[y] = !GY_REORDER[y];
      renderGallery();
    });

    p.querySelectorAll(".gy-reorder-row").forEach(function (row) {
      var idx = parseInt(row.getAttribute("data-idx"), 10);

      row.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", String(idx));
        e.dataTransfer.effectAllowed = "move";
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", function () {
        row.classList.remove("dragging");
      });
      row.addEventListener("dragover", function (e) {
        e.preventDefault();
        row.classList.add("drag-over");
      });
      row.addEventListener("dragleave", function () {
        row.classList.remove("drag-over");
      });
      row.addEventListener("drop", function (e) {
        e.preventDefault();
        row.classList.remove("drag-over");
        var from = parseInt(e.dataTransfer.getData("text/plain"), 10);
        if (isNaN(from) || from === idx) return;
        var moved = imgs.splice(from, 1)[0];
        imgs.splice(idx, 0, moved);
        renderGallery();
      });

      var upBtn = row.querySelector(".gy-ro-up");
      upBtn.addEventListener("click", function () {
        if (idx === 0) return;
        var tmp = imgs[idx - 1]; imgs[idx - 1] = imgs[idx]; imgs[idx] = tmp;
        renderGallery();
      });
      var downBtn = row.querySelector(".gy-ro-down");
      downBtn.addEventListener("click", function () {
        if (idx === imgs.length - 1) return;
        var tmp = imgs[idx + 1]; imgs[idx + 1] = imgs[idx]; imgs[idx] = tmp;
        renderGallery();
      });
    });

    p.querySelector(".gy-file").addEventListener("change", function () {
      var files = Array.prototype.slice.call(this.files);
      if (!files.length) return;
      showMsg("Uploading...", true);
      Promise.all(files.map(uploadFile))
        .then(function (items) {
          items.forEach(function (it) { STATE.gallery.images[y].push(it.url); });
          GY_IDX[y] = STATE.gallery.images[y].length - 1; /* show what was just added */
          showMsg("Uploaded. Don't forget to save your changes.", true);
          renderGallery();
        })
        .catch(function (err) {
          if (err.message === "expired") return;
          showMsg("Couldn't upload one of the files. Try again.", false);
        });
    });

    var linkRow = p.querySelector(".gy-link-row");
    var linkInput = p.querySelector(".gy-link-input");
    p.querySelector(".gy-link-btn").addEventListener("click", function () {
      linkRow.style.display = "flex";
      linkInput.focus();
    });
    function addGalleryLink() {
      var v = linkInput.value.trim();
      if (!v) return;
      STATE.gallery.images[y].push(v);
      GY_IDX[y] = STATE.gallery.images[y].length - 1;
      linkInput.value = "";
      renderGallery();
    }
    p.querySelector(".gy-link-add").addEventListener("click", addGalleryLink);
    linkInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addGalleryLink(); }
    });
  });
}

/* There is no Landing page section on this page any more. It was down to one
   control - the Apply Now hover tooltip - which was only here because a
   tooltip had no element in the visual editor to right-click: it doesn't
   exist until someone hovers. Tooltips are per-element there now (see the
   ELEMENT TOOLTIPS section in js/main.js), so those three buttons are edited
   where the rest of that page is, and the section is gone rather than left
   standing empty. */

/** Re-renders every editor section from STATE. */
function renderAll() {
  renderVariables();
  renderPanels();
  renderExtras();
  renderGallery();
  syncGalleryVideo();
}

/**
 * Snapshots the in-editor STATE (and which profile, if any, is being
 * edited) into localStorage and opens preview.html (or, if a preview tab
 * from an earlier click is still open, refreshes it) so the ta can see
 * unsaved edits rendered in the real landing page and dashboard before
 * applying them. The snapshot also doubles as a "keep my edits" draft:
 * see tryRestoreFromPreview(). Pulls in whatever the Visual editor tab's
 * iframe last wrote first, if that's the tab currently open, so clicking
 * Preview from there can't clobber an in-progress click-to-edit with the
 * parent's now-stale copy of STATE.
 */
function openPreview() {
  if (TA_MODE === "editor") pullStateFromEditor();
  writePreviewSnapshot();
  if (previewWindow && !previewWindow.closed) {
    previewWindow.location.reload();
    previewWindow.focus();
  } else {
    previewWindow = window.open("preview.html", "ta_preview");
  }
}

/* which page the Visual editor tab's iframe is pointed at */
var EDITOR_TAB_PAGES = {
  landing: "index.html?preview=1&edit=1",
  dashboard: "dashboard.html?preview=1&edit=1",
  login: "login.html?preview=1&edit=1",
  gallery: "gallery.html?preview=1&edit=1"
};
var editorSubTab = "landing";

/**
 * Points the Visual editor's iframe at the given sub-tab's page and marks
 * it active.
 * @param name "landing", "dashboard", "login", or "gallery"
 */
function showEditorSubTab(name) {
  if (!EDITOR_TAB_PAGES[name]) name = "landing";
  editorSubTab = name;
  var frame = document.getElementById("edFrame");
  if (frame) frame.src = EDITOR_TAB_PAGES[name];
  document.querySelectorAll("#edSubTabs .pv-tab").forEach(function (btn) {
    btn.classList.toggle("active", btn.getAttribute("data-tab") === name);
  });
  syncNavStateSwitch();
  syncDashViewSwitch();
}

/* ---------------------------------------------------------------------------
   THE LANDING PAGE'S NAVBAR SWITCH

   The landing page ships two navbars - one for a signed-out visitor (Access
   portal) and one for a signed-in one (Dashboard, Log out) - and only one is in
   the document at a time (js/main.js's applyNavState()). A ta editing the page
   needs to be able to look at either, so this switch, next to the page tabs,
   picks which. It's view state, not a setting: what a real visitor gets is
   decided by whether they're actually signed in, and nothing here is saved.

   It lives in the portal chrome rather than inside the iframe because it's the
   sort of thing you flip repeatedly while working - buried in the editor's
   right-click menu it was two clicks and a guess away every time. The state is
   held here, in the parent, so it survives the iframe reloads that Apply/Save
   and a profile switch trigger; the iframe would otherwise come back
   signed-out under a switch still reading "Signed in".
   --------------------------------------------------------------------------- */

/* which navbar the editor is showing, "out" (signed out) or "in" */
var editorNavState = "out";

/** @return the Visual editor iframe's window, or null if it isn't reachable yet */
function editorFrameWindow() {
  var frame = document.getElementById("edFrame");
  try { return frame && frame.contentWindow ? frame.contentWindow : null; } catch (e) { return null; }
}

/**
 * Redraws the switch from editorNavState, and shows it only on the landing
 * tab - it's the only page with two navbars.
 */
function syncNavStateSwitch() {
  var row = document.getElementById("edNavStateRow");
  var sw = document.getElementById("edNavState");
  if (!row || !sw) return;
  row.hidden = editorSubTab !== "landing";
  var on = editorNavState === "in";
  sw.setAttribute("aria-checked", on ? "true" : "false");
  document.getElementById("edNavStateText").textContent = on ? "Signed in" : "Signed out";
  sw.title = on
    ? "Editing the signed-in navbar (Dashboard, Log out). Switch off to edit the signed-out one."
    : "Editing the signed-out navbar (Access portal). Switch on to edit the signed-in one.";
}

/** Flips which navbar the editor's iframe is showing (the switch next to the page tabs). */
function toggleEditorNavState() {
  var win = editorFrameWindow();
  /* let the iframe do the flipping - it also has to move the selection ring off
     whatever just left the page and re-pin anchored elements */
  try { if (win && win.toggleNavState) win.toggleNavState(); } catch (e) {}
  editorNavState = editorNavState === "in" ? "out" : "in";
  syncNavStateSwitch();
}

/**
 * Re-asserts the switch onto a freshly (re)loaded editor iframe, which always
 * starts on the signed-out navbar. Runs on the frame's load event, before the
 * content fetch inside it resolves, so the override pipeline in there applies
 * saved geometry with the state already correct.
 */
function pushNavStateToFrame() {
  if (editorNavState !== "in") return;
  var win = editorFrameWindow();
  try { if (win && win.applyNavState) win.applyNavState("in"); } catch (e) {}
}

/* ---------------------------------------------------------------------------
   THE STUDENT DASHBOARD'S PAGE SWITCH

   The dashboard is two pages in one file - the dashboard itself and the "You
   need to log in" page a visitor with no session gets - and only one is in the
   document at a time (js/main.js's applyDashView()). A ta is always signed in
   while they're editing, so the locked-out half would otherwise be unreachable
   in the editor, exactly the dead end the signed-in navbar used to be in. Same
   switch, same reasons for living out here in the portal chrome rather than in
   the iframe, same "view state, never saved" rule: what a real student gets is
   decided by whether they're actually logged in.
   --------------------------------------------------------------------------- */

/* which half of the dashboard the editor is showing, "app" or "gate" */
var editorDashView = "app";

/**
 * Redraws the switch from editorDashView, and shows it only on the dashboard
 * tab - it's the only page with two halves like this.
 */
function syncDashViewSwitch() {
  var row = document.getElementById("edDashViewRow");
  var sw = document.getElementById("edDashView");
  if (!row || !sw) return;
  row.hidden = editorSubTab !== "dashboard";
  var on = editorDashView === "gate";
  sw.setAttribute("aria-checked", on ? "true" : "false");
  document.getElementById("edDashViewText").textContent = on ? "Locked out" : "Dashboard";
  sw.title = on
    ? "Editing the page a visitor without a login sees. Switch off to edit the dashboard itself."
    : "Editing the dashboard itself. Switch on to edit the page a visitor without a login sees.";
}

/** Flips which half of the dashboard the editor's iframe is showing (the switch next to the page tabs). */
function toggleEditorDashView() {
  var win = editorFrameWindow();
  /* let the iframe do the flipping - it also has to move the selection ring off
     whatever just left the page and re-pin anchored elements */
  try { if (win && win.toggleDashView) win.toggleDashView(); } catch (e) {}
  editorDashView = editorDashView === "gate" ? "app" : "gate";
  syncDashViewSwitch();
}

/**
 * Re-asserts the switch onto a freshly (re)loaded editor iframe, which always
 * starts on the dashboard itself. Runs on the frame's load event for the same
 * reason pushNavStateToFrame() does - before the content fetch inside it
 * resolves, so the override pipeline in there applies saved geometry with the
 * state already correct.
 */
function pushDashViewToFrame() {
  if (editorDashView !== "gate") return;
  var win = editorFrameWindow();
  try { if (win && win.applyDashView) win.applyDashView("gate"); } catch (e) {}
}

/* ---------------------------------------------------------------------------
   THE EDITOR'S SNAP SWITCH

   The portal-side face of js/main.js's SNAPPING section: whether drags in the
   editor line themselves up with the elements around them. Unlike the two
   switches above it, this one isn't a view of the page being edited - it's how
   editing itself behaves - so it's shown on every tab and it IS remembered, in
   the same localStorage key the frame reads (same origin, so the two sides
   need no message passing at all). Shift+R inside the frame flips the same
   setting, which is why main.js calls syncSnapSwitch() back out here
   afterwards.
   --------------------------------------------------------------------------- */

/* the key js/main.js's snapOn() reads - kept in step by hand rather than
   shared, since the two files have no module system between them. Still named
   for the pixel grid this used to be, so a ta who had snapping on doesn't
   quietly lose it, see that section's own note. */
var SNAP_KEY = "editor_grid_snap";

/** @return true if editor drags are currently snapping */
function snapOn() {
  try { return localStorage.getItem(SNAP_KEY) === "1"; } catch (e) { return false; }
}

/** Redraws the Snap switch from the stored setting. Called by the frame too, after a Shift+R in there. */
function syncSnapSwitch() {
  var sw = document.getElementById("edSnap");
  if (!sw) return;
  var on = snapOn();
  sw.setAttribute("aria-checked", on ? "true" : "false");
  document.getElementById("edSnapText").textContent = on ? "On" : "Off";
  sw.title = on
    ? "Drags and resizes line up with the edges and centres of nearby elements, and a pink guide shows what they caught. Shift+R, or click, to turn off. Arrow keys still nudge 1px at a time."
    : "Drags and resizes are free. Shift+R, or click, to line them up with the elements around them.";
}

/** Flips snapping, from the switch or from Shift+R pressed out here in the portal chrome. */
function toggleEditorSnapping() {
  var win = editorFrameWindow();
  /* the frame owns the setting (it writes the key, shows its own toast and
     takes down any guides that are up); this only asks. With no frame loaded
     yet there's nothing to ask, so write the key here instead. */
  var done = false;
  try {
    if (win && win.toggleSnapping) { win.toggleSnapping(); done = true; }
  } catch (e) {}
  if (!done) {
    try { localStorage.setItem(SNAP_KEY, snapOn() ? "0" : "1"); } catch (e) {}
  }
  syncSnapSwitch();
}

/* ---------------------------------------------------------------------------
   THE EDITOR'S THEME SWITCH

   Which theme the page in the frame is being edited in. The site's real
   light/dark button can't do this job from inside the editor - in there every
   click on it is a ta selecting, dragging or retyping it, so js/theme.js makes
   it inert under .edit-mode - and the frame's right-click menu entry that
   covered the gap is two clicks and a guess away from something you flip
   constantly while picking colours (every colour row in the style popover has
   a separate dark-mode swatch, and the only way to judge one is to look at it).

   A view of the page, not a saved setting, so it behaves like the navbar and
   dashboard switches rather than like Snap: the state lives out here in the
   parent so it survives the iframe reloads Apply/Save trigger, and nothing
   about it is ever written to content. It can't live in the frame's own
   localStorage either - the editor loads its pages with ?preview=1, which is
   exactly the flag telling setTheme() not to persist (js/theme.js), so that a
   ta previewing light mode doesn't flip the real site out from under itself.
   --------------------------------------------------------------------------- */

/* "light"/"dark" once a ta has actually used the switch, "" while the frame is
   still showing whatever theme it loaded with (the portal's own, off the shared
   localStorage key) - so a fresh editor reads the frame instead of asserting a
   theme nobody asked for. */
var editorTheme = "";

/** @return the theme the frame is currently rendering, "" if it isn't reachable */
function editorFrameTheme() {
  var win = editorFrameWindow();
  try {
    return (win && win.document.documentElement.getAttribute("data-theme")) || "";
  } catch (e) { return ""; }
}

/** Redraws the Theme switch. Called by the frame too, after its right-click light/dark entry. */
function syncThemeSwitch() {
  var sw = document.getElementById("edTheme");
  if (!sw) return;
  var on = (editorTheme || editorFrameTheme() || "dark") === "light";
  sw.setAttribute("aria-checked", on ? "true" : "false");
  document.getElementById("edThemeText").textContent = on ? "Light" : "Dark";
  sw.title = on
    ? "Editing in light mode. Switch off for dark. This only changes what you're looking at - visitors still get whatever their own toggle says."
    : "Editing in dark mode. Switch on for light. This only changes what you're looking at - visitors still get whatever their own toggle says.";
}

/** Flips the theme the frame is being edited in (the switch next to the page tabs). */
function toggleEditorTheme() {
  editorTheme = (editorTheme || editorFrameTheme() || "dark") === "dark" ? "light" : "dark";
  pushThemeToFrame();
  syncThemeSwitch();
}

/**
 * Adopts a flip the frame made on its own - its right-click "Preview in
 * light/dark mode" entry, which is still there and still works. Without this
 * the switch would sit there reading the old theme, and the next frame reload
 * would drop the ta's choice on the floor.
 * @param t "light" or "dark"
 */
function noteEditorTheme(t) {
  if (t !== "light" && t !== "dark") return;
  editorTheme = t;
  syncThemeSwitch();
}

/**
 * Re-asserts the switch onto the frame - on a flip, and on every (re)load,
 * which always comes back on the portal's own theme. Goes through the frame's
 * own setTheme() (js/theme.js) rather than stamping data-theme from out here,
 * so the sun/moon icons, every ta-picked dark colour and the style popover's
 * light/dark swatch swap all re-resolve exactly as they do for a visitor.
 */
function pushThemeToFrame() {
  if (!editorTheme) return;
  var win = editorFrameWindow();
  try { if (win && win.setSiteTheme) win.setSiteTheme(editorTheme); } catch (e) {}
}

/**
 * Toggles the Visual editor's frame section between its normal spot in the
 * page and a fixed overlay that covers the whole viewport, so a ta editing
 * fiddly small details (text, icons, resize handles) can work with more
 * screen space than the 72vh frame normally gets. "Fullscreen" is the only
 * way in, "Exit fullscreen" (same button) or Escape is the only way out.
 */
function toggleEditorFullscreen() {
  var section = document.getElementById("edSection");
  var btn = document.getElementById("edFullscreen");
  var on = section.classList.toggle("ed-fullscreen");
  btn.textContent = on ? "Exit fullscreen" : "Fullscreen";
}

/** Reloads the Visual editor's iframe on its current sub-tab, so it picks up whatever's newest in the shared snapshot. */
function reloadEditorFrame() {
  var frame = document.getElementById("edFrame");
  if (frame && frame.contentWindow) frame.contentWindow.location.reload();
}

/**
 * Reads whatever the Visual editor's iframe last wrote into the shared
 * localStorage snapshot (js/main.js's saveEditedField()) back into STATE,
 * the same way tryRestoreFromPreview() does for a fresh page load. The
 * iframe is a separate document, so its edits only ever land in
 * localStorage, never directly in this page's STATE variable; call this
 * before reading STATE (Apply/Save/Reset/Preview, or switching back to
 * the Content manager tab) whenever the Visual editor was the active tab,
 * so an in-progress click-to-edit is never silently dropped.
 */
function pullStateFromEditor() {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  if (!raw) return;
  /* a corrupt snapshot (bad json, or a shape normalizeState()/renderAll()
     chokes on) must never throw here: this runs synchronously from inside
     button handlers and showMode(), and an uncaught exception would abort
     whichever handler called it, same failure mode fixed in
     tryRestoreFromPreview() below */
  try {
    var newState = JSON.parse(raw);
    var editingRaw;
    try { editingRaw = localStorage.getItem("preview_editing"); } catch (e) { editingRaw = null; }
    /* any top-level key the draft doesn't carry at all keeps whatever
       STATE already had. js/ta.js always writes the WHOLE blob, so a
       missing key never means "the ta emptied this" (that shows up as an
       empty array/object, which is present and comes across as-is) - it
       means the draft was built up key-by-key by the editor's own
       incremental writers (js/main.js's save*(), which merge into
       whatever's in localStorage) starting from nothing. Losing the day
       panels, extras and gallery to that is exactly the wipe this guards. */
    Object.keys(STATE).forEach(function (k) {
      if (newState[k] === undefined) newState[k] = STATE[k];
    });
    STATE = newState;
    EDITING = editingRaw ? JSON.parse(editingRaw) : null;
    normalizeState();
  } catch (e) {}
}

/**
 * Switches between the Content manager form and the Visual editor iframe.
 * Both are views of the same in-memory STATE/EDITING, not two separate
 * drafts: leaving the Visual editor tab pulls its edits back into STATE
 * (see pullStateFromEditor()) before showing the form, and entering it
 * pushes the current STATE into the shared snapshot the iframe reads.
 * This is also how a profile opened via the Profiles list carries over:
 * whichever tab you're on, it's the same STATE/EDITING underneath.
 * @param mode "manager" or "editor"
 */
function showMode(mode) {
  if (mode !== "editor") mode = "manager";
  if (mode === TA_MODE) return;
  if (TA_MODE === "editor") {
    pullStateFromEditor();
    renderAll();
    syncProfileBar();
    var section = document.getElementById("edSection");
    if (section.classList.contains("ed-fullscreen")) toggleEditorFullscreen();
  }
  TA_MODE = mode;
  document.getElementById("managerView").style.display = mode === "manager" ? "block" : "none";
  document.getElementById("editorView").style.display = mode === "editor" ? "block" : "none";
  document.getElementById("taModeShell").className = "ta-mode-shell mode-" + mode;
  document.querySelectorAll("#taModeTabs .ta-mode-tab").forEach(function (b) {
    b.classList.toggle("active", b.getAttribute("data-mode") === mode);
  });
  /* the iframe renders the snapshot, so it can't be pointed at a page until
     there IS one - landing straight on this tab (?tab=editor, the link
     preview.html offers) used to fire while /api/content was still in
     flight, handing the editor the placeholder seed() as if it were the
     site's content. writePreviewSnapshot() refuses to write that now, which
     stops the wipe but would leave the editor showing a stock page, so wait
     the fetch out instead. */
  if (mode === "editor") {
    whenContentReady(function () {
      if (TA_MODE !== "editor") return; /* switched back while it loaded */
      if (!writePreviewSnapshot()) {
        showMsg("Couldn't load the saved content, so there's nothing to edit yet. Reload the page.", false);
        return;
      }
      showEditorSubTab(editorSubTab);
    });
  }
}

/**
 * Reads the Visual editor iframe's undo/redo stack (js/main.js's
 * window.ClickEditHistory) and enables/disables the toolbar buttons to
 * match. Polled on an interval since edits happen inside the iframe with
 * no event wired back out.
 */
function syncUndoButtons() {
  var frame = document.getElementById("edFrame");
  var undoBtn = document.getElementById("edUndo");
  var redoBtn = document.getElementById("edRedo");
  if (!frame || !undoBtn || !redoBtn) return;
  var history;
  try { history = frame.contentWindow.ClickEditHistory; } catch (e) { history = null; }
  undoBtn.disabled = !history || !history.canUndo();
  redoBtn.disabled = !history || !history.canRedo();
}

/** Undoes the Visual editor iframe's last commit (edUndo button, or Ctrl+Z from the parent chrome). */
function clickEditUndo() {
  var frame = document.getElementById("edFrame");
  if (frame.contentWindow.ClickEditHistory) frame.contentWindow.ClickEditHistory.undo();
  syncUndoButtons();
}

/** Redoes the Visual editor iframe's last undone commit (edRedo button, or Ctrl+Y from the parent chrome). */
function clickEditRedo() {
  var frame = document.getElementById("edFrame");
  if (frame.contentWindow.ClickEditHistory) frame.contentWindow.ClickEditHistory.redo();
  syncUndoButtons();
}

/**
 * Snapshots STATE (and the open profile, if any) into localStorage, the
 * hand-off preview.html and the Visual editor's iframe both read from and
 * tryRestoreFromPreview() restores back out of.
 *
 * Refuses to write while STATE is still the placeholder seed() (see
 * STATE_LOADED): that snapshot isn't just what the iframe renders, it's
 * what Apply/Save read back out of it (pullStateFromEditor()), so
 * publishing the placeholder would quietly stage "no day panels, no
 * extras, no gallery directories, none of the visual edits" as the ta's
 * work - and then save exactly that over the real thing.
 * @return true if the snapshot was written
 */
function writePreviewSnapshot() {
  if (!STATE_LOADED) return false;
  try {
    localStorage.setItem("preview_content", JSON.stringify(STATE));
    if (EDITING) localStorage.setItem("preview_editing", JSON.stringify(EDITING));
    else localStorage.removeItem("preview_editing");
  } catch (e) { return false; }
  return true;
}

/**
 * Runs fn once STATE holds real content, immediately if it already does.
 * @param fn called with no args
 */
function whenContentReady(fn) {
  if (STATE_LOADED || !CONTENT_READY) fn();
  else CONTENT_READY.then(fn);
}

/** Clears the unsaved-edits snapshot used by the Preview button/page. */
function clearPreviewSnapshot() {
  try {
    localStorage.removeItem("preview_content");
    localStorage.removeItem("preview_editing");
  } catch (e) {}
}

/**
 * If the ta previewed unsaved edits and came back (a fresh page load of
 * instructor.html, e.g. via the preview page's "Content manager" link)
 * without applying or resetting them first, restores STATE from that
 * snapshot instead of fetching the live content, so a trip through
 * Preview never discards in-progress work.
 * @return true if STATE was restored from a snapshot
 */
function tryRestoreFromPreview() {
  var raw;
  try { raw = localStorage.getItem("preview_content"); } catch (e) { raw = null; }
  if (!raw) return false;
  /* a corrupt snapshot (bad json, or a shape normalizeState()/renderAll()
     chokes on) must never throw here: this runs synchronously at the top
     of the DOMContentLoaded handler, before any button gets wired up, so
     an uncaught exception here used to silently kill every control on the
     page (visual editor tab, preview, apply, save, reset, all of it) with
     nothing shown to the ta except a console error. fall back to the live
     content instead, and drop the bad snapshot so it can't keep happening. */
  try {
    var newState = JSON.parse(raw);
    var editingRaw;
    try { editingRaw = localStorage.getItem("preview_editing"); } catch (e) { editingRaw = null; }
    var newEditing = editingRaw ? JSON.parse(editingRaw) : null;
    STATE = newState;
    EDITING = newEditing;
    STATE_LOADED = true;
    normalizeState();
    renderAll();
    syncProfileBar();
    showMsg("Restored your unsaved edits from before you previewed them.", true);
    return true;
  } catch (e) {
    clearPreviewSnapshot();
    return false;
  }
}

/**
 * Fetches the live content into the editor.
 * @param okMsg status message to show on success (skipped if omitted)
 * @return the underlying fetch promise
 */
function loadLive(okMsg) {
  return fetch("/api/content")
    .then(function (res) { return res.json(); })
    .then(function (data) {
      STATE = data;
      STATE_LOADED = true;
      normalizeState();
      renderAll();
      if (okMsg) showMsg(okMsg, true);
    })
    .catch(function () {
      showMsg("Couldn't load saved content, showing defaults.", false);
      renderAll();
    });
}

/**
 * What a profile is called in the list. Shared ones from another ta get
 * their owner's name in front.
 * @param p a profile {owner, name, mine, shared, ...}
 * @return the display label
 */
function profileLabel(p) {
  if (p.is_default || p.is_last_applied || p.mine) return p.name;
  if (/^Profile \d+$/.test(p.name)) return p.owner + "'s " + p.name;
  return p.owner + "'s \"" + p.name + "\" profile";
}

/**
 * Next free default name for a new profile of mine.
 * @return e.g. "Profile 3"
 */
function nextProfileName() {
  var n = 0;
  PROFILES.forEach(function (p) {
    var m = p.mine && p.name.match(/^Profile (\d+)$/);
    if (m && +m[1] > n) n = +m[1];
  });
  return "Profile " + (n + 1);
}

/**
 * Patches a profile on the server.
 * @param id the profile's id
 * @param fields the fields to update ({name, data, shared}, any subset)
 * @param onOk called with no args on success
 */
function updateProfile(id, fields, onOk) {
  authedFetch("/api/profiles/" + id, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields)
  })
    .then(function (res) {
      if (!res.ok) throw new Error("update failed");
      if (onOk) onOk();
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't update the profile. Check you're still logged in.", false);
    });
}

/** Swaps the action buttons and the header banner between live mode and profile mode. */
function syncProfileBar() {
  var txt = document.getElementById("profileBarText");
  var back = document.getElementById("profileBack");
  var apply = document.getElementById("taApply");
  var save = document.getElementById("taSave");
  if (EDITING) {
    txt.style.display = "block";
    back.style.display = "inline-flex";
    txt.textContent = 'Editing "' + profileLabel(EDITING) + '". Students see none of this until you apply it.';
    apply.textContent = "Apply this profile";
    save.textContent = "Save profile";
    save.disabled = !!(EDITING.is_default || EDITING.is_last_applied);
    save.title = EDITING.is_default ? "The Default profile can't be edited."
      : EDITING.is_last_applied ? "This profile updates automatically and can't be edited directly." : "";
  } else {
    txt.style.display = "none";
    back.style.display = "none";
    apply.textContent = "Apply changes";
    save.textContent = "Save to profile";
    save.disabled = false;
    save.title = "";
  }
}

/**
 * Loads a profile into the editor. Edits stay on a local copy until saved.
 * @param p the profile to open
 */
function openProfile(p) {
  EDITING = p;
  STATE = JSON.parse(JSON.stringify(p.data));
  normalizeState();
  renderAll();
  syncProfileBar();
  renderProfiles();
  showMsg('Opened "' + profileLabel(p) + '".', true);
  window.scrollTo(0, 0);
}

/**
 * Leaves profile mode and reloads the live content into the editor.
 * @param skipConfirm true to skip the "discard unsaved edits" confirm dialog
 */
function backToLive(skipConfirm) {
  if (!skipConfirm && !confirm("Go back to the live content? Unsaved profile edits are discarded.")) return;
  EDITING = null;
  clearPreviewSnapshot();
  loadLive().then(function () {
    if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
  });
  syncProfileBar();
  renderProfiles();
}

/**
 * Loads this ta's profiles (plus any shared by others) into PROFILES and re-renders the list.
 * @return the underlying fetch promise
 */
function fetchProfiles() {
  return authedFetch("/api/profiles")
    .then(function (res) {
      if (!res.ok) throw new Error("profiles failed");
      return res.json();
    })
    .then(function (list) {
      PROFILES = list;
      renderProfiles();
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      var el = document.getElementById("profileList");
      if (el) el.innerHTML = '<p class="muted"><strong>Couldn\'t load profiles.</strong></p>';
    });
}

/** Renders the profiles list into #profileList and wires up its controls. */
function renderProfiles() {
  var list = document.getElementById("profileList");
  if (!list) return;
  if (!PROFILES.length) {
    list.innerHTML = '<p class="muted"><strong>No profiles yet.</strong></p>';
    return;
  }

  var html = "";
  PROFILES.forEach(function (p, i) {
    var open = EDITING && EDITING.id === p.id;
    html += '<div class="res-row prof-row" data-i="' + i + '">';
    if (p.mine) {
      html += '<input type="text" class="pr-name" value="' + p.name + '" aria-label="Profile name">';
    } else {
      html += '<span class="rname">' + profileLabel(p) + '</span>';
    }
    if (p.is_default) {
      html += '<span class="shared-flag" title="The site\'s original look out of the box. Can\'t be edited, but any staff member can delete it.">' +
        SHARE_SVG_CHIP + 'default, shared with everyone</span>';
    } else if (p.is_last_applied) {
      html += '<span class="shared-flag" title="Automatically updated to whatever was live right before the most recent Apply. A one-step-back recovery point if someone else\'s apply overwrites your changes. Can\'t be edited or deleted.">' +
        SHARE_SVG_CHIP + 'auto-updated, shared with everyone</span>';
    } else if (p.shared) {
      html += '<span class="shared-flag" title="Every staff member can see and edit this profile">' + SHARE_SVG_CHIP + 'shared</span>' +
        '<button class="btn btn-ghost pr-unshare" type="button">Unshare</button>';
    }
    html += '<span class="prof-btns">';
    if (!p.is_default) {
      html += '<button class="btn btn-ghost pr-edit" type="button"' + (open ? " disabled" : "") + '>' +
        (open ? "Editing" : "Edit") + '</button>';
    }
    if (p.mine) {
      if (!p.shared) html += '<button class="btn btn-ghost pr-share" type="button">Share</button>';
      html += '<button class="btn btn-ghost pr-del" type="button">Delete</button>';
    } else if (p.is_default) {
      html += '<button class="btn btn-ghost pr-del" type="button">Delete</button>';
    }
    html += '</span></div>';
  });
  list.innerHTML = html;

  list.querySelectorAll(".prof-row").forEach(function (row) {
    var p = PROFILES[+row.getAttribute("data-i")];

    var nameInput = row.querySelector(".pr-name");
    if (nameInput) nameInput.addEventListener("change", function () {
      var v = this.value.trim();
      if (!v || v === p.name) { this.value = p.name; return; }
      updateProfile(p.id, { name: v }, function () {
        p.name = v;
        if (EDITING && EDITING.id === p.id) syncProfileBar();
      });
    });

    var editBtn = row.querySelector(".pr-edit");
    if (editBtn) editBtn.addEventListener("click", function () {
      if (EDITING && EDITING.id === p.id) return;
      if (!confirm('Open "' + profileLabel(p) + '" in the editor? Unsaved edits here are discarded.')) return;
      openProfile(p);
    });

    var shareBtn = row.querySelector(".pr-share");
    if (shareBtn) shareBtn.addEventListener("click", function () {
      updateProfile(p.id, { shared: true }, function () {
        p.shared = true;
        renderProfiles();
        showMsg('Shared. Every staff member can see "' + p.name + '" now.', true);
      });
    });

    /* unlike sharing (owner only), any ta who can see a shared profile can
       take it back off the shared list, no need to track down the owner */
    var unshareBtn = row.querySelector(".pr-unshare");
    if (unshareBtn) unshareBtn.addEventListener("click", function () {
      updateProfile(p.id, { shared: false }, function () {
        p.shared = false;
        renderProfiles();
        showMsg('Unshared "' + p.name + '".', true);
      });
    });

    var delBtn = row.querySelector(".pr-del");
    if (delBtn) delBtn.addEventListener("click", function () {
      if (!confirm('Delete "' + p.name + '"? This can\'t be undone.')) return;
      authedFetch("/api/profiles/" + p.id, { method: "DELETE" })
        .then(function (res) {
          if (!res.ok) throw new Error("delete failed");
          PROFILES.splice(PROFILES.indexOf(p), 1);
          if (EDITING && EDITING.id === p.id) backToLive(true);
          renderProfiles();
          showMsg("Profile deleted.", true);
        })
        .catch(function (err) {
          if (err.message === "expired") return;
          showMsg("Couldn't delete that profile.", false);
        });
    });
  });
}

/* the tab opened by openObjectEditor(), if still around, reused across
   Edit/New clicks the same way previewWindow is reused for Preview */
var objectEditorWindow = null;

/**
 * Opens the reusable-object mini editor, reusing an already-open tab from
 * an earlier click instead of piling up new ones (same pattern
 * openPreview() uses for previewWindow). Objects are their own shared
 * library independent of STATE/profiles entirely (see /api/objects in
 * app/main.py), so there's no snapshot to hand off here, the editor page
 * loads its own data straight from the server.
 * @param id the object to edit, or omit/null to start a brand new one
 */
function openObjectEditor(id) {
  var url = id ? ("object-editor.html?object=1&id=" + id) : "object-editor.html?object=1";
  if (objectEditorWindow && !objectEditorWindow.closed) {
    objectEditorWindow.location.href = url;
    objectEditorWindow.focus();
  } else {
    objectEditorWindow = window.open(url, "ta_object_editor");
  }
}

/**
 * Loads the shared reusable-objects library and renders it into
 * #objectsList: a name plus, same "visible/usable by every ta, but only
 * its owner can change it" rule a ta-uploaded icon/font/video already
 * follows (see the Icon library bullet in CLAUDE.md), Edit and Delete only
 * show on a row for the ta who added it (both are owner-only server-side
 * too, see api_update_object()/api_delete_object() in app/main.py, this
 * just keeps a non-owner from seeing a button that would only ever 403).
 */
function fetchObjects() {
  var wrap = document.getElementById("objectsList");
  if (!wrap) return;
  var me = localStorage.getItem("session");
  authedFetch("/api/objects")
    .then(function (res) {
      if (!res.ok) throw new Error("objects failed");
      return res.json();
    })
    .then(function (list) {
      if (!list.length) {
        wrap.innerHTML = '<p class="muted"><strong>No saved objects yet.</strong> Build one in the object editor.</p>';
        return;
      }
      wrap.innerHTML = "";
      list.forEach(function (obj) {
        var mine = obj.owner === me;
        var row = document.createElement("div");
        row.className = "res-row";
        row.innerHTML =
          '<span class="rname">' + obj.name + '</span>' +
          '<span class="prof-btns">' +
          (mine ? '<button class="btn btn-ghost obj-edit" type="button">Edit</button>' : '') +
          (mine ? '<button class="btn btn-ghost obj-del" type="button">Delete</button>' : '') +
          '</span>';
        if (mine) {
          row.querySelector(".obj-edit").addEventListener("click", function () { openObjectEditor(obj.id); });
          row.querySelector(".obj-del").addEventListener("click", function () {
            if (!confirm('Delete "' + obj.name + '"? This can\'t be undone.')) return;
            authedFetch("/api/objects/" + obj.id, { method: "DELETE" })
              .then(function (res) {
                if (!res.ok) throw new Error("delete failed");
                fetchObjects();
                showMsg("Object deleted.", true);
              })
              .catch(function (err) {
                if (err.message === "expired") return;
                showMsg("Couldn't delete that object.", false);
              });
          });
        }
        wrap.appendChild(row);
      });
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      wrap.innerHTML = '<p class="muted"><strong>Couldn\'t load the objects library.</strong></p>';
    });
}

/**
 * Apply = make what's on screen live for students. In profile mode it
 * also saves the profile first so the two can't drift apart. Works from
 * either tab: if the Visual editor is open, pulls in whatever it's
 * written to the shared snapshot first, so an in-progress click-to-edit
 * isn't dropped.
 */
function applyContent() {
  if (TA_MODE === "editor") pullStateFromEditor();
  if (EDITING && !confirm('Apply "' + profileLabel(EDITING) + '" to the live site? Students will see it right away.')) return;
  showMsg("Applying...", true);
  authedFetch("/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(STATE)
  })
    .then(function (res) {
      if (!res.ok) throw new Error("apply failed");
      renderAll();
      if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
      else clearPreviewSnapshot();
      if (EDITING) {
        EDITING.data = JSON.parse(JSON.stringify(STATE));
        /* the Default profile's own data never changes, and the "Most
           recently applied" profile's data is server-managed (overwritten
           by snapshot_last_applied() on every apply, see app/db.py), never
           by a direct edit; the server rejects writes to either anyway, so
           skip the resave here rather than trigger a doomed updateProfile()
           and a confusing error */
        if (!EDITING.is_default && !EDITING.is_last_applied) updateProfile(EDITING.id, { data: STATE });
        showMsg("Profile applied. Students see it now.", true);
      } else {
        showMsg("Applied. Students see this now.", true);
      }
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't apply. Check you're still logged in and try again.", false);
    });
}

/** Save = stash what's on screen in a profile, live site untouched. Same editor-tab pull as applyContent(). */
function saveToProfile() {
  if (TA_MODE === "editor") pullStateFromEditor();
  if (EDITING) {
    updateProfile(EDITING.id, { data: STATE }, function () {
      EDITING.data = JSON.parse(JSON.stringify(STATE));
      renderAll();
      showMsg("Profile saved. The live site is unchanged.", true);
    });
    return;
  }
  var name = nextProfileName();
  showMsg("Saving...", true);
  authedFetch("/api/profiles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, data: STATE })
  })
    .then(function (res) {
      if (!res.ok) throw new Error("save failed");
      return fetchProfiles();
    })
    .then(function () {
      renderAll();
      showMsg('Saved as "' + name + '". The live site is unchanged.', true);
    })
    .catch(function (err) {
      if (err.message === "expired") return;
      showMsg("Couldn't save. Check you're still logged in and try again.", false);
    });
}

/**
 * Reset = throw away unsaved edits: back to the live site, or the open
 * profile's last saved data if one's being edited. Doesn't need an
 * editor-tab pull first, unlike the other three actions: it's discarding
 * whatever's unsaved anyway, in either tab.
 */
function resetContent() {
  if (!confirm("Reset everything back to how it was last saved? This throws away your edits.")) return;
  clearPreviewSnapshot();
  if (EDITING) {
    STATE = JSON.parse(JSON.stringify(EDITING.data));
    normalizeState();
    renderAll();
    if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
    showMsg("Reset to the profile's last saved version.", true);
    return;
  }
  loadLive("Reset to the last saved version.").then(function () {
    if (TA_MODE === "editor") { writePreviewSnapshot(); reloadEditorFrame(); }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", function () {
    localStorage.removeItem("session");
    localStorage.removeItem("role");
    localStorage.removeItem("token");
    localStorage.removeItem("last_active");
    window.location.href = "login.html";
  });
  if (!gateCheck()) return;

  CONTENT_READY = tryRestoreFromPreview() ? Promise.resolve() : loadLive();
  fetchProfiles();
  fetchObjects();

  document.getElementById("newObjectBtn").addEventListener("click", function () {
    openObjectEditor();
  });

  document.getElementById("profileBack").addEventListener("click", function () {
    backToLive();
  });

  document.getElementById("addVariable").addEventListener("click", function () {
    var key = uniqueVariableKey("variable");
    STATE.variables.push({
      key: key, name: "New variable", type: "string", value: "",
      description: "", builtin: false, computed: false
    });
    renderVariables();
  });

  document.getElementById("addPanel").addEventListener("click", function () {
    var next = STATE.days.length ? STATE.days[STATE.days.length - 1].day + 1 : 1;
    /* id/children: same "durable key for js/main.js's tile-binding area"
       reasoning as newExtraId()/an extras entry's own id, see its doc
       comment - assigned right away rather than waiting on the next
       server round trip's backfill (app/db.py's _backfill_days_ids()) */
    STATE.days.push({
      day: next, date: "", opens_at: "", unlocked: false, title: "", blurb: "", files: [],
      id: newExtraId(), children: []
    });
    renderPanels();
  });

  GALLERY_VIDEO_INPUTS.forEach(function (pair) {
    var box = document.getElementById(pair[0]);
    if (box) box.addEventListener("change", function () { STATE.gallery.video[pair[1]] = this.checked; });
  });

  var newYearInput = document.getElementById("newYearInput");
  document.getElementById("addGalleryYear").addEventListener("click", function () {
    var y = newYearInput.value.trim();
    if (!y) {
      showGalleryMsg("Give the directory a name first.", false);
      newYearInput.focus();
      return;
    }
    if (STATE.gallery.years.indexOf(y) !== -1) {
      showGalleryMsg('There\'s already a directory called "' + y + '".', false);
      newYearInput.focus();
      newYearInput.select();
      return;
    }
    STATE.gallery.years.unshift(y);
    STATE.gallery.images[y] = [];
    newYearInput.value = "";
    showGalleryMsg('Added "' + y + '". Apply or save your changes to keep it.', true);
    renderGallery();
  });
  /* the complaint is about what's in the box, so it goes as soon as that
     changes rather than sitting there being wrong */
  newYearInput.addEventListener("input", function () { showGalleryMsg("", true); });
  newYearInput.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    document.getElementById("addGalleryYear").click();
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
      .catch(function (err) {
        if (err.message === "expired") return;
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
    STATE.extras.push({ type: "link", value: v, id: newExtraId(), children: [] });
    extraLinkInput.value = "";
    extraLinkRow.style.display = "none";
    renderExtras();
  }
  document.getElementById("extraLinkAdd").addEventListener("click", addExtraLink);
  extraLinkInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); addExtraLink(); }
  });

  document.getElementById("taPreview").addEventListener("click", openPreview);
  document.getElementById("taApply").addEventListener("click", applyContent);
  document.getElementById("taSave").addEventListener("click", saveToProfile);
  document.getElementById("taReset").addEventListener("click", resetContent);

  /* Content manager <-> Visual editor tabs, both views of the same STATE */
  document.querySelectorAll("#taModeTabs .ta-mode-tab").forEach(function (btn) {
    btn.addEventListener("click", function () { showMode(this.getAttribute("data-mode")); });
  });

  /* landing/dashboard/gallery sub-tabs inside the Visual editor */
  document.querySelectorAll("#edSubTabs .pv-tab").forEach(function (btn) {
    btn.addEventListener("click", function () { showEditorSubTab(this.getAttribute("data-tab")); });
  });

  document.getElementById("edUndo").addEventListener("click", clickEditUndo);
  document.getElementById("edRedo").addEventListener("click", clickEditRedo);
  setInterval(syncUndoButtons, 400);

  /* the landing page's signed-out/signed-in navbar switch */
  document.getElementById("edNavState").addEventListener("click", toggleEditorNavState);
  document.getElementById("edFrame").addEventListener("load", pushNavStateToFrame);
  syncNavStateSwitch();

  /* the dashboard's dashboard/locked-out page switch */
  document.getElementById("edDashView").addEventListener("click", toggleEditorDashView);
  document.getElementById("edFrame").addEventListener("load", pushDashViewToFrame);
  syncDashViewSwitch();

  /* the light/dark switch. Re-asserted on every frame load like the two above
     it, and re-read on load as well: with no ta choice of its own yet the
     switch shows whatever theme the frame came up in. */
  document.getElementById("edTheme").addEventListener("click", toggleEditorTheme);
  document.getElementById("edFrame").addEventListener("load", function () {
    pushThemeToFrame();
    syncThemeSwitch();
  });
  syncThemeSwitch();

  /* snapping: the switch, plus Shift+R for when focus is out here in the
     portal rather than in the frame (the frame has its own handler for the
     other case, see wireResizable() in js/main.js) */
  document.getElementById("edSnap").addEventListener("click", toggleEditorSnapping);
  syncSnapSwitch();

  document.getElementById("edFullscreen").addEventListener("click", toggleEditorFullscreen);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.getElementById("edSection").classList.contains("ed-fullscreen")) {
      toggleEditorFullscreen();
    }
    /* Ctrl+Z/Ctrl+Y (or Ctrl+Shift+Z) also work from the parent chrome (the
       sub-tabs, toolbar, anywhere outside the iframe itself): js/main.js
       already binds its own copy inside the iframe's own document for
       whichever click-to-edit field has focus there, this just covers focus
       sitting on the portal page around it */
    if (TA_MODE === "editor" && (e.ctrlKey || e.metaKey)) {
      var key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) { e.preventDefault(); clickEditUndo(); }
      else if (key === "y" || (key === "z" && e.shiftKey)) { e.preventDefault(); clickEditRedo(); }
    }
    /* Shift+R toggles snapping, for the same reason undo/redo are
       repeated out here: the shortcut has to work whether focus is in the
       iframe or on the portal chrome around it. Skipped while a real form
       control has focus, so it can't eat an R being typed into the content
       manager's fields. */
    if (TA_MODE === "editor" && (e.key === "r" || e.key === "R") &&
        e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var act = document.activeElement;
      if (act && (act.isContentEditable || act.tagName === "INPUT" || act.tagName === "TEXTAREA" || act.tagName === "SELECT")) return;
      e.preventDefault();
      toggleEditorSnapping();
    }
  });

  /* the Day panels/Extras/Gallery/Landing/Profiles nav links only make
     sense in the Content manager view, so jump back to it before the
     browser scrolls to the target anchor */
  document.querySelectorAll("#taSectionNav a").forEach(function (a) {
    a.addEventListener("click", function () { showMode("manager"); });
  });

  /* lets preview.html's "Visual editor" link (?tab=editor) land straight
     on that tab instead of the content manager */
  if (/[?&]tab=editor(&|$)/.test(window.location.search)) showMode("editor");
});
