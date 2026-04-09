"""
[Aritra] Help & Delivery views — HelpRequestViewSet.
"""
import datetime as dt

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from ..models import HelpRequest, User
from ..serializers import (
    HelpRequestCreateSerializer,
    HelpRequestEditSerializer,
    HelpRequestSerializer,
)
from .utils import ACCEPT_RADIUS_METRES, PICKUP_COORDS, haversine


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
