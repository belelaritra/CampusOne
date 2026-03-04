from django.db import models


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
    items = models.JSONField()  # [{name, price}]
    total = models.DecimalField(max_digits=10, decimal_places=2)
    roll_number = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='placed')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Order #{self.id} by {self.roll_number}"


class HelpRequest(models.Model):
    URGENCY_CHOICES = [('normal', 'Normal'), ('urgent', 'Urgent')]
    STATUS_CHOICES = [('open', 'Open'), ('accepted', 'Accepted'), ('completed', 'Completed')]

    item = models.CharField(max_length=200)
    pickup_location = models.CharField(max_length=100)
    delivery_location = models.CharField(max_length=100)
    points = models.IntegerField(default=25)
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES, default='normal')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    requester_roll = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.item


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
    CONDITION_CHOICES = [('like new', 'Like New'), ('good', 'Good'), ('fair', 'Fair'), ('poor', 'Poor')]

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
    STATUS_CHOICES = [('available', 'Available'), ('busy', 'Busy'), ('unavailable', 'Unavailable')]

    name = models.CharField(max_length=100)
    specialization = models.CharField(max_length=100)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='available')
    timings = models.CharField(max_length=100)

    def __str__(self):
        return f"Dr. {self.name}"


class CampusEvent(models.Model):
    CATEGORY_CHOICES = [('technical', 'Technical'), ('cultural', 'Cultural'), ('sports', 'Sports'), ('academic', 'Academic'), ('social', 'Social')]

    name = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    date = models.DateField()
    time = models.TimeField()
    location = models.CharField(max_length=100)
    organizer = models.CharField(max_length=100)
    description = models.TextField()

    def __str__(self):
        return self.name
