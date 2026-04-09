# CampusOne

A full-stack campus portal for IIT Bombay students — food ordering, lost & found, mess management, help & delivery, contacts, doctors, and a Telegram bot integration.

**Stack:** React (Vite) · Django REST Framework · Keycloak (auth) · PostgreSQL · Docker · Python Telegram Bot

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

### Option A — Single command (recommended)

```bash
git clone <repo-url>
cd CampusOne
chmod +x run.sh
./run.sh
```

The script handles everything automatically:
1. Checks prerequisites
2. Asks if you want the Telegram bot (or use `--bot` / `--no-bot` to skip the prompt)
3. Writes all `.env` files
4. Starts Docker → waits for Keycloak → configures realm
5. Creates Python venv → installs packages → runs migrations
6. Prompts for Django superuser credentials (default: `admin` / `admin`)
7. Syncs users to Keycloak
8. Starts Vite frontend
9. Starts bot (if selected)

Press `Ctrl+C` to stop everything cleanly.

```bash
./run.sh --bot      # always include bot (skips prompt)
./run.sh --no-bot   # always skip bot
./run.sh --reset    # wipe Keycloak DB and reconfigure from scratch
```

---

### Option B — Run each service manually

Use separate terminals for each service.

#### 1. Docker (Keycloak + App DB)

```bash
docker compose up -d
# First time only — configure Keycloak realm:
chmod +x keycloak/setup-realm.sh && ./keycloak/setup-realm.sh
```

Wait ~30s for Keycloak to be ready at http://localhost:8080.
App DB (PostgreSQL) will be available at `localhost:5433`.

#### 2. Django backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
# First time only — create superuser:
DJANGO_SUPERUSER_USERNAME=admin DJANGO_SUPERUSER_PASSWORD=admin \
  DJANGO_SUPERUSER_EMAIL=admin@campusone.local \
  python manage.py createsuperuser --noinput
python manage.py sync_keycloak
python manage.py runserver 0.0.0.0:8000
```

#### 3. React frontend

```bash
cd frontend
npm install
npm run dev
```

#### 4. Telegram bot (optional)

```bash
cd bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# Ensure bot/.env has TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_SECRET set
python bot.py
```

#### Stop Docker when done

```bash
docker compose down
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
| App DB (PostgreSQL) | localhost:5433 | Django database (Docker) |

**Default credentials:**

| | Username | Password |
|---|---|---|
| Keycloak Master Admin | `admin` | `admin` |
| App Login + Django Admin | `admin` (or chosen at first run) | `admin12345` (or chosen at first run) |
| App DB (PostgreSQL) | `admin` | `admin` (db: `campusone`, port `5433`) |

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
| `backend/.env` | `TELEGRAM_BOT_SECRET`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` |
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
| `No module named 'psycopg2'` | `pip install psycopg2-binary` inside backend venv |
| `could not connect to server` (DB) | App DB container not running — `docker compose up -d` |
| `APScheduler failed to start` | `pip install -r requirements.txt` inside backend venv |
| Keycloak not reachable | `docker compose up -d` then wait 30s |
| Redirect loop on login | Re-run `./keycloak/setup-realm.sh` |
| 401 on all API calls | `KEYCLOAK_SERVER_URL` in `backend/campus_portal/settings.py` must be `http://localhost:8080` |
| User logs in but blank profile | `cd backend && source venv/bin/activate && python manage.py sync_keycloak` |
| Bot: "No account found" | Save your phone number in Profile on the web app first |
| Bot: 403 errors | `TELEGRAM_BOT_SECRET` mismatch — re-run `./run.sh` to regenerate |

---

## Full Reset (Clean Slate)

Wipes everything — Docker volumes, databases, venvs, node_modules, caches, and generated env files — so the next `./run.sh` starts completely fresh.

```bash
# Stop all running services first (Ctrl+C if run.sh is active), then:

docker compose down -v                          # stop containers + wipe ALL DB volumes (Keycloak + App DB)

rm -f backend/.env bot/.env frontend/.env.local # generated env files
rm -f .campusone.log .campusone.pids            # log and PID files

rm -rf backend/venv                             # Python virtualenv (backend)
rm -rf bot/venv                                 # Python virtualenv (bot)
rm -rf frontend/node_modules                    # Node dependencies
rm -rf frontend/.vite                           # Vite cache

find . -type d -name __pycache__ \
  -not -path "*/node_modules/*" \
  -exec rm -rf {} + 2>/dev/null || true         # Python bytecode cache

find . -name "*.pyc" \
  -not -path "*/node_modules/*" \
  -delete 2>/dev/null || true
```

Then start fresh:

```bash
./run.sh
```

> **One-liner** (copy-paste the whole block):
> ```bash
> docker compose down -v && \
> rm -f backend/.env bot/.env frontend/.env.local .campusone.log .campusone.pids && \
> rm -rf backend/venv bot/venv frontend/node_modules frontend/.vite frontend/dist && \
> find . -not -path "*/node_modules/*" -not -path "*/.git/*" \
>   \( -type d -name __pycache__ -o -name "*.pyc" \) \
>   -exec rm -rf {} + 2>/dev/null; \
> ./run.sh
> ```

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Make changes and test with `./run.sh`
4. Open a pull request against `main`

Never commit `.env` files, `db.sqlite3`, or anything in `backend/media/`.
