# CampusOne — Business Logic Flow Reference

> Generated from backend source: `api/models.py`, `api/views.py`, `api/serializers.py`
> Covers all constraints, access rules, state machines, and edge-case guards for 4 core modules.

---

## Table of Contents

1. [Help & Delivery](#1-help--delivery)
2. [Food Ordering](#2-food-ordering)
3. [Mess Module](#3-mess-module)
4. [Lost & Found](#4-lost--found)

---

## 1. Help & Delivery

### Roles

| Role      | Who                                             |
|-----------|-------------------------------------------------|
| Requester | Any authenticated user who creates a request    |
| Helper    | Any authenticated user who accepts a request    |
| Admin     | `is_staff=True` user only                       |

---

### Status Lifecycle

```
PENDING → ACCEPTED → COMPLETED
PENDING → EXPIRED  (auto, when to_time passes)
```

---

### Creation Rules

- Only authenticated users can create
- `from_time` accepts `HH:MM` format only — always combined with **today's local date** (cannot create for a future date)
- `to_time` is never submitted — always computed: `to_time = from_time + duration`
- If computed `to_time <= now()` at creation time → **rejected** (window already over)
- `contact_number` is never submitted by user — auto-populated from `user.phone_number` or `user.phone`
- `pickup_location` must be one of exactly **3 fixed values**: `gulmohar`, `main_gate`, `shree_balaji`
- `delivery_location` must be one of the valid campus keys (Hostels 1–21, Tansa House, KReSIT, SJMSOM, Lecture Hall, Conv Hall, Main Building, Central Library, SAC, Gymkhana)
- `duration` must be one of exactly **7 values**: `5, 10, 15, 30, 60, 90, 120` (minutes)

---

### Acceptance Rules

- Helper must send current GPS `latitude` + `longitude` — missing → **400**
- Cannot accept **your own request** → **400**
- If helper **already has an ACCEPTED request** (as helper on any other request) → cannot accept another until that one is completed → **409 Conflict**
- Request must be **PENDING** to accept — if ACCEPTED/COMPLETED/EXPIRED → **409**
- If `now() > to_time` at time of acceptance → auto-marks as EXPIRED, returns **410**
- Helper must be **within 200 metres** of the pickup location (haversine check against hardcoded GPS coordinates) → outside → **403**
- All of the above run inside a **database transaction with row lock** (`select_for_update`) to prevent race conditions

---

### Completion Rules

- **Only the requester** can mark complete — helper cannot, admin cannot → **403**
- Request must be in **ACCEPTED** state — PENDING / EXPIRED / COMPLETED → **400**
- On completion: helper gets **+1 point** using `F('points') + 1` (atomic, no stale-read race)
- Response includes fresh `helper_points` value

---

### Edit Rules

- **Only the requester** can edit → **403**
- **Only PENDING** requests can be edited — ACCEPTED / COMPLETED / EXPIRED → **400**
- Editable fields: `item_description`, `pickup_location`, `delivery_location`, `additional_info`, `from_time`, `duration`
- If `from_time` or `duration` changed → `to_time` is recomputed
- New computed `to_time` must still be in the future → **400** if not

---

### Delete Rules

- **Only the requester** can delete → **403**
- **Only PENDING** requests can be deleted → **400**

---

### Visibility Rules

- **Contact number** hidden from all browsing users — visible only to the requester themselves OR the accepted helper
- **List view** shows only PENDING requests
- **Mine view** (`/api/help/mine/`) shows PENDING + ACCEPTED where user is requester OR helper
- **History view** shows COMPLETED + EXPIRED where user is requester OR helper
- **Admin list** (`/api/help/admin_list/`) — `is_staff` only, sees all requests regardless of status
- Distance annotated only if `?lat=&lng=` provided in list request

---

### Auto-Expiry Rules

- On every **list** call → bulk-expires all PENDING requests whose `to_time` has passed
- On every **mine** call → bulk-expires all PENDING requests involving the current user that are overdue
- On **accept** call → if `to_time` has passed for that specific request → marked EXPIRED inline, returns 410
- Model has `check_and_expire()` and `is_expired()` methods but main expiry is triggered by views

---

### Sorting Rules (List View)

- If coordinates provided: requests within 200m of user sorted **first**, then by `to_time` ascending
- If no coordinates: no distance sorting, default ordering (`-created_at`)

---

## 2. Food Ordering

### Roles

| Role         | Who                                                                     |
|--------------|-------------------------------------------------------------------------|
| Customer     | Any authenticated user                                                  |
| Outlet Admin | User with `OutletAdmin` profile — one admin per outlet, one outlet per admin (OneToOne) |
| is_staff     | Can access master console but is **NOT** automatically an outlet admin  |

---

### Order Status Lifecycles

```
DELIVERY:  PENDING → ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED
TAKEAWAY:  PENDING → ACCEPTED → PREPARING → READY → TOOK
Both:      (any non-terminal) → CANCELLED
```

- Steps **cannot be skipped** — only one specific next status is allowed per current status
- **Cannot go backwards** → **400** if attempted
- `DELIVERED` and `TOOK` are terminal delivery/pickup statuses
- `CANCELLED` is a terminal cancel status

---

### Placing an Order Rules

- Only authenticated users can place
- Outlet must exist **AND** `is_active=True` — inactive outlet → **400**
- Every item must belong to **that specific outlet** — cross-outlet item → **400**
- Every item must have `is_available=True` at order time — unavailable item → **400**
- Minimum **1 item** required
- Per-item quantity: **min=1, max=5** (enforced at serializer level)
- For `DELIVERY` type: `delivery_location` is **required** → **400** if missing
- For `TAKEAWAY` type: `delivery_location` is silently ignored / cleared to empty
- **Price snapshotted** at order time — future price changes don't affect existing orders
- **User info snapshotted** at order time (name, phone, email) — immutable after creation
- Payment method is always `COD` — no other option exists
- Done in a **transaction with select_for_update** on outlet and menu items

---

### User Cancel Rules

- **Only the order owner** can cancel
- **Only PENDING** orders can be cancelled by the user — once outlet accepts, user cannot cancel → **400**

---

### Admin Order Management Rules

- Admin can **only see / manage orders from their own outlet** — cross-outlet → **404**
- **Accept**: only `PENDING → ACCEPTED` — other statuses → **400**
- **Admin Cancel**: blocked if order is `DELIVERED` or already `CANCELLED` → **400**; all other statuses can be cancelled
- **Status advance (PATCH)**: strictly enforced transitions — any skip or reverse → **400** with allowed next status listed in error

---

### Menu Management Rules (Outlet Admin only)

- Admin can only CRUD items **within their own outlet**
- `price` must be **positive (> 0)** → validation error
- No maximum price enforced
- Changing a menu item's price does **not affect** already-placed orders (price snapshotted)

---

### Review Rules

- Can only review a **DELIVERED** (delivery) or **TOOK** (takeaway) order → **400** otherwise
- **Cannot review the same order twice** (`order.reviewed = True` flag) → **400**
- Must submit ratings for **every item in the order** — submitted IDs must exactly match order item IDs → **400** if mismatch
- Rating: **min=1, max=5**
- DB-level `unique_together (user, order, food_item)` prevents duplicate submissions at database level
- After successful review: `avg_rating` and `review_count` on each `MenuItem` recalculated atomically
- `order.reviewed = True` set after review completes

---

### Pending vs History Separation

| View                        | What is included                                                           |
|-----------------------------|---------------------------------------------------------------------------|
| Pending (`/orders/pending/`) | Active orders (any status) + terminal (DELIVERED/TOOK) **not yet reviewed** |
| History (`/orders/history/`) | (DELIVERED or TOOK + `reviewed=True`) OR CANCELLED                       |
| Tracking (`/orders/{pk}/`)   | Only the order owner's own order                                          |

---

### Analytics Rules (Outlet Admin only)

- All analytics scoped to the admin's **own outlet only**
- **Active statuses** counted in analytics: `ACCEPTED, PREPARING, OUT_FOR_DELIVERY, READY, DELIVERED, TOOK` — PENDING and CANCELLED are **excluded**
- Hostel-wise: delivery orders only (TAKEAWAY has no delivery_location)
- Daily sales: last **30 days** only

---

## 3. Mess Module

### Roles

| Role       | Who                                                              |
|------------|------------------------------------------------------------------|
| Student    | Any authenticated user                                           |
| Mess Admin | User with `MessAdminProfile` linked to exactly **one hostel**   |
| Staff      | `is_staff=True` — treated as mess admin for **all** hostels     |

---

### Settings Rules

- One settings record per hostel (unique constraint)
- **Auto-created with defaults** if no record exists — never returns 404 for a valid hostel
- Only mess admin or staff can **update** settings → **403** for others
- A mess admin can only update settings for **their own hostel** → **403** for other hostels
- Staff can update any hostel's settings
- Default values:

| Field                       | Default |
|-----------------------------|---------|
| `monthly_sma`               | 27,000  |
| `breakfast_deduction`       | 35      |
| `lunch_deduction`           | 40      |
| `snacks_deduction`          | 35      |
| `dinner_deduction`          | 40      |
| `guest_breakfast_price`     | 50      |
| `guest_lunch_price`         | 65      |
| `guest_snacks_price`        | 50      |
| `guest_dinner_price`        | 65      |
| `guest_slot_daily_limit`    | 50      |
| `guest_student_slot_limit`  | 10      |

---

### Daily Menu Rules

- One record per `(hostel, date, meal_type)` — unique_together
- 4 slots per day: BREAKFAST, LUNCH, SNACKS, DINNER (fixed order, always returned)
- Any authenticated user can **read** menu for any hostel
- Only mess admin or staff can **post / update** menu → **403** otherwise
- A mess admin can only post for **their own hostel** → **403** for other hostels
- GET always returns **all 4 slots** — if a slot has no data, returns an empty stub (not 404)
- POST is an **upsert** — if that hostel/date/meal combo exists, it is overwritten
- `hostel` and `date` parameters default to the requesting user's hostel and today's date if not provided
- `meal_type` must be one of the 4 valid keys → **400** if invalid

---

### Guest Coupon Rules

- Any student can purchase coupons
- Hostel must be a valid mess hostel key → **400**
- Meal type must be BREAKFAST, LUNCH, SNACKS, or DINNER → **400**
- Quantity: **min=1** (no explicit max — controlled by limits below)
- **Per-student limit**: `student_existing + requested_qty` cannot exceed `guest_student_slot_limit` (default 10) for that hostel/date/meal slot → **error with current count shown**
- **Slot total limit**: `all_students_existing + requested_qty` cannot exceed `guest_slot_daily_limit` (default 50) for that hostel/date/meal slot → **error with remaining count shown**
- Both limits enforced atomically before creation
- Price comes from `MessHostelSettings.guest_price(meal_type)` for the target hostel
- User snapshot (roll_number, room_number, hostel_number) captured at purchase time — immutable
- **Admin view**: scoped to their hostel; filterable by `date` or `hostel`
- **Student view**: only own purchases; filterable by `month` + `year`

---

### SMA (Semester Mess Account) Balance Rules

- Any authenticated student can view **their own** balance
- Mess admin or staff can view **any student's** balance via `?user_id=`
- **Two semesters per year**:
  - Spring: Jan 1 – Jun 30
  - Autumn: Jul 1 – Dec 31
- `semester_sma` = value stored in `MessHostelSettings.monthly_sma` (despite the field name, it stores the semester total)
- `daily_rate` = sum of all 4 meal deductions (breakfast + lunch + snacks + dinner)
- Fallback if no settings configured: `semester_sma = 27,000`, `daily_rate = 150`

**Formula:**
```
balance = semester_sma
        - total_daily_deductions   (daily_rate × elapsed days, skipping approved rebate days)
        - guest_coupon_extras       (sum of all coupon purchases in semester)
```

- `calc_end = min(today, semester_end)` — only calculates up to today, not into the future
- Approved rebate days are **excluded** from daily deduction calculation
- Balance **can be negative** — shown with `balance_negative: true` flag

---

### Rebate Request Rules

- Any student can submit a rebate request
- `hostel` is **auto-set** from `user.hostel` — student cannot specify a different hostel
- `start_date` must be ≤ `end_date` → **400**
- **Minimum**: 1 day
- **Maximum**: 15 days per rebate request → **400** if exceeded
- `days` field always computed: `(end_date - start_date).days + 1` — never submitted by user
- Only mess admin of **that student's hostel** can approve or reject → **403** for other hostels
- Only **PENDING** rebates can be reviewed — re-reviewing APPROVED or REJECTED → **400**
- Review stores: `status` (APPROVED/REJECTED), `admin_note`, `reviewed_by`, `reviewed_at`
- **Hostel format mismatch handling**: `User.hostel` may be stored as `'H14'` or `'hostel_14'` — code normalizes both formats before comparing to prevent mismatches
- Student sees only their own rebates; admin sees all rebates for their hostel

---

## 4. Lost & Found

### Roles

| Role       | Who                                                        |
|------------|------------------------------------------------------------|
| Reporter   | The authenticated user who posted the item                 |
| Interactor | A different authenticated user who claims/found the item   |
| Security   | `is_security=True` OR `is_staff=True`                      |
| Any user   | Any authenticated user (read access)                       |

---

### Item Status Lifecycle

```
AVAILABLE → (interact) → PENDING → (resolve) → RESOLVED
AVAILABLE ← (revert)  ← PENDING
```

---

### Posting Rules

- Any authenticated user can post a LOST or FOUND item
- `item_type` must be `LOST` or `FOUND`
- `location_name` must be empty **OR** one of the predefined campus location keys — free-text is rejected → **400**
- **GPS path**: if `location_name` is empty but `latitude` + `longitude` are provided → auto-resolves to the nearest campus location using haversine against all predefined coordinates
- `tags`: accepts list, JSON string, or comma-separated string; max **15 tags**, deduplicated, all lowercased
- **ID card rule**: if `item_type=FOUND` AND category name contains `'id'` → `id_card_number` (roll number on card) is **required** → **400** otherwise
- `contact_type` (who holds the item): LOST items always forced to `ME`; FOUND items can be `ME` or `SECURITY`
- On FOUND item posted: auto-notifies reporters of open LOST items that match by tags / category / title words (score > 0)
- On FOUND item with `id_card_number`: directly notifies the user whose `roll_number` matches, if found in DB
- Log entry `action='POSTED'` always created on posting

---

### Edit Rules

- **Only the reporter** can edit → **403**
- **Only AVAILABLE** items can be edited — PENDING or RESOLVED → **400**
- GPS auto-resolution applies on edit too (same logic as creation)
- Log entry `action='EDITED'` always created

---

### Delete Rules

- **Only the reporter** can delete → **403**
- **Only AVAILABLE** items can be deleted — PENDING or RESOLVED → **400**

---

### Interact Rules (Claim / "I Found It")

- **Reporter cannot interact with their own item** → **400**
- Item must be **AVAILABLE** — checked **twice**: before and inside transaction
- Inside a **transaction with select_for_update**: re-checks availability to prevent race conditions
- **DB UniqueConstraint**: only ONE PENDING claim per item at any time
- If two users interact simultaneously → second gets **409 Conflict** (IntegrityError caught and handled)
- On interact: item status `AVAILABLE → PENDING`
- Notifies the reporter via `LFNotification`
- Log entry `action='INTERACTED'` created

---

### Resolve Rules

- Item must be in **PENDING** state → **400** otherwise
- **If `contact_type = 'SECURITY'`**: ONLY security staff can resolve — even the reporter cannot → **403**
- **Otherwise**: reporter OR security can resolve
- On resolve: pending `LFClaim → RESOLVED`; item status `PENDING → RESOLVED`
- Notifies the interactor (claimant)
- Log entry `action='RESOLVED'` created

---

### Revert Rules

- Item must be in **PENDING** state → **400**
- Only the **reporter OR security** can revert
- On revert: pending `LFClaim → CANCELLED`; item status `PENDING → AVAILABLE` (back to board)
- Notifies the interactor that the interaction was cancelled
- Log entry `action='REVERTED'` created

---

### Contact Visibility Rules

| Viewer                            | Reporter Phone | Interactor Phone |
|-----------------------------------|---------------|-----------------|
| Reporter (on their own item)      | Yes           | Yes (on PENDING)|
| Active Interactor (on PENDING item) | Yes         | Yes (their own) |
| Security                          | Yes           | Yes             |
| Any other user                    | No            | No              |

- `active_interaction` field only populated when item is **PENDING**
- `resolved_interaction` field only populated when item is **RESOLVED** (shows interactor name + resolved_at, no phone)

---

### Pending Items View

| User         | What they see                                                     |
|--------------|------------------------------------------------------------------|
| Security     | ALL PENDING items across the entire system                        |
| Regular user | Only PENDING items where they are reporter OR active interactor  |

---

### History Items View

| User         | What they see                                                            |
|--------------|-------------------------------------------------------------------------|
| Security     | ALL RESOLVED items across the entire system                              |
| Regular user | RESOLVED items where they were reporter OR had any claim (any status)   |

---

### Suggestions Rules

- Returns opposite-type AVAILABLE items (LOST item → suggests FOUND matches; FOUND item → suggests LOST matches)
- Scoring per candidate:
  - **+5** for same category
  - **+3** per shared tag
  - **+2** per shared title word
- Only candidates with **score > 0** returned
- Maximum **10** suggestions returned (top-scored)
- Excludes the item itself

---

### Notification Rules

- Max **60 notifications** returned per user in a single call (hard limit, no pagination)
- Can mark individual notification as read
- Can bulk-mark all notifications as read
- Notifications are user-scoped — no user sees another user's notifications

---

### Analytics Access Rules

| Analytics Endpoint                  | Who can access              |
|-------------------------------------|-----------------------------|
| General (type counts, status counts, top categories, top locations, top tags) | Any authenticated user |
| Top lost locations (where items are lost most) | Security only (`is_security` or `is_staff`) |
| Top lost categories                 | Security only               |

---

### Tags Rules

- `top_tags` endpoint returns top **20** tags by frequency from **AVAILABLE items only**
- LF categories show an `item_count` that counts only **AVAILABLE** items in that category
