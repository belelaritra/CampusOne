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

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Bot mode selection
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
# STEP 2 — Write .env files
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
# STEP 3 — Docker / Keycloak
# ─────────────────────────────────────────────────────────────────────────────
step "Starting Docker Services (Keycloak + PostgreSQL)"

cd "$SCRIPT_DIR"

if [[ "$RESET_KEYCLOAK" == "true" ]]; then
  warn "Reset flag set — wiping Keycloak database..."
  docker compose down -v 2>/dev/null || true
  ok "Keycloak DB wiped"
fi

# Start containers
info "Starting containers..."
docker compose up -d >> "$LOG_FILE" 2>&1 || die "Docker Compose failed. Check: $LOG_FILE"
ok "Containers started"

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
  "$SCRIPT_DIR/keycloak/setup-realm.sh" >> "$LOG_FILE" 2>&1 || die "Keycloak realm setup failed. Check: $LOG_FILE"
  ok "Keycloak realm configured"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Backend (Python / Django)
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

# Activate venv
source venv/bin/activate

# Install / update packages
info "Installing Python dependencies..."
pip install --quiet --upgrade pip >> "$LOG_FILE" 2>&1
pip install --quiet -r requirements.txt >> "$LOG_FILE" 2>&1 || die "pip install failed. Check: $LOG_FILE"
ok "Python dependencies installed"

# Run migrations
info "Running database migrations..."
python manage.py migrate --no-input >> "$LOG_FILE" 2>&1 || die "Migrations failed. Check: $LOG_FILE"
ok "Migrations applied"

# Create superuser if none exists
SUPERUSER_COUNT=$(python manage.py shell -c "from api.models import User; print(User.objects.filter(is_superuser=True).count())" 2>/dev/null || echo "0")
if [[ "$SUPERUSER_COUNT" == "0" ]]; then
  echo ""
  echo -e "${YELLOW}${BOLD}  No superuser found — create one now${RESET}"
  echo -e "${DIM}  This account will be used to access /admin and the Django Admin panel${RESET}"
  echo ""
  python manage.py createsuperuser || warn "Superuser creation skipped"
else
  info "Superuser already exists — skipping"
fi

# Sync users to Keycloak (skip if already done)
info "Syncing users to Keycloak (--dry-run safe)..."
python manage.py sync_keycloak >> "$LOG_FILE" 2>&1 || warn "sync_keycloak failed (non-fatal) — check $LOG_FILE"
ok "Keycloak sync done"

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
# STEP 5 — Frontend (Node / Vite)
# ─────────────────────────────────────────────────────────────────────────────
step "Setting Up React Frontend"

FRONTEND_DIR="$SCRIPT_DIR/frontend"
cd "$FRONTEND_DIR"

info "Installing Node.js dependencies..."
npm install --silent >> "$LOG_FILE" 2>&1 || die "npm install failed. Check: $LOG_FILE"
ok "Node dependencies installed"

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
# STEP 6 — Telegram Bot (optional)
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

  source venv/bin/activate

  info "Installing bot dependencies..."
  pip install --quiet --upgrade pip >> "$LOG_FILE" 2>&1
  pip install --quiet -r requirements.txt >> "$LOG_FILE" 2>&1 || die "Bot pip install failed. Check: $LOG_FILE"
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
echo -e "  ║  ${RESET}${YELLOW}  Keycloak Admin Login${GREEN}${BOLD}  admin / admin                      ║"
echo -e "  ║  ${RESET}${YELLOW}  Test Staff Login${GREEN}${BOLD}      campus_admin / Admin@123           ║"
echo "  ║                                                                  ║"
echo -e "  ║  ${RESET}${DIM}  Press Ctrl+C to stop all services${GREEN}${BOLD}                       ║"
echo "  ╚══════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# Keep script alive (so Ctrl+C triggers cleanup)
wait
