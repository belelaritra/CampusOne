import os
import sys

from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        # In dev (`runserver`), Django starts two processes: the reloader and
        # the actual server. Only start the scheduler in the actual server
        # process (RUN_MAIN=true) or in production (where runserver is absent).
        is_dev_reloader = (
            'runserver' in sys.argv
            and os.environ.get('RUN_MAIN') != 'true'
        )
        if is_dev_reloader:
            return

        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            from apscheduler.triggers.cron import CronTrigger
            from django.core.management import call_command

            scheduler = BackgroundScheduler()
            scheduler.add_job(
                lambda: call_command('fetch_doctors'),
                CronTrigger(hour=0, minute=0),   # midnight every day
                id='fetch_doctors_daily',
                replace_existing=True,
                misfire_grace_time=3600,          # allow up to 1 h late
            )
            scheduler.start()
        except Exception as exc:
            import logging
            logging.getLogger(__name__).warning(f'APScheduler failed to start: {exc}')
