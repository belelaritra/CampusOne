from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        # ── User profile fields ──────────────────────────────────────────────
        migrations.AddField(
            model_name='user',
            name='full_name',
            field=models.CharField(blank=True, max_length=150),
        ),
        migrations.AddField(
            model_name='user',
            name='phone_number',
            field=models.CharField(blank=True, max_length=15),
        ),
        migrations.AddField(
            model_name='user',
            name='roll_number',
            field=models.CharField(blank=True, max_length=20),
        ),

        # ── HelpRequest: duration + relax contact_number ─────────────────────
        migrations.AddField(
            model_name='helprequest',
            name='duration',
            field=models.PositiveIntegerField(
                choices=[
                    (5,   '5 minutes'),
                    (10,  '10 minutes'),
                    (15,  '15 minutes'),
                    (30,  '30 minutes'),
                    (60,  '1 hour'),
                    (90,  '1.5 hours'),
                    (120, '2 hours'),
                ],
                default=30,
            ),
        ),
        migrations.AlterField(
            model_name='helprequest',
            name='contact_number',
            field=models.CharField(blank=True, max_length=15),
        ),
    ]
