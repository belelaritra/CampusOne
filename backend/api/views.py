import math
import calendar
from decimal import Decimal
from django.db import transaction, IntegrityError
from django.db.models import F, Q, Count, Sum, Avg
from django.db.models.functions import ExtractHour
from django.utils import timezone
from rest_framework import status, viewsets, generics
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

import datetime as dt
import re

from .models import (
    User, HelpRequest, PasswordResetToken,
    Hostel, FoodOutlet, Order, LostFoundItem,
    MarketplaceListing, Doctor, CampusEvent,
    PICKUP_CHOICES,
    # Food Ordering
    Outlet, MenuItem, OutletAdmin, FoodOrder, FoodOrderItem, Review,
    FOOD_DELIVERY_LOCATION_CHOICES, FOOD_ACTIVE_STATUSES,
    # Lost & Found
    LFCategory, LFItem, LFClaim, LFNotification, LFLog,
    # Mess Module
    MessHostelSettings, MessAdminProfile, DailyMenu,
    GuestCouponPurchase, RebateRequest,
    MESS_HOSTEL_KEYS, MESS_MEAL_KEYS, MESS_HOSTEL_LABEL,
    # Contacts Module
    Faculty, Department, EmergencyContact,
    # Doctor Schedule
    DoctorScheduleCache,
)
from .serializers import (
    RegisterSerializer, UserProfileSerializer, UserProfileUpdateSerializer,
    ChangePasswordSerializer, ForgotPasswordSerializer, ResetPasswordSerializer,
    HelpRequestCreateSerializer, HelpRequestEditSerializer, HelpRequestSerializer,
    HostelSerializer, FoodOutletSerializer, OrderSerializer,
    LostFoundSerializer, MarketplaceSerializer, DoctorSerializer, EventSerializer,
    # Food Ordering
    OutletSerializer, MenuItemSerializer, MenuItemWriteSerializer,
    FoodOrderSerializer, PlaceOrderSerializer, ReviewSubmitSerializer,
    # Lost & Found
    LFCategorySerializer, LFItemSerializer, LFItemCreateSerializer,
    LFClaimSerializer, LFNotificationSerializer,
    # Mess Module
    MessHostelSettingsSerializer, DailyMenuSerializer,
    GuestCouponReadSerializer, GuestCouponCreateSerializer,
    RebateRequestSerializer, RebateReviewSerializer,
    # Admin Console
    AdminUserListSerializer, AdminUserUpdateSerializer,
    # Contacts Module
    FacultySerializer, FacultyWriteSerializer,
    DepartmentSerializer, EmergencyContactSerializer,
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
        return Response(UserProfileSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        request.user.refresh_from_db()
        return Response(UserProfileSerializer(request.user, context={'request': request}).data)


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


# ===========================================================================
# Food Ordering Module
# ===========================================================================

class IsOutletAdmin(BasePermission):
    """Allows access only to users with an OutletAdmin profile."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            OutletAdmin.objects.filter(user=request.user).exists()
        )


# ---------------------------------------------------------------------------
# User-facing: Outlets + Menu
# ---------------------------------------------------------------------------

class FoodOutletListView(generics.ListAPIView):
    """GET /api/food/outlets/ — list all active outlets."""
    serializer_class   = OutletSerializer
    permission_classes = [IsAuthenticated]
    queryset           = Outlet.objects.filter(is_active=True)


class FoodOutletMenuView(generics.ListAPIView):
    """
    GET /api/food/outlets/{outlet_id}/menu/
    Query params:
      search        — name contains (case-insensitive)
      is_veg        — 'true' / 'false'
      available_only— 'true'
      sort_by       — rating_desc | rating_asc | price_desc | price_asc
    """
    serializer_class   = MenuItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        outlet_id = self.kwargs['outlet_id']
        qs = MenuItem.objects.filter(outlet_id=outlet_id)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(name__icontains=search)

        is_veg = self.request.query_params.get('is_veg')
        if is_veg == 'true':
            qs = qs.filter(is_veg=True)
        elif is_veg == 'false':
            qs = qs.filter(is_veg=False)

        if self.request.query_params.get('available_only') == 'true':
            qs = qs.filter(is_available=True)

        sort_map = {
            'rating_desc': '-avg_rating',
            'rating_asc':  'avg_rating',
            'price_desc':  '-price',
            'price_asc':   'price',
            'name_asc':    'name',
            'name_desc':   '-name',
        }
        sort_by = self.request.query_params.get('sort_by', 'rating_desc')
        qs = qs.order_by(sort_map.get(sort_by, '-avg_rating'))

        return qs


# ---------------------------------------------------------------------------
# User-facing: Orders
# ---------------------------------------------------------------------------

class PlaceOrderView(APIView):
    """POST /api/food/orders/ — place a new order (atomic)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PlaceOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        outlet_id         = serializer.validated_data['outlet_id']
        order_type        = serializer.validated_data.get('order_type', 'DELIVERY')
        delivery_location = serializer.validated_data.get('delivery_location', '')
        items_data        = serializer.validated_data['items']

        with transaction.atomic():
            try:
                outlet = Outlet.objects.select_for_update().get(id=outlet_id, is_active=True)
            except Outlet.DoesNotExist:
                return Response({'detail': 'Outlet not found or not active.'}, status=400)

            food_item_ids = [i['food_item_id'] for i in items_data]
            food_items_qs = MenuItem.objects.select_for_update().filter(
                id__in=food_item_ids, outlet=outlet
            )
            food_items = {fi.id: fi for fi in food_items_qs}

            # Validate every requested item
            for item in items_data:
                fid = item['food_item_id']
                fi  = food_items.get(fid)
                if not fi:
                    return Response(
                        {'detail': f"Item {fid} not found in this outlet."},
                        status=400,
                    )
                if not fi.is_available:
                    return Response(
                        {'detail': f"'{fi.name}' is currently not available."},
                        status=400,
                    )

            total = sum(
                food_items[i['food_item_id']].price * i['quantity']
                for i in items_data
            )

            # Auto-populate user snapshot (immutable after creation)
            u = request.user
            order = FoodOrder.objects.create(
                user=request.user,
                outlet=outlet,
                order_type=order_type,
                delivery_location=delivery_location if order_type == 'DELIVERY' else '',
                total_price=total,
                payment_method='COD',
                user_full_name=u.full_name or u.get_full_name() or u.username,
                user_phone_number=u.phone_number or u.phone or '',
                user_email=u.email or '',
            )

            FoodOrderItem.objects.bulk_create([
                FoodOrderItem(
                    order=order,
                    food_item=food_items[i['food_item_id']],
                    quantity=i['quantity'],
                    price=food_items[i['food_item_id']].price,
                )
                for i in items_data
            ])

        return Response(
            FoodOrderSerializer(
                FoodOrder.objects.prefetch_related('order_items__food_item').get(pk=order.pk),
                context={'request': request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class UserPendingOrdersView(generics.ListAPIView):
    """
    GET /api/food/orders/pending/
    Returns: active orders + terminal-but-not-yet-reviewed orders.
    Terminal statuses: DELIVERED (delivery) or TOOK (takeaway).
    """
    serializer_class   = FoodOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            FoodOrder.objects
            .filter(user=self.request.user)
            .exclude(status='CANCELLED')
            .exclude(status__in=['DELIVERED', 'TOOK'], reviewed=True)
            .select_related('outlet')
            .prefetch_related('order_items__food_item')
        )


class UserOrderHistoryView(generics.ListAPIView):
    """
    GET /api/food/orders/history/
    Returns: (DELIVERED|TOOK)+reviewed  OR  CANCELLED.
    """
    serializer_class   = FoodOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            FoodOrder.objects
            .filter(
                Q(user=self.request.user, status__in=['DELIVERED', 'TOOK'], reviewed=True) |
                Q(user=self.request.user, status='CANCELLED')
            )
            .select_related('outlet')
            .prefetch_related('order_items__food_item')
        )


class TrackOrderView(generics.RetrieveAPIView):
    """GET /api/food/orders/{pk}/ — single order detail for tracking."""
    serializer_class   = FoodOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            FoodOrder.objects
            .filter(user=self.request.user)
            .select_related('outlet')
            .prefetch_related('order_items__food_item')
        )


class CancelOrderView(APIView):
    """POST /api/food/orders/{pk}/cancel/ — user can cancel only PENDING orders."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        with transaction.atomic():
            try:
                order = FoodOrder.objects.select_for_update().get(
                    pk=pk, user=request.user
                )
            except FoodOrder.DoesNotExist:
                return Response({'detail': 'Order not found.'}, status=404)

            if order.status != 'PENDING':
                return Response(
                    {'detail': 'Only PENDING orders can be cancelled by the user.'},
                    status=400,
                )
            order.status = 'CANCELLED'
            order.save(update_fields=['status', 'updated_at'])

        return Response(FoodOrderSerializer(order, context={'request': request}).data)


class SubmitReviewView(APIView):
    """
    POST /api/food/orders/{pk}/review/
    Body: { "ratings": [{"food_item_id": X, "rating": N}, …] }
    Requires: order is DELIVERED (delivery) or TOOK (takeaway), not yet reviewed.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = ReviewSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            try:
                order = FoodOrder.objects.select_for_update().prefetch_related(
                    'order_items__food_item'
                ).get(pk=pk, user=request.user)
            except FoodOrder.DoesNotExist:
                return Response({'detail': 'Order not found.'}, status=404)

            if order.status not in ('DELIVERED', 'TOOK'):
                return Response(
                    {'detail': 'You can only review a delivered or picked-up order.'},
                    status=400,
                )
            if order.reviewed:
                return Response({'detail': 'This order has already been reviewed.'}, status=400)

            # Map order items by food_item_id for validation
            order_item_ids = {oi.food_item_id for oi in order.order_items.all()}
            submitted_ids  = {r['food_item_id'] for r in serializer.validated_data['ratings']}

            if submitted_ids != order_item_ids:
                return Response(
                    {'detail': 'You must rate every item in the order.'},
                    status=400,
                )

            # Create reviews (unique_together prevents double submission)
            reviews = []
            for r in serializer.validated_data['ratings']:
                reviews.append(Review(
                    user=request.user,
                    food_item_id=r['food_item_id'],
                    order=order,
                    rating=r['rating'],
                ))
            Review.objects.bulk_create(reviews, ignore_conflicts=True)

            # Recompute avg_rating for each affected item
            for fid in order_item_ids:
                try:
                    mi = MenuItem.objects.get(pk=fid)
                    mi.update_rating()
                except MenuItem.DoesNotExist:
                    pass

            order.reviewed = True
            order.save(update_fields=['reviewed', 'updated_at'])

        return Response({'detail': 'Thank you for your review!'})


# ---------------------------------------------------------------------------
# Outlet Admin: Menu management
# ---------------------------------------------------------------------------

class AdminMenuViewSet(viewsets.ModelViewSet):
    """
    CRUD for menu items — scoped to the admin's own outlet.
    GET    /api/food/admin/menu/
    POST   /api/food/admin/menu/
    PATCH  /api/food/admin/menu/{id}/
    DELETE /api/food/admin/menu/{id}/
    """
    permission_classes = [IsAuthenticated, IsOutletAdmin]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return MenuItemWriteSerializer
        return MenuItemSerializer

    def get_queryset(self):
        outlet = self.request.user.outlet_admin_profile.outlet
        return MenuItem.objects.filter(outlet=outlet)

    def perform_create(self, serializer):
        outlet = self.request.user.outlet_admin_profile.outlet
        serializer.save(outlet=outlet)


# ---------------------------------------------------------------------------
# Outlet Admin: Order management
# ---------------------------------------------------------------------------

class AdminOrderListView(generics.ListAPIView):
    """GET /api/food/admin/orders/ — all orders for admin's outlet."""
    serializer_class   = FoodOrderSerializer
    permission_classes = [IsAuthenticated, IsOutletAdmin]

    def get_queryset(self):
        outlet = self.request.user.outlet_admin_profile.outlet
        return (
            FoodOrder.objects
            .filter(outlet=outlet)
            .select_related('user', 'outlet')
            .prefetch_related('order_items__food_item')
        )


class AdminOrderActionView(APIView):
    """
    POST /api/food/admin/orders/{pk}/accept/  → PENDING → ACCEPTED
    POST /api/food/admin/orders/{pk}/cancel/  → any cancelable → CANCELLED
    PATCH /api/food/admin/orders/{pk}/status/ → status progression
    """
    permission_classes = [IsAuthenticated, IsOutletAdmin]

    def _get_order(self, request, pk):
        outlet = request.user.outlet_admin_profile.outlet
        try:
            return FoodOrder.objects.select_for_update().get(pk=pk, outlet=outlet)
        except FoodOrder.DoesNotExist:
            return None

    def post(self, request, pk, action_name):
        with transaction.atomic():
            order = self._get_order(request, pk)
            if not order:
                return Response({'detail': 'Order not found.'}, status=404)

            if action_name == 'accept':
                if order.status != 'PENDING':
                    return Response({'detail': 'Only PENDING orders can be accepted.'}, status=400)
                order.status = 'ACCEPTED'

            elif action_name == 'cancel':
                if order.status in ('DELIVERED', 'CANCELLED'):
                    return Response({'detail': 'Cannot cancel a delivered or already-cancelled order.'}, status=400)
                order.status = 'CANCELLED'

            else:
                return Response({'detail': 'Unknown action.'}, status=400)

            order.save(update_fields=['status', 'updated_at'])

        return Response(FoodOrderSerializer(order, context={'request': request}).data)

    def patch(self, request, pk, action_name=None):
        """PATCH /api/food/admin/orders/{pk}/status/ — advance order status.
        Transitions depend on order_type:
          DELIVERY: ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED
          TAKEAWAY: ACCEPTED → PREPARING → READY → TOOK
        """
        new_status = request.data.get('status', '').upper()

        with transaction.atomic():
            order = self._get_order(request, pk)
            if not order:
                return Response({'detail': 'Order not found.'}, status=404)

            if order.order_type == 'TAKEAWAY':
                valid_transitions = {
                    'ACCEPTED': ['PREPARING'],
                    'PREPARING': ['READY'],
                    'READY':    ['TOOK'],
                }
            else:
                valid_transitions = {
                    'ACCEPTED':         ['PREPARING'],
                    'PREPARING':        ['OUT_FOR_DELIVERY'],
                    'OUT_FOR_DELIVERY': ['DELIVERED'],
                }

            allowed = valid_transitions.get(order.status, [])
            if new_status not in allowed:
                return Response(
                    {'detail': f"Cannot transition from {order.status} to {new_status}. "
                               f"Allowed: {allowed}"},
                    status=400,
                )
            order.status = new_status
            order.save(update_fields=['status', 'updated_at'])

        return Response(FoodOrderSerializer(order, context={'request': request}).data)


# ---------------------------------------------------------------------------
# Outlet Admin: Analytics
# ---------------------------------------------------------------------------

class AnalyticsBaseView(APIView):
    permission_classes = [IsAuthenticated, IsOutletAdmin]

    def get_outlet(self, request):
        return request.user.outlet_admin_profile.outlet

    def active_orders(self, outlet):
        """Base queryset: only ACCEPTED+ orders (exclude PENDING & CANCELLED)."""
        return FoodOrder.objects.filter(
            outlet=outlet,
            status__in=FOOD_ACTIVE_STATUSES,
        )


class HostelWiseAnalyticsView(AnalyticsBaseView):
    """GET /api/food/analytics/hostel-wise/ — delivery orders only (location is empty for takeaway)."""

    def get(self, request):
        outlet = self.get_outlet(request)
        data = (
            self.active_orders(outlet)
            .filter(order_type='DELIVERY')
            .exclude(delivery_location='')
            .values('delivery_location')
            .annotate(order_count=Count('id'))
            .order_by('-order_count')
        )
        loc_display = dict(FOOD_DELIVERY_LOCATION_CHOICES)
        result = [
            {
                'delivery_location': row['delivery_location'],
                'location_display':  loc_display.get(row['delivery_location'], row['delivery_location']),
                'order_count':       row['order_count'],
            }
            for row in data
        ]
        return Response(result)


class TopFoodItemsAnalyticsView(AnalyticsBaseView):
    """GET /api/food/analytics/top-food-items/"""

    def get(self, request):
        outlet = self.get_outlet(request)
        data = (
            FoodOrderItem.objects
            .filter(order__outlet=outlet, order__status__in=FOOD_ACTIVE_STATUSES)
            .values('food_item__id', 'food_item__name')
            .annotate(
                total_quantity=Sum('quantity'),
                order_count=Count('order', distinct=True),
            )
            .order_by('-total_quantity')
        )
        result = [
            {
                'food_item_id':   row['food_item__id'],
                'food_item_name': row['food_item__name'],
                'total_quantity': row['total_quantity'],
                'order_count':    row['order_count'],
            }
            for row in data
        ]
        return Response(result)


class TimeWiseAnalyticsView(AnalyticsBaseView):
    """GET /api/food/analytics/time-wise/ — 24-hour distribution."""

    def get(self, request):
        outlet = self.get_outlet(request)
        data = (
            self.active_orders(outlet)
            .annotate(hour=ExtractHour('created_at'))
            .values('hour')
            .annotate(order_count=Count('id'))
            .order_by('hour')
        )
        return Response(list(data))


class DailySalesAnalyticsView(AnalyticsBaseView):
    """GET /api/food/analytics/daily-sales/ — orders + revenue per day (last 30 days)."""

    def get(self, request):
        from django.db.models.functions import TruncDate
        outlet    = self.get_outlet(request)
        cutoff    = timezone.now() - dt.timedelta(days=30)
        data = (
            self.active_orders(outlet)
            .filter(created_at__gte=cutoff)
            .annotate(day=TruncDate('created_at'))
            .values('day')
            .annotate(
                order_count=Count('id'),
                revenue=Sum('total_price'),
            )
            .order_by('day')
        )
        result = [
            {
                'day':         str(row['day']),
                'order_count': row['order_count'],
                'revenue':     float(row['revenue'] or 0),
            }
            for row in data
        ]
        return Response(result)


# ===========================================================================
# Lost & Found Module
# ===========================================================================

# Predefined IITB campus location coordinates — used for GPS → nearest-location resolution
LF_LOCATION_COORDS = {
    'main_gate':     (19.12845641460189,  72.91926132752846),
    'gulmohar':      (19.129814529274448, 72.91533444403758),
    'shree_balaji':  (19.135117507090506, 72.90574766165889),
    'central_lib':   (19.13332, 72.91318),
    'lecture_hall':  (19.13260, 72.91182),
    'kresit':        (19.13400, 72.91090),
    'sac':           (19.13100, 72.91550),
    'gymkhana':      (19.13050, 72.91500),
    'main_building': (19.13360, 72.91270),
    'conv_hall':     (19.13220, 72.91050),
    'sjmsom':        (19.13520, 72.90980),
    # Hostel cluster (approximate)
    'hostel_1':   (19.13046, 72.91560), 'hostel_2':   (19.13012, 72.91520),
    'hostel_3':   (19.12988, 72.91490), 'hostel_4':   (19.12960, 72.91460),
    'hostel_5':   (19.12940, 72.91420), 'hostel_6':   (19.12910, 72.91380),
    'hostel_7':   (19.12880, 72.91350), 'hostel_8':   (19.12850, 72.91310),
    'hostel_9':   (19.12820, 72.91280), 'hostel_10':  (19.12790, 72.91250),
    'hostel_11':  (19.13200, 72.91650), 'hostel_12':  (19.13180, 72.91680),
    'hostel_13':  (19.13250, 72.91700), 'hostel_14':  (19.13270, 72.91720),
    'hostel_15':  (19.13290, 72.91740), 'hostel_16':  (19.13310, 72.91760),
    'hostel_17':  (19.13330, 72.91780), 'hostel_18':  (19.13350, 72.91800),
    'hostel_19':  (19.13370, 72.91820), 'hostel_21':  (19.13390, 72.91840),
    'tansa_house':(19.13420, 72.91860),
}


def _nearest_lf_location(lat, lng):
    """Return the key of the nearest predefined IITB location."""
    best_key, best_dist = '', float('inf')
    for key, coords in LF_LOCATION_COORDS.items():
        d = haversine(lat, lng, *coords)
        if d < best_dist:
            best_dist = d
            best_key = key
    return best_key


def _lf_suggestion_score(candidate, ref_tags, ref_words, ref_cat_id):
    score = 0
    c_tags = set(t.lower() for t in (candidate.tags or []))
    score += len(ref_tags & c_tags) * 3
    if ref_cat_id and candidate.category_id == ref_cat_id:
        score += 5
    c_words = set(candidate.title.lower().split())
    score += len(ref_words & c_words) * 2
    return score


def _annotate_distance(items, user_lat, user_lng):
    for item in items:
        lat = item.latitude
        lng = item.longitude
        if lat is None or lng is None:
            loc_key = item.location_name.lower().replace(' ', '_').replace('&', 'and')
            coords = LF_LOCATION_COORDS.get(loc_key)
            if coords:
                lat, lng = coords
        if lat is not None and lng is not None:
            item._distance = round(haversine(user_lat, user_lng, lat, lng))
        else:
            item._distance = None


def _annotate_claims(items, user_id):
    """Attach _claim_count, _user_has_claimed, _active_interaction, _resolved_interaction (no N+1)."""
    if not items:
        return
    ids = [i.pk for i in items]
    counts = dict(
        LFClaim.objects.filter(item_id__in=ids)
        .values('item_id').annotate(n=Count('id')).values_list('item_id', 'n')
    )
    # Active pending interactions (at most one per item by DB constraint)
    active_qs = (
        LFClaim.objects.filter(item_id__in=ids, status='PENDING')
        .select_related('claimant')
    )
    active_map = {c.item_id: c for c in active_qs}
    # Most recent resolved interaction (for history display)
    resolved_map: dict = {}
    for c in (
        LFClaim.objects.filter(item_id__in=ids, status='RESOLVED')
        .select_related('claimant')
        .order_by('item_id', '-created_at')
    ):
        resolved_map.setdefault(c.item_id, c)
    for item in items:
        item._claim_count = counts.get(item.pk, 0)
        ai = active_map.get(item.pk)
        item._active_interaction    = ai
        item._resolved_interaction  = resolved_map.get(item.pk)
        # _user_has_claimed means "current user is the active pending interactor"
        item._user_has_claimed = ai is not None and ai.claimant_id == user_id


def _bulk_notify_found(found_item, reporter):
    """Notify matching LOST reporters when a FOUND item is posted. Uses bulk_create."""
    found_tags  = set(t.lower() for t in (found_item.tags or []))
    found_words = set(found_item.title.lower().split())

    lost_qs = (
        LFItem.objects
        .filter(item_type=LFItem.TYPE_LOST, status=LFItem.STATUS_AVAILABLE)
        .exclude(reporter=reporter)
        .select_related('reporter')
    )

    notifications = []
    notified = set()
    for lost in lost_qs:
        if lost.reporter_id in notified:
            continue
        if _lf_suggestion_score(lost, found_tags, found_words, found_item.category_id) > 0:
            notifications.append(LFNotification(
                user=lost.reporter,
                item=found_item,
                message=(
                    f"A found item may match your lost '{lost.title}': "
                    f"\"{found_item.title}\" at {found_item.location_name or 'campus'}"
                ),
            ))
            notified.add(lost.reporter_id)

    # ID-card: direct notification to the owner by roll number
    if found_item.roll_number:
        try:
            id_owner = User.objects.get(roll_number=found_item.roll_number)
            if id_owner.id not in notified and id_owner != reporter:
                notifications.append(LFNotification(
                    user=id_owner,
                    item=found_item,
                    message=(
                        f"Your ID card has been found at "
                        f"{found_item.location_name or 'campus'}. "
                        f"Contact the finder to collect it."
                    ),
                ))
        except User.DoesNotExist:
            pass

    if notifications:
        LFNotification.objects.bulk_create(notifications, ignore_conflicts=True)


# ---------------------------------------------------------------------------
class LFItemViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    # ------------------------------------------------------------------
    # GET /api/lf/items/?type=&status=AVAILABLE&category=&q=&tags=&lat=&lng=
    # ------------------------------------------------------------------
    def list(self, request):
        item_type  = request.query_params.get('type', '')
        status_f   = request.query_params.get('status', 'AVAILABLE')
        category   = request.query_params.get('category', '')
        q          = request.query_params.get('q', '').strip().lower()
        tags_param = request.query_params.get('tags', '')
        lat_str    = request.query_params.get('lat', '')
        lng_str    = request.query_params.get('lng', '')

        qs = LFItem.objects.select_related('reporter', 'category')

        if item_type in ('LOST', 'FOUND'):
            qs = qs.filter(item_type=item_type)
        if status_f:
            qs = qs.filter(status=status_f)
        if category:
            qs = qs.filter(category_id=category)
        if q:
            qs = qs.filter(
                Q(title__icontains=q) | Q(description__icontains=q) | Q(tags__icontains=q)
            )
        for tag in (t.strip().lower() for t in tags_param.split(',') if t.strip()):
            qs = qs.filter(tags__icontains=tag)

        items = list(qs)

        try:
            user_lat = float(lat_str)
            user_lng = float(lng_str)
            _annotate_distance(items, user_lat, user_lng)
        except (ValueError, TypeError):
            for item in items:
                item._distance = None

        _annotate_claims(items, request.user.id)
        serializer = LFItemSerializer(items, many=True, context={'request': request})
        return Response(serializer.data)

    # ------------------------------------------------------------------
    # POST /api/lf/items/
    # ------------------------------------------------------------------
    def create(self, request):
        serializer = LFItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        save_kwargs = {'reporter': request.user}
        # GPS path: if no location_name but lat/lng given, resolve to nearest campus location
        vd = serializer.validated_data
        if not vd.get('location_name') and vd.get('latitude') and vd.get('longitude'):
            save_kwargs['location_name'] = _nearest_lf_location(
                vd['latitude'], vd['longitude']
            )

        with transaction.atomic():
            item = serializer.save(**save_kwargs)
            LFLog.objects.create(
                item=item, actor=request.user, action='POSTED',
                detail=f"{item.item_type}: {item.title}",
            )
            if item.item_type == LFItem.TYPE_FOUND:
                _bulk_notify_found(item, request.user)

        _annotate_claims([item], request.user.id)
        return Response(
            LFItemSerializer(item, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    # ------------------------------------------------------------------
    # GET /api/lf/items/{id}/
    # ------------------------------------------------------------------
    def retrieve(self, request, pk=None):
        try:
            item = LFItem.objects.select_related('reporter', 'category').get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data)

    # ------------------------------------------------------------------
    # PATCH /api/lf/items/{id}/
    # ------------------------------------------------------------------
    def partial_update(self, request, pk=None):
        try:
            item = LFItem.objects.get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if item.reporter_id != request.user.id:
            return Response({'detail': 'Only the reporter can edit this.'}, status=403)
        if item.status != LFItem.STATUS_AVAILABLE:
            return Response({'detail': 'Only AVAILABLE items can be edited.'}, status=400)

        serializer = LFItemCreateSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        save_kwargs = {}
        vd = serializer.validated_data
        if not vd.get('location_name') and vd.get('latitude') and vd.get('longitude'):
            save_kwargs['location_name'] = _nearest_lf_location(
                vd['latitude'], vd['longitude']
            )

        with transaction.atomic():
            updated = serializer.save(**save_kwargs)
            LFLog.objects.create(item=updated, actor=request.user, action='EDITED')

        _annotate_claims([updated], request.user.id)
        return Response(LFItemSerializer(updated, context={'request': request}).data)

    # ------------------------------------------------------------------
    # DELETE /api/lf/items/{id}/
    # ------------------------------------------------------------------
    def destroy(self, request, pk=None):
        try:
            item = LFItem.objects.get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        if item.reporter_id != request.user.id:
            return Response({'detail': 'Only the reporter can delete this.'}, status=403)
        if item.status != LFItem.STATUS_AVAILABLE:
            return Response({'detail': 'Only AVAILABLE items can be deleted.'}, status=400)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------------
    # POST /api/lf/items/{id}/interact/
    # "Mark I have found" (for LOST) / "Claim" (for FOUND)
    # Creates a PENDING interaction; moves item to PENDING state.
    # Concurrency-safe via select_for_update + DB UniqueConstraint.
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def interact(self, request, pk=None):
        try:
            item = LFItem.objects.select_related('reporter').get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if item.reporter_id == request.user.id:
            return Response({'detail': 'You cannot interact with your own item.'}, status=400)
        if item.status != LFItem.STATUS_AVAILABLE:
            return Response({'detail': 'This item is not available.'}, status=400)

        message = (request.data.get('message') or '').strip()

        with transaction.atomic():
            # Re-fetch with row lock to prevent race conditions
            item = LFItem.objects.select_for_update().select_related('reporter').get(pk=pk)
            if item.status != LFItem.STATUS_AVAILABLE:
                return Response({'detail': 'This item is no longer available.'}, status=409)

            try:
                LFClaim.objects.create(
                    item=item, claimant=request.user, message=message, status='PENDING',
                )
            except IntegrityError:
                return Response(
                    {'detail': 'Another interaction is already pending for this item.'}, status=409
                )

            LFItem.objects.filter(pk=item.pk).update(status=LFItem.STATUS_PENDING)
            item.status = LFItem.STATUS_PENDING

            verb = 'found' if item.item_type == LFItem.TYPE_LOST else 'claimed'
            LFNotification.objects.create(
                user=item.reporter, item=item,
                message=(
                    f"{request.user.full_name or request.user.username} "
                    f"has {verb} your {item.item_type.lower()} item: \"{item.title}\""
                ),
            )
            LFLog.objects.create(item=item, actor=request.user, action='INTERACTED', detail=message)

        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data, status=201)

    # ------------------------------------------------------------------
    # POST /api/lf/items/{id}/resolve/
    # "Received" (LOST) / "Handed Over" (FOUND) — reporter or security confirms.
    # Marks item RESOLVED.
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        try:
            item = LFItem.objects.select_related('reporter').get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if item.status != LFItem.STATUS_PENDING:
            return Response({'detail': 'Item is not in pending state.'}, status=400)

        is_security = getattr(request.user, 'is_security', False) or request.user.is_staff
        if item.contact_type == 'SECURITY':
            if not is_security:
                return Response({'detail': 'Only security staff can resolve this item.'}, status=403)
        else:
            if item.reporter_id != request.user.id and not is_security:
                return Response({'detail': 'Only the reporter can resolve this item.'}, status=403)

        with transaction.atomic():
            updated = LFClaim.objects.filter(item=item, status='PENDING').update(status='RESOLVED')
            LFItem.objects.filter(pk=item.pk).update(status=LFItem.STATUS_RESOLVED)
            item.status = LFItem.STATUS_RESOLVED

            # Notify interactor
            resolved_claim = (
                LFClaim.objects.filter(item=item, status='RESOLVED')
                .select_related('claimant')
                .order_by('-created_at').first()
            )
            if resolved_claim:
                LFNotification.objects.create(
                    user=resolved_claim.claimant, item=item,
                    message=(
                        f"Your {'report' if item.item_type == LFItem.TYPE_LOST else 'claim'} "
                        f"for \"{item.title}\" has been marked as resolved."
                    ),
                )
            LFLog.objects.create(item=item, actor=request.user, action='RESOLVED')

        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data)

    # ------------------------------------------------------------------
    # POST /api/lf/items/{id}/revert/
    # Reporter cancels pending interaction; item returns to AVAILABLE.
    # ------------------------------------------------------------------
    @action(detail=True, methods=['post'])
    def revert(self, request, pk=None):
        try:
            item = LFItem.objects.select_related('reporter').get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        if item.status != LFItem.STATUS_PENDING:
            return Response({'detail': 'Item is not in pending state.'}, status=400)

        is_security = getattr(request.user, 'is_security', False) or request.user.is_staff
        if item.reporter_id != request.user.id and not is_security:
            return Response({'detail': 'Only the reporter can revert this item.'}, status=403)

        with transaction.atomic():
            cancelled = (
                LFClaim.objects.filter(item=item, status='PENDING')
                .select_related('claimant')
                .first()
            )
            LFClaim.objects.filter(item=item, status='PENDING').update(status='CANCELLED')
            LFItem.objects.filter(pk=item.pk).update(status=LFItem.STATUS_AVAILABLE)
            item.status = LFItem.STATUS_AVAILABLE

            if cancelled:
                LFNotification.objects.create(
                    user=cancelled.claimant, item=item,
                    message=(
                        f"The pending interaction for \"{item.title}\" has been cancelled. "
                        f"The item is back on the board."
                    ),
                )
            LFLog.objects.create(item=item, actor=request.user, action='REVERTED')

        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data)

    # ------------------------------------------------------------------
    # GET /api/lf/items/pending_items/
    # Items in PENDING state where current user is reporter OR interactor.
    # Security sees all PENDING items.
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def pending_items(self, request):
        user = request.user
        is_security = getattr(user, 'is_security', False) or user.is_staff

        if is_security:
            items = list(
                LFItem.objects.filter(status=LFItem.STATUS_PENDING)
                .select_related('reporter', 'category')
            )
        else:
            interacted_ids = LFClaim.objects.filter(
                claimant=user, status='PENDING',
            ).values_list('item_id', flat=True)
            items = list(
                LFItem.objects.filter(
                    Q(reporter=user) | Q(id__in=interacted_ids),
                    status=LFItem.STATUS_PENDING,
                ).select_related('reporter', 'category')
            )

        _annotate_claims(items, user.id)
        return Response(LFItemSerializer(items, many=True, context={'request': request}).data)

    # ------------------------------------------------------------------
    # GET /api/lf/items/history_items/
    # RESOLVED items where user was involved. Security sees all.
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def history_items(self, request):
        user = request.user
        is_security = getattr(user, 'is_security', False) or user.is_staff

        if is_security:
            items = list(
                LFItem.objects.filter(status=LFItem.STATUS_RESOLVED)
                .select_related('reporter', 'category')
            )
        else:
            interacted_ids = LFClaim.objects.filter(
                claimant=user,
            ).values_list('item_id', flat=True)
            items = list(
                LFItem.objects.filter(
                    Q(reporter=user) | Q(id__in=interacted_ids),
                    status=LFItem.STATUS_RESOLVED,
                ).select_related('reporter', 'category')
            )

        _annotate_claims(items, user.id)
        return Response(LFItemSerializer(items, many=True, context={'request': request}).data)

    # ------------------------------------------------------------------
    # GET /api/lf/items/{id}/suggestions/
    # ------------------------------------------------------------------
    @action(detail=True, methods=['get'])
    def suggestions(self, request, pk=None):
        try:
            item = LFItem.objects.select_related('category').get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        opposite   = LFItem.TYPE_FOUND if item.item_type == LFItem.TYPE_LOST else LFItem.TYPE_LOST
        candidates = list(
            LFItem.objects.filter(item_type=opposite, status=LFItem.STATUS_AVAILABLE)
            .select_related('reporter', 'category')
            .exclude(pk=pk)
        )
        ref_tags  = set(t.lower() for t in (item.tags or []))
        ref_words = set(item.title.lower().split())
        scored = sorted(
            ((_lf_suggestion_score(c, ref_tags, ref_words, item.category_id), c)
             for c in candidates),
            key=lambda x: x[0], reverse=True,
        )
        top = [c for s, c in scored if s > 0][:10]
        _annotate_claims(top, request.user.id)
        return Response(LFItemSerializer(top, many=True, context={'request': request}).data)

    # ------------------------------------------------------------------
    # GET /api/lf/items/my_items/
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def my_items(self, request):
        items = list(
            LFItem.objects.filter(reporter=request.user)
            .select_related('reporter', 'category')
        )
        _annotate_claims(items, request.user.id)
        return Response(LFItemSerializer(items, many=True, context={'request': request}).data)

    # ------------------------------------------------------------------
    # GET /api/lf/items/top_tags/
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'])
    def top_tags(self, request):
        rows = LFItem.objects.filter(status=LFItem.STATUS_AVAILABLE).values_list('tags', flat=True)
        counter = {}
        for tag_list in rows:
            for tag in (tag_list or []):
                counter[tag] = counter.get(tag, 0) + 1
        top = sorted(counter.items(), key=lambda x: x[1], reverse=True)[:20]
        return Response([{'tag': t, 'count': c} for t, c in top])


# ---------------------------------------------------------------------------
class LFClaimListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """All claims the current user has made."""
        claims = LFClaim.objects.filter(claimant=request.user).select_related(
            'item__reporter', 'item__category', 'claimant',
        )
        return Response(LFClaimSerializer(claims, many=True, context={'request': request}).data)


# ---------------------------------------------------------------------------
class LFNotificationViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        notifs = LFNotification.objects.filter(user=request.user).select_related('item')[:60]
        return Response(LFNotificationSerializer(notifs, many=True).data)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        n = LFNotification.objects.filter(pk=pk, user=request.user).update(is_read=True)
        if not n:
            return Response({'detail': 'Not found.'}, status=404)
        return Response({'detail': 'ok'})

    @action(detail=False, methods=['post'], url_path='mark_all_read')
    def mark_all_read(self, request):
        LFNotification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All marked as read.'})


# ---------------------------------------------------------------------------
class LFCategoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cats = list(LFCategory.objects.all())
        # Annotate item_count without hitting DB per category
        counts = dict(
            LFItem.objects.filter(status=LFItem.STATUS_AVAILABLE)
            .values('category_id').annotate(n=Count('id')).values_list('category_id', 'n')
        )
        for c in cats:
            c._item_count = counts.get(c.pk, 0)
        return Response(LFCategorySerializer(cats, many=True).data)


# ---------------------------------------------------------------------------
class LFAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        type_counts   = dict(LFItem.objects.values('item_type').annotate(n=Count('id')).values_list('item_type', 'n'))
        status_counts = dict(LFItem.objects.values('status').annotate(n=Count('id')).values_list('status', 'n'))
        top_cats      = list(
            LFItem.objects.exclude(category__isnull=True)
            .values('category__name', 'category__icon').annotate(n=Count('id')).order_by('-n')[:10]
        )
        top_locs      = list(
            LFItem.objects.exclude(location_name='')
            .values('location_name').annotate(n=Count('id')).order_by('-n')[:10]
        )
        rows = LFItem.objects.values_list('tags', flat=True)
        tag_c = {}
        for tl in rows:
            for t in (tl or []):
                tag_c[t] = tag_c.get(t, 0) + 1
        top_tags = sorted(tag_c.items(), key=lambda x: x[1], reverse=True)[:20]

        return Response({
            'type_counts':    type_counts,
            'status_counts':  status_counts,
            'top_categories': top_cats,
            'top_locations':  top_locs,
            'top_tags':       [{'tag': t, 'count': c} for t, c in top_tags],
        })


# ---------------------------------------------------------------------------
class LFTopLostLocationsView(APIView):
    """
    GET /api/lf/analytics/top-lost-locations/
    Security office only — returns locations with most LOST items (all, frontend slices to top 10).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (getattr(request.user, 'is_security', False) or request.user.is_staff):
            return Response({'detail': 'Security access only.'}, status=403)

        locations = list(
            LFItem.objects
            .filter(item_type=LFItem.TYPE_LOST)
            .exclude(location_name='')
            .values('location_name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        return Response(locations)


class LFTopLostCategoriesView(APIView):
    """
    GET /api/lf/analytics/top-lost-categories/
    Security office only — returns categories with most LOST items.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (getattr(request.user, 'is_security', False) or request.user.is_staff):
            return Response({'detail': 'Security access only.'}, status=403)

        data = list(
            LFItem.objects
            .filter(item_type=LFItem.TYPE_LOST)
            .exclude(category__isnull=True)
            .values('category__name', 'category__icon')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        return Response([
            {
                'category_name': r['category__name'],
                'category_icon': r['category__icon'] or '📦',
                'count':         r['count'],
            }
            for r in data
        ])


# ===========================================================================
# Mess Module
# ===========================================================================

# ---------------------------------------------------------------------------
# Permissions & helpers
# ---------------------------------------------------------------------------

class IsMessAdmin(BasePermission):
    """User is staff OR has a MessAdminProfile."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (request.user.is_staff or
             MessAdminProfile.objects.filter(user=request.user).exists())
        )


def _get_admin_hostel(user):
    """Return the hostel key this mess admin manages, or None for staff (all hostels)."""
    if user.is_staff:
        return None
    try:
        return user.mess_admin_profile.hostel
    except MessAdminProfile.DoesNotExist:
        return None


def _normalize_to_mess_key(hostel_raw):
    """
    Normalize any hostel string to mess-key format (used by MessAdminProfile).
    Handles both profile format ('H14', 'Tansa') and mess-key format ('hostel_14',
    'tansa_house') so comparisons work regardless of which format was stored.
    """
    if not hostel_raw:
        return ''
    if hostel_raw in ('Tansa', 'tansa_house'):
        return 'tansa_house'
    # Profile format: H1 … H21
    m = re.match(r'^H(\d+)$', hostel_raw, re.IGNORECASE)
    if m:
        return f'hostel_{m.group(1)}'
    # Already mess-key format: hostel_1 … hostel_21
    if re.match(r'^hostel_\d+$', hostel_raw):
        return hostel_raw
    return hostel_raw  # unknown format — return as-is


def _mess_key_to_profile(mess_key):
    """
    Convert mess-key format ('hostel_14') to profile format ('H14') so we can
    match against User.hostel which may have been saved in either format.
    """
    if mess_key == 'tansa_house':
        return 'Tansa'
    m = re.match(r'^hostel_(\d+)$', mess_key)
    if m:
        return f'H{m.group(1)}'
    return mess_key


def _current_semester(ref_date):
    """Return (semester_start, semester_end, label) for the given date."""
    y = ref_date.year
    if ref_date.month <= 6:          # Spring: Jan 1 – Jun 30
        return dt.date(y, 1, 1), dt.date(y, 6, 30), 'Spring'
    else:                            # Autumn: Jul 1 – Dec 31
        return dt.date(y, 7, 1), dt.date(y, 12, 31), 'Autumn'


def _compute_sma(user, year=None, month=None):
    """
    Return SMA breakdown for the *current semester* the given date falls in.

    Semesters:
      Spring  – Jan 1 → Jun 30  (SMA loaded on Jan 1)
      Autumn  – Jul 1 → Dec 31  (SMA loaded on Jul 1)

    Formula:
      balance = semester_sma
                - sum_of_daily_deductions_for_elapsed_days (0 on approved rebate days)
                - sum_of_guest_coupon_costs_in_semester
    """
    today = dt.date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    ref_date = dt.date(year, month, 1)
    semester_start, semester_end, semester_label = _current_semester(ref_date)
    calc_end = min(today, semester_end)

    hostel = user.hostel or ''
    settings_obj = MessHostelSettings.objects.filter(hostel=hostel).first()
    if settings_obj:
        semester_sma = settings_obj.monthly_sma   # field stores semester amount
        daily_rate   = settings_obj.daily_total
    else:
        semester_sma = Decimal('27000')
        daily_rate   = Decimal('150')

    # Approved rebate days within the semester so far
    approved_rebates = RebateRequest.objects.filter(
        student=user,
        status=RebateRequest.STATUS_APPROVED,
        start_date__lte=calc_end,
        end_date__gte=semester_start,
    )
    rebate_days = set()
    for rb in approved_rebates:
        cur = max(rb.start_date, semester_start)
        end = min(rb.end_date, calc_end)
        while cur <= end:
            rebate_days.add(cur)
            cur += dt.timedelta(days=1)

    # Sum daily deductions from semester_start → calc_end
    total_daily = Decimal('0')
    cur = semester_start
    while cur <= calc_end:
        if cur not in rebate_days:
            total_daily += daily_rate
        cur += dt.timedelta(days=1)

    rebate_savings = Decimal(str(len(rebate_days))) * daily_rate

    # Guest coupon extra for entire semester
    guest_extra = (
        GuestCouponPurchase.objects
        .filter(student=user, date__gte=semester_start, date__lte=calc_end)
        .aggregate(t=Sum('total_amount'))['t'] or Decimal('0')
    )

    balance = semester_sma - total_daily - guest_extra
    days_elapsed = (calc_end - semester_start).days + 1

    return {
        'semester':               semester_label,
        'semester_start':         str(semester_start),
        'semester_end':           str(semester_end),
        'year':                   year,
        'hostel':                 hostel,
        'semester_sma':           str(semester_sma),
        'daily_rate':             str(daily_rate),
        'days_elapsed':           days_elapsed,
        'rebate_days':            len(rebate_days),
        'total_daily_deduction':  str(total_daily),
        'rebate_savings':         str(rebate_savings),
        'guest_coupon_extra':     str(guest_extra),
        'balance':                str(balance),
        'balance_negative':       balance < 0,
    }


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class MessSettingsView(APIView):
    """
    GET  ?hostel=hostel_1  → returns settings (auto-creates with defaults if missing)
    PATCH                  → mess admin only; updates settings for their hostel
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hostel = request.query_params.get('hostel') or request.user.hostel
        if not hostel:
            return Response({'error': 'hostel parameter required'}, status=400)
        if hostel not in MESS_HOSTEL_KEYS:
            return Response({'error': f'Invalid hostel: {hostel}'}, status=400)
        obj, _ = MessHostelSettings.objects.get_or_create(hostel=hostel)
        return Response(MessHostelSettingsSerializer(obj).data)

    def patch(self, request):
        if not (request.user.is_staff or
                MessAdminProfile.objects.filter(user=request.user).exists()):
            return Response({'detail': 'Forbidden'}, status=403)

        hostel = request.data.get('hostel') or _get_admin_hostel(request.user)
        if not hostel:
            return Response({'error': 'hostel required'}, status=400)

        admin_h = _get_admin_hostel(request.user)
        if admin_h and admin_h != hostel:
            return Response({'detail': 'You can only manage your own hostel'}, status=403)

        obj, _ = MessHostelSettings.objects.get_or_create(hostel=hostel)
        ser = MessHostelSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


# ---------------------------------------------------------------------------
# Daily Menu
# ---------------------------------------------------------------------------

MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']


class DailyMenuView(APIView):
    """
    GET  ?hostel=hostel_1&date=YYYY-MM-DD  → returns all 4 meal slots (empty items='' if not set)
    POST { hostel, date, meal_type, items } → upsert one slot (admin only)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        hostel   = request.query_params.get('hostel') or request.user.hostel
        date_str = request.query_params.get('date') or str(dt.date.today())
        if not hostel:
            return Response({'error': 'hostel required'}, status=400)
        try:
            date_obj = dt.date.fromisoformat(date_str)
        except ValueError:
            return Response({'error': 'Use date format YYYY-MM-DD'}, status=400)

        menus    = DailyMenu.objects.filter(hostel=hostel, date=date_obj)
        menu_map = {m.meal_type: DailyMenuSerializer(m).data for m in menus}
        result   = []
        for meal in MEAL_ORDER:
            result.append(menu_map.get(meal, {
                'id': None, 'hostel': hostel, 'date': date_str,
                'meal_type': meal, 'items': '', 'updated_at': None,
                'hostel_display': hostel, 'meal_type_display': meal.capitalize(),
            }))
        return Response(result)

    def post(self, request):
        if not (request.user.is_staff or
                MessAdminProfile.objects.filter(user=request.user).exists()):
            return Response({'detail': 'Forbidden'}, status=403)

        hostel    = request.data.get('hostel')
        date_str  = request.data.get('date')
        meal_type = request.data.get('meal_type')
        items     = request.data.get('items', '')

        if not all([hostel, date_str, meal_type]):
            return Response({'error': 'hostel, date, meal_type are required'}, status=400)
        if hostel not in MESS_HOSTEL_KEYS:
            return Response({'error': f'Invalid hostel: {hostel}'}, status=400)
        if meal_type not in MESS_MEAL_KEYS:
            return Response({'error': f'Invalid meal_type: {meal_type}'}, status=400)

        admin_h = _get_admin_hostel(request.user)
        if admin_h and admin_h != hostel:
            return Response({'detail': 'You can only manage your own hostel'}, status=403)

        try:
            date_obj = dt.date.fromisoformat(date_str)
        except ValueError:
            return Response({'error': 'Use date format YYYY-MM-DD'}, status=400)

        menu, created = DailyMenu.objects.update_or_create(
            hostel=hostel, date=date_obj, meal_type=meal_type,
            defaults={'items': items, 'updated_by': request.user},
        )
        return Response(DailyMenuSerializer(menu).data, status=201 if created else 200)


# ---------------------------------------------------------------------------
# Guest Coupons
# ---------------------------------------------------------------------------

class GuestCouponViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Admin: their hostel purchases (filter by date). Student: own purchases."""
        qs = GuestCouponPurchase.objects.select_related('student')

        is_admin = request.user.is_staff or MessAdminProfile.objects.filter(user=request.user).exists()
        if is_admin:
            admin_h = _get_admin_hostel(request.user)
            if admin_h:
                qs = qs.filter(hostel=admin_h)
            date_str = request.query_params.get('date')
            if date_str:
                try:
                    qs = qs.filter(date=dt.date.fromisoformat(date_str))
                except ValueError:
                    pass
            hostel = request.query_params.get('hostel')
            if hostel and not admin_h:
                qs = qs.filter(hostel=hostel)
        else:
            qs = qs.filter(student=request.user)
            month = request.query_params.get('month')
            year  = request.query_params.get('year')
            if month and year:
                try:
                    qs = qs.filter(date__month=int(month), date__year=int(year))
                except ValueError:
                    pass

        return Response(GuestCouponReadSerializer(qs, many=True).data)

    def create(self, request):
        """Student purchases guest coupons. Validates limits, deducts from SMA via ledger."""
        ser = GuestCouponCreateSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        vd = ser.validated_data

        hostel       = vd['hostel']
        date         = vd['date']
        meal_type    = vd['meal_type']
        qty          = vd['quantity']
        settings_obj = vd['_settings']

        unit_price   = settings_obj.guest_price(meal_type)
        total_amount = unit_price * qty

        with transaction.atomic():
            purchase = GuestCouponPurchase.objects.create(
                student      = request.user,
                hostel       = hostel,
                date         = date,
                meal_type    = meal_type,
                quantity     = qty,
                unit_price   = unit_price,
                total_amount = total_amount,
                roll_number  = request.user.roll_number,
                room_number  = request.user.room_number,
                hostel_number= request.user.hostel,
            )

        return Response(GuestCouponReadSerializer(purchase).data, status=201)


# ---------------------------------------------------------------------------
# Rebate Requests
# ---------------------------------------------------------------------------

class RebateViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """Admin: see all requests for their hostel (by student's hostel). Student: own requests."""
        is_admin = request.user.is_staff or MessAdminProfile.objects.filter(user=request.user).exists()
        if is_admin:
            admin_h = _get_admin_hostel(request.user)
            qs = RebateRequest.objects.select_related('student', 'reviewed_by')
            if admin_h:
                # User.hostel may be stored in either 'hostel_14' or 'H14' format
                # depending on how the profile was last saved — match both.
                profile_h = _mess_key_to_profile(admin_h)
                qs = qs.filter(
                    Q(student__hostel=admin_h) | Q(student__hostel=profile_h)
                )
            status_filter = request.query_params.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter.upper())
        else:
            qs = RebateRequest.objects.filter(student=request.user)

        return Response(RebateRequestSerializer(qs, many=True).data)

    def create(self, request):
        """Student submits a rebate request for their own hostel."""
        ser = RebateRequestSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(RebateRequestSerializer(obj).data, status=201)

    @action(detail=True, methods=['post'], permission_classes=[IsMessAdmin])
    def review(self, request, pk=None):
        """Admin approves or rejects a rebate request."""
        try:
            rebate = RebateRequest.objects.select_related('student').get(pk=pk)
        except RebateRequest.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)

        # Check the mess admin manages this student's hostel.
        # Normalize both values to mess-key format before comparing because
        # User.hostel may be stored as 'H14' while admin_h is 'hostel_14'.
        admin_h = _get_admin_hostel(request.user)
        if admin_h and _normalize_to_mess_key(rebate.student.hostel) != admin_h:
            return Response({'detail': 'Cannot manage other hostels'}, status=403)

        if rebate.status != RebateRequest.STATUS_PENDING:
            return Response({'detail': f'Request already {rebate.status}'}, status=400)

        rev_ser = RebateReviewSerializer(data=request.data)
        rev_ser.is_valid(raise_exception=True)
        vd = rev_ser.validated_data

        rebate.status      = vd['status']
        rebate.admin_note  = vd.get('admin_note', '')
        rebate.reviewed_by = request.user
        rebate.reviewed_at = timezone.now()
        rebate.save(update_fields=['status', 'admin_note', 'reviewed_by', 'reviewed_at'])

        return Response(RebateRequestSerializer(rebate).data)


# ---------------------------------------------------------------------------
# SMA Balance
# ---------------------------------------------------------------------------

class MessSMAView(APIView):
    """
    GET /mess/sma/?year=2026&month=4
    Returns SMA breakdown for the authenticated student (or a specific user for admins).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # year/month are optional — defaults to today's semester
        today = dt.date.today()
        try:
            year  = int(request.query_params.get('year',  today.year))
            month = int(request.query_params.get('month', today.month))
        except ValueError:
            return Response({'error': 'year and month must be integers'}, status=400)
        if not (1 <= month <= 12):
            return Response({'error': 'month must be 1–12'}, status=400)

        # Admin can query any student
        user_id = request.query_params.get('user_id')
        if user_id:
            is_admin = request.user.is_staff or MessAdminProfile.objects.filter(user=request.user).exists()
            if not is_admin:
                return Response({'detail': 'Forbidden'}, status=403)
            try:
                target_user = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return Response({'detail': 'User not found'}, status=404)
        else:
            target_user = request.user

        return Response(_compute_sma(target_user, year, month))


# ---------------------------------------------------------------------------
# Mess Analytics (admin)
# ---------------------------------------------------------------------------

class MessAnalyticsView(APIView):
    """Admin: summary stats for their hostel."""
    permission_classes = [IsMessAdmin]

    def get(self, request):
        admin_h  = _get_admin_hostel(request.user)
        today    = dt.date.today()
        month    = today.month
        year     = today.year

        coupon_qs = GuestCouponPurchase.objects.filter(
            date__year=year, date__month=month
        )
        if admin_h:
            coupon_qs = coupon_qs.filter(hostel=admin_h)

        rebate_qs = RebateRequest.objects.filter(
            created_at__year=year, created_at__month=month
        )
        if admin_h:
            # RebateRequest.hostel may be stored in either format ('H14' or 'hostel_14')
            # depending on when the record was created — match both.
            profile_h = _mess_key_to_profile(admin_h)
            rebate_qs = rebate_qs.filter(
                Q(hostel=admin_h) | Q(hostel=profile_h)
            )

        coupon_total  = coupon_qs.aggregate(t=Sum('total_amount'))['t'] or 0
        coupon_count  = coupon_qs.count()
        rebate_pending= rebate_qs.filter(status='PENDING').count()
        rebate_approved=rebate_qs.filter(status='APPROVED').count()

        # Per-meal coupon breakdown
        meal_breakdown = list(
            coupon_qs.values('meal_type')
                     .annotate(qty=Sum('quantity'), revenue=Sum('total_amount'))
                     .order_by('meal_type')
        )

        return Response({
            'hostel':           admin_h or 'all',
            'month':            month,
            'year':             year,
            'coupon_total_revenue': str(coupon_total),
            'coupon_total_count':   coupon_count,
            'rebate_pending':       rebate_pending,
            'rebate_approved':      rebate_approved,
            'meal_breakdown':       meal_breakdown,
        })


# ===========================================================================
# Admin Master Console  (is_staff only)
# ===========================================================================

class IsStaffUser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_staff


class ConsoleStatsView(APIView):
    """Global platform statistics for the master console overview."""
    permission_classes = [IsStaffUser]

    def get(self, request):
        today = dt.date.today()
        return Response({
            # Users
            'total_users':        User.objects.count(),
            'staff_users':        User.objects.filter(is_staff=True).count(),
            'active_sessions':    User.objects.filter(is_active=True).count(),
            'mess_admins':        MessAdminProfile.objects.count(),
            'outlet_admins':      OutletAdmin.objects.count(),
            # Mess
            'total_menus':        DailyMenu.objects.count(),
            'total_coupons':      GuestCouponPurchase.objects.count(),
            'total_rebates':      RebateRequest.objects.count(),
            'pending_rebates':    RebateRequest.objects.filter(status='PENDING').count(),
            'approved_rebates':   RebateRequest.objects.filter(status='APPROVED').count(),
            # Other modules
            'total_food_orders':  FoodOrder.objects.count(),
            'total_help':         HelpRequest.objects.count(),
            'total_lf':           LFItem.objects.count(),
            # Today summary
            'coupons_today':      GuestCouponPurchase.objects.filter(date=today).count(),
            'menus_today':        DailyMenu.objects.filter(date=today).count(),
        })


class ConsoleUserViewSet(viewsets.ViewSet):
    """Staff-only CRUD for user accounts."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        qs = User.objects.all().order_by('username')
        q = (request.query_params.get('search') or request.query_params.get('q', '')).strip()
        if q:
            qs = qs.filter(
                Q(username__icontains=q) | Q(email__icontains=q) |
                Q(full_name__icontains=q) | Q(roll_number__icontains=q)
            )
        hostel = request.query_params.get('hostel')
        if hostel:
            qs = qs.filter(hostel=hostel)
        return Response(AdminUserListSerializer(qs, many=True).data)

    def retrieve(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(AdminUserListSerializer(user).data)

    def partial_update(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ser = AdminUserUpdateSerializer(user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        updated = ser.save()
        return Response(AdminUserListSerializer(updated).data)


class ConsoleMenuViewSet(viewsets.ViewSet):
    """Staff-only: list all daily menus (with filters) and delete entries."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        qs = DailyMenu.objects.select_related('updated_by').order_by('-date', 'hostel', 'meal_type')
        hostel   = request.query_params.get('hostel')
        date_str = request.query_params.get('date')
        if hostel:
            qs = qs.filter(hostel=hostel)
        if date_str:
            try:
                qs = qs.filter(date=dt.date.fromisoformat(date_str))
            except ValueError:
                pass
        return Response(DailyMenuSerializer(qs, many=True).data)

    def destroy(self, request, pk=None):
        try:
            obj = DailyMenu.objects.get(pk=pk)
        except DailyMenu.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        obj.delete()
        return Response(status=204)


class ConsoleCouponViewSet(viewsets.ViewSet):
    """Staff-only: view and delete guest coupon purchases."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        qs = GuestCouponPurchase.objects.select_related('student').order_by('-purchased_at')
        hostel   = request.query_params.get('hostel')
        date_str = request.query_params.get('date')
        q        = request.query_params.get('q', '').strip()
        if hostel:
            qs = qs.filter(hostel=hostel)
        if date_str:
            try:
                qs = qs.filter(date=dt.date.fromisoformat(date_str))
            except ValueError:
                pass
        if q:
            qs = qs.filter(
                Q(student__username__icontains=q) |
                Q(roll_number__icontains=q) |
                Q(room_number__icontains=q)
            )
        return Response(GuestCouponReadSerializer(qs, many=True).data)

    def destroy(self, request, pk=None):
        try:
            obj = GuestCouponPurchase.objects.get(pk=pk)
        except GuestCouponPurchase.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        obj.delete()
        return Response(status=204)


class ConsoleRebateViewSet(viewsets.ViewSet):
    """Staff-only: view, approve/reject, and delete rebate requests."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        qs = RebateRequest.objects.select_related('student', 'reviewed_by').order_by('-created_at')
        status_f = request.query_params.get('status')
        hostel   = request.query_params.get('hostel')
        q        = request.query_params.get('q', '').strip()
        if status_f:
            qs = qs.filter(status=status_f.upper())
        if hostel:
            qs = qs.filter(hostel=hostel)
        if q:
            qs = qs.filter(
                Q(student__username__icontains=q) |
                Q(student__full_name__icontains=q) |
                Q(student__roll_number__icontains=q)
            )
        return Response(RebateRequestSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'])
    def review(self, request, pk=None):
        try:
            rebate = RebateRequest.objects.get(pk=pk)
        except RebateRequest.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        if rebate.status != 'PENDING':
            return Response({'detail': f'Already {rebate.status}'}, status=400)
        rev_ser = RebateReviewSerializer(data=request.data)
        rev_ser.is_valid(raise_exception=True)
        vd = rev_ser.validated_data
        rebate.status      = vd['status']
        rebate.admin_note  = vd.get('admin_note', '')
        rebate.reviewed_by = request.user
        rebate.reviewed_at = timezone.now()
        rebate.save(update_fields=['status', 'admin_note', 'reviewed_by', 'reviewed_at'])
        return Response(RebateRequestSerializer(rebate).data)

    def destroy(self, request, pk=None):
        try:
            obj = RebateRequest.objects.get(pk=pk)
        except RebateRequest.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        obj.delete()
        return Response(status=204)


class ConsoleSettingsViewSet(viewsets.ViewSet):
    """Staff-only: list and update all hostel mess settings."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        # Return settings for all hostels, auto-create missing ones
        from .models import MESS_HOSTEL_CHOICES
        result = []
        for key, label in MESS_HOSTEL_CHOICES:
            obj, _ = MessHostelSettings.objects.get_or_create(hostel=key)
            data = MessHostelSettingsSerializer(obj).data
            data['hostel_label'] = label
            result.append(data)
        return Response(result)

    def partial_update(self, request, pk=None):
        try:
            obj = MessHostelSettings.objects.get(pk=pk)
        except MessHostelSettings.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ser = MessHostelSettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


# ===========================================================================
# Contacts Module
# ===========================================================================

class ContactsIsStaffOrReadOnly(BasePermission):
    """Anyone can read; only staff can write."""
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.is_staff


class FacultyViewSet(viewsets.ViewSet):
    permission_classes = [ContactsIsStaffOrReadOnly]

    def list(self, request):
        qs = Faculty.objects.all()
        q    = request.query_params.get('q', '').strip()
        dept = request.query_params.get('dept', '').strip()
        avail = request.query_params.get('available', '').strip()
        if q:
            qs = qs.filter(
                Q(name__icontains=q) |
                Q(department__icontains=q) |
                Q(specialization__icontains=q)
            )
        if dept:
            qs = qs.filter(department__iexact=dept)
        if avail in ('true', 'false'):
            qs = qs.filter(is_available=(avail == 'true'))
        ser = FacultySerializer(qs, many=True, context={'request': request})
        return Response(ser.data)

    def create(self, request):
        ser = FacultyWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(FacultySerializer(obj, context={'request': request}).data, status=201)

    def partial_update(self, request, pk=None):
        try:
            obj = Faculty.objects.get(pk=pk)
        except Faculty.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ser = FacultyWriteSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(FacultySerializer(obj, context={'request': request}).data)

    def destroy(self, request, pk=None):
        try:
            Faculty.objects.get(pk=pk).delete()
        except Faculty.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(status=204)

    @action(detail=True, methods=['patch'], url_path='toggle-availability')
    def toggle_availability(self, request, pk=None):
        try:
            obj = Faculty.objects.get(pk=pk)
        except Faculty.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        obj.is_available = not obj.is_available
        obj.save(update_fields=['is_available', 'updated_at'])
        return Response(FacultySerializer(obj, context={'request': request}).data)


class DepartmentViewSet(viewsets.ViewSet):
    permission_classes = [ContactsIsStaffOrReadOnly]

    def list(self, request):
        qs = Department.objects.all()
        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(location__icontains=q))
        return Response(DepartmentSerializer(qs, many=True).data)

    def create(self, request):
        ser = DepartmentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(DepartmentSerializer(obj).data, status=201)

    def partial_update(self, request, pk=None):
        try:
            obj = Department.objects.get(pk=pk)
        except Department.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ser = DepartmentSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        return Response(DepartmentSerializer(ser.save()).data)

    def destroy(self, request, pk=None):
        try:
            Department.objects.get(pk=pk).delete()
        except Department.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(status=204)


class EmergencyContactViewSet(viewsets.ViewSet):
    permission_classes = [ContactsIsStaffOrReadOnly]

    def list(self, request):
        qs = EmergencyContact.objects.all()
        q = request.query_params.get('q', '').strip()
        if q:
            qs = qs.filter(Q(service_name__icontains=q) | Q(contact__icontains=q))
        return Response(EmergencyContactSerializer(qs, many=True).data)

    def create(self, request):
        ser = EmergencyContactSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(EmergencyContactSerializer(obj).data, status=201)

    def partial_update(self, request, pk=None):
        try:
            obj = EmergencyContact.objects.get(pk=pk)
        except EmergencyContact.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ser = EmergencyContactSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        return Response(EmergencyContactSerializer(ser.save()).data)

    def destroy(self, request, pk=None):
        try:
            EmergencyContact.objects.get(pk=pk).delete()
        except EmergencyContact.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(status=204)


# ---------------------------------------------------------------------------
# Doctor Schedule
# ---------------------------------------------------------------------------

class DoctorScheduleView(APIView):
    """Return the cached doctor schedule. Staff can also trigger a manual refresh."""
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            cache = DoctorScheduleCache.objects.get(id=1)
            return Response(cache.data)
        except DoctorScheduleCache.DoesNotExist:
            return Response({'detail': 'Schedule not yet fetched. Ask admin to run fetch_doctors.'}, status=404)

    def post(self, request):
        """Manual refresh — staff only."""
        if not request.user.is_authenticated or not request.user.is_staff:
            return Response({'detail': 'Staff only.'}, status=403)
        from django.core.management import call_command
        try:
            call_command('fetch_doctors')
            cache = DoctorScheduleCache.objects.get(id=1)
            return Response(cache.data)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=500)
