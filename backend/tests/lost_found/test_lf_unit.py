"""
Lost & Found — Top 5 Security / Logic Risk Tests

Selected vulnerability classes:
  1. PII leak via old interaction — ex-claimant sees reporter's phone after claim is closed
  2. PII leak to any viewer       — reporter's phone visible to all authenticated users
  3. Scoring total wrong          — wrong weights mean matching items are never surfaced
  4. GPS resolver self-consistency — every location resolves to itself (misfiled items)
  5. Tag overflow / injection     — more than 15 tags stored, or unstripped input
"""

from unittest.mock import MagicMock
import pytest


# ---------------------------------------------------------------------------
# 1. PII LEAK VIA OLD INTERACTION — ex-claimant sees reporter phone
#
# RISK: When a claim is resolved or cancelled, the claimant becomes a
# "past interactor."  If get_reporter_phone() only checks whether the
# viewer matches ANY claim on the item (instead of the ACTIVE/PENDING one),
# a user who was rejected in the past can still see the reporter's personal
# phone number indefinitely — long after the item was resolved with someone else.
# ---------------------------------------------------------------------------

def test_past_interactor_cannot_see_reporter_phone_after_claim_closed():
    """
    Viewer (id=77) had a claim on this item that was resolved or cancelled.
    The ACTIVE pending claimant is now user 55.
    Viewer 77 must not see the reporter's phone number.
    """
    from api.serializers import LFItemSerializer

    mock_request = MagicMock()
    mock_request.user.is_authenticated = True
    mock_request.user.id = 77                   # past claimant, claim now closed

    item = MagicMock()
    item.reporter_id            = 42
    item.reporter.phone_number  = "9876543210"
    item.reporter.phone         = ""

    active_interaction             = MagicMock()
    active_interaction.claimant_id = 55          # the CURRENT active interactor (not 77)
    item._active_interaction       = active_interaction

    serializer = LFItemSerializer(context={"request": mock_request})
    result = serializer.get_reporter_phone(item)

    assert result is None, (
        "BUG: Past interactor (id=77) received the reporter's phone number. "
        "The item's active claimant is a different person (id=55). "
        "Personal contact details are leaking to a user whose claim was closed."
    )


# ---------------------------------------------------------------------------
# 2. PII LEAK TO ANY VIEWER — random user sees reporter's phone
#
# RISK: get_reporter_phone() must only return the phone number to:
#   (a) the reporter themselves, or
#   (b) the current active (PENDING) interactor.
# If the guard is missing or inverted, every authenticated user browsing the
# Lost & Found board can see the phone number of every reporter — turning
# the campus L&F system into a phone-number harvesting endpoint.
# ---------------------------------------------------------------------------

def test_random_authenticated_user_cannot_see_reporter_phone():
    """
    Viewer (id=99) is unrelated to this item — not the reporter, not the
    active interactor.  Must receive None, not the reporter's phone number.
    """
    from api.serializers import LFItemSerializer

    mock_request = MagicMock()
    mock_request.user.is_authenticated = True
    mock_request.user.id = 99

    item = MagicMock()
    item.reporter_id            = 42
    item.reporter.phone_number  = "9876543210"
    item.reporter.phone         = ""
    item._active_interaction    = None           # no active claim at all

    serializer = LFItemSerializer(context={"request": mock_request})
    result = serializer.get_reporter_phone(item)

    assert result is None, (
        "BUG: Any authenticated user received the reporter's phone. "
        "All personal contact details on the L&F board are publicly visible."
    )


# ---------------------------------------------------------------------------
# 3. SCORING WEIGHTS — wrong values silence the matching system
#
# RISK: _lf_suggestion_score() drives both the suggestions API and the
# auto-notification system when a FOUND item is posted.  If any weight
# is wrong (e.g., tags give +1 instead of +3), the scores of loosely-
# matching candidates drop below the score > 0 threshold and they are
# silently excluded.  Students with matching LOST items never receive
# a notification that their item was found — the core value proposition
# of the module is broken.
# ---------------------------------------------------------------------------

def test_suggestion_scoring_weights_are_correct():
    """
    Scoring spec (from Logic-Flow.md):
      +5  same category
      +3  per shared tag
      +2  per shared title word
    Any wrong multiplier causes matches to be dropped from notifications.
    """
    from api.views import _lf_suggestion_score

    def make_candidate(tags, cat_id, title):
        c = MagicMock()
        c.tags        = tags
        c.category_id = cat_id
        c.title       = title
        return c

    # Category only → must be exactly 5
    c = make_candidate(tags=[], cat_id=10, title="unrelated")
    assert _lf_suggestion_score(c, set(), set(), ref_cat_id=10) == 5, (
        "BUG: Same-category score is not 5. "
        "Category-matched items will be filtered out of suggestions."
    )

    # Two shared tags → must be exactly 6 (2 × 3)
    c = make_candidate(tags=["wallet", "black"], cat_id=None, title="item")
    assert _lf_suggestion_score(c, {"wallet", "black"}, set(), ref_cat_id=None) == 6, (
        "BUG: Two shared tags do not score 6. "
        "Tag-matched items will be filtered or ranked incorrectly."
    )

    # All signals combined: +5 cat, +6 tags (2×3), +4 words (2×2) = 15
    c = make_candidate(tags=["black", "leather"], cat_id=3, title="black wallet")
    total = _lf_suggestion_score(c, {"black", "leather"}, {"black", "wallet"}, ref_cat_id=3)
    assert total == 15, (
        f"BUG: Combined score is {total}, expected 15. "
        f"Incorrect weights mean partially-matching items are suppressed."
    )


# ---------------------------------------------------------------------------
# 4. GPS RESOLVER SELF-CONSISTENCY — every location must resolve to itself
#
# RISK: _nearest_lf_location() uses haversine to map GPS coordinates to a
# campus location key.  If two locations have wrong or swapped coordinates,
# items found at 'main_gate' are filed under 'gulmohar' and vice versa —
# making location-based search return wrong results forever.
# Since coordinates are hardcoded constants, a single typo in the dict
# silently corrupts all location data for that landmark.
# ---------------------------------------------------------------------------

def test_every_hardcoded_location_resolves_to_itself():
    """
    For each campus location, its own coordinates must produce that location
    as the nearest match.  Failure means items are misfiled to a different
    location and can never be found by location search.
    """
    from api.views import _nearest_lf_location, LF_LOCATION_COORDS
    from api.models import LF_VALID_LOCATION_KEYS

    for key, (lat, lng) in LF_LOCATION_COORDS.items():
        result = _nearest_lf_location(lat, lng)
        assert result == key, (
            f"BUG: Location '{key}' resolves to '{result}' when given its own coordinates. "
            f"Items reported at '{key}' will be permanently misfiled under '{result}'."
        )


# ---------------------------------------------------------------------------
# 5. TAG OVERFLOW / INJECTION — more than 15 tags or malformed input
#
# RISK: Tags are stored as JSON in a TextField.  If the 15-tag cap is not
# enforced, a user can submit 1,000 tags per item.  Multiplied across many
# items, this bloats the tags column and slows down every analytics query
# that iterates over tag lists.  Additionally, un-stripped or un-lowercased
# tags ('  Wallet  ', 'WALLET') create duplicates that pollute tag-frequency
# counts and break exact-match filtering in the suggestions system.
# ---------------------------------------------------------------------------

def test_tag_field_enforces_max_15_dedup_and_lowercase():
    """
    _TagsField must:
      - Accept lists, JSON strings, and CSV strings
      - Strip whitespace from each tag
      - Lowercase all tags
      - Deduplicate
      - Hard-cap at 15 tags
    Any failure here corrupts tag data and degrades search quality.
    """
    from api.serializers import _TagsField

    field = _TagsField()

    # Overflow: 20 tags submitted, only 15 stored
    overflow_result = field.to_internal_value([f"tag{i}" for i in range(20)])
    assert len(overflow_result) == 15, (
        f"BUG: {len(overflow_result)} tags stored instead of 15. "
        f"Tag overflow is possible — the column will grow unbounded."
    )

    # Deduplication: same tag in three casings = one entry
    dup_result = field.to_internal_value(["Wallet", "WALLET", "wallet"])
    assert dup_result == ["wallet"], (
        f"BUG: Duplicate tags not removed: {dup_result}. "
        f"Tag frequency counts and exact-match searches are corrupted."
    )

    # Whitespace and case: '  BLACK  ' must become 'black'
    clean_result = field.to_internal_value(["  BLACK  ", "  Leather  "])
    assert "black"   in clean_result, "BUG: Uppercase/whitespace tag was not normalised."
    assert "leather" in clean_result, "BUG: Uppercase/whitespace tag was not normalised."
    for tag in clean_result:
        assert tag == tag.strip().lower(), (
            f"BUG: Tag '{tag}' was not cleaned. Dirty tags break search matching."
        )
