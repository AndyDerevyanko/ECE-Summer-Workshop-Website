/* gallery viewer, one photo or clip at a time */
/* media lists are hardcoded like everything else on this site */
/* order: group photo first, robot clips, then the rest */

var PHOTOS = {
  "2026": [
    "group-main-2026.png",
    "robots-moving.MOV",
    "robot-moving.MOV",
    "alumni-conference.png",
    "class-2.jpeg",
    "class-3.jpeg",
    "class-4.jpeg",
    "class-5.jpeg",
    "class-closeup-2.jpeg",
    "class-closeup-3.jpeg",
    "class-closeup-4.jpeg",
    "class-closeup.jpeg",
    "class.png",
    "group-main-alt-2.jpeg",
    "group-main-alt-3.jpeg",
    "group-main-alt-4.jpeg",
    "group-main-alt-5.jpeg",
    "group-main-alt.jpeg",
    "hamid-2.png",
    "hamid-3.png",
    "hamid-4.png",
    "hamid-5.png",
    "hamid-6.png",
    "hamid.png",
    "people-2.png",
    "people-looking.png",
    "people-track.JPG",
    "people.png",
    "prizes-1.png",
    "prizes-2.png",
    "prizes-3.png",
    "prizes-4.png",
    "prizes-5.png",
    "prizes-6.png",
    "prizes-7.png",
    "prizes-8.png",
    "prizes-9.png",
    "prizes-10.png",
    "random.jpeg",
    "robot-closeup-2.png",
    "robot-closeup-3.png",
    "robot-closeup-4.png",
    "robot-closeup-5.png",
    "robot-closeup.png",
    "robot-on-track-2.png",
    "robot-on-track-3.png",
    "robot-on-track-closeup.png",
    "robot-on-track.png",
    "robot-super-closeup.png",
    "seraj.png",
    "track-2.png",
    "track-3.png",
    "track-far-shot-2.JPG",
    "track-far-shot.png",
    "track-from-far-2.png",
    "track-from-far.png",
    "track-photo.png",
    "wide-angle-room.png",
    "runner-up.MOV"
  ],
  "2025": [
    "group_photo_2025.jpg",
    "hand_crank_joule_thief_2025.MOV",
    "robot_in_action_2025.MOV",
    "workshop_happening_2025.jpg"
  ]
};

var year = "2026";
var idx = 0;

var img = document.getElementById("gvImg");
var vid = document.getElementById("gvVid");
var count = document.getElementById("gvCount");
var yearLbl = document.getElementById("gvYear");

function src(name) { return "assets/gallery/" + name; }
function isVid(name) { return /\.mov$/i.test(name); }

function show() {
  var list = PHOTOS[year];
  var cur = list[idx];
  if (isVid(cur)) {
    img.hidden = true;
    vid.hidden = false;
    vid.src = src(cur);
    vid.play();
  } else {
    vid.pause();
    vid.removeAttribute("src");
    vid.hidden = true;
    img.hidden = false;
    img.src = src(cur);
  }
  count.textContent = (idx + 1) + " / " + list.length;
  /* preload neighbouring photos so the arrows feel instant */
  var n = list.length;
  var nxt = list[(idx + 1) % n];
  var prv = list[(idx - 1 + n) % n];
  if (!isVid(nxt)) new Image().src = src(nxt);
  if (!isVid(prv)) new Image().src = src(prv);
}

function step(d) {
  var n = PHOTOS[year].length;
  idx = (idx + d + n) % n; /* wraps around at both ends */
  show();
}

document.getElementById("gvPrev").addEventListener("click", function () { step(-1); });
document.getElementById("gvNext").addEventListener("click", function () { step(1); });
img.addEventListener("click", function () { step(1); });
vid.addEventListener("click", function () { step(1); });

/* year rail */
var yearBtns = document.querySelectorAll(".gv-year");
for (var i = 0; i < yearBtns.length; i++) {
  yearBtns[i].addEventListener("click", function () {
    var y = this.getAttribute("data-year");
    if (y === year) return;
    year = y;
    idx = 0;
    for (var j = 0; j < yearBtns.length; j++) yearBtns[j].classList.remove("active");
    this.classList.add("active");
    yearLbl.textContent = year;
    show();
  });
}

document.addEventListener("keydown", function (e) {
  if (e.key === "ArrowLeft") step(-1);
  if (e.key === "ArrowRight") step(1);
});

show();
