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
    create_session,
    get_content,
    get_session,
    init_db,
    save_content,
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

app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

templates = Jinja2Templates(directory=BASE_DIR / "templates")


def require_ta(authorization: str | None = Header(default=None)):
    """checks the Authorization: Bearer <token> header against the sessions
    table. raises 401/403 so ta-only routes can depend on this."""
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
    role = verify_login(payload.username, payload.password)
    if role is None:
        raise HTTPException(status_code=401, detail="Wrong username or password.")
    token = create_session(payload.username, role)
    return {"username": payload.username, "role": role, "token": token}


@app.get("/api/content")
def api_get_content():
    return get_content()


@app.post("/api/content")
def api_save_content(payload: dict[str, Any], _ta=Depends(require_ta)):
    save_content(payload)
    return {"ok": True}


@app.post("/api/upload")
def api_upload(file: UploadFile, _ta=Depends(require_ta)):
    safe_name = re.sub(r"[^A-Za-z0-9_.-]", "_", file.filename or "file")
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    with open(UPLOAD_DIR / stored_name, "wb") as out:
        out.write(file.file.read())
    return {"name": file.filename, "url": f"/uploads/{stored_name}"}


@app.get("/")
def root():
    return RedirectResponse(url="/index.html")


@app.get("/index.html")
def page_index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/gallery.html")
def page_gallery(request: Request):
    return templates.TemplateResponse(request, "gallery.html")


@app.get("/login.html")
def page_login(request: Request):
    return templates.TemplateResponse(request, "login.html")


@app.get("/dashboard.html")
def page_dashboard(request: Request):
    return templates.TemplateResponse(request, "dashboard.html")


@app.get("/instructor.html")
def page_instructor(request: Request):
    return templates.TemplateResponse(request, "instructor.html")
