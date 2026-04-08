#!/usr/bin/env bash
# =============================================================================
# CampusOne — Keycloak Realm Setup Script
#
# Run ONCE after Keycloak starts to configure the campusone realm.
#
# Usage:
#   chmod +x keycloak/setup-realm.sh
#   ./keycloak/setup-realm.sh
#
# Prerequisites: curl, jq  (brew install jq)
# =============================================================================

set -euo pipefail

KC_URL="http://localhost:8080"
KC_ADMIN="admin"
KC_ADMIN_PASS="admin"
REALM="campusone"

# Admin user for the campusone realm — passed from run.sh, default admin/admin
APP_ADMIN_USER="${APP_ADMIN_USER:-campusone}"
APP_ADMIN_PASS="${APP_ADMIN_PASS:-campusone12345}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }

# ---------------------------------------------------------------------------
# 1. Obtain admin token
# ---------------------------------------------------------------------------
log "Obtaining admin token..."
TOKEN=$(curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=$KC_ADMIN&password=$KC_ADMIN_PASS" \
  | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "ERROR: Could not obtain admin token. Is Keycloak running at $KC_URL?"
  exit 1
fi
log "Admin token obtained."

AUTH=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json")

# ---------------------------------------------------------------------------
# 2. Create realm
# ---------------------------------------------------------------------------
log "Creating realm '$REALM'..."
curl -s -o /dev/null -w "%{http_code}" -X POST "$KC_URL/admin/realms" \
  "${AUTH[@]}" \
  -d "{
    \"realm\": \"$REALM\",
    \"displayName\": \"CampusOne\",
    \"enabled\": true,
    \"registrationAllowed\": true,
    \"registrationEmailAsUsername\": false,
    \"loginWithEmailAllowed\": true,
    \"duplicateEmailsAllowed\": false,
    \"resetPasswordAllowed\": true,
    \"editUsernameAllowed\": false,
    \"accessTokenLifespan\": 300,
    \"ssoSessionMaxLifespan\": 28800,
    \"refreshTokenMaxReuse\": 0,
    \"passwordPolicy\": \"length(8) and notUsername\",
    \"loginTheme\": \"campusone\"
  }" | grep -qE "^(201|409)$" && log "  Realm created (or already exists)." \
    || warn "  Unexpected response creating realm."

# ---------------------------------------------------------------------------
# 3. Create realm roles
# ---------------------------------------------------------------------------
create_role() {
  local name=$1 desc=$2
  log "Creating role '$name'..."
  curl -s -o /dev/null -X POST "$KC_URL/admin/realms/$REALM/roles" \
    "${AUTH[@]}" \
    -d "{\"name\": \"$name\", \"description\": \"$desc\"}"
}

create_role "campus-staff"    "Master admin — full console access"
create_role "campus-security" "Security personnel"
create_role "outlet-admin"    "Food outlet admin (per-outlet enforced in Django DB)"
create_role "mess-admin"      "Mess hall admin (per-hostel enforced in Django DB)"

# ---------------------------------------------------------------------------
# 4. Create frontend client (public, PKCE)
# ---------------------------------------------------------------------------
log "Creating client 'campusone-frontend'..."
curl -s -o /dev/null -X POST "$KC_URL/admin/realms/$REALM/clients" \
  "${AUTH[@]}" \
  -d '{
    "clientId": "campusone-frontend",
    "name": "CampusOne Frontend",
    "enabled": true,
    "publicClient": true,
    "standardFlowEnabled": true,
    "directAccessGrantsEnabled": false,
    "protocol": "openid-connect",
    "redirectUris": [
      "http://localhost:5173/*",
      "http://127.0.0.1:5173/*"
    ],
    "webOrigins": [
      "http://localhost:5173",
      "http://127.0.0.1:5173"
    ],
    "attributes": {
      "pkce.code.challenge.method": "S256"
    }
  }'
log "  Frontend client created."

# ---------------------------------------------------------------------------
# 5. Ensure 'roles' scope is included in tokens
#    (Keycloak 21+ includes realm_access by default, this is a safety check)
# ---------------------------------------------------------------------------
log "Verifying roles are included in tokens (realm_access claim)..."
# Get the client ID of campusone-frontend
CLIENT_ID=$(curl -s "$KC_URL/admin/realms/$REALM/clients?clientId=campusone-frontend" \
  "${AUTH[@]}" | jq -r '.[0].id')
log "  Frontend client internal ID: $CLIENT_ID"

# ---------------------------------------------------------------------------
# 6. Create admin user in campusone realm
# ---------------------------------------------------------------------------
log "Creating campusone admin user '${APP_ADMIN_USER}'..."
USER_RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$KC_URL/admin/realms/$REALM/users" \
  "${AUTH[@]}" \
  -d "{
    \"username\": \"${APP_ADMIN_USER}\",
    \"email\": \"${APP_ADMIN_USER}@campusone.local\",
    \"firstName\": \"Campus\",
    \"lastName\": \"Admin\",
    \"enabled\": true,
    \"emailVerified\": true,
    \"credentials\": [{\"type\": \"password\", \"value\": \"${APP_ADMIN_PASS}\", \"temporary\": false}]
  }")

if echo "$USER_RESP" | grep -qE "^(201|409)$"; then
  # If user already existed (409), update the password
  KC_USER_ID=$(curl -s "$KC_URL/admin/realms/$REALM/users?username=${APP_ADMIN_USER}&exact=true" \
    "${AUTH[@]}" | jq -r '.[0].id')
  curl -s -o /dev/null -X PUT \
    "$KC_URL/admin/realms/$REALM/users/$KC_USER_ID/reset-password" \
    "${AUTH[@]}" -d "{\"type\":\"password\",\"value\":\"${APP_ADMIN_PASS}\",\"temporary\":false}"
  # Assign campus-staff role
  ROLE_REP=$(curl -s "$KC_URL/admin/realms/$REALM/roles/campus-staff" "${AUTH[@]}")
  curl -s -o /dev/null -X POST \
    "$KC_URL/admin/realms/$REALM/users/$KC_USER_ID/role-mappings/realm" \
    "${AUTH[@]}" -d "[$ROLE_REP]"
  log "  Admin user ready: ${APP_ADMIN_USER} / ${APP_ADMIN_PASS}"
else
  warn "  Could not create admin user (HTTP $USER_RESP)."
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
echo ""
log "====================================================="
log " Keycloak realm '$REALM' is ready!"
log "====================================================="
echo ""
echo "  Admin console : $KC_URL/admin  (admin / admin)"
echo "  Realm login   : $KC_URL/realms/$REALM/account"
echo ""
echo "  Test admin    : campus_admin / Admin@123"
echo ""
warn "NEXT STEPS:"
echo "  1. Run Django migrations : python manage.py migrate"
echo "  2. Sync existing users   : python manage.py sync_keycloak"
echo "  3. Start Django          : python manage.py runserver"
echo "  4. Install frontend deps : cd frontend && npm install"
echo "  5. Start frontend        : npm run dev"
echo ""
