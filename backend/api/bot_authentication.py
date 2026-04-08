"""
Bot Authentication — DRF authentication backend for the Telegram bot service.

The bot sends two headers with every request:
  X-Bot-Secret       : shared secret (settings.TELEGRAM_BOT_SECRET)
  X-Telegram-Chat-ID : the Telegram chat_id of the acting user

Django validates the secret then looks up the user by chat_id.
No Keycloak token needed — the bot is an internal trusted service.
"""

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import User


class BotAuthentication(BaseAuthentication):
    def authenticate(self, request):
        secret = request.META.get('HTTP_X_BOT_SECRET', '')
        if not secret:
            return None                          # not a bot request — try next backend

        if secret != settings.TELEGRAM_BOT_SECRET:
            raise AuthenticationFailed('Invalid bot secret.')

        chat_id = request.META.get('HTTP_X_TELEGRAM_CHAT_ID', '').strip()
        if not chat_id:
            raise AuthenticationFailed('Missing X-Telegram-Chat-ID header.')

        try:
            user = User.objects.get(telegram_chat_id=chat_id)
        except User.DoesNotExist:
            raise AuthenticationFailed('Telegram account not linked.')

        return (user, None)
