"""
[Farhan] Food Ordering Module views — outlets, orders, outlet-admin panel, analytics.
"""
import datetime as dt

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    FOOD_ACTIVE_STATUSES,
    FOOD_DELIVERY_LOCATION_CHOICES,
    FoodOrder,
    FoodOrderItem,
    MenuItem,
    Outlet,
    OutletAdmin,
    Review,
)
from ..serializers import (
    FoodOrderSerializer,
    MenuItemSerializer,
    MenuItemWriteSerializer,
    OutletSerializer,
    PlaceOrderSerializer,
    ReviewSubmitSerializer,
)


# ---------------------------------------------------------------------------
# Permission
# ---------------------------------------------------------------------------

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
      search         — name contains (case-insensitive)
      is_veg         — 'true' / 'false'
      available_only — 'true'
      sort_by        — rating_desc | rating_asc | price_desc | price_asc
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
                        {'detail': f'Item {fid} not found in this outlet.'},
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
                order = FoodOrder.objects.select_for_update().get(pk=pk, user=request.user)
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
                    return Response(
                        {'detail': 'Cannot cancel a delivered or already-cancelled order.'},
                        status=400,
                    )
                order.status = 'CANCELLED'

            else:
                return Response({'detail': 'Unknown action.'}, status=400)

            order.save(update_fields=['status', 'updated_at'])

        return Response(FoodOrderSerializer(order, context={'request': request}).data)

    def patch(self, request, pk, action_name=None):
        """
        PATCH /api/food/admin/orders/{pk}/status/ — advance order status.
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
                    {
                        'detail': (
                            f'Cannot transition from {order.status} to {new_status}. '
                            f'Allowed: {allowed}'
                        )
                    },
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
    """GET /api/food/analytics/hostel-wise/ — delivery orders only."""

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
        outlet = self.get_outlet(request)
        cutoff = timezone.now() - dt.timedelta(days=30)
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
