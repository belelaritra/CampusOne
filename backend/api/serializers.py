import json
import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import (
    User, HelpRequest,
    Hostel, FoodOutlet, FoodItem, Order,
    LostFoundItem, MarketplaceListing, Doctor, CampusEvent,
    PICKUP_CHOICES, DELIVERY_CHOICES,
    # Food Ordering
    Outlet, MenuItem, OutletAdmin, FoodOrder, FoodOrderItem, Review,
    FOOD_DELIVERY_LOCATION_CHOICES, FOOD_ORDER_TYPE_CHOICES,
    # Lost & Found
    LFCategory, LFItem, LFClaim, LFNotification, LFLog,
    LF_CAMPUS_LOCATIONS, LF_VALID_LOCATION_KEYS,
    # Mess Module
    MessHostelSettings, MessAdminProfile, DailyMenu,
    GuestCouponPurchase, RebateRequest,
    MESS_HOSTEL_KEYS, MESS_MEAL_KEYS, MESS_HOSTEL_LABEL, MESS_MEAL_LABEL,
    # Contacts Module
    Faculty, Department, EmergencyContact,
)

DURATION_VALUES = [5, 10, 15, 30, 60, 90, 120]


# ---------------------------------------------------------------------------
# Auth Serializers
# ---------------------------------------------------------------------------

class UserProfileSerializer(serializers.ModelSerializer):
    is_outlet_admin  = serializers.SerializerMethodField()
    outlet_id        = serializers.SerializerMethodField()
    outlet_name      = serializers.SerializerMethodField()
    is_mess_admin    = serializers.SerializerMethodField()
    mess_admin_hostel= serializers.SerializerMethodField()
    photo_url        = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'phone', 'full_name',
            'phone_number', 'roll_number', 'hostel', 'room_number', 'points',
            'is_staff', 'is_outlet_admin', 'outlet_id', 'outlet_name',
            'is_security', 'is_mess_admin', 'mess_admin_hostel',
            'degree', 'course', 'year_of_study', 'photo_url',
        ]
        read_only_fields = fields

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.photo.url)
            return obj.photo.url
        return None

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

    def get_is_mess_admin(self, obj):
        if obj.is_staff:
            return True
        return MessAdminProfile.objects.filter(user=obj).exists()

    def get_mess_admin_hostel(self, obj):
        if obj.is_staff:
            return None  # staff can manage all
        try:
            return obj.mess_admin_profile.hostel
        except MessAdminProfile.DoesNotExist:
            return None


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'full_name', 'email', 'phone_number', 'roll_number',
            'hostel', 'room_number',
            'degree', 'course', 'year_of_study', 'photo',
        ]

    def validate_email(self, value):
        if not value:
            return value
        qs = User.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_year_of_study(self, value):
        if value is not None and not (1 <= value <= 6):
            raise serializers.ValidationError("Year must be between 1 and 6.")
        return value




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
    """Read serializer — exposes image_effective (upload > url)."""
    image_effective = serializers.SerializerMethodField()

    class Meta:
        model  = MenuItem
        fields = [
            'id', 'outlet', 'name',
            'image_upload', 'image_url', 'image_effective',
            'description', 'price', 'is_veg', 'is_available',
            'avg_rating', 'review_count',
        ]
        read_only_fields = ['avg_rating', 'review_count', 'image_effective']

    def get_image_effective(self, obj):
        request = self.context.get('request')
        if obj.image_upload:
            url = obj.image_upload.url
            return request.build_absolute_uri(url) if request else url
        return obj.image_url or ''


class MenuItemWriteSerializer(serializers.ModelSerializer):
    """Used by outlet admin to create / update menu items.
    Accepts multipart (with image_upload file) or JSON (image_url only)."""
    image_upload = serializers.ImageField(required=False, allow_null=True)
    image_url    = serializers.CharField(required=False, allow_blank=True, default='')

    class Meta:
        model  = MenuItem
        fields = ['id', 'name', 'image_upload', 'image_url', 'description', 'price', 'is_veg', 'is_available']

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError("Price must be positive.")
        return value


class FoodOrderItemSerializer(serializers.ModelSerializer):
    food_item_name   = serializers.CharField(source='food_item.name',    read_only=True)
    food_item_is_veg = serializers.BooleanField(source='food_item.is_veg', read_only=True)
    food_item_image  = serializers.SerializerMethodField()
    user_rating      = serializers.SerializerMethodField()

    class Meta:
        model  = FoodOrderItem
        fields = [
            'id', 'food_item', 'food_item_name',
            'food_item_image', 'food_item_is_veg', 'quantity', 'price', 'user_rating',
        ]

    def get_food_item_image(self, obj):
        request = self.context.get('request')
        if obj.food_item.image_upload:
            url = obj.food_item.image_upload.url
            return request.build_absolute_uri(url) if request else url
        return obj.food_item.image_url or ''

    def get_user_rating(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        # Build a per-request cache so we only hit the DB once for all items.
        cache_key = '_user_reviews_cache'
        if cache_key not in self.context:
            self.context[cache_key] = {
                (r['order_id'], r['food_item_id']): r['rating']
                for r in Review.objects.filter(user=request.user)
                                       .values('order_id', 'food_item_id', 'rating')
            }
        return self.context[cache_key].get((obj.order_id, obj.food_item_id))


class FoodOrderSerializer(serializers.ModelSerializer):
    order_items               = FoodOrderItemSerializer(many=True, read_only=True)
    outlet_name               = serializers.CharField(source='outlet.name',   read_only=True)
    user_username             = serializers.CharField(source='user.username', read_only=True)
    order_type_display        = serializers.CharField(source='get_order_type_display', read_only=True)
    delivery_location_display = serializers.SerializerMethodField()

    class Meta:
        model  = FoodOrder
        fields = [
            'id', 'user', 'user_username',
            'user_full_name', 'user_phone_number', 'user_email',
            'outlet', 'outlet_name',
            'status', 'order_type', 'order_type_display',
            'total_price', 'delivery_location', 'delivery_location_display',
            'payment_method', 'reviewed', 'created_at', 'updated_at', 'order_items',
        ]
        read_only_fields = [
            'id', 'user', 'status', 'reviewed', 'created_at', 'updated_at',
            'user_full_name', 'user_phone_number', 'user_email',
        ]

    def get_delivery_location_display(self, obj):
        if not obj.delivery_location:
            return 'Takeaway — No Delivery'
        return obj.get_delivery_location_display()


# --------------- validated input for placing an order ----------------------

_FLAT_FOOD_DELIVERY_VALUES = [v for v, _ in FOOD_DELIVERY_LOCATION_CHOICES]
_ORDER_TYPE_VALUES         = [v for v, _ in FOOD_ORDER_TYPE_CHOICES]


class OrderItemInputSerializer(serializers.Serializer):
    food_item_id = serializers.IntegerField(min_value=1)
    quantity     = serializers.IntegerField(min_value=1, max_value=5)


class PlaceOrderSerializer(serializers.Serializer):
    outlet_id         = serializers.IntegerField(min_value=1)
    order_type        = serializers.ChoiceField(choices=_ORDER_TYPE_VALUES, default='DELIVERY')
    delivery_location = serializers.ChoiceField(
        choices=_FLAT_FOOD_DELIVERY_VALUES, required=False, allow_blank=True, default=''
    )
    items             = OrderItemInputSerializer(many=True, min_length=1)

    def validate(self, data):
        if data.get('order_type', 'DELIVERY') == 'DELIVERY' and not data.get('delivery_location'):
            raise serializers.ValidationError(
                {'delivery_location': 'Delivery location is required for DELIVERY orders.'}
            )
        return data


# --------------- review submission ----------------------------------------

class RatingInputSerializer(serializers.Serializer):
    food_item_id = serializers.IntegerField(min_value=1)
    rating       = serializers.IntegerField(min_value=1, max_value=5)


class ReviewSubmitSerializer(serializers.Serializer):
    ratings = RatingInputSerializer(many=True, min_length=1)


# ---------------------------------------------------------------------------
# Lost & Found Serializers
# ---------------------------------------------------------------------------

class _TagsField(serializers.Field):
    """Accepts a list, a JSON string, or a comma-separated string. Always returns a list."""
    def to_representation(self, value):
        return value or []

    def to_internal_value(self, data):
        if isinstance(data, list):
            tags = data
        elif isinstance(data, str):
            try:
                parsed = json.loads(data)
                tags = parsed if isinstance(parsed, list) else data.split(',')
            except (json.JSONDecodeError, ValueError):
                tags = data.split(',')
        else:
            return []
        return list(dict.fromkeys(t.strip().lower() for t in tags if t.strip()))[:15]


class LFCategorySerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()

    class Meta:
        model  = LFCategory
        fields = ['id', 'name', 'icon', 'item_count']

    def get_item_count(self, obj):
        return getattr(obj, '_item_count', None)


class LFItemSerializer(serializers.ModelSerializer):
    """Full read serializer — includes distance (annotated by view), claim info and interaction details."""
    reporter_username  = serializers.CharField(source='reporter.username',    read_only=True)
    reporter_name      = serializers.CharField(source='reporter.full_name',   read_only=True)
    reporter_roll      = serializers.CharField(source='reporter.roll_number', read_only=True)
    reporter_phone     = serializers.SerializerMethodField()
    category_name      = serializers.CharField(source='category.name', read_only=True, allow_null=True)
    category_icon      = serializers.CharField(source='category.icon', read_only=True, allow_null=True)
    image_effective    = serializers.SerializerMethodField()
    claim_count        = serializers.SerializerMethodField()
    user_has_claimed   = serializers.SerializerMethodField()
    distance_meters    = serializers.SerializerMethodField()
    active_interaction   = serializers.SerializerMethodField()
    resolved_interaction = serializers.SerializerMethodField()
    is_reporter          = serializers.SerializerMethodField()
    is_interactor        = serializers.SerializerMethodField()
    can_resolve          = serializers.SerializerMethodField()
    can_revert           = serializers.SerializerMethodField()

    class Meta:
        model  = LFItem
        fields = [
            'id', 'item_type', 'status', 'title', 'description',
            'category', 'category_name', 'category_icon',
            'tags', 'image_effective',
            'location_name', 'latitude', 'longitude',
            'contact_type', 'roll_number',
            'reporter_username', 'reporter_name', 'reporter_roll', 'reporter_phone',
            'claim_count', 'user_has_claimed', 'distance_meters',
            'active_interaction', 'resolved_interaction',
            'is_reporter', 'is_interactor',
            'can_resolve', 'can_revert',
            'date_reported',
        ]

    def get_reporter_phone(self, obj):
        """Visible only to the reporter themselves or the active interactor on a PENDING item."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        u = request.user
        if obj.reporter_id == u.id:
            return obj.reporter.phone_number or obj.reporter.phone or None
        # Show to the current active interactor
        ai = getattr(obj, '_active_interaction', None)
        if ai is not None and getattr(ai, 'claimant_id', None) == u.id:
            return obj.reporter.phone_number or obj.reporter.phone or None
        return None

    def get_image_effective(self, obj):
        request = self.context.get('request')
        if obj.image:
            url = obj.image.url
            return request.build_absolute_uri(url) if request else url
        return obj.image_url or None

    def get_claim_count(self, obj):
        return getattr(obj, '_claim_count', obj.claims.count())

    def get_user_has_claimed(self, obj):
        """True if the current user is the active PENDING interactor on this item."""
        return getattr(obj, '_user_has_claimed', False)

    def get_distance_meters(self, obj):
        return getattr(obj, '_distance', None)

    def get_active_interaction(self, obj):
        """
        Returns interaction contact details for involved parties when item is PENDING.
        Reporter sees interactor's contact; interactor sees reporter's contact.
        Security sees both. Others see nothing.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        if obj.status != 'PENDING':
            return None

        interaction = getattr(obj, '_active_interaction', None)
        if interaction is None:
            return None

        u = request.user
        is_reporter   = obj.reporter_id == u.id
        is_interactor = getattr(interaction, 'claimant_id', None) == u.id
        is_security   = getattr(u, 'is_security', False) or u.is_staff

        if not (is_reporter or is_interactor or is_security):
            return None

        data = {
            'id':                 interaction.id,
            'interactor_name':    interaction.claimant.full_name or interaction.claimant.username,
            'interactor_username': interaction.claimant.username,
            'interactor_phone':   None,
            'reporter_name':      obj.reporter.full_name or obj.reporter.username,
            'reporter_phone':     None,
            'message':            interaction.message,
            'created_at':         interaction.created_at,
        }

        if is_reporter or is_security:
            data['interactor_phone'] = (
                interaction.claimant.phone_number or interaction.claimant.phone or None
            )
        if is_interactor or is_security:
            data['reporter_phone'] = (
                obj.reporter.phone_number or obj.reporter.phone or None
            )

        return data

    def get_resolved_interaction(self, obj):
        """For RESOLVED items: who resolved it and when (interactor name + resolved_at)."""
        if obj.status != 'RESOLVED':
            return None
        ri = getattr(obj, '_resolved_interaction', None)
        if ri is None:
            return None
        return {
            'interactor_name':     ri.claimant.full_name or ri.claimant.username,
            'interactor_username': ri.claimant.username,
            'resolved_at':         ri.created_at,
        }

    def get_is_reporter(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.reporter_id == request.user.id

    def get_is_interactor(self, obj):
        return getattr(obj, '_user_has_claimed', False)

    def get_can_resolve(self, obj):
        """
        True if the current user is permitted to call the resolve endpoint.
        Rules mirror views.py resolve():
          - contact_type=SECURITY → only security staff
          - otherwise            → reporter OR security
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        u = request.user
        is_security = getattr(u, 'is_security', False) or u.is_staff
        is_reporter = obj.reporter_id == u.id
        if obj.contact_type == 'SECURITY':
            return is_security
        return is_reporter or is_security

    def get_can_revert(self, obj):
        """True if the current user is permitted to call the revert endpoint."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        u = request.user
        is_security = getattr(u, 'is_security', False) or u.is_staff
        return obj.reporter_id == u.id or is_security


class LFItemCreateSerializer(serializers.ModelSerializer):
    tags           = _TagsField(required=False, default=list)
    image          = serializers.ImageField(required=False, allow_null=True)
    latitude       = serializers.FloatField(required=False, allow_null=True)
    longitude      = serializers.FloatField(required=False, allow_null=True)
    # FOUND-only: who holds the item; maps to contact_type on the model
    collect_from   = serializers.ChoiceField(
        choices=[('ME', 'Me'), ('SECURITY', 'Security Office')],
        required=False, default='ME',
    )
    # FOUND + ID-Card: roll number on the card; maps to roll_number on the model
    id_card_number = serializers.CharField(
        required=False, allow_blank=True, max_length=20, default='',
    )

    class Meta:
        model  = LFItem
        fields = [
            'item_type', 'title', 'description',
            'category', 'tags', 'image', 'image_url',
            'location_name', 'latitude', 'longitude',
            'collect_from', 'id_card_number',
        ]

    def validate_item_type(self, v):
        if v not in ['LOST', 'FOUND']:
            raise serializers.ValidationError("Must be LOST or FOUND.")
        return v

    def validate_location_name(self, v):
        """Must be empty (GPS path) or one of the predefined campus keys."""
        if v and v not in LF_VALID_LOCATION_KEYS:
            raise serializers.ValidationError(
                "Location must be selected from the predefined campus list."
            )
        return v

    def validate(self, data):
        item_type = data.get('item_type', '')
        category  = data.get('category')
        id_num    = (data.get('id_card_number') or '').strip()
        if (item_type == 'FOUND' and category and
                'id' in (category.name or '').lower() and not id_num):
            raise serializers.ValidationError(
                {'id_card_number': 'Roll number on the ID card is required.'}
            )
        return data

    def create(self, validated_data):
        collect_from   = validated_data.pop('collect_from', 'ME')
        id_card_number = validated_data.pop('id_card_number', '') or ''
        item_type      = validated_data.get('item_type', 'LOST')
        return LFItem.objects.create(
            contact_type=collect_from if item_type == 'FOUND' else 'ME',
            roll_number=id_card_number,
            **validated_data,
        )

    def update(self, instance, validated_data):
        collect_from   = validated_data.pop('collect_from', None)
        id_card_number = validated_data.pop('id_card_number', None)
        if collect_from is not None and instance.item_type == 'FOUND':
            instance.contact_type = collect_from
        if id_card_number is not None:
            instance.roll_number = id_card_number
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance


class LFClaimSerializer(serializers.ModelSerializer):
    claimant_username  = serializers.CharField(source='claimant.username',    read_only=True)
    claimant_name      = serializers.CharField(source='claimant.full_name',   read_only=True)
    claimant_phone     = serializers.SerializerMethodField()
    item_title         = serializers.CharField(source='item.title',           read_only=True)
    item_type          = serializers.CharField(source='item.item_type',       read_only=True)
    item_location      = serializers.CharField(source='item.location_name',   read_only=True)
    item_image         = serializers.SerializerMethodField()

    class Meta:
        model  = LFClaim
        fields = [
            'id', 'item', 'item_title', 'item_type', 'item_location', 'item_image',
            'claimant_username', 'claimant_name', 'claimant_phone',
            'message', 'status', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at']

    def get_claimant_phone(self, obj):
        # Visible to the item reporter or the claimant themselves
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            u = request.user
            is_security = getattr(u, 'is_security', False) or u.is_staff
            if obj.item.reporter_id == u.id or obj.claimant_id == u.id or is_security:
                return obj.claimant.phone_number or obj.claimant.phone or None
        return None

    def get_item_image(self, obj):
        request = self.context.get('request')
        if obj.item.image:
            url = obj.item.image.url
            return request.build_absolute_uri(url) if request else url
        return obj.item.image_url or None


class LFNotificationSerializer(serializers.ModelSerializer):
    item_title = serializers.CharField(source='item.title',     read_only=True, allow_null=True)
    item_type  = serializers.CharField(source='item.item_type', read_only=True, allow_null=True)

    class Meta:
        model  = LFNotification
        fields = ['id', 'message', 'item', 'item_title', 'item_type', 'is_read', 'created_at']
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Mess Module Serializers
# ---------------------------------------------------------------------------

class MessHostelSettingsSerializer(serializers.ModelSerializer):
    hostel_display = serializers.SerializerMethodField()

    class Meta:
        model  = MessHostelSettings
        fields = [
            'id', 'hostel', 'hostel_display',
            'monthly_sma',
            'breakfast_deduction', 'lunch_deduction',
            'snacks_deduction',    'dinner_deduction',
            'guest_breakfast_price', 'guest_lunch_price',
            'guest_snacks_price',    'guest_dinner_price',
            'guest_slot_daily_limit', 'guest_student_slot_limit',
            'updated_at',
        ]
        read_only_fields = ['id', 'hostel_display', 'updated_at']

    def get_hostel_display(self, obj):
        return MESS_HOSTEL_LABEL.get(obj.hostel, obj.hostel)

    def validate_hostel(self, value):
        if value not in MESS_HOSTEL_KEYS:
            raise serializers.ValidationError(f"Invalid hostel key: {value}")
        return value


class DailyMenuSerializer(serializers.ModelSerializer):
    hostel_display       = serializers.SerializerMethodField()
    meal_type_display    = serializers.SerializerMethodField()
    created_by_username  = serializers.SerializerMethodField()

    class Meta:
        model  = DailyMenu
        fields = [
            'id', 'hostel', 'hostel_display', 'date',
            'meal_type', 'meal_type_display', 'items', 'updated_at',
            'created_by_username',
        ]
        read_only_fields = ['id', 'hostel_display', 'meal_type_display', 'updated_at', 'created_by_username']

    def get_created_by_username(self, obj):
        return obj.updated_by.username if obj.updated_by else None

    def get_hostel_display(self, obj):
        return MESS_HOSTEL_LABEL.get(obj.hostel, obj.hostel)

    def get_meal_type_display(self, obj):
        return MESS_MEAL_LABEL.get(obj.meal_type, obj.meal_type)

    def validate_hostel(self, value):
        if value not in MESS_HOSTEL_KEYS:
            raise serializers.ValidationError(f"Invalid hostel key: {value}")
        return value

    def validate_meal_type(self, value):
        if value not in MESS_MEAL_KEYS:
            raise serializers.ValidationError(f"Invalid meal type: {value}")
        return value


class GuestCouponReadSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_name     = serializers.CharField(source='student.full_name', read_only=True)
    hostel_display   = serializers.SerializerMethodField()
    meal_display     = serializers.SerializerMethodField()

    class Meta:
        model  = GuestCouponPurchase
        fields = [
            'id', 'student_username', 'student_name',
            'hostel', 'hostel_display', 'date',
            'meal_type', 'meal_display', 'quantity',
            'unit_price', 'total_amount',
            'roll_number', 'room_number', 'hostel_number',
            'purchased_at',
        ]
        read_only_fields = fields

    def get_hostel_display(self, obj):
        return MESS_HOSTEL_LABEL.get(obj.hostel, obj.hostel)

    def get_meal_display(self, obj):
        return MESS_MEAL_LABEL.get(obj.meal_type, obj.meal_type)


class GuestCouponCreateSerializer(serializers.Serializer):
    hostel    = serializers.CharField()
    date      = serializers.DateField()
    meal_type = serializers.CharField()
    quantity  = serializers.IntegerField(min_value=1)

    def validate_hostel(self, value):
        if value not in MESS_HOSTEL_KEYS:
            raise serializers.ValidationError(f"Invalid hostel: {value}")
        return value

    def validate_meal_type(self, value):
        if value not in MESS_MEAL_KEYS:
            raise serializers.ValidationError(f"Invalid meal type: {value}")
        return value

    def validate(self, data):
        from django.db.models import Sum as _Sum
        request  = self.context['request']
        student  = request.user
        hostel   = data['hostel']
        date     = data['date']
        meal     = data['meal_type']
        qty      = data['quantity']

        # Load (or auto-create with defaults) settings for the target hostel
        settings_obj, _ = MessHostelSettings.objects.get_or_create(hostel=hostel)

        # Per-student cumulative check for this hostel/date/slot
        student_total = (
            GuestCouponPurchase.objects
            .filter(student=student, hostel=hostel, date=date, meal_type=meal)
            .aggregate(t=_Sum('quantity'))['t'] or 0
        )
        if student_total + qty > settings_obj.guest_student_slot_limit:
            raise serializers.ValidationError(
                f"You can buy at most {settings_obj.guest_student_slot_limit} coupons per slot. "
                f"You already have {student_total}."
            )

        # Total across all students for this hostel/date/slot
        slot_total = (
            GuestCouponPurchase.objects
            .filter(hostel=hostel, date=date, meal_type=meal)
            .aggregate(t=_Sum('quantity'))['t'] or 0
        )
        if slot_total + qty > settings_obj.guest_slot_daily_limit:
            available = settings_obj.guest_slot_daily_limit - slot_total
            raise serializers.ValidationError(
                f"Only {available} coupon(s) remaining for this slot today."
            )

        data['_settings'] = settings_obj
        data['_student_total'] = student_total
        return data


class RebateRequestSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source='student.username', read_only=True)
    student_name     = serializers.CharField(source='student.full_name', read_only=True)
    student_roll     = serializers.CharField(source='student.roll_number', read_only=True)
    hostel_display   = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = RebateRequest
        fields = [
            'id', 'student_username', 'student_name', 'student_roll',
            'hostel', 'hostel_display',
            'start_date', 'end_date', 'days', 'reason',
            'status', 'admin_note',
            'reviewed_by_name', 'created_at', 'reviewed_at',
        ]
        read_only_fields = [
            'id', 'student_username', 'student_name', 'student_roll',
            'hostel', 'hostel_display', 'days', 'status', 'admin_note',
            'reviewed_by_name', 'created_at', 'reviewed_at',
        ]

    def get_hostel_display(self, obj):
        return MESS_HOSTEL_LABEL.get(obj.hostel, obj.hostel)

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.full_name or obj.reviewed_by.username
        return None

    def validate(self, data):
        start = data.get('start_date')
        end   = data.get('end_date')
        if start and end:
            if end < start:
                raise serializers.ValidationError("end_date must be on or after start_date.")
            days = (end - start).days + 1
            if days < 1:
                raise serializers.ValidationError("Rebate must be at least 1 day.")
            if days > 15:
                raise serializers.ValidationError("Rebate cannot exceed 15 days.")
            data['days'] = days
        return data

    def create(self, validated_data):
        request = self.context['request']
        user    = request.user
        # Normalize to mess-key format ('hostel_14') regardless of how User.hostel
        # was saved ('H14' from profile editor vs 'hostel_14' from mess key).
        raw_hostel = user.hostel or ''
        if raw_hostel in ('Tansa', 'tansa_house'):
            hostel = 'tansa_house'
        else:
            m = re.match(r'^H(\d+)$', raw_hostel, re.IGNORECASE)
            hostel = f'hostel_{m.group(1)}' if m else raw_hostel
        validated_data['student'] = user
        validated_data['hostel']  = hostel
        return super().create(validated_data)


class RebateReviewSerializer(serializers.Serializer):
    status     = serializers.ChoiceField(choices=['APPROVED', 'REJECTED'])
    admin_note = serializers.CharField(required=False, allow_blank=True, default='')


# ---------------------------------------------------------------------------
# Admin Console Serializers (staff-only)
# ---------------------------------------------------------------------------

class AdminUserListSerializer(serializers.ModelSerializer):
    is_mess_admin     = serializers.SerializerMethodField()
    mess_admin_hostel = serializers.SerializerMethodField()
    is_outlet_admin   = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = [
            'id', 'username', 'email', 'full_name', 'phone_number',
            'roll_number', 'hostel', 'room_number', 'points',
            'is_staff', 'is_security', 'is_active',
            'is_mess_admin', 'mess_admin_hostel', 'is_outlet_admin',
            'date_joined',
        ]
        read_only_fields = fields

    def get_is_mess_admin(self, obj):
        return obj.is_staff or MessAdminProfile.objects.filter(user=obj).exists()

    def get_mess_admin_hostel(self, obj):
        if obj.is_staff:
            return None
        try:
            return obj.mess_admin_profile.hostel
        except MessAdminProfile.DoesNotExist:
            return None

    def get_is_outlet_admin(self, obj):
        return OutletAdmin.objects.filter(user=obj).exists()


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    mess_admin_hostel = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, write_only=True
    )

    class Meta:
        model  = User
        fields = [
            'full_name', 'email', 'phone_number', 'roll_number',
            'hostel', 'room_number', 'is_staff', 'is_security', 'is_active',
            'mess_admin_hostel',
        ]

    def validate_email(self, value):
        if not value:
            return value
        qs = User.objects.filter(email=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Email already in use.")
        return value

    def update(self, instance, validated_data):
        mess_hostel = validated_data.pop('mess_admin_hostel', '__unset__')
        instance = super().update(instance, validated_data)
        # Update MessAdminProfile if supplied
        if mess_hostel != '__unset__':
            if mess_hostel and mess_hostel in MESS_HOSTEL_KEYS:
                MessAdminProfile.objects.update_or_create(
                    user=instance,
                    defaults={'hostel': mess_hostel},
                )
            elif mess_hostel == '' or mess_hostel is None:
                MessAdminProfile.objects.filter(user=instance).delete()
        return instance


# ---------------------------------------------------------------------------
# Contacts Module Serializers
# ---------------------------------------------------------------------------

class FacultySerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model  = Faculty
        fields = [
            'id', 'name', 'photo_url', 'department', 'specialization',
            'email', 'cabin_no', 'is_available', 'updated_at',
        ]

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url
        return None


class FacultyWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Faculty
        fields = [
            'name', 'photo', 'department', 'specialization',
            'email', 'cabin_no', 'is_available',
        ]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Department
        fields = ['id', 'name', 'official_contact', 'official_email', 'location', 'maps_url']


class EmergencyContactSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmergencyContact
        fields = ['id', 'service_name', 'contact', 'order']
