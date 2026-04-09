"""
[Hariom] Lost & Found Module views — items, claims, notifications, categories, analytics.
"""
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import (
    LFCategory,
    LFClaim,
    LFItem,
    LFLog,
    LFNotification,
    User,
)
from ..serializers import (
    LFCategorySerializer,
    LFClaimSerializer,
    LFItemCreateSerializer,
    LFItemSerializer,
    LFNotificationSerializer,
)
from .utils import LF_LOCATION_COORDS, haversine


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

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
    active_qs  = LFClaim.objects.filter(item_id__in=ids, status='PENDING').select_related('claimant')
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
        item._active_interaction   = ai
        item._resolved_interaction = resolved_map.get(item.pk)
        item._user_has_claimed     = ai is not None and ai.claimant_id == user_id


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
                    f'"{found_item.title}" at {found_item.location_name or "campus"}'
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
                        f'Your ID card has been found at '
                        f'{found_item.location_name or "campus"}. '
                        f'Contact the finder to collect it.'
                    ),
                ))
        except User.DoesNotExist:
            pass

    if notifications:
        LFNotification.objects.bulk_create(notifications, ignore_conflicts=True)


# ---------------------------------------------------------------------------
# ViewSets & Views
# ---------------------------------------------------------------------------

class LFItemViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

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

    def create(self, request):
        serializer = LFItemCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        save_kwargs = {'reporter': request.user}
        vd = serializer.validated_data
        if not vd.get('location_name') and vd.get('latitude') and vd.get('longitude'):
            save_kwargs['location_name'] = _nearest_lf_location(vd['latitude'], vd['longitude'])

        with transaction.atomic():
            item = serializer.save(**save_kwargs)
            LFLog.objects.create(
                item=item, actor=request.user, action='POSTED',
                detail=f'{item.item_type}: {item.title}',
            )
            if item.item_type == LFItem.TYPE_FOUND:
                _bulk_notify_found(item, request.user)

        _annotate_claims([item], request.user.id)
        return Response(
            LFItemSerializer(item, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    def retrieve(self, request, pk=None):
        try:
            item = LFItem.objects.select_related('reporter', 'category').get(pk=pk)
        except LFItem.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data)

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
            save_kwargs['location_name'] = _nearest_lf_location(vd['latitude'], vd['longitude'])

        with transaction.atomic():
            updated = serializer.save(**save_kwargs)
            LFLog.objects.create(item=updated, actor=request.user, action='EDITED')

        _annotate_claims([updated], request.user.id)
        return Response(LFItemSerializer(updated, context={'request': request}).data)

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
            item = LFItem.objects.select_for_update().select_related('reporter').get(pk=pk)
            if item.status != LFItem.STATUS_AVAILABLE:
                return Response({'detail': 'This item is no longer available.'}, status=409)

            try:
                LFClaim.objects.create(
                    item=item, claimant=request.user, message=message, status='PENDING',
                )
            except IntegrityError:
                return Response(
                    {'detail': 'Another interaction is already pending for this item.'},
                    status=409,
                )

            LFItem.objects.filter(pk=item.pk).update(status=LFItem.STATUS_PENDING)
            item.status = LFItem.STATUS_PENDING

            verb = 'found' if item.item_type == LFItem.TYPE_LOST else 'claimed'
            LFNotification.objects.create(
                user=item.reporter, item=item,
                message=(
                    f'{request.user.full_name or request.user.username} '
                    f'has {verb} your {item.item_type.lower()} item: "{item.title}"'
                ),
            )
            LFLog.objects.create(item=item, actor=request.user, action='INTERACTED', detail=message)

        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data, status=201)

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
            LFClaim.objects.filter(item=item, status='PENDING').update(status='RESOLVED')
            LFItem.objects.filter(pk=item.pk).update(status=LFItem.STATUS_RESOLVED)
            item.status = LFItem.STATUS_RESOLVED

            resolved_claim = (
                LFClaim.objects.filter(item=item, status='RESOLVED')
                .select_related('claimant')
                .order_by('-created_at').first()
            )
            if resolved_claim:
                LFNotification.objects.create(
                    user=resolved_claim.claimant, item=item,
                    message=(
                        f'Your {"report" if item.item_type == LFItem.TYPE_LOST else "claim"} '
                        f'for "{item.title}" has been marked as resolved.'
                    ),
                )
            LFLog.objects.create(item=item, actor=request.user, action='RESOLVED')

        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data)

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
                        f'The pending interaction for "{item.title}" has been cancelled. '
                        f'The item is back on the board.'
                    ),
                )
            LFLog.objects.create(item=item, actor=request.user, action='REVERTED')

        _annotate_claims([item], request.user.id)
        return Response(LFItemSerializer(item, context={'request': request}).data)

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
            interacted_ids = LFClaim.objects.filter(claimant=user).values_list('item_id', flat=True)
            items = list(
                LFItem.objects.filter(
                    Q(reporter=user) | Q(id__in=interacted_ids),
                    status=LFItem.STATUS_RESOLVED,
                ).select_related('reporter', 'category')
            )

        _annotate_claims(items, user.id)
        return Response(LFItemSerializer(items, many=True, context={'request': request}).data)

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

    @action(detail=False, methods=['get'])
    def my_items(self, request):
        items = list(
            LFItem.objects.filter(reporter=request.user)
            .select_related('reporter', 'category')
        )
        _annotate_claims(items, request.user.id)
        return Response(LFItemSerializer(items, many=True, context={'request': request}).data)

    @action(detail=False, methods=['get'])
    def top_tags(self, request):
        rows = LFItem.objects.filter(status=LFItem.STATUS_AVAILABLE).values_list('tags', flat=True)
        counter = {}
        for tag_list in rows:
            for tag in (tag_list or []):
                counter[tag] = counter.get(tag, 0) + 1
        top = sorted(counter.items(), key=lambda x: x[1], reverse=True)[:20]
        return Response([{'tag': t, 'count': c} for t, c in top])


class LFClaimListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """All claims the current user has made."""
        claims = LFClaim.objects.filter(claimant=request.user).select_related(
            'item__reporter', 'item__category', 'claimant',
        )
        return Response(LFClaimSerializer(claims, many=True, context={'request': request}).data)


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


class LFCategoryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cats = list(LFCategory.objects.all())
        counts = dict(
            LFItem.objects.filter(status=LFItem.STATUS_AVAILABLE)
            .values('category_id').annotate(n=Count('id')).values_list('category_id', 'n')
        )
        for c in cats:
            c._item_count = counts.get(c.pk, 0)
        return Response(LFCategorySerializer(cats, many=True).data)


class LFAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        type_counts   = dict(LFItem.objects.values('item_type').annotate(n=Count('id')).values_list('item_type', 'n'))
        status_counts = dict(LFItem.objects.values('status').annotate(n=Count('id')).values_list('status', 'n'))
        top_cats = list(
            LFItem.objects.exclude(category__isnull=True)
            .values('category__name', 'category__icon').annotate(n=Count('id')).order_by('-n')[:10]
        )
        top_locs = list(
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


class LFTopLostLocationsView(APIView):
    """Security office only — returns locations with most LOST items."""
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
    """Security office only — returns categories with most LOST items."""
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
