"""
Legacy campus ViewSets — kept for backward compatibility with old frontend routes.
These are dummy/placeholder implementations; new modules (food/, lf/, mess/) are the
production paths. Do not add features here — migrate callers and remove.
"""
from rest_framework import status, viewsets
from rest_framework.response import Response

from ..models import (
    CampusEvent,
    Doctor,
    FoodOutlet,
    Hostel,
    LostFoundItem,
    MarketplaceListing,
    Order,
)
from ..serializers import (
    DoctorSerializer,
    EventSerializer,
    FoodOutletSerializer,
    HostelSerializer,
    LostFoundSerializer,
    MarketplaceSerializer,
    OrderSerializer,
)

DUMMY_HOSTELS = [
    {
        'id': i, 'name': f'Hostel {i}', 'capacity': 400, 'occupancy': 380,
        'warden_contact': '', 'occupancy_percent': 95,
    }
    for i in range(1, 7)
]

DUMMY_OUTLETS = [
    {
        'id': 1, 'name': 'Central Canteen', 'icon': '🍽️', 'outlet_type': 'canteen',
        'hours': '8 AM – 10 PM', 'status': 'open',
        'items': [{'id': 1, 'name': 'Veg Thali', 'price': '80.00', 'is_available': True}],
    },
    {
        'id': 2, 'name': 'Juice Center', 'icon': '🥤', 'outlet_type': 'cafe',
        'hours': '9 AM – 9 PM', 'status': 'open',
        'items': [{'id': 2, 'name': 'Mango Shake', 'price': '50.00', 'is_available': True}],
    },
    {
        'id': 3, 'name': 'Night Canteen', 'icon': '🌙', 'outlet_type': 'night',
        'hours': '8 PM – 2 AM', 'status': 'open',
        'items': [{'id': 3, 'name': 'Maggi', 'price': '40.00', 'is_available': True}],
    },
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
            status=status.HTTP_201_CREATED,
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
