from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_alter_dailymenu_hostel_alter_dailymenu_meal_type_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='degree',
            field=models.CharField(
                blank=True, max_length=10,
                choices=[
                    ('BTech', 'B.Tech'), ('MTech', 'M.Tech'),
                    ('MS',    'M.S. (Research)'), ('MSc', 'M.Sc'),
                    ('PhD',   'Ph.D'), ('Other', 'Other'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='course',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='user',
            name='year_of_study',
            field=models.PositiveSmallIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='user',
            name='photo',
            field=models.ImageField(blank=True, null=True, upload_to='profile_photos/'),
        ),
    ]
