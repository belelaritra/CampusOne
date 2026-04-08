from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# ---------------------------------------------------------------------------
# Help & Delivery router
# ---------------------------------------------------------------------------
help_router = DefaultRouter()
help_router.register(r'', views.HelpRequestViewSet, basename='help')

# ---------------------------------------------------------------------------
# Lost & Found routers
# ---------------------------------------------------------------------------
lf_item_router = DefaultRouter()
lf_item_router.register(r'items', views.LFItemViewSet, basename='lf-item')

lf_notif_router = DefaultRouter()
lf_notif_router.register(r'notifications', views.LFNotificationViewSet, basename='lf-notif')

# ---------------------------------------------------------------------------
# Food Ordering — admin menu router
# ---------------------------------------------------------------------------
food_admin_menu_router = DefaultRouter()
food_admin_menu_router.register(r'menu', views.AdminMenuViewSet, basename='food-admin-menu')

# ---------------------------------------------------------------------------
# Mess Module routers
# ---------------------------------------------------------------------------
mess_coupon_router = DefaultRouter()
mess_coupon_router.register(r'coupons', views.GuestCouponViewSet, basename='mess-coupon')

mess_rebate_router = DefaultRouter()
mess_rebate_router.register(r'rebates', views.RebateViewSet, basename='mess-rebate')

# ---------------------------------------------------------------------------
# Admin Master Console routers (staff only)
# ---------------------------------------------------------------------------
console_user_router = DefaultRouter()
console_user_router.register(r'users', views.ConsoleUserViewSet, basename='console-user')

console_menu_router = DefaultRouter()
console_menu_router.register(r'menus', views.ConsoleMenuViewSet, basename='console-menu')

console_coupon_router = DefaultRouter()
console_coupon_router.register(r'coupons', views.ConsoleCouponViewSet, basename='console-coupon')

console_rebate_router = DefaultRouter()
console_rebate_router.register(r'rebates', views.ConsoleRebateViewSet, basename='console-rebate')

console_settings_router = DefaultRouter()
console_settings_router.register(r'settings', views.ConsoleSettingsViewSet, basename='console-settings')

console_outlet_router = DefaultRouter()
console_outlet_router.register(r'outlets', views.ConsoleOutletViewSet, basename='console-outlet')

console_outlet_admin_router = DefaultRouter()
console_outlet_admin_router.register(r'outlet-admins', views.ConsoleOutletAdminViewSet, basename='console-outlet-admin')

console_hostel_router = DefaultRouter()
console_hostel_router.register(r'hostels', views.ConsoleHostelViewSet, basename='console-hostel')

console_orders_router = DefaultRouter()
console_orders_router.register(r'orders', views.ConsoleFoodOrderViewSet, basename='console-orders')

# ---------------------------------------------------------------------------
# Contacts Module routers
# ---------------------------------------------------------------------------
faculty_router = DefaultRouter()
faculty_router.register(r'faculty', views.FacultyViewSet, basename='faculty')

department_router = DefaultRouter()
department_router.register(r'departments', views.DepartmentViewSet, basename='department')

emergency_router = DefaultRouter()
emergency_router.register(r'emergency', views.EmergencyContactViewSet, basename='emergency')

# ---------------------------------------------------------------------------
# Legacy campus routers (unchanged)
# ---------------------------------------------------------------------------
campus_router = DefaultRouter()
campus_router.register(r'hostels',     views.HostelViewSet)
campus_router.register(r'outlets',     views.FoodOutletViewSet)
campus_router.register(r'orders',      views.OrderViewSet)
campus_router.register(r'lostfound',   views.LostFoundViewSet)
campus_router.register(r'marketplace', views.MarketplaceViewSet)
campus_router.register(r'doctors',     views.DoctorViewSet)
campus_router.register(r'events',      views.EventViewSet)

urlpatterns = [
    # --- Auth (Keycloak owns login/logout/register/password-reset) ---
    path('auth/me/',              views.UserProfileView.as_view(),    name='auth-me'),

    # --- Telegram Bot ---
    path('bot/link-phone/',       views.BotLinkPhoneView.as_view(),   name='bot-link-phone'),

    # --- Help & Delivery ---
    path('help/', include(help_router.urls)),

    # --- Food Ordering: User-facing ---
    path('food/outlets/',                        views.FoodOutletListView.as_view(),   name='food-outlets'),
    path('food/outlets/<int:outlet_id>/menu/',   views.FoodOutletMenuView.as_view(),   name='food-menu'),
    path('food/orders/',                         views.PlaceOrderView.as_view(),       name='food-place-order'),
    path('food/orders/pending/',                 views.UserPendingOrdersView.as_view(),name='food-pending'),
    path('food/orders/history/',                 views.UserOrderHistoryView.as_view(), name='food-history'),
    path('food/orders/<int:pk>/',                views.TrackOrderView.as_view(),       name='food-track'),
    path('food/orders/<int:pk>/cancel/',         views.CancelOrderView.as_view(),      name='food-cancel'),
    path('food/orders/<int:pk>/review/',         views.SubmitReviewView.as_view(),     name='food-review'),

    # --- Food Ordering: Outlet Admin ---
    path('food/admin/', include(food_admin_menu_router.urls)),
    path('food/admin/orders/',
         views.AdminOrderListView.as_view(),     name='food-admin-orders'),
    path('food/admin/orders/<int:pk>/<str:action_name>/',
         views.AdminOrderActionView.as_view(),   name='food-admin-order-action'),
    path('food/admin/orders/<int:pk>/status/',
         views.AdminOrderActionView.as_view(),   name='food-admin-order-status'),

    # --- Food Ordering: Analytics ---
    path('food/analytics/hostel-wise/',    views.HostelWiseAnalyticsView.as_view(),   name='food-analytics-hostel'),
    path('food/analytics/top-food-items/', views.TopFoodItemsAnalyticsView.as_view(), name='food-analytics-top'),
    path('food/analytics/time-wise/',      views.TimeWiseAnalyticsView.as_view(),     name='food-analytics-time'),
    path('food/analytics/daily-sales/',    views.DailySalesAnalyticsView.as_view(),   name='food-analytics-daily'),

    # --- Lost & Found ---
    path('lf/', include(lf_item_router.urls)),
    path('lf/', include(lf_notif_router.urls)),
    path('lf/my-claims/',                      views.LFClaimListView.as_view(),           name='lf-my-claims'),
    path('lf/categories/',                     views.LFCategoryListView.as_view(),        name='lf-categories'),
    path('lf/analytics/',                      views.LFAnalyticsView.as_view(),           name='lf-analytics'),
    path('lf/analytics/top-lost-locations/',   views.LFTopLostLocationsView.as_view(),    name='lf-top-lost-locations'),
    path('lf/analytics/top-lost-categories/', views.LFTopLostCategoriesView.as_view(),   name='lf-top-lost-categories'),

    # --- Mess Module ---
    path('mess/settings/',   views.MessSettingsView.as_view(),  name='mess-settings'),
    path('mess/menu/',       views.DailyMenuView.as_view(),     name='mess-menu'),
    path('mess/sma/',        views.MessSMAView.as_view(),       name='mess-sma'),
    path('mess/analytics/',  views.MessAnalyticsView.as_view(), name='mess-analytics'),
    path('mess/', include(mess_coupon_router.urls)),
    path('mess/', include(mess_rebate_router.urls)),

    # --- Admin Master Console ---
    path('console/stats/', views.ConsoleStatsView.as_view(), name='console-stats'),
    path('console/', include(console_user_router.urls)),
    path('console/', include(console_menu_router.urls)),
    path('console/', include(console_coupon_router.urls)),
    path('console/', include(console_rebate_router.urls)),
    path('console/', include(console_settings_router.urls)),
    path('console/', include(console_outlet_router.urls)),
    path('console/', include(console_outlet_admin_router.urls)),
    path('console/', include(console_hostel_router.urls)),
    path('console/', include(console_orders_router.urls)),

    # --- Contacts Module ---
    path('contacts/', include(faculty_router.urls)),
    path('contacts/', include(department_router.urls)),
    path('contacts/', include(emergency_router.urls)),

    # --- Doctor Schedule ---
    path('doctors/schedule/', views.DoctorScheduleView.as_view(), name='doctor-schedule'),

    # --- Campus (legacy) ---
    path('', include(campus_router.urls)),
]
