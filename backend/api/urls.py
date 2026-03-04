from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'hostels',     views.HostelViewSet)
router.register(r'outlets',     views.FoodOutletViewSet)
router.register(r'orders',      views.OrderViewSet)
router.register(r'requests',    views.HelpRequestViewSet)
router.register(r'lostfound',   views.LostFoundViewSet)
router.register(r'marketplace', views.MarketplaceViewSet)
router.register(r'doctors',     views.DoctorViewSet)
router.register(r'events',      views.EventViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
