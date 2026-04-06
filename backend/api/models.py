from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# ---------------------------------------------------------------------------
# Custom User
# ---------------------------------------------------------------------------

DEGREE_CHOICES = [
    ('BTech', 'B.Tech'),
    ('MTech', 'M.Tech'),
    ('MS',    'M.S. (Research)'),
    ('MSc',   'M.Sc'),
    ('PhD',   'Ph.D'),
    ('Other', 'Other'),
]

class User(AbstractUser):
    """Extends AbstractUser with phone number and help-points tracking."""
    phone = models.CharField(max_length=15, blank=True)          # legacy
    full_name    = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=15,  blank=True)
    roll_number  = models.CharField(max_length=20,  blank=True)
    hostel       = models.CharField(max_length=30,  blank=True)  # e.g. 'hostel_1'
    room_number  = models.CharField(max_length=20,  blank=True)
    points       = models.PositiveIntegerField(default=0)
    is_security  = models.BooleanField(default=False)
    # Academic profile
    degree        = models.CharField(max_length=10, choices=DEGREE_CHOICES, blank=True)
    course        = models.CharField(max_length=100, blank=True)   # e.g. 'Computer Science'
    year_of_study = models.PositiveSmallIntegerField(null=True, blank=True)  # 1–6
    photo         = models.ImageField(upload_to='profile_photos/', null=True, blank=True)

    def __str__(self):
        return self.username


# ---------------------------------------------------------------------------
# Help & Delivery — fixed pickup location choices
# ---------------------------------------------------------------------------

PICKUP_CHOICES = [
    ('gulmohar',    'Gulmohar'),
    ('main_gate',   'Main Gate'),
    ('shree_balaji','Shree Balaji Fruit & Vegetable'),
]

DURATION_CHOICES = [
    (5,   '5 minutes'),
    (10,  '10 minutes'),
    (15,  '15 minutes'),
    (30,  '30 minutes'),
    (60,  '1 hour'),
    (90,  '1.5 hours'),
    (120, '2 hours'),
]

# All hostel + campus delivery destinations
DELIVERY_CHOICES = (
    ('Hostels', [
        ('hostel_1',  'Hostel 1'),  ('hostel_2',  'Hostel 2'),
        ('hostel_3',  'Hostel 3'),  ('hostel_4',  'Hostel 4'),
        ('hostel_5',  'Hostel 5'),  ('hostel_6',  'Hostel 6'),
        ('hostel_7',  'Hostel 7'),  ('hostel_8',  'Hostel 8'),
        ('hostel_9',  'Hostel 9'),  ('hostel_10', 'Hostel 10'),
        ('hostel_11', 'Hostel 11'), ('hostel_12', 'Hostel 12'),
        ('hostel_13', 'Hostel 13'), ('hostel_14', 'Hostel 14'),
        ('hostel_15', 'Hostel 15'), ('hostel_16', 'Hostel 16'),
        ('hostel_17', 'Hostel 17'), ('hostel_18', 'Hostel 18'),
        ('hostel_19', 'Hostel 19'), ('hostel_21', 'Hostel 21'),
        ('tansa_house', 'Tansa House'),
    ]),
    ('Academic & Common', [
        ('kresit',       'KReSIT'),
        ('sjmsom',       'SJMSOM'),
        ('lecture_hall', 'Lecture Hall Complex'),
        ('conv_hall',    'Convocation Hall'),
        ('main_building','Main Building'),
        ('central_lib',  'Central Library'),
        ('sac',          'Students Activity Centre'),
        ('gymkhana',     'Students Gymkhana'),
    ]),
)

class HelpRequest(models.Model):
    STATUS_PENDING   = 'PENDING'
    STATUS_ACCEPTED  = 'ACCEPTED'
    STATUS_COMPLETED = 'COMPLETED'
    STATUS_EXPIRED   = 'EXPIRED'
    STATUS_CHOICES = [
        (STATUS_PENDING,   'Pending'),
        (STATUS_ACCEPTED,  'Accepted'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_EXPIRED,   'Expired'),
    ]

    requester        = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='created_requests'
    )
    helper           = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='accepted_requests'
    )
    item_description = models.CharField(max_length=300)
    pickup_location  = models.CharField(max_length=30, choices=PICKUP_CHOICES)
    delivery_location= models.CharField(max_length=30)   # from DELIVERY_CHOICES above
    contact_number   = models.CharField(max_length=15, blank=True)   # auto-populated from requester profile
    additional_info  = models.TextField(blank=True, default='')
    from_time        = models.DateTimeField()
    duration         = models.PositiveIntegerField(choices=DURATION_CHOICES, default=30)
    to_time          = models.DateTimeField()                          # = from_time + duration
    status           = models.CharField(
        max_length=15, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True
    )
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.status}] {self.item_description} by {self.requester}"

    def is_expired(self):
        return timezone.now() > self.to_time

    def check_and_expire(self):
        """Mark as EXPIRED if past to_time and still PENDING. Returns True if expired."""
        if self.status == self.STATUS_PENDING and self.is_expired():
            self.status = self.STATUS_EXPIRED
            self.save(update_fields=['status'])
            return True
        return False


# ---------------------------------------------------------------------------
# Password Reset Token (simple token model, no email required in dev)
# ---------------------------------------------------------------------------

import uuid

class PasswordResetToken(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE)
    token      = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    used       = models.BooleanField(default=False)

    def is_valid(self):
        """Tokens expire after 15 minutes."""
        return not self.used and (
            timezone.now() - self.created_at
        ).total_seconds() < 900

    def __str__(self):
        return f"ResetToken({self.user}, used={self.used})"


# ---------------------------------------------------------------------------
# Existing Campus Models (unchanged)
# ---------------------------------------------------------------------------

class Hostel(models.Model):
    name = models.CharField(max_length=100)
    capacity = models.IntegerField()
    occupancy = models.IntegerField()
    warden_contact = models.CharField(max_length=20, blank=True)

    def __str__(self):
        return self.name


class FoodOutlet(models.Model):
    STATUS_CHOICES = [('open', 'Open'), ('closed', 'Closed')]
    TYPE_CHOICES = [('canteen', 'Canteen'), ('cafe', 'Cafe'), ('night', 'Night Canteen')]

    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=10, default='🍽️')
    outlet_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    hours = models.CharField(max_length=50)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='open')

    def __str__(self):
        return self.name


class FoodItem(models.Model):
    outlet = models.ForeignKey(FoodOutlet, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=8, decimal_places=2)
    is_available = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.outlet.name})"


class Order(models.Model):
    STATUS_CHOICES = [('placed', 'Placed'), ('preparing', 'Preparing'), ('delivered', 'Delivered')]

    outlet = models.ForeignKey(FoodOutlet, on_delete=models.SET_NULL, null=True)
    items = models.JSONField()
    total = models.DecimalField(max_digits=10, decimal_places=2)
    roll_number = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='placed')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.id} by {self.roll_number}"


# ---------------------------------------------------------------------------
# Food Ordering Module
# ---------------------------------------------------------------------------

FOOD_DELIVERY_LOCATION_CHOICES = [
    ('hostel_1',  'Hostel 1'),  ('hostel_2',  'Hostel 2'),  ('hostel_3',  'Hostel 3'),
    ('hostel_4',  'Hostel 4'),  ('hostel_5',  'Hostel 5'),  ('hostel_6',  'Hostel 6'),
    ('hostel_7',  'Hostel 7'),  ('hostel_8',  'Hostel 8'),  ('hostel_9',  'Hostel 9'),
    ('hostel_10', 'Hostel 10'), ('hostel_11', 'Hostel 11'), ('hostel_12', 'Hostel 12'),
    ('hostel_13', 'Hostel 13'), ('hostel_14', 'Hostel 14'), ('hostel_15', 'Hostel 15'),
    ('hostel_16', 'Hostel 16'), ('hostel_17', 'Hostel 17'), ('hostel_18', 'Hostel 18'),
    ('hostel_19', 'Hostel 19'), ('hostel_21', 'Hostel 21'),
    ('tansa_house', 'Tansa House'),
    ('kresit',        'KReSIT'),             ('sjmsom',       'SJMSOM'),
    ('lecture_hall',  'Lecture Hall Complex'),('conv_hall',    'Convocation Hall'),
    ('main_building', 'Main Building'),      ('central_lib',  'Central Library'),
    ('sac',           'Students Activity Centre'), ('gymkhana', 'Students Gymkhana'),
]

FOOD_ORDER_STATUS_CHOICES = [
    ('PENDING',          'Pending'),
    ('ACCEPTED',         'Accepted'),
    ('PREPARING',        'Preparing'),
    ('OUT_FOR_DELIVERY', 'Out for Delivery'),   # delivery only
    ('READY',            'Ready for Pickup'),    # takeaway only
    ('DELIVERED',        'Delivered'),            # delivery only
    ('TOOK',             'Picked Up'),            # takeaway only
    ('CANCELLED',        'Cancelled'),
]

FOOD_ORDER_TYPE_CHOICES = [
    ('DELIVERY', 'Delivery'),
    ('TAKEAWAY', 'Takeaway'),
]

# Statuses that count as "completed / in-progress sales" for analytics
FOOD_ACTIVE_STATUSES = ['ACCEPTED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY', 'DELIVERED', 'TOOK']


class Outlet(models.Model):
    """Campus food outlet (Aromas Dhaba, H2 Canteen, …)."""
    name        = models.CharField(max_length=100, unique=True)
    image       = models.CharField(max_length=500, blank=True, default='')
    description = models.TextField(blank=True, default='')
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class MenuItem(models.Model):
    """Food item belonging to an Outlet."""
    outlet       = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='menu_items')
    name         = models.CharField(max_length=100)
    # Image: local upload takes priority; URL is a fallback (and the legacy 'image' field)
    image_upload = models.ImageField(upload_to='menu_items/', blank=True, null=True)
    image_url    = models.CharField(max_length=500, blank=True, default='')
    description  = models.TextField(blank=True, default='')
    price        = models.DecimalField(max_digits=8, decimal_places=2)
    is_veg       = models.BooleanField(default=True)
    is_available = models.BooleanField(default=True)
    avg_rating   = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    review_count = models.PositiveIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.outlet.name})"

    @property
    def image_effective(self):
        """Returns the best available image path/URL (upload > url > '')."""
        if self.image_upload:
            return self.image_upload.url
        return self.image_url or ''

    def update_rating(self):
        """Atomically recalculate avg_rating from all reviews. Call inside a transaction."""
        from django.db.models import Avg
        result = self.reviews.aggregate(avg=Avg('rating'))
        self.avg_rating   = round(result['avg'] or 0, 2)
        self.review_count = self.reviews.count()
        self.save(update_fields=['avg_rating', 'review_count'])


class OutletAdmin(models.Model):
    """Links a User account to exactly one Outlet as its administrator."""
    user   = models.OneToOneField(User, on_delete=models.CASCADE, related_name='outlet_admin_profile')
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='outlet_admins')

    def __str__(self):
        return f"{self.user.username} → {self.outlet.name}"


class FoodOrder(models.Model):
    user              = models.ForeignKey(User, on_delete=models.CASCADE, related_name='food_orders')
    outlet            = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='food_orders')
    status            = models.CharField(
        max_length=20, choices=FOOD_ORDER_STATUS_CHOICES, default='PENDING', db_index=True
    )
    order_type        = models.CharField(
        max_length=10, choices=FOOD_ORDER_TYPE_CHOICES, default='DELIVERY', db_index=True
    )
    total_price       = models.DecimalField(max_digits=10, decimal_places=2)
    # delivery_location is empty for TAKEAWAY orders
    delivery_location = models.CharField(
        max_length=50, choices=FOOD_DELIVERY_LOCATION_CHOICES, blank=True, default=''
    )
    payment_method    = models.CharField(max_length=20, default='COD')
    reviewed          = models.BooleanField(default=False)
    # User snapshot — immutable after creation
    user_full_name    = models.CharField(max_length=150, blank=True, default='')
    user_phone_number = models.CharField(max_length=15,  blank=True, default='')
    user_email        = models.EmailField(blank=True, default='')
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Order #{self.id} by {self.user.username} from {self.outlet.name} [{self.status}]"


class FoodOrderItem(models.Model):
    order     = models.ForeignKey(FoodOrder, on_delete=models.CASCADE, related_name='order_items')
    food_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT, related_name='order_items')
    quantity  = models.PositiveSmallIntegerField()
    price     = models.DecimalField(max_digits=8, decimal_places=2)   # snapshot at order time

    def __str__(self):
        return f"{self.quantity}× {self.food_item.name}"


class Review(models.Model):
    user      = models.ForeignKey(User, on_delete=models.CASCADE, related_name='food_reviews')
    food_item = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='reviews')
    order     = models.ForeignKey(FoodOrder, on_delete=models.CASCADE, related_name='item_reviews')
    rating    = models.PositiveSmallIntegerField()   # 1–5
    created_at= models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('user', 'order', 'food_item')]

    def __str__(self):
        return f"{self.user.username} rated {self.food_item.name} {self.rating}★"


# ---------------------------------------------------------------------------
# Lost & Found Module
# ---------------------------------------------------------------------------

LF_CAMPUS_LOCATIONS = [
    ('main_gate',     'Main Gate'),
    ('gulmohar',      'Gulmohar'),
    ('shree_balaji',  'Shree Balaji Fruit & Vegetable'),
    ('central_lib',   'Central Library'),
    ('lecture_hall',  'Lecture Hall Complex'),
    ('kresit',        'KReSIT'),
    ('sac',           'Students Activity Centre'),
    ('gymkhana',      'Students Gymkhana'),
    ('main_building', 'Main Building'),
    ('conv_hall',     'Convocation Hall'),
    ('sjmsom',        'SJMSOM'),
    ('hostel_1',  'Hostel 1'),  ('hostel_2',  'Hostel 2'),
    ('hostel_3',  'Hostel 3'),  ('hostel_4',  'Hostel 4'),
    ('hostel_5',  'Hostel 5'),  ('hostel_6',  'Hostel 6'),
    ('hostel_7',  'Hostel 7'),  ('hostel_8',  'Hostel 8'),
    ('hostel_9',  'Hostel 9'),  ('hostel_10', 'Hostel 10'),
    ('hostel_11', 'Hostel 11'), ('hostel_12', 'Hostel 12'),
    ('hostel_13', 'Hostel 13'), ('hostel_14', 'Hostel 14'),
    ('hostel_15', 'Hostel 15'), ('hostel_16', 'Hostel 16'),
    ('hostel_17', 'Hostel 17'), ('hostel_18', 'Hostel 18'),
    ('hostel_19', 'Hostel 19'), ('hostel_21', 'Hostel 21'),
    ('tansa_house', 'Tansa House'),
]

# Fast lookup set used by the serializer for location validation
LF_VALID_LOCATION_KEYS = {k for k, _ in LF_CAMPUS_LOCATIONS}

LF_CONTACT_CHOICES = [
    ('ME',       'Direct (my contact)'),
    ('SECURITY', 'Security Office'),
]


class LFCategory(models.Model):
    name = models.CharField(max_length=50, unique=True)
    icon = models.CharField(max_length=10, default='📦')

    class Meta:
        verbose_name        = 'LF Category'
        verbose_name_plural = 'LF Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class LFItem(models.Model):
    TYPE_LOST   = 'LOST'
    TYPE_FOUND  = 'FOUND'
    TYPE_CHOICES = [('LOST', 'Lost'), ('FOUND', 'Found')]

    STATUS_AVAILABLE = 'AVAILABLE'
    STATUS_PENDING   = 'PENDING'
    STATUS_RESOLVED  = 'RESOLVED'
    STATUS_CHOICES   = [
        ('AVAILABLE', 'Available'),
        ('PENDING',   'Pending'),
        ('RESOLVED',  'Resolved'),
    ]

    reporter      = models.ForeignKey(User, on_delete=models.CASCADE,  related_name='lf_items')
    item_type     = models.CharField(max_length=10, choices=TYPE_CHOICES, db_index=True)
    status        = models.CharField(max_length=15, choices=STATUS_CHOICES, default='AVAILABLE', db_index=True)
    title         = models.CharField(max_length=200)
    description   = models.TextField(blank=True, default='')
    category      = models.ForeignKey(
        LFCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='items'
    )
    tags          = models.JSONField(default=list)           # list of lowercase strings
    image         = models.ImageField(upload_to='lf_items/', blank=True, null=True)
    image_url     = models.CharField(max_length=500, blank=True, default='')

    location_name = models.CharField(max_length=150, blank=True, default='')
    latitude      = models.FloatField(null=True, blank=True)
    longitude     = models.FloatField(null=True, blank=True)

    contact_type  = models.CharField(max_length=15, choices=LF_CONTACT_CHOICES, default='ME')
    roll_number   = models.CharField(max_length=20, blank=True, default='')  # ID-card special case

    date_reported = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_reported']
        indexes  = [models.Index(fields=['item_type', 'status'])]

    def __str__(self):
        return f"[{self.item_type}] {self.title} – {self.reporter.username}"

    @property
    def image_effective(self):
        if self.image:
            return self.image.url
        return self.image_url or ''


class LFClaim(models.Model):
    STATUS_PENDING   = 'PENDING'
    STATUS_RESOLVED  = 'RESOLVED'
    STATUS_CANCELLED = 'CANCELLED'
    STATUS_CHOICES   = [
        ('PENDING',   'Pending'),
        ('RESOLVED',  'Resolved'),
        ('CANCELLED', 'Cancelled'),
    ]

    item       = models.ForeignKey(LFItem, on_delete=models.CASCADE, related_name='claims')
    claimant   = models.ForeignKey(User,   on_delete=models.CASCADE, related_name='lf_claims')
    message    = models.TextField(blank=True, default='')
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Only one PENDING interaction per item at any time (allows history of resolved/cancelled ones)
        constraints = [
            models.UniqueConstraint(
                fields=['item'],
                condition=models.Q(status='PENDING'),
                name='lf_unique_pending_per_item',
            )
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.claimant.username} → {self.item.title}"


class LFNotification(models.Model):
    user       = models.ForeignKey(User,   on_delete=models.CASCADE,  related_name='lf_notifications')
    item       = models.ForeignKey(LFItem, on_delete=models.SET_NULL, null=True, blank=True, related_name='notifications')
    message    = models.TextField()
    is_read    = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"→{self.user.username}: {self.message[:40]}"


class LFLog(models.Model):
    item       = models.ForeignKey(LFItem, on_delete=models.CASCADE,  related_name='logs')
    actor      = models.ForeignKey(User,   on_delete=models.SET_NULL, null=True, related_name='lf_logs')
    action     = models.CharField(max_length=30)  # POSTED / CLAIMED / CLOSED / EDITED / HANDED_OVER
    detail     = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} on #{self.item_id} by {self.actor_id}"


# ---------------------------------------------------------------------------
# Legacy campus models (unchanged)
# ---------------------------------------------------------------------------

class LostFoundItem(models.Model):
    TYPE_CHOICES = [('lost', 'Lost'), ('found', 'Found')]

    item_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=50)
    location = models.CharField(max_length=100)
    contact = models.CharField(max_length=20)
    tags = models.JSONField(default=list)
    date_reported = models.DateField(auto_now_add=True)

    def __str__(self):
        return f"[{self.item_type.upper()}] {self.name}"


class MarketplaceListing(models.Model):
    CONDITION_CHOICES = [
        ('like new', 'Like New'), ('good', 'Good'),
        ('fair', 'Fair'), ('poor', 'Poor'),
    ]

    title = models.CharField(max_length=200)
    category = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    condition = models.CharField(max_length=10, choices=CONDITION_CHOICES)
    seller_roll = models.CharField(max_length=20)
    contact = models.CharField(max_length=20)
    is_sold = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Doctor(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'), ('busy', 'Busy'), ('unavailable', 'Unavailable'),
    ]

    name = models.CharField(max_length=100)
    specialization = models.CharField(max_length=100)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='available')
    timings = models.CharField(max_length=100)

    def __str__(self):
        return f"Dr. {self.name}"


class CampusEvent(models.Model):
    CATEGORY_CHOICES = [
        ('technical', 'Technical'), ('cultural', 'Cultural'),
        ('sports', 'Sports'), ('academic', 'Academic'), ('social', 'Social'),
    ]

    name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=100)
    organizer = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Mess Module
# ---------------------------------------------------------------------------

MESS_HOSTEL_CHOICES = [
    ('hostel_1',    'Hostel 1'),  ('hostel_2',    'Hostel 2'),
    ('hostel_3',    'Hostel 3'),  ('hostel_4',    'Hostel 4'),
    ('hostel_5',    'Hostel 5'),  ('hostel_6',    'Hostel 6'),
    ('hostel_7',    'Hostel 7'),  ('hostel_8',    'Hostel 8'),
    ('hostel_9',    'Hostel 9'),  ('hostel_10',   'Hostel 10'),
    ('hostel_11',   'Hostel 11'), ('hostel_12',   'Hostel 12'),
    ('hostel_13',   'Hostel 13'), ('hostel_14',   'Hostel 14'),
    ('hostel_15',   'Hostel 15'), ('hostel_16',   'Hostel 16'),
    ('hostel_17',   'Hostel 17'), ('hostel_18',   'Hostel 18'),
    ('hostel_19',   'Hostel 19'), ('hostel_21',   'Hostel 21'),
    ('tansa_house', 'Tansa House'),
]
MESS_HOSTEL_KEYS  = {k for k, _ in MESS_HOSTEL_CHOICES}
MESS_HOSTEL_LABEL = dict(MESS_HOSTEL_CHOICES)

MESS_MEAL_CHOICES = [
    ('BREAKFAST', 'Breakfast'),
    ('LUNCH',     'Lunch'),
    ('SNACKS',    'Snacks'),
    ('DINNER',    'Dinner'),
]
MESS_MEAL_KEYS  = {k for k, _ in MESS_MEAL_CHOICES}
MESS_MEAL_LABEL = dict(MESS_MEAL_CHOICES)


class MessHostelSettings(models.Model):
    """Per-hostel configuration: SMA amounts, meal deduction rates, guest coupon pricing & limits."""
    hostel                   = models.CharField(max_length=30, choices=MESS_HOSTEL_CHOICES, unique=True)
    monthly_sma              = models.DecimalField(max_digits=10, decimal_places=2, default=27000)
    # Daily meal deductions
    breakfast_deduction      = models.DecimalField(max_digits=6, decimal_places=2, default=35)
    lunch_deduction          = models.DecimalField(max_digits=6, decimal_places=2, default=40)
    snacks_deduction         = models.DecimalField(max_digits=6, decimal_places=2, default=35)
    dinner_deduction         = models.DecimalField(max_digits=6, decimal_places=2, default=40)
    # Guest coupon prices
    guest_breakfast_price    = models.DecimalField(max_digits=6, decimal_places=2, default=50)
    guest_lunch_price        = models.DecimalField(max_digits=6, decimal_places=2, default=65)
    guest_snacks_price       = models.DecimalField(max_digits=6, decimal_places=2, default=50)
    guest_dinner_price       = models.DecimalField(max_digits=6, decimal_places=2, default=65)
    # Limits
    guest_slot_daily_limit   = models.PositiveIntegerField(default=50)   # total per slot per hostel per day
    guest_student_slot_limit = models.PositiveIntegerField(default=10)   # per student per slot per day
    updated_at               = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Mess Hostel Settings'
        verbose_name_plural = 'Mess Hostel Settings'

    def __str__(self):
        return f"Settings – {self.get_hostel_display()}"

    @property
    def daily_total(self):
        return (self.breakfast_deduction + self.lunch_deduction +
                self.snacks_deduction   + self.dinner_deduction)

    def guest_price(self, meal_type):
        return {
            'BREAKFAST': self.guest_breakfast_price,
            'LUNCH':     self.guest_lunch_price,
            'SNACKS':    self.guest_snacks_price,
            'DINNER':    self.guest_dinner_price,
        }.get(meal_type)


class MessAdminProfile(models.Model):
    """Links a User to exactly one hostel as its mess administrator."""
    user   = models.OneToOneField(User, on_delete=models.CASCADE, related_name='mess_admin_profile')
    hostel = models.CharField(max_length=30, choices=MESS_HOSTEL_CHOICES)

    class Meta:
        verbose_name = 'Mess Admin Profile'

    def __str__(self):
        return f"{self.user.username} → {self.get_hostel_display()}"


class DailyMenu(models.Model):
    """Menu for one hostel, one date, one meal slot."""
    hostel     = models.CharField(max_length=30, choices=MESS_HOSTEL_CHOICES, db_index=True)
    date       = models.DateField(db_index=True)
    meal_type  = models.CharField(max_length=10, choices=MESS_MEAL_CHOICES)
    items      = models.TextField(blank=True, default='')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='mess_menu_updates')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [['hostel', 'date', 'meal_type']]
        ordering        = ['date', 'meal_type']

    def __str__(self):
        return f"{self.hostel} {self.date} {self.meal_type}"


class GuestCouponPurchase(models.Model):
    """Record of a student purchasing guest meal coupons for a hostel+date+meal."""
    student      = models.ForeignKey(User, on_delete=models.CASCADE,
                                     related_name='guest_coupon_purchases')
    hostel       = models.CharField(max_length=30)
    date         = models.DateField(db_index=True)
    meal_type    = models.CharField(max_length=10, choices=MESS_MEAL_CHOICES)
    quantity     = models.PositiveIntegerField()
    unit_price   = models.DecimalField(max_digits=6, decimal_places=2)
    total_amount = models.DecimalField(max_digits=8, decimal_places=2)
    # Snapshot of student details at purchase time
    roll_number  = models.CharField(max_length=20, blank=True)
    room_number  = models.CharField(max_length=20, blank=True)
    hostel_number= models.CharField(max_length=30, blank=True)  # student's own hostel
    purchased_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-purchased_at']

    def __str__(self):
        return (f"{self.student.username} – {self.meal_type} ×{self.quantity} "
                f"@ {self.hostel} on {self.date}")


class RebateRequest(models.Model):
    """A student's request to waive daily SMA deductions for a date range."""
    STATUS_PENDING  = 'PENDING'
    STATUS_APPROVED = 'APPROVED'
    STATUS_REJECTED = 'REJECTED'
    STATUS_CHOICES  = [
        ('PENDING',  'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    student     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rebate_requests')
    hostel      = models.CharField(max_length=30)
    start_date  = models.DateField()
    end_date    = models.DateField()
    days        = models.PositiveIntegerField()  # = (end_date - start_date).days + 1
    reason      = models.TextField(blank=True, default='')
    status      = models.CharField(max_length=10, choices=STATUS_CHOICES,
                                   default='PENDING', db_index=True)
    admin_note  = models.TextField(blank=True, default='')
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='reviewed_rebates')
    created_at  = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return (f"{self.student.username} rebate {self.start_date}→{self.end_date} "
                f"[{self.status}]")


# ---------------------------------------------------------------------------
# Contacts Module
# ---------------------------------------------------------------------------

class Faculty(models.Model):
    name           = models.CharField(max_length=200)
    photo          = models.ImageField(upload_to='faculty_photos/', null=True, blank=True)
    department     = models.CharField(max_length=100, db_index=True)
    specialization = models.CharField(max_length=200, blank=True)
    email          = models.EmailField(blank=True)
    cabin_no       = models.CharField(max_length=50, blank=True)
    is_available   = models.BooleanField(default=True)  # False = on leave
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['department', 'name']

    def __str__(self):
        return f"{self.name} ({self.department})"


class Department(models.Model):
    name             = models.CharField(max_length=200)
    official_contact = models.CharField(max_length=50, blank=True)
    official_email   = models.EmailField(blank=True)
    location         = models.CharField(max_length=200, blank=True)
    maps_url         = models.URLField(max_length=500, blank=True,
                           help_text="Direct Google Maps URL for this department")
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class EmergencyContact(models.Model):
    service_name = models.CharField(max_length=100)
    contact      = models.CharField(max_length=100)
    order        = models.PositiveSmallIntegerField(default=0,
                       help_text="Display order (lower = shown first)")
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'service_name']

    def __str__(self):
        return f"{self.service_name}: {self.contact}"


# ---------------------------------------------------------------------------
# Doctor Schedule Cache
# ---------------------------------------------------------------------------

class DoctorScheduleCache(models.Model):
    """Stores the last-fetched parsed doctor schedule as JSON."""
    data       = models.JSONField(default=dict)
    fetched_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Doctor Schedule Cache'

    def __str__(self):
        return f"Doctor schedule (fetched {self.fetched_at})"
