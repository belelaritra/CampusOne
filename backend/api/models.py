from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


# ---------------------------------------------------------------------------
# Custom User
# ---------------------------------------------------------------------------

class User(AbstractUser):
    """Extends AbstractUser with phone number and help-points tracking."""
    phone = models.CharField(max_length=15, blank=True)          # legacy
    full_name    = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=15,  blank=True)
    roll_number  = models.CharField(max_length=20,  blank=True)
    points = models.PositiveIntegerField(default=0)

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
