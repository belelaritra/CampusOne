from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import (
    User, HelpRequest, PasswordResetToken,
    Hostel, FoodOutlet, FoodItem, Order,
    LostFoundItem, MarketplaceListing, Doctor, CampusEvent,
    # Food Ordering
    Outlet, MenuItem, OutletAdmin as OutletAdminModel,
    FoodOrder, FoodOrderItem, Review,
    # Lost & Found
    LFCategory, LFItem, LFClaim, LFNotification,
    # Mess Module
    MessHostelSettings, MessAdminProfile, DailyMenu,
    GuestCouponPurchase, RebateRequest,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = ('username', 'full_name', 'email', 'roll_number', 'hostel', 'room_number', 'points', 'is_staff', 'date_joined')
    list_filter   = ('is_staff', 'is_superuser', 'is_active', 'hostel')
    search_fields = ('username', 'email', 'full_name', 'roll_number')
    fieldsets     = BaseUserAdmin.fieldsets + (
        ('Campus Info', {'fields': ('phone', 'phone_number', 'full_name', 'roll_number', 'hostel', 'room_number', 'points', 'is_security')}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Campus Info', {'fields': ('phone', 'full_name', 'roll_number')}),
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


# ---------------------------------------------------------------------------
# Lost & Found Admin
# ---------------------------------------------------------------------------

@admin.register(LFCategory)
class LFCategoryAdmin(admin.ModelAdmin):
    list_display  = ('name', 'icon')
    search_fields = ('name',)


@admin.register(LFItem)
class LFItemAdmin(admin.ModelAdmin):
    list_display   = ('title', 'item_type', 'status', 'category', 'reporter', 'location_name', 'date_reported')
    list_filter    = ('item_type', 'status', 'category')
    search_fields  = ('title', 'reporter__username', 'location_name')
    readonly_fields= ('date_reported',)


@admin.register(LFClaim)
class LFClaimAdmin(admin.ModelAdmin):
    list_display  = ('item', 'claimant', 'status', 'created_at')
    list_filter   = ('status',)
    search_fields = ('item__title', 'claimant__username')
    readonly_fields = ('created_at',)


@admin.register(LFNotification)
class LFNotificationAdmin(admin.ModelAdmin):
    list_display  = ('user', 'item', 'message', 'is_read', 'created_at')
    list_filter   = ('is_read',)
    search_fields = ('user__username', 'message')


# ---------------------------------------------------------------------------
# Mess Module Admin
# ---------------------------------------------------------------------------

@admin.register(MessHostelSettings)
class MessHostelSettingsAdmin(admin.ModelAdmin):
    list_display  = (
        'hostel', 'monthly_sma',
        'breakfast_deduction', 'lunch_deduction', 'snacks_deduction', 'dinner_deduction',
        'guest_slot_daily_limit', 'guest_student_slot_limit', 'updated_at',
    )
    list_filter   = ('hostel',)


@admin.register(MessAdminProfile)
class MessAdminProfileAdmin(admin.ModelAdmin):
    list_display  = ('user', 'hostel')
    list_filter   = ('hostel',)
    search_fields = ('user__username', 'user__full_name')
    raw_id_fields = ('user',)


@admin.register(DailyMenu)
class DailyMenuAdmin(admin.ModelAdmin):
    list_display   = ('hostel', 'date', 'meal_type', 'updated_by', 'updated_at')
    list_filter    = ('hostel', 'meal_type', 'date')
    search_fields  = ('hostel', 'items')
    date_hierarchy = 'date'
    readonly_fields= ('updated_at',)


@admin.register(GuestCouponPurchase)
class GuestCouponPurchaseAdmin(admin.ModelAdmin):
    list_display   = ('student', 'hostel', 'date', 'meal_type', 'quantity', 'total_amount', 'purchased_at')
    list_filter    = ('hostel', 'meal_type', 'date')
    search_fields  = ('student__username', 'student__roll_number')
    date_hierarchy = 'date'
    readonly_fields= ('purchased_at', 'total_amount', 'unit_price')


@admin.register(RebateRequest)
class RebateRequestAdmin(admin.ModelAdmin):
    list_display   = ('student', 'hostel', 'start_date', 'end_date', 'days', 'status', 'reviewed_by', 'created_at')
    list_filter    = ('status', 'hostel')
    search_fields  = ('student__username', 'student__roll_number', 'reason')
    date_hierarchy = 'start_date'
    readonly_fields= ('created_at', 'reviewed_at', 'days')
    actions        = ['approve_rebates', 'reject_rebates']

    def approve_rebates(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(status='PENDING').update(
            status='APPROVED', reviewed_by=request.user, reviewed_at=timezone.now()
        )
        self.message_user(request, f'{updated} rebate(s) approved.')
    approve_rebates.short_description = 'Approve selected rebates'

    def reject_rebates(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(status='PENDING').update(
            status='REJECTED', reviewed_by=request.user, reviewed_at=timezone.now()
        )
        self.message_user(request, f'{updated} rebate(s) rejected.')
    reject_rebates.short_description = 'Reject selected rebates'
