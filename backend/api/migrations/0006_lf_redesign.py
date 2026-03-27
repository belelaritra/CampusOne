"""
Migration: LF module redesign
- Add User.is_security
- Rename LFItem statuses: PENDING→AVAILABLE, CLAIMED→PENDING, CLOSED/HANDED_OVER→RESOLVED
- Update LFClaim statuses: APPROVED→RESOLVED, REJECTED→CANCELLED
- Replace unique_together on LFClaim with a partial UniqueConstraint (one PENDING per item)
"""
from django.db import migrations, models


def migrate_item_statuses(apps, schema_editor):
    LFItem = apps.get_model('api', 'LFItem')
    # Old PENDING (publicly listed) → new AVAILABLE
    LFItem.objects.filter(status='PENDING').update(status='AVAILABLE')
    # Old CLAIMED (interaction in progress) → new PENDING
    LFItem.objects.filter(status='CLAIMED').update(status='PENDING')
    # Old CLOSED / HANDED_OVER → new RESOLVED
    LFItem.objects.filter(status__in=['CLOSED', 'HANDED_OVER']).update(status='RESOLVED')


def migrate_claim_statuses(apps, schema_editor):
    LFClaim = apps.get_model('api', 'LFClaim')
    LFClaim.objects.filter(status='APPROVED').update(status='RESOLVED')
    LFClaim.objects.filter(status='REJECTED').update(status='CANCELLED')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_lf_fixup'),
    ]

    operations = [
        # 1. Add is_security to User
        migrations.AddField(
            model_name='user',
            name='is_security',
            field=models.BooleanField(default=False),
        ),

        # 2. Widen LFItem.status to accept all old + new values during transition
        migrations.AlterField(
            model_name='lfitem',
            name='status',
            field=models.CharField(
                max_length=15,
                choices=[
                    ('AVAILABLE',   'Available'),
                    ('PENDING',     'Pending'),
                    ('RESOLVED',    'Resolved'),
                    ('CLAIMED',     'Claimed (legacy)'),
                    ('HANDED_OVER', 'Handed Over (legacy)'),
                    ('CLOSED',      'Closed (legacy)'),
                ],
                default='AVAILABLE',
                db_index=True,
            ),
        ),

        # 3. Data-migrate item statuses
        migrations.RunPython(migrate_item_statuses, migrations.RunPython.noop),

        # 4. Settle on final LFItem status choices
        migrations.AlterField(
            model_name='lfitem',
            name='status',
            field=models.CharField(
                max_length=15,
                choices=[
                    ('AVAILABLE', 'Available'),
                    ('PENDING',   'Pending'),
                    ('RESOLVED',  'Resolved'),
                ],
                default='AVAILABLE',
                db_index=True,
            ),
        ),

        # 5. Widen LFClaim.status to accept all old + new values
        migrations.AlterField(
            model_name='lfclaim',
            name='status',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('PENDING',   'Pending'),
                    ('RESOLVED',  'Resolved'),
                    ('CANCELLED', 'Cancelled'),
                    ('APPROVED',  'Approved (legacy)'),
                    ('REJECTED',  'Rejected (legacy)'),
                ],
                default='PENDING',
            ),
        ),

        # 6. Data-migrate claim statuses
        migrations.RunPython(migrate_claim_statuses, migrations.RunPython.noop),

        # 7. Remove old unique_together constraint
        migrations.AlterUniqueTogether(
            name='lfclaim',
            unique_together=set(),
        ),

        # 8. Add partial unique constraint: only one PENDING interaction per item
        migrations.AddConstraint(
            model_name='lfclaim',
            constraint=models.UniqueConstraint(
                fields=['item'],
                condition=models.Q(status='PENDING'),
                name='lf_unique_pending_per_item',
            ),
        ),

        # 9. Settle on final LFClaim status choices
        migrations.AlterField(
            model_name='lfclaim',
            name='status',
            field=models.CharField(
                max_length=10,
                choices=[
                    ('PENDING',   'Pending'),
                    ('RESOLVED',  'Resolved'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='PENDING',
            ),
        ),
    ]
