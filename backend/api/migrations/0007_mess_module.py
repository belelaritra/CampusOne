"""
Migration: Mess Module
- Add User.hostel, User.room_number
- Add MessHostelSettings, MessAdminProfile, DailyMenu,
  GuestCouponPurchase, RebateRequest tables
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_lf_redesign'),
    ]

    operations = [
        # ── User new fields ──────────────────────────────────────────────────
        migrations.AddField(
            model_name='user',
            name='hostel',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AddField(
            model_name='user',
            name='room_number',
            field=models.CharField(blank=True, max_length=20),
        ),

        # ── MessHostelSettings ───────────────────────────────────────────────
        migrations.CreateModel(
            name='MessHostelSettings',
            fields=[
                ('id',                    models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hostel',                models.CharField(max_length=30, unique=True)),
                ('monthly_sma',           models.DecimalField(decimal_places=2, default=27000, max_digits=10)),
                ('breakfast_deduction',   models.DecimalField(decimal_places=2, default=35, max_digits=6)),
                ('lunch_deduction',       models.DecimalField(decimal_places=2, default=40, max_digits=6)),
                ('snacks_deduction',      models.DecimalField(decimal_places=2, default=35, max_digits=6)),
                ('dinner_deduction',      models.DecimalField(decimal_places=2, default=40, max_digits=6)),
                ('guest_breakfast_price', models.DecimalField(decimal_places=2, default=50, max_digits=6)),
                ('guest_lunch_price',     models.DecimalField(decimal_places=2, default=65, max_digits=6)),
                ('guest_snacks_price',    models.DecimalField(decimal_places=2, default=50, max_digits=6)),
                ('guest_dinner_price',    models.DecimalField(decimal_places=2, default=65, max_digits=6)),
                ('guest_slot_daily_limit',   models.PositiveIntegerField(default=50)),
                ('guest_student_slot_limit', models.PositiveIntegerField(default=10)),
                ('updated_at',            models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Mess Hostel Settings',
                'verbose_name_plural': 'Mess Hostel Settings',
            },
        ),

        # ── MessAdminProfile ─────────────────────────────────────────────────
        migrations.CreateModel(
            name='MessAdminProfile',
            fields=[
                ('id',     models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hostel', models.CharField(max_length=30)),
                ('user',   models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='mess_admin_profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'verbose_name': 'Mess Admin Profile'},
        ),

        # ── DailyMenu ────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='DailyMenu',
            fields=[
                ('id',        models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hostel',    models.CharField(db_index=True, max_length=30)),
                ('date',      models.DateField(db_index=True)),
                ('meal_type', models.CharField(max_length=10)),
                ('items',     models.TextField(blank=True, default='')),
                ('updated_at',models.DateTimeField(auto_now=True)),
                ('updated_by',models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='mess_menu_updates',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['date', 'meal_type']},
        ),
        migrations.AlterUniqueTogether(
            name='dailymenu',
            unique_together={('hostel', 'date', 'meal_type')},
        ),

        # ── GuestCouponPurchase ──────────────────────────────────────────────
        migrations.CreateModel(
            name='GuestCouponPurchase',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hostel',        models.CharField(max_length=30)),
                ('date',          models.DateField(db_index=True)),
                ('meal_type',     models.CharField(max_length=10)),
                ('quantity',      models.PositiveIntegerField()),
                ('unit_price',    models.DecimalField(decimal_places=2, max_digits=6)),
                ('total_amount',  models.DecimalField(decimal_places=2, max_digits=8)),
                ('roll_number',   models.CharField(blank=True, max_length=20)),
                ('room_number',   models.CharField(blank=True, max_length=20)),
                ('hostel_number', models.CharField(blank=True, max_length=30)),
                ('purchased_at',  models.DateTimeField(auto_now_add=True)),
                ('student',       models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='guest_coupon_purchases',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-purchased_at']},
        ),

        # ── RebateRequest ────────────────────────────────────────────────────
        migrations.CreateModel(
            name='RebateRequest',
            fields=[
                ('id',          models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hostel',      models.CharField(max_length=30)),
                ('start_date',  models.DateField()),
                ('end_date',    models.DateField()),
                ('days',        models.PositiveIntegerField()),
                ('reason',      models.TextField(blank=True, default='')),
                ('status',      models.CharField(
                    db_index=True,
                    choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')],
                    default='PENDING', max_length=10,
                )),
                ('admin_note',  models.TextField(blank=True, default='')),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('reviewed_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_rebates',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('student',     models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='rebate_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
