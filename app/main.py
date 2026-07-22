import re
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app.db import (
    UPLOAD_DIR,
    create_profile,
    create_session,
    create_user,
    delete_profile,
    delete_user,
    get_content,
    get_profile,
    get_session,
    init_db,
    list_profiles,
    list_users,
    save_content,
    update_profile,
    verify_login,
)

BASE_DIR = Path(__file__).resolve().parent.parent

# static mount needs the dir to exist before the app starts handling requests,
# init_db() (which also makes this dir) only runs later, in lifespan startup.
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="ECE Workshops", lifespan=lifespan)


@app.middleware("http")
async def no_stale_code(request: Request, call_next):
    """makes browsers revalidate js/css on every load (etag 304s keep it
    cheap). without this there's no cache-control header at all, so a
    browser can heuristically serve a stale main.js next to a fresh
    style.css after a deploy, and the visual editor half-breaks.
    @param request the incoming request
    @param call_next the next handler in the chain
    @return the response, with no-cache set on /js and /css paths
    """
    response = await call_next(request)
    if request.url.path.startswith(("/js/", "/css/")):
        response.headers["Cache-Control"] = "no-cache"
    return response


app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

templates = Jinja2Templates(directory=BASE_DIR / "templates")


def require_ta(authorization: str | None = Header(default=None)):
    """checks the Authorization: Bearer <token> header against the sessions
    table. raises 401/403 so ta-only routes can depend on this.
    @param authorization the raw Authorization header
    @return the session's {username, role}
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not logged in.")
    session = get_session(authorization[len("Bearer "):])
    if not session:
        raise HTTPException(status_code=401, detail="Session expired, log in again.")
    if session["role"] != "ta":
        raise HTTPException(status_code=403, detail="TAs only.")
    return session


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
def api_login(payload: LoginRequest):
    """checks a login attempt and issues a session token on success.
    @param payload {username, password}
    @return {username, role, token}
    """
    role = verify_login(payload.username, payload.password)
    if role is None:
        raise HTTPException(status_code=401, detail="Wrong username or password.")
    token = create_session(payload.username, role)
    return {"username": payload.username, "role": role, "token": token}


@app.get("/api/content")
def api_get_content():
    """returns the live ta-editable content blob. public, no login needed.
    @return the content dict
    """
    return get_content()


@app.post("/api/content")
def api_save_content(payload: dict[str, Any], _ta=Depends(require_ta)):
    """overwrites the live content blob. ta-only.
    @param payload the full content dict to save
    """
    save_content(payload)
    return {"ok": True}


@app.get("/api/profiles")
def api_list_profiles(ta=Depends(require_ta)):
    """lists the logged-in ta's own profiles plus anything shared with them.
    @return a list of profile rows
    """
    return list_profiles(ta["username"])


@app.post("/api/profiles")
def api_create_profile(payload: dict[str, Any], ta=Depends(require_ta)):
    """saves the current editor state as a new profile.
    @param payload {name, data}
    @return {id} of the new profile
    """
    name = str(payload.get("name") or "Profile")
    profile_id = create_profile(ta["username"], name, payload.get("data") or {})
    return {"id": profile_id}


@app.post("/api/profiles/{profile_id}")
def api_update_profile(profile_id: int, payload: dict[str, Any], ta=Depends(require_ta)):
    """partially updates a profile: name/shared are owner-only, data needs
    ownership or sharing.
    @param profile_id the profile to update
    @param payload any subset of {name, data, shared}
    """
    prof = get_profile(profile_id)
    if not prof:
        raise HTTPException(status_code=404, detail="No such profile.")
    is_owner = prof["owner"] == ta["username"]
    # anyone can save content into a shared profile, and anyone can take a
    # shared profile off the shared list, but only the owner can rename,
    # turn sharing on, or delete it
    if "name" in payload and not is_owner:
        raise HTTPException(status_code=403, detail="Only the owner can change that.")
    if payload.get("shared") is True and not is_owner:
        raise HTTPException(status_code=403, detail="Only the owner can change that.")
    if "data" in payload and not (is_owner or prof["shared"]):
        raise HTTPException(status_code=403, detail="Not your profile.")
    update_profile(
        profile_id,
        name=payload.get("name"),
        data=payload.get("data"),
        shared=payload.get("shared"),
    )
    return {"ok": True}


@app.delete("/api/profiles/{profile_id}")
def api_delete_profile(profile_id: int, ta=Depends(require_ta)):
    """deletes a profile. owner only.
    @param profile_id the profile to delete
    """
    prof = get_profile(profile_id)
    if not prof:
        raise HTTPException(status_code=404, detail="No such profile.")
    if prof["owner"] != ta["username"]:
        raise HTTPException(status_code=403, detail="Only the owner can delete a profile.")
    delete_profile(profile_id)
    return {"ok": True}


@app.get("/api/ping")
def api_ping(_ta=Depends(require_ta)):
    """heartbeat from an open ta tab (js/idle.js): the require_ta lookup
    already slid the session's expiry forward, nothing else to do here."""
    return {"ok": True}


class NewUserRequest(BaseModel):
    username: str
    password: str
    role: str


@app.get("/api/users")
def api_list_users(_ta=Depends(require_ta)):
    """lists every account. ta-only.
    @return a list of {username, role, password} rows
    """
    return list_users()


@app.post("/api/users")
def api_create_user(payload: NewUserRequest, _ta=Depends(require_ta)):
    """creates a new student or ta account. ta-only.
    @param payload {username, password, role}
    """
    username = payload.username.strip()
    if not username or not payload.password:
        raise HTTPException(status_code=400, detail="Username and password are both needed.")
    if payload.role not in ("student", "ta"):
        raise HTTPException(status_code=400, detail="Role must be student or ta.")
    if not create_user(username, payload.password, payload.role):
        raise HTTPException(status_code=409, detail="That username is already taken.")
    return {"ok": True}


@app.delete("/api/users/{username}")
def api_delete_user(username: str, ta=Depends(require_ta)):
    """removes an account. ta-only, and a ta can't remove their own (which
    also stops the last ta from being removed).
    @param username the account to remove
    """
    if username == ta["username"]:
        raise HTTPException(status_code=400, detail="You can't remove your own account.")
    if not delete_user(username):
        raise HTTPException(status_code=404, detail="No such account.")
    return {"ok": True}


@app.post("/api/upload")
def api_upload(file: UploadFile, _ta=Depends(require_ta)):
    """stores an uploaded attachment under a random name. ta-only.
    @param file the uploaded file
    @return {name, url} to push into an attachment list
    """
    safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", file.filename or "file")
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    with open(UPLOAD_DIR / stored_name, "wb") as out:
        out.write(file.file.read())
    return {"name": file.filename, "url": f"/uploads/{stored_name}"}


@app.get("/")
def root():
    """redirects the bare root url to the landing page."""
    return RedirectResponse(url="/index.html")


@app.get("/index.html")
def page_index(request: Request):
    """renders the landing page."""
    return templates.TemplateResponse(request, "index.html")


@app.get("/gallery.html")
def page_gallery(request: Request):
    """renders the public photo gallery."""
    return templates.TemplateResponse(request, "gallery.html")


@app.get("/login.html")
def page_login(request: Request):
    """renders the login form."""
    return templates.TemplateResponse(request, "login.html")


@app.get("/dashboard.html")
def page_dashboard(request: Request):
    """renders the student dashboard."""
    return templates.TemplateResponse(request, "dashboard.html")


@app.get("/instructor.html")
def page_instructor(request: Request):
    """renders the ta portal (content manager)."""
    return templates.TemplateResponse(request, "instructor.html")


@app.get("/preview.html")
def page_preview(request: Request):
    """renders the ta-only preview page."""
    return templates.TemplateResponse(request, "preview.html")


@app.get("/accounts.html")
def page_accounts(request: Request):
    """renders the ta-only account manager."""
    return templates.TemplateResponse(request, "accounts.html")
