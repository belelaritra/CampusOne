"""
Management command to create a security office user account.

Usage:
    python manage.py create_security_user \
        --username security_office \
        --password <password> \
        --email security@campus.edu \
        --full-name "Security Office" \
        --phone 9999999999

A security user can:
  - Access all L&F items and history
  - Mark handover (resolve) on SECURITY-contact items
  - Access the analytics dashboard (top lost locations)
"""
from django.core.management.base import BaseCommand, CommandError
from api.models import User


class Command(BaseCommand):
    help = 'Create a Lost & Found security office user'

    def add_arguments(self, parser):
        parser.add_argument('--username',  required=True,  help='Login username')
        parser.add_argument('--password',  required=True,  help='Login password')
        parser.add_argument('--email',     default='',     help='Email address (optional)')
        parser.add_argument('--full-name', default='Security Office', help='Display name')
        parser.add_argument('--phone',     default='',     help='Phone number (optional)')

    def handle(self, *args, **options):
        username = options['username']
        if User.objects.filter(username=username).exists():
            raise CommandError(f"User '{username}' already exists.")

        user = User.objects.create_user(
            username=username,
            password=options['password'],
            email=options['email'],
            full_name=options['full_name'],
            phone_number=options['phone'],
            is_security=True,
        )
        self.stdout.write(self.style.SUCCESS(
            f"✅ Security user '{user.username}' created (id={user.pk}).\n"
            f"   is_security=True  |  is_staff=False\n"
            f"   Log in at /api/auth/login/ with username + password."
        ))
