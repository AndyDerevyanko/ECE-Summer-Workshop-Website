// landing page countdown

//placeholder for now
function setCountdown() {
  var ids = ["cd-d", "cd-h", "cd-m", "cd-s"];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.textContent = "99";
  }
}

document.addEventListener("DOMContentLoaded", setCountdown);
