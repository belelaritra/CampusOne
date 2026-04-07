# Keycloak Integration — CampusOne

## What Changed

| Area | Before | After |
|---|---|---|
| Auth tokens | Simple JWT (Django-issued) | Keycloak RS256 JWTs |
| Login / Register | Custom Django views + React forms | Keycloak hosted UI |
| Password reset | Custom token model + manual flow | Keycloak built-in email flow |
| Token refresh | `POST /api/auth/refresh/` | `keycloak.updateToken()` internally |
| Role management | Django flags + DB records | Keycloak realm roles → synced to Django |
| Per-outlet/hostel access | `OutletAdmin`, `MessAdminProfile` DB tables | **Unchanged** — still Django DB |

## Removed Endpoints

```
DELETE  /api/auth/register/
DELETE  /api/auth/login/
DELETE  /api/auth/logout/
DELETE  /api/auth/refresh/
DELETE  /api/auth/change-password/
DELETE  /api/auth/forgot-password/
DELETE  /api/auth/reset-password/
```

`GET/PATCH /api/auth/me/` still exists — returns the Django-side profile (photo, roll number, hostel, etc.)

---

## First-Time Setup

### Prerequisites

- Docker + Docker Compose
- Python 3.11+
- Node.js 18+
- `jq` (`brew install jq`)

---

### Step 1 — Start Keycloak

The custom CampusOne theme (`keycloak/themes/campusone/`) is automatically
mounted into the container via the volume in `docker-compose.yml`. No extra
copy step needed.

```bash
# From project root
docker compose up -d
```

Wait ~30 seconds for Keycloak to be ready, then verify:

```bash
curl -s http://localhost:8080/realms/master | jq .realm
# should print: "master"
```

---

### Step 2 — Configure Keycloak Realm

```bash
./keycloak/setup-realm.sh
```

This creates:
- Realm: `campusone`
- Client: `campusone-frontend` (public, PKCE)
- Roles: `campus-staff`, `campus-security`, `outlet-admin`, `mess-admin`
- Test admin user: `campus_admin` / `Admin@123` (with `campus-staff` role)
- Login theme set to **campusone** (custom IIT Bombay–styled UI)

---

### Step 3 — Backend

```bash
cd backend
```

**If you don't have a venv yet — create one:**

```bash
python3 -m venv venv
```

**Activate the venv:**

```bash
# macOS / Linux
source venv/bin/activate

# Windows (cmd)
venv\Scripts\activate.bat

# Windows (PowerShell)
venv\Scripts\Activate.ps1
```

You should see `(venv)` in your terminal prompt.

```bash
pip install -r requirements.txt

python manage.py migrate

# Migrate existing Django users into Keycloak (run once)
python manage.py sync_keycloak

python manage.py runserver
```

> `sync_keycloak` creates a Keycloak account for every existing Django user,
> assigns their roles, and writes back the Keycloak UUID to `User.keycloak_id`.
> All synced users get a temporary password `ChangeMe@123!` and must reset it on first login.

---

### Step 4 — Frontend

```bash
cd frontend
npm install       # installs keycloak-js
npm run dev
```

---

### Step 5 — Open the App

```
http://localhost:5173
```

You will be redirected to Keycloak's login page. Log in with:
- `campus_admin` / `Admin@123` — for staff/admin access
- Any synced user — with their temporary password

---

## Assigning Roles to Users

Go to Keycloak Admin Console → `http://localhost:8080/admin`
- Login: `admin` / `admin`
- Navigate: `campusone` realm → Users → select user → Role Mapping tab
- Assign: `campus-staff`, `campus-security`, `outlet-admin`, or `mess-admin`

Role changes take effect on the user's **next login** (token re-issue).

> For `outlet-admin` and `mess-admin`: the Keycloak role grants coarse access.
> Which specific outlet/hostel a user manages is still controlled by the
> `OutletAdmin` and `MessAdminProfile` tables in Django — assign those via Django Admin.

---

## New Files

```
backend/api/keycloak_authentication.py     # Custom DRF auth backend (JWT validation + user provisioning)
backend/api/migrations/0013_keycloak_integration.py  # Adds keycloak_id, removes PasswordResetToken
backend/api/management/commands/sync_keycloak.py     # One-time user migration command
frontend/src/keycloak.js                   # Keycloak JS adapter singleton
frontend/public/silent-check-sso.html     # Required for silent SSO session detection
docker-compose.yml                         # Keycloak + PostgreSQL
keycloak/setup-realm.sh                    # Realm/client/roles setup script
```

---

## Environment Variables (optional overrides)

**Frontend** — create `frontend/.env.local`:
```
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=campusone
VITE_KEYCLOAK_CLIENT_ID=campusone-frontend
VITE_API_URL=http://localhost:8000/api
```

**Backend** — edit `backend/campus_portal/settings.py`:
```python
KEYCLOAK_SERVER_URL = 'http://localhost:8080'
KEYCLOAK_REALM      = 'campusone'
KEYCLOAK_CLIENT_ID  = 'campusone-frontend'
```

---

## Useful Commands

```bash
# Sync only new users (skips users who already have keycloak_id)
python manage.py sync_keycloak

# Dry run — see what would be synced without making changes
python manage.py sync_keycloak --dry-run

# Custom Keycloak admin credentials
python manage.py sync_keycloak --admin-user admin --admin-password yourpassword

# Stop Keycloak
docker compose down

# Wipe Keycloak DB (start fresh)
docker compose down -v
```

---

## Quick Troubleshoot

| Problem | Fix |
|---|---|
| "Unable to connect to authentication service" | Keycloak not running — `docker compose up -d` |
| Redirect loop on login | Keycloak realm or client not created — re-run `setup-realm.sh` |
| 401 on all API calls | Django `KEYCLOAK_SERVER_URL` doesn't match running Keycloak |
| "Token signing key not found" | JWKS cache stale — restart Django |
| User logs in but gets blank profile | Run `python manage.py sync_keycloak` to link existing users |
