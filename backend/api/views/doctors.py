"""
Doctor Schedule view — serves cached schedule data; staff can trigger refresh.
"""
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import DoctorScheduleCache


class DoctorScheduleView(APIView):
    """Return the cached doctor schedule. Staff can also trigger a manual refresh."""
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            cache = DoctorScheduleCache.objects.get(id=1)
            return Response(cache.data)
        except DoctorScheduleCache.DoesNotExist:
            return Response(
                {'detail': 'Schedule not yet fetched. Ask admin to run fetch_doctors.'},
                status=404,
            )

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
