"""
Keycloak Auth — Top 5 Security Risk Tests

Selected vulnerability classes:
  1. Missing auth header fallthrough — returning non-None blocks all non-Keycloak backends
  2. Expired token accepted          — stale token grants indefinite access after logout
  3. Wrong azp accepted              — foreign-app token substitution bypasses identity
  4. Privilege escalation (case)     — 'Campus-Staff' (wrong case) must not grant is_staff
  5. Partial role name match         — 'campus-staff-extra' must not grant is_staff
"""

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# 1. MISSING AUTH HEADER FALLTHROUGH — returning non-None blocks all other backends
#
# RISK: DRF tries authentication backends in order.  If KeycloakAuthentication
# returns anything other than None for a missing or non-Bearer Authorization
# header, no other backend (session, API key, etc.) is ever tried.  Every
# non-Keycloak request — including Django admin, DRF browsable API, and
# service-account tokens — receives a 403 and cannot log in.
# ---------------------------------------------------------------------------

def test_missing_and_non_bearer_auth_returns_none():
    """
    authenticate() must return None (not raise, not return a user) when:
      - Authorization header is absent
      - Authorization uses a non-Bearer scheme (Basic, ApiKey, etc.)
    Returning non-None here locks out every non-Keycloak caller permanently.
    """
    from api.keycloak_authentication import KeycloakAuthentication
    from rest_framework.test import APIRequestFactory

    auth    = KeycloakAuthentication()
    factory = APIRequestFactory()

    def make_request(header=None):
        req = factory.get("/")
        if header:
            req.META["HTTP_AUTHORIZATION"] = header
        return req

    # No header
    assert auth.authenticate(make_request()) is None, (
        "BUG: Missing Authorization header did not return None. "
        "All non-Keycloak backends are now unreachable."
    )
    # Basic auth
    assert auth.authenticate(make_request("Basic dXNlcjpwYXNz")) is None, (
        "BUG: Basic auth header did not return None. "
        "DRF will never reach session or other authentication backends."
    )
    # Malformed Bearer (no space)
    assert auth.authenticate(make_request("BearerABCDEF")) is None, (
        "BUG: Malformed Bearer token did not return None."
    )


# ---------------------------------------------------------------------------
# 2. EXPIRED TOKEN ACCEPTED — stale token grants access after logout / expiry
#
# RISK: If ExpiredSignatureError is not caught and converted to
# AuthenticationFailed, a user who has logged out of Keycloak (or whose
# session was revoked by an admin) can keep using their old JWT forever —
# indefinitely bypassing revocation and session termination.
# ---------------------------------------------------------------------------

def test_expired_token_raises_authentication_failed():
    """
    _decode_token() must raise AuthenticationFailed when PyJWT raises
    ExpiredSignatureError.  If it instead returns the payload or raises
    a 500, revoked/expired tokens grant permanent access.
    """
    import jwt
    from rest_framework.exceptions import AuthenticationFailed
    from api.keycloak_authentication import KeycloakAuthentication

    auth = KeycloakAuthentication()

    with patch("api.keycloak_authentication._get_jwks_client") as mc, \
         patch("jwt.decode", side_effect=jwt.ExpiredSignatureError):
        mc.return_value.get_signing_key_from_jwt.return_value = MagicMock(key="k")
        with pytest.raises(AuthenticationFailed) as exc:
            auth._decode_token("expired.jwt.token")

    assert "expired" in str(exc.value).lower(), (
        "BUG: AuthenticationFailed for expired token has no 'expired' message. "
        "Clients cannot distinguish expiry from other auth failures."
    )


# ---------------------------------------------------------------------------
# 3. WRONG AZP ACCEPTED — foreign-app token substitution attack
#
# RISK: The `azp` (authorised party) claim identifies which client the token
# was issued for.  If _decode_token() does not validate azp == KEYCLOAK_CLIENT_ID,
# an attacker with a valid Keycloak account in ANY client on the same realm
# (e.g. the HR portal, the canteen app) can call CampusOne APIs using their
# token from that other application.  This is a cross-application token
# substitution attack — one of the OWASP API Top 10 risks.
# ---------------------------------------------------------------------------

def test_wrong_azp_raises_authentication_failed(settings):
    """
    A token whose azp differs from KEYCLOAK_CLIENT_ID must be rejected with
    AuthenticationFailed.  Accepting it enables cross-app token substitution.
    """
    from rest_framework.exceptions import AuthenticationFailed
    from api.keycloak_authentication import KeycloakAuthentication

    settings.KEYCLOAK_CLIENT_ID = "campusone-frontend"
    auth = KeycloakAuthentication()

    with patch("api.keycloak_authentication._get_jwks_client") as mc, \
         patch("jwt.decode", return_value={
             "sub": "attacker-uid",
             "azp": "other-app",        # ← foreign application's client id
             "realm_access": {"roles": []},
         }):
        mc.return_value.get_signing_key_from_jwt.return_value = MagicMock(key="k")
        with pytest.raises(AuthenticationFailed) as exc:
            auth._decode_token("foreign-app.jwt.here")

    assert "azp" in str(exc.value).lower(), (
        "BUG: Token from a foreign app was accepted (azp mismatch not detected). "
        "Attackers with accounts in any co-realm client can access CampusOne."
    )


# ---------------------------------------------------------------------------
# 4. PRIVILEGE ESCALATION VIA WRONG CASE — 'Campus-Staff' grants is_staff
#
# RISK: Keycloak role names are case-sensitive.  The real role is 'campus-staff'
# (all lowercase).  If the extraction logic uses a case-insensitive check,
# any user who can set their own Keycloak role to 'Campus-Staff' or
# 'CAMPUS-STAFF' in a misconfigured realm gains staff privileges on CampusOne
# without being in the correct role.  This is a privilege escalation vulnerability.
# ---------------------------------------------------------------------------

def test_wrong_case_role_does_not_grant_staff_privileges():
    """
    'Campus-Staff' (title case) and 'CAMPUS-STAFF' (upper case) must NOT
    set is_staff = True.  Only the exact string 'campus-staff' (lowercase)
    is a valid grant.
    """
    def extract(payload):
        realm_roles = payload.get("realm_access", {}).get("roles", [])
        is_staff    = "campus-staff"    in realm_roles
        is_security = "campus-security" in realm_roles
        return is_staff, is_security

    # Title case — must NOT grant staff
    is_staff, _ = extract({"realm_access": {"roles": ["Campus-Staff"]}})
    assert is_staff is False, (
        "BUG: 'Campus-Staff' (title case) granted is_staff. "
        "Role check is not case-sensitive — privilege escalation is possible."
    )

    # Upper case — must NOT grant staff
    is_staff, _ = extract({"realm_access": {"roles": ["CAMPUS-STAFF"]}})
    assert is_staff is False, (
        "BUG: 'CAMPUS-STAFF' (upper case) granted is_staff. "
        "Any user with a miscapitalised role name gains staff access."
    )

    # Correct lowercase — MUST grant staff
    is_staff, _ = extract({"realm_access": {"roles": ["campus-staff"]}})
    assert is_staff is True, (
        "BUG: Correct 'campus-staff' role did not grant is_staff. "
        "Legitimate staff cannot access staff-only endpoints."
    )


# ---------------------------------------------------------------------------
# 5. PARTIAL ROLE NAME MATCH — 'campus-staff-extra' grants is_staff
#
# RISK: If the check uses 'campus-staff' in some_string instead of an exact
# membership test in the roles list, then roles like 'campus-staff-extra'
# or 'not-campus-staff' would also satisfy the condition.  In a Keycloak
# realm where custom composite roles are allowed, an attacker could create
# a role whose name contains 'campus-staff' as a substring and self-assign
# it to gain administrative access to the CampusOne backend.
# ---------------------------------------------------------------------------

def test_partial_role_name_does_not_grant_staff_privileges():
    """
    'campus-staff-extra' and 'not-campus-staff' must NOT grant is_staff.
    Only exact list membership ('campus-staff' in roles_list) is safe.
    """
    def extract(payload):
        realm_roles = payload.get("realm_access", {}).get("roles", [])
        return "campus-staff" in realm_roles

    # Superset role name — must NOT match
    assert extract({"realm_access": {"roles": ["campus-staff-extra"]}}) is False, (
        "BUG: 'campus-staff-extra' granted is_staff. "
        "Substring match detected — partial role names bypass access control."
    )

    # Prefix match — must NOT grant
    assert extract({"realm_access": {"roles": ["campus-staff-readonly"]}}) is False, (
        "BUG: 'campus-staff-readonly' granted is_staff via prefix match."
    )

    # Exact role — MUST still work
    assert extract({"realm_access": {"roles": ["campus-staff"]}}) is True, (
        "BUG: Exact 'campus-staff' role stopped working after partial-match fix."
    )
