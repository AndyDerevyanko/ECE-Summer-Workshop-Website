from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.db import init_db

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
