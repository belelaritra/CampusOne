"""
Django REST API client for the CampusOne Telegram bot.

All requests include:
  X-Bot-Secret       : shared secret that Django validates
  X-Telegram-Chat-ID : acting user's Telegram chat_id (for BotAuthentication)
"""

import os
import pathlib
import httpx
from dotenv import load_dotenv

load_dotenv(pathlib.Path(__file__).parent / '.env')

API_URL    = os.getenv('DJANGO_API_URL', 'http://localhost:8000/api')
BOT_SECRET = os.getenv('TELEGRAM_BOT_SECRET', 'change-me-in-production')


def _headers(chat_id: int | str) -> dict:
    return {
        'X-Bot-Secret':        BOT_SECRET,
        'X-Telegram-Chat-ID':  str(chat_id),
        'Content-Type':        'application/json',
    }


async def link_phone(phone: str, chat_id: int) -> dict:
    """Link a Telegram chat_id to a Django user via phone number."""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f'{API_URL}/bot/link-phone/',
            json={'phone': phone, 'chat_id': chat_id},
            headers={'X-Bot-Secret': BOT_SECRET, 'Content-Type': 'application/json'},
        )
    return {'status': r.status_code, 'data': r.json() if r.content else {}}


async def get_outlets(chat_id: int) -> list:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f'{API_URL}/food/outlets/', headers=_headers(chat_id))
    r.raise_for_status()
    return r.json()


async def get_outlet_menu(chat_id: int, outlet_id: int) -> list:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f'{API_URL}/food/outlets/{outlet_id}/menu/', headers=_headers(chat_id))
    r.raise_for_status()
    return r.json()


async def place_order(chat_id: int, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f'{API_URL}/food/orders/', json=payload, headers=_headers(chat_id))
    return {'status': r.status_code, 'data': r.json() if r.content else {}}


async def get_pending_orders(chat_id: int) -> list:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f'{API_URL}/food/orders/pending/', headers=_headers(chat_id))
    r.raise_for_status()
    return r.json()


async def get_order_history(chat_id: int) -> list:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f'{API_URL}/food/orders/history/', headers=_headers(chat_id))
    r.raise_for_status()
    return r.json()


async def track_order(chat_id: int, order_id: int) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(f'{API_URL}/food/orders/{order_id}/', headers=_headers(chat_id))
    return {'status': r.status_code, 'data': r.json() if r.content else {}}


async def cancel_order(chat_id: int, order_id: int) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(f'{API_URL}/food/orders/{order_id}/cancel/', headers=_headers(chat_id))
    return {'status': r.status_code, 'data': r.json() if r.content else {}}


async def submit_review(chat_id: int, order_id: int, ratings: dict) -> dict:
    """ratings = {item_id: rating_1_to_5, ...}"""
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(
            f'{API_URL}/food/orders/{order_id}/review/',
            json={'ratings': ratings},
            headers=_headers(chat_id),
        )
    return {'status': r.status_code, 'data': r.json() if r.content else {}}
