"""
conftest.py — pytest configuration for CampusOne unit tests.

- Configures Django settings for all tests.
- Creates per-module log files in tests/logs/ on every run.
- Writes a summary line (PASSED/FAILED + node id) for each test.
- For failures, appends the short traceback so you can open the log and
  know exactly what broke without re-running the suite.
"""

import logging
import os
from datetime import datetime
from pathlib import Path

import pytest

# ── Paths ──────────────────────────────────────────────────────────────────
TESTS_ROOT = Path(__file__).parent
LOGS_DIR   = TESTS_ROOT / "logs"


# ── Session-level setup ────────────────────────────────────────────────────

def pytest_configure(config):
    """Create the logs directory before the first test runs."""
    LOGS_DIR.mkdir(exist_ok=True)


def pytest_sessionstart(session):
    """Stamp each per-module log with the run timestamp so logs are not merged across runs."""
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"\n{'='*60}\nTest run started: {stamp}\n{'='*60}\n"

    # Write the header to the global log only; per-module logs get it on first write.
    global_log = LOGS_DIR / "all_tests.log"
    with open(global_log, "a", encoding="utf-8") as f:
        f.write(header)


# ── Per-test log writing ───────────────────────────────────────────────────

def _module_folder_from_nodeid(nodeid: str) -> str:
    """
    Extract the sub-folder name from a node id like:
      tests/help_delivery/test_help_unit.py::TestHaversine::test_foo
    Returns 'help_delivery'.  Falls back to 'general' for top-level tests.
    """
    parts = nodeid.replace("\\", "/").split("/")
    # parts[0] = 'tests', parts[1] = module folder, parts[2] = file::test
    if len(parts) >= 3:
        return parts[1]
    return "general"


def _write_log(log_path: Path, line: str):
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def pytest_runtest_logreport(report):
    """
    Called after each test phase (setup / call / teardown).
    We only care about the 'call' phase (the test body itself).
    """
    if report.when != "call":
        return

    module_folder = _module_folder_from_nodeid(report.nodeid)
    module_log    = LOGS_DIR / f"{module_folder}.log"
    global_log    = LOGS_DIR / "all_tests.log"

    if report.passed:
        status = "PASSED"
    elif report.failed:
        status = "FAILED"
    else:
        status = "ERROR"

    line = f"[{status}] {report.nodeid}"

    # Append failure details (truncated to keep logs readable)
    if not report.passed:
        repr_text = str(report.longrepr)
        # Keep first 500 chars of the traceback
        truncated = repr_text[:500].replace("\n", "\n         ")
        line += f"\n    >> {truncated}"
        if len(repr_text) > 500:
            line += "\n    >> ... (truncated)"

    _write_log(module_log, line)
    _write_log(global_log, line)


def pytest_sessionfinish(session, exitstatus):
    """Write a short summary at the end of each log file."""
    passed  = session.testscollected - getattr(session, '_failed', 0)
    summary = (
        f"\n{'─'*60}\n"
        f"Session finished | exit={exitstatus} | "
        f"collected={session.testscollected}\n"
        f"{'─'*60}\n"
    )
    global_log = LOGS_DIR / "all_tests.log"
    if global_log.exists():
        with open(global_log, "a", encoding="utf-8") as f:
            f.write(summary)
