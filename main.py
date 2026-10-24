
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


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
WEB_DIR = BASE_DIR / "web"

BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
TELEGRAM_WEBHOOK_SECRET = os.environ.get("TELEGRAM_WEBHOOK_SECRET", "")
APP_URL = "https://ludoman-case-v2.onrender.com"

app = FastAPI(title="LUDOMAN Case")

# Prices accepted by the server for opening cases.
CASE_PRICES = {5, 49, 249, 499, 999, 1499, 2499, 4999}

# Top-up limits are separate from case prices.
MIN_TOPUP = 50
MAX_TOPUP = 10000

REWARDS = [
    {
        "icon": "🪙",
        "name": "Монеты",
        "desc": "Награда за открытие кейса",
        "rarity": "ОБЫЧНЫЙ",
        "sell_price": 10,
    },
    {
        "icon": "💎",
        "name": "Кристалл",
        "desc": "Редкий коллекционный предмет",
        "rarity": "РЕДКИЙ",
        "sell_price": 50,
    },
    {
        "icon": "⚡",
        "name": "Энергия",
        "desc": "Энергия LUDOMAN",
        "rarity": "ОБЫЧНЫЙ",
        "sell_price": 15,
    },
    {
        "icon": "👑",
        "name": "Корона",
        "desc": "Особая награда",
        "rarity": "ЭПИЧЕСКИЙ",
        "sell_price": 150,
    },
    {
        "icon": "🎁",
        "name": "Подарок",
        "desc": "Сюрприз из кейса",
        "rarity": "РЕДКИЙ",
        "sell_price": 75,
    },
    {
        "icon": "🔥",
        "name": "Огонь",
        "desc": "Огненный предмет",
        "rarity": "ЭПИЧЕСКИЙ",
        "sell_price": 120,
    },
    {
        "icon": "🐉",
        "name": "Дракон",
        "desc": "Легендарная награда",
        "rarity": "ЛЕГЕНДАРНЫЙ",
        "sell_price": 300,
    },
]


# ============================================================
# TELEGRAM API
# ============================================================

def telegram_api(method: str, payload: dict):
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN не задан в переменных окружения")

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/{method}"

    request = URLRequest(
        url,
        data=json.dumps(payload).encode("utf-8"),
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


# ============================================================
# DATABASE
# ============================================================

def connect_db():
    if not DATABASE_URL:
        raise RuntimeError(
            "Не задан DATABASE_URL в переменных окружения Render"
        )

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

        conn.execute("""
            ALTER TABLE players
            ADD COLUMN IF NOT EXISTS star_balance BIGINT NOT NULL DEFAULT 0
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS inventory (
                id BIGSERIAL PRIMARY KEY,
                telegram_id BIGINT NOT NULL
                    REFERENCES players(telegram_id),
                icon TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                rarity TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        
        conn.execute("""
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS reward_type TEXT NOT NULL DEFAULT 'item'
        """)
        conn.execute("""
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS gift_id TEXT
        """)
        conn.execute("""
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS delivery_status TEXT
        """)
        conn.execute("""a
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS delivery_error TEXT
        """)
        conn.execute("""
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ
        """)
        

        conn.execute("""
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS sell_price BIGINT NOT NULL DEFAULT 0
        """)

        conn.execute("""
            ALTER TABLE inventory
            ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ
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

        conn.execute("""
            ALTER TABLE star_orders
            ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'legacy'
        """)


# ============================================================
# TELEGRAM WEB APP AUTHENTICATION
# ============================================================

def authenticate(init_data: str):
    if not BOT_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="BOT_TOKEN не настроен на сервере",
        )

    if not init_data:
        raise HTTPException(
            status_code=401,
            detail="Открой приложение через Telegram",
        )

    try:
        fields = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = fields.pop("hash")
        auth_date = int(fields["auth_date"])

        if int(time.time()) - auth_date > 86400:
            raise ValueError("Устаревшие данные Telegram")

        if auth_date - int(time.time()) > 60:
            raise ValueError("Некорректная дата Telegram")

        check_string = "\n".join(
            f"{key}={value}"
            for key, value in sorted(fields.items())
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
        raise HTTPException(
            status_code=401,
            detail="Не удалось проверить данные Telegram",
        )


def get_player(init_data: str):
    user = authenticate(init_data)
    telegram_id = int(user["id"])

    first_name = str(user.get("first_name", "Игрок"))[:128]
    last_name = str(user.get("last_name", ""))[:128]
    username = str(user.get("username", ""))[:128]

    with connect_db() as conn:
        conn.execute("""
            INSERT INTO players (
                telegram_id,
                first_name,
                last_name,
                username
            )
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (telegram_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                username = EXCLUDED.username
        """, (
            telegram_id,
            first_name,
            last_name,
            username,
        ))

        player = conn.execute("""
            SELECT
                telegram_id,
                first_name,
                last_name,
                username,
                balance,
                star_balance,
                opens,
                spent,
                wins
            FROM players
            WHERE telegram_id = %s
        """, (telegram_id,)).fetchone()

    return player


# ============================================================
# WEBHOOK
# ============================================================

def setup_telegram_webhook():
    if not BOT_TOKEN or not TELEGRAM_WEBHOOK_SECRET:
        print("Webhook не настроен: проверь переменные окружения")
        return

    try:
        result = telegram_api("setWebhook", {
            "url": f"{APP_URL}/telegram/webhook",
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


# ============================================================
# STATIC WEBSITE
# ============================================================

if not WEB_DIR.is_dir():
    raise RuntimeError("Папка web не найдена рядом с main.py")

app.mount(
    "/static",
    StaticFiles(directory=str(WEB_DIR)),
    name="static",
)


@app.get("/")
def home():
    return FileResponse(str(WEB_DIR / "index.html"))


@app.get("/health")
def health():
    return {
        "status": "ok",
        "app": "LUDOMAN Case",
    }


# ============================================================
# TELEGRAM PAYMENT WEBHOOK
# ============================================================

@app.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    if not TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Webhook secret не настроен",
        )

    received_secret = request.headers.get(
        "X-Telegram-Bot-Api-Secret-Token",
        "",
    )

    if not hmac.compare_digest(
        received_secret,
        TELEGRAM_WEBHOOK_SECRET,
    ):
        raise HTTPException(
            status_code=403,
            detail="Invalid webhook secret",
        )

    update = await request.json()

    # Confirm or reject the payment before Telegram processes it.
    query = update.get("pre_checkout_query")

    if query:
        payload = query.get("invoice_payload", "")

        with connect_db() as conn:
            order = conn.execute("""
                SELECT telegram_id, price, status, order_type
                FROM star_orders
                WHERE payload = %s
            """, (payload,)).fetchone()

        valid = bool(
            order
            and order[0] == query["from"]["id"]
            and order[1] == query.get("total_amount")
            and query.get("currency") == "XTR"
            and order[2] == "pending"
            and order[3] == "topup"
        )

        answer = {
            "pre_checkout_query_id": query["id"],
            "ok": valid,
        }

        if not valid:
            answer["error_message"] = (
                "Заказ недействителен. Создай новый."
            )

        telegram_api("answerPreCheckoutQuery", answer)
        return {"ok": True}

    message = update.get("message", {})
    chat = message.get("chat", {})
    message_text = message.get("text", "")

    # Bot /start command.
    if message_text == "/start" and chat.get("type") == "private":
        telegram_api("sendMessage", {
            "chat_id": chat["id"],
            "text": (
                "🔥 Добро пожаловать в LUDOMAN Case!\n\n"
                "Открой приложение, пополни баланс Stars "
                "и собирай коллекцию."
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

    # Credit a payment once, inside a database transaction.
    with connect_db() as conn:
        order = conn.execute("""
            SELECT telegram_id, price, status, order_type
            FROM star_orders
            WHERE payload = %s
            FOR UPDATE
        """, (payload,)).fetchone()

        if not order:
            print(f"Оплата для неизвестного заказа: {payload}")
            return {"ok": True}

        order_user_id, order_price, status, order_type = order

        if (
            order_user_id != telegram_id
            or order_price != amount
            or currency != "XTR"
        ):
            print(f"Несовпадение данных оплаты: {payload}")
            return {"ok": True}

        if status != "pending" or order_type != "topup":
            return {"ok": True}

        updated = conn.execute("""
            UPDATE star_orders
            SET
                status = 'credited',
                telegram_payment_charge_id = %s,
                paid_at = NOW()
            WHERE payload = %s
              AND status = 'pending'
            RETURNING payload
        """, (charge_id, payload)).fetchone()

        if not updated:
            return {"ok": True}

        conn.execute("""
            UPDATE players
            SET star_balance = star_balance + %s
            WHERE telegram_id = %s
        """, (amount, telegram_id))

    try:
        telegram_api("sendMessage", {
            "chat_id": telegram_id,
            "text": (
                f"✅ Баланс пополнен на {amount} Stars!\n"
                "Открой LUDOMAN Case, чтобы использовать баланс."
            ),
        })

    except Exception as exc:
        print(f"Не удалось отправить уведомление об оплате: {exc}")

    return {"ok": True}


# ============================================================
# TOP-UP WITH TELEGRAM STARS
# ============================================================

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
            INSERT INTO star_orders (
                payload,
                telegram_id,
                case_id,
                price,
                status,
                order_type
            )
            VALUES (%s, %s, 'topup', %s, 'pending', 'topup')
        """, (payload, telegram_id, amount))

    try:
        invoice_url = telegram_api("createInvoiceLink", {
            "title": "Пополнение LUDOMAN Case",
            "description": (
                f"Пополнение внутреннего баланса на {amount} Stars"
            ),
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
                WHERE payload = %s
                  AND status = 'pending'
            """, (payload,))

        raise HTTPException(
            status_code=502,
            detail="Не удалось создать счёт Telegram",
        )

    return {
        "invoice_url": invoice_url,
        "amount": amount,
    }


# ============================================================
# PLAYER PROFILE AND INVENTORY
# ============================================================

@app.get("/api/me")
def me(x_telegram_init_data: str = Header(default="")):
    player = get_player(x_telegram_init_data)

    (
        telegram_id,
        first_name,
        last_name,
        username,
        balance,
        star_balance,
        opens,
        spent,
        wins,
    ) = player

    with connect_db() as conn:
        items = conn.execute("""
            SELECT
                id,
                icon,
                name,
                description,
                rarity,
                created_at,
                sell_price
            FROM inventory
            WHERE telegram_id = %s
              AND sold_at IS NULL
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
        "star_balance": star_balance,
        "balance": balance,
        "stats": {
            "opens": opens,
            "spent": spent,
            "wins": wins,
        },
        "inventory": [
            {
                "id": row[0],
                "icon": row[1],
                "name": row[2],
                "desc": row[3],
                "rarity": row[4],
                "date": row[5].isoformat(),
                "sell_price": row[6],
            }
            for row in items
        ],
    }


# ============================================================
# OPEN CASE
# ============================================================

class OpenRequest(BaseModel):
    price: int = Field(gt=0)


@app.post("/api/open")
def open_case(
    body: OpenRequest,
    x_telegram_init_data: str = Header(default=""),
):
    player = get_player(x_telegram_init_data)

    if body.price not in CASE_PRICES:
        raise HTTPException(
            status_code=400,
            detail="Неизвестный кейс",
        )

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
            raise HTTPException(
                status_code=400,
                detail="Недостаточно средств на балансе",
            )

        conn.execute("""
            UPDATE players
            SET
                star_balance = star_balance - %s,
                opens = opens + 1,
                spent = spent + %s,
                wins = wins + 1
            WHERE telegram_id = %s
        """, (
            body.price,
            body.price,
            telegram_id,
        ))

        conn.execute("""
            INSERT INTO inventory (
                telegram_id,
                icon,
                name,
                description,
                rarity,
                sell_price
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            telegram_id,
            reward["icon"],
            reward["name"],
            reward["desc"],
            reward["rarity"],
            reward["sell_price"],
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


class SellItemRequest(BaseModel):
    item_id: int = Field(gt=0)


@app.post("/api/inventory/sell")
def sell_inventory_item(
    body: SellItemRequest,
    x_telegram_init_data: str = Header(default=""),
):
    player = get_player(x_telegram_init_data)
    telegram_id = player[0]

    with connect_db() as conn:
        item = conn.execute("""
            SELECT id, sell_price
            FROM inventory
            WHERE id = %s
              AND telegram_id = %s
              AND sold_at IS NULL
            FOR UPDATE
        """, (body.item_id, telegram_id)).fetchone()

        if not item:
            raise HTTPException(404, "Подарок не найден или уже продан")

        item_id, sell_price = item

        if sell_price <= 0:
            raise HTTPException(400, "Этот предмет нельзя продать")

        updated = conn.execute("""
            UPDATE inventory
            SET sold_at = NOW()
            WHERE id = %s
              AND telegram_id = %s
              AND sold_at IS NULL
            RETURNING id
        """, (item_id, telegram_id)).fetchone()

        if not updated:
            raise HTTPException(409, "Предмет уже продан")

        balance_row = conn.execute("""
            UPDATE players
            SET star_balance = star_balance + %s
            WHERE telegram_id = %s
            RETURNING star_balance
        """, (sell_price, telegram_id)).fetchone()

        if not balance_row:
            raise HTTPException(500, "Не удалось обновить баланс")

        new_balance = balance_row[0]

    return {
        "ok": True,
        "item_id": item_id,
        "sold_for": sell_price,
        "star_balance": new_balance,
    }


class ClaimGiftRequest(BaseModel):
    item_id: int


@app.post("/api/inventory/claim-gift")
def claim_gift(
    body: ClaimGiftRequest,
    x_telegram_init_data: str = Header(default="")
):
    player = get_player(x_telegram_init_data)
    telegram_id = int(player[0])

    # Атомарно резервируем именно подарок этого игрока.
    with connect_db() as conn:
        item = conn.execute("""
            UPDATE inventory
            SET delivery_status = 'sending',
                delivery_error = NULL
            WHERE id = %s
              AND telegram_id = %s
              AND reward_type = 'telegram_gift'
              AND delivery_status = 'pending'
            RETURNING id, gift_id, name
        """, (body.item_id, telegram_id)).fetchone()

    if not item:
        raise HTTPException(
            409,
            "Подарок уже получен, обрабатывается или недоступен."
        )

    item_id, gift_id, gift_name = item

    if not gift_id:
        with connect_db() as conn:
            conn.execute("""
                UPDATE inventory
                SET delivery_status = 'failed',
                    delivery_error = 'Не задан gift_id'
                WHERE id = %s AND telegram_id = %s
            """, (item_id, telegram_id))
        raise HTTPException(409, "У подарка отсутствует Telegram ID.")

    try:
        # Отправляем подарок только от имени бота.
        telegram_api("sendGift", {
            "user_id": telegram_id,
            "gift_id": gift_id
        })

    except Exception as exc:
        # Не повторяем отправку автоматически:
        # при сетевом тайм-ауте результат может быть неизвестен.
        with connect_db() as conn:
            conn.execute("""
                UPDATE inventory
                SET delivery_status = 'failed',
                    delivery_error = %s
                WHERE id = %s
                  AND telegram_id = %s
                  AND delivery_status = 'sending'
            """, (str(exc)[:1000], item_id, telegram_id))

        print(f"Gift delivery failed for inventory item {item_id}: {exc}")
        raise HTTPException(
            502,
            "Не удалось подтвердить выдачу. Обратись в поддержку перед повторной попыткой."
        ) from exc

    with connect_db() as conn:
        conn.execute("""
            UPDATE inventory
            SET delivery_status = 'delivered',
                delivery_error = NULL,
                delivered_at = NOW()
            WHERE id = %s
              AND telegram_id = %s
              AND delivery_status = 'sending'
        """, (item_id, telegram_id))

    return {
        "ok": True,
        "item_id": item_id,
        "status": "delivered",
        "message": "Подарок отправлен в Telegram."
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
