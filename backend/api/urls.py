from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# ---------------------------------------------------------------------------
# Help & Delivery router
# ---------------------------------------------------------------------------
help_router = DefaultRouter()
help_router.register(r'', views.HelpRequestViewSet, basename='help')

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

    # --- Campus (legacy) ---
    path('', include(campus_router.urls)),
]
