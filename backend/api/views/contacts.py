"""
Contacts Module views — faculty, departments, emergency contacts.
"""
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from ..models import Department, EmergencyContact, Faculty
from ..serializers import (
    DepartmentSerializer,
    EmergencyContactSerializer,
    FacultySerializer,
    FacultyWriteSerializer,
)


class ContactsIsStaffOrReadOnly(BasePermission):
    """Anyone authenticated can read; only staff can write."""
    def has_permission(self, request, view):
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return request.user.is_authenticated
        return request.user.is_authenticated and request.user.is_staff


class FacultyViewSet(viewsets.ViewSet):
    permission_classes = [ContactsIsStaffOrReadOnly]

    def list(self, request):
        qs    = Faculty.objects.all()
        q     = request.query_params.get('q', '').strip()
        dept  = request.query_params.get('dept', '').strip()
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
        return Response(FacultySerializer(qs, many=True, context={'request': request}).data)

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
