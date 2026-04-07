"""
Management command: sync_keycloak

Migrates existing Django users into the Keycloak realm and assigns roles.
Run this ONCE after standing up Keycloak to bootstrap existing accounts.

Usage:
    python manage.py sync_keycloak
    python manage.py sync_keycloak --dry-run
    python manage.py sync_keycloak --admin-user admin --admin-password admin

What it does:
  1. Obtains an admin access token from Keycloak (master realm).
  2. For each active Django user, creates a corresponding Keycloak user
     (skips users who already have a keycloak_id set).
  3. Assigns Keycloak realm roles based on is_staff / is_security flags
     and OutletAdmin / MessAdminProfile DB records.
  4. Writes the returned Keycloak UUID back to User.keycloak_id.

Note: Passwords cannot be migrated (Django uses one-way hashes).
      Each migrated user will receive a "temporary password" prompt on
      first Keycloak login — they must reset via Keycloak's built-in flow.
"""
import logging

import requests
from django.conf import settings
from django.core.management.base import BaseCommand

from api.models import User, OutletAdmin, MessAdminProfile

logger = logging.getLogger(__name__)

KC_URL   = settings.KEYCLOAK_SERVER_URL
KC_REALM = settings.KEYCLOAK_REALM


# ---------------------------------------------------------------------------
# Keycloak Admin API helpers
# ---------------------------------------------------------------------------

def _admin_token(admin_user: str, admin_password: str) -> str:
    """Obtain a short-lived admin token from the Keycloak master realm."""
    resp = requests.post(
        f"{KC_URL}/realms/master/protocol/openid-connect/token",
        data={
            "grant_type": "password",
            "client_id":  "admin-cli",
            "username":   admin_user,
            "password":   admin_password,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def _admin_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _get_realm_roles(token: str) -> dict:
    """Return a mapping of role_name → role_representation."""
    resp = requests.get(
        f"{KC_URL}/admin/realms/{KC_REALM}/roles",
        headers=_admin_headers(token),
        timeout=10,
    )
    resp.raise_for_status()
    return {r["name"]: r for r in resp.json()}


def _find_kc_user(token: str, username: str) -> str | None:
    """Return Keycloak user id for the given username, or None."""
    resp = requests.get(
        f"{KC_URL}/admin/realms/{KC_REALM}/users",
        headers=_admin_headers(token),
        params={"username": username, "exact": "true"},
        timeout=10,
    )
    resp.raise_for_status()
    users = resp.json()
    return users[0]["id"] if users else None


def _create_kc_user(token: str, user: User) -> str:
    """Create a Keycloak user and return their UUID."""
    payload = {
        "username":      user.username,
        "email":         user.email,
        "firstName":     user.first_name or "",
        "lastName":      user.last_name  or "",
        "enabled":       True,
        "emailVerified": bool(user.email),
        "attributes": {
            "full_name":   [user.full_name   or ""],
            "roll_number": [user.roll_number or ""],
            "hostel":      [user.hostel      or ""],
            "phone":       [user.phone_number or ""],
        },
        # Force password reset on first login
        "requiredActions": ["UPDATE_PASSWORD"],
        "credentials": [
            {
                "type":      "password",
                "value":     "ChangeMe@123!",
                "temporary": True,
            }
        ],
    }
    resp = requests.post(
        f"{KC_URL}/admin/realms/{KC_REALM}/users",
        headers=_admin_headers(token),
        json=payload,
        timeout=10,
    )
    if resp.status_code == 409:
        # User already exists — fetch their id
        kc_id = _find_kc_user(token, user.username)
        if kc_id:
            return kc_id
    resp.raise_for_status()

    # Keycloak returns 201 with Location header containing the new user's URL
    location = resp.headers.get("Location", "")
    kc_id = location.rstrip("/").split("/")[-1]
    return kc_id


def _assign_roles(token: str, kc_user_id: str, role_names: list, all_roles: dict):
    """Assign a list of realm roles to a Keycloak user."""
    roles_to_assign = [all_roles[r] for r in role_names if r in all_roles]
    if not roles_to_assign:
        return
    resp = requests.post(
        f"{KC_URL}/admin/realms/{KC_REALM}/users/{kc_user_id}/role-mappings/realm",
        headers=_admin_headers(token),
        json=roles_to_assign,
        timeout=10,
    )
    resp.raise_for_status()


def _determine_roles(user: User) -> list:
    """Return the Keycloak realm roles that this Django user should have."""
    roles = []
    if user.is_staff:
        roles.append("campus-staff")
    if user.is_security:
        roles.append("campus-security")
    if OutletAdmin.objects.filter(user=user).exists():
        roles.append("outlet-admin")
    if MessAdminProfile.objects.filter(user=user).exists():
        roles.append("mess-admin")
    return roles


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = (
        "Sync existing Django users into Keycloak and assign realm roles. "
        "Run once after setting up Keycloak."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--admin-user",
            default="admin",
            help="Keycloak master-realm admin username (default: admin)",
        )
        parser.add_argument(
            "--admin-password",
            default="admin",
            help="Keycloak master-realm admin password (default: admin)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be done without making any changes.",
        )

    def handle(self, *args, **options):
        dry_run        = options["dry_run"]
        admin_user     = options["admin_user"]
        admin_password = options["admin_password"]

        self.stdout.write(self.style.MIGRATE_HEADING("CampusOne → Keycloak user sync"))
        if dry_run:
            self.stdout.write(self.style.WARNING("  DRY RUN — no changes will be made.\n"))

        # Obtain admin token
        try:
            token = _admin_token(admin_user, admin_password)
        except requests.HTTPError as exc:
            self.stderr.write(
                self.style.ERROR(f"Failed to authenticate with Keycloak: {exc}")
            )
            return
        self.stdout.write("  Admin token obtained.")

        # Fetch all realm roles once
        try:
            all_roles = _get_realm_roles(token)
        except requests.HTTPError as exc:
            self.stderr.write(self.style.ERROR(f"Failed to fetch realm roles: {exc}"))
            return
        self.stdout.write(f"  Realm roles available: {list(all_roles.keys())}\n")

        users = User.objects.filter(is_active=True)
        ok = skipped = failed = 0

        for user in users:
            if user.keycloak_id:
                self.stdout.write(f"  SKIP   {user.username!r} (keycloak_id already set)")
                skipped += 1
                continue

            roles = _determine_roles(user)
            self.stdout.write(
                f"  SYNC   {user.username!r} → roles={roles or ['(none)']}"
            )

            if dry_run:
                ok += 1
                continue

            try:
                kc_id = _create_kc_user(token, user)
                if roles:
                    _assign_roles(token, kc_id, roles, all_roles)

                # Write keycloak_id back to Django
                User.objects.filter(pk=user.pk).update(keycloak_id=kc_id)
                self.stdout.write(
                    self.style.SUCCESS(f"         → keycloak_id={kc_id}")
                )
                ok += 1

            except Exception as exc:  # noqa: BLE001
                self.stderr.write(
                    self.style.ERROR(f"         FAILED for {user.username!r}: {exc}")
                )
                failed += 1

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"Done. synced={ok}  skipped={skipped}  failed={failed}"
            )
        )
        if ok and not dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\nIMPORTANT: All synced users have a TEMPORARY password "
                    "('ChangeMe@123!'). They must reset it on first Keycloak login."
                )
            )
