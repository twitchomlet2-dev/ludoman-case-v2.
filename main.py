import os
import json
import hmac
import hashlib
import secrets
import time
from pathlib import Path
from urllib.parse import parse_qsl
from urllib.request import Request as URLRequest, urlopen

import psycopg
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")

app = FastAPI(title="LUDOMAN Case")

# Цены кейсов во внутренних Telegram Stars.
# Если цена кейса изменится, поменяй её здесь и в интерфейсе.
CASE_PRICES = {50, 100, 250, 500}

MIN_TOPUP = 50
MAX_TOPUP = 10000

REWARDS = [
    {"icon": "🪙", "name": "Монеты", "desc": "Награда за открытие кейса", "rarity": "ОБЫЧНЫЙ"},
    {"icon": "💎", "name": "Кристалл", "desc": "Редкий коллекционный предмет", "rarity": "РЕДКИЙ"},
    {"icon": "⚡", "name": "Энергия", "desc": "Энергия LUDOMAN", "rarity": "ОБЫЧНЫЙ"},
    {"icon": "👑", "name": "Корона", "desc": "Особая награда", "rarity": "ЭПИЧЕСКИЙ"},
    {"icon": "🎁", "name": "Подарок", "desc": "Сюрприз из кейса", "rarity": "РЕДКИЙ"},
    {"icon": "🔥", "name": "Огонь", "desc": "Огненный предмет", "rarity": "ЭПИЧЕСКИЙ"},
    {"icon": "🐉", "name": "Дракон", "desc": "Легендарная награда", "rarity": "ЛЕГЕНДАРНЫЙ"},
]


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

    with urlopen(request, timeout=20) as response:
        result = json.loads(response.read().decode("utf-8"))

    if not result.get("ok"):
        raise RuntimeError(
            f"Telegram API error: {result.get('description', 'unknown')}"
        )

    return result["result"]


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
                star_balance BIGINT NOT NULL DEFAULT 0,
                opens BIGINT NOT NULL DEFAULT 0,
                spent BIGINT NOT NULL DEFAULT 0,
                wins BIGINT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

        # Безопасное расширение существующей базы.
        conn.execute("""
            ALTER TABLE players
            ADD COLUMN IF NOT EXISTS star_balance BIGINT NOT NULL DEFAULT 0
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

        conn.execute("""
            CREATE TABLE IF NOT EXISTS star_orders (
                payload TEXT PRIMARY KEY,
                telegram_id BIGINT NOT NULL REFERENCES players(telegram_id),
                case_id TEXT NOT NULL,
                price INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                telegram_payment_charge_id TEXT UNIQUE,
                gift_id TEXT,
                gift_name TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                paid_at TIMESTAMPTZ,
                delivered_at TIMESTAMPTZ
            )
        """)

        # Дополнительные поля для новых заказов пополнения.
        conn.execute("""
            ALTER TABLE star_orders
            ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'legacy'
        """)


def authenticate(init_data: str):
    if not BOT_TOKEN:
        raise HTTPException(503, "BOT_TOKEN не настроен на сервере")
    if not init_data:
        raise HTTPException(401, "Открой приложение через Telegram")

    try:
        fields = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = fields.pop("hash")
        auth_date = int(fields["auth_date"])

        if int(time.time()) - auth_date > 86400:
            raise ValueError("Устаревшие данные Telegram")
        if auth_date - int(time.time()) > 60:
            raise ValueError("Некорректная дата Telegram")

        check_string = "\n".join(
            f"{key}={value}" for key, value in sorted(fields.items())
        )

        secret_key = hmac.new(
            b"WebAppData",
            BOT_TOKEN.encode(),
            hashlib.sha256,
        ).digest()

        calculated_hash = hmac.new(
            secret_key,
            check_string.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(calculated_hash, received_hash):
            raise ValueError("Неверная подпись Telegram")

        user = json.loads(fields["user"])
        if int(user["id"]) <= 0:
            raise ValueError("Неверный ID")
        return user

    except HTTPException:
        raise
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
                   balance, star_balance, opens, spent, wins
            FROM players WHERE telegram_id = %s
        """, (telegram_id,)).fetchone()

    return player


def setup_telegram_webhook():
    if not BOT_TOKEN or not TELEGRAM_WEBHOOK_SECRET:
        print("Webhook не настроен: проверь переменные окружения")
        return

    try:
        result = telegram_api("setWebhook", {
            "url": "https://ludom an-case-v2.onrender.com/telegram/webhook".replace(" ", ""),
            "secret_token": TELEGRAM_WEBHOOK_SECRET,
            "allowed_updates": ["message", "pre_checkout_query"],
        })
        print(f"Telegram webhook configured: {result}")
    except Exception as exc:
        print(f"Не удалось настроить Telegram webhook: {exc}")


@app.on_event("startup")
def startup():
    init_db()
    setup_telegram_webhook()


if not WEB_DIR.is_dir():
    raise RuntimeError("Папка web не найдена рядом с main.py")

app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


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
    if not hmac.compare_digest(received_secret, TELEGRAM_WEBHOOK_SECRET):
        raise HTTPException(403, "Invalid webhook secret")

    update = await request.json()

    # Подтверждение платежа до списания Stars Telegram.
    query = update.get("pre_checkout_query")
    if query:
        payload = query.get("invoice_payload", "")
        with connect_db() as conn:
            order = conn.execute("""
                SELECT telegram_id, price, status
                FROM star_orders
                WHERE payload = %s
            """, (payload,)).fetchone()

        valid = bool(
            order
            and order[0] == query["from"]["id"]
            and order[1] == query.get("total_amount")
            and query.get("currency") == "XTR"
            and order[2] == "pending"
        )

        answer = {
            "pre_checkout_query_id": query["id"],
            "ok": valid,
        }
        if not valid:
            answer["error_message"] = "Заказ недействителен. Создай новый."

        telegram_api("answerPreCheckoutQuery", answer)
        return {"ok": True}

    message = update.get("message", {})
    chat = message.get("chat", {})
    text = message.get("text", "")

    if text == "/start" and chat.get("type") == "private":
        telegram_api("sendMessage", {
            "chat_id": chat["id"],
            "text": (
                "🔥 Добро пожаловать в LUDOMAN Case!\n\n"
                "Открой приложение, пополни баланс Stars и собирай коллекцию."
            ),
        })
        return {"ok": True}

    payment = message.get("successful_payment")
    if not payment:
        return {"ok": True}

    payload = payment.get("invoice_payload", "")
    charge_id = payment.get("telegram_payment_charge_id", "")
    telegram_id = message.get("from", {}).get("id")
    amount = payment.get("total_amount")
    currency = payment.get("currency")

    if not payload or not charge_id or not telegram_id:
        return {"ok": True}

    # ВАЖНО: начисление баланса и перевод заказа в credited происходят
    # в одной транзакции. Повторный webhook не начислит Stars второй раз.
    with connect_db() as conn:
        order = conn.execute("""
            SELECT telegram_id, price, status, order_type
            FROM star_orders
            WHERE payload = %s
            FOR UPDATE
        """, (payload,)).fetchone()

        if not order:
            print(f"Оплата получена для неизвестного заказа: {payload}")
            return {"ok": True}

        order_user_id, order_price, status, order_type = order

        if (
            order_user_id != telegram_id
            or order_price != amount
            or currency != "XTR"
        ):
            print(f"Несовпадение данных оплаты: {payload}")
            return {"ok": True}

        if status != "pending":
            # Уже обработан: повторно не начисляем.
            return {"ok": True}

        if order_type != "topup":
            # Старые заказы покупки подарков не обрабатываем новым способом.
            print(f"Пропущен старый тип заказа: {payload}")
            return {"ok": True}

        conn.execute("""
            UPDATE players
            SET star_balance = star_balance + %s
            WHERE telegram_id = %s
        """, (amount, telegram_id))

        updated = conn.execute("""
            UPDATE star_orders
            SET status = 'credited',
                telegram_payment_charge_id = %s,
                paid_at = NOW()
            WHERE payload = %s AND status = 'pending'
            RETURNING payload
        """, (charge_id, payload)).fetchone()

        if not updated:
            raise RuntimeError("Не удалось зафиксировать оплату")

    try:
        telegram_api("sendMessage", {
            "chat_id": telegram_id,
            "text": (
                f"✅ Баланс пополнен на {amount} Stars!\n"
                "Открой LUDOMAN Case, чтобы использовать баланс."
            ),
        })
    except Exception as exc:
        # Не отменяем начисление, если не удалось отправить уведомление.
        print(f"Не удалось отправить уведомление об оплате: {exc}")

    return {"ok": True}


class TopupRequest(BaseModel):
    amount: int = Field(ge=MIN_TOPUP, le=MAX_TOPUP)


@app.post("/api/star/topup")
def create_topup_invoice(
    body: TopupRequest,
    x_telegram_init_data: str = Header(default=""),
):
    user = authenticate(x_telegram_init_data)
    telegram_id = int(user["id"])
    amount = body.amount

    get_player(x_telegram_init_data)
    payload = secrets.token_urlsafe(32)

    with connect_db() as conn:
        conn.execute("""
            INSERT INTO star_orders
                (payload, telegram_id, case_id, price, status, order_type)
            VALUES (%s, %s, 'topup', %s, 'pending', 'topup')
        """, (payload, telegram_id, amount))

    try:
        invoice_url = telegram_api("createInvoiceLink", {
            "title": "Пополнение LUDOMAN Case",
            "description": f"Пополнение внутреннего баланса на {amount} Stars",
            "payload": payload,
            "provider_token": "",
            "currency": "XTR",
            "prices": [{
                "label": f"{amount} Stars на баланс",
                "amount": amount,
            }],
        })
    except Exception as exc:
        print(f"Ошибка создания счёта: {exc}")
        with connect_db() as conn:
            conn.execute("""
                UPDATE star_orders
                SET status = 'invoice_error'
                WHERE payload = %s AND status = 'pending'
            """, (payload,))
        raise HTTPException(502, "Не удалось создать счёт Telegram")

    return {
        "invoice_url": invoice_url,
        "amount": amount,
    }


@app.get("/api/me")
def me(x_telegram_init_data: str = Header(default="")):
    player = get_player(x_telegram_init_data)

    (
        telegram_id, first_name, last_name, username,
        balance, star_balance, opens, spent, wins
    ) = player

    with connect_db() as conn:
        items = conn.execute("""
            SELECT icon, name, description, rarity, created_at
            FROM inventory
            WHERE telegram_id = %s
            ORDER BY id DESC
            LIMIT 100
        """, (telegram_id,)).fetchall()

    return {
        "user": {
            "id": telegram_id,
            "first_name": first_name,
            "last_name": last_name,
            "username": username,
        },
        # star_balance — новый баланс для оплаты кейсов.
        "star_balance": star_balance,
        # Старый баланс возвращается для совместимости интерфейса.
        "balance": balance,
        "stats": {
            "opens": opens,
            "spent": spent,
            "wins": wins,
        },
        "inventory": [
            {
                "icon": row[0],
                "name": row[1],
                "desc": row[2],
                "rarity": row[3],
                "date": row[4].isoformat(),
            }
            for row in items
        ],
    }


class OpenRequest(BaseModel):
    price: int


@app.post("/api/open")
def open_case(
    body: OpenRequest,
    x_telegram_init_data: str = Header(default=""),
):
    player = get_player(x_telegram_init_data)

    if body.price not in CASE_PRICES:
        raise HTTPException(400, "Неизвестный кейс")

    telegram_id = player[0]
    reward = secrets.choice(REWARDS)

    with connect_db() as conn:
        current = conn.execute("""
            SELECT star_balance
            FROM players
            WHERE telegram_id = %s
            FOR UPDATE
        """, (telegram_id,)).fetchone()

        if not current or current[0] < body.price:
            raise HTTPException(400, "Недостаточно Stars на балансе")

        conn.execute("""
            UPDATE players
            SET star_balance = star_balance - %s,
                opens = opens + 1,
                spent = spent + %s,
                wins = wins + 1
            WHERE telegram_id = %s
        """, (body.price, body.price, telegram_id))

        conn.execute("""
            INSERT INTO inventory
                (telegram_id, icon, name, description, rarity)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            telegram_id,
            reward["icon"],
            reward["name"],
            reward["desc"],
            reward["rarity"],
        ))

        new_balance = conn.execute("""
            SELECT star_balance
            FROM players
            WHERE telegram_id = %s
        """, (telegram_id,)).fetchone()[0]

    return {
        "star_balance": new_balance,
        "balance": new_balance,
        "reward": reward,
    }


@app.get("/api/leaderboard")
def leaderboard():
    with connect_db() as conn:
        rows = conn.execute("""
            SELECT telegram_id, first_name, username, opens, wins
            FROM players
            ORDER BY wins DESC, opens DESC
            LIMIT 20
        """).fetchall()

    return {
        "players": [
            {
                "id": row[0],
                "name": row[2] or row[1],
                "opens": row[3],
                "wins": row[4],
            }
            for row in rows
        ]
    }
    
