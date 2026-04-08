#!/usr/bin/env python3
"""
CampusOne — Telegram Bot Setup
Run this once with your bot token and it configures everything.

Usage:
    python setup_bot.py <YOUR_BOT_TOKEN>
"""

import sys
import os
import secrets
import pathlib

ROOT = pathlib.Path(__file__).parent

def main():
    # ── Get token ────────────────────────────────────────────────────────────
    if len(sys.argv) < 2:
        token = input("Paste your Telegram Bot Token: ").strip()
    else:
        token = sys.argv[1].strip()

    if not token or ':' not in token:
        print("❌  That doesn't look like a valid bot token (should contain ':')")
        sys.exit(1)

    # ── Generate a shared secret ─────────────────────────────────────────────
    bot_secret = secrets.token_hex(32)

    # ── Write bot/.env ────────────────────────────────────────────────────────
    bot_env = ROOT / 'bot' / '.env'
    bot_env.write_text(
        f"TELEGRAM_BOT_TOKEN={token}\n"
        f"TELEGRAM_BOT_SECRET={bot_secret}\n"
        f"DJANGO_API_URL=http://localhost:8000/api\n"
    )
    print(f"✅  Written:  {bot_env}")

    # ── Write backend/.env (Django reads it via os.environ.get) ──────────────
    backend_env = ROOT / 'backend' / '.env'
    backend_env.write_text(
        f"TELEGRAM_BOT_SECRET={bot_secret}\n"
    )
    print(f"✅  Written:  {backend_env}")

    # ── Patch Django settings to load .env ───────────────────────────────────
    settings_path = ROOT / 'backend' / 'campus_portal' / 'settings.py'
    settings_text = settings_path.read_text()

    load_env_snippet = (
        "from dotenv import load_dotenv\n"
        "load_dotenv(BASE_DIR / '.env')\n"
    )
    if 'load_dotenv' not in settings_text:
        # Insert right after the BASE_DIR line
        settings_text = settings_text.replace(
            "BASE_DIR = Path(__file__).resolve().parent.parent",
            "BASE_DIR = Path(__file__).resolve().parent.parent\n\n"
            + load_env_snippet,
        )
        settings_path.write_text(settings_text)
        print(f"✅  Patched:  {settings_path}  (added load_dotenv)")
    else:
        print(f"ℹ️   Skipped:  settings.py already loads dotenv")

    # ── Install python-dotenv in backend venv if missing ─────────────────────
    venv_pip = ROOT / 'backend' / 'venv' / 'bin' / 'pip'
    if venv_pip.exists():
        os.system(f'"{venv_pip}" install python-dotenv -q')
        print(f"✅  Ensured:  python-dotenv installed in backend venv")
    else:
        print(f"⚠️   Could not find backend venv pip — run manually:")
        print(f"       pip install python-dotenv")

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print("━" * 52)
    print("  Setup complete! Start everything with:")
    print()
    print("  Terminal 1 — Keycloak:")
    print("    docker compose up -d")
    print()
    print("  Terminal 2 — Django:")
    print("    cd backend")
    print("    source venv/bin/activate")
    print("    python manage.py runserver")
    print()
    print("  Terminal 3 — Bot:")
    print("    cd bot")
    print("    source venv/bin/activate   # or: venv\\Scripts\\activate")
    print("    python bot.py")
    print("━" * 52)

if __name__ == '__main__':
    main()
