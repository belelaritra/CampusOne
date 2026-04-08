"""
CampusOne Telegram Bot
======================
Authentication : phone-number match against Django User.phone_number
Features       : food outlet list, menu, ordering, order tracking,
                 order history, cancel order, submit review
"""

import logging
import os
import pathlib
from dotenv import load_dotenv

# Always load .env from the bot/ directory, regardless of where the script is run from
load_dotenv(pathlib.Path(__file__).parent / '.env')

from telegram import (
    Update, ReplyKeyboardMarkup, ReplyKeyboardRemove,
    KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton,
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler, CallbackQueryHandler,
    ConversationHandler, filters, ContextTypes,
)

import api_client as api

logging.basicConfig(
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')

# ── Conversation states ──────────────────────────────────────────────────────
(
    PHONE,          # waiting for phone number contact
    MAIN,           # main menu
    OUTLETS,        # showing outlet list
    MENU,           # showing outlet menu / building cart
    CART,           # cart review before placing order
    ORDER_TYPE,     # delivery or takeaway
    DELIVERY_LOC,   # pick delivery location
    MY_ORDERS,      # pending / history
    TRACK,          # enter order id to track
    CANCEL,         # choose order to cancel, confirm
    REVIEW_ORDER,   # choose unreviewed order
    REVIEW_RATE,    # rate each item
) = range(12)

# ── Keyboards ────────────────────────────────────────────────────────────────

MAIN_KEYBOARD = ReplyKeyboardMarkup(
    [['🍔 Order Food', '📦 My Orders'],
     ['🔍 Track Order', '❌ Cancel Order'],
     ['⭐ Submit Review']],
    resize_keyboard=True,
)

BACK_KEYBOARD = ReplyKeyboardMarkup([['🔙 Back']], resize_keyboard=True)

def _inline(rows: list[list[tuple]]) -> InlineKeyboardMarkup:
    """rows = [[(label, callback_data), ...], ...]"""
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(t, callback_data=d) for t, d in row] for row in rows]
    )

# ── Helpers ──────────────────────────────────────────────────────────────────

def _fmt_status(s: str) -> str:
    icons = {
        'PENDING': '🕐 Pending', 'ACCEPTED': '✅ Accepted',
        'PREPARING': '👨‍🍳 Preparing', 'OUT_FOR_DELIVERY': '🛵 On the way',
        'READY': '🛎 Ready for pickup', 'DELIVERED': '✅ Delivered',
        'TOOK': '✅ Picked up', 'CANCELLED': '❌ Cancelled',
    }
    return icons.get(s, s)

def _fmt_order(o: dict) -> str:
    items_txt = '\n'.join(
        f"  • {i['food_item_name']} × {i['quantity']}  ₹{i['price']}"
        for i in o.get('order_items', [])
    )
    return (
        f"*Order #{o['id']}* — {_fmt_status(o['status'])}\n"
        f"🏪 {o.get('outlet_name','')}\n"
        f"{items_txt}\n"
        f"💰 Total: ₹{o['total_price']}\n"
        f"📅 {o['created_at'][:16].replace('T',' ')}"
    )

async def _not_linked(update: Update) -> None:
    await update.effective_message.reply_text(
        "Your Telegram account is not linked yet.\n"
        "Send /start and share your phone number to get started."
    )

# ── /start ───────────────────────────────────────────────────────────────────

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id
    # Check if already linked
    result = await api.get_pending_orders(chat_id)     # will raise if not linked
    # If we get here, the user is already linked
    name = ctx.user_data.get('name', update.effective_user.first_name)
    await update.message.reply_text(
        f"👋 Welcome back, *{name}*!\n\nWhat would you like to do?",
        parse_mode='Markdown',
        reply_markup=MAIN_KEYBOARD,
    )
    return MAIN


async def start_unlinked(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    """Fallback when get_pending_orders raises (user not linked)."""
    btn = KeyboardButton('📱 Share my phone number', request_contact=True)
    await update.message.reply_text(
        "👋 Welcome to *CampusOne Bot*!\n\n"
        "To get started, please share your phone number.\n"
        "It must match your registered CampusOne account.",
        parse_mode='Markdown',
        reply_markup=ReplyKeyboardMarkup([[btn]], resize_keyboard=True, one_time_keyboard=True),
    )
    return PHONE


async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    try:
        return await start(update, ctx)
    except Exception:
        return await start_unlinked(update, ctx)


# ── Phone linking ─────────────────────────────────────────────────────────────

async def receive_contact(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    contact  = update.message.contact
    phone    = contact.phone_number
    chat_id  = update.effective_chat.id

    result = await api.link_phone(phone, chat_id)

    if result['status'] == 200:
        data = result['data']
        ctx.user_data['name'] = data.get('name', update.effective_user.first_name)
        await update.message.reply_text(
            f"✅ Account linked!\n\nWelcome, *{ctx.user_data['name']}*!",
            parse_mode='Markdown',
            reply_markup=MAIN_KEYBOARD,
        )
        return MAIN
    elif result['status'] == 404:
        await update.message.reply_text(
            "❌ No CampusOne account found with this phone number.\n\n"
            "Make sure your phone number is saved in your CampusOne profile, "
            "then try /start again."
        )
        return ConversationHandler.END
    else:
        await update.message.reply_text("⚠️ Something went wrong. Please try /start again.")
        return ConversationHandler.END


# ── Main menu dispatcher ──────────────────────────────────────────────────────

async def main_menu(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text

    if text == '🍔 Order Food':
        return await show_outlets(update, ctx)
    elif text == '📦 My Orders':
        return await show_my_orders(update, ctx)
    elif text == '🔍 Track Order':
        return await ask_track(update, ctx)
    elif text == '❌ Cancel Order':
        return await show_cancel_list(update, ctx)
    elif text == '⭐ Submit Review':
        return await show_review_list(update, ctx)
    else:
        await update.message.reply_text("Please use the menu buttons below.", reply_markup=MAIN_KEYBOARD)
        return MAIN


# ── Food ordering — outlet list ───────────────────────────────────────────────

async def show_outlets(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id
    try:
        outlets = await api.get_outlets(chat_id)
    except Exception:
        await _not_linked(update)
        return ConversationHandler.END

    if not outlets:
        await update.effective_message.reply_text("No outlets available right now.")
        return MAIN

    ctx.user_data['outlets'] = {str(o['id']): o for o in outlets}

    rows = []
    for o in outlets:
        status_icon = '🟢' if o.get('status') == 'open' else '🔴'
        label = f"{status_icon} {o['name']} ({o.get('outlet_type','')})"
        rows.append([(label, f"outlet:{o['id']}")])
    rows.append([('🔙 Back', 'back:main')])

    await update.effective_message.reply_text(
        "🏪 *Select an outlet:*",
        parse_mode='Markdown',
        reply_markup=_inline(rows),
    )
    return OUTLETS


async def outlet_selected(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    _, outlet_id = query.data.split(':', 1)
    chat_id = update.effective_chat.id

    outlet = ctx.user_data.get('outlets', {}).get(outlet_id, {})
    if outlet.get('status') == 'closed':
        await query.edit_message_text(f"❌ *{outlet['name']}* is currently closed.", parse_mode='Markdown')
        return await show_outlets_inline(query, ctx, chat_id)

    ctx.user_data['current_outlet_id']   = int(outlet_id)
    ctx.user_data['current_outlet_name'] = outlet.get('name', '')
    ctx.user_data['cart'] = {}   # {item_id: {name, price, qty}}

    try:
        menu = await api.get_outlet_menu(chat_id, int(outlet_id))
    except Exception:
        await query.edit_message_text("⚠️ Could not load menu. Try again.")
        return OUTLETS

    if not menu:
        await query.edit_message_text("No items available in this outlet.")
        return OUTLETS

    ctx.user_data['menu_items'] = {str(item['id']): item for item in menu}
    await query.edit_message_text(
        f"🍽 *{outlet.get('name','')} Menu*\nTap an item to add it to your cart:",
        parse_mode='Markdown',
        reply_markup=_build_menu_keyboard(menu, ctx.user_data['cart']),
    )
    return MENU


def _build_menu_keyboard(menu: list, cart: dict) -> InlineKeyboardMarkup:
    rows = []
    for item in menu:
        if not item.get('is_available', True):
            continue
        veg = '🟢' if item.get('is_veg') else '🔴'
        qty = cart.get(str(item['id']), {}).get('qty', 0)
        label = f"{veg} {item['name']} — ₹{item['price']}"
        if qty:
            rows.append([
                (f"➖", f"cart:remove:{item['id']}"),
                (f"{label} ({qty})", f"cart:info:{item['id']}"),
                (f"➕", f"cart:add:{item['id']}"),
            ])
        else:
            rows.append([(f"➕ {label}", f"cart:add:{item['id']}")])
    if cart:
        total = sum(v['price'] * v['qty'] for v in cart.values())
        rows.append([(f"🛒 Place Order  ₹{total:.2f}", "cart:checkout")])
    rows.append([("🔙 Back to outlets", "back:outlets")])
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton(t, callback_data=d) for t, d in row] for row in rows]
    )


async def show_outlets_inline(query, ctx, chat_id):
    outlets = list(ctx.user_data.get('outlets', {}).values())
    rows = []
    for o in outlets:
        status_icon = '🟢' if o.get('status') == 'open' else '🔴'
        label = f"{status_icon} {o['name']} ({o.get('outlet_type','')})"
        rows.append([(label, f"outlet:{o['id']}")])
    rows.append([('🔙 Back', 'back:main')])
    await query.edit_message_text(
        "🏪 *Select an outlet:*",
        parse_mode='Markdown',
        reply_markup=_inline(rows),
    )
    return OUTLETS


# ── Cart management ───────────────────────────────────────────────────────────

async def cart_action(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    parts   = query.data.split(':')
    action  = parts[1]
    chat_id = update.effective_chat.id

    if action == 'checkout':
        return await start_checkout(query, ctx)

    if action in ('add', 'remove'):
        item_id   = parts[2]
        item      = ctx.user_data['menu_items'].get(item_id, {})
        cart      = ctx.user_data.setdefault('cart', {})

        if action == 'add':
            if item_id not in cart:
                cart[item_id] = {'name': item['name'], 'price': float(item['price']), 'qty': 0}
            cart[item_id]['qty'] += 1
        else:
            if item_id in cart:
                cart[item_id]['qty'] -= 1
                if cart[item_id]['qty'] <= 0:
                    del cart[item_id]

        menu = list(ctx.user_data['menu_items'].values())
        await query.edit_message_reply_markup(
            reply_markup=_build_menu_keyboard(menu, cart)
        )

    return MENU


async def start_checkout(query, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    cart = ctx.user_data.get('cart', {})
    if not cart:
        await query.answer("Cart is empty!", show_alert=True)
        return MENU

    lines = [f"  • {v['name']} × {v['qty']}  ₹{v['price']*v['qty']:.2f}" for v in cart.values()]
    total = sum(v['price'] * v['qty'] for v in cart.values())
    text  = (
        f"🛒 *Your Cart — {ctx.user_data.get('current_outlet_name','')}*\n\n"
        + '\n'.join(lines)
        + f"\n\n💰 *Total: ₹{total:.2f}*\n\nHow would you like to receive your order?"
    )
    await query.edit_message_text(
        text,
        parse_mode='Markdown',
        reply_markup=_inline([
            [('🛵 Delivery', 'type:DELIVERY'), ('🥡 Takeaway', 'type:TAKEAWAY')],
            [('❌ Cancel', 'back:menu')],
        ]),
    )
    return ORDER_TYPE


async def order_type_selected(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    _, order_type = query.data.split(':')
    ctx.user_data['order_type'] = order_type

    if order_type == 'TAKEAWAY':
        return await do_place_order(query, ctx, delivery_location='')
    else:
        # Ask for delivery location
        hostels = [f'hostel_{i}' for i in range(1, 16)]
        rows    = [[
            (f'Hostel {i}', f'loc:hostel_{i}'),
            (f'Hostel {i+1}', f'loc:hostel_{i+1}'),
        ] for i in range(1, 16, 2)]
        rows.append([('Main Building', 'loc:main_building'), ('Library', 'loc:central_lib')])
        rows.append([('SAC', 'loc:sac'), ('Gymkhana', 'loc:gymkhana')])
        await query.edit_message_text(
            "📍 *Where should we deliver?*",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton(t, callback_data=d) for t, d in row] for row in rows]
            ),
        )
        return DELIVERY_LOC


async def delivery_location_selected(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    _, location = query.data.split(':', 1)
    return await do_place_order(query, ctx, delivery_location=location)


async def do_place_order(query, ctx: ContextTypes.DEFAULT_TYPE, delivery_location: str) -> int:
    chat_id   = query.message.chat_id
    cart      = ctx.user_data['cart']
    outlet_id = ctx.user_data['current_outlet_id']
    order_type = ctx.user_data.get('order_type', 'TAKEAWAY')

    items_payload = [
        {'food_item_id': int(item_id), 'quantity': v['qty']}
        for item_id, v in cart.items()
    ]
    payload = {
        'outlet_id':         outlet_id,
        'items':             items_payload,
        'order_type':        order_type,
        'delivery_location': delivery_location,
        'payment_method':    'COD',
    }

    result = await api.place_order(chat_id, payload)

    if result['status'] in (200, 201):
        order = result['data']
        await query.edit_message_text(
            f"✅ *Order placed!*\n\n"
            f"Order ID: *#{order['id']}*\n"
            f"Status: {_fmt_status(order.get('status','PENDING'))}\n\n"
            f"Use '🔍 Track Order' to follow your order.",
            parse_mode='Markdown',
        )
        ctx.user_data['cart'] = {}
        # Send main menu via a new message
        await query.message.reply_text("What's next?", reply_markup=MAIN_KEYBOARD)
        return MAIN
    else:
        err = result.get('data', {})
        await query.edit_message_text(
            f"❌ Order failed.\n{err.get('detail', str(err))}",
        )
        await query.message.reply_text("What's next?", reply_markup=MAIN_KEYBOARD)
        return MAIN


# ── My Orders ─────────────────────────────────────────────────────────────────

async def show_my_orders(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id
    try:
        pending = await api.get_pending_orders(chat_id)
        history = await api.get_order_history(chat_id)
    except Exception:
        await _not_linked(update)
        return ConversationHandler.END

    msg = ''
    if pending:
        msg += '*🟡 Active Orders*\n\n'
        msg += '\n\n'.join(_fmt_order(o) for o in pending[:5])
    else:
        msg += '*🟡 Active Orders*\nNone right now.\n'

    msg += '\n\n*📜 Recent History*\n\n'
    if history:
        msg += '\n\n'.join(_fmt_order(o) for o in history[:5])
    else:
        msg += 'No past orders yet.'

    await update.effective_message.reply_text(msg, parse_mode='Markdown', reply_markup=MAIN_KEYBOARD)
    return MAIN


# ── Track Order ───────────────────────────────────────────────────────────────

async def ask_track(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.effective_message.reply_text(
        "🔍 Enter your *Order ID* (e.g. `42`):",
        parse_mode='Markdown',
        reply_markup=BACK_KEYBOARD,
    )
    return TRACK


async def do_track(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if text == '🔙 Back':
        await update.message.reply_text("Main menu:", reply_markup=MAIN_KEYBOARD)
        return MAIN

    if not text.isdigit():
        await update.message.reply_text("Please enter a valid order number.")
        return TRACK

    chat_id = update.effective_chat.id
    result  = await api.track_order(chat_id, int(text))

    if result['status'] == 200:
        await update.message.reply_text(_fmt_order(result['data']), parse_mode='Markdown', reply_markup=MAIN_KEYBOARD)
    elif result['status'] == 404:
        await update.message.reply_text("❌ Order not found or not yours.", reply_markup=MAIN_KEYBOARD)
    else:
        await update.message.reply_text("⚠️ Error fetching order.", reply_markup=MAIN_KEYBOARD)

    return MAIN


# ── Cancel Order ──────────────────────────────────────────────────────────────

async def show_cancel_list(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id
    try:
        orders = await api.get_pending_orders(chat_id)
    except Exception:
        await _not_linked(update)
        return ConversationHandler.END

    cancellable = [o for o in orders if o.get('status') in ('PENDING', 'ACCEPTED')]
    if not cancellable:
        await update.effective_message.reply_text(
            "No cancellable orders right now.\n(Only PENDING or ACCEPTED orders can be cancelled.)",
            reply_markup=MAIN_KEYBOARD,
        )
        return MAIN

    ctx.user_data['cancellable'] = {str(o['id']): o for o in cancellable}
    rows = [
        [(f"#{o['id']} — {o.get('outlet_name','')} ({_fmt_status(o['status'])})", f"cancel:{o['id']}")]
        for o in cancellable
    ]
    rows.append([('🔙 Back', 'back:main')])

    await update.effective_message.reply_text(
        "❌ *Which order do you want to cancel?*",
        parse_mode='Markdown',
        reply_markup=_inline(rows),
    )
    return CANCEL


async def confirm_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    _, order_id = query.data.split(':')
    order = ctx.user_data.get('cancellable', {}).get(order_id, {})

    await query.edit_message_text(
        f"Cancel *Order #{order_id}* from {order.get('outlet_name','')}?\n"
        f"Status: {_fmt_status(order.get('status',''))}",
        parse_mode='Markdown',
        reply_markup=_inline([
            [('Yes, cancel it', f"docancel:{order_id}"), ('No, keep it', 'back:main')],
        ]),
    )
    return CANCEL


async def do_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    _, order_id = query.data.split(':')
    chat_id = query.message.chat_id

    result = await api.cancel_order(chat_id, int(order_id))
    if result['status'] == 200:
        await query.edit_message_text(f"✅ Order #{order_id} has been cancelled.")
    else:
        err = result.get('data', {})
        await query.edit_message_text(f"❌ Could not cancel: {err.get('detail', 'unknown error')}")

    await query.message.reply_text("Main menu:", reply_markup=MAIN_KEYBOARD)
    return MAIN


# ── Review ────────────────────────────────────────────────────────────────────

async def show_review_list(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    chat_id = update.effective_chat.id
    try:
        history = await api.get_order_history(chat_id)
    except Exception:
        await _not_linked(update)
        return ConversationHandler.END

    reviewable = [o for o in history if not o.get('reviewed') and o.get('status') in ('DELIVERED', 'TOOK')]
    if not reviewable:
        await update.effective_message.reply_text(
            "No orders to review right now.\n(Completed unreviewed orders appear here.)",
            reply_markup=MAIN_KEYBOARD,
        )
        return MAIN

    ctx.user_data['reviewable'] = {str(o['id']): o for o in reviewable}
    rows = [
        [(f"#{o['id']} — {o.get('outlet_name','')}", f"review_order:{o['id']}")]
        for o in reviewable
    ]
    rows.append([('🔙 Back', 'back:main')])

    await update.effective_message.reply_text(
        "⭐ *Which order would you like to review?*",
        parse_mode='Markdown',
        reply_markup=_inline(rows),
    )
    return REVIEW_ORDER


async def review_order_selected(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    _, order_id = query.data.split(':')
    order = ctx.user_data.get('reviewable', {}).get(order_id, {})

    ctx.user_data['review_order_id'] = int(order_id)
    items = order.get('order_items', [])
    ctx.user_data['review_items']    = {str(i['food_item']): i['food_item_name'] for i in items}
    ctx.user_data['review_ratings']  = {}

    await query.edit_message_text(
        f"⭐ Rate items from *Order #{order_id}*\n\n"
        f"Tap a star rating for each item:",
        parse_mode='Markdown',
        reply_markup=_build_review_keyboard(items, {}),
    )
    return REVIEW_RATE


def _build_review_keyboard(items: list, ratings: dict) -> InlineKeyboardMarkup:
    rows = []
    for item in items:
        item_id   = str(item['food_item'])
        item_name = item['food_item_name']
        rated     = ratings.get(item_id)
        stars_row = [
            (f"{'★' if rated and i <= int(rated) else '☆'}", f"rate:{item_id}:{i}")
            for i in range(1, 6)
        ]
        rows.append([(f"📦 {item_name}", f"noop:{item_id}")])
        rows.append(stars_row)
    if ratings and len(ratings) == len(items):
        rows.append([('✅ Submit Reviews', 'submit_review')])
    rows.append([('🔙 Back', 'back:main')])
    return _inline(rows)


async def rate_item(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    parts   = query.data.split(':')
    item_id = parts[1]
    rating  = parts[2]

    ctx.user_data['review_ratings'][item_id] = int(rating)
    items   = list(ctx.user_data['review_items'].items())
    order   = ctx.user_data.get('reviewable', {}).get(str(ctx.user_data['review_order_id']), {})
    items_list = order.get('order_items', [])

    await query.edit_message_reply_markup(
        reply_markup=_build_review_keyboard(items_list, ctx.user_data['review_ratings'])
    )
    return REVIEW_RATE


async def submit_review(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query    = update.callback_query
    await query.answer()
    chat_id  = query.message.chat_id
    order_id = ctx.user_data['review_order_id']
    ratings  = ctx.user_data['review_ratings']

    result = await api.submit_review(chat_id, order_id, ratings)
    if result['status'] in (200, 201):
        await query.edit_message_text("✅ Reviews submitted! Thank you.")
    else:
        err = result.get('data', {})
        await query.edit_message_text(f"❌ Could not submit: {err.get('detail', 'error')}")

    await query.message.reply_text("Main menu:", reply_markup=MAIN_KEYBOARD)
    return MAIN


# ── Back navigation ───────────────────────────────────────────────────────────

async def back_nav(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    _, dest = query.data.split(':')

    if dest == 'main':
        await query.edit_message_text("Returning to main menu…")
        await query.message.reply_text("Main menu:", reply_markup=MAIN_KEYBOARD)
        return MAIN
    elif dest == 'outlets':
        return await show_outlets_inline(query, ctx, query.message.chat_id)
    elif dest == 'menu':
        menu   = list(ctx.user_data.get('menu_items', {}).values())
        cart   = ctx.user_data.get('cart', {})
        outlet = ctx.user_data.get('current_outlet_name', '')
        await query.edit_message_text(
            f"🍽 *{outlet} Menu*",
            parse_mode='Markdown',
            reply_markup=_build_menu_keyboard(menu, cart),
        )
        return MENU

    return MAIN


async def noop_cb(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.callback_query.answer()
    return REVIEW_RATE


# ── Fallback ──────────────────────────────────────────────────────────────────

async def fallback(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text(
        "I didn't understand that. Use the menu buttons.",
        reply_markup=MAIN_KEYBOARD,
    )
    return MAIN


async def cmd_cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("Cancelled. Send /start to begin again.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END


# ── Application setup ─────────────────────────────────────────────────────────

def build_app() -> Application:
    app = Application.builder().token(BOT_TOKEN).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler('start', cmd_start)],
        states={
            PHONE: [
                MessageHandler(filters.CONTACT, receive_contact),
            ],
            MAIN: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, main_menu),
            ],
            OUTLETS: [
                CallbackQueryHandler(outlet_selected,  pattern=r'^outlet:'),
                CallbackQueryHandler(back_nav,         pattern=r'^back:'),
            ],
            MENU: [
                CallbackQueryHandler(cart_action, pattern=r'^cart:'),
                CallbackQueryHandler(back_nav,    pattern=r'^back:'),
            ],
            ORDER_TYPE: [
                CallbackQueryHandler(order_type_selected, pattern=r'^type:'),
                CallbackQueryHandler(back_nav,            pattern=r'^back:'),
            ],
            DELIVERY_LOC: [
                CallbackQueryHandler(delivery_location_selected, pattern=r'^loc:'),
            ],
            MY_ORDERS: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, main_menu),
            ],
            TRACK: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, do_track),
            ],
            CANCEL: [
                CallbackQueryHandler(confirm_cancel, pattern=r'^cancel:'),
                CallbackQueryHandler(do_cancel,      pattern=r'^docancel:'),
                CallbackQueryHandler(back_nav,       pattern=r'^back:'),
            ],
            REVIEW_ORDER: [
                CallbackQueryHandler(review_order_selected, pattern=r'^review_order:'),
                CallbackQueryHandler(back_nav,              pattern=r'^back:'),
            ],
            REVIEW_RATE: [
                CallbackQueryHandler(rate_item,     pattern=r'^rate:'),
                CallbackQueryHandler(submit_review, pattern=r'^submit_review$'),
                CallbackQueryHandler(noop_cb,       pattern=r'^noop:'),
                CallbackQueryHandler(back_nav,      pattern=r'^back:'),
            ],
        },
        fallbacks=[
            CommandHandler('cancel', cmd_cancel),
            CommandHandler('start',  cmd_start),
            MessageHandler(filters.TEXT & ~filters.COMMAND, fallback),
        ],
        allow_reentry=True,
        per_message=False,
    )

    app.add_handler(conv)
    return app


if __name__ == '__main__':
    if not BOT_TOKEN:
        raise RuntimeError('TELEGRAM_BOT_TOKEN not set in bot/.env — run setup_bot.py first')
    if os.getenv('TELEGRAM_BOT_SECRET', '') == 'change-me-in-production':
        raise RuntimeError('TELEGRAM_BOT_SECRET is not set in bot/.env — run setup_bot.py first')
    logger.info('Starting CampusOne Telegram bot...')
    logger.info('API URL : %s', os.getenv('DJANGO_API_URL'))
    logger.info('Secret  : %s...', os.getenv('TELEGRAM_BOT_SECRET', '')[:10])
    build_app().run_polling(drop_pending_updates=True)
