"""
Keycloak JWT authentication backend for Django REST Framework.

Uses PyJWT's built-in PyJWKClient which handles JWKS fetching, key caching,
and key rotation automatically — no manual RSA key parsing required.

Two-layer authorization model:
  - Keycloak realm roles → coarse: is_staff, is_security
  - Django DB (OutletAdmin, MessAdminProfile) → fine-grained: per-outlet/hostel
"""
import logging

import jwt
from jwt import PyJWKClient, PyJWKClientError
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)

# Module-level JWKS client — initialised lazily on first request.
# PyJWKClient internally caches keys and handles rotation automatically.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_uri = (
            f"{settings.KEYCLOAK_SERVER_URL}/realms/{settings.KEYCLOAK_REALM}"
            f"/protocol/openid-connect/certs"
        )
        # cache_keys=True: keys are cached in-process (no Redis needed)
        # lifespan=300: re-fetch keys every 5 minutes (handles key rotation)
        _jwks_client = PyJWKClient(jwks_uri, cache_keys=True, lifespan=300)
    return _jwks_client


class KeycloakAuthentication(BaseAuthentication):
    """
    DRF authentication class that validates Keycloak-issued JWTs.

    On every authenticated request:
      1. Reads Authorization: Bearer <token> header.
      2. Fetches the matching RSA public key from Keycloak's JWKS endpoint
         (PyJWKClient handles caching and key rotation).
      3. Verifies the token: signature, expiry, issuer, azp claim.
      4. Extracts sub / preferred_username / email / realm_access.roles.
      5. Finds or creates a local User; syncs is_staff / is_security from roles.
      6. Returns (user, payload) so request.user and request.auth are set.
    """

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None  # Not a bearer token — let other backends try

        parts = auth_header.split(" ", 1)
        if len(parts) != 2 or not parts[1]:
            return None

        token = parts[1]
        payload = self._decode_token(token)
        user = self._get_or_provision_user(payload)
        return (user, payload)

    # ------------------------------------------------------------------
    # Token decoding
    # ------------------------------------------------------------------

    def _decode_token(self, token: str) -> dict:
        client = _get_jwks_client()
        issuer = (
            f"{settings.KEYCLOAK_SERVER_URL}/realms/{settings.KEYCLOAK_REALM}"
        )

        # Resolve the signing key that matches the token's 'kid' header
        try:
            signing_key = client.get_signing_key_from_jwt(token)
        except PyJWKClientError as exc:
            logger.warning("JWKS key lookup failed: %s", exc)
            raise AuthenticationFailed(
                "Could not verify token signature. "
                "Keycloak may be unreachable or the key has rotated."
            )

        try:
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=settings.KEYCLOAK_ALGORITHMS,
                issuer=issuer,
                # Audience check: Keycloak puts the client_id in 'azp', not always
                # in 'aud'. We validate azp manually below instead.
                options={"verify_aud": False},
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token has expired. Please log in again.")
        except jwt.InvalidIssuerError:
            raise AuthenticationFailed("Token issuer is invalid.")
        except jwt.InvalidTokenError as exc:
            raise AuthenticationFailed(f"Token validation failed: {exc}")

        # Verify the token was issued for our client (prevents token substitution)
        expected_client = getattr(settings, "KEYCLOAK_CLIENT_ID", None)
        if expected_client:
            azp = payload.get("azp", "")
            if azp != expected_client:
                raise AuthenticationFailed(
                    f"Token was not issued for this application (azp={azp!r})."
                )

        return payload

    # ------------------------------------------------------------------
    # User provisioning / role sync
    # ------------------------------------------------------------------

    def _get_or_provision_user(self, payload: dict):
        """
        Find or create a local Django User from Keycloak token claims.
        Syncs is_staff and is_security from Keycloak realm roles on every request.
        """
        from .models import User  # local import avoids circular dependency

        keycloak_id = payload.get("sub", "")
        username    = payload.get("preferred_username", "") or keycloak_id
        email       = payload.get("email", "")
        full_name   = payload.get("name", "")
        first_name  = payload.get("given_name", "")
        last_name   = payload.get("family_name", "")

        # Extract realm-level roles
        realm_roles = payload.get("realm_access", {}).get("roles", [])
        is_staff    = "campus-staff"    in realm_roles
        is_security = "campus-security" in realm_roles

        # --- Lookup strategy (most-specific first) ---

        # 1. By keycloak_id — fast path for returning users
        user = User.objects.filter(keycloak_id=keycloak_id).first()

        # 2. By username — matches migrated users not yet given a keycloak_id
        if not user and username:
            user = User.objects.filter(username=username).first()

        # 3. By email — last-resort migration match
        if not user and email:
            user = User.objects.filter(email=email).first()

        # 4. First-ever login — provision a new account
        if not user:
            user = User(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                full_name=full_name,
                keycloak_id=keycloak_id,
                is_staff=is_staff,
                is_security=is_security,
            )
            user.set_unusable_password()
            user.save()
            logger.info(
                "Provisioned new CampusOne user '%s' from Keycloak (sub=%s).",
                username, keycloak_id,
            )
            return user

        # --- Sync mutable flags on returning users ---
        update_fields = []

        if user.keycloak_id != keycloak_id:
            user.keycloak_id = keycloak_id
            update_fields.append("keycloak_id")

        if user.is_staff != is_staff:
            user.is_staff = is_staff
            update_fields.append("is_staff")

        if user.is_security != is_security:
            user.is_security = is_security
            update_fields.append("is_security")

        if not user.is_active:
            user.is_active = True
            update_fields.append("is_active")

        if update_fields:
            user.save(update_fields=update_fields)

        return user
