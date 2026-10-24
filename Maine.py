
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

app = FastAPI(title="LUDOMAN Case")

if not WEB_DIR.is_dir():
    raise RuntimeError("Папка web не найдена рядом с main.py")

app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


@app.get("/")
async def home():
    return FileResponse(str(WEB_DIR / "index.html"))


@app.get("/health")
async def health():
    return {"status": "ok", "app": "LUDOMAN Case"}
  
