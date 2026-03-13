from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, HelpRequest, PasswordResetToken,
    Hostel, FoodOutlet, FoodItem, Order,
    LostFoundItem, MarketplaceListing, Doctor, CampusEvent,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('username', 'email', 'phone', 'points', 'is_staff', 'date_joined')
    list_filter   = ('is_staff', 'is_superuser', 'is_active')
    fieldsets     = BaseUserAdmin.fieldsets + (
        ('Campus Info', {'fields': ('phone', 'points')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Campus Info', {'fields': ('phone',)}),
    )


@admin.register(HelpRequest)
class HelpRequestAdmin(admin.ModelAdmin):
    list_display  = (
        'id', 'item_description', 'requester', 'helper',
        'pickup_location', 'delivery_location', 'status', 'from_time', 'to_time', 'created_at',
    )
    list_filter   = ('status', 'pickup_location')
    search_fields = ('item_description', 'requester__username', 'helper__username')
    readonly_fields = ('created_at',)


@admin.register(PasswordResetToken)
class PasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ('user', 'token', 'created_at', 'used')
    list_filter  = ('used',)


# Legacy models
admin.site.register(Hostel)
admin.site.register(FoodOutlet)
admin.site.register(FoodItem)
admin.site.register(Order)
admin.site.register(LostFoundItem)
admin.site.register(MarketplaceListing)
admin.site.register(Doctor)
admin.site.register(CampusEvent)
