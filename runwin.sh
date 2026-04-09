#!/usr/bin/env bash
# =============================================================================
#   ██████╗ █████╗ ███╗   ███╗██████╗ ██╗   ██╗███████╗ ██████╗ ███╗   ██╗███████╗
#  ██╔════╝██╔══██╗████╗ ████║██╔══██╗██║   ██║██╔════╝██╔═══██╗████╗  ██║██╔════╝
#  ██║     ███████║██╔████╔██║██████╔╝██║   ██║███████╗██║   ██║██╔██╗ ██║█████╗
#  ██║     ██╔══██║██║╚██╔╝██║██╔═══╝ ██║   ██║╚════██║██║   ██║██║╚██╗██║██╔══╝
#  ╚██████╗██║  ██║██║ ╚═╝ ██║██║     ╚██████╔╝███████║╚██████╔╝██║ ╚████║███████╗
#   ╚═════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝      ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝
#
#   CampusOne — Unified Startup Script
#   Handles: Docker · Keycloak · Django · React · Telegram Bot (optional)
#
#   Usage:
#     chmod +x run.sh
#     ./run.sh           — full stack (asks about bot)
#     ./run.sh --no-bot  — skip bot entirely
#     ./run.sh --bot     — include bot (will ask for token if not set)
#     ./run.sh --reset   — wipe Keycloak DB and start fresh
# =============================================================================

set -euo pipefail

# ── Terminal colours ──────────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[0;37m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/.campusone.log"
PIDS_FILE="$SCRIPT_DIR/.campusone.pids"

log()    { echo -e "${DIM}[$(date '+%H:%M:%S')]${RESET} $*" | tee -a "$LOG_FILE"; }
info()   { echo -e "${CYAN}${BOLD}  ➜  ${RESET}${WHITE}$*${RESET}" | tee -a "$LOG_FILE"; }
ok()     { echo -e "${GREEN}${BOLD}  ✔  ${RESET}${GREEN}$*${RESET}" | tee -a "$LOG_FILE"; }
warn()   { echo -e "${YELLOW}${BOLD}  ⚠  ${RESET}${YELLOW}$*${RESET}" | tee -a "$LOG_FILE"; }
err()    { echo -e "${RED}${BOLD}  ✖  ${RESET}${RED}$*${RESET}" | tee -a "$LOG_FILE"; }
step()   { echo -e "\n${BLUE}${BOLD}━━━  $* ${RESET}${DIM}$(printf '%.0s─' {1..40})${RESET}" | tee -a "$LOG_FILE"; }
banner() {
  echo -e "${CYAN}${BOLD}"
  echo "  ╔══════════════════════════════════════════════════════════╗"
  printf "  ║  %-56s  ║\n" "$1"
  echo "  ╚══════════════════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

save_pid() { echo "$1=$2" >> "$PIDS_FILE"; }

die() {
  err "$1"
  echo -e "\n${DIM}Full log: $LOG_FILE${RESET}"
  exit 1
}

# ── Parse args ────────────────────────────────────────────────────────────────
USE_BOT=""
RESET_KEYCLOAK=false

for arg in "$@"; do
  case "$arg" in
    --no-bot)  USE_BOT=false ;;
    --bot)     USE_BOT=true  ;;
    --reset)   RESET_KEYCLOAK=true ;;
    --help|-h)
      echo -e "${BOLD}Usage:${RESET} ./run.sh [--bot | --no-bot] [--reset]"
      echo "  --bot      Include Telegram bot (prompts for token if missing)"
      echo "  --no-bot   Skip Telegram bot entirely"
      echo "  --reset    Wipe Keycloak DB and reconfigure from scratch"
      exit 0
      ;;
  esac
done

# ── Cleanup on Ctrl+C ─────────────────────────────────────────────────────────
cleanup() {
  echo ""
  banner "Shutting Down CampusOne"
  if [[ -f "$PIDS_FILE" ]]; then
    while IFS='=' read -r name pid; do
      if kill -0 "$pid" 2>/dev/null; then
        info "Stopping $name (PID $pid)..."
        kill "$pid" 2>/dev/null || true
      fi
    done < "$PIDS_FILE"
    rm -f "$PIDS_FILE"
  fi
  info "Stopping Docker services..."
  cd "$SCRIPT_DIR" && docker compose down 2>/dev/null || true
  ok "All services stopped. Goodbye."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ─────────────────────────────────────────────────────────────────────────────
# START
# ─────────────────────────────────────────────────────────────────────────────
> "$LOG_FILE"
> "$PIDS_FILE" 2>/dev/null || true

clear
echo -e "${CYAN}${BOLD}"
cat << 'EOF'
   ____                             ___
  / ___|__ _ _ __ ___  _ __  _   _/ _ \ _ __   ___
 | |   / _` | '_ ` _ \| '_ \| | | | | | '_ \ / _ \
 | |__| (_| | | | | | | |_) | |_| | |_| | | |  __/
  \____\__,_|_| |_| |_| .__/ \__,_|\___/|_| |_|\___|
                       |_|
EOF
echo -e "${RESET}${DIM}  Unified Startup · $(date '+%A, %d %B %Y %H:%M')${RESET}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 0 — Prerequisite check
# ─────────────────────────────────────────────────────────────────────────────
step "Checking Prerequisites"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    ok "$1 found: $(command -v "$1")"
  else
    die "$1 is not installed. $2"
  fi
}

check_cmd docker   "Install Docker: https://docs.docker.com/get-docker/"
check_cmd python3  "Install Python 3.11+: https://python.org"
check_cmd node     "Install Node.js 18+: https://nodejs.org"
check_cmd npm      "Install npm (comes with Node.js)"
check_cmd jq       "Install jq: brew install jq"
check_cmd curl     "Install curl: brew install curl"

# Verify Docker daemon is actually running
info "Checking Docker daemon..."
if ! docker info > /dev/null 2>&1; then
  err "Docker daemon is not running."
  echo ""
  echo -e "  ${YELLOW}${BOLD}To fix this:${RESET}"
  echo -e "  ${WHITE}1. Open Docker Desktop from your Applications folder${RESET}"
  echo -e "  ${WHITE}2. Wait for the whale icon to appear in your menu bar${RESET}"
  echo -e "  ${WHITE}3. Re-run: ${BOLD}./run.sh${RESET}"
  echo ""
  exit 1
fi
ok "Docker daemon is running"

# Helper: free a port if something is already listening on it
free_port() {
  local port="$1"
  local name="$2"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    warn "Port $port is already in use by PID(s) $pids — killing for $name..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
    ok "Port $port is now free"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — App account credentials (Keycloak campusone realm login)
# ─────────────────────────────────────────────────────────────────────────────
# NOTE: Keycloak enforces length(8) — password must be ≥8 characters.
# Django admin (/admin) is always:  admin / admin  (no prompt needed)
# ─────────────────────────────────────────────────────────────────────────────
step "App Account Setup"
echo -e "${DIM}  This account is used to log in to the CampusOne app (Keycloak campusone realm)${RESET}"
echo -e "${DIM}  Password must be ≥8 characters. Enter username and password space-separated.${RESET}"
echo ""
read -rp "  Username Password [campusone campusone12345]: " APP_USER APP_PASS
APP_USER="${APP_USER:-campusone}"
APP_PASS="${APP_PASS:-campusone12345}"
ok "App credentials set → ${APP_USER} / ${APP_PASS}"

# Django admin is always admin/admin — hardcoded, separate from app login
DJANGO_ADMIN_USER="admin"
DJANGO_ADMIN_PASS="admin"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Bot mode selection
# ─────────────────────────────────────────────────────────────────────────────
step "Telegram Bot Configuration"

if [[ "$USE_BOT" == "" ]]; then
  echo -e "${WHITE}${BOLD}"
  echo "  Would you like to start the Telegram Bot?"
  echo -e "${RESET}${DIM}  (The bot handles food ordering and delivery notifications via Telegram)${RESET}"
  echo ""
  echo -e "  ${BOLD}[1]${RESET} Yes — start with Telegram Bot"
  echo -e "  ${BOLD}[2]${RESET} No  — start without Telegram Bot"
  echo ""
  read -rp "  Enter choice [1/2]: " bot_choice
  case "$bot_choice" in
    1) USE_BOT=true ;;
    2) USE_BOT=false ;;
    *) warn "Invalid choice — defaulting to no bot."; USE_BOT=false ;;
  esac
fi

if [[ "$USE_BOT" == "true" ]]; then
  BOT_ENV="$SCRIPT_DIR/bot/.env"

  # Read existing token if present
  EXISTING_TOKEN=""
  if [[ -f "$BOT_ENV" ]]; then
    EXISTING_TOKEN=$(grep '^TELEGRAM_BOT_TOKEN=' "$BOT_ENV" 2>/dev/null | cut -d'=' -f2- || true)
  fi

  if [[ -z "$EXISTING_TOKEN" || "$EXISTING_TOKEN" == "YOUR_TOKEN_HERE" ]]; then
    echo ""
    echo -e "${YELLOW}${BOLD}  Telegram Bot Token Required${RESET}"
    echo -e "${DIM}  Get your token from @BotFather on Telegram${RESET}"
    echo -e "${DIM}  Format: 1234567890:ABCDefghIJKlmnOPqrsTUVwxyz${RESET}"
    echo ""
    read -rp "  Paste your Bot Token: " BOT_TOKEN

    if [[ -z "$BOT_TOKEN" ]]; then
      warn "No token provided — skipping bot."
      USE_BOT=false
    else
      ok "Token received."
    fi
  else
    BOT_TOKEN="$EXISTING_TOKEN"
    ok "Using existing bot token from bot/.env"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Write .env files
# ─────────────────────────────────────────────────────────────────────────────
step "Writing Environment Files"

# Generate shared secret if not already set
BACKEND_ENV="$SCRIPT_DIR/backend/.env"
EXISTING_SECRET=""
if [[ -f "$BACKEND_ENV" ]]; then
  EXISTING_SECRET=$(grep '^TELEGRAM_BOT_SECRET=' "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2- || true)
fi

if [[ -z "$EXISTING_SECRET" ]]; then
  BOT_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
  info "Generated new TELEGRAM_BOT_SECRET"
else
  BOT_SECRET="$EXISTING_SECRET"
  info "Using existing TELEGRAM_BOT_SECRET from backend/.env"
fi

# Write backend/.env
cat > "$BACKEND_ENV" << EOF
TELEGRAM_BOT_SECRET=${BOT_SECRET}
DB_NAME=campusone
DB_USER=campusone
DB_PASSWORD=campusone_secret
DB_HOST=localhost
DB_PORT=5433
EOF
ok "backend/.env written"

# Write bot/.env
if [[ "$USE_BOT" == "true" ]]; then
  cat > "$SCRIPT_DIR/bot/.env" << EOF
TELEGRAM_BOT_TOKEN=${BOT_TOKEN}
TELEGRAM_BOT_SECRET=${BOT_SECRET}
DJANGO_API_URL=http://localhost:8000/api
EOF
  ok "bot/.env written"
fi

# Write frontend/.env.local (if missing)
FRONTEND_ENV="$SCRIPT_DIR/frontend/.env.local"
if [[ ! -f "$FRONTEND_ENV" ]]; then
  cat > "$FRONTEND_ENV" << EOF
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=campusone
VITE_KEYCLOAK_CLIENT_ID=campusone-frontend
VITE_API_URL=http://localhost:8000/api
EOF
  ok "frontend/.env.local written"
else
  info "frontend/.env.local already exists — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Docker / Keycloak
# ─────────────────────────────────────────────────────────────────────────────
step "Starting Docker Services (Keycloak + App DB PostgreSQL)"

cd "$SCRIPT_DIR"

if [[ "$RESET_KEYCLOAK" == "true" ]]; then
  warn "Reset flag set — wiping all Docker volumes (Keycloak DB + App DB)..."
  docker compose down -v 2>/dev/null || true
  ok "All DB volumes wiped"
fi

# Start containers
info "Starting containers..."
docker compose up -d >> "$LOG_FILE" 2>&1 || die "Docker Compose failed. Check: $LOG_FILE"
ok "Containers started"

# Wait for app-db to be ready
info "Waiting for app-db (PostgreSQL) to be ready..."
MAX_WAIT_DB=60
WAITED_DB=0
printf "  ${DIM}"
until docker exec campusone-app-db pg_isready -U campusone > /dev/null 2>&1; do
  if [[ $WAITED_DB -ge $MAX_WAIT_DB ]]; then
    echo -e "${RESET}"
    die "App DB did not start within ${MAX_WAIT_DB}s. Check: docker compose logs app-db"
  fi
  printf "·"
  sleep 2
  WAITED_DB=$((WAITED_DB + 2))
done
echo -e "${RESET}"
ok "App DB ready (took ${WAITED_DB}s)"

# Wait for Keycloak to be ready
info "Waiting for Keycloak to be ready..."
MAX_WAIT=90
WAITED=0
printf "  ${DIM}"
until curl -sf http://localhost:8080/realms/master > /dev/null 2>&1; do
  if [[ $WAITED -ge $MAX_WAIT ]]; then
    echo -e "${RESET}"
    die "Keycloak did not start within ${MAX_WAIT}s. Check Docker logs: docker compose logs keycloak"
  fi
  printf "·"
  sleep 2
  WAITED=$((WAITED + 2))
done
echo -e "${RESET}"
ok "Keycloak is up (took ${WAITED}s)"

# Check if realm already configured
REALM_EXISTS=$(curl -sf http://localhost:8080/realms/campusone 2>/dev/null | jq -r '.realm' 2>/dev/null || echo "")
if [[ "$REALM_EXISTS" == "campusone" ]]; then
  ok "Keycloak realm 'campusone' already configured — skipping setup"
else
  info "Configuring Keycloak realm..."
  chmod +x "$SCRIPT_DIR/keycloak/setup-realm.sh"
  APP_ADMIN_USER="$APP_USER" APP_ADMIN_PASS="$APP_PASS" \
    "$SCRIPT_DIR/keycloak/setup-realm.sh" >> "$LOG_FILE" 2>&1 || die "Keycloak realm setup failed. Check: $LOG_FILE"
  ok "Keycloak realm configured"
fi

# Always sync admin user into campusone realm with the chosen credentials
info "Syncing admin user '${APP_USER}' into Keycloak campusone realm..."
KC_TOKEN=$(curl -s -X POST "http://localhost:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin" \
  | jq -r '.access_token')

KC_USER_ID=$(curl -s "http://localhost:8080/admin/realms/campusone/users?username=${APP_USER}&exact=true" \
  -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
  | jq -r '.[0].id // empty')

if [[ -z "$KC_USER_ID" ]]; then
  curl -s -o /dev/null -X POST "http://localhost:8080/admin/realms/campusone/users" \
    -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
    -d "{\"username\":\"${APP_USER}\",\"email\":\"${APP_USER}@campusone.local\",\"firstName\":\"Campus\",\"lastName\":\"Admin\",\"enabled\":true,\"emailVerified\":true,\"credentials\":[{\"type\":\"password\",\"value\":\"${APP_PASS}\",\"temporary\":false}]}"
  KC_USER_ID=$(curl -s "http://localhost:8080/admin/realms/campusone/users?username=${APP_USER}&exact=true" \
    -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
    | jq -r '.[0].id')
  ok "Keycloak campusone user '${APP_USER}' created"
else
  curl -s -o /dev/null -X PUT "http://localhost:8080/admin/realms/campusone/users/${KC_USER_ID}/reset-password" \
    -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
    -d "{\"type\":\"password\",\"value\":\"${APP_PASS}\",\"temporary\":false}"
  ok "Keycloak campusone user '${APP_USER}' password synced"
fi

# Assign campus-staff role (idempotent — Keycloak ignores duplicates)
ROLE_REP=$(curl -s "http://localhost:8080/admin/realms/campusone/roles/campus-staff" \
  -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json")
curl -s -o /dev/null -X POST \
  "http://localhost:8080/admin/realms/campusone/users/${KC_USER_ID}/role-mappings/realm" \
  -H "Authorization: Bearer $KC_TOKEN" -H "Content-Type: application/json" \
  -d "[$ROLE_REP]"
ok "campus-staff role ensured for '${APP_USER}'"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Backend (Python / Django)
# ─────────────────────────────────────────────────────────────────────────────
step "Setting Up Django Backend"

BACKEND_DIR="$SCRIPT_DIR/backend"
cd "$BACKEND_DIR"

# Create venv if missing
if [[ ! -d "venv" ]]; then
  info "Creating Python virtual environment..."
  python3 -m venv venv >> "$LOG_FILE" 2>&1 || die "Failed to create venv"
  ok "Virtual environment created"
else
  info "Virtual environment already exists"
fi

# Activate venv (Scripts/ on Windows, bin/ on Unix)
source venv/Scripts/activate 2>/dev/null || source venv/bin/activate

# Install / update packages
info "Installing Python dependencies..."
python -m pip install --quiet --upgrade pip >> "$LOG_FILE" 2>&1 || true
python -m pip install --quiet -r requirements.txt >> "$LOG_FILE" 2>&1 || die "pip install failed. Check: $LOG_FILE"
ok "Python dependencies installed"

# Run migrations
info "Running database migrations..."
python manage.py migrate --no-input >> "$LOG_FILE" 2>&1 || die "Migrations failed. Check: $LOG_FILE"
ok "Migrations applied"

# Always ensure Django superuser (admin/admin) for /admin panel
info "Ensuring Django superuser '${DJANGO_ADMIN_USER}'..."
python manage.py shell -c "
from api.models import User
u, created = User.objects.get_or_create(username='${DJANGO_ADMIN_USER}', defaults={'email': '${DJANGO_ADMIN_USER}@campusone.local'})
u.set_password('${DJANGO_ADMIN_PASS}')
u.is_superuser = True
u.is_staff = True
u.save()
print('created' if created else 'updated')
" 2>/dev/null | tail -1 | grep -q "created\|updated" \
  && ok "Django superuser '${DJANGO_ADMIN_USER}' ready (${DJANGO_ADMIN_PASS})" \
  || warn "Django superuser setup failed — check $LOG_FILE"

# Sync users to Keycloak
info "Syncing users to Keycloak..."
python manage.py sync_keycloak >> "$LOG_FILE" 2>&1 || warn "sync_keycloak failed (non-fatal) — check $LOG_FILE"
ok "Keycloak sync done"

# Ensure port 8000 is free before starting Django
free_port 8000 "Django"

# Start Django in background
info "Starting Django development server..."
python manage.py runserver 0.0.0.0:8000 >> "$LOG_FILE" 2>&1 &
DJANGO_PID=$!
save_pid "Django" "$DJANGO_PID"
sleep 2

if kill -0 "$DJANGO_PID" 2>/dev/null; then
  ok "Django running (PID $DJANGO_PID) → http://localhost:8000"
else
  die "Django failed to start. Check: $LOG_FILE"
fi

deactivate

# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Frontend (Node / Vite)
# ─────────────────────────────────────────────────────────────────────────────
step "Setting Up React Frontend"

FRONTEND_DIR="$SCRIPT_DIR/frontend"
cd "$FRONTEND_DIR"

info "Installing Node.js dependencies..."
npm install --silent >> "$LOG_FILE" 2>&1 || die "npm install failed. Check: $LOG_FILE"
ok "Node dependencies installed"

free_port 5173 "Vite"
info "Starting Vite dev server..."
npm run dev >> "$LOG_FILE" 2>&1 &
VITE_PID=$!
save_pid "Frontend" "$VITE_PID"
sleep 3

if kill -0 "$VITE_PID" 2>/dev/null; then
  ok "Frontend running (PID $VITE_PID) → http://localhost:5173"
else
  die "Frontend (Vite) failed to start. Check: $LOG_FILE"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 7 — Telegram Bot (optional)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$USE_BOT" == "true" ]]; then
  step "Setting Up Telegram Bot"

  BOT_DIR="$SCRIPT_DIR/bot"
  cd "$BOT_DIR"

  if [[ ! -d "venv" ]]; then
    info "Creating bot virtual environment..."
    python3 -m venv venv >> "$LOG_FILE" 2>&1 || die "Failed to create bot venv"
    ok "Bot virtual environment created"
  else
    info "Bot virtual environment already exists"
  fi

  source venv/Scripts/activate 2>/dev/null || source venv/bin/activate

  info "Installing bot dependencies..."
  python -m pip install --quiet --upgrade pip >> "$LOG_FILE" 2>&1 || true
  python -m pip install --quiet -r requirements.txt >> "$LOG_FILE" 2>&1 || die "Bot pip install failed. Check: $LOG_FILE"
  ok "Bot dependencies installed"

  info "Starting Telegram bot..."
  python bot.py >> "$LOG_FILE" 2>&1 &
  BOT_PID=$!
  save_pid "TelegramBot" "$BOT_PID"
  sleep 3

  if kill -0 "$BOT_PID" 2>/dev/null; then
    ok "Telegram bot running (PID $BOT_PID)"
  else
    warn "Telegram bot failed to start. Check: $LOG_FILE"
    warn "The rest of the stack is still running."
  fi

  deactivate
fi

# ─────────────────────────────────────────────────────────────────────────────
# DONE — Print service summary
# ─────────────────────────────────────────────────────────────────────────────
cd "$SCRIPT_DIR"
echo ""
echo -e "${GREEN}${BOLD}"
echo "  ╔══════════════════════════════════════════════════════════════════╗"
echo "  ║                                                                  ║"
echo "  ║              ✔  CampusOne is Running                            ║"
echo "  ║                                                                  ║"
echo "  ╠══════════════════════════════════════════════════════════════════╣"
echo -e "  ║  ${RESET}${CYAN}  App (Frontend)${GREEN}${BOLD}      →  http://localhost:5173               ║"
echo -e "  ║  ${RESET}${CYAN}  Backend API${GREEN}${BOLD}         →  http://localhost:8000/api          ║"
echo -e "  ║  ${RESET}${CYAN}  Django Admin${GREEN}${BOLD}        →  http://localhost:8000/admin        ║"
echo -e "  ║  ${RESET}${CYAN}  Keycloak Console${GREEN}${BOLD}    →  http://localhost:8080/admin        ║"
if [[ "$USE_BOT" == "true" ]]; then
echo -e "  ║  ${RESET}${CYAN}  Telegram Bot${GREEN}${BOLD}        →  Running                           ║"
fi
echo -e "  ║  ${RESET}${DIM}  Log file${GREEN}${BOLD}            →  .campusone.log                   ║"
echo "  ║                                                                  ║"
echo "  ╠══════════════════════════════════════════════════════════════════╣"
echo -e "  ║  ${RESET}${YELLOW}  Keycloak Master Admin${GREEN}${BOLD} admin / admin                      ║"
echo -e "  ║  ${RESET}${YELLOW}  Django Admin (/admin)${GREEN}${BOLD} ${DJANGO_ADMIN_USER} / ${DJANGO_ADMIN_PASS}                      ║"
echo -e "  ║  ${RESET}${YELLOW}  App Login (Keycloak)${GREEN}${BOLD}  ${APP_USER} / ${APP_PASS}              ║"
echo -e "  ║  ${RESET}${YELLOW}  App DB (PostgreSQL)${GREEN}${BOLD}   campusone / campusone_secret :5433  ║"
echo "  ║                                                                  ║"
echo -e "  ║  ${RESET}${DIM}  Press Ctrl+C to stop all services${GREEN}${BOLD}                       ║"
echo "  ╚══════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# Keep script alive (so Ctrl+C triggers cleanup)
wait
