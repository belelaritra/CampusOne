# CampusOne — Unit Test Suite

Pure Python unit tests for all four core modules and the Keycloak auth pipeline.
No database is created or used — all tests run with mocks and unsaved model instances.

---

## Folder Structure

```
tests/
├── conftest.py             ← pytest hooks, per-module log file writer
├── logs/                   ← auto-created; one .log per module + all_tests.log
│
├── help_delivery/
│   └── test_help_unit.py   ← haversine, expiry, to_time, contact visibility
├── food_ordering/
│   └── test_food_unit.py   ← status transitions, PlaceOrder validation, price guard
├── mess_module/
│   └── test_mess_unit.py   ← hostel normalisation, semester logic, SMA formula
├── lost_found/
│   └── test_lf_unit.py     ← scoring, tag normalisation, GPS resolver, visibility
└── auth/
    └── test_keycloak_unit.py  ← JWT decode, azp guard, role extraction, JWKS singleton
```

---

## Prerequisites

Activate the backend virtual environment and install test dependencies:

```bash
cd CampusOne/backend
source venv/bin/activate          # Windows: venv\Scripts\activate

pip install pytest pytest-django
```

The test suite has **no additional dependencies** beyond what is already in
`requirements.txt`.

---

## Environment Setup

The tests need Django to be configured, but they never touch the database.
Copy the example env file if you haven't already:

```bash
cp .env.example .env
```

The values in `.env` do not need to be real — the tests mock all external
calls (Keycloak JWKS, JWT decode).  You just need the file to exist so
Django's settings module loads without errors.

---

## Running the Tests

### Run the entire suite

```bash
cd CampusOne/backend
pytest
```

### Run a single module

```bash
pytest tests/help_delivery/
pytest tests/food_ordering/
pytest tests/mess_module/
pytest tests/lost_found/
pytest tests/auth/
```

### Run a single test class or test

```bash
pytest tests/help_delivery/test_help_unit.py::TestHaversine
pytest tests/help_delivery/test_help_unit.py::TestHaversine::test_same_point_returns_zero
```

### Run with keyword filter

```bash
pytest -k "expiry"        # all tests whose name contains 'expiry'
pytest -k "semester or sma"
```

### Stop on first failure

```bash
pytest -x
```

### Show print output during tests

```bash
pytest -s
```

---

## Log Files

Every test run writes to `tests/logs/`.  The directory is created automatically.

| File | Contents |
|------|----------|
| `logs/all_tests.log` | Every test result (PASSED / FAILED + traceback) |
| `logs/help_delivery.log` | Results for the Help & Delivery module only |
| `logs/food_ordering.log` | Results for the Food Ordering module only |
| `logs/mess_module.log` | Results for the Mess Module only |
| `logs/lost_found.log` | Results for the Lost & Found module only |
| `logs/auth.log` | Results for the Keycloak Auth module only |

Each file is **appended** on every run with a timestamp header.
To start fresh, delete the `logs/` folder — it will be recreated automatically.

---

## What Each Module Tests

### Help & Delivery (`test_help_unit.py`)

| Class | What it guards |
|-------|---------------|
| `TestHaversine` | Proximity formula correctness — wrong math = anyone can accept from 5 km |
| `TestHelpRequestExpiry` | `is_expired()` and `check_and_expire()` — stale requests accepted if broken |
| `TestToTimeComputation` | Window computation and rejection of past windows |
| `TestContactNumberVisibility` | PII leak prevention — phone shown only to requester/helper |
| `TestContactAutoPopulate` | Auto-fill from `phone_number` with fallback to `phone` |

### Food Ordering (`test_food_unit.py`)

| Class | What it guards |
|-------|---------------|
| `TestFoodActiveStatuses` | Analytics exclusion of PENDING/CANCELLED — revenue integrity |
| `TestOrderStatusTransitions` | Strict one-step machine — no skipping, no reversal |
| `TestPlaceOrderSerializer` | Delivery needs location; TAKEAWAY doesn't; quantity 1–5 |
| `TestMenuItemPriceValidation` | Price > 0 — zero/negative prices corrupt totals |
| `TestMenuItemImageEffective` | Image fallback chain — frontend never receives None |

### Mess Module (`test_mess_unit.py`)

| Class | What it guards |
|-------|---------------|
| `TestNormalizeToMessKey` | `H14` ↔ `hostel_14` — mismatch causes 403 for every mess admin |
| `TestMessKeyToProfile` | Reverse normalisation — needed for rebate hostel matching |
| `TestCurrentSemester` | Spring/Autumn boundary — off-by-one doubles or zeroes every balance |
| `TestMessHostelSettings` | `daily_total` and `guest_price()` — drive every balance calculation |
| `TestSMABalanceFormula` | Formula correctness with rebates and guest coupons |
| `TestRebateRequestDayCount` | Max 15-day rule and inclusive day count |

### Lost & Found (`test_lf_unit.py`)

| Class | What it guards |
|-------|---------------|
| `TestLFSuggestionScore` | Scoring weights — wrong values = notifications never fire |
| `TestTagsField` | Normalisation: lowercase, dedup, max 15, all input formats |
| `TestNearestLFLocation` | GPS resolver — wrong formula misfiled items |
| `TestLFValidLocationKeys` | Campus key set — missing key = valid inputs rejected |
| `TestIDCardRule` | ID card requirement logic and `contact_type` forced to ME |
| `TestReporterPhoneVisibility` | Phone PII shown only to reporter/active interactor |

### Auth / Keycloak (`test_keycloak_unit.py`)

| Class | What it guards |
|-------|---------------|
| `TestAuthenticateHeaderParsing` | Non-Bearer credentials return None cleanly |
| `TestDecodeToken` | Expired/invalid/foreign-app tokens raise `AuthenticationFailed` |
| `TestRoleExtraction` | `campus-staff` / `campus-security` role → flag sync |
| `TestUserClaimExtraction` | Token claim mapping — wrong keys = blank user profiles |
| `TestJWKSClientSingleton` | One JWKS client created; URL includes realm and host |

---

## Interpreting Failures

A failing test name tells you exactly what broke:

```
FAILED tests/help_delivery/test_help_unit.py::TestHaversine::test_known_distance_main_gate_to_gulmohar
```

This means the haversine distance between main_gate and gulmohar is outside
the expected 300–600 m range.  Either the coordinates in `PICKUP_COORDS` were
changed, or the haversine formula was modified incorrectly.

```
FAILED tests/mess_module/test_mess_unit.py::TestCurrentSemester::test_july_1_is_autumn
```

This means July 1 is being classified as Spring instead of Autumn — a classic
off-by-one that would miscalculate every student's SMA balance for the second
semester.

---

## CI Integration (GitHub Actions)

Add this step to `.github/workflows/test.yml`:

```yaml
- name: Run unit tests
  working-directory: CampusOne/backend
  run: |
    source venv/bin/activate
    pytest tests/ --tb=short -q
```

Fail the build if any test fails (default pytest behaviour — exit code 1).
