from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import (
    User, HelpRequest, PasswordResetToken,
    Hostel, FoodOutlet, FoodItem, Order,
    LostFoundItem, MarketplaceListing, Doctor, CampusEvent,
    PICKUP_CHOICES, DELIVERY_CHOICES,
)


# ---------------------------------------------------------------------------
# Auth Serializers
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone', 'password']
        extra_kwargs = {'email': {'required': True}}

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            phone=validated_data.get('phone', ''),
            password=validated_data['password'],
        )


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone', 'points']
        read_only_fields = fields


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])


class ForgotPasswordSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)


class ResetPasswordSerializer(serializers.Serializer):
    token = serializers.UUIDField(required=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])


# ---------------------------------------------------------------------------
# Help Request Serializers
# ---------------------------------------------------------------------------

# Flatten choices for validation
_FLAT_DELIVERY_VALUES = [
    v for group in DELIVERY_CHOICES for v, _ in group[1]
]

class HelpRequestCreateSerializer(serializers.ModelSerializer):
    """Used for creating a help request. Requester is set from the JWT user."""

    class Meta:
        model = HelpRequest
        fields = [
            'item_description', 'pickup_location', 'delivery_location',
            'contact_number', 'additional_info', 'from_time', 'to_time',
        ]

    def validate_delivery_location(self, value):
        if value not in _FLAT_DELIVERY_VALUES:
            raise serializers.ValidationError(f"Invalid delivery location: {value}")
        return value

    def validate(self, attrs):
        from django.utils import timezone
        now = timezone.now()
        if attrs['from_time'] >= attrs['to_time']:
            raise serializers.ValidationError("from_time must be before to_time.")
        if attrs['to_time'] <= now:
            raise serializers.ValidationError("to_time must be in the future.")
        return attrs


class HelpRequestSerializer(serializers.ModelSerializer):
    """
    Full serializer used for list/detail views.
    contact_number is only exposed to the requester and the accepted helper.
    """
    requester_username = serializers.CharField(source='requester.username', read_only=True)
    helper_username    = serializers.CharField(source='helper.username', read_only=True, allow_null=True)
    contact_number     = serializers.SerializerMethodField()
    pickup_location_display   = serializers.CharField(
        source='get_pickup_location_display', read_only=True
    )
    is_expired         = serializers.BooleanField(read_only=True)

    class Meta:
        model = HelpRequest
        fields = [
            'id', 'requester_username', 'helper_username',
            'item_description', 'pickup_location', 'pickup_location_display',
            'delivery_location', 'contact_number', 'additional_info',
            'from_time', 'to_time', 'status', 'created_at', 'is_expired',
        ]

    def get_contact_number(self, obj):
        """Only the requester and the helper see the raw contact number."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if obj.requester_id == request.user.id or (
                obj.helper_id and obj.helper_id == request.user.id
            ):
                return obj.contact_number
        return None  # Hidden from everyone else


# ---------------------------------------------------------------------------
# Legacy Campus Serializers (unchanged)
# ---------------------------------------------------------------------------

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
