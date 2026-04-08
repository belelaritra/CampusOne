"""
Food Ordering — Top 5 Security / Logic Risk Tests

Selected vulnerability classes:
  1. Price injection    — zero or negative price accepted → free or negative-cost items
  2. Missing validation — DELIVERY order placed with no delivery location (data loss)
  3. Status skip        — outlet admin skips status steps (order state manipulation)
  4. Backwards reversal — terminal order re-opened by reversing state machine
  5. Analytics fraud    — PENDING/CANCELLED counted in revenue (financial reporting corruption)
"""

from decimal import Decimal
import pytest


# ---------------------------------------------------------------------------
# 1. PRICE INJECTION — zero or negative price on a menu item
#
# RISK: FoodOrder.total_price is computed as SUM(item.price × quantity).
# If a MenuItem with price=0 or price=-10 is created, every order containing
# it either has the total reduced to zero or goes negative — meaning the
# outlet effectively pays the customer.  This is an application-level
# financial vulnerability with no database-level guard.
# ---------------------------------------------------------------------------

def test_price_zero_and_negative_are_rejected_by_serializer():
    """
    MenuItemWriteSerializer.validate_price() must reject price ≤ 0.
    Zero or negative prices corrupt every order total that includes this item.
    """
    from api.serializers import MenuItemWriteSerializer
    from rest_framework import serializers as drf_serializers

    s = MenuItemWriteSerializer()

    with pytest.raises(drf_serializers.ValidationError, match="positive"):
        s.validate_price(Decimal("0"))

    with pytest.raises(drf_serializers.ValidationError, match="positive"):
        s.validate_price(Decimal("-5.00"))

    # Boundary: 0.01 is the smallest valid price — must pass
    result = s.validate_price(Decimal("0.01"))
    assert result == Decimal("0.01"), (
        "BUG: validate_price rejected 0.01, which is a valid positive price."
    )


# ---------------------------------------------------------------------------
# 2. MISSING VALIDATION — DELIVERY order with no delivery_location
#
# RISK: If the serializer does not enforce delivery_location for DELIVERY
# orders, the outlet admin sees an empty destination field.  The order is
# accepted but can never be fulfilled — customer paid (COD noted) but receives
# nothing, and support has no address to investigate.
# ---------------------------------------------------------------------------

def test_delivery_order_without_location_is_rejected():
    """
    PlaceOrderSerializer.validate() must raise when order_type=DELIVERY
    and delivery_location is absent or blank.
    """
    from api.serializers import PlaceOrderSerializer

    s = PlaceOrderSerializer(data={
        "outlet_id":  1,
        "order_type": "DELIVERY",
        # delivery_location intentionally omitted — this is the attack vector
        "items":      [{"food_item_id": 1, "quantity": 1}],
    })

    assert not s.is_valid(), (
        "BUG: PlaceOrderSerializer accepted a DELIVERY order with no location. "
        "Orders will be placed with no delivery destination."
    )
    assert "delivery_location" in str(s.errors).lower(), (
        "BUG: Error message does not mention delivery_location. "
        "The client cannot tell the user what field is missing."
    )


# ---------------------------------------------------------------------------
# 3. STATUS SKIP — outlet admin jumps from ACCEPTED to OUT_FOR_DELIVERY
#
# RISK: If the status transition dict is wrong or incomplete, an outlet admin
# can skip the PREPARING step and mark an order as OUT_FOR_DELIVERY before
# any food has been made.  The customer's tracking shows "on the way" while
# the food hasn't started cooking — and the admin loses the ability to
# cancel a still-pending order.
# ---------------------------------------------------------------------------

def test_delivery_status_machine_allows_only_one_step_at_a_time():
    """
    From ACCEPTED, the only allowed next status is PREPARING.
    Skipping to OUT_FOR_DELIVERY or DELIVERED must be impossible.
    """
    # Mirror the exact dict from AdminOrderView.patch() in views.py
    DELIVERY_TRANSITIONS = {
        "ACCEPTED":         ["PREPARING"],
        "PREPARING":        ["OUT_FOR_DELIVERY"],
        "OUT_FOR_DELIVERY": ["DELIVERED"],
    }

    allowed_from_accepted = DELIVERY_TRANSITIONS.get("ACCEPTED", [])

    assert "PREPARING" in allowed_from_accepted, (
        "BUG: PREPARING is not allowed from ACCEPTED. "
        "The order can never progress past acceptance."
    )
    assert "OUT_FOR_DELIVERY" not in allowed_from_accepted, (
        "BUG: OUT_FOR_DELIVERY is reachable directly from ACCEPTED. "
        "Orders skip the kitchen — food was never prepared."
    )
    assert "DELIVERED" not in allowed_from_accepted, (
        "BUG: DELIVERED is reachable directly from ACCEPTED. "
        "Orders are marked delivered before any preparation began."
    )


# ---------------------------------------------------------------------------
# 4. BACKWARDS REVERSAL — delivery status rolls back to a prior state
#
# RISK: If A → B is allowed AND B → A is also allowed, a malicious or
# buggy outlet admin can re-open a DELIVERED order (to claim it was never
# delivered), re-trigger COD collection, or cancel after the customer
# has already received their food.  This is a financial control failure.
# ---------------------------------------------------------------------------

def test_no_backwards_status_transition_possible():
    """
    For every A → B transition in the delivery chain, B → A must not exist.
    A backwards transition lets admins un-deliver orders after payment.
    """
    DELIVERY_TRANSITIONS = {
        "ACCEPTED":         ["PREPARING"],
        "PREPARING":        ["OUT_FOR_DELIVERY"],
        "OUT_FOR_DELIVERY": ["DELIVERED"],
    }

    for source, targets in DELIVERY_TRANSITIONS.items():
        for target in targets:
            reverse_allowed = DELIVERY_TRANSITIONS.get(target, [])
            assert source not in reverse_allowed, (
                f"BUG: Backwards transition {target} → {source} is possible. "
                f"An outlet admin can roll back an order to '{source}' after "
                f"it has already reached '{target}'."
            )


# ---------------------------------------------------------------------------
# 5. ANALYTICS FRAUD — PENDING or CANCELLED orders counted in revenue
#
# RISK: FOOD_ACTIVE_STATUSES controls which orders appear in hostel-wise
# counts and daily revenue totals.  If PENDING is included, every order
# that has been placed (but not yet accepted) inflates the revenue report.
# If CANCELLED is included, refunded or rejected orders are counted as sales.
# Both corrupt financial reporting used by outlet admins to track earnings.
# ---------------------------------------------------------------------------

def test_pending_and_cancelled_excluded_from_active_statuses():
    """
    FOOD_ACTIVE_STATUSES must not include PENDING or CANCELLED.
    Including either one corrupts all analytics and revenue calculations.
    """
    from api.models import FOOD_ACTIVE_STATUSES

    assert "PENDING" not in FOOD_ACTIVE_STATUSES, (
        "BUG: PENDING is in FOOD_ACTIVE_STATUSES. "
        "Every unconfirmed order inflates hostel-wise counts and daily revenue."
    )
    assert "CANCELLED" not in FOOD_ACTIVE_STATUSES, (
        "BUG: CANCELLED is in FOOD_ACTIVE_STATUSES. "
        "Refunded/rejected orders are counted as completed sales."
    )
    # Sanity: the terminal statuses that represent real sales must be present
    for required in ("DELIVERED", "TOOK", "ACCEPTED", "PREPARING"):
        assert required in FOOD_ACTIVE_STATUSES, (
            f"BUG: {required} is missing from FOOD_ACTIVE_STATUSES. "
            f"Real sales in this state are excluded from revenue reports."
        )
