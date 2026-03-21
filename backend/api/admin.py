from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, HelpRequest, PasswordResetToken,
    Hostel, FoodOutlet, FoodItem, Order,
    LostFoundItem, MarketplaceListing, Doctor, CampusEvent,
    # Food Ordering
    Outlet, MenuItem, OutletAdmin as OutletAdminModel,
    FoodOrder, FoodOrderItem, Review,
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


# ---------------------------------------------------------------------------
# Food Ordering Admin
# ---------------------------------------------------------------------------

class MenuItemInline(admin.TabularInline):
    model  = MenuItem
    extra  = 0
    fields = ('name', 'price', 'is_veg', 'is_available', 'avg_rating', 'review_count')
    readonly_fields = ('avg_rating', 'review_count')


@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display  = ('name', 'is_active', 'created_at')
    list_filter   = ('is_active',)
    search_fields = ('name',)
    inlines       = [MenuItemInline]


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display  = ('name', 'outlet', 'price', 'is_veg', 'is_available', 'avg_rating', 'review_count')
    list_filter   = ('outlet', 'is_veg', 'is_available')
    search_fields = ('name', 'outlet__name')
    readonly_fields = ('avg_rating', 'review_count')


@admin.register(OutletAdminModel)
class OutletAdminAdmin(admin.ModelAdmin):
    list_display  = ('user', 'outlet')
    list_filter   = ('outlet',)
    search_fields = ('user__username', 'outlet__name')


class FoodOrderItemInline(admin.TabularInline):
    model       = FoodOrderItem
    extra       = 0
    fields      = ('food_item', 'quantity', 'price')
    readonly_fields = ('food_item', 'quantity', 'price')


@admin.register(FoodOrder)
class FoodOrderAdmin(admin.ModelAdmin):
    list_display   = ('id', 'user', 'outlet', 'status', 'total_price', 'delivery_location', 'reviewed', 'created_at')
    list_filter    = ('status', 'outlet', 'reviewed')
    search_fields  = ('user__username', 'outlet__name')
    readonly_fields= ('created_at', 'updated_at', 'total_price')
    inlines        = [FoodOrderItemInline]


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display  = ('user', 'food_item', 'order', 'rating', 'created_at')
    list_filter   = ('rating', 'food_item__outlet')
    search_fields = ('user__username', 'food_item__name')
