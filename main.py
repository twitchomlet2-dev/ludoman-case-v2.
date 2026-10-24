
import os
import json
import hmac
import hashlib
import secrets
from urllib.parse import parse_qsl

import psycopg
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from pathlib import Path
from fastapi import Request
from urllib.request import Request as URLRequest, urlopen
from urllib.error import URLError

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")

app = FastAPI(title="LUDOMAN Case")

TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")


def telegram_api(method: str, payload: dict):
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN не задан")

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"
    data = json.dumps(payload).encode("utf-8")

    request = URLRequest(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urlopen(request, timeout=15) as response:
        result = json.loads(response.read().decode("utf-8"))

    if not result.get("ok"):
        raise RuntimeError(f"Telegram API error: {result.get('description', 'unknown')}")

    return result["result"]


def setup_telegram_webhook():
    if not BOT_TOKEN or not TELEGRAM_WEBHOOK_SECRET:
        print("Webhook не настроен: проверь BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET")
        return

    try:
        result = telegram_api("setWebhook", {
            "url": "https://ludoman-case-v2.onrender.com/telegram/webhook",
            "secret_token": TELEGRAM_WEBHOOK_SECRET,
            "allowed_updates": ["message", "pre_checkout_query"],
        })
        print(f"Telegram webhook configured: {result}")
    except Exception as exc:
        print(f"Не удалось настроить Telegram webhook: {exc}")
        

if not WEB_DIR.is_dir():
    raise RuntimeError("Папка web не найдена рядом с main.py")

app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")

REWARDS = [
    {"icon": "🪙", "name": "Монеты", "desc": "Награда за открытие кейса", "rarity": "ОБЫЧНЫЙ"},
    {"icon": "💎", "name": "Кристалл", "desc": "Редкий коллекционный предмет", "rarity": "РЕДКИЙ"},
    {"icon": "⚡", "name": "Энергия", "desc": "Энергия LUDOMAN", "rarity": "ОБЫЧНЫЙ"},
    {"icon": "👑", "name": "Корона", "desc": "Особая награда", "rarity": "ЭПИЧЕСКИЙ"},
    {"icon": "🎁", "name": "Подарок", "desc": "Сюрприз из кейса", "rarity": "РЕДКИЙ"},
    {"icon": "🔥", "name": "Огонь", "desc": "Огненный предмет", "rarity": "ЭПИЧЕСКИЙ"},
    {"icon": "🐉", "name": "Дракон", "desc": "Легендарная награда", "rarity": "ЛЕГЕНДАРНЫЙ"},
]

CASE_PRICES = {100, 250, 500}


def connect_db():
    if not DATABASE_URL:
        raise RuntimeError("Не задан DATABASE_URL в Render Environment")
    return psycopg.connect(DATABASE_URL, connect_timeout=10)


def init_db():
    with connect_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS players (
                telegram_id BIGINT PRIMARY KEY,
                first_name TEXT NOT NULL DEFAULT 'Игрок',
                last_name TEXT NOT NULL DEFAULT '',
                username TEXT NOT NULL DEFAULT '',
                balance BIGINT NOT NULL DEFAULT 1000,
                opens BIGINT NOT NULL DEFAULT 0,
                spent BIGINT NOT NULL DEFAULT 0,
                wins BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id BIGSERIAL PRIMARY KEY,
                telegram_id BIGINT NOT NULL REFERENCES players(telegram_id),
                icon TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                rarity TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)


@app.on_event("startup")
def startup():
    init_db()
    setup_telegram_webhook()


def authenticate(init_data: str):
    if not BOT_TOKEN:
        raise HTTPException(503, "BOT_TOKEN не настроен на сервере")
    if not init_data:
        raise HTTPException(401, "Открой приложение через Telegram")

    try:
        fields = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = fields.pop("hash")
        auth_date = int(fields["auth_date"])

        # Не принимаем устаревшие данные авторизации
        import time
        if abs(int(time.time()) - auth_date) > 86400:
            raise ValueError("Устаревшие данные Telegram")

        check_string = "\n".join(
            f"{key}={value}" for key, value in sorted(fields.items())
        )
        secret_key = hmac.new(
            b"WebAppData",
            BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()
        calculated_hash = hmac.new(
            secret_key,
            check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(calculated_hash, received_hash):
            raise ValueError("Неверная подпись Telegram")

        user = json.loads(fields["user"])
        telegram_id = int(user["id"])
        if telegram_id <= 0:
            raise ValueError("Неверный ID")
        return user

    except Exception:
        raise HTTPException(401, "Не удалось проверить данные Telegram")


def get_player(init_data: str):
    user = authenticate(init_data)
    telegram_id = int(user["id"])
    first_name = str(user.get("first_name", "Игрок"))[:128]
    last_name = str(user.get("last_name", ""))[:128]
    username = str(user.get("username", ""))[:128]

    with connect_db() as conn:
        conn.execute("""
            INSERT INTO players (telegram_id, first_name, last_name, username)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (telegram_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                username = EXCLUDED.username
        """, (telegram_id, first_name, last_name, username))

        player = conn.execute("""
            SELECT telegram_id, first_name, last_name, username,
                   balance, opens, spent, wins
            FROM players WHERE telegram_id = %s
        """, (telegram_id,)).fetchone()

    return player


@app.get("/")
def home():
    return FileResponse(str(WEB_DIR / "index.html"))


@app.get("/health")
def health():
    return {"status": "ok", "app": "LUDOMAN Case"}
    
@app.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    if not TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(503, "Webhook secret не настроен")

    received_secret = request.headers.get(
        "X-Telegram-Bot-Api-Secret-Token", ""
    )

    if not hmac.compare_digest(
        received_secret, TELEGRAM_WEBHOOK_SECRET
    ):
        raise HTTPException(403, "Invalid webhook secret")

    update = await request.json()

    message = update.get("message", {})
    chat = message.get("chat", {})
    text = message.get("text", "")

    if text == "/start" and chat.get("type") == "private":
        telegram_api("sendMessage", {
            "chat_id": chat["id"],
            "text": (
                "🔥 Добро пожаловать в LUDOMAN Case!\n\n"
                "Открывай приложение, изучай кейсы "
                "и собирай свою коллекцию.\n\n"
                "Нажми кнопку меню бота, чтобы открыть Mini App."
            ),
        })

    return {"ok": True}
    


@app.get("/api/me")
def me(x_telegram_init_data: str = Header(default="")):
    player = get_player(x_telegram_init_data)
    telegram_id, first_name, last_name, username, balance, opens, spent, wins = player

    with connect_db() as conn:
        items = conn.execute("""
            SELECT icon, name, description, rarity, created_at
            FROM inventory
            WHERE telegram_id = %s
            ORDER BY id DESC LIMIT 100
        """, (telegram_id,)).fetchall()

    return {
        "user": {
            "id": telegram_id,
            "first_name": first_name,
            "last_name": last_name,
            "username": username,
        },
        "balance": balance,
        "stats": {"opens": opens, "spent": spent, "wins": wins},
        "inventory": [
            {
                "icon": row[0], "name": row[1], "desc": row[2],
                "rarity": row[3], "date": row[4].isoformat()
            }
            for row in items
        ],
    }


class OpenRequest(BaseModel):
    price: int


@app.post("/api/open")
def open_case(
    body: OpenRequest,
    x_telegram_init_data: str = Header(default="")
):
    player = get_player(x_telegram_init_data)

    if body.price not in CASE_PRICES:
        raise HTTPException(400, "Неизвестный кейс")

    telegram_id = player[0]
    reward = secrets.choice(REWARDS)

    with connect_db() as conn:
        # Блокировка строки не позволяет одновременно потратить один баланс дважды
        current = conn.execute("""
            SELECT balance FROM players
            WHERE telegram_id = %s FOR UPDATE
        """, (telegram_id,)).fetchone()

        if not current or current[0] < body.price:
            raise HTTPException(400, "Недостаточно монет")

        new_balance = current[0] - body.price

        conn.execute("""
            UPDATE players SET
                balance = %s,
                opens = opens + 1,
                spent = spent + %s,
                wins = wins + 1
            WHERE telegram_id = %s
        """, (new_balance, body.price, telegram_id))

        conn.execute("""
            INSERT INTO inventory
                (telegram_id, icon, name, description, rarity)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            telegram_id, reward["icon"], reward["name"],
            reward["desc"], reward["rarity"]
        ))

    return {"balance": new_balance, "reward": reward}


@app.get("/api/leaderboard")
def leaderboard():
    with connect_db() as conn:
        rows = conn.execute("""
            SELECT telegram_id, first_name, username, opens, wins
            FROM players
            ORDER BY wins DESC, opens DESC
            LIMIT 20
        """).fetchall()

    return {"players": [
        {
            "id": row[0],
            "name": row[2] or row[1],
            "opens": row[3],
            "wins": row[4],
        }
        for row in rows
    ]}
    
