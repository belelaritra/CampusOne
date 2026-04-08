# CampusOne Telegram Bot

A Telegram bot for CampusOne that lets registered users order food, track orders, cancel and review — all from Telegram.

---

## What It Does

| Feature | Description |
|---|---|
| 🔐 Auth | Phone number from Telegram matched against CampusOne profile |
| 🏪 Outlets | Browse open/closed food outlets |
| 🍔 Menu & Cart | Browse menu, add/remove items, see live cart total |
| 📦 Place Order | Choose delivery (with location) or takeaway, COD |
| 🔍 Track Order | Real-time status of any order by ID |
| 📜 My Orders | Active orders + last 5 history entries |
| ❌ Cancel | Cancel PENDING or ACCEPTED orders |
| ⭐ Review | Rate each item in a completed order (1–5 stars) |

---

## Complete Setup — Run These Commands In Order

### 1. Create a Telegram Bot

1. Open Telegram → search **@BotFather**
2. Send `/newbot`
3. Choose a name (e.g. `CampusOne`) and a username (e.g. `campusone_iitb_bot`)
4. BotFather replies with a token like `7123456789:AAF...` — copy it

---

### 2. Run the one-time setup script

From the **project root** (`CampusOne/`):

```bash
python3 setup_bot.py YOUR_BOT_TOKEN
```

Example:
```bash
python3 setup_bot.py 7123456789:AAFxxxxxxxxxxxxxxxxx
```

This writes `bot/.env`, `backend/.env`, and patches `settings.py` automatically.

---

### 3. Apply the database migration

```bash
cd backend
source venv/bin/activate
python manage.py migrate
cd ..
```

---

### 4. Set up the bot virtualenv and install dependencies

> The bot needs its own separate venv — do this from the `bot/` folder.

```bash
cd bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

---

### 5. Add your phone number to CampusOne

The bot links your Telegram account by matching your Telegram phone number
against the phone number saved in your CampusOne profile.

1. Start the app at `http://localhost:5173` and log in
2. Go to **Profile**
3. Fill in **Phone Number** (e.g. `9876543210` — last 10 digits is what matters)
4. Save

---

### 6. Run everything — 3 separate terminals

**Terminal 1 — Keycloak:**
```bash
docker compose up -d
```

**Terminal 2 — Django backend:**
```bash
cd backend
source venv/bin/activate
python manage.py runserver
```

**Terminal 3 — Telegram bot:**
```bash
cd bot
source venv/bin/activate
python bot.py
```

You should see in Terminal 3:
```
INFO — Starting CampusOne Telegram bot...
```

---

### 7. Connect on Telegram

1. Open Telegram → search your bot by username
2. Send `/start`
3. Tap **Share my phone number**
4. Linked ✅ — use the menu to order food, track, cancel, review

---

## Conversation Flow

```
/start
  ├─ not linked → Share Phone → Linked ✅ → Main Menu
  └─ already linked → Main Menu

Main Menu
  ├─ 🍔 Order Food
  │    └─ Outlet List → Select outlet
  │         └─ Menu (➕ add / ➖ remove, live cart total)
  │              └─ Place Order
  │                   ├─ 🛵 Delivery → Pick hostel/location → ✅ Placed
  │                   └─ 🥡 Takeaway → ✅ Placed
  │
  ├─ 📦 My Orders  → Active orders + last 5 completed
  ├─ 🔍 Track Order → Enter order ID → Live status
  ├─ ❌ Cancel Order → Pick order → Confirm → Cancelled
  └─ ⭐ Submit Review → Pick order → Rate each item (1–5 ★) → Submit
```

---

## Files Changed / Added

| File | What |
|---|---|
| `setup_bot.py` | One-time setup script |
| `bot/bot.py` | Main bot — all conversation handlers |
| `bot/api_client.py` | HTTP client wrapping the Django REST API |
| `bot/requirements.txt` | Bot Python dependencies |
| `backend/api/models.py` | Added `telegram_chat_id`, `telegram_phone` to `User` |
| `backend/api/migrations/0015_telegram_fields.py` | Migration for above |
| `backend/api/bot_authentication.py` | DRF auth backend for bot requests |
| `backend/api/views.py` | Added `POST /api/bot/link-phone/` |
| `backend/api/urls.py` | Wired the link-phone URL |
| `backend/campus_portal/settings.py` | Added `TELEGRAM_BOT_SECRET`, `BotAuthentication` |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `source: no such file or directory: venv/bin/activate` | You skipped step 4 — run `python3 -m venv venv` inside `bot/` first |
| `ModuleNotFoundError: No module named 'dotenv'` | Run `pip install -r requirements.txt` inside the bot venv |
| `TELEGRAM_BOT_TOKEN not set` | Re-run `python3 setup_bot.py YOUR_TOKEN` from project root |
| "No CampusOne account found" | Phone number not saved in CampusOne profile — add it at `/profile` |
| "account not linked" on `/start` | Phone mismatch — check the exact digits saved in your profile |
| 403 on bot API calls | `TELEGRAM_BOT_SECRET` mismatch — re-run `setup_bot.py` to fix |
| Bot not responding | Verify `TELEGRAM_BOT_TOKEN` is correct in `bot/.env` |
| Orders failing | Confirm Django is running at `http://localhost:8000` |
