from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app.db import init_db, verify_login

BASE_DIR = Path(__file__).resolve().parent.parent


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="ECE Workshops", lifespan=lifespan)

app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
app.mount("/assets", StaticFiles(directory=BASE_DIR / "assets"), name="assets")

templates = Jinja2Templates(directory=BASE_DIR / "templates")


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/api/login")
def api_login(payload: LoginRequest):
    role = verify_login(payload.username, payload.password)
    if role is None:
        raise HTTPException(status_code=401, detail="Wrong username or password.")
    return {"username": payload.username, "role": role}


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
