"""
Migration: food_ordering_v2

Changes:
- MenuItem: rename `image` → `image_url`, add `image_upload` (ImageField)
- FoodOrder: add order_type, user snapshot fields (full_name, phone_number, email)
- FoodOrder: make delivery_location blank=True, update status choices (+READY, +TOOK)
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_food_ordering'),
    ]

    operations = [
        # ----------------------------------------------------------------
        # MenuItem — rename image → image_url
        # ----------------------------------------------------------------
        migrations.RenameField(
            model_name='menuitem',
            old_name='image',
            new_name='image_url',
        ),

        # MenuItem — add image_upload (ImageField)
        migrations.AddField(
            model_name='menuitem',
            name='image_upload',
            field=models.ImageField(blank=True, null=True, upload_to='menu_items/'),
        ),

        # ----------------------------------------------------------------
        # FoodOrder — add order_type
        # ----------------------------------------------------------------
        migrations.AddField(
            model_name='foodorder',
            name='order_type',
            field=models.CharField(
                db_index=True,
                choices=[('DELIVERY', 'Delivery'), ('TAKEAWAY', 'Takeaway')],
                default='DELIVERY',
                max_length=10,
            ),
        ),

        # FoodOrder — add user snapshot fields
        migrations.AddField(
            model_name='foodorder',
            name='user_full_name',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='foodorder',
            name='user_phone_number',
            field=models.CharField(blank=True, default='', max_length=15),
        ),
        migrations.AddField(
            model_name='foodorder',
            name='user_email',
            field=models.EmailField(blank=True, default='', max_length=254),
        ),

        # FoodOrder — make delivery_location blank (no schema change, just validation)
        migrations.AlterField(
            model_name='foodorder',
            name='delivery_location',
            field=models.CharField(
                blank=True,
                default='',
                max_length=50,
                choices=[
                    ('hostel_1',  'Hostel 1'),  ('hostel_2',  'Hostel 2'),  ('hostel_3',  'Hostel 3'),
                    ('hostel_4',  'Hostel 4'),  ('hostel_5',  'Hostel 5'),  ('hostel_6',  'Hostel 6'),
                    ('hostel_7',  'Hostel 7'),  ('hostel_8',  'Hostel 8'),  ('hostel_9',  'Hostel 9'),
                    ('hostel_10', 'Hostel 10'), ('hostel_11', 'Hostel 11'), ('hostel_12', 'Hostel 12'),
                    ('hostel_13', 'Hostel 13'), ('hostel_14', 'Hostel 14'), ('hostel_15', 'Hostel 15'),
                    ('hostel_16', 'Hostel 16'), ('hostel_17', 'Hostel 17'), ('hostel_18', 'Hostel 18'),
                    ('hostel_19', 'Hostel 19'), ('hostel_21', 'Hostel 21'),
                    ('tansa_house', 'Tansa House'),
                    ('kresit', 'KReSIT'), ('sjmsom', 'SJMSOM'),
                    ('lecture_hall', 'Lecture Hall Complex'), ('conv_hall', 'Convocation Hall'),
                    ('main_building', 'Main Building'), ('central_lib', 'Central Library'),
                    ('sac', 'Students Activity Centre'), ('gymkhana', 'Students Gymkhana'),
                ],
            ),
        ),

        # FoodOrder — update status choices to include READY and TOOK
        migrations.AlterField(
            model_name='foodorder',
            name='status',
            field=models.CharField(
                db_index=True,
                default='PENDING',
                max_length=20,
                choices=[
                    ('PENDING',          'Pending'),
                    ('ACCEPTED',         'Accepted'),
                    ('PREPARING',        'Preparing'),
                    ('OUT_FOR_DELIVERY', 'Out for Delivery'),
                    ('READY',            'Ready for Pickup'),
                    ('DELIVERED',        'Delivered'),
                    ('TOOK',             'Picked Up'),
                    ('CANCELLED',        'Cancelled'),
                ],
            ),
        ),
    ]
