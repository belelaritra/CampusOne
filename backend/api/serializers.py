from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import (
    User, HelpRequest, PasswordResetToken,
    Hostel, FoodOutlet, FoodItem, Order,
    LostFoundItem, MarketplaceListing, Doctor, CampusEvent,
    PICKUP_CHOICES, DELIVERY_CHOICES,
    # Food Ordering
    Outlet, MenuItem, OutletAdmin, FoodOrder, FoodOrderItem, Review,
    FOOD_DELIVERY_LOCATION_CHOICES,
)

DURATION_VALUES = [5, 10, 15, 30, 60, 90, 120]


# ---------------------------------------------------------------------------
# Auth Serializers
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone', 'full_name', 'phone_number', 'roll_number', 'password']
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
            full_name=validated_data.get('full_name', ''),
            phone_number=validated_data.get('phone_number', ''),
            roll_number=validated_data.get('roll_number', ''),
            password=validated_data['password'],
        )


class UserProfileSerializer(serializers.ModelSerializer):
    is_outlet_admin = serializers.SerializerMethodField()
    outlet_id       = serializers.SerializerMethodField()
    outlet_name     = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone', 'full_name',
            'phone_number', 'roll_number', 'points',
            'is_outlet_admin', 'outlet_id', 'outlet_name',
        ]
        read_only_fields = fields

    def get_is_outlet_admin(self, obj):
        return OutletAdmin.objects.filter(user=obj).exists()

    def get_outlet_id(self, obj):
        try:
            return obj.outlet_admin_profile.outlet_id
        except OutletAdmin.DoesNotExist:
            return None

    def get_outlet_name(self, obj):
        try:
            return obj.outlet_admin_profile.outlet.name
        except OutletAdmin.DoesNotExist:
            return None


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'phone_number', 'roll_number']


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
    """
    Creates a help request.
    - from_time: accepts "HH:MM" only; view combines with today's local date.
    - duration (minutes) replaces to_time; view computes to_time = from_time + duration.
    - contact_number is auto-populated by the view from requester's profile.
    """
    from_time = serializers.TimeField(input_formats=['%H:%M'])
    duration  = serializers.ChoiceField(choices=DURATION_VALUES)

    class Meta:
        model = HelpRequest
        fields = [
            'item_description', 'pickup_location', 'delivery_location',
            'additional_info', 'from_time', 'duration',
        ]

    def validate_delivery_location(self, value):
        if value not in _FLAT_DELIVERY_VALUES:
            raise serializers.ValidationError(f"Invalid delivery location: {value}")
        return value


class HelpRequestEditSerializer(serializers.ModelSerializer):
    """PATCH serializer — requester can edit any subset of these fields on a PENDING request."""
    from_time = serializers.TimeField(input_formats=['%H:%M'], required=False)
    duration  = serializers.ChoiceField(choices=DURATION_VALUES, required=False)

    class Meta:
        model = HelpRequest
        fields = [
            'item_description', 'pickup_location', 'delivery_location',
            'additional_info', 'from_time', 'duration',
        ]

    def validate_delivery_location(self, value):
        if value not in _FLAT_DELIVERY_VALUES:
            raise serializers.ValidationError(f"Invalid delivery location: {value}")
        return value


class HelpRequestSerializer(serializers.ModelSerializer):
    """
    Full read serializer.
    - contact_number visible only to requester / helper.
    - distance_in_meters / is_within_range annotated by the list view.
    """
    requester_username      = serializers.CharField(source='requester.username', read_only=True)
    requester_name          = serializers.CharField(source='requester.full_name', read_only=True)
    requester_roll          = serializers.CharField(source='requester.roll_number', read_only=True)
    helper_username         = serializers.CharField(source='helper.username', read_only=True, allow_null=True)
    contact_number          = serializers.SerializerMethodField()
    pickup_location_display = serializers.CharField(source='get_pickup_location_display', read_only=True)
    is_expired              = serializers.BooleanField(read_only=True)
    duration                = serializers.IntegerField(read_only=True)
    distance_in_meters      = serializers.SerializerMethodField()
    is_within_range         = serializers.SerializerMethodField()

    class Meta:
        model = HelpRequest
        fields = [
            'id', 'requester_username', 'requester_name', 'requester_roll',
            'helper_username',
            'item_description', 'pickup_location', 'pickup_location_display',
            'delivery_location', 'contact_number', 'additional_info',
            'from_time', 'to_time', 'duration', 'status', 'created_at', 'is_expired',
            'distance_in_meters', 'is_within_range',
        ]

    def get_contact_number(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if obj.requester_id == request.user.id or (
                obj.helper_id and obj.helper_id == request.user.id
            ):
                return obj.contact_number
        return None

    def get_distance_in_meters(self, obj):
        return getattr(obj, '_distance_meters', None)

    def get_is_within_range(self, obj):
        return getattr(obj, '_is_within_range', None)


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


# ---------------------------------------------------------------------------
# Food Ordering Serializers
# ---------------------------------------------------------------------------

class OutletSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Outlet
        fields = ['id', 'name', 'image', 'description', 'is_active']


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MenuItem
        fields = [
            'id', 'outlet', 'name', 'image', 'description',
            'price', 'is_veg', 'is_available', 'avg_rating', 'review_count',
        ]
        read_only_fields = ['avg_rating', 'review_count']


class MenuItemWriteSerializer(serializers.ModelSerializer):
    """Used by outlet admin to create / update menu items."""
    class Meta:
        model  = MenuItem
        fields = ['id', 'name', 'image', 'description', 'price', 'is_veg', 'is_available']

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be positive.")
        return value


class FoodOrderItemSerializer(serializers.ModelSerializer):
    food_item_name  = serializers.CharField(source='food_item.name',   read_only=True)
    food_item_image = serializers.CharField(source='food_item.image',  read_only=True)
    food_item_is_veg= serializers.BooleanField(source='food_item.is_veg', read_only=True)

    class Meta:
        model  = FoodOrderItem
        fields = ['id', 'food_item', 'food_item_name', 'food_item_image', 'food_item_is_veg', 'quantity', 'price']


class FoodOrderSerializer(serializers.ModelSerializer):
    order_items               = FoodOrderItemSerializer(many=True, read_only=True)
    outlet_name               = serializers.CharField(source='outlet.name',     read_only=True)
    user_username             = serializers.CharField(source='user.username',   read_only=True)
    delivery_location_display = serializers.CharField(
        source='get_delivery_location_display', read_only=True
    )

    class Meta:
        model  = FoodOrder
        fields = [
            'id', 'user', 'user_username', 'outlet', 'outlet_name',
            'status', 'total_price', 'delivery_location', 'delivery_location_display',
            'payment_method', 'reviewed', 'created_at', 'updated_at', 'order_items',
        ]
        read_only_fields = ['id', 'user', 'status', 'reviewed', 'created_at', 'updated_at']


# --------------- validated input for placing an order ----------------------

_FLAT_FOOD_DELIVERY_VALUES = [v for v, _ in FOOD_DELIVERY_LOCATION_CHOICES]


class OrderItemInputSerializer(serializers.Serializer):
    food_item_id = serializers.IntegerField(min_value=1)
    quantity     = serializers.IntegerField(min_value=1, max_value=5)


class PlaceOrderSerializer(serializers.Serializer):
    outlet_id         = serializers.IntegerField(min_value=1)
    delivery_location = serializers.ChoiceField(choices=_FLAT_FOOD_DELIVERY_VALUES)
    items             = OrderItemInputSerializer(many=True, min_length=1)


# --------------- review submission ----------------------------------------

class RatingInputSerializer(serializers.Serializer):
    food_item_id = serializers.IntegerField(min_value=1)
    rating       = serializers.IntegerField(min_value=1, max_value=5)


class ReviewSubmitSerializer(serializers.Serializer):
    ratings = RatingInputSerializer(many=True, min_length=1)
