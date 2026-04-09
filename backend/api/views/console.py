"""
Admin Master Console views — staff-only CRUD and analytics across all modules.
"""
import datetime as dt

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    MESS_HOSTEL_CHOICES,
    DailyMenu,
    FoodOrder,
    GuestCouponPurchase,
    HelpRequest,
    Hostel,
    LFItem,
    MessAdminProfile,
    MessHostelSettings,
    Outlet,
    OutletAdmin,
    RebateRequest,
    User,
)
from ..serializers import (
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
    ConsoleFoodOrderSerializer,
    ConsoleHostelSerializer,
    ConsoleOutletAdminSerializer,
    ConsoleOutletSerializer,
    ConsoleOutletWriteSerializer,
    DailyMenuSerializer,
    GuestCouponReadSerializer,
    MessHostelSettingsSerializer,
    RebateRequestSerializer,
    RebateReviewSerializer,
)


# ---------------------------------------------------------------------------
# Permission
# ---------------------------------------------------------------------------

class IsStaffUser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_staff


# ---------------------------------------------------------------------------
# Stats overview
# ---------------------------------------------------------------------------

class ConsoleStatsView(APIView):
    """Global platform statistics for the master console overview."""
    permission_classes = [IsStaffUser]

    def get(self, request):
        today = dt.date.today()
        return Response({
            # Users
            'total_users':    User.objects.count(),
            'staff_users':    User.objects.filter(is_staff=True).count(),
            'active_sessions':User.objects.filter(is_active=True).count(),
            'mess_admins':    MessAdminProfile.objects.count(),
            'outlet_admins':  OutletAdmin.objects.count(),
            # Mess
            'total_menus':    DailyMenu.objects.count(),
            'total_coupons':  GuestCouponPurchase.objects.count(),
            'total_rebates':  RebateRequest.objects.count(),
            'pending_rebates':RebateRequest.objects.filter(status='PENDING').count(),
            'approved_rebates':RebateRequest.objects.filter(status='APPROVED').count(),
            # Other modules
            'total_food_orders': FoodOrder.objects.count(),
            'total_help':        HelpRequest.objects.count(),
            'total_lf':          LFItem.objects.count(),
            # Today summary
            'coupons_today': GuestCouponPurchase.objects.filter(date=today).count(),
            'menus_today':   DailyMenu.objects.filter(date=today).count(),
        })


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Daily Menus
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Guest Coupons
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Rebates
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Mess Settings
# ---------------------------------------------------------------------------

class ConsoleSettingsViewSet(viewsets.ViewSet):
    """Staff-only: list and update all hostel mess settings."""
    permission_classes = [IsStaffUser]

    def list(self, request):
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


# ---------------------------------------------------------------------------
# Outlets
# ---------------------------------------------------------------------------

class ConsoleOutletViewSet(viewsets.ViewSet):
    """Staff-only: full CRUD for food outlets."""
    permission_classes = [IsStaffUser]

    def _annotated_qs(self):
        return Outlet.objects.annotate(
            admin_count=Count('outlet_admins'),
            menu_count=Count('menu_items'),
        ).order_by('name')

    def list(self, request):
        return Response(ConsoleOutletSerializer(self._annotated_qs(), many=True).data)

    def create(self, request):
        ser = ConsoleOutletWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        outlet = ser.save()
        result = ConsoleOutletSerializer(self._annotated_qs().get(pk=outlet.pk))
        return Response(result.data, status=201)

    def partial_update(self, request, pk=None):
        try:
            outlet = Outlet.objects.get(pk=pk)
        except Outlet.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ser = ConsoleOutletWriteSerializer(outlet, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ConsoleOutletSerializer(self._annotated_qs().get(pk=outlet.pk)).data)

    def destroy(self, request, pk=None):
        try:
            Outlet.objects.get(pk=pk).delete()
        except Outlet.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(status=204)


# ---------------------------------------------------------------------------
# Outlet Admins
# ---------------------------------------------------------------------------

class ConsoleOutletAdminViewSet(viewsets.ViewSet):
    """Staff-only: assign / remove outlet admins."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        qs = OutletAdmin.objects.select_related('user', 'outlet').order_by('outlet__name')
        return Response(ConsoleOutletAdminSerializer(qs, many=True).data)

    def create(self, request):
        ser = ConsoleOutletAdminSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(ConsoleOutletAdminSerializer(obj).data, status=201)

    def destroy(self, request, pk=None):
        try:
            OutletAdmin.objects.get(pk=pk).delete()
        except OutletAdmin.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(status=204)


# ---------------------------------------------------------------------------
# Hostels
# ---------------------------------------------------------------------------

class ConsoleHostelViewSet(viewsets.ViewSet):
    """Staff-only: full CRUD for hostels."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        return Response(ConsoleHostelSerializer(Hostel.objects.all().order_by('name'), many=True).data)

    def create(self, request):
        ser = ConsoleHostelSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        hostel = ser.save()
        return Response(ConsoleHostelSerializer(hostel).data, status=201)

    def partial_update(self, request, pk=None):
        try:
            hostel = Hostel.objects.get(pk=pk)
        except Hostel.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        ser = ConsoleHostelSerializer(hostel, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ConsoleHostelSerializer(hostel).data)

    def destroy(self, request, pk=None):
        try:
            Hostel.objects.get(pk=pk).delete()
        except Hostel.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        return Response(status=204)


# ---------------------------------------------------------------------------
# Food Orders (read-only)
# ---------------------------------------------------------------------------

class ConsoleFoodOrderViewSet(viewsets.ViewSet):
    """Staff-only: view all food orders with filters."""
    permission_classes = [IsStaffUser]

    def list(self, request):
        qs = FoodOrder.objects.select_related('user', 'outlet').prefetch_related(
            'order_items__food_item'
        ).order_by('-created_at')
        outlet_id  = request.query_params.get('outlet')
        status_f   = request.query_params.get('status')
        order_type = request.query_params.get('order_type')
        q          = request.query_params.get('q', '').strip()
        if outlet_id:
            qs = qs.filter(outlet_id=outlet_id)
        if status_f:
            qs = qs.filter(status=status_f.upper())
        if order_type:
            qs = qs.filter(order_type=order_type.upper())
        if q:
            qs = qs.filter(
                Q(user__username__icontains=q) |
                Q(user__full_name__icontains=q) |
                Q(user__roll_number__icontains=q)
            )
        return Response(ConsoleFoodOrderSerializer(qs[:200], many=True).data)
