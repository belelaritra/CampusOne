"""
[Aman] Mess Module views — settings, daily menu, guest coupons, rebates, SMA balance, analytics.
"""
import datetime as dt
import re
from decimal import Decimal

from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    MESS_HOSTEL_KEYS,
    MESS_MEAL_KEYS,
    DailyMenu,
    GuestCouponPurchase,
    MessAdminProfile,
    MessHostelSettings,
    RebateRequest,
    User,
)
from ..serializers import (
    DailyMenuSerializer,
    GuestCouponCreateSerializer,
    GuestCouponReadSerializer,
    MessHostelSettingsSerializer,
    RebateRequestSerializer,
    RebateReviewSerializer,
)

MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']


# ---------------------------------------------------------------------------
# Permissions
# ---------------------------------------------------------------------------

class IsMessAdmin(BasePermission):
    """User is staff OR has a MessAdminProfile."""
    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            (request.user.is_staff or
             MessAdminProfile.objects.filter(user=request.user).exists())
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

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
    m = re.match(r'^H(\d+)$', hostel_raw, re.IGNORECASE)
    if m:
        return f'hostel_{m.group(1)}'
    if re.match(r'^hostel_\d+$', hostel_raw):
        return hostel_raw
    return hostel_raw


def _mess_key_to_profile(mess_key):
    """Convert mess-key format ('hostel_14') to profile format ('H14')."""
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
    Return SMA breakdown for the current semester the given date falls in.

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
        semester_sma = settings_obj.monthly_sma
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
        'semester':              semester_label,
        'semester_start':        str(semester_start),
        'semester_end':          str(semester_end),
        'year':                  year,
        'hostel':                hostel,
        'semester_sma':          str(semester_sma),
        'daily_rate':            str(daily_rate),
        'days_elapsed':          days_elapsed,
        'rebate_days':           len(rebate_days),
        'total_daily_deduction': str(total_daily),
        'rebate_savings':        str(rebate_savings),
        'guest_coupon_extra':    str(guest_extra),
        'balance':               str(balance),
        'balance_negative':      balance < 0,
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

class DailyMenuView(APIView):
    """
    GET  ?hostel=hostel_1&date=YYYY-MM-DD  → returns all 4 meal slots
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
        """Student purchases guest coupons."""
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

        from django.db import transaction as _tx
        with _tx.atomic():
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
        """Admin: see all requests for their hostel. Student: own requests."""
        is_admin = request.user.is_staff or MessAdminProfile.objects.filter(user=request.user).exists()
        if is_admin:
            admin_h = _get_admin_hostel(request.user)
            qs = RebateRequest.objects.select_related('student', 'reviewed_by')
            if admin_h:
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
        today = dt.date.today()
        try:
            year  = int(request.query_params.get('year',  today.year))
            month = int(request.query_params.get('month', today.month))
        except ValueError:
            return Response({'error': 'year and month must be integers'}, status=400)
        if not (1 <= month <= 12):
            return Response({'error': 'month must be 1–12'}, status=400)

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
# Analytics
# ---------------------------------------------------------------------------

class MessAnalyticsView(APIView):
    """Admin: summary stats for their hostel."""
    permission_classes = [IsMessAdmin]

    def get(self, request):
        admin_h = _get_admin_hostel(request.user)
        today   = dt.date.today()
        month   = today.month
        year    = today.year

        coupon_qs = GuestCouponPurchase.objects.filter(date__year=year, date__month=month)
        if admin_h:
            coupon_qs = coupon_qs.filter(hostel=admin_h)

        rebate_qs = RebateRequest.objects.filter(
            created_at__year=year, created_at__month=month
        )
        if admin_h:
            profile_h = _mess_key_to_profile(admin_h)
            rebate_qs = rebate_qs.filter(
                Q(hostel=admin_h) | Q(hostel=profile_h)
            )

        coupon_total   = coupon_qs.aggregate(t=Sum('total_amount'))['t'] or 0
        coupon_count   = coupon_qs.count()
        rebate_pending = rebate_qs.filter(status='PENDING').count()
        rebate_approved= rebate_qs.filter(status='APPROVED').count()

        meal_breakdown = list(
            coupon_qs.values('meal_type')
                     .annotate(qty=Sum('quantity'), revenue=Sum('total_amount'))
                     .order_by('meal_type')
        )

        return Response({
            'hostel':               admin_h or 'all',
            'month':                month,
            'year':                 year,
            'coupon_total_revenue': str(coupon_total),
            'coupon_total_count':   coupon_count,
            'rebate_pending':       rebate_pending,
            'rebate_approved':      rebate_approved,
            'meal_breakdown':       meal_breakdown,
        })
