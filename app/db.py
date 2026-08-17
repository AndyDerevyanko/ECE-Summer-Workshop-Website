"""sqlite connection + schema. users table holds hashed login credentials,
content table holds the TA-editable site content (day panels, extras, timer)."""

import json
import re
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.security import generate_token, hash_password, verify_password

try:
    from app.seed_accounts import SEED_STUDENTS, SEED_TAS
except ImportError:
    # gitignored file missing (fresh clone), no accounts get seeded
    SEED_STUDENTS, SEED_TAS = {}, {}

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "app.db"
UPLOAD_DIR = BASE_DIR / "data" / "uploads"

# sliding idle windows per role, pushed forward on every authenticated
# request (tas also heartbeat from an open tab, see js/idle.js). tas hold
# the editing keys so they idle out fast; students only lose the dashboard
# so they get a lazier window. matches IDLE_LIMIT_MS in js/idle.js.
TA_IDLE_SECONDS = 20 * 60
STUDENT_IDLE_SECONDS = 4 * 60 * 60


def _idle_seconds(role):
    """the sliding idle window for a role.
    @param role "ta" or "student"
    @return seconds of inactivity before the session expires
    """
    return TA_IDLE_SECONDS if role == "ta" else STUDENT_IDLE_SECONDS

# ids that default to "fixed" in the visual editor (always stacked above
# every non-fixed element, and shown with the red "this is fixed" hitbox in
# edit mode, see applyLayerOrder()/toggleFixed()/applyFixedHighlight() in
# js/main.js): the sticky <nav> itself plus everything inside it, so the
# whole nav bar reads as promoted, not just its outer box. matches the
# data-edit-id/data-resize-id values on templates/index.html's <nav>.
#
# BOTH navbars: the landing page has one for a signed-out visitor and one for
# someone already signed in (the "navin." half, see the two <nav> elements in
# templates/index.html and applyNavSessionState() in js/main.js). They're
# edited independently, so each needs its own entry here.
_NAV_OUT_FIXED_IDS = [
    "box.nav", "box.brand", "img.brand.nav", "nav.brand",
    "nav.link.about", "nav.link.gallery", "nav.link.learn",
    "nav.link.schedule", "nav.link.prizes", "nav.link.apply",
    "nav.portal", "box.themeBtn",
]
_NAV_IN_FIXED_IDS = [
    "navin.box.nav", "navin.box.brand", "navin.img.brand.nav", "navin.nav.brand",
    "navin.nav.link.about", "navin.nav.link.gallery", "navin.nav.link.learn",
    "navin.nav.link.schedule", "navin.nav.link.prizes",
    "navin.box.themeBtn", "navin.nav.dashboard", "navin.nav.logout",
]
NAV_FIXED_IDS = _NAV_OUT_FIXED_IDS + _NAV_IN_FIXED_IDS

# the "What You'll Learn" section's reel (see the "reel" custom-element kind
# in js/main.js): used to be hardcoded markup in templates/index.html, now a
# real placed reel like a ta could build themselves, so it's deletable/
# resizable/recolorable and its tiles can have new content dropped onto
# them. Reuses the exact same icon.learn.cardN / learn.cardN.title /
# learn.cardN.body ids the old markup carried, so every override a ta
# already made via click-to-edit (font size, color, text, ...) keeps
# resolving against the same id and applies with zero data transformation -
# see _learn_reel_overlay()/_migrate_learn_reel() below. Icon markup mirrors
# ICON_LIBRARY's "Circuit"/"Component"/"Soldering iron"/"Chip"/"Cube"/"Flag"
# entries in js/main.js (the old markup's own icons, just inlined here since
# this is python, not js).
_LEARN_REEL_ICONS = [
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12h3" /><path d="M19 12h3" />'
    '<path d="M5 12c2-7 4-7 6 0s4 7 6 0" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h6" /><path d="M21 12h-6" />'
    '<path d="M9 7l6 5-6 5z" /><path d="M15 7v10" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 7l4 4L7 21H3v-4z" />'
    '<path d="M15 5l2-2 4 4-2 2" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5" />'
    '<path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l9 5v10l-9 5-9-5V7z" />'
    '<path d="M12 12l9-5M12 12v10M12 12L3 7" /></svg>',
    '<svg class="cic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3v18" /><path d="M6 4h13v8H6z" />'
    '<path d="M6 4h4.3v4H6zM14.7 4H19v4h-4.3zM10.3 8h4.4v4h-4.4z" fill="currentColor" stroke="none" /></svg>',
]

_LEARN_REEL_CARDS = [
    {"title": "Electronics & Circuit Design", "body": "Build and debug real circuits using oscilloscopes, multimeters, function generators, and power supplies. Learn circuit analysis, prototyping, testing, and troubleshooting techniques."},
    {"title": "Transistors, Diodes, Capacitors & Inductors", "body": "Learn how fundamental electronic components work, giving you a head start in 2nd-year courses like ECE231 and ECE212."},
    {"title": "Soldering & PCB Assembly", "body": "Learn professional soldering techniques, component placement, rework, and PCB assembly."},
    {"title": "Embedded Systems", "body": "Program an Arduino-compatible microcontroller to read sensors, generate signals, control motors, and talk to external hardware."},
    {"title": "CAD & 3D Printing", "body": "Learn the basics of Fusion 360 and 3D printing to design, manufacture, and assemble your own robot."},
    {"title": "Robotics Competition", "body": "Bring your robot to life and race it head-to-head against the rest."},
]


def _learn_reel_overlay():
    """builds the migrated "What You'll Learn" reel's custom-element entry
    plus the flat per-id override maps (text/font_sizes/text_styles/colors)
    its tiles' bound children need to look/read right - see
    _LEARN_REEL_ICONS/_LEARN_REEL_CARDS above. "left"/"top" are only a
    same-window fallback (a one-time eyeball measurement against the live
    rendered page at a 1280px viewport); the real positioning comes from
    "anchor", a selector for the reserved-space spacer left in the section's
    own flow (#learnReelAnchor in templates/index.html) - js/main.js's
    applyElementAnchors() re-pins the reel to that element's live rect on
    every load/resize, so it stays correctly placed under the heading no
    matter how tall the hero above it renders (it's sized with vh units, so
    the gap between here and the top of the page isn't a fixed pixel count).
    A ta can still drag/resize the panel like anything else; see
    applyElementAnchors()'s own doc comment for why that never fights this.
    @return (entry, text, font_sizes, text_styles, colors)
    """
    tiles = []
    text, font_sizes, text_styles, colors = {}, {}, {}, {}
    for i, card in enumerate(_LEARN_REEL_CARDS, start=1):
        icon_id = "icon.learn.card%d" % i
        title_id = "learn.card%d.title" % i
        body_id = "learn.card%d.body" % i
        tiles.append({
            "id": "learn.reel.tile.%d" % (i - 1),
            "children": [
                {"id": icon_id, "kind": "icon", "left": 20, "top": 22, "icon": _LEARN_REEL_ICONS[i - 1]},
                {"id": title_id, "kind": "text", "left": 58, "top": 24, "w": 240, "h": 46},
                {"id": body_id, "kind": "text", "left": 20, "top": 80, "w": 280, "h": 130},
            ],
        })
        text[title_id] = card["title"]
        text[body_id] = card["body"]
        # 1.05rem/var(--font-head) matches the old .card h3's own rule (see
        # css/style.css); "text" kind text_styles has no bold control, so
        # this is an approximation, not pixel-identical to the old markup
        font_sizes[title_id] = "1.05rem"
        text_styles[title_id] = {"fontFamily": "var(--font-head)"}
        colors[body_id] = "var(--muted)"
    entry = {
        "id": "learn.reel", "kind": "reel", "orientation": "horizontal",
        "page": "index",
        "anchor": "#learnReelAnchor", "left": 80, "top": 1888,
        "tileW": 320, "tileH": 230,
        # explicit panel size, unlike a freshly-placed reel (which freezes
        # at its own just-rendered pre-clone size, see addCustomElement()):
        # this entry is built once at page load already past the point
        # js/learn-reel.js has cloned it 4x for the loop (renderCustomElements()
        # runs before initAllReels(), see the call order in main.js), so
        # without an explicit width here the panel would size itself to fit
        # all 24 cloned tiles unclipped instead of acting as a proper
        # scrolling/drifting viewport - see initReel().
        "w": 1160, "h": 230,
        "tiles": tiles,
    }
    return entry, text, font_sizes, text_styles, colors


(_LEARN_REEL_ENTRY, _LEARN_REEL_TEXT, _LEARN_REEL_FONT_SIZES,
 _LEARN_REEL_TEXT_STYLES, _LEARN_REEL_COLORS) = _learn_reel_overlay()

# the three landing-page Apply Now buttons (templates/index.html), by
# data-edit-id, and the tooltip they ship with. See DEFAULT_CONTENT["tooltips"]
# below and _migrate_apply_tooltip() further down, the only two users of this.
_APPLY_TOOLTIP_IDS = ["nav.link.apply", "hero.cta.primary", "prizes.cta"]
_APPLY_TOOLTIP_SEED = {
    "text": "Applications open once the workshop dates are confirmed, check back soon.",
    "pos": "bottom",
}

# what the one seeded is_default=1 profile is called in every ta's profile
# list. Dated, because that's the honest description of it: it holds
# DEFAULT_CONTENT, the site as it shipped, and DEFAULT_CONTENT is a python
# literal a future edit can change - so the row is the theme of a particular
# moment rather than "the" theme forever. Nobody can rename it (the server
# refuses a name change on is_default), so _migrate_default_profile_name()
# can carry an older db's row across to this without stepping on ta wording.
DEFAULT_PROFILE_NAME = "Original Theme Aug 2026"

# starting content, same shape as the old hardcoded DAYS/EXTRAS/timer vars.
# only used the first time the content table is empty.
DEFAULT_CONTENT = {
    "days": [
        {"day": 1, "date": "", "opens_at": "", "unlocked": False, "title": "", "blurb": "", "files": []},
        {"day": 2, "date": "", "opens_at": "", "unlocked": False, "title": "", "blurb": "", "files": []},
    ],
    "extras": [],
    # how many day tiles the student dashboard's grid draws at once: a floor on
    # the total ("min_tiles") and a count of locked teasers on top of whatever
    # is currently open ("extra_locked"), both capped by the "total_days"
    # variable below. See DAYS_DISPLAY_DEFAULTS in js/dashboard.js for the full
    # rule and the Day panels section in js/ta.js for the ta-facing controls.
    "days_display": {"min_tiles": 0, "extra_locked": 1},
    # named, typed values a ta can bind editor elements to (right now just a
    # progress bar's Current/Total selects, on its right-click menu - see
    # renderCtxMenuProgressVars() in js/main.js) and reference from formula
    # text.
    # Everything in this list is PUBLIC: it's what the content manager's
    # Variables section shows, and every page's editor pickers offer all of
    # it, the two builtins below included. A page can also have PRIVATE
    # variables that are meaningless anywhere else (the gallery's per-pane
    # "which image of how many" pairs) - those are derived by the editor from
    # what's placed on the page, never stored here, and never listed in the
    # content manager, see pageLocalVariables() in js/main.js.
    # type is one of "string"/"number"/"boolean"/"datetime". "builtin" ones
    # can be renamed but never removed or retyped (js/ta.js enforces this in
    # the Variables section UI); "computed" ones have no ta-editable value at
    # all - "value" is overwritten on every read with a live-derived number,
    # see get_content()'s _refresh_computed_variables() call. "key" is the
    # stable internal id a formula chip's data-fx-a stores - unlike "name" it
    # never changes once a variable exists. "name" is what a ta actually
    # types: shown on the tile, freely renameable, AND (since it's what the
    # visual editor's {Name} inline notation - see parseVariableTokens() in
    # js/main.js - matches against) the one a ta types directly into a text
    # field to reference this variable live. That dual role is why it can't
    # hold "{", "}", ":" or whitespace (those are the notation's own
    # delimiters) - enforced on every read/write, see _sanitize_variable_names().
    "variables": [
        {
            "key": "total_days", "name": "TotalDays", "type": "number",
            "value": 10,
            "description": "\"__ of TOTAL days unlocked\" progress bar on student dashboard",
            "builtin": True, "computed": False,
        },
        {
            "key": "days_progressed", "name": "DaysProgressed", "type": "number",
            "value": 0,
            "description": "The day number the workshop is currently on (count of unlocked days), calculated automatically",
            "builtin": True, "computed": True,
        },
    ],
    "timer_mode": "tentative",
    "timer_target": "",
    "join_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "hero_video_url": "assets/cover-video.mp4",
    # landing page photos (about section + certificate), staff-replaceable
    # from the content manager's "Site images" section, see js/ta.js.
    "home_images": {
        "about_hero": "assets/gallery/group-main-alt.jpeg",
        "about_1": "assets/gallery/class-closeup.jpeg",
        "about_2": "assets/gallery/robot-closeup.png",
        "about_3": "assets/gallery/class-2.jpeg",
        "certificate": "assets/certificate.png",
    },
    "logistics": [
        {"big": "2 weeks", "lbl": "Tentative start date", "icon": False},
        {"big": "4 hours", "lbl": "1:30pm–5:30pm", "icon": False},
        {"big": "SFB520", "lbl": "Sandford Fleming", "icon": False},
        {"big": "", "lbl": "Certificate of completion", "icon": True},
    ],
    "gallery": {
        # how a clip plays inside a gallery image pane. Same three switches a
        # placed video gets from its own right-click menu, see
        # VIDEO_PLAYBACK_KEYS in js/main.js.
        #
        # "video" is the baseline every clip starts from; "video_opts" holds
        # the per-clip choices a ta has actually made, keyed by media url, and
        # wins wherever it has an entry. It used to be "video" alone - one
        # decision for the whole gallery - which is wrong the moment two clips
        # want different things (a short silent loop that should just run, next
        # to a long one a visitor ought to be able to scrub), and that's the
        # normal case rather than the exotic one. Keyed by URL rather than by
        # (directory, index) so a clip keeps its settings when the directory is
        # renamed or its images reordered, and so the same clip in two
        # directories behaves the same way in both.
        "video": {"autoplay": True, "controls": False, "pausable": False},
        "video_opts": {},
        "years": ["2026", "2025"],
        "images": {
            "2026": [
                "assets/gallery/group-main-2026.png",
                "assets/gallery/robots-moving.MOV",
                "assets/gallery/robot-moving.MOV",
                "assets/gallery/alumni-conference.png",
                "assets/gallery/class-2.jpeg",
                "assets/gallery/class-3.jpeg",
                "assets/gallery/class-4.jpeg",
                "assets/gallery/class-5.jpeg",
                "assets/gallery/class-closeup-2.jpeg",
                "assets/gallery/class-closeup-3.jpeg",
                "assets/gallery/class-closeup-4.jpeg",
                "assets/gallery/class-closeup.jpeg",
                "assets/gallery/class.png",
                "assets/gallery/group-main-alt-2.jpeg",
                "assets/gallery/group-main-alt-3.jpeg",
                "assets/gallery/group-main-alt-4.jpeg",
                "assets/gallery/group-main-alt-5.jpeg",
                "assets/gallery/group-main-alt.jpeg",
                "assets/gallery/hamid-2.png",
                "assets/gallery/hamid-3.png",
                "assets/gallery/hamid-4.png",
                "assets/gallery/hamid-5.png",
                "assets/gallery/hamid-6.png",
                "assets/gallery/hamid.png",
                "assets/gallery/people-2.png",
                "assets/gallery/people-looking.png",
                "assets/gallery/people-track.JPG",
                "assets/gallery/people.png",
                "assets/gallery/prizes-1.png",
                "assets/gallery/prizes-2.png",
                "assets/gallery/prizes-3.png",
                "assets/gallery/prizes-4.png",
                "assets/gallery/prizes-5.png",
                "assets/gallery/prizes-6.png",
                "assets/gallery/prizes-7.png",
                "assets/gallery/prizes-8.png",
                "assets/gallery/prizes-9.png",
                "assets/gallery/prizes-10.png",
                "assets/gallery/random.jpeg",
                "assets/gallery/robot-closeup-2.png",
                "assets/gallery/robot-closeup-3.png",
                "assets/gallery/robot-closeup-4.png",
                "assets/gallery/robot-closeup-5.png",
                "assets/gallery/robot-closeup.png",
                "assets/gallery/robot-on-track-2.png",
                "assets/gallery/robot-on-track-3.png",
                "assets/gallery/robot-on-track-closeup.png",
                "assets/gallery/robot-on-track.png",
                "assets/gallery/robot-super-closeup.png",
                "assets/gallery/seraj.png",
                "assets/gallery/track-2.png",
                "assets/gallery/track-3.png",
                "assets/gallery/track-far-shot-2.JPG",
                "assets/gallery/track-far-shot.png",
                "assets/gallery/track-from-far-2.png",
                "assets/gallery/track-from-far.png",
                "assets/gallery/track-photo.png",
                "assets/gallery/wide-angle-room.png",
                "assets/gallery/runner-up.MOV",
            ],
            "2025": [
                "assets/gallery/group_photo_2025.jpg",
                "assets/gallery/hand_crank_joule_thief_2025.MOV",
                "assets/gallery/robot_in_action_2025.MOV",
                "assets/gallery/workshop_happening_2025.jpg",
            ],
        },
    },
    # click-to-edit overrides for hardcoded landing page copy, keyed by the
    # data-edit-id on the element in templates/index.html. empty means "show
    # the page's own default text".
    "text": {},
    # resize-handle drags in the visual editor, keyed by data-edit-id (text
    # boxes) or data-resize-id (images/icons), {id: {w, h}} in css px.
    "sizes": {},
    # A-/A+ font-size bumps in the visual editor, keyed by data-edit-id, css
    # px string.
    "font_sizes": {},
    # text toolbar's font/align/letter-spacing, keyed by data-edit-id,
    # {id: {fontFamily, align, letterSpacing}}.
    "text_styles": {},
    # text toolbar's padding row, keyed by data-edit-id/data-resize-id, a css
    # padding shorthand string ("12px 20px 12px 20px"). Its own map rather
    # than a fourth key under text_styles: padding is box geometry, not
    # typography, and applies to anything with edges.
    "padding": {},
    # move-handle drags in the visual editor, text fields only, keyed by
    # data-edit-id, {id: {x, y}} left/top offsets in css px.
    "positions": {},
    # elements deleted in the visual editor, a flat list of data-edit-id/
    # data-resize-id values to hide.
    "hidden": [],
    # elements added in the visual editor's right-click "Add element" menu,
    # not present in the template at all, {id, kind, left, top, w, h, icon,
    # href}, see renderCustomElements() in js/main.js.
    "custom_elements": [],
    # visual editor stacking order, ordered ids bottom to top, see
    # applyLayerOrder()/moveLayer() in js/main.js.
    "layers": [],
    # ids "promoted to navbar", always stacked above every non-fixed
    # element regardless of layer order, see toggleFixed() in js/main.js.
    # defaults to the nav bar and everything inside it.
    "fixed_elements": list(NAV_FIXED_IDS),
    # visual editor style popover's color picker, keyed by data-edit-id/
    # data-resize-id, a css color string. text color, icon color, or
    # background color depending on the element, see setElementColor() in
    # js/main.js.
    "colors": {},
    # visual editor style popover's opacity slider, keyed by data-edit-id/
    # data-resize-id, a number 0-1.
    "opacity": {},
    # ids locked against being moved in the visual editor (right-click >
    # Lock element), see toggleLocked() in js/main.js. a flat list, same
    # shape as fixed_elements.
    "locked": [],
    # elements duplicated in the visual editor's right-click "Duplicate"
    # option, {sourceId, suffix} pairs: the duplicate's own id is always
    # sourceId+suffix, reconstructed on every load by re-cloning whatever
    # sourceId currently renders as, see renderDuplicates() in js/main.js.
    "duplicates": [],
    # visual editor style popover's Fill control, keyed by data-edit-id.
    # a textbox's own background surface, separate from its font color
    # (content.colors), see applyFillOverrides() in js/main.js.
    "fill": {},
    # visual editor style popover's Radius slider, keyed by data-edit-id/
    # data-resize-id, a whole-number px value.
    "radius": {},
    # visual editor style popover's Border row, keyed by data-edit-id/
    # data-resize-id, {w, color}.
    "border": {},
    # ids with the shared drop-shadow (style popover's Shadow checkbox)
    # turned on, a flat list, same shape as fixed_elements/locked.
    "shadow": [],
    # ids with the style popover's Flip horizontal/Flip vertical toggle on
    # (only ever set for icon/image/video/box elements, see toggleStyleMenu()
    # in js/main.js), flat lists, same shape as shadow/locked.
    "flip_h": [],
    "flip_v": [],
    # the three per-video playback switches on a placed video's right-click
    # menu (see VIDEO_PLAYBACK_KEYS in js/main.js), flat lists of ids, same
    # shape as shadow/flip_h above. A placed video autoplays muted on a loop
    # with no player chrome, so each list only names the clips that deviate:
    # ones that don't start on their own, ones showing the browser's native
    # controls, and ones a plain click play/pauses.
    "video_no_autoplay": [],
    "video_controls": [],
    "video_pausable": [],
    # visual editor style popover's Rotate slider, keyed by data-edit-id/
    # data-resize-id, a whole-number degrees value (-180 to 180).
    "rotate": {},
    # right-click "Add link"/"Edit link" targets, keyed by data-edit-id/
    # data-resize-id, a url string. a real <a> (a button, the brand link)
    # gets a real href; anything else gets a navigate-on-click listener,
    # see applyOneLink() in js/main.js.
    "links": {},
    # visual editor style popover's Text color row, buttons only, keyed by
    # data-edit-id. a button's own Color row already means its background
    # (see colorTarget() in js/main.js), this is the separate control for
    # its label.
    "text_color": {},
    # visual editor style popover's Hover color/Click color rows, buttons
    # only, keyed by data-edit-id, a css color string. every button already
    # gets a default hover/press darken effect with no override set (see
    # .btn:hover/.btn:active in css/style.css) - these just let a ta pick an
    # exact color for either state instead, see
    # applyButtonStateColorOverrides() in js/main.js.
    "hover_color": {},
    "active_color": {},
    # visual editor style popover's "Change icon" row, theme toggles only
    # (the nav's own #themeBtn, or a placed "theme" custom element), keyed
    # by data-resize-id, raw <svg>/<img> markup. empty means "show the
    # default sun/moon swap", see applyThemeIconOverrides() in js/main.js.
    "theme_icons": {},
    # dark-mode overrides for the four maps above (colors/text_color/fill/
    # border), same keys, each optional: an id present here wins over the
    # auto-computed dark variant (autoDarkVariant() in js/main.js flips the
    # light color's hsl lightness) whenever [data-theme="dark"], see
    # resolveThemedColor()/the style popover's "dark mode color" toggles in
    # js/main.js. an id with no entry here still gets the auto variant, it's
    # never left at its literal light-mode color in dark mode.
    "dark_colors": {},
    "dark_text_color": {},
    "dark_fill": {},
    "dark_border": {},
    "dark_hover_color": {},
    "dark_active_color": {},
    # per-axis sizing behaviour for the student dashboard's three tile
    # containers (the Extra attachments area, the days area, and the
    # attachments sub-area inside each open day tile), keyed by
    # data-resize-id, {id: {x, y}} with each axis "lock" or "expand".
    # "lock" keeps the container's own size and makes the tiles fit inside
    # it (scrolling if they can't); "expand" sizes the container to whatever
    # its tiles come to. empty means "use each container's own default",
    # see AREA_FLOW_DEFAULTS/applyTileFlow() in js/main.js.
    "area_flow": {},
    # "progress" custom-element kind's two colors (the fill and the track/
    # background behind it), keyed by data-resize-id, a css color string.
    # same paired light/dark-override shape as colors/dark_colors above -
    # resolveThemedColor() in js/main.js falls back to autoDarkVariant() for
    # whichever mode has no explicit entry here.
    "progress_fill": {},
    "dark_progress_fill": {},
    "progress_track": {},
    "dark_progress_track": {},
    # per-element hover tooltips, keyed by data-edit-id/data-resize-id. one
    # whole descriptor per element rather than a map per property - the words,
    # which side of the element the bubble sits on, and its colors/border/
    # corners/size - since a tooltip is added and edited as one thing from the
    # visual editor's right-click menu. Anything a descriptor leaves out falls
    # back to TOOLTIP_DEFAULTS, see the ELEMENT TOOLTIPS section in js/main.js.
    #
    # seeded with the three landing-page Apply Now buttons, which is where this
    # feature came from: their tooltip used to be one shared apply_tooltip
    # string edited from a form field in the content manager, because a tooltip
    # only exists while someone is hovering and so had no element in the editor
    # to click on. Same words, same place under the button (pos "bottom",
    # matching the old hardcoded css rule) - see _migrate_apply_tooltip() for
    # blobs that already carry a ta's own wording.
    "tooltips": {
        "nav.link.apply": {**_APPLY_TOOLTIP_SEED},
        "hero.cta.primary": {**_APPLY_TOOLTIP_SEED},
        "prizes.cta": {**_APPLY_TOOLTIP_SEED},
    },
    # how each element behaves as the page narrows, keyed by data-edit-id/
    # data-resize-id: {id: {axis, regions: [{from, to, ramp, props}]}}. Authored
    # from the Responsive switch in the editor chrome; see the RESPONSIVE
    # BEHAVIOUR section in js/main.js for the resolver these feed, and seed()
    # in js/ta.js for the field-by-field shape.
    #
    # Seeded empty on purpose. Everything a ta places is stored as an absolute
    # pixel offset measured at one viewport width, so an element with no entry
    # is NOT left sitting on those raw pixels - responsiveFallbackFor() anchors
    # and scales it instead. Regions are the per-element override on top of
    # that, not the thing that makes the page work at all.
    "responsive": {},
    # design-rule violations a ta has accepted, keyed "<id>|<rule>" with a short
    # reason as the value. See runResponsiveDrc() in js/main.js.
    "responsive_waivers": {},
}
DEFAULT_CONTENT["custom_elements"].append(_LEARN_REEL_ENTRY)
DEFAULT_CONTENT["text"].update(_LEARN_REEL_TEXT)
DEFAULT_CONTENT["font_sizes"].update(_LEARN_REEL_FONT_SIZES)
DEFAULT_CONTENT["text_styles"].update(_LEARN_REEL_TEXT_STYLES)
DEFAULT_CONTENT["colors"].update(_LEARN_REEL_COLORS)

# the student dashboard's progress bar (Days progressed of Total days) used
# to be hardcoded markup + js (templates/dashboard.html's old #progFill/
# #progLabel, js/dashboard.js's old renderProgress()) - now a real placed
# "progress" custom element like a ta could build themselves, bound to the
# two builtin variables above by default, so it's moveable/recolorable/
# reshapeable through the visual editor same as everything else. "anchor"
# re-pins it to the reserved-space spacer left in dash-head's own flow
# (#dashProgressAnchor in templates/dashboard.html) on every load/resize,
# same mechanism/reasoning as _LEARN_REEL_ENTRY's anchor - see
# applyElementAnchors() in js/main.js - which drives its WIDTH off that same
# spacer too, so the "w" below is only a pre-layout fallback: the hand-
# measured 1160 is wider than the page column actually resolves to (1076 at a
# 1440px viewport), and pinning the bar to it hung its right edge well past
# every other element on the page. No bundled label text: "text is
# separate from the bar" per the feature spec, a ta can place their own
# caption next to it (the live "X of Y" number as text is a later formula-
# text feature, not this one).
_DASH_PROGRESS_ENTRY = {
    "id": "seed.dashboard.progress", "kind": "progress",
    "page": "dashboard",
    "anchor": "#dashProgressAnchor", "left": 0, "top": 0,
    "w": 1160, "h": 12,
    "varCurrent": "days_progressed", "varTotal": "total_days",
}
DEFAULT_CONTENT["custom_elements"].append(_DASH_PROGRESS_ENTRY)
# matches the old hardcoded .progress-bar/.progress-bar i rule (css/style.css)
# so the migration is a visual no-op by default: var(--good) fill (var(--accent)
# under body.mono, which both index.html and dashboard.html carry) over a
# var(--surface-2) track.
DEFAULT_CONTENT["progress_fill"]["seed.dashboard.progress"] = "var(--accent)"
DEFAULT_CONTENT["progress_track"]["seed.dashboard.progress"] = "var(--surface-2)"
DEFAULT_CONTENT["radius"]["seed.dashboard.progress"] = 999

# the student dashboard's "Extra attachments" tile list used to be plain,
# non-editor markup (templates/dashboard.html's old static #resList,
# js/dashboard.js's renderExtras() building rows nobody could restyle) - now
# a real placed "extrasArea" custom element like the progress bar above, so
# a ta can move/resize/recolor it. "anchor" re-pins it to the reserved-space
# spacer in the resources section's own flow (#dashExtrasAreaAnchor in
# templates/dashboard.html), same mechanism as _DASH_PROGRESS_ENTRY. Its
# inner tile markup (rect/icon/filename/download-button per attachment)
# stays js/dashboard.js's own job - renderExtras() finds this element by id
# and renders into it, see the js/main.js<->js/dashboard.js "window.renderExtras"
# hook in applySharedEditorOverrides().
_DASH_EXTRAS_AREA_ENTRY = {
    "id": "seed.dashboard.extras.area", "kind": "extrasArea",
    "page": "dashboard",
    "anchor": "#dashExtrasAreaAnchor", "left": 0, "top": 0,
    "w": 1160, "h": 40,
}
DEFAULT_CONTENT["custom_elements"].append(_DASH_EXTRAS_AREA_ENTRY)

# the student dashboard's "The days" tile grid, same treatment as
# _DASH_EXTRAS_AREA_ENTRY just above: a real placed "daysArea" custom
# element anchored to the days section's own reserved spacer
# (#dashDaysAreaAnchor in templates/dashboard.html). js/dashboard.js's
# renderDays() finds it by id and renders the locked/open tile templates
# into it, same "window.renderDays" hook shape as renderExtras().
_DASH_DAYS_AREA_ENTRY = {
    "id": "seed.dashboard.days.area", "kind": "daysArea",
    "page": "dashboard",
    "anchor": "#dashDaysAreaAnchor", "left": 0, "top": 0,
    "w": 1160, "h": 40,
}
DEFAULT_CONTENT["custom_elements"].append(_DASH_DAYS_AREA_ENTRY)

# the login page's form, same treatment the dashboard's progress bar and tile
# areas already got (_DASH_PROGRESS_ENTRY above): what used to be hardcoded
# markup in templates/login.html (the two <input> fields, the submit button
# and the error line) is now four real placed custom elements a ta can move,
# resize, restyle, delete and re-add from the visual editor's Login page tab.
# Each one anchors to its own reserved spacer inside the auth card
# (#loginUserAnchor/#loginPassAnchor/#loginSubmitAnchor/#loginErrorAnchor),
# same mechanism as every other migrated element, so the card still lays
# itself out in normal flow and the page ships working out of the box for a
# real visitor instead of loading as an empty box a ta has to build up.
#
# These four kinds only exist here: the right-click menu only offers them on
# the login page (see renderCtxMenuRoot() in js/main.js), because a username
# box or a submit button has nothing to do anywhere else. js/login.js binds
# to them by their data-login-* markers rather than by id, so a ta's own
# added/deleted/re-added copies keep working with no bookkeeping.
_LOGIN_USER_ENTRY = {
    "id": "seed.login.field.username", "kind": "loginField", "field": "username",
    "page": "login",
    "anchor": "#loginUserAnchor", "left": 0, "top": 0,
    "w": 300, "h": 48,
}
_LOGIN_PASS_ENTRY = {
    "id": "seed.login.field.password", "kind": "loginField", "field": "password",
    "page": "login",
    "anchor": "#loginPassAnchor", "left": 0, "top": 0,
    "w": 300, "h": 48,
}
_LOGIN_SUBMIT_ENTRY = {
    "id": "seed.login.submit", "kind": "loginButton",
    "page": "login",
    "anchor": "#loginSubmitAnchor", "left": 0, "top": 0,
    "w": 300, "h": 42,
}
_LOGIN_ERROR_ENTRY = {
    "id": "seed.login.error", "kind": "loginError",
    "page": "login",
    "anchor": "#loginErrorAnchor", "left": 0, "top": 0,
    "w": 300, "h": 40,
}
_LOGIN_ENTRIES = [_LOGIN_USER_ENTRY, _LOGIN_PASS_ENTRY, _LOGIN_SUBMIT_ENTRY, _LOGIN_ERROR_ENTRY]
DEFAULT_CONTENT["custom_elements"].extend(_LOGIN_ENTRIES)
# matches the old hardcoded .field input / .btn-primary rules so the migration
# is a visual no-op by default (see css/style.css's .login-field-box)
DEFAULT_CONTENT["radius"]["seed.login.field.username.box"] = 10
DEFAULT_CONTENT["radius"]["seed.login.field.password.box"] = 10

# the gallery page's four moving parts, given the same treatment the student
# dashboard's tile areas got (_DASH_EXTRAS_AREA_ENTRY above): what used to be
# hardcoded markup in templates/gallery.html (the year rail, the one photo
# stage, its two arrows and its "1 / 57" counter) is now five real placed
# custom elements a ta can move, resize, restyle, delete and re-add from the
# visual editor's Gallery tab. Each anchors to its own reserved spacer in the
# page's own flow, same mechanism as every other migrated element.
#
# The rail is a live area exactly like the dashboard's two: a TRANSPARENT box
# that js/gallery.js renders one tile per directory into. The coloured
# rectangle behind a directory is the tile's own rect role, and any backdrop
# behind the whole rail is a separate box a ta places themselves - the area
# itself never paints anything.
_GALLERY_DIRS_AREA_ENTRY = {
    "id": "seed.gallery.dirs.area", "kind": "galleryDirArea",
    "page": "gallery",
    "anchor": "#galleryDirsAnchor", "left": 0, "top": 0,
    "w": 120, "h": 40,
}
# the photo/clip stage. "dir" is which directory it flips through: "" means
# "whatever the rail has selected", which is what the page has always done and
# what makes the rail worth having. A ta can place MORE of these from the
# right-click menu and bind each to a fixed directory instead, so one page can
# show 2025 and 2026 side by side (see the "galleryPane" kind in js/main.js).
_GALLERY_PANE_ENTRY = {
    "id": "seed.gallery.pane", "kind": "galleryPane", "dir": "",
    "page": "gallery",
    "anchor": "#galleryPaneAnchor", "left": 0, "top": 0,
    "w": 900, "h": 600,
}
# the two arrows and the counter are deliberately ORDINARY elements - a button
# and a textbox - not a special "gallery arrow" kind. What makes an arrow an
# arrow is its LINK: content.links points it at a gallery page action rather
# than a url (see GALLERY_ACTIONS/applyOneLink() in js/main.js), which is
# exactly what lets a ta delete these and point any button they like at the
# same action instead.
_GALLERY_PREV_ENTRY = {
    "id": "seed.gallery.prev", "kind": "button",
    "page": "gallery",
    "anchor": "#galleryPrevAnchor", "left": 0, "top": 0,
    "w": 42, "h": 42,
}
_GALLERY_NEXT_ENTRY = {
    "id": "seed.gallery.next", "kind": "button",
    "page": "gallery",
    "anchor": "#galleryNextAnchor", "left": 0, "top": 0,
    "w": 42, "h": 42,
}
_GALLERY_COUNT_ENTRY = {
    "id": "seed.gallery.count", "kind": "text",
    "page": "gallery",
    "anchor": "#galleryCountAnchor", "left": 0, "top": 0,
    "w": 74, "h": 26,
}
_GALLERY_ENTRIES = [_GALLERY_DIRS_AREA_ENTRY, _GALLERY_PANE_ENTRY,
                    _GALLERY_PREV_ENTRY, _GALLERY_NEXT_ENTRY, _GALLERY_COUNT_ENTRY]

# the chevrons the page has always drawn, verbatim. They live in content.text
# because a button's label IS its innerHTML (see applyTextOverrides() in
# js/main.js) - so a ta can restyle the arrow, type a word beside it, or swap
# it for one of the two new "Arrow left"/"Arrow right" entries in the editor's
# icon library, all through the ordinary text tools.
_GALLERY_PREV_SVG = (
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M15 5l-7 7 7 7"/></svg>'
)
_GALLERY_NEXT_SVG = (
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    '<path d="M9 5l7 7-7 7"/></svg>'
)
# "1 / 57", built out of the page's own two exclusive variables rather than
# written by js: these chips resolve against whichever image the pane they
# name is currently on (see buildGalleryChipHtml() in js/main.js). dir="" is
# the seeded pane, so this counter follows the rail like the pane does.
_GALLERY_COUNT_HTML = (
    '<span class="fx-chip" contenteditable="false" data-fx-local="gallery-current" data-fx-dir=""'
    '>1</span> / '
    '<span class="fx-chip" contenteditable="false" data-fx-local="gallery-total" data-fx-dir=""'
    '>1</span>'
)
# what the arrows DO, as content.links entries. "gallery:prev"/"gallery:next"
# with no directory after them means "the pane following the rail", the same
# "" convention _GALLERY_PANE_ENTRY's own dir uses.
_GALLERY_LINKS = {
    "seed.gallery.prev": "gallery:prev",
    "seed.gallery.next": "gallery:next",
}
# matches the old hardcoded .gv-arrow/.gv-count rules so the migration is a
# visual no-op by default: round grey pills over the photo. Both themes are
# given the same var() so resolveThemedColor() never has to auto-derive a dark
# variant out of a css variable name it can't parse as a colour.
_GALLERY_COLORS = {
    "seed.gallery.prev": "var(--surface-2)",
    "seed.gallery.next": "var(--surface-2)",
}
_GALLERY_RADIUS = {
    "seed.gallery.prev": 999,
    "seed.gallery.next": 999,
    "seed.gallery.count": 8,
}
# the counter is a TEXTBOX, so what used to be .gv-count's background is its
# Fill (a textbox's own surface, separate from its font colour - see
# colorTarget() in js/main.js) rather than a Color, and its centring is an
# ordinary text-toolbar alignment. Every one of these is a control a ta can
# reach and change; none of it is special-cased markup anymore.
_GALLERY_FILL = {"seed.gallery.count": "var(--surface-2)"}
_GALLERY_TEXT_STYLES = {"seed.gallery.count": {"align": "center"}}
DEFAULT_CONTENT["custom_elements"].extend(_GALLERY_ENTRIES)
DEFAULT_CONTENT["text"]["seed.gallery.prev"] = _GALLERY_PREV_SVG
DEFAULT_CONTENT["text"]["seed.gallery.next"] = _GALLERY_NEXT_SVG
DEFAULT_CONTENT["text"]["seed.gallery.count"] = _GALLERY_COUNT_HTML
DEFAULT_CONTENT["links"].update(_GALLERY_LINKS)
DEFAULT_CONTENT["colors"].update(_GALLERY_COLORS)
DEFAULT_CONTENT["dark_colors"].update(_GALLERY_COLORS)
DEFAULT_CONTENT["radius"].update(_GALLERY_RADIUS)
DEFAULT_CONTENT["fill"].update(_GALLERY_FILL)
DEFAULT_CONTENT["dark_fill"].update(_GALLERY_FILL)
DEFAULT_CONTENT["text_styles"].update(_GALLERY_TEXT_STYLES)

# starter "objects" library entries (see the objects table below): reusable
# element bundles a ta can drop onto the page from the visual editor's
# right-click "Add element" > "Object" picker (see placeObject() in
# js/main.js). Each is authored from scratch as its own small
# custom_elements bundle (same shape content.custom_elements already uses),
# not derived from anything already tagged on index.html, so seeding this
# can never change how the real page's own elements are tagged/grouped.
# the seeded "Navbar" bundle in particular carries no fixed_elements entry
# at all (placeObject() never copies one across anyway, it isn't one of the
# maps it remaps), so a placed copy is a normal, freely-movable group, never
# auto-promoted the way the real live nav is.
DEFAULT_OBJECTS = [
    {
        "name": "Logistics tile",
        "data": {
            # matches the real .card.stat tiles (css/style.css): surface
            # background, --font-mono accent-colored big number, muted label,
            # both centered, same as the dashboard/landing page's own tiles,
            # not just a generic box+text guess.
            "custom_elements": [
                {"id": "seed.tile.box", "kind": "box", "left": 0, "top": 0, "w": 200, "h": 140},
                {"id": "seed.tile.big", "kind": "text", "left": 30, "top": 28, "w": 140, "h": 50},
                {"id": "seed.tile.lbl", "kind": "text", "left": 20, "top": 86, "w": 160, "h": 26},
            ],
            "text": {
                "seed.tile.big": "2 weeks",
                "seed.tile.lbl": "Tentative start date",
            },
            # measured against the real classes: --font-mono 1.9rem "2 weeks"
            # is 124.7x48.6 (.stat .big), default .9rem "Tentative start
            # date" is 131.1x23 (.stat .lbl). too-short boxes here used to
            # bisect the text with the always-on dashed outline or wrap a
            # line straight past the tile's own bottom edge.
            "font_sizes": {"seed.tile.big": "1.9rem", "seed.tile.lbl": ".9rem"},
            "text_styles": {
                "seed.tile.big": {"fontFamily": "var(--font-mono)", "align": "center"},
                "seed.tile.lbl": {"align": "center"},
            },
            "colors": {
                "seed.tile.big": "var(--accent)", "seed.tile.lbl": "var(--muted)",
                "seed.tile.box": "var(--surface)",
            },
            "radius": {"seed.tile.box": 14},
            "groups": [["seed.tile.box", "seed.tile.big", "seed.tile.lbl"]],
        },
    },
    {
        "name": "Countdown timer",
        "data": {
            # a composite of individually-editable parts, not one monolith,
            # but the countdown itself is ONE datetime element (kind
            # "datetime", format "countdown"), not split into a piece per
            # unit, its own strftime pattern (left blank here, falls back to
            # DT_DEFAULT_PATTERNS.countdown in js/main.js) prints all 4 units
            # in one ticking string. Alongside it: a surface card, a
            # "COUNTING DOWN" eyebrow, and one "DAYS   HRS   MIN   SEC"
            # label row underneath, all grouped so they move as one but
            # each stays independently editable (font, size, color, align,
            # and, for the datetime part, its own format/pattern via the
            # style popover). The datetime part's target is filled in at
            # seed time (see _seed_default_objects()), 30 days out from
            # whenever the db is first created, since a hardcoded date here
            # would eventually sit in the past.
            "custom_elements": [
                {"id": "seed.cd.box", "kind": "box", "left": 0, "top": 0, "w": 440, "h": 156},
                {"id": "seed.cd.eyebrow", "kind": "text", "left": 24, "top": 18, "w": 250, "h": 20},
                {"id": "seed.cd.dt", "kind": "datetime", "left": 24, "top": 50, "w": 392, "h": 48, "format": "countdown", "strftime": "", "target": None},
                {"id": "seed.cd.lbl", "kind": "text", "left": 24, "top": 104, "w": 392, "h": 20},
            ],
            "text": {
                "seed.cd.eyebrow": "COUNTING DOWN",
                # wide gaps (not the datetime element's own 2-space ones):
                # the label renders much smaller than the digits (.7rem vs
                # 2rem) so it needs proportionally wider spaces to land each
                # word's center under its matching digit group, see the
                # white-space: pre rule for [data-edit-id^="seed.cd.lbl"]
                # in css/style.css, without which this collapses to single
                # spaces and the words bunch up with no alignment at all.
                "seed.cd.lbl": "DAYS" + " " * 9 + "HRS" + " " * 9 + "MIN" + " " * 9 + "SEC",
            },
            "font_sizes": {
                "seed.cd.eyebrow": ".75rem",
                "seed.cd.dt": "2rem",
                "seed.cd.lbl": ".7rem",
            },
            "text_styles": {
                "seed.cd.eyebrow": {"fontFamily": "var(--font-mono)", "letterSpacing": "2px"},
                "seed.cd.dt": {"fontFamily": "var(--font-mono)", "align": "center", "letterSpacing": "4px"},
                "seed.cd.lbl": {"fontFamily": "var(--font-mono)", "align": "center", "letterSpacing": "1px"},
            },
            "colors": {
                "seed.cd.box": "color-mix(in srgb, var(--surface) 75%, transparent)",
                "seed.cd.eyebrow": "var(--accent)",
                "seed.cd.dt": "var(--accent)",
                "seed.cd.lbl": "var(--muted)",
            },
            "radius": {"seed.cd.box": 14},
            "groups": [[
                "seed.cd.box", "seed.cd.eyebrow", "seed.cd.dt", "seed.cd.lbl",
            ]],
        },
    },
    {
        "name": "Navbar",
        "data": {
            # a real replica of the site's own nav (templates/index.html),
            # not a 2-link placeholder: the actual logo file, the actual
            # wordmark, all 6 real nav links (About/Gallery/What you'll
            # learn/Schedule/Prizes/Apply Now) in the real muted color, a
            # decorative theme-toggle icon, and the real "Access portal"
            # teal button, all at the real nav's own font sizes.
            "custom_elements": [
                {"id": "seed.nav.bar", "kind": "box", "left": 0, "top": 0, "w": 1300, "h": 64},
                {"id": "seed.nav.logo", "kind": "image", "left": 24, "top": 10, "w": 44, "h": 44, "url": "assets/logo.png"},
                {"id": "seed.nav.brand", "kind": "text", "left": 77, "top": 19, "w": 150, "h": 30},
                {"id": "seed.nav.about", "kind": "text", "left": 243, "top": 20, "w": 60, "h": 26},
                {"id": "seed.nav.gallery", "kind": "text", "left": 328, "top": 20, "w": 65, "h": 26},
                {"id": "seed.nav.learn", "kind": "text", "left": 418, "top": 20, "w": 140, "h": 26},
                {"id": "seed.nav.schedule", "kind": "text", "left": 583, "top": 20, "w": 85, "h": 26},
                {"id": "seed.nav.prizes", "kind": "text", "left": 693, "top": 20, "w": 60, "h": 26},
                {"id": "seed.nav.apply", "kind": "text", "left": 778, "top": 20, "w": 95, "h": 26},
                {
                    "id": "seed.nav.theme", "kind": "icon", "left": 1080, "top": 20, "w": 24, "h": 24,
                    "icon": (
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
                        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" />'
                        '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>'
                    ),
                },
                {"id": "seed.nav.portal", "kind": "button", "left": 1136, "top": 7, "w": 140, "h": 50},
            ],
            "text": {
                "seed.nav.brand": "ECE Workshops",
                "seed.nav.about": "About",
                "seed.nav.gallery": "Gallery",
                "seed.nav.learn": "What you'll learn",
                "seed.nav.schedule": "Schedule",
                "seed.nav.prizes": "Prizes",
                "seed.nav.apply": "Apply Now",
                "seed.nav.portal": "Access portal",
            },
            # measured against the real classes: --font-head 700 1.05rem
            # "ECE Workshops" is 128.9x26.9 (.brand), .92rem nav links are
            # ~24px tall (.nav-links a, widest "What you'll learn" 116.7
            # wide), a real .btn-ghost "Access portal" is 135x49.5.
            "font_sizes": {"seed.nav.brand": "1.05rem"},
            "text_styles": {"seed.nav.brand": {"fontFamily": "var(--font-head)"}},
            "colors": {
                "seed.nav.about": "var(--muted)", "seed.nav.gallery": "var(--muted)",
                "seed.nav.learn": "var(--muted)", "seed.nav.schedule": "var(--muted)",
                "seed.nav.prizes": "var(--muted)", "seed.nav.apply": "var(--muted)",
                "seed.nav.theme": "var(--text)", "seed.nav.portal": "var(--teal)",
            },
            # the real .btn-accent2 "Access portal" button pairs its teal
            # background with dark navy text (#06121a), not the plain
            # button's default light text; text_color is the style
            # popover's separate Text color control for exactly this.
            "text_color": {"seed.nav.portal": "#06121a"},
            "groups": [[
                "seed.nav.bar", "seed.nav.logo", "seed.nav.brand", "seed.nav.about", "seed.nav.gallery",
                "seed.nav.learn", "seed.nav.schedule", "seed.nav.prizes", "seed.nav.apply",
                "seed.nav.theme", "seed.nav.portal",
            ]],
        },
    },
    {
        "name": "Heading + subheading",
        "data": {
            "custom_elements": [
                {"id": "seed.head.eyebrow", "kind": "text", "left": 0, "top": 0, "w": 110, "h": 26},
                {"id": "seed.head.title", "kind": "text", "left": 0, "top": 32, "w": 220, "h": 60},
            ],
            "text": {
                "seed.head.eyebrow": "Eyebrow",
                "seed.head.title": "Heading",
            },
            # 13px "EYEBROW" is 71x20.8, 34px --font-head "Heading" is
            # 129.2x54.4, same reasoning as the tile/countdown/navbar above.
            "font_sizes": {"seed.head.eyebrow": "13px", "seed.head.title": "34px"},
            "text_styles": {
                "seed.head.eyebrow": {"fontFamily": "var(--font-body)", "letterSpacing": "1px"},
                "seed.head.title": {"fontFamily": "var(--font-head)"},
            },
            "colors": {"seed.head.eyebrow": "var(--accent)"},
            "groups": [["seed.head.eyebrow", "seed.head.title"]],
        },
    },
    {
        "name": "Progress bar",
        "data": {
            # bound to the two builtin variables by default (see
            # DEFAULT_CONTENT["variables"] above) - a ta re-binds either side
            # to any other number variable from the style popover's Current/
            # Total selects. The label is a plain, separate text element (see
            # _DASH_PROGRESS_ENTRY's doc comment above for why it isn't fused
            # into the bar itself), grouped so it moves with the bar but
            # stays independently editable/deletable, same pattern as the
            # Countdown timer's eyebrow/label text above.
            "custom_elements": [
                {"id": "seed.pb.lbl", "kind": "text", "left": 0, "top": 0, "w": 200, "h": 22},
                {
                    "id": "seed.pb.bar", "kind": "progress", "left": 0, "top": 28, "w": 280, "h": 14,
                    "varCurrent": "days_progressed", "varTotal": "total_days",
                },
            ],
            "text": {"seed.pb.lbl": "Progress"},
            "font_sizes": {"seed.pb.lbl": ".85rem"},
            "colors": {"seed.pb.lbl": "var(--muted)"},
            "progress_fill": {"seed.pb.bar": "var(--good)"},
            "progress_track": {"seed.pb.bar": "var(--surface-2)"},
            "radius": {"seed.pb.bar": 999},
            "groups": [["seed.pb.lbl", "seed.pb.bar"]],
        },
    },
]


def get_db():
    """opens a new connection to the sqlite database.
    @return a sqlite3.Connection with row_factory set to sqlite3.Row
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """creates the schema (if missing) and seeds accounts/content on first run."""
    DB_PATH.parent.mkdir(exist_ok=True)
    UPLOAD_DIR.mkdir(exist_ok=True)
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('student', 'ta')),
            plain TEXT
        )
        """
    )
    # plain holds student passwords so tas can read them back off the
    # accounts page (they're ta-issued handout credentials, not secrets).
    # ta rows stay null, those are hash-only. guarded alter for older dbs.
    try:
        conn.execute("ALTER TABLE users ADD COLUMN plain TEXT")
    except sqlite3.OperationalError:
        pass
    # login tokens, issued on login, checked on every ta-only request.
    # expires_at slides forward on every valid use (see get_session), so a
    # session only dies from real inactivity, not from navigating around.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            role TEXT NOT NULL,
            expires_at INTEGER
        )
        """
    )
    # guarded add for dbs created before expires_at existed. those old rows
    # come back with expires_at null, which get_session treats as expired,
    # a one-time forced re-login instead of the old "never expires" tokens.
    try:
        conn.execute("ALTER TABLE sessions ADD COLUMN expires_at INTEGER")
    except sqlite3.OperationalError:
        pass
    # single row of json holding everything the ta portal edits. simplest
    # thing that works for a handful of day panels and a short extras list.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data TEXT NOT NULL
        )
        """
    )
    # saved drafts of the whole content blob, per ta. shared=1 makes a
    # profile visible (and editable) to every ta, not just its owner.
    # is_default=1 marks the one seeded profile (DEFAULT_PROFILE_NAME, see
    # _seed_default_profile()): shared with everyone, and neither editable nor
    # deletable by anyone - api_update_profile()/api_delete_profile() in
    # app/main.py both 403 on it regardless of owner or sharing. It's the
    # site's original look, the one thing in the list that's always there to
    # go back to, so it isn't any one ta's to remove.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL,
            shared INTEGER NOT NULL DEFAULT 0,
            is_default INTEGER NOT NULL DEFAULT 0,
            is_last_applied INTEGER NOT NULL DEFAULT 0
        )
        """
    )
    # guarded add for dbs created before is_default existed.
    try:
        conn.execute("ALTER TABLE profiles ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    # guarded add for dbs created before is_last_applied existed (see
    # snapshot_last_applied()).
    try:
        conn.execute("ALTER TABLE profiles ADD COLUMN is_last_applied INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    # tiny flag table so _seed_default_profile() only ever inserts once,
    # ever: guarding it on "the profiles table happens to be empty" instead
    # would reseed a fresh original-theme profile the moment a ta deletes the
    # only profile that ever existed, on the server's very next restart,
    # making a delete that's supposed to stick silently undo itself.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT
        )
        """
    )
    # ta-uploaded icons/videos/fonts for the visual editor's Add element menu
    # and text toolbar font picker: visible to every ta right away (unlike a
    # profile, there's no separate "share" step), but only the ta who added
    # one can remove it again, see api_delete_asset() in app/main.py. the
    # site's own built-in icons/fonts aren't rows here at all, so they can
    # never be deleted through this table.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS custom_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kind TEXT NOT NULL CHECK (kind IN ('icon', 'video', 'font')),
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL
        )
        """
    )
    # shared reusable-object library (see DEFAULT_OBJECTS above and
    # placeObject() in js/main.js): visible to every ta right away, same
    # "shared the moment it's added" model as custom_assets, but stores a
    # whole bundle (custom_elements + per-id override maps) as json instead
    # of a single uploaded file's url.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS objects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            data TEXT NOT NULL
        )
        """
    )
    conn.commit()
    _seed_users(conn)
    _backfill_plain(conn)
    _seed_content(conn)
    _seed_default_profile(conn)
    _migrate_default_profile_name(conn)
    _unshare_seeded_last_applied(conn)
    _seed_default_objects(conn)
    _migrate_learn_reel(conn)
    _migrate_dashboard_progress(conn)
    _migrate_dashboard_extras_area(conn)
    _migrate_dashboard_days_area(conn)
    _migrate_login_page(conn)
    _migrate_gallery_page(conn)
    _migrate_login_labels(conn)
    _migrate_landing_nav_states(conn)
    _migrate_custom_elements_page_scope(conn)
    _migrate_progress_bar_object(conn)
    _migrate_drop_variable_page_scope(conn)
    _migrate_apply_tooltip(conn)
    conn.close()


def _seed_users(conn):
    """inserts SEED_STUDENTS/SEED_TAS if the users table is still empty.
    @param conn an open db connection
    """
    if conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
        return
    rows = []
    for username, password in SEED_STUDENTS.items():
        password_hash, salt = hash_password(password)
        rows.append((username, password_hash, salt, "student", password))
    for username, password in SEED_TAS.items():
        password_hash, salt = hash_password(password)
        rows.append((username, password_hash, salt, "ta", None))
    conn.executemany(
        "INSERT INTO users (username, password_hash, salt, role, plain) VALUES (?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()


def _backfill_plain(conn):
    """fills in student plain-text passwords for dbs seeded before the plain
    column existed, by username, off the seed list.
    @param conn an open db connection
    """
    for username, password in SEED_STUDENTS.items():
        conn.execute(
            "UPDATE users SET plain = ? WHERE username = ? AND role = 'student' AND plain IS NULL",
            (password, username),
        )
    conn.commit()


def verify_login(username, password):
    """checks a login attempt against the stored hash.
    @param username the attempted username
    @param password the attempted plaintext password
    @return the user's role on success, none on a bad username or password
    """
    conn = get_db()
    row = conn.execute(
        "SELECT password_hash, salt, role FROM users WHERE username = ?", (username,)
    ).fetchone()
    conn.close()
    if not row or not verify_password(password, row["salt"], row["password_hash"]):
        return None
    return row["role"]


def create_session(username, role):
    """opens a new login session.
    @param username the logging-in user
    @param role "student" or "ta"
    @return the new session token
    """
    token = generate_token()
    conn = get_db()
    conn.execute(
        "INSERT INTO sessions (token, username, role, expires_at) VALUES (?, ?, ?, ?)",
        (token, username, role, int(time.time()) + _idle_seconds(role)),
    )
    conn.commit()
    conn.close()
    return token


def get_session(token):
    """looks up a session token, sliding its expiry forward on every valid
    call, so using the portal (or just having it open) keeps you logged in.
    @param token the bearer token to check
    @return the {username, role} row for the token, or none if it's missing or idle-expired
    """
    now = int(time.time())
    conn = get_db()
    row = conn.execute(
        "SELECT username, role, expires_at FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    if not row or not row["expires_at"] or row["expires_at"] < now:
        if row:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()
        conn.close()
        return None
    conn.execute(
        "UPDATE sessions SET expires_at = ? WHERE token = ?",
        (now + _idle_seconds(row["role"]), token),
    )
    conn.commit()
    conn.close()
    return {"username": row["username"], "role": row["role"]}


def list_users():
    """lists every account. hashes never leave the db and ta passwords have
    no plain copy at all.
    @return a list of {username, role, password} rows (password is null for tas)
    """
    conn = get_db()
    rows = conn.execute("SELECT username, role, plain FROM users ORDER BY username").fetchall()
    conn.close()
    return [{"username": r["username"], "role": r["role"], "password": r["plain"]} for r in rows]


def create_user(username, password, role):
    """creates a new account.
    @param username the new account's username
    @param password the new account's plaintext password
    @param role "student" or "ta"
    @return false if the username is already taken
    """
    password_hash, salt = hash_password(password)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (username, password_hash, salt, role, plain) VALUES (?, ?, ?, ?, ?)",
            (username, password_hash, salt, role, password if role == "student" else None),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        # username taken (unique constraint)
        conn.close()
        return False
    conn.close()
    return True


def set_user_password(username, password):
    """changes an existing account's password (a ta's own, or anyone
    else's, both go through this same function, see api_change_password()).
    @param username the account to update
    @param password the new plaintext password
    @return false if no such user
    """
    conn = get_db()
    row = conn.execute("SELECT role FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        conn.close()
        return False
    password_hash, salt = hash_password(password)
    # students keep a plain copy (ta-issued handout credentials), tas don't, same rule create_user() uses
    plain = password if row["role"] == "student" else None
    conn.execute(
        "UPDATE users SET password_hash = ?, salt = ?, plain = ? WHERE username = ?",
        (password_hash, salt, plain, username),
    )
    conn.commit()
    conn.close()
    return True


def delete_user(username):
    """removes an account and any login tokens it had.
    @param username the account to remove
    @return false if no such user
    """
    conn = get_db()
    cur = conn.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.execute("DELETE FROM sessions WHERE username = ?", (username,))
    conn.commit()
    conn.close()
    return cur.rowcount > 0


def _seed_content(conn):
    """inserts DEFAULT_CONTENT if the content row doesn't exist yet.
    @param conn an open db connection
    """
    if conn.execute("SELECT 1 FROM content WHERE id = 1").fetchone():
        return
    conn.execute(
        "INSERT INTO content (id, data) VALUES (1, ?)", (json.dumps(DEFAULT_CONTENT),)
    )
    conn.commit()


def _seed_default_profile(conn):
    """inserts the shared, read-only DEFAULT_PROFILE_NAME profile holding
    DEFAULT_CONTENT (the site exactly as it looks out of the box), once, ever,
    tracked by the meta table (not by "the profiles table is empty", which
    would reseed a fresh one behind anybody who clears this row out of the db
    by hand, undoing a removal that's supposed to stick - no ta can delete it
    through the portal any more, see api_delete_profile() in app/main.py).
    Claims the meta flag with INSERT OR IGNORE first and checks rowcount,
    rather than a separate SELECT-then-INSERT: a dev server can restart
    twice in quick succession (eg two --reload events off one save), and a
    check-then-act gap would let both processes see "not seeded yet" and
    both insert, duplicating the profile. The meta table's key is a PRIMARY
    KEY, so only one INSERT OR IGNORE across any number of racing
    processes actually inserts a row; sqlite serializes the writes, so
    rowcount reliably tells this call whether it's the one that won.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('default_profile_seeded', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return
    conn.execute(
        "INSERT INTO profiles (owner, name, data, shared, is_default)"
        " VALUES (?, ?, ?, 1, 1)",
        ("system", DEFAULT_PROFILE_NAME, json.dumps(DEFAULT_CONTENT)),
    )
    conn.commit()


def _migrate_default_profile_name(conn):
    """renames an existing db's seeded profile from the old bare "Default" to
    DEFAULT_PROFILE_NAME.

    Unconditional and unflagged, unlike the migrations below: this row's name
    is not something anyone can have changed - api_update_profile() in
    app/main.py 403s every field on is_default - so there is no ta wording here
    to preserve, and no need for a meta flag to stop it running twice. Written
    against is_default rather than the old name so it keeps working if
    DEFAULT_PROFILE_NAME changes again later.
    @param conn an open db connection
    """
    conn.execute(
        "UPDATE profiles SET name = ? WHERE is_default = 1 AND name != ?",
        (DEFAULT_PROFILE_NAME, DEFAULT_PROFILE_NAME),
    )
    conn.commit()


def _unshare_seeded_last_applied(conn):
    """retires the single shared "Most recently applied" profile that used to
    be seeded for the whole site (owner "system", shared=1).

    There is one of these per ta now, private to them, created on their first
    Apply and holding what THEY applied - see snapshot_last_applied() for why
    the shared one couldn't do the job it existed for. The old row is only
    unshared, never deleted: it still holds a real snapshot of live content
    from before the change, and a migration that throws away a recovery
    profile would be exactly the kind of loss this whole feature is for. Once
    unshared it belongs to "system", which is not a ta anyone logs in as, so
    it simply stops appearing in every ta's list.
    @param conn an open db connection
    """
    conn.execute(
        "UPDATE profiles SET shared = 0 WHERE is_last_applied = 1 AND owner = 'system'"
    )
    conn.commit()


def _seed_default_objects(conn):
    """inserts the starter Objects library (DEFAULT_OBJECTS) exactly once,
    ever, same one-time meta-flag trick as _seed_default_profile(): a ta who
    deletes every seeded object shouldn't see them reappear on the server's
    next restart.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('default_objects_seeded', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return
    # "Countdown timer"'s datetime part carries no fixed target in
    # DEFAULT_OBJECTS itself (a hardcoded date would eventually sit in the
    # past); fill in 30 days out from right now, the same ballpark the ta
    # portal's own hero countdown starts from, at the moment this actually
    # seeds rather than at module-import time.
    default_target = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    for obj in DEFAULT_OBJECTS:
        data = obj["data"]
        if obj["name"] == "Countdown timer":
            data = json.loads(json.dumps(data))  # deep copy, don't mutate the shared module-level default
            for part in data["custom_elements"]:
                if part.get("kind") == "datetime":
                    part["target"] = default_target
        conn.execute(
            "INSERT INTO objects (owner, name, data) VALUES (?, ?, ?)",
            ("system", obj["name"], json.dumps(data)),
        )
    conn.commit()


def _migrate_learn_reel(conn):
    """one-time patch (same meta-flag trick as _seed_default_objects()) that
    adds the "What You'll Learn" reel (see _learn_reel_overlay()) to every
    already-existing content blob that predates it - the live content row
    AND every saved profile - so an old profile applied after this ships
    doesn't render a blank gap where the reel used to sit (its hardcoded
    markup is gone from templates/index.html now, replaced by the "reel"
    custom-element kind in js/main.js). A brand-new db never needs this:
    DEFAULT_CONTENT already carries the reel, so _seed_content() bakes it in
    directly.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('learn_reel_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        ids = [c.get("id") for c in data.get("custom_elements", [])]
        if "learn.reel" in ids:
            return data, False
        data.setdefault("custom_elements", []).append(json.loads(json.dumps(_LEARN_REEL_ENTRY)))
        data.setdefault("text", {}).update(_LEARN_REEL_TEXT)
        data.setdefault("font_sizes", {}).update(_LEARN_REEL_FONT_SIZES)
        data.setdefault("text_styles", {}).update(_LEARN_REEL_TEXT_STYLES)
        data.setdefault("colors", {}).update(_LEARN_REEL_COLORS)
        return data, True

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_dashboard_progress(conn):
    """one-time patch (same meta-flag trick as _migrate_learn_reel()) adding
    the migrated dashboard progress-bar element (_DASH_PROGRESS_ENTRY) and
    the two builtin variables to every already-existing content blob/profile
    that predates them. Needed for the same reason _migrate_learn_reel() is:
    the old hardcoded #progFill/#progLabel markup this replaces is gone from
    templates/dashboard.html now, so an old blob applied after this ships
    needs the replacement patched in rather than just rendering nothing.
    get_content()'s generic per-key backfill can't do this on its own since
    "custom_elements" already exists as a key in an old blob (just without
    this particular entry), the same reason _migrate_learn_reel() exists.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('dashboard_progress_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        changed = False
        if "variables" not in data:
            data["variables"] = json.loads(json.dumps(DEFAULT_CONTENT["variables"]))
            changed = True
        ids = [c.get("id") for c in data.get("custom_elements", [])]
        if "seed.dashboard.progress" not in ids:
            data.setdefault("custom_elements", []).append(json.loads(json.dumps(_DASH_PROGRESS_ENTRY)))
            data.setdefault("progress_fill", {})["seed.dashboard.progress"] = "var(--accent)"
            data.setdefault("progress_track", {})["seed.dashboard.progress"] = "var(--surface-2)"
            data.setdefault("radius", {})["seed.dashboard.progress"] = 999
            changed = True
        return data, changed

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_dashboard_extras_area(conn):
    """one-time patch (same meta-flag trick as _migrate_learn_reel()) adding
    the migrated "extrasArea" element (_DASH_EXTRAS_AREA_ENTRY) to every
    already-existing content blob/profile that predates it, same reasoning
    as _migrate_dashboard_progress(): the old static #resList markup this
    replaces needs the anchor spacer already in templates/dashboard.html,
    but an old saved blob still needs this element patched into its own
    custom_elements list to actually render anything into that spacer.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('dashboard_extras_area_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        ids = [c.get("id") for c in data.get("custom_elements", [])]
        if "seed.dashboard.extras.area" in ids:
            return data, False
        data.setdefault("custom_elements", []).append(json.loads(json.dumps(_DASH_EXTRAS_AREA_ENTRY)))
        return data, True

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_dashboard_days_area(conn):
    """one-time patch (same meta-flag trick as _migrate_dashboard_extras_area())
    adding the migrated "daysArea" element (_DASH_DAYS_AREA_ENTRY) to every
    already-existing content blob/profile that predates it, same reasoning:
    the old static #dayGrid markup this replaces needs the anchor spacer
    already in templates/dashboard.html, but an old saved blob still needs
    this element patched into its own custom_elements list to actually
    render anything into that spacer.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('dashboard_days_area_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        ids = [c.get("id") for c in data.get("custom_elements", [])]
        if "seed.dashboard.days.area" in ids:
            return data, False
        data.setdefault("custom_elements", []).append(json.loads(json.dumps(_DASH_DAYS_AREA_ENTRY)))
        return data, True

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_gallery_page(conn):
    """one-time patch (same meta-flag trick as _migrate_login_page() below)
    adding the five migrated gallery-page elements (_GALLERY_ENTRIES) plus the
    arrow markup, arrow links and default arrow/counter styling to every
    already-existing content blob/profile that predates them. Needed for the
    same reason the login one is: the static viewer markup these replace is
    gone from templates/gallery.html, so an old saved blob that only has the
    anchor spacers would render a gallery page with no rail, no photo, no
    arrows and no counter at all.

    Entries already present (by id) are skipped one by one rather than the
    whole patch being skipped on the first hit, so a blob that somehow has only
    some of them still ends up complete. The text/links/colors/radius defaults
    are only filled in where the blob has nothing of its own - a ta who already
    restyled one of these on a newer db must not have it reset.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('gallery_page_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        changed = False
        ids = [c.get("id") for c in data.get("custom_elements", [])]
        for entry in _GALLERY_ENTRIES:
            if entry["id"] in ids:
                continue
            data.setdefault("custom_elements", []).append(json.loads(json.dumps(entry)))
            changed = True
        for key, value in (("seed.gallery.prev", _GALLERY_PREV_SVG),
                           ("seed.gallery.next", _GALLERY_NEXT_SVG),
                           ("seed.gallery.count", _GALLERY_COUNT_HTML)):
            if data.setdefault("text", {}).get(key) is None:
                data["text"][key] = value
                changed = True
        for target, defaults in ((data.setdefault("links", {}), _GALLERY_LINKS),
                                 (data.setdefault("colors", {}), _GALLERY_COLORS),
                                 (data.setdefault("dark_colors", {}), _GALLERY_COLORS),
                                 (data.setdefault("radius", {}), _GALLERY_RADIUS),
                                 (data.setdefault("fill", {}), _GALLERY_FILL),
                                 (data.setdefault("dark_fill", {}), _GALLERY_FILL),
                                 (data.setdefault("text_styles", {}), _GALLERY_TEXT_STYLES)):
            for key, value in defaults.items():
                if target.get(key) is None:
                    target[key] = value
                    changed = True
        return data, changed

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_login_page(conn):
    """one-time patch (same meta-flag trick as _migrate_dashboard_days_area())
    adding the four migrated login-page elements (_LOGIN_ENTRIES) and their
    default corner rounding to every already-existing content blob/profile
    that predates them, same reasoning: the static form markup they replace is
    gone from templates/login.html, so an old saved blob that only has the
    anchor spacers would render a login page with no fields, no button and no
    error line at all.

    Entries already present (by id) are skipped one by one rather than the
    whole patch being skipped on the first hit, so a blob that somehow has
    only some of them still ends up complete.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('login_page_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        ids = [c.get("id") for c in data.get("custom_elements", [])]
        changed = False
        for entry in _LOGIN_ENTRIES:
            if entry["id"] in ids:
                continue
            data.setdefault("custom_elements", []).append(json.loads(json.dumps(entry)))
            changed = True
        radius = data.setdefault("radius", {})
        for box_id in ("seed.login.field.username.box", "seed.login.field.password.box"):
            if box_id not in radius:
                radius[box_id] = 10
                changed = True
        return data, changed

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_landing_nav_states(conn):
    """one-time patch (same meta-flag trick as _migrate_login_page() above)
    promoting the landing page's new signed-in navbar to "fixed" in every
    already-existing content blob/profile, the way the signed-out one has
    always been.

    Nothing else needs migrating: the signed-out navbar kept every id it had,
    so every override a ta already saved still lands on it, and the signed-in
    one is brand new markup with brand new ids that simply has no saved
    overrides yet. Only the fixed-element defaults are a stored list rather
    than a fallback, so only they have to be topped up.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('landing_nav_states', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        fixed = data.get("fixed_elements")
        if not isinstance(fixed, list):
            return data, False
        missing = [i for i in _NAV_IN_FIXED_IDS if i not in fixed]
        if not missing:
            return data, False
        fixed.extend(missing)
        return data, True

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


# ids the two credential boxes used to stamp on their own "Username"/
# "Password" captions, back when the caption was built as part of the
# loginField element, mapped to the plain data-edit-id the caption carries now
# that it's ordinary markup in templates/login.html. A caption has no
# functionality beyond being a line of text, so it had no business inheriting
# a page-exclusive element kind's special handling.
_LOGIN_LABEL_RENAMES = {
    "seed.login.field.username.label": "login.label.username",
    "seed.login.field.password.label": "login.label.password",
}


def _migrate_login_labels(conn):
    """one-time patch (same meta-flag trick as _migrate_login_page() above)
    carrying any saved edit to a credential box's caption over to the caption's
    new id, so a ta who had already reworded, restyled, moved or deleted one
    still sees their own version rather than a reset "Username".

    Renames rather than copies, and does it generically across every id-keyed
    map and every id list in the blob (content.text, .font_sizes, .colors,
    .sizes, .positions, .hidden, .layer_order, ...) instead of naming each one:
    an override left behind under a dead id is invisible junk no page can ever
    reach again, and the list of maps an element id can appear in only grows.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('login_labels_split', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        changed = False
        for value in data.values():
            if isinstance(value, dict):
                for old, new in _LOGIN_LABEL_RENAMES.items():
                    if old in value and new not in value:
                        value[new] = value.pop(old)
                        changed = True
            elif isinstance(value, list):
                for i, item in enumerate(value):
                    if isinstance(item, str) and item in _LOGIN_LABEL_RENAMES:
                        value[i] = _LOGIN_LABEL_RENAMES[item]
                        changed = True
        return data, changed

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


# ids that predate the "page" field (see buildCustomElement()/
# renderCustomElements() in js/main.js) mapped to the page they actually
# belong to - every entry that exists before this migration ships is one of
# these; any future entry that's somehow still missing "page" falls back to
# "index", the only page with a fully working "Add element" menu before this
# fix shipped.
_CUSTOM_ELEMENT_PAGE_BY_ID = {
    "learn.reel": "index",
    "seed.dashboard.progress": "dashboard",
    "seed.dashboard.extras.area": "dashboard",
    "seed.dashboard.days.area": "dashboard",
}


def _migrate_custom_elements_page_scope(conn):
    """one-time patch (same meta-flag trick as _migrate_learn_reel()) stamping
    a "page" field ("index"/"dashboard"/"gallery") onto every existing
    custom_elements entry that predates it. Without this, js/main.js's
    renderCustomElements() had no way to tell a landing-page-only element (eg
    the "What You'll Learn" reel) from a dashboard-only one (eg the progress
    bar), so EVERY custom element - anchored or freely placed - got built on
    EVERY page that runs the shared editor pipeline: the reel rendered on the
    student dashboard too, at its raw landing-page pixel offset, which on a
    shorter page landed it far below the real content instead of nowhere.
    See renderCustomElements()'s page filter and addCustomElement()'s "page"
    stamping in js/main.js, the other half of this fix.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('custom_elements_page_scope_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        changed = False
        for c in data.get("custom_elements", []):
            if not c.get("page"):
                c["page"] = _CUSTOM_ELEMENT_PAGE_BY_ID.get(c.get("id"), "index")
                changed = True
        return data, changed

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_progress_bar_object(conn):
    """one-time patch (same meta-flag trick as _migrate_learn_reel()) adding
    the "Progress bar" entry to an already-existing Objects library that
    predates it. _seed_default_objects() only ever runs once, the very
    first time the objects table is created, so a db that already existed
    before this feature shipped would otherwise never get the new seed
    object at all - unlike DEFAULT_CONTENT's per-key backfill (get_content()),
    there's no generic "fill in a missing library entry" mechanism for the
    objects table, so this has to walk DEFAULT_OBJECTS itself.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('progress_bar_object_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return
    existing_names = {r["name"] for r in conn.execute("SELECT name FROM objects").fetchall()}
    for obj in DEFAULT_OBJECTS:
        if obj["name"] == "Progress bar" and obj["name"] not in existing_names:
            conn.execute(
                "INSERT INTO objects (owner, name, data) VALUES (?, ?, ?)",
                ("system", obj["name"], json.dumps(obj["data"])),
            )
    conn.commit()


def _migrate_apply_tooltip(conn):
    """one-time patch (same meta-flag trick as _migrate_learn_reel()) folding
    the old content.apply_tooltip - one string shared by the three landing-page
    Apply Now buttons, edited from a form field in the content manager - into
    an ordinary per-element tooltip on each of those buttons, then dropping the
    key.

    That field only ever existed because a tooltip has no element in the visual
    editor to right-click: it doesn't exist until someone is hovering. Every
    element can carry its own tooltip now (content.tooltips, see the ELEMENT
    TOOLTIPS section in js/main.js), so those three buttons are edited where the
    rest of that page is.

    get_content()'s generic per-key backfill hands an old blob the seeded
    default (DEFAULT_CONTENT["tooltips"]) on its own, but that's the DEFAULT
    wording - this is what carries a ta's own across. Anything they've since
    written on one of those buttons in the editor wins: only ids with no
    tooltip yet get the old string.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('apply_tooltip_migrated', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return

    def patch(data):
        if "apply_tooltip" not in data:
            return data, False
        text = data.pop("apply_tooltip")
        tooltips = data.setdefault("tooltips", {})
        if text:
            for tip_id in _APPLY_TOOLTIP_IDS:
                if not tooltips.get(tip_id):
                    tooltips[tip_id] = {"text": text, "pos": "bottom"}
        return data, True

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


def _migrate_drop_variable_page_scope(conn):
    """one-time patch (same meta-flag trick as _migrate_learn_reel()) undoing a
    short-lived experiment that stamped a "page" onto content.variables so the
    editor's pickers would only offer a variable on the page it was about.

    That was the wrong split. A variable in the content manager is public by
    definition - a ta types it there so the site can use it, and hiding it on
    four pages out of five is just a variable they can't bind. What's actually
    page-private (the gallery's per-pane image counters) was never stored here
    in the first place, see pageLocalVariables() in js/main.js. So the field
    means nothing now, and this strips it back out rather than leaving dead
    keys in the blob for the next reader to puzzle over.
    @param conn an open db connection
    """
    cur = conn.execute(
        "INSERT OR IGNORE INTO meta (key, value) VALUES ('variable_page_scope_dropped', '1')"
    )
    conn.commit()
    if cur.rowcount == 0:
        return
    # the flag from the migration this one reverses: dropped too, so a later
    # scope migration (if the idea ever comes back in a better shape) isn't
    # silently skipped by a leftover "already done"
    conn.execute("DELETE FROM meta WHERE key = 'variable_page_scope_migrated'")

    def patch(data):
        changed = False
        for v in data.get("variables", []):
            if "page" in v:
                del v["page"]
                changed = True
        return data, changed

    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    if row:
        data, changed = patch(json.loads(row["data"]))
        if changed:
            conn.execute("UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),))

    for prow in conn.execute("SELECT id, data FROM profiles").fetchall():
        data, changed = patch(json.loads(prow["data"]))
        if changed:
            conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), prow["id"]))

    conn.commit()


# characters that would break the visual editor's {Name}/{Name:flags} inline
# notation if they turned up in a variable's own "name": "{"/"}" are the
# notation's own delimiters, ":" separates the identifier from its format
# flags, and whitespace would make a bare identifier ambiguous right next to
# a trailing :flag. See parseVariableTokens() in js/main.js.
_VAR_NAME_INVALID_CHARS = re.compile(r"[{}:\s]")


def _sanitize_variable_name(name):
    """Strips characters a variable's "name" isn't allowed to contain (see
    _VAR_NAME_INVALID_CHARS) rather than rejecting the save outright - same
    "never let bad input take the whole save down" stance as everything else
    in this file, and it keeps a ta's typing moving instead of bouncing them
    with a validation error mid-rename.
    @param name a variable's ta-typed "name", any type (coerced to str)
    @return name with every "{", "}", ":" and whitespace character removed
    """
    return _VAR_NAME_INVALID_CHARS.sub("", str(name if name is not None else ""))


def _sanitize_variable_names(data):
    """Applies _sanitize_variable_name() to every variable in `data`, in
    place. Run on every read AND write (get_content()/save_content()) rather
    than as a one-time migration: a ta's own browser already strips these
    live as they type (see js/ta.js's renderVariables()), but this is the
    actual source of truth a formula/typed {Name} reference resolves
    against, so it self-heals here too - a hand-edited profile, an old save
    from before this rule existed, or any other way a bad character could
    reach this table without going through that input.
    @param data a content dict (mutated in place)
    """
    for v in data.get("variables", []):
        if "name" in v:
            v["name"] = _sanitize_variable_name(v["name"])


def _refresh_computed_variables(data):
    """recalculates every "computed" variable's value in place off the rest
    of `data`, so it's always derived fresh rather than trusting whatever a
    ta's browser last saved (a computed variable has no editable value input
    at all, see the Variables section in js/ta.js, but the array it lives in
    still round-trips through the client on every load/apply like everything
    else in the content blob).
    Only one computed variable exists right now (days_progressed - the count
    of unlocked days, same number js/dashboard.js's old renderProgress() used
    to compute client-side as `unlockedCount`); this stays a small if-chain
    on `key` rather than a registry since there's only the one.
    @param data a content dict (mutated in place)
    """
    for v in data.get("variables", []):
        if not v.get("computed"):
            continue
        if v.get("key") == "days_progressed":
            v["value"] = sum(1 for d in data.get("days", []) if d.get("unlocked"))


def get_content():
    """reads the live ta-editable content blob.
    @return the content dict, with any keys missing from an older save filled in from DEFAULT_CONTENT
    """
    conn = get_db()
    row = conn.execute("SELECT data FROM content WHERE id = 1").fetchone()
    conn.close()
    if not row:
        return DEFAULT_CONTENT
    data = json.loads(row["data"])
    # blobs saved before a key existed (gallery, tooltips, ...) come
    # back without it, fill those in from the defaults so the frontend
    # always sees the full shape
    for key, value in DEFAULT_CONTENT.items():
        data.setdefault(key, value)
    _backfill_extras_ids(data)
    _backfill_days_ids(data)
    _backfill_days_display(data)
    _backfill_gallery_video(data)
    _sanitize_variable_names(data)
    _refresh_computed_variables(data)
    return data


def _backfill_gallery_video(data):
    """fills in the gallery's video playback settings for a blob saved before
    they existed. the top-level setdefault() loop above can't reach these:
    such a blob already HAS a "gallery" key, so the whole default gallery
    (settings included) is skipped over. each flag is defaulted on its own,
    to how the gallery has always behaved - clips start on their own, with no
    player chrome and no click-to-pause.
    @param data the content dict being read (mutated in place)
    """
    gallery = data.get("gallery")
    if not isinstance(gallery, dict):
        return
    video = gallery.get("video")
    if not isinstance(video, dict):
        video = {}
    gallery["video"] = {
        "autoplay": video.get("autoplay", True) is not False,
        "controls": bool(video.get("controls")),
        "pausable": bool(video.get("pausable")),
    }
    # per-clip overrides (see DEFAULT_CONTENT["gallery"]). Deliberately NOT
    # backfilled per clip: a blob from before these existed has no entries, and
    # every clip in it correctly resolves to the gallery-wide "video" above, so
    # it keeps playing exactly as it did until a ta changes one. Writing an
    # entry per clip here instead would freeze today's baseline onto every
    # existing clip and be wrong the moment anything is added.
    if not isinstance(gallery.get("video_opts"), dict):
        gallery["video_opts"] = {}


def _backfill_days_display(data):
    """fills in the day grid's tile-count settings for a blob saved before they
    existed, or one where a hand-edit left a field missing or nonsensical. The
    top-level setdefault() loop in get_content() can't be relied on for the
    individual fields - a blob that already HAS a "days_display" key skips the
    whole default - so each is defaulted on its own, same reasoning and shape
    as _backfill_gallery_video() below. A saved 0 is a real answer ("no floor" /
    "no teasers") and survives; anything negative or non-numeric doesn't.
    @param data the content dict being read (mutated in place)
    """
    conf = data.get("days_display")
    if not isinstance(conf, dict):
        conf = {}
    out = {}
    for key, fallback in DEFAULT_CONTENT["days_display"].items():
        try:
            value = int(conf.get(key))
        except (TypeError, ValueError):
            value = fallback
        out[key] = max(0, value)
    data["days_display"] = out


def _backfill_extras_ids(data):
    """assigns a stable id (and empty children list) to any extras entry
    that predates the tile-binding feature, so js/main.js's attachments-tile
    area has something durable to bind dropped elements to. legacy plain-
    string entries are left alone - nothing binds elements to those.
    @param data the content dict being read (mutated in place)
    """
    for item in data.get("extras", []):
        if isinstance(item, dict):
            item.setdefault("id", uuid.uuid4().hex)
            item.setdefault("children", [])


def _backfill_days_ids(data):
    """assigns a stable id (and empty children list) to any days entry that
    predates the day-tile-binding feature, same reasoning/shape as
    _backfill_extras_ids() just above - js/main.js's day-tile area needs
    something durable to bind dropped elements to that survives a day being
    reordered/removed, which a plain array index wouldn't.
    @param data the content dict being read (mutated in place)
    """
    for item in data.get("days", []):
        if isinstance(item, dict):
            item.setdefault("id", uuid.uuid4().hex)
            item.setdefault("children", [])


def save_content(data):
    """overwrites the live content blob.
    @param data the full content dict to save
    """
    # re-derive computed variables before persisting, not just on read: a ta
    # who toggles a day's unlock state and immediately hits Apply in the same
    # session would otherwise save whatever stale days_progressed value their
    # browser last fetched, only self-correcting on the next GET.
    _sanitize_variable_names(data)
    _refresh_computed_variables(data)
    # same on the way in as on the way out: a ta's browser is the only thing
    # that writes these two counts, so a stale tab or an imported profile is
    # exactly the case that would otherwise persist a negative/absent one
    _backfill_days_display(data)
    conn = get_db()
    conn.execute(
        "UPDATE content SET data = ? WHERE id = 1", (json.dumps(data),)
    )
    conn.commit()
    conn.close()


def list_profiles(username):
    """lists a ta's saved content drafts.
    @param username the requesting ta
    @return that ta's own profiles plus anything another ta has shared
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT id, owner, name, data, shared, is_default, is_last_applied FROM profiles"
        " WHERE owner = ? OR shared = 1 ORDER BY id",
        (username,),
    ).fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "owner": r["owner"],
            "name": r["name"],
            "shared": bool(r["shared"]),
            "is_default": bool(r["is_default"]),
            "is_last_applied": bool(r["is_last_applied"]),
            "mine": r["owner"] == username,
            "data": json.loads(r["data"]),
        }
        for r in rows
    ]


def get_profile(profile_id):
    """looks up one profile.
    @param profile_id the profile's id
    @return the profile row, or none if it doesn't exist
    """
    conn = get_db()
    row = conn.execute(
        "SELECT id, owner, name, data, shared, is_default, is_last_applied FROM profiles WHERE id = ?",
        (profile_id,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "id": row["id"],
        "owner": row["owner"],
        "name": row["name"],
        "shared": bool(row["shared"]),
        "is_default": bool(row["is_default"]),
        "is_last_applied": bool(row["is_last_applied"]),
        "data": json.loads(row["data"]),
    }


def snapshot_last_applied(owner, data):
    """overwrites one ta's "Most recently applied" profile with the content
    they just applied, creating it on their first ever Apply.

    ONE PER TA, PRIVATE TO THEM, holding what THEY applied. All three of
    those matter, and none of them were true at first: there used to be a
    single shared row (owner "system", shared=1) holding the OUTGOING live
    content, whatever it was and whoever had put it there.

    Two tas editing at once clobber each other - the last Apply wins, there
    is no merge - and the point of this profile is to get your own work back
    afterward. The shared version couldn't do that reliably. If you apply and
    someone else applies straight after, the one row now holds YOUR content
    (it was the outgoing blob when they applied), so you're fine; but a third
    apply overwrites it with theirs and yours is gone, and meanwhile every
    other ta is looking at a "Most recently applied" that has nothing to do
    with anything they did. Keyed to the ta who applied, holding what they
    sent, it's simply their own last Apply, safe from anyone else's.
    @param owner the ta applying the changes
    @param data the content dict being applied
    @return nothing
    """
    conn = get_db()
    blob = json.dumps(data)
    cur = conn.execute(
        "UPDATE profiles SET data = ? WHERE is_last_applied = 1 AND owner = ?",
        (blob, owner),
    )
    # created lazily on first Apply rather than seeded per ta at signup: a ta
    # who has never applied anything has nothing to recover, and an empty
    # "Most recently applied" sitting in their list would be a restore button
    # that silently reverts the site to whatever the defaults were.
    if cur.rowcount == 0:
        conn.execute(
            "INSERT INTO profiles (owner, name, data, shared, is_last_applied)"
            " VALUES (?, ?, ?, 0, 1)",
            (owner, "Most recently applied", blob),
        )
    conn.commit()
    conn.close()


def create_profile(owner, name, data):
    """saves a new profile.
    @param owner the ta creating it
    @param name the profile's display name
    @param data the content dict to save as this profile's draft
    @return the new profile's id
    """
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO profiles (owner, name, data) VALUES (?, ?, ?)",
        (owner, name, json.dumps(data)),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def update_profile(profile_id, name=None, data=None, shared=None):
    """partially updates a profile; omitted fields are left unchanged.
    @param profile_id the profile to update
    @param name new display name, if renaming
    @param data new content dict, if saving edits
    @param shared new shared flag, if toggling sharing
    """
    conn = get_db()
    if name is not None:
        conn.execute("UPDATE profiles SET name = ? WHERE id = ?", (name, profile_id))
    if data is not None:
        conn.execute("UPDATE profiles SET data = ? WHERE id = ?", (json.dumps(data), profile_id))
    if shared is not None:
        conn.execute("UPDATE profiles SET shared = ? WHERE id = ?", (1 if shared else 0, profile_id))
    conn.commit()
    conn.close()


def delete_profile(profile_id):
    """deletes a profile.
    @param profile_id the profile to delete
    """
    conn = get_db()
    conn.execute("DELETE FROM profiles WHERE id = ?", (profile_id,))
    conn.commit()
    conn.close()


def list_custom_assets(kind):
    """lists every ta-uploaded asset of one kind, shared with every ta.
    @param kind "icon", "video", or "font"
    @return a list of {id, owner, name, url} rows
    """
    conn = get_db()
    rows = conn.execute(
        "SELECT id, owner, name, url FROM custom_assets WHERE kind = ? ORDER BY id",
        (kind,),
    ).fetchall()
    conn.close()
    return [{"id": r["id"], "owner": r["owner"], "name": r["name"], "url": r["url"]} for r in rows]


def create_custom_asset(kind, owner, name, url):
    """adds one ta-uploaded asset, visible to every ta immediately.
    @param kind "icon", "video", or "font"
    @param owner the uploading ta's username
    @param name display name
    @param url the already-uploaded file's url (see /api/upload)
    @return the new asset's id
    """
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO custom_assets (kind, owner, name, url) VALUES (?, ?, ?, ?)",
        (kind, owner, name, url),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def get_custom_asset(asset_id):
    """looks up one custom asset.
    @param asset_id the asset's id
    @return the asset row ({id, kind, owner, name, url}), or none if it doesn't exist
    """
    conn = get_db()
    row = conn.execute(
        "SELECT id, kind, owner, name, url FROM custom_assets WHERE id = ?", (asset_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row["id"], "kind": row["kind"], "owner": row["owner"], "name": row["name"], "url": row["url"]}


def delete_custom_asset(asset_id):
    """deletes a ta-uploaded asset.
    @param asset_id the asset to delete
    """
    conn = get_db()
    conn.execute("DELETE FROM custom_assets WHERE id = ?", (asset_id,))
    conn.commit()
    conn.close()


def list_objects():
    """lists every saved object in the shared reusable-objects library.
    @return a list of {id, owner, name, data} rows
    """
    conn = get_db()
    rows = conn.execute("SELECT id, owner, name, data FROM objects ORDER BY id").fetchall()
    conn.close()
    return [
        {"id": r["id"], "owner": r["owner"], "name": r["name"], "data": json.loads(r["data"])}
        for r in rows
    ]


def get_object(object_id):
    """looks up one saved object.
    @param object_id the object's id
    @return the object row, or none if it doesn't exist
    """
    conn = get_db()
    row = conn.execute(
        "SELECT id, owner, name, data FROM objects WHERE id = ?", (object_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {"id": row["id"], "owner": row["owner"], "name": row["name"], "data": json.loads(row["data"])}


def create_object(owner, name, data):
    """saves a new object to the shared library.
    @param owner the ta creating it
    @param name display name
    @param data the object's bundle (custom_elements + per-id override maps,
        same shape a chunk of content would use, see placeObject() in js/main.js)
    @return the new object's id
    """
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO objects (owner, name, data) VALUES (?, ?, ?)",
        (owner, name, json.dumps(data)),
    )
    conn.commit()
    conn.close()
    return cur.lastrowid


def update_object(object_id, name=None, data=None):
    """partially updates an object; omitted fields are left unchanged. any ta
    can update an object's name/data, it's a shared team library, not
    per-owner content, only deleting is owner-restricted (see
    api_delete_object() in app/main.py, same rule a custom asset uses).
    @param object_id the object to update
    @param name new display name, if renaming
    @param data new bundle, if saving edits
    """
    conn = get_db()
    if name is not None:
        conn.execute("UPDATE objects SET name = ? WHERE id = ?", (name, object_id))
    if data is not None:
        conn.execute("UPDATE objects SET data = ? WHERE id = ?", (json.dumps(data), object_id))
    conn.commit()
    conn.close()


def delete_object(object_id):
    """deletes an object from the shared library.
    @param object_id the object to delete
    """
    conn = get_db()
    conn.execute("DELETE FROM objects WHERE id = ?", (object_id,))
    conn.commit()
    conn.close()
