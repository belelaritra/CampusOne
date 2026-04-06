"""
Management command: fetch_doctors
Fetches the daily doctor schedule from Google Sheets (CSV export),
parses it into structured JSON, and caches it in DoctorScheduleCache.

Column layout of the sheet:
  [0] S.NO / Category   [1] Doctor Name  [2] Room  [3] Timing  [4] (empty)
  [5] S.NO / Category   [6] Doctor Name  [7] Room  [8] Timing

Category header rows appear in col 0 (morning) and col 5 (afternoon).
Left block  (cols 0-3)  → Morning shift
Right block (cols 5-8)  → Afternoon shift
"""

import csv
import io
from datetime import datetime

import requests
from django.core.management.base import BaseCommand

from api.models import DoctorScheduleCache

SHEET_ID = '1VMtbKVJyeTvMJe_P69TzRtCdjHsj6i7xPuqImLznj_4'
CSV_URL  = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv'

CATEGORY_KEYS = [
    ('GENERAL OPD',          'general_opd',        'General OPD'),
    ('VISITING SPECIALIST',  'visiting_specialist', 'Visiting Specialist'),
    ("DR'S ON LEAVE",        'on_leave',            "Dr's on Leave"),
    ('DRS ON LEAVE',         'on_leave',            "Dr's on Leave"),
    ("DOCTOR'S ON LEAVE",    'on_leave',            "Dr's on Leave"),
]

SKIP_COL0 = ('S.NO', 'S NO', 'SNO', '')


def _clean(text):
    """Strip whitespace and embedded newlines/tabs."""
    return ' '.join(text.split())


def _clean_timing(text):
    """Preserve line breaks in timing; collapse spaces within each line."""
    lines = [' '.join(line.split()) for line in text.split('\n')]
    return '\n'.join(line for line in lines if line)


def _detect_category(text):
    """Return category_key if text is a category header, else None."""
    t = text.upper().strip()
    for keyword, key, _ in CATEGORY_KEYS:
        if keyword in t:
            return key
    return None


def _parse_entry(sno, name, room, timing):
    name = _clean(name)
    if not name:
        return None
    # Skip pure header values
    if name.upper() in ("DOCTOR'S NAME", 'DOCTORS NAME'):
        return None
    return {
        'sno':    _clean(sno),
        'name':   name,
        'room':   _clean(room),
        'timing': _clean_timing(timing),
    }


def _pad(row, length=9):
    while len(row) < length:
        row.append('')
    return row


class Command(BaseCommand):
    help = 'Fetch and cache the daily doctor OPD schedule from Google Sheets'

    def handle(self, *args, **kwargs):
        self.stdout.write('Fetching doctor schedule…')
        try:
            resp = requests.get(CSV_URL, timeout=30)
            resp.raise_for_status()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f'Fetch failed: {exc}'))
            return

        rows = list(csv.reader(io.StringIO(resp.text)))

        schedule = {
            'morning': {
                'main_opd':            [],
                'general_opd':         [],
                'visiting_specialist': [],
                'on_leave':            [],
            },
            'afternoon': {
                'main_opd':            [],
                'general_opd':         [],
                'visiting_specialist': [],
                'on_leave':            [],
            },
            'last_updated': datetime.now().isoformat(),
        }

        morning_cat   = 'main_opd'
        afternoon_cat = 'main_opd'

        for row in rows:
            _pad(row)

            col0 = _clean(row[0])
            col5 = _clean(row[5])

            # --- Detect category headers (appear in col 0 and col 5) ---
            lcat = _detect_category(col0)
            rcat = _detect_category(col5)

            if lcat:
                morning_cat = lcat
            if rcat:
                afternoon_cat = rcat

            if lcat or rcat:
                continue  # category header row — skip doctor parsing

            # --- Skip pure header / blank rows ---
            if col0.upper() in SKIP_COL0 or col0.upper() == 'S.NO':
                continue
            if not col0 and not _clean(row[1]) and not col5 and not _clean(row[6]):
                continue

            # Morning side (cols 0-3)
            doc_m = _parse_entry(row[0], row[1], row[2], row[3])
            if doc_m:
                schedule['morning'][morning_cat].append(doc_m)

            # Afternoon side (cols 5-8)
            doc_a = _parse_entry(row[5], row[6], row[7], row[8])
            if doc_a:
                schedule['afternoon'][afternoon_cat].append(doc_a)

        # Upsert the single cache row
        obj, _ = DoctorScheduleCache.objects.get_or_create(id=1)
        obj.data = schedule
        obj.save()

        total = (
            sum(len(v) for v in schedule['morning'].values()) +
            sum(len(v) for v in schedule['afternoon'].values())
        )
        self.stdout.write(self.style.SUCCESS(
            f'Cached {total} doctor entries at {schedule["last_updated"]}'
        ))
