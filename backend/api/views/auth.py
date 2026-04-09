"""
Auth views — user profile + Telegram bot phone-linking.
"""
import re

from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import User
from ..serializers import UserProfileSerializer, UserProfileUpdateSerializer


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        request.user.refresh_from_db()
        return Response(UserProfileSerializer(request.user, context={'request': request}).data)


class BotLinkPhoneView(APIView):
    """
    Called by the Telegram bot to link a Telegram account to a Django user.
    Requires X-Bot-Secret header (no user auth needed — bot secret is enough).
    POST body: { "phone": "+919876543210", "chat_id": "123456789" }
    Matches last 10 digits against User.phone_number or User.phone fields.
    """
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        secret = request.headers.get('X-Bot-Secret', '')
        if secret != settings.TELEGRAM_BOT_SECRET:
            return Response({'detail': 'Forbidden.'}, status=403)

        phone   = re.sub(r'\D', '', request.data.get('phone', ''))
        chat_id = str(request.data.get('chat_id', '')).strip()

        if not phone or not chat_id:
            return Response({'detail': 'phone and chat_id required.'}, status=400)

        last10 = phone[-10:]
        user = (
            User.objects.filter(phone_number__endswith=last10).first()
            or User.objects.filter(phone__endswith=last10).first()
        )
        if not user:
            return Response({'detail': 'not_found'}, status=404)

        user.telegram_chat_id = chat_id
        user.telegram_phone   = phone
        user.save(update_fields=['telegram_chat_id', 'telegram_phone'])

        return Response({
            'detail':      'linked',
            'name':        user.full_name or user.get_full_name() or user.username,
            'roll_number': user.roll_number,
            'hostel':      user.hostel,
        })
