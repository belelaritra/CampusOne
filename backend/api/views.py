import math
from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

import datetime as dt

from .models import (
    User, HelpRequest, PasswordResetToken,
    Hostel, FoodOutlet, Order, LostFoundItem,
    MarketplaceListing, Doctor, CampusEvent,
    PICKUP_CHOICES,
)
from .serializers import (
    RegisterSerializer, UserProfileSerializer, UserProfileUpdateSerializer,
    ChangePasswordSerializer, ForgotPasswordSerializer, ResetPasswordSerializer,
    HelpRequestCreateSerializer, HelpRequestEditSerializer, HelpRequestSerializer,
    HostelSerializer, FoodOutletSerializer, OrderSerializer,
    LostFoundSerializer, MarketplaceSerializer, DoctorSerializer, EventSerializer,
)


# ---------------------------------------------------------------------------
# Haversine distance (returns metres)
# ---------------------------------------------------------------------------

def haversine(lat1, lon1, lat2, lon2):
    R = 6_371_000  # Earth radius in metres
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# Exact coordinates for the three fixed pickup locations
PICKUP_COORDS = {
    'main_gate':    (19.12845641460189,  72.91926132752846),
    'gulmohar':     (19.129814529274448, 72.91533444403758),
    'shree_balaji': (19.135117507090506, 72.90574766165889),
}

ACCEPT_RADIUS_METRES = 200


# ---------------------------------------------------------------------------
# Auth Views
# ---------------------------------------------------------------------------

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserProfileSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        if not username or not password:
            return Response({'detail': 'Username and password are required.'}, status=400)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid credentials.'}, status=400)

        if not user.check_password(password):
            return Response({'detail': 'Invalid credentials.'}, status=400)

        if not user.is_active:
            return Response({'detail': 'Account is disabled.'}, status=403)

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserProfileSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'detail': 'Refresh token required.'}, status=400)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass  # Already blacklisted or invalid — still treat as logged out
        return Response({'detail': 'Logged out successfully.'})


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        request.user.refresh_from_db()
        return Response(UserProfileSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({'detail': 'Old password is incorrect.'}, status=400)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({'detail': 'Password changed successfully.'})


class ForgotPasswordView(APIView):
    """
    Token-based password reset (no email server required in dev).
    Returns the reset token in the response. In production, email it instead.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data['username']
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Don't reveal whether user exists
            return Response({'detail': 'If that account exists, a reset token has been generated.'})

        token_obj = PasswordResetToken.objects.create(user=user)
        # In production: send token_obj.token via email
        return Response({
            'detail': 'Reset token generated. Copy this token to reset your password.',
            'reset_token': str(token_obj.token),  # Remove in production
        })


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token_obj = PasswordResetToken.objects.select_related('user').get(
                token=serializer.validated_data['token']
            )
        except PasswordResetToken.DoesNotExist:
            return Response({'detail': 'Invalid or expired reset token.'}, status=400)

        if not token_obj.is_valid():
            return Response({'detail': 'Reset token has expired or already been used.'}, status=400)

        user = token_obj.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        token_obj.used = True
        token_obj.save(update_fields=['used'])
        return Response({'detail': 'Password reset successfully. You can now log in.'})


# ---------------------------------------------------------------------------
# Help Request ViewSet
# ---------------------------------------------------------------------------

class HelpRequestViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _expire_pending(self, qs):
        """Bulk-expire any PENDING requests whose to_time has passed."""
        now = timezone.now()
        expired_ids = qs.filter(
            status=HelpRequest.STATUS_PENDING, to_time__lte=now
        ).values_list('id', flat=True)
        if expired_ids:
            HelpRequest.objects.filter(id__in=expired_ids).update(status=HelpRequest.STATUS_EXPIRED)

    # GET /api/help/?lat=<float>&lng=<float>
    def list(self, request):
        """
        Return PENDING requests sorted by proximity then to_time.
        Accepts optional ?lat=&lng= query params to annotate distance.
        """
        user_lat_str = request.query_params.get('lat')
        user_lon_str = request.query_params.get('lng')
        has_location = False
        user_lat = user_lon = None

        if user_lat_str and user_lon_str:
            try:
                user_lat = float(user_lat_str)
                user_lon = float(user_lon_str)
                has_location = True
            except (TypeError, ValueError):
                pass

        qs = HelpRequest.objects.select_related('requester', 'helper')
        self._expire_pending(qs)
        pending = list(qs.filter(status=HelpRequest.STATUS_PENDING))

        for req in pending:
            if has_location:
                coords = PICKUP_COORDS.get(req.pickup_location)
                if coords:
                    dist = haversine(user_lat, user_lon, *coords)
                    req._distance_meters = round(dist)
                    req._is_within_range = dist <= ACCEPT_RADIUS_METRES
                else:
                    req._distance_meters = None
                    req._is_within_range = False
            else:
                req._distance_meters = None
                req._is_within_range = None

        if has_location:
            pending.sort(key=lambda r: (
                0 if getattr(r, '_is_within_range', False) else 1,
                r.to_time,
            ))

        serializer = HelpRequestSerializer(pending, many=True, context={'request': request})
        return Response(serializer.data)

    # POST /api/help/
    def create(self, request):
        serializer = HelpRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Combine today's local date with the submitted HH:MM time
        raw_time  = serializer.validated_data['from_time']    # datetime.time
        duration  = serializer.validated_data['duration']
        today     = timezone.localdate()                       # date in Asia/Kolkata
        from_time = timezone.make_aware(
            dt.datetime.combine(today, raw_time)
        )
        to_time = from_time + dt.timedelta(minutes=duration)

        if to_time <= timezone.now():
            return Response(
                {'detail': 'The window end time must be in the future.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Auto-populate contact from requester's profile
        contact = request.user.phone_number or request.user.phone or ''

        help_req = serializer.save(
            requester=request.user,
            from_time=from_time,
            to_time=to_time,
            contact_number=contact,
        )
        return Response(
            HelpRequestSerializer(help_req, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # POST /api/help/{id}/accept/
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        """
        Atomic acceptance with:
          1. Duplicate-accept guard (user already has an ACCEPTED request)
          2. Single-accept guard (request already taken)
          3. Haversine distance check (must be within 200m of pickup)
        """
        latitude  = request.data.get('latitude')
        longitude = request.data.get('longitude')

        if latitude is None or longitude is None:
            return Response(
                {'detail': 'Your current latitude and longitude are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user_lat = float(latitude)
            user_lon = float(longitude)
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid coordinates.'}, status=400)

        with transaction.atomic():
            # Lock user's existing accepted requests to prevent races
            already_helping = HelpRequest.objects.select_for_update().filter(
                helper=request.user, status=HelpRequest.STATUS_ACCEPTED
            ).exists()
            if already_helping:
                return Response(
                    {'detail': 'You already have an active accepted request. Complete it first.'},
                    status=status.HTTP_409_CONFLICT,
                )

            # Lock the target request row
            try:
                help_req = HelpRequest.objects.select_for_update().get(pk=pk)
            except HelpRequest.DoesNotExist:
                return Response({'detail': 'Request not found.'}, status=404)

            if help_req.requester_id == request.user.id:
                return Response({'detail': 'You cannot accept your own request.'}, status=400)

            if help_req.status != HelpRequest.STATUS_PENDING:
                return Response(
                    {'detail': f'Request is {help_req.status.lower()}, not available.'},
                    status=status.HTTP_409_CONFLICT,
                )

            if help_req.is_expired():
                help_req.status = HelpRequest.STATUS_EXPIRED
                help_req.save(update_fields=['status'])
                return Response({'detail': 'Request has expired.'}, status=410)

            # Distance check
            pickup_coords = PICKUP_COORDS.get(help_req.pickup_location)
            if pickup_coords:
                dist = haversine(user_lat, user_lon, *pickup_coords)
                if dist > ACCEPT_RADIUS_METRES:
                    return Response(
                        {
                            'detail': (
                                f'You are {dist:.0f}m from {help_req.get_pickup_location_display()}. '
                                f'Must be within {ACCEPT_RADIUS_METRES}m to accept.'
                            )
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

            help_req.helper = request.user
            help_req.status = HelpRequest.STATUS_ACCEPTED
            help_req.save(update_fields=['helper', 'status'])

        return Response(
            HelpRequestSerializer(help_req, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )

    # POST /api/help/{id}/complete/
    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Only the requester can mark their own request as complete."""
        try:
            help_req = HelpRequest.objects.get(pk=pk)
        except HelpRequest.DoesNotExist:
            return Response({'detail': 'Request not found.'}, status=404)

        if help_req.requester_id != request.user.id:
            return Response({'detail': 'Only the requester can mark this as complete.'}, status=403)

        if help_req.status != HelpRequest.STATUS_ACCEPTED:
            return Response(
                {'detail': 'Request must be in ACCEPTED state to complete.'},
                status=400,
            )

        with transaction.atomic():
            help_req.status = HelpRequest.STATUS_COMPLETED
            help_req.save(update_fields=['status'])
            # Award +1 point to helper (F() avoids stale-read race condition)
            if help_req.helper:
                User.objects.filter(pk=help_req.helper_id).update(points=F('points') + 1)

        data = HelpRequestSerializer(help_req, context={'request': request}).data
        # Return fresh helper points so frontend can update instantly
        if help_req.helper_id:
            data['helper_points'] = User.objects.values_list('points', flat=True).get(
                pk=help_req.helper_id
            )
        return Response(data)

    # PATCH /api/help/{id}/
    def partial_update(self, request, pk=None):
        """Requester can edit their own PENDING request."""
        try:
            help_req = HelpRequest.objects.get(pk=pk)
        except HelpRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if help_req.requester_id != request.user.id:
            return Response({'detail': 'Only the requester can edit this.'}, status=403)
        if help_req.status != HelpRequest.STATUS_PENDING:
            return Response({'detail': 'Only PENDING requests can be edited.'}, status=400)

        serializer = HelpRequestEditSerializer(help_req, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        raw_time = serializer.validated_data.get('from_time')  # datetime.time or None
        duration = serializer.validated_data.get('duration', help_req.duration)

        if raw_time is not None:
            today     = timezone.localdate()
            from_time = timezone.make_aware(
                dt.datetime.combine(today, raw_time)
            )
        else:
            from_time = help_req.from_time

        to_time = from_time + dt.timedelta(minutes=duration)

        if to_time <= timezone.now():
            return Response({'detail': 'Computed end time must be in the future.'}, status=400)

        updated = serializer.save(from_time=from_time, to_time=to_time)
        return Response(HelpRequestSerializer(updated, context={'request': request}).data)

    # DELETE /api/help/{id}/
    def destroy(self, request, pk=None):
        """Requester can delete their own PENDING request."""
        try:
            help_req = HelpRequest.objects.get(pk=pk)
        except HelpRequest.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if help_req.requester_id != request.user.id:
            return Response({'detail': 'Only the requester can delete this.'}, status=403)
        if help_req.status != HelpRequest.STATUS_PENDING:
            return Response({'detail': 'Only PENDING requests can be deleted.'}, status=400)

        help_req.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # GET /api/help/mine/
    @action(detail=False, methods=['get'])
    def mine(self, request):
        """Active requests where user is requester OR helper (not completed/expired)."""
        now = timezone.now()
        # Auto-expire any overdue PENDING requests involving this user
        HelpRequest.objects.filter(
            Q(requester=request.user) | Q(helper=request.user),
            status=HelpRequest.STATUS_PENDING,
            to_time__lte=now,
        ).update(status=HelpRequest.STATUS_EXPIRED)

        qs = HelpRequest.objects.select_related('requester', 'helper').filter(
            Q(requester=request.user) | Q(helper=request.user),
            status__in=[HelpRequest.STATUS_PENDING, HelpRequest.STATUS_ACCEPTED],
        )
        serializer = HelpRequestSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    # GET /api/help/history/
    @action(detail=False, methods=['get'])
    def history(self, request):
        """COMPLETED or EXPIRED requests involving this user."""
        qs = HelpRequest.objects.select_related('requester', 'helper').filter(
            Q(requester=request.user) | Q(helper=request.user),
            status__in=[HelpRequest.STATUS_COMPLETED, HelpRequest.STATUS_EXPIRED],
        )
        serializer = HelpRequestSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    # GET /api/help/admin_list/
    @action(detail=False, methods=['get'], permission_classes=[IsAdminUser])
    def admin_list(self, request):
        """All requests — admin only."""
        qs = HelpRequest.objects.select_related('requester', 'helper').all()
        serializer = HelpRequestSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Legacy Campus ViewSets (unchanged, now require JWT auth)
# ---------------------------------------------------------------------------

DUMMY_HOSTELS = [
    {'id': i, 'name': f'Hostel {i}', 'capacity': 400, 'occupancy': 380,
     'warden_contact': '', 'occupancy_percent': 95}
    for i in range(1, 7)
]

DUMMY_OUTLETS = [
    {'id': 1, 'name': 'Central Canteen', 'icon': '🍽️', 'outlet_type': 'canteen',
     'hours': '8 AM – 10 PM', 'status': 'open',
     'items': [{'id': 1, 'name': 'Veg Thali', 'price': '80.00', 'is_available': True}]},
    {'id': 2, 'name': 'Juice Center', 'icon': '🥤', 'outlet_type': 'cafe',
     'hours': '9 AM – 9 PM', 'status': 'open',
     'items': [{'id': 2, 'name': 'Mango Shake', 'price': '50.00', 'is_available': True}]},
    {'id': 3, 'name': 'Night Canteen', 'icon': '🌙', 'outlet_type': 'night',
     'hours': '8 PM – 2 AM', 'status': 'open',
     'items': [{'id': 3, 'name': 'Maggi', 'price': '40.00', 'is_available': True}]},
]


class HostelViewSet(viewsets.ModelViewSet):
    queryset = Hostel.objects.all()
    serializer_class = HostelSerializer

    def list(self, request):
        qs = self.get_queryset()
        if not qs.exists():
            return Response(DUMMY_HOSTELS)
        return Response(HostelSerializer(qs, many=True).data)


class FoodOutletViewSet(viewsets.ModelViewSet):
    queryset = FoodOutlet.objects.all()
    serializer_class = FoodOutletSerializer

    def list(self, request):
        qs = self.get_queryset()
        if not qs.exists():
            return Response(DUMMY_OUTLETS)
        return Response(FoodOutletSerializer(qs, many=True).data)


class OrderViewSet(viewsets.ModelViewSet):
    queryset = Order.objects.all().order_by('-created_at')
    serializer_class = OrderSerializer

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {'message': 'Order placed!', 'order': serializer.data},
            status=status.HTTP_201_CREATED
        )


class LostFoundViewSet(viewsets.ModelViewSet):
    queryset = LostFoundItem.objects.all().order_by('-date_reported')
    serializer_class = LostFoundSerializer


class MarketplaceViewSet(viewsets.ModelViewSet):
    queryset = MarketplaceListing.objects.filter(is_sold=False).order_by('-created_at')
    serializer_class = MarketplaceSerializer


class DoctorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer

    def list(self, request):
        qs = self.get_queryset()
        if not qs.exists():
            return Response([
                {'id': 1, 'name': 'Dr. Sharma', 'specialization': 'General Physician',
                 'status': 'available', 'timings': '9 AM – 5 PM'},
                {'id': 2, 'name': 'Dr. Mehta', 'specialization': 'Dermatologist',
                 'status': 'busy', 'timings': 'Mon, Wed, Fri'},
            ])
        return Response(DoctorSerializer(qs, many=True).data)


class EventViewSet(viewsets.ModelViewSet):
    queryset = CampusEvent.objects.all().order_by('date')
    serializer_class = EventSerializer
