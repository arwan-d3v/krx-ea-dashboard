#!/usr/bin/env python3
"""
KRX TELEGRAM NOTIFIER — Direct Telegram Notification Module
=============================================================
Dipanggil oleh krx_trigger_bot.py untuk mengirim pesan langsung ke Telegram
tanpa bergantung pada browser/frontend.

Trigger types:
  - morning_prep          : Morning briefing + Monday kickoff
  - daily_report          : End-of-day performance report
  - weekly_recap          : Weekly profit recap + weekend wisdom
  - daily_snapshot        : Investor-only snapshot (detail per investor)
  - vps_billing_warning   : VPS H-3 warning
  - vps_billing_urgent    : VPS H-1/overdue urgent
  - profit_share_invoice_ready : Profit share invoice notification
"""

import os
import json
import time
import logging
import requests
from datetime import datetime, date

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8990692151:AAHOS2dls1dAFfXaMzSQOVZCumLcLyhM9lY")
ADMIN_GROUP_ID = os.getenv("TELEGRAM_ADMIN_GROUP_ID", "-1003540250006")
TOPIC_LOGS = os.getenv("TELEGRAM_TOPIC_LOGS", "2076")
SUPER_ADMIN_ID = os.getenv("TELEGRAM_SUPER_ADMIN_ID", "1111325338")

DASHBOARD_URL = "https://krx-ea.pages.dev"

MONTHS_ID = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

# Wise quotes pool (matching frontend quotes-pool.js)
WISE_QUOTES = [
    {"text": "The market is a device for transferring money from the impatient to the patient.", "category": "Wisdom"},
    {"text": "In investing, what is comfortable is rarely profitable.", "category": "Discipline"},
    {"text": "Risk comes from not knowing what you're doing.", "category": "Knowledge"},
    {"text": "The goal of a successful trader is to make the best trades. Money is secondary.", "category": "Mastery"},
    {"text": "Every trader has strengths and weaknesses. Some are good holders of winners, some are good holders of losers.", "category": "Self-Awareness"},
    {"text": "Successful trading is about managing risk, not avoiding it.", "category": "Risk Management"},
    {"text": "The secret to being successful from a trading perspective is to have an indefatigable and a growing account.", "category": "Growth"},
    {"text": "It's not whether you're right or wrong that's important, but how much money you make when you're right.", "category": "Profit"},
    {"text": "Don't focus on making money; focus on protecting what you have.", "category": "Capital Preservation"},
    {"text": "The trend is your friend until it ends.", "category": "Trend"},
    {"text": "Plan your trade and trade your plan.", "category": "Discipline"},
    {"text": "Cut your losses short and let your profits run.", "category": "Risk Management"},
]

MONDAY_QUOTES = [
    {"text": "A new week brings new opportunities. Stay sharp, stay disciplined.", "category": "Motivation"},
    {"text": "Monday: The perfect day to set the tone for a winning week.", "category": "Momentum"},
    {"text": "Champions don't rest on past victories. Every Monday is a fresh start.", "category": "Resilience"},
]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_date_string():
    """Format: Senin, 25 Mei 2026"""
    now = datetime.now()
    day = DAYS_ID[now.weekday()]
    month = MONTHS_ID[now.month - 1]
    return f"{day}, {now.day} {month} {now.year}"


def format_currency(amount):
    if amount is None:
        return "0.00"
    return f"{float(amount):,.2f}"


def format_percent(val):
    if val is None:
        return "0.00"
    return f"{float(val):.2f}"


def send_telegram_message(text, thread_id=None):
    """Send message to Telegram admin group."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": ADMIN_GROUP_ID,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if thread_id:
        payload["message_thread_id"] = int(thread_id)

    try:
        resp = requests.post(url, json=payload, timeout=30)
        data = resp.json()
        if not data.get("ok"):
            logger.error(f"[Telegram API] Error: {data.get('description')}")
            return False
        logger.info("[Telegram API] Message sent successfully ✓")
        return True
    except Exception as e:
        logger.error(f"[Telegram API] Fetch error: {e}")
        return False


def send_telegram_dm(chat_id, text):
    """Send private DM to a specific user via Telegram bot."""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    try:
        resp = requests.post(url, json=payload, timeout=30)
        data = resp.json()
        if not data.get("ok"):
            logger.error(f"[Telegram DM] Error to {chat_id}: {data.get('description')}")
            return False
        logger.info(f"[Telegram DM] Message sent to {chat_id} ✓")
        return True
    except Exception as e:
        logger.error(f"[Telegram DM] Fetch error to {chat_id}: {e}")
        return False


def get_random_quote():
    import random
    q = random.choice(WISE_QUOTES)
    return f"💡 <b>{q['category'].upper()}</b>\n<i>\"{q['text']}\"</i>"


def get_monday_quote():
    import random
    q = random.choice(MONDAY_QUOTES)
    return f"💡 <b>Monday Kickstart — {q['category'].upper()}</b>\n<i>\"{q['text']}\"</i>"


def get_investors_by_flag(firebase_db, filter_flag=None):
    """
    Fetch all investors from Firebase.
    filter_flag: None = all flags, 'green' = only green, etc.
    Returns list of dicts: {uid, name, telegram_id, flag, subscriptions}
    """
    try:
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get() or {}
    except Exception as e:
        logger.error(f"[get_investors_by_flag] Error: {e}")
        return []

    investors = []
    for uid, user_data in all_users.items():
        if (user_data or {}).get("role") != "investor":
            continue
        
        telegram_id = (user_data or {}).get("telegramId") or ""
        flag = (user_data or {}).get("account_flag", "green")
        subscriptions = (user_data or {}).get("subscriptions") or {}
        
        if not subscriptions:
            continue
        
        if filter_flag and flag != filter_flag:
            continue
        
        investors.append({
            "uid": uid,
            "name": user_data.get("fullName") or user_data.get("email") or uid,
            "telegram_id": telegram_id,
            "flag": flag,
            "subscriptions": subscriptions,
        })
    
    return investors


# ============================================================================
# NOTIFICATION HANDLERS
# ============================================================================

def send_morning_prep():
    date_str = get_date_string()
    today = datetime.now()
    is_monday = today.weekday() == 0  # 0 = Monday

    msg = f"☀️ <b>MORNING PREP BRIEFING</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    if is_monday:
        msg += f"\n🚀 <b>SELAMAT HARI SENIN!</b> 🚀\n"
        msg += f"Semangat baru, target baru, peluang baru.\n"
        msg += f"Saatnya kembali fokus ke chart dan eksekusi strategi.\n"
        msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
        msg += get_monday_quote()
    else:
        msg += f"\n📊 <b>STATUS SISTEM KRX</b>\n"
        msg += f"├ 🟢 Siap untuk sesi trading hari ini\n"
        msg += f"├ 📊 Pantau dashboard untuk update real-time\n"
        msg += f"└ 💡 Tetap disiplin dengan trading plan Anda\n"
        msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
        msg += get_random_quote()

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
    msg += f"\n#MorningPrep #KRX"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] Morning prep sent: {success}")
    return success


def send_daily_report(firebase_db):
    """
    Daily Trading Report — Kirim ke Investor DM (All Flags)
    Setiap investor dapat ringkasan PnL harian untuk akun milik mereka.
    """
    date_str = get_date_string()
    today = date.today().strftime("%Y-%m-%d")

    try:
        acc_ref = firebase_db.reference("account_data")
        all_accounts = acc_ref.get() or {}
    except Exception as e:
        logger.error(f"[Daily Report] Error fetching data: {e}")
        all_accounts = {}

    # Get all investors (all flags)
    investors = get_investors_by_flag(firebase_db)

    if not investors:
        logger.info("[Daily Report] No investors found. Skipping.")
        return True

    sent_count = 0
    for inv in investors:
        # Build account list for this investor
        inv_accounts = []
        inv_total_pnl = 0
        inv_total_lots = 0
        inv_win_count = 0
        inv_active_count = 0

        for vps_key, vps_data in (inv["subscriptions"] or {}).items():
            accounts = (vps_data or {}).get("accounts") or {}
            for acc_num, acc_info in accounts.items():
                acc_full = (all_accounts or {}).get(acc_num, {})
                daily_hist = (acc_full or {}).get("daily_history", {}).get(today)

                if daily_hist:
                    inv_active_count += 1
                    profit = daily_hist.get("daily_profit") or daily_hist.get("profit") or 0
                    growth = daily_hist.get("daily_growth_percent") or daily_hist.get("growth") or 0
                    lots = daily_hist.get("daily_lots") or daily_hist.get("lot") or 0

                    inv_total_pnl += profit
                    inv_total_lots += lots
                    if profit > 0:
                        inv_win_count += 1

                    inv_accounts.append({
                        "accNum": acc_num,
                        "profit": profit,
                        "growth": growth,
                        "lots": lots,
                        "vps_name": vps_data.get("vps_name") or vps_key,
                    })

        inv_accounts.sort(key=lambda x: x["profit"], reverse=True)
        inv_win_rate = (inv_win_count / inv_active_count * 100) if inv_active_count > 0 else 0

        # Build DM message
        msg = f"🌙 <b>DAILY TRADING REPORT — {inv['name'].upper()}</b>\n"
        msg += f"📅 {date_str}\n"
        msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

        if inv_active_count == 0:
            msg += f"\n📊 Tidak ada aktivitas trading hari ini.\n"
            msg += f"Semua akun dalam kondisi idle.\n"
        else:
            msg += f"\n📊 <b>RINGKASAN HARI INI</b>\n"
            msg += f"├ 💰 Total PnL       : ${format_currency(inv_total_pnl)}\n"
            msg += f"├ 🔄 Total Lots      : {inv_total_lots:.1f}\n"
            msg += f"├ 🟢 Win Rate        : {format_percent(inv_win_rate)}%\n"
            msg += f"└ 🖥️ Akun Aktif      : {inv_active_count}\n"

            if inv_accounts:
                msg += f"\n📋 <b>BREAKDOWN PER AKUN</b>\n"
                for idx, acc in enumerate(inv_accounts):
                    prefix = "└" if idx == len(inv_accounts) - 1 else "├"
                    sign = "+" if acc["profit"] >= 0 else ""
                    gsign = "+" if acc["growth"] >= 0 else ""
                    msg += f"{prefix} 📌 {acc['accNum']} ({acc['vps_name']})\n"
                    msg += f"{'   ' if idx == len(inv_accounts) - 1 else '│  '}{sign}${format_currency(acc['profit'])} ({gsign}{format_percent(acc['growth'])}%) | Lots: {acc['lots']:.1f}\n"

        msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
        msg += get_random_quote()
        msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
        msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
        msg += f"\n#DailyReport #KRX"

        # Send DM to investor
        if inv["telegram_id"]:
            send_telegram_dm(inv["telegram_id"], msg)
            sent_count += 1

    logger.info(f"[Telegram] Daily report sent to {sent_count} investors ✓")
    return True


def send_weekly_recap(firebase_db):
    """
    Weekly Recap — Sabtu Refleksi
    Kirim ke:
      1. Admin Group (Topic: Logs): Summary konsolidasi semua investor
      2. Investor DM (All Flags): Masing-masing investor dapat receipt mingguan detail
    """
    date_str = get_date_string()
    today = datetime.now()

    # Calculate Monday-Friday of this week
    from datetime import timedelta
    day_of_week = today.weekday()
    monday = today - timedelta(days=day_of_week) if day_of_week < 5 else today - timedelta(days=day_of_week - 5)

    week_days = []
    for i in range(5):
        d = monday + timedelta(days=i)
        week_days.append(d.strftime("%Y-%m-%d"))

    try:
        acc_ref = firebase_db.reference("account_data")
        all_accounts = acc_ref.get() or {}
    except Exception as e:
        logger.error(f"[Weekly Recap] Error: {e}")
        all_accounts = {}

    # Get all investors (all flags)
    investors = get_investors_by_flag(firebase_db)

    # ========================================================================
    # ADMIN GROUP: Summary konsolidasi semua investor
    # ========================================================================
    account_summary = {}
    total_weekly_pnl = 0
    best_day = {"date": "N/A", "profit": float("-inf")}
    worst_day = {"date": "N/A", "profit": float("inf")}
    win_days = 0

    for d in week_days:
        day_pnl = 0
        for acc_num, data in all_accounts.items():
            daily_hist = (data or {}).get("daily_history", {}).get(d)
            if daily_hist:
                profit = daily_hist.get("daily_profit") or daily_hist.get("profit") or 0
                day_pnl += profit

                if acc_num not in account_summary:
                    account_summary[acc_num] = {"profit": 0, "growths": []}
                account_summary[acc_num]["profit"] += profit
                growth = daily_hist.get("daily_growth_percent") or daily_hist.get("growth") or 0
                account_summary[acc_num]["growths"].append(growth)

        total_weekly_pnl += day_pnl
        if day_pnl > 0:
            win_days += 1
        if day_pnl > best_day["profit"]:
            best_day = {"date": d, "profit": day_pnl}
        if day_pnl < worst_day["profit"]:
            worst_day = {"date": d, "profit": day_pnl}

    win_rate = (win_days / 5 * 100) if 5 > 0 else 0

    accounts = []
    for acc_num, s in account_summary.items():
        avg_growth = sum(s["growths"]) / len(s["growths"]) if s["growths"] else 0
        accounts.append({"accNum": acc_num, "profit": s["profit"], "avgGrowth": avg_growth})
    accounts.sort(key=lambda x: x["profit"], reverse=True)

    admin_msg = f"📊 <b>WEEKLY RECAP — SABTU REFLEKSI</b>\n"
    admin_msg += f"📅 {date_str}\n"
    admin_msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    if total_weekly_pnl == 0 and not accounts:
        admin_msg += f"\n📊 Data mingguan tidak tersedia.\n"
    else:
        admin_msg += f"\n💎 <b>RINGKASAN MINGGU INI (Sen-Jum)</b>\n"
        admin_msg += f"├ 💰 Total PnL        : ${format_currency(total_weekly_pnl)}\n"
        admin_msg += f"├ 🟢 Win Rate         : {format_percent(win_rate)}%\n"
        bsign = "+" if best_day["profit"] >= 0 else ""
        wsign = "+" if worst_day["profit"] >= 0 else ""
        admin_msg += f"├ 📊 Hari Terbaik     : {best_day['date']} (${format_currency(best_day['profit'])})\n"
        admin_msg += f"└ 📉 Hari Terlemah    : {worst_day['date']} ({wsign}${format_currency(worst_day['profit'])})\n"

        if accounts:
            admin_msg += f"\n📋 <b>AKUMULASI PER AKUN</b>\n"
            top = accounts[:5]
            for idx, acc in enumerate(top):
                prefix = "└" if idx == len(top) - 1 else "├"
                sign = "+" if acc["profit"] >= 0 else ""
                gsign = "+" if acc["avgGrowth"] >= 0 else ""
                admin_msg += f"{prefix} 📌 {acc['accNum']}  : {sign}${format_currency(acc['profit'])} (avg {gsign}{format_percent(acc['avgGrowth'])}%/hr)\n"

    admin_msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    admin_msg += get_random_quote()
    admin_msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    admin_msg += f"🏖️ Istirahat yang baik adalah bagian dari strategi.\n"
    admin_msg += f"Market akan selalu ada hari Senin.\n"
    admin_msg += f"\n📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
    admin_msg += f"\n#WeeklyRecap #KRX"

    success = send_telegram_message(admin_msg, TOPIC_LOGS)
    logger.info(f"[Telegram] Weekly recap (admin) sent: {success}")

    # ========================================================================
    # INVESTOR DM: Detail per investor (All Flags)
    # ========================================================================
    sent_count = 0
    for inv in investors:
        inv_accounts = []
        inv_total_profit = 0
        inv_total_lots = 0
        inv_win_days = 0
        inv_best_day = {"date": "N/A", "profit": float("-inf")}
        inv_worst_day = {"date": "N/A", "profit": float("inf")}

        for vps_key, vps_data in (inv["subscriptions"] or {}).items():
            accounts = (vps_data or {}).get("accounts") or {}
            for acc_num, acc_info in accounts.items():
                acc_full = (all_accounts or {}).get(acc_num, {})
                acc_profit = 0
                acc_growths = []

                for d in week_days:
                    daily_hist = (acc_full or {}).get("daily_history", {}).get(d)
                    if daily_hist:
                        profit = daily_hist.get("daily_profit") or daily_hist.get("profit") or 0
                        growth = daily_hist.get("daily_growth_percent") or daily_hist.get("growth") or 0
                        acc_profit += profit
                        acc_growths.append(growth)

                if acc_profit != 0 or acc_growths:
                    avg_growth = sum(acc_growths) / len(acc_growths) if acc_growths else 0
                    inv_accounts.append({
                        "accNum": acc_num,
                        "profit": acc_profit,
                        "avgGrowth": avg_growth,
                        "vps_name": vps_data.get("vps_name") or vps_key,
                    })
                    inv_total_profit += acc_profit

        if not inv_accounts:
            continue

        inv_accounts.sort(key=lambda x: x["profit"], reverse=True)

        inv_msg = f"📊 <b>WEEKLY RECAP — {inv['name'].upper()}</b>\n"
        inv_msg += f"📅 {date_str}\n"
        inv_msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

        inv_msg += f"\n💎 <b>RINGKASAN MINGGU INI (Sen-Jum)</b>\n"
        inv_msg += f"└ 💰 Total PnL        : ${format_currency(inv_total_profit)}\n"

        if inv_accounts:
            inv_msg += f"\n📋 <b>AKUMULASI PER AKUN</b>\n"
            for idx, acc in enumerate(inv_accounts):
                prefix = "└" if idx == len(inv_accounts) - 1 else "├"
                sign = "+" if acc["profit"] >= 0 else ""
                gsign = "+" if acc["avgGrowth"] >= 0 else ""
                inv_msg += f"{prefix} 📌 {acc['accNum']} ({acc['vps_name']})\n"
                inv_msg += f"{'   ' if idx == len(inv_accounts) - 1 else '│  '}{sign}${format_currency(acc['profit'])} (avg {gsign}{format_percent(acc['avgGrowth'])}%/hr)\n"

        inv_msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
        inv_msg += get_random_quote()
        inv_msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
        inv_msg += f"🏖️ Istirahat yang baik adalah bagian dari strategi.\n"
        inv_msg += f"Market akan selalu ada hari Senin.\n"
        inv_msg += f"\n📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
        inv_msg += f"\n#WeeklyRecap #KRX"

        if inv["telegram_id"]:
            send_telegram_dm(inv["telegram_id"], inv_msg)
            sent_count += 1

    logger.info(f"[Telegram] Weekly recap sent to {sent_count} investors ✓")
    return success


def send_daily_snapshot(firebase_db):
    """
    Daily Snapshot — Investor Only (Green Flag Only)
    Detail per investor dengan breakdown akun dan profit hari ini.
    Hanya kirim untuk users dengan role === 'investor' dan account_flag === 'green'.
    """
    date_str = get_date_string()
    today = date.today().strftime("%Y-%m-%d")

    try:
        acc_ref = firebase_db.reference("account_data")
        all_accounts = acc_ref.get() or {}
    except Exception as e:
        logger.error(f"[Daily Snapshot] Error fetching data: {e}")
        return False

    # Get only green flag investors
    investors = get_investors_by_flag(firebase_db, filter_flag="green")

    if not investors:
        logger.info("[Daily Snapshot] No green-flag investor activity today. Skipping.")
        return True

    # Build message for Admin Group (Topic: Logs)
    msg = f"📊 <b>DAILY SNAPSHOT — INVESTOR REPORT</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    has_activity = False

    for inv in investors:
        inv_vps_list = []
        inv_total_profit = 0
        inv_total_fee = 0
        inv_total_balance = 0

        for vps_key, vps_data in (inv["subscriptions"] or {}).items():
            accounts = (vps_data or {}).get("accounts") or {}
            vps_info = {
                "vps_name": vps_data.get("vps_name") or vps_key,
                "accounts": [],
            }

            for acc_num, acc_info in accounts.items():
                acc_full = (all_accounts or {}).get(acc_num, {})
                daily_hist = (acc_full or {}).get("daily_history", {}).get(today)

                if not daily_hist:
                    continue

                profit_share = acc_info.get("profit_share_percent") or acc_info.get("profit_share") or 30
                profit = daily_hist.get("daily_profit") or daily_hist.get("profit") or 0
                growth = daily_hist.get("daily_growth_percent") or daily_hist.get("growth") or 0
                lots = daily_hist.get("daily_lots") or daily_hist.get("lot") or 0

                balance = (acc_full.get("realtime_stats") or {}).get("balance") or 0
                if not balance:
                    balance = (acc_full.get("metadata") or {}).get("balance") or 0

                fee = max(0, profit * (profit_share / 100))

                inv_total_profit += profit
                inv_total_fee += fee
                inv_total_balance += balance

                vps_info["accounts"].append({
                    "acc_num": acc_num,
                    "balance": balance,
                    "profit": profit,
                    "growth": growth,
                    "lots": lots,
                    "profit_share": profit_share,
                    "fee": fee,
                })

            if vps_info["accounts"]:
                inv_vps_list.append(vps_info)

        if not inv_vps_list:
            continue

        has_activity = True

        msg += f"\n👤 <b>INVESTOR: {inv['name']}</b>\n"

        for vps in inv_vps_list:
            msg += f"├ 🖥️ VPS: {vps['vps_name']}\n"

            for idx, acc in enumerate(vps["accounts"]):
                is_last = (idx == len(vps["accounts"]) - 1) and (vps == inv_vps_list[-1])
                prefix = "│  └" if is_last else "│  ├"
                sign = "+" if acc["profit"] >= 0 else ""
                gsign = "+" if acc["growth"] >= 0 else ""

                msg += f"{prefix} 💰 Account {acc['acc_num']}\n"
                msg += f"{'   ' if is_last else '│  │'}  ├ Balance: ${format_currency(acc['balance'])}\n"
                msg += f"{'   ' if is_last else '│  │'}  ├ Profit Hari Ini: {sign}${format_currency(acc['profit'])} ({gsign}{format_percent(acc['growth'])}%)\n"
                msg += f"{'   ' if is_last else '│  │'}  └ Fee ({int(acc['profit_share'])}%): ${format_currency(acc['fee'])}\n"

        ts = "+" if inv_total_profit >= 0 else ""
        msg += f"└ Total Profit: {ts}${format_currency(inv_total_profit)} | Total Fee: ${format_currency(inv_total_fee)}\n"

    if not has_activity:
        logger.info("[Daily Snapshot] No green-flag investor activity today. Skipping.")
        return True

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += get_random_quote()
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
    msg += f"\n#DailySnapshot #KRX"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] Daily snapshot sent: {success}")
    return success


def send_vps_billing_warning(payload, firebase_db=None):
    """
    VPS Billing Warning — H-3
    Kirim ke: Admin Group (Topic: Logs) + Investor DM (All Flags)
    """
    date_str = get_date_string()
    vps_name = payload.get("vps_name") or payload.get("accountNumber") or "N/A"
    investor = payload.get("user_id") or "N/A"
    investor_tg_id = payload.get("telegram_id") or ""
    account_flag = payload.get("account_flag", "green")
    monthly_cost = payload.get("amount") or 0
    due_date = payload.get("due_date") or "N/A"
    days_remaining = payload.get("days_remaining") or 3

    msg = f"⚠️ <b>VPS BILLING REMINDER</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"\n🖥️ <b>INFORMASI TAGIHAN VPS</b>\n"
    msg += f"├ 📌 Nama VPS      : {vps_name}\n"
    msg += f"├ 👤 Investor      : {investor}\n"
    msg += f"├ 💰 Biaya/Bulan   : ${format_currency(monthly_cost)}\n"
    msg += f"├ 📅 Jatuh Tempo   : {due_date}\n"
    msg += f"└ ⏳ Sisa Waktu    : {days_remaining} hari lagi\n"
    msg += f"\n📋 Status: ⚠️ WARNING — Segera lakukan pembayaran\n"
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"#VPSBilling #Warning\n"

    # Send to Admin Group
    success = send_telegram_message(msg, TOPIC_LOGS)

    # Send DM to investor (All Flags)
    if investor_tg_id:
        send_telegram_dm(investor_tg_id, msg)
        logger.info(f"[Telegram] VPS billing warning DM sent to {investor_tg_id} ✓")

    logger.info(f"[Telegram] VPS billing warning sent: {success}")
    return success


def send_vps_billing_urgent(payload):
    """
    VPS Billing Urgent — H-1 / Overdue
    Kirim ke: Admin Group (Topic: Logs) + Investor DM (All Flags) + Super Admin DM
    """
    date_str = get_date_string()
    vps_name = payload.get("vps_name") or payload.get("accountNumber") or "N/A"
    investor = payload.get("user_id") or "N/A"
    investor_tg_id = payload.get("telegram_id") or ""
    account_flag = payload.get("account_flag", "green")
    monthly_cost = payload.get("amount") or 0
    due_date = payload.get("due_date") or "N/A"
    days_remaining = payload.get("days_remaining") or 1
    overdue_label = " (TERLAMBAT)" if days_remaining <= 0 else ""

    msg = f"🚨 <b>VPS BILLING — URGENT{overdue_label}</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"\n🖥️ <b>TAGIHAN JATUH TEMPO</b>\n"
    msg += f"├ 📌 Nama VPS      : {vps_name}\n"
    msg += f"├ 👤 Investor      : {investor}\n"
    msg += f"├ 💰 Biaya/Bulan   : ${format_currency(monthly_cost)}\n"
    msg += f"├ 📅 Jatuh Tempo   : {due_date}\n"
    remaining_label = "JATUH TEMPO" if days_remaining <= 0 else f"{days_remaining} hari lagi"
    msg += f"└ ⏳ Sisa Waktu    : {remaining_label}\n"
    msg += f"\n📋 Status: 🚨 URGENT — Pembayaran harus segera diproses!\n"
    msg += f"\n⚠️ <b>Peringatan:</b> VPS dapat dinonaktifkan jika pembayaran\n"
    msg += f"   tidak diterima sebelum tanggal jatuh tempo.\n"
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"#VPSBilling #Urgent\n"

    # Send to Admin Group
    success = send_telegram_message(msg, TOPIC_LOGS)

    # Send DM to investor (All Flags)
    if investor_tg_id:
        send_telegram_dm(investor_tg_id, msg)
        logger.info(f"[Telegram] VPS billing urgent DM sent to investor {investor_tg_id} ✓")

    # Send DM to Super Admin
    send_telegram_dm(SUPER_ADMIN_ID, msg)
    logger.info(f"[Telegram] VPS billing urgent DM sent to super admin ✓")

    logger.info(f"[Telegram] VPS billing urgent sent: {success}")
    return success


def send_profit_share_notification(payload):
    date_str = get_date_string()
    invoices_generated = payload.get("invoices_generated") or 0
    period = payload.get("period") or "N/A"

    msg = f"💰 <b>PROFIT SHARE INVOICE GENERATED</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"\n📋 <b>RINGKASAN PROFIT SHARE</b>\n"
    msg += f"├ 📅 Periode       : {period}\n"
    msg += f"├ 📊 Invoice Dibuat: {invoices_generated} invoice\n"
    msg += f"└ ⏳ Status        : Pending — menunggu pembayaran\n"
    msg += f"\n📋 Semua invoice telah tersimpan di dashboard.\n"
    msg += f"Silakan cek Subscription Area untuk detail lengkap.\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += get_random_quote()
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}/subscription-area\">Subscription Area</a>\n"
    msg += f"\n#ProfitShare #Invoice\n"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] Profit share notification sent: {success}")
    return success


def send_vps_billing_check(firebase_db):
    """VPS Billing Check — Ringkasan tagihan VPS bulanan."""
    date_str = get_date_string()

    try:
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get() or {}
    except Exception as e:
        logger.error(f"[VPS Billing Check] Error: {e}")
        return False

    billings = []
    for uid, user_data in all_users.items():
        subscriptions = (user_data or {}).get("subscriptions") or {}
        for vps_key, vps_data in subscriptions.items():
            billing = (vps_data or {}).get("billing") or {}
            if billing:
                billings.append({
                    "investor": user_data.get("fullName") or uid,
                    "vps_name": vps_data.get("vps_name") or vps_key,
                    "amount": billing.get("monthly_cost") or 0,
                    "due_date": billing.get("next_due_date") or "N/A",
                    "status": billing.get("status") or "unknown",
                })

    msg = f"💰 <b>VPS BILLING CHECK</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    if not billings:
        msg += f"\n📋 Tidak ada data tagihan VPS ditemukan.\n"
    else:
        msg += f"\n📊 <b>RINGKASAN TAGIHAN</b>\n"
        total = 0
        for b in billings[:10]:
            prefix = "├" if b != billings[-1] else "└"
            msg += f"{prefix} 🖥️ {b['vps_name']} — ${format_currency(b['amount'])} (due: {b['due_date']})\n"
            total += b["amount"]
        msg += f"\n💰 Total Bulanan: ${format_currency(total)}\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"#VPSBilling #Check\n"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] VPS billing check sent: {success}")
    return success


def send_vps_expiry_check(firebase_db):
    """VPS Expiry Check — Cek lisensi VPS yang akan habis."""
    date_str = get_date_string()
    today = datetime.now()

    try:
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get() or {}
    except Exception as e:
        logger.error(f"[VPS Expiry Check] Error: {e}")
        return False

    expiring = []
    for uid, user_data in all_users.items():
        subscriptions = (user_data or {}).get("subscriptions") or {}
        for vps_key, vps_data in subscriptions.items():
            expiry_date = (vps_data or {}).get("license_expiry_date")
            if not expiry_date:
                continue
            try:
                exp_dt = datetime.strptime(expiry_date, "%Y-%m-%d")
                days_left = (exp_dt - today).days
                if days_left <= 30:
                    expiring.append({
                        "investor": user_data.get("fullName") or uid,
                        "vps_name": vps_data.get("vps_name") or vps_key,
                        "expiry": expiry_date,
                        "days_left": days_left,
                    })
            except:
                pass

    expiring.sort(key=lambda x: x["days_left"])

    msg = f"⏰ <b>VPS EXPIRY CHECK</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    if not expiring:
        msg += f"\n✅ Semua lisensi VPS masih aktif (>30 hari).\n"
    else:
        for e in expiring[:10]:
            urgency = "🚨" if e["days_left"] <= 7 else "⚠️" if e["days_left"] <= 14 else "📌"
            msg += f"{urgency} <b>{e['vps_name']}</b> ({e['investor']})\n"
            msg += f"   Expires: {e['expiry']} — {e['days_left']} hari lagi\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"#VPSExpiry #Check\n"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] VPS expiry check sent: {success}")
    return success


# ============================================================================
# SMART ROUTING HELPER
# ============================================================================

def route_notification(message, investor_tg_id=None, account_flag="green"):
    """
    Route notification based on account flag:
      - green  : Investor (DM) + Admin Group (info)
      - yellow : Private Admin DM only
      - red    : Private Admin DM only
    """
    if account_flag == "green":
        # Green: Investor + Admin Group (info)
        if investor_tg_id:
            send_telegram_dm(investor_tg_id, message)
        send_telegram_message(f"ℹ️ Invoice/notification sent to investor [{account_flag.upper()}]", TOPIC_LOGS)
    else:
        # Yellow & Red: Private Admin DM only
        send_telegram_dm(SUPER_ADMIN_ID, message)


# ============================================================================
# NEW HANDLERS
# ============================================================================

def send_onboarding_submission(payload):
    """Trigger: New onboarding submission from investor."""
    date_str = get_date_string()
    investor_name = payload.get("investor_name") or payload.get("fullName") or "N/A"
    investor_email = payload.get("investor_email") or payload.get("email") or "N/A"
    investor_tg_id = payload.get("telegram_id") or ""
    account_flag = payload.get("account_flag", "green")
    submission_data = payload.get("submission_data") or {}

    msg = f"🆕 <b>NEW ONBOARDING SUBMISSION</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"\n👤 <b>INVESTOR INFO</b>\n"
    msg += f"├ 📌 Nama        : {investor_name}\n"
    msg += f"├ 📧 Email       : {investor_email}\n"
    msg += f"├ 🏷️ Flag        : {account_flag.upper()}\n"

    if submission_data:
        msg += f"\n📋 <b>SUBMISSION DETAILS</b>\n"
        for key, val in submission_data.items():
            label = key.replace("_", " ").title()
            msg += f"├ {label}: {val}\n"

    msg += f"\n🔗 Silakan review di dashboard untuk approve/reject.\n"
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}/onboarding\">Onboarding Page</a>\n"
    msg += f"\n#Onboarding #NewSubmission\n"

    route_notification(msg, investor_tg_id, account_flag)
    logger.info(f"[Telegram] Onboarding submission sent (flag={account_flag})")
    return True


def send_new_account_added(payload):
    """Trigger: New MT5 account added to investor subscription."""
    date_str = get_date_string()
    investor_name = payload.get("investor_name") or payload.get("fullName") or "N/A"
    investor_email = payload.get("investor_email") or payload.get("email") or "N/A"
    investor_tg_id = payload.get("telegram_id") or ""
    account_flag = payload.get("account_flag", "green")
    account_number = payload.get("account_number") or payload.get("acc_num") or "N/A"
    vps_name = payload.get("vps_name") or "N/A"
    profit_share = payload.get("profit_share_percent") or payload.get("profit_share") or 30

    msg = f"🆕 <b>NEW ACCOUNT ADDED</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"\n👤 <b>INVESTOR INFO</b>\n"
    msg += f"├ 📌 Nama          : {investor_name}\n"
    msg += f"├ 📧 Email         : {investor_email}\n"
    msg += f"├ 🏷️ Flag          : {account_flag.upper()}\n"
    msg += f"\n🖥️ <b>ACCOUNT INFO</b>\n"
    msg += f"├ 💰 Account No    : {account_number}\n"
    msg += f"├ 🖥️ VPS           : {vps_name}\n"
    msg += f"└ 📊 Profit Share  : {int(profit_share)}%\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}/subscription-area\">Subscription Area</a>\n"
    msg += f"\n#NewAccount #AccountAdded\n"

    route_notification(msg, investor_tg_id, account_flag)
    logger.info(f"[Telegram] New account added sent (flag={account_flag})")
    return True


def send_profit_share_notification(payload):
    date_str = get_date_string()
    invoices_generated = payload.get("invoices_generated") or 0
    period = payload.get("period") or "N/A"
    account_flag = payload.get("account_flag", "green")
    investor_tg_id = payload.get("telegram_id") or ""

    msg = f"💰 <b>PROFIT SHARE INVOICE GENERATED</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"\n📋 <b>RINGKASAN PROFIT SHARE</b>\n"
    msg += f"├ 📅 Periode       : {period}\n"
    msg += f"├ 📊 Invoice Dibuat: {invoices_generated} invoice\n"
    msg += f"├ 🏷️ Flag          : {account_flag.upper()}\n"
    msg += f"└ ⏳ Status        : Pending — menunggu pembayaran\n"
    msg += f"\n📋 Semua invoice telah tersimpan di dashboard.\n"
    msg += f"Silakan cek Subscription Area untuk detail lengkap.\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += get_random_quote()
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}/subscription-area\">Subscription Area</a>\n"
    msg += f"\n#ProfitShare #Invoice\n"

    route_notification(msg, investor_tg_id, account_flag)
    logger.info(f"[Telegram] Profit share notification sent (flag={account_flag})")
    return True


def dispatch_notification(trigger_name, firebase_db, payload=None):
    """
    Main dispatcher: called by krx_trigger_bot.py when a trigger is detected.
    """
    logger.info(f"[Telegram Notifier] Dispatching: {trigger_name}")

    handlers = {
        "morning_prep": lambda: send_morning_prep(),
        "daily_report": lambda: send_daily_report(firebase_db),
        "weekly_recap": lambda: send_weekly_recap(firebase_db),
        "daily_snapshot": lambda: send_daily_snapshot(firebase_db),
        "vps_billing_warning": lambda: send_vps_billing_warning(payload or {}),
        "vps_billing_urgent": lambda: send_vps_billing_urgent(payload or {}),
        "vps_billing_check": lambda: send_vps_billing_check(firebase_db),
        "vps_expiry_check": lambda: send_vps_expiry_check(firebase_db),
        "profit_share_invoice": lambda: send_profit_share_notification(payload or {}),
        "profit_share_invoice_ready": lambda: send_profit_share_notification(payload or {}),
        "new_onboarding_submission": lambda: send_onboarding_submission(payload or {}),
        "new_account_added": lambda: send_new_account_added(payload or {}),
    }

    handler = handlers.get(trigger_name)
    if handler:
        return handler()
    else:
        logger.warning(f"[Telegram Notifier] Unknown trigger: {trigger_name}")
        return False
