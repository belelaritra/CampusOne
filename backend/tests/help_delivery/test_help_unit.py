"""
Help & Delivery — Top 5 Security / Logic Risk Tests

Selected vulnerability classes:
  1. PII leak          — contact number exposed to any authenticated user
  2. Auth boundary     — unauthenticated request reaches contact number
  3. Proximity bypass  — wrong haversine formula lets anyone accept from anywhere
  4. State logic error — check_and_expire() skips an already-ACCEPTED request
  5. Input validation  — invalid duration accepted, polluting to_time calculation
"""

import datetime
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# 1. PII LEAK — contact number visible to random authenticated user
#
# RISK: Any logged-in student browsing the help board can see the phone number
# of every requester.  The fix is a serializer guard that only returns the
# number to requester_id == viewer OR helper_id == viewer.
# A regression here exposes personal phone numbers to the entire campus.
# ---------------------------------------------------------------------------

def test_contact_number_hidden_from_random_authenticated_user():
    """
    Viewer (id=99) is neither the requester (42) nor the helper (55).
    get_contact_number() must return None, not the real phone number.
    """
    from api.serializers import HelpRequestSerializer

    mock_request = MagicMock()
    mock_request.user.is_authenticated = True
    mock_request.user.id = 99                       # unrelated third party

    mock_obj = MagicMock()
    mock_obj.requester_id   = 42
    mock_obj.helper_id      = 55
    mock_obj.contact_number = "9876543210"

    serializer = HelpRequestSerializer(context={"request": mock_request})
    result = serializer.get_contact_number(mock_obj)

    assert result is None, (
        "BUG: contact number leaked to an unrelated user. "
        "This exposes personal PII to anyone browsing the help board."
    )


# ---------------------------------------------------------------------------
# 2. AUTH BOUNDARY — unauthenticated request must never see contact number
#
# RISK: If is_authenticated is not checked first, an unauthenticated API call
# (e.g., from a bot or misconfigured client) could harvest all phone numbers
# on the help board through the public list endpoint.
# ---------------------------------------------------------------------------

def test_contact_number_hidden_from_unauthenticated_viewer():
    """
    An unauthenticated request (is_authenticated=False) must receive None
    for contact_number even if requester_id matches any id comparison.
    """
    from api.serializers import HelpRequestSerializer

    mock_request = MagicMock()
    mock_request.user.is_authenticated = False

    mock_obj = MagicMock()
    mock_obj.requester_id   = 1
    mock_obj.helper_id      = None
    mock_obj.contact_number = "9876543210"

    serializer = HelpRequestSerializer(context={"request": mock_request})
    result = serializer.get_contact_number(mock_obj)

    assert result is None, (
        "BUG: unauthenticated caller received a contact number. "
        "All phone numbers on the board are now publicly accessible."
    )


# ---------------------------------------------------------------------------
# 3. PROXIMITY BYPASS — haversine formula correctness
#
# RISK: haversine() is the ONLY guard that prevents a helper from accepting
# a request while sitting 10 km away.  If the formula is wrong (e.g.,
# radians/degrees confusion, wrong Earth radius), the 200 m check is useless.
# A real-world attacker could write a script that accepts all open requests
# without being anywhere near campus.
# ---------------------------------------------------------------------------

def test_haversine_known_real_world_distance():
    """
    main_gate and gulmohar are approx 370 m apart on IITB campus.
    If haversine returns a value outside 300–600 m the formula is broken
    and the entire proximity acceptance guard is bypassed.
    """
    from api.views import haversine, PICKUP_COORDS

    lat1, lon1 = PICKUP_COORDS["main_gate"]
    lat2, lon2 = PICKUP_COORDS["gulmohar"]
    dist = haversine(lat1, lon1, lat2, lon2)

    assert 300 < dist < 600, (
        f"BUG: haversine returned {dist:.1f} m between main_gate and gulmohar "
        f"(expected ~370 m). The 200 m acceptance radius is now meaningless — "
        f"helpers can accept from anywhere on campus."
    )


# ---------------------------------------------------------------------------
# 4. STATE LOGIC ERROR — check_and_expire() must skip ACCEPTED requests
#
# RISK: If check_and_expire() does not guard on STATUS_PENDING, it would
# flip an ACCEPTED (in-progress) request back to EXPIRED mid-delivery.
# The helper loses their points, the requester's item is never delivered,
# and no error is raised — it is a silent data corruption bug.
# ---------------------------------------------------------------------------

def test_check_and_expire_does_not_flip_accepted_request_to_expired():
    """
    A request that is already ACCEPTED (helper is on the way) must not be
    expired even if to_time has passed.  Only PENDING requests may be expired.
    """
    from api.models import HelpRequest
    from django.utils import timezone

    req = HelpRequest()
    req.status  = HelpRequest.STATUS_ACCEPTED          # helper already accepted
    req.to_time = timezone.now() - datetime.timedelta(minutes=5)   # window passed

    with patch.object(req, "save") as mock_save:
        result = req.check_and_expire()

    assert result is False, (
        "BUG: check_and_expire() returned True for an ACCEPTED request. "
        "Active in-progress deliveries would be silently cancelled."
    )
    assert req.status == HelpRequest.STATUS_ACCEPTED, (
        "BUG: check_and_expire() changed an ACCEPTED request to EXPIRED. "
        "The helper's ongoing delivery was killed without any notification."
    )
    mock_save.assert_not_called()


# ---------------------------------------------------------------------------
# 5. INPUT VALIDATION — only 7 valid durations are allowed
#
# RISK: If an invalid duration (e.g., 7 minutes or 0 minutes) slips through
# serializer validation, to_time = from_time + 7m creates requests that expire
# almost instantly — or with to_time <= now() that bypass the window guard.
# An attacker could craft requests that are immediately expired and flood
# the EXPIRED status to degrade system performance.
# ---------------------------------------------------------------------------

def test_only_the_seven_valid_durations_are_accepted():
    """
    Duration must be one of [5, 10, 15, 30, 60, 90, 120].
    Any other value can create requests with nonsensical expiry windows.
    """
    from api.serializers import DURATION_VALUES

    assert sorted(DURATION_VALUES) == [5, 10, 15, 30, 60, 90, 120], (
        "BUG: DURATION_VALUES does not match the spec. "
        "Invalid durations can be submitted, producing malformed to_time values."
    )

    invalid_durations = [0, 1, 7, 20, 45, 180, -1, 999]
    for bad in invalid_durations:
        assert bad not in DURATION_VALUES, (
            f"BUG: Duration {bad} is in DURATION_VALUES but is not in the spec. "
            f"Requests with this duration will have an invalid expiry window."
        )
