from rest_framework import serializers
from .models import (
    Hostel, FoodOutlet, FoodItem, Order, HelpRequest,
    LostFoundItem, MarketplaceListing, Doctor, CampusEvent
)


class FoodItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodItem
        fields = ['id', 'name', 'price', 'is_available']


class FoodOutletSerializer(serializers.ModelSerializer):
    items = FoodItemSerializer(many=True, read_only=True)

    class Meta:
        model = FoodOutlet
        fields = ['id', 'name', 'icon', 'outlet_type', 'hours', 'status', 'items']


class HostelSerializer(serializers.ModelSerializer):
    occupancy_percent = serializers.SerializerMethodField()

    class Meta:
        model = Hostel
        fields = ['id', 'name', 'capacity', 'occupancy', 'warden_contact', 'occupancy_percent']

    def get_occupancy_percent(self, obj):
        return round((obj.occupancy / obj.capacity) * 100) if obj.capacity else 0


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ['id', 'outlet', 'items', 'total', 'roll_number', 'status', 'created_at']
        read_only_fields = ['id', 'created_at', 'status']


class HelpRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = HelpRequest
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'status']


class LostFoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = LostFoundItem
        fields = '__all__'
        read_only_fields = ['id', 'date_reported']


class MarketplaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketplaceListing
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'is_sold']


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = '__all__'


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampusEvent
        fields = '__all__'
