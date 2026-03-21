"""
Management command: seed_food_outlets
Creates the 6 fixed campus outlets (idempotent).

Usage:
    python manage.py seed_food_outlets
"""
from django.core.management.base import BaseCommand
from api.models import Outlet, MenuItem


OUTLETS_DATA = [
    {
        'name': 'Aromas Dhaba',
        'description': 'North-Indian comfort food — dal, roti, sabzi & more.',
        'image': '',
        'items': [
            {'name': 'Dal Tadka',           'price': 60,  'is_veg': True,  'description': 'Yellow lentils tempered with ghee & spices.'},
            {'name': 'Paneer Butter Masala','price': 90,  'is_veg': True,  'description': 'Rich tomato-based paneer curry.'},
            {'name': 'Chicken Curry',       'price': 110, 'is_veg': False, 'description': 'Home-style chicken in onion-tomato gravy.'},
            {'name': 'Butter Roti',         'price': 12,  'is_veg': True,  'description': 'Soft wheat roti with butter.'},
            {'name': 'Steamed Rice',        'price': 30,  'is_veg': True,  'description': 'Plain steamed basmati rice.'},
            {'name': 'Lassi',               'price': 40,  'is_veg': True,  'description': 'Chilled sweet yogurt drink.'},
        ],
    },
    {
        'name': 'H2 Canteen',
        'description': 'Wholesome meals for H2 hostel residents and campus community.',
        'image': '',
        'items': [
            {'name': 'Veg Thali',       'price': 80,  'is_veg': True,  'description': 'Rice, dal, 2 sabzis, roti & salad.'},
            {'name': 'Egg Bhurji Roll', 'price': 55,  'is_veg': False, 'description': 'Spiced egg scramble wrapped in rumali roti.'},
            {'name': 'Masala Maggi',    'price': 40,  'is_veg': True,  'description': 'Classic Maggi with extra masala & veggies.'},
            {'name': 'Aloo Paratha',    'price': 50,  'is_veg': True,  'description': 'Stuffed potato paratha served with curd.'},
            {'name': 'Cold Coffee',     'price': 45,  'is_veg': True,  'description': 'Blended iced coffee with milk.'},
            {'name': 'Chicken Biryani', 'price': 120, 'is_veg': False, 'description': 'Fragrant basmati rice with tender chicken.'},
        ],
    },
    {
        'name': 'Amul Parlour',
        'description': 'Amul ice-creams, milk products & snacks.',
        'image': '',
        'items': [
            {'name': 'Amul Kool',         'price': 25, 'is_veg': True, 'description': 'Chilled flavoured milk.'},
            {'name': 'Vanilla Ice Cream', 'price': 30, 'is_veg': True, 'description': 'Classic single-scoop vanilla cone.'},
            {'name': 'Chocolate Brownie', 'price': 40, 'is_veg': True, 'description': 'Fudgy chocolate brownie.'},
            {'name': 'Butter 100g',       'price': 55, 'is_veg': True, 'description': 'Amul salted butter.'},
            {'name': 'Cheese Slice',      'price': 30, 'is_veg': True, 'description': 'Processed cheese slice pack of 2.'},
            {'name': 'Mango Shrikhand',   'price': 50, 'is_veg': True, 'description': 'Amul mango flavoured shrikhand.'},
        ],
    },
    {
        'name': 'Cafe 92',
        'description': 'Your favourite cafe for sandwiches, wraps & hot beverages.',
        'image': '',
        'items': [
            {'name': 'Veg Sandwich',    'price': 55,  'is_veg': True,  'description': 'Toasted with fresh veggies & green chutney.'},
            {'name': 'Club Sandwich',   'price': 75,  'is_veg': False, 'description': 'Triple-decker with chicken, egg & veggies.'},
            {'name': 'Cappuccino',      'price': 60,  'is_veg': True,  'description': 'Rich espresso topped with steamed milk foam.'},
            {'name': 'Cold Coffee',     'price': 65,  'is_veg': True,  'description': 'Blended iced coffee with ice cream.'},
            {'name': 'Peri Peri Fries', 'price': 50,  'is_veg': True,  'description': 'Crispy fries dusted with peri-peri spice.'},
            {'name': 'Brownie Shake',   'price': 80,  'is_veg': True,  'description': 'Thick milkshake blended with chocolate brownie.'},
        ],
    },
    {
        'name': 'Chayoos',
        'description': 'Premium chai and snacks — over 25 varieties of tea.',
        'image': '',
        'items': [
            {'name': 'Masala Chai',    'price': 30, 'is_veg': True, 'description': 'Classic spiced tea with ginger & cardamom.'},
            {'name': 'Kashmiri Kahwa', 'price': 50, 'is_veg': True, 'description': 'Saffron-infused green tea with almonds.'},
            {'name': 'Cutting Chai',   'price': 20, 'is_veg': True, 'description': 'Small strong Mumbai-style tea.'},
            {'name': 'Samosa 2 pcs',   'price': 25, 'is_veg': True, 'description': 'Crispy potato-filled samosas.'},
            {'name': 'Khari Biscuits', 'price': 20, 'is_veg': True, 'description': 'Flaky puff pastry biscuits 5 pcs.'},
            {'name': 'Cold Brew Tea',  'price': 55, 'is_veg': True, 'description': 'Slow-steeped chilled tea served over ice.'},
        ],
    },
    {
        'name': 'CCD',
        'description': 'Cafe Coffee Day — premium coffee, beverages & bites.',
        'image': '',
        'items': [
            {'name': 'Cafe Latte',         'price': 90,  'is_veg': True,  'description': 'Espresso with steamed milk.'},
            {'name': 'Cold Coffee Frappe', 'price': 110, 'is_veg': True,  'description': 'Blended coffee with whipped cream.'},
            {'name': 'Veg Burger',         'price': 95,  'is_veg': True,  'description': 'Crispy veggie patty with lettuce & sauce.'},
            {'name': 'Chicken Burger',     'price': 120, 'is_veg': False, 'description': 'Grilled chicken with mayo & lettuce.'},
            {'name': 'Muffin',             'price': 70,  'is_veg': True,  'description': 'Blueberry or chocolate chip muffin.'},
            {'name': 'Hot Chocolate',      'price': 100, 'is_veg': True,  'description': 'Rich hot cocoa with whipped cream.'},
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed the 6 fixed campus food outlets with sample menu items.'

    def handle(self, *args, **options):
        created_outlets = 0
        created_items   = 0

        for outlet_data in OUTLETS_DATA:
            items = outlet_data.pop('items')
            outlet, created = Outlet.objects.get_or_create(
                name=outlet_data['name'],
                defaults=outlet_data,
            )
            if created:
                created_outlets += 1
                self.stdout.write(f'  Created outlet: {outlet.name}')
            else:
                self.stdout.write(f'  Already exists: {outlet.name}')

            for item_data in items:
                _, item_created = MenuItem.objects.get_or_create(
                    outlet=outlet,
                    name=item_data['name'],
                    defaults={
                        'price':        item_data['price'],
                        'is_veg':       item_data['is_veg'],
                        'description':  item_data['description'],
                        'is_available': True,
                    },
                )
                if item_created:
                    created_items += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\nDone. Created {created_outlets} outlet(s) and {created_items} menu item(s).'
            )
        )
