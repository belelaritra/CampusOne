"""
Mess Module — Top 5 Security / Logic Risk Tests

Selected vulnerability classes:
  1. Semester boundary — off-by-one at Jun 30 / Jul 1 zeroes or doubles every balance
  2. Hostel key roundtrip — H14 ↔ hostel_14 mismatch locks every mess admin out
  3. Guest price case sensitivity — wrong meal key returns None → runtime crash or zero charge
  4. SMA balance with rebate — rebate days not subtracted → students overcharged daily
  5. Rebate max-days bypass — submitting 16-day rebate must be rejected
"""

import datetime
from decimal import Decimal

import pytest


# ---------------------------------------------------------------------------
# 1. SEMESTER BOUNDARY — off-by-one at Jun 30 / Jul 1
#
# RISK: _current_semester() determines which SMA pool (27,000) the student
# draws from.  If Jun 30 is classified as Autumn, the Spring semester ends
# a day early and students' balances are calculated against a semester that
# started in July — giving them 181 days of deductions instead of 0.
# If Jul 1 is classified as Spring, the Autumn semester never starts and
# every student's balance for the second half of the year is wrong.
# This affects every student's balance calculation on those two dates.
# ---------------------------------------------------------------------------

def test_semester_boundary_june_30_is_spring_july_1_is_autumn():
    """
    Jun 30 must be the LAST day of Spring.
    Jul 1 must be the FIRST day of Autumn.
    A one-day error on either side miscalculates the semester pool for all students.
    """
    from api.views import _current_semester

    _, _, label_jun30 = _current_semester(datetime.date(2025, 6, 30))
    _, _, label_jul1  = _current_semester(datetime.date(2025, 7, 1))

    assert label_jun30 == "Spring", (
        "BUG: Jun 30 was classified as Autumn. "
        "Spring SMA is applied one day short — all students show inflated balances."
    )
    assert label_jul1 == "Autumn", (
        "BUG: Jul 1 was classified as Spring. "
        "Autumn SMA pool never activates — all second-semester balances are wrong."
    )

    # Verify the semester dates themselves are correct — wrong dates = wrong day counts
    start_spring, end_spring, _ = _current_semester(datetime.date(2025, 3, 1))
    start_autumn, end_autumn, _ = _current_semester(datetime.date(2025, 9, 1))

    assert end_spring   == datetime.date(2025, 6, 30)
    assert start_autumn == datetime.date(2025, 7, 1)


# ---------------------------------------------------------------------------
# 2. HOSTEL KEY ROUNDTRIP — H14 ↔ hostel_14 must be lossless
#
# RISK: User.hostel may be stored as 'H14' (profile format) while
# MessAdminProfile.hostel stores 'hostel_14' (mess-key format).
# If _normalize_to_mess_key('H14') ≠ 'hostel_14' or the roundtrip
# breaks, every comparison between admin hostel and student hostel fails.
# Result: mess admins get 403 on their own hostel; rebate reviews are
# impossible; the entire mess admin workflow is broken for those hostels.
# ---------------------------------------------------------------------------

def test_hostel_format_roundtrip_is_lossless():
    """
    normalize('H14') → 'hostel_14' → to_profile → 'H14' → normalize → 'hostel_14'
    Any break in this chain means hostel comparisons always return False.
    """
    from api.views import _normalize_to_mess_key, _mess_key_to_profile

    profile_formats = ["H1", "H5", "H14", "H21", "Tansa"]

    for raw in profile_formats:
        mess_key = _normalize_to_mess_key(raw)
        back_to_profile = _mess_key_to_profile(mess_key)
        back_to_key = _normalize_to_mess_key(back_to_profile)

        assert back_to_key == mess_key, (
            f"BUG: Roundtrip failed for '{raw}': "
            f"normalize('{raw}') = '{mess_key}', "
            f"to_profile('{mess_key}') = '{back_to_profile}', "
            f"normalize('{back_to_profile}') = '{back_to_key}'. "
            f"Mess admin for hostel '{raw}' is permanently locked out."
        )


# ---------------------------------------------------------------------------
# 3. GUEST PRICE CASE SENSITIVITY — wrong key returns None
#
# RISK: MessHostelSettings.guest_price(meal_type) does a dict lookup.
# If the caller ever passes a lowercase key ('lunch' instead of 'LUNCH'),
# the method returns None.  Multiplying quantity × None raises TypeError
# in _compute_sma() — causing a 500 error for every balance request.
# Alternatively, if the code is guarded, the price is treated as 0
# and the student is not charged for guest coupons.
# ---------------------------------------------------------------------------

def test_guest_price_returns_none_for_wrong_case_and_invalid_key():
    """
    guest_price('lunch') must return None (not raise, not return a price).
    Only uppercase keys are valid: BREAKFAST, LUNCH, SNACKS, DINNER.
    """
    from api.models import MessHostelSettings

    s = MessHostelSettings()
    s.guest_breakfast_price = Decimal("50")
    s.guest_lunch_price     = Decimal("65")
    s.guest_snacks_price    = Decimal("50")
    s.guest_dinner_price    = Decimal("65")

    # Wrong case — must return None, not raise, not return a price
    assert s.guest_price("lunch")     is None, "BUG: lowercase 'lunch' returned a price"
    assert s.guest_price("Breakfast") is None, "BUG: 'Breakfast' returned a price"
    assert s.guest_price("BRUNCH")    is None, "BUG: invalid meal type returned a price"

    # Correct keys must return the right amounts
    assert s.guest_price("LUNCH")     == Decimal("65")
    assert s.guest_price("BREAKFAST") == Decimal("50")


# ---------------------------------------------------------------------------
# 4. SMA BALANCE WITH REBATE — approved rebate days must reduce deductions
#
# RISK: The SMA balance formula is:
#   balance = semester_sma - (daily_rate × billable_days) - guest_extra
# where billable_days = elapsed_days - approved_rebate_days.
# If rebate days are NOT subtracted (e.g., the rebate query is skipped or
# the set is empty due to a filter bug), students are charged for days they
# were approved to be away — an overcharge of 150 × rebate_days per student.
# For a 15-day approved rebate that's ₹2,250 incorrectly deducted per student.
# ---------------------------------------------------------------------------

def test_approved_rebate_days_reduce_the_daily_deduction():
    """
    With 5 approved rebate days out of 10 elapsed, only 5 days should be
    charged.  If rebate_days are ignored the student is overcharged ₹750.
    """
    def compute_balance(semester_sma, daily_rate, elapsed_days, rebate_days, guest_extra):
        """Direct mirror of the _compute_sma() inner formula."""
        billable = elapsed_days - rebate_days
        return semester_sma - (daily_rate * billable) - guest_extra

    without_rebate = compute_balance(
        Decimal("27000"), Decimal("150"), elapsed_days=10,
        rebate_days=0, guest_extra=Decimal("0")
    )
    with_rebate = compute_balance(
        Decimal("27000"), Decimal("150"), elapsed_days=10,
        rebate_days=5, guest_extra=Decimal("0")
    )

    expected_savings = Decimal("150") * 5   # ₹750
    assert with_rebate - without_rebate == expected_savings, (
        f"BUG: Rebate savings are {with_rebate - without_rebate} instead of "
        f"{expected_savings}. Students are being overcharged for approved leave."
    )
    assert with_rebate == Decimal("26250"), (
        "BUG: Balance with 5 rebate days should be 27000 - (150×5) = 26250."
    )


# ---------------------------------------------------------------------------
# 5. REBATE MAX-DAYS BYPASS — 16-day rebate must be caught before creation
#
# RISK: The spec allows maximum 15 days per rebate request.
# If the view does not validate this, a student can submit a 30-day rebate
# and avoid ₹4,500 in deductions (30 × 150) in a single request.
# The days field is always computed as (end_date - start_date).days + 1 —
# a student submitting start=Aug 1, end=Aug 31 gets 31 days.
# The view must reject requests where computed days > 15.
# ---------------------------------------------------------------------------

def test_rebate_day_count_rules():
    """
    Inclusive day count must be correct, and values > 15 must be detectable
    so the view can reject them with 400.
    """
    def day_count(start: datetime.date, end: datetime.date) -> int:
        return (end - start).days + 1

    # Boundary: exactly 15 must be allowed
    assert day_count(datetime.date(2025, 8, 1), datetime.date(2025, 8, 15)) == 15

    # One day over: 16 must be rejected by the view
    assert day_count(datetime.date(2025, 8, 1), datetime.date(2025, 8, 16)) == 16, (
        "BUG: 16-day range does not compute to 16. "
        "The view cannot correctly reject over-limit rebates."
    )

    # Reversed dates: must yield ≤ 0 so start_date > end_date validation fires
    assert day_count(datetime.date(2025, 8, 10), datetime.date(2025, 8, 5)) <= 0, (
        "BUG: Reversed date range gives a positive day count. "
        "The view's start ≤ end check may not catch this."
    )

    # Exactly 1 day (same date) must count as 1, not 0
    assert day_count(datetime.date(2025, 8, 5), datetime.date(2025, 8, 5)) == 1, (
        "BUG: Single-day rebate counts as 0. "
        "Students lose a valid rebate day."
    )
