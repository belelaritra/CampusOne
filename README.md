# CampusOne

A full-stack campus portal for IIT Bombay students — food ordering, lost & found, mess management, help & delivery, contacts, doctors, and a Telegram bot integration.

**Stack:** React (Vite) · Django REST Framework · Keycloak (auth) · SQLite · Docker · Python Telegram Bot

---

## Prerequisites

Install these once on your machine before anything else.

| Tool | Version | Install |
|---|---|---|
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Python | 3.11+ | `brew install python@3.13` |
| Node.js | 18+ | `brew install node` |
| jq | any | `brew install jq` |

---

## Running the Project

### First time (fresh clone)

```bash
git clone <repo-url>
cd CampusOne
chmod +x run.sh
./run.sh
```

The script will:
1. Check all prerequisites
2. Ask if you want the Telegram bot (yes/no)
3. If yes — ask for your bot token (get it from [@BotFather](https://t.me/BotFather) on Telegram)
4. Write all `.env` files automatically
5. Start Docker → wait for Keycloak → configure realm
6. Create Python venv → install packages → run migrations
7. Prompt you to create a Django superuser (first time only)
8. Sync users to Keycloak
9. Start frontend (Vite)
10. Start bot (if selected)

Everything runs in one terminal. Press `Ctrl+C` to stop all services cleanly.

### Every time after that

```bash
./run.sh
```

Same command. It detects what's already set up and skips those steps.

### Options

```bash
./run.sh --bot      # always include bot (skips the prompt)
./run.sh --no-bot   # always skip bot (skips the prompt)
./run.sh --reset    # wipe Keycloak DB and reconfigure from scratch
```

---

## Services & URLs

Once running:

| Service | URL | Notes |
|---|---|---|
| App | http://localhost:5173 | React frontend |
| API | http://localhost:8000/api | Django REST |
| Django Admin | http://localhost:8000/admin | Superuser login |
| Keycloak Console | http://localhost:8080/admin | Identity provider |

**Default credentials:**

| | Username | Password |
|---|---|---|
| Keycloak Admin | `admin` | `admin` |
| Test Staff User | `campus_admin` | `Admin@123` |
| Django Admin | *(set by you during first run)* | |

---

## Project Structure

```
CampusOne/
├── run.sh                        # Single startup script — run this
├── docker-compose.yml            # Keycloak + PostgreSQL
│
├── backend/                      # Django project
│   ├── campus_portal/            # Settings, URLs, WSGI
│   ├── api/                      # Models, views, serializers, migrations
│   │   ├── management/commands/  # sync_keycloak, fetch_doctors, seed_food_outlets
│   │   └── migrations/
│   ├── requirements.txt
│   ├── manage.py
│   └── .env.example              # Copy to .env — filled automatically by run.sh
│
├── frontend/                     # React (Vite) app
│   ├── src/
│   │   ├── pages/                # One file per feature page
│   │   ├── components/           # Shared UI components
│   │   ├── context/              # Auth, App, Cart context providers
│   │   ├── services/api.js       # Axios client — reads VITE_API_URL
│   │   └── keycloak.js           # Keycloak JS adapter singleton
│   ├── public/
│   │   └── silent-check-sso.html # Required for Keycloak silent SSO
│   └── package.json
│
├── bot/                          # Telegram bot (optional)
│   ├── bot.py                    # All conversation handlers
│   ├── api_client.py             # HTTP client wrapping Django API
│   ├── requirements.txt
│   └── .env.example              # Copy to .env — filled automatically by run.sh
│
└── keycloak/
    ├── setup-realm.sh            # Configures realm, client, roles, test user
    └── themes/campusone/         # Custom IIT Bombay login theme
```

---

## Telegram Bot Setup

If you want the bot, you need a token from Telegram first:

1. Open Telegram → search **@BotFather**
2. Send `/newbot` → follow prompts → copy the token
3. Run `./run.sh --bot` → paste the token when asked

The bot matches your Telegram phone number against your CampusOne profile. After linking:
- Order food, track orders, cancel, review — all from Telegram
- Send `/start` to your bot to begin

To link your account: log in to the app → Profile → save your phone number.

---

## Keycloak — Assigning Roles to Users

1. Open http://localhost:8080/admin → login `admin` / `admin`
2. Switch to `campusone` realm (top-left dropdown)
3. Users → select user → Role Mapping tab → Assign role

Available roles:

| Role | Access |
|---|---|
| `campus-staff` | Analytics, admin console, all data |
| `campus-security` | Security features |
| `outlet-admin` | Manage a specific food outlet |
| `mess-admin` | Manage a specific hostel mess |

For `outlet-admin` / `mess-admin`: also assign the user in Django Admin (`OutletAdmin` / `MessAdminProfile` tables) to link them to a specific outlet/hostel.

Role changes take effect on the user's next login.

---

## Environment Files

The startup script writes these automatically. Never commit them — they are in `.gitignore`.

| File | Purpose |
|---|---|
| `backend/.env` | `TELEGRAM_BOT_SECRET` |
| `bot/.env` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_SECRET`, `DJANGO_API_URL` |
| `frontend/.env.local` | Keycloak URL, realm, client ID, API URL |

To set up manually (without `run.sh`), copy the `.env.example` files:

```bash
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
# edit each file and fill in your values
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `No module named 'dotenv'` | Forgot to activate venv: `source backend/venv/bin/activate` |
| `APScheduler failed to start` | `pip install -r requirements.txt` inside backend venv |
| Keycloak not reachable | `docker compose up -d` then wait 30s |
| Redirect loop on login | Re-run `./keycloak/setup-realm.sh` |
| 401 on all API calls | `KEYCLOAK_SERVER_URL` in `backend/campus_portal/settings.py` must be `http://localhost:8080` |
| User logs in but blank profile | `cd backend && source venv/bin/activate && python manage.py sync_keycloak` |
| Bot: "No account found" | Save your phone number in Profile on the web app first |
| Bot: 403 errors | `TELEGRAM_BOT_SECRET` mismatch — re-run `./run.sh` to regenerate |

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Make changes and test with `./run.sh`
4. Open a pull request against `main`

Never commit `.env` files, `db.sqlite3`, or anything in `backend/media/`.
