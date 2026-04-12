from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_telegram_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='helprequest',
            name='pickup_location',
            field=models.CharField(
                max_length=30,
                choices=[
                    ('gulmohar',         'Gulmohar'),
                    ('main_gate',        'Main Gate'),
                    ('cafe92',           'Cafe92'),
                    ('chaayos',          'Chaayos'),
                    ('amul_parlour_h14', 'Amul Parlour H14'),
                    ('krishna_gymkhana', 'Krishna Juice/Soup/Salad (Gymkhana)'),
                    ('print_house_h5',   'The Print House H5 Xerox'),
                ],
            ),
        ),
    ]
