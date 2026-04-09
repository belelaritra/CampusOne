"""
views package — re-exports all view classes so that urls.py continues to work
unchanged (it does `from . import views` and then `views.SomeView`).

Module layout:
  utils.py     — haversine, GPS coordinate constants
  auth.py      — UserProfileView, BotLinkPhoneView
  help.py      — HelpRequestViewSet
  legacy.py    — old stub viewsets (HostelViewSet, etc.)
  food.py      — food ordering: outlets, orders, admin panel, analytics
  lostfound.py — L&F: items, claims, notifications, categories, analytics
  mess.py      — mess: settings, menu, coupons, rebates, SMA, analytics
  console.py   — admin master console (staff only)
  contacts.py  — faculty, departments, emergency contacts
  doctors.py   — DoctorScheduleView
"""

from .auth import BotLinkPhoneView, UserProfileView
from .contacts import (
    ContactsIsStaffOrReadOnly,
    DepartmentViewSet,
    EmergencyContactViewSet,
    FacultyViewSet,
)
from .console import (
    ConsoleCouponViewSet,
    ConsoleFoodOrderViewSet,
    ConsoleHostelViewSet,
    ConsoleMenuViewSet,
    ConsoleOutletAdminViewSet,
    ConsoleOutletViewSet,
    ConsoleRebateViewSet,
    ConsoleSettingsViewSet,
    ConsoleStatsView,
    ConsoleUserViewSet,
    IsStaffUser,
)
from .doctors import DoctorScheduleView
from .food import (
    AdminMenuViewSet,
    AdminOrderActionView,
    AdminOrderListView,
    AnalyticsBaseView,
    CancelOrderView,
    DailySalesAnalyticsView,
    FoodOutletListView,
    FoodOutletMenuView,
    HostelWiseAnalyticsView,
    IsOutletAdmin,
    PlaceOrderView,
    SubmitReviewView,
    TimeWiseAnalyticsView,
    TopFoodItemsAnalyticsView,
    TrackOrderView,
    UserOrderHistoryView,
    UserPendingOrdersView,
)
from .help import HelpRequestViewSet
from .legacy import (
    DoctorViewSet,
    EventViewSet,
    FoodOutletViewSet,
    HostelViewSet,
    LostFoundViewSet,
    MarketplaceViewSet,
    OrderViewSet,
)
from .lostfound import (
    LFAnalyticsView,
    LFCategoryListView,
    LFClaimListView,
    LFItemViewSet,
    LFNotificationViewSet,
    LFTopLostCategoriesView,
    LFTopLostLocationsView,
)
from .mess import (
    DailyMenuView,
    GuestCouponViewSet,
    IsMessAdmin,
    MessAnalyticsView,
    MessSettingsView,
    MessSMAView,
    RebateViewSet,
)

__all__ = [
    # auth
    'UserProfileView', 'BotLinkPhoneView',
    # help
    'HelpRequestViewSet',
    # legacy
    'HostelViewSet', 'FoodOutletViewSet', 'OrderViewSet',
    'LostFoundViewSet', 'MarketplaceViewSet', 'DoctorViewSet', 'EventViewSet',
    # food
    'IsOutletAdmin',
    'FoodOutletListView', 'FoodOutletMenuView',
    'PlaceOrderView', 'UserPendingOrdersView', 'UserOrderHistoryView',
    'TrackOrderView', 'CancelOrderView', 'SubmitReviewView',
    'AdminMenuViewSet', 'AdminOrderListView', 'AdminOrderActionView',
    'AnalyticsBaseView', 'HostelWiseAnalyticsView', 'TopFoodItemsAnalyticsView',
    'TimeWiseAnalyticsView', 'DailySalesAnalyticsView',
    # lostfound
    'LFItemViewSet', 'LFClaimListView', 'LFNotificationViewSet',
    'LFCategoryListView', 'LFAnalyticsView',
    'LFTopLostLocationsView', 'LFTopLostCategoriesView',
    # mess
    'IsMessAdmin',
    'MessSettingsView', 'DailyMenuView', 'GuestCouponViewSet',
    'RebateViewSet', 'MessSMAView', 'MessAnalyticsView',
    # console
    'IsStaffUser',
    'ConsoleStatsView', 'ConsoleUserViewSet', 'ConsoleMenuViewSet',
    'ConsoleCouponViewSet', 'ConsoleRebateViewSet', 'ConsoleSettingsViewSet',
    'ConsoleOutletViewSet', 'ConsoleOutletAdminViewSet', 'ConsoleHostelViewSet',
    'ConsoleFoodOrderViewSet',
    # contacts
    'ContactsIsStaffOrReadOnly',
    'FacultyViewSet', 'DepartmentViewSet', 'EmergencyContactViewSet',
    # doctors
    'DoctorScheduleView',
]
