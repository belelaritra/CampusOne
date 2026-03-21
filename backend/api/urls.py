from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# ---------------------------------------------------------------------------
# Help & Delivery router
# ---------------------------------------------------------------------------
help_router = DefaultRouter()
help_router.register(r'', views.HelpRequestViewSet, basename='help')

# ---------------------------------------------------------------------------
# Food Ordering — admin menu router
# ---------------------------------------------------------------------------
food_admin_menu_router = DefaultRouter()
food_admin_menu_router.register(r'menu', views.AdminMenuViewSet, basename='food-admin-menu')

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
    # --- Auth ---
    path('auth/register/',        views.RegisterView.as_view(),       name='auth-register'),
    path('auth/login/',           views.LoginView.as_view(),          name='auth-login'),
    path('auth/logout/',          views.LogoutView.as_view(),         name='auth-logout'),
    path('auth/me/',              views.UserProfileView.as_view(),    name='auth-me'),
    path('auth/change-password/', views.ChangePasswordView.as_view(), name='auth-change-password'),
    path('auth/forgot-password/', views.ForgotPasswordView.as_view(), name='auth-forgot-password'),
    path('auth/reset-password/',  views.ResetPasswordView.as_view(),  name='auth-reset-password'),

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

    # --- Campus (legacy) ---
    path('', include(campus_router.urls)),
]
