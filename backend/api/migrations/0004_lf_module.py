"""
Migration 0004: Lost & Found module
Depends on 0003_food_ordering_v2 (the real leaf before this).

User fields (full_name, phone_number, roll_number) and HelpRequest.duration
are already in 0001_initial — no need to add them here.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_lf_categories(apps, schema_editor):
    LFCategory = apps.get_model('api', 'LFCategory')
    categories = [
        ('Electronics',  '💻'),
        ('College ID',   '🪪'),
        ('Stationery',   '✏️'),
        ('Wallet',       '👛'),
        ('Documents',    '📄'),
        ('Keys',         '🔑'),
        ('Clothing',     '👕'),
        ('Bags',         '🎒'),
        ('Books',        '📚'),
        ('Headphones',   '🎧'),
        ('Water Bottle', '🍶'),
        ('Other',        '📦'),
    ]
    for name, icon in categories:
        LFCategory.objects.get_or_create(name=name, defaults={'icon': icon})


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('api', '0003_food_ordering_v2'),
    ]

    operations = [
        # ── LFCategory ───────────────────────────────────────────────────────
        migrations.CreateModel(
            name='LFCategory',
            fields=[
                ('id',   models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=50, unique=True)),
                ('icon', models.CharField(default='📦', max_length=10)),
            ],
            options={
                'verbose_name': 'LF Category',
                'verbose_name_plural': 'LF Categories',
                'ordering': ['name'],
            },
        ),

        # ── LFItem ────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='LFItem',
            fields=[
                ('id',            models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('item_type',     models.CharField(
                    choices=[('LOST', 'Lost'), ('FOUND', 'Found')],
                    db_index=True, max_length=10,
                )),
                ('status',        models.CharField(
                    choices=[
                        ('PENDING',     'Pending'),
                        ('CLAIMED',     'Claimed'),
                        ('HANDED_OVER', 'Handed Over'),
                        ('CLOSED',      'Closed'),
                    ],
                    db_index=True, default='PENDING', max_length=15,
                )),
                ('title',         models.CharField(max_length=200)),
                ('description',   models.TextField(blank=True, default='')),
                ('tags',          models.JSONField(default=list)),
                ('image',         models.ImageField(blank=True, null=True, upload_to='lf_items/')),
                ('image_url',     models.CharField(blank=True, default='', max_length=500)),
                ('location_name', models.CharField(blank=True, default='', max_length=150)),
                ('latitude',      models.FloatField(blank=True, null=True)),
                ('longitude',     models.FloatField(blank=True, null=True)),
                ('contact_type',  models.CharField(
                    choices=[('ME', 'Direct (my contact)'), ('SECURITY', 'Security Office')],
                    default='ME', max_length=15,
                )),
                ('roll_number',   models.CharField(blank=True, default='', max_length=20)),
                ('date_reported', models.DateTimeField(auto_now_add=True)),
                ('reporter', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lf_items',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('category', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='items',
                    to='api.lfcategory',
                )),
            ],
            options={'ordering': ['-date_reported']},
        ),
        migrations.AddIndex(
            model_name='lfitem',
            index=models.Index(fields=['item_type', 'status'], name='lf_item_type_status_idx'),
        ),

        # ── LFClaim ──────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='LFClaim',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('message',    models.TextField(blank=True, default='')),
                ('status',     models.CharField(
                    choices=[('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('REJECTED', 'Rejected')],
                    default='PENDING', max_length=10,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('item', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='claims',
                    to='api.lfitem',
                )),
                ('claimant', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lf_claims',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddConstraint(
            model_name='lfclaim',
            constraint=models.UniqueConstraint(fields=['item', 'claimant'], name='unique_lf_claim'),
        ),

        # ── LFNotification ───────────────────────────────────────────────────
        migrations.CreateModel(
            name='LFNotification',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('message',    models.TextField()),
                ('is_read',    models.BooleanField(db_index=True, default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='lf_notifications',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('item', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='notifications',
                    to='api.lfitem',
                )),
            ],
            options={'ordering': ['-created_at']},
        ),

        # ── LFLog ────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name='LFLog',
            fields=[
                ('id',         models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ('action',     models.CharField(max_length=30)),
                ('detail',     models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('item', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='logs',
                    to='api.lfitem',
                )),
                ('actor', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='lf_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),

        # ── Seed categories ───────────────────────────────────────────────────
        migrations.RunPython(seed_lf_categories, migrations.RunPython.noop),
    ]
