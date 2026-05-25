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


def get_random_quote():
    import random
    q = random.choice(WISE_QUOTES)
    return f"💡 <b>{q['category'].upper()}</b>\n<i>\"{q['text']}\"</i>"


def get_monday_quote():
    import random
    q = random.choice(MONDAY_QUOTES)
    return f"💡 <b>Monday Kickstart — {q['category'].upper()}</b>\n<i>\"{q['text']}\"</i>"


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
    date_str = get_date_string()
    today = date.today().strftime("%Y-%m-%d")

    try:
        acc_ref = firebase_db.reference("account_data")
        all_accounts = acc_ref.get() or {}
    except Exception as e:
        logger.error(f"[Daily Report] Error fetching data: {e}")
        all_accounts = {}

    accounts = []
    total_pnl = 0
    total_lots = 0
    win_count = 0
    active_count = 0

    for acc_num, data in all_accounts.items():
        daily_hist = (data or {}).get("daily_history", {}).get(today)
        if daily_hist:
            active_count += 1
            profit = daily_hist.get("daily_profit") or daily_hist.get("profit") or 0
            growth = daily_hist.get("daily_growth_percent") or daily_hist.get("growth") or 0
            lots = daily_hist.get("daily_lots") or daily_hist.get("lot") or 0

            total_pnl += profit
            total_lots += lots
            if profit > 0:
                win_count += 1

            accounts.append({
                "accNum": acc_num,
                "profit": profit,
                "growth": growth,
                "lots": lots,
            })

    accounts.sort(key=lambda x: x["profit"], reverse=True)
    win_rate = (win_count / active_count * 100) if active_count > 0 else 0

    msg = f"🌙 <b>DAILY TRADING REPORT</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    if active_count == 0:
        msg += f"\n📊 Tidak ada aktivitas trading hari ini.\n"
        msg += f"Semua akun dalam kondisi idle.\n"
    else:
        msg += f"\n📊 <b>RINGKASAN HARI INI</b>\n"
        msg += f"├ 💰 Total PnL       : ${format_currency(total_pnl)}\n"
        msg += f"├ 🔄 Total Lots      : {total_lots:.1f}\n"
        msg += f"├ 🟢 Win Rate        : {format_percent(win_rate)}%\n"
        msg += f"└ 🖥️ Akun Aktif      : {active_count}\n"

        if accounts:
            msg += f"\n📋 <b>BREAKDOWN PER AKUN</b>\n"
            top = accounts[:5]
            for idx, acc in enumerate(top):
                prefix = "└" if idx == len(top) - 1 else "├"
                sign = "+" if acc["profit"] >= 0 else ""
                gsign = "+" if acc["growth"] >= 0 else ""
                msg += f"{prefix} 📌 {acc['accNum']}  : {sign}${format_currency(acc['profit'])} ({gsign}{format_percent(acc['growth'])}%)\n"
            if len(accounts) > 5:
                msg += f"└ ... dan {len(accounts) - 5} akun lainnya\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += get_random_quote()
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
    msg += f"\n#DailyReport #KRX"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] Daily report sent: {success}")
    return success


def send_weekly_recap(firebase_db):
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

    msg = f"📊 <b>WEEKLY RECAP — SABTU REFLEKSI</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    if total_weekly_pnl == 0 and not accounts:
        msg += f"\n📊 Data mingguan tidak tersedia.\n"
    else:
        msg += f"\n💎 <b>RINGKASAN MINGGU INI (Sen-Jum)</b>\n"
        msg += f"├ 💰 Total PnL        : ${format_currency(total_weekly_pnl)}\n"
        msg += f"├ 🟢 Win Rate         : {format_percent(win_rate)}%\n"
        bsign = "+" if best_day["profit"] >= 0 else ""
        wsign = "+" if worst_day["profit"] >= 0 else ""
        msg += f"├ 📊 Hari Terbaik     : {best_day['date']} (${format_currency(best_day['profit'])})\n"
        msg += f"└ 📉 Hari Terlemah    : {worst_day['date']} ({wsign}${format_currency(worst_day['profit'])})\n"

        if accounts:
            msg += f"\n📋 <b>AKUMULASI PER AKUN</b>\n"
            top = accounts[:5]
            for idx, acc in enumerate(top):
                prefix = "└" if idx == len(top) - 1 else "├"
                sign = "+" if acc["profit"] >= 0 else ""
                gsign = "+" if acc["avgGrowth"] >= 0 else ""
                msg += f"{prefix} 📌 {acc['accNum']}  : {sign}${format_currency(acc['profit'])} (avg {gsign}{format_percent(acc['avgGrowth'])}%/hr)\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += get_random_quote()
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"🏖️ Istirahat yang baik adalah bagian dari strategi.\n"
    msg += f"Market akan selalu ada hari Senin.\n"
    msg += f"\n📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
    msg += f"\n#WeeklyRecap #KRX"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] Weekly recap sent: {success}")
    return success


def send_daily_snapshot(firebase_db):
    """
    Daily Snapshot — Investor Only
    Detail per investor dengan breakdown akun dan profit hari ini.
    Hanya kirim untuk users dengan role === 'investor'.
    """
    date_str = get_date_string()
    today = date.today().strftime("%Y-%m-%d")

    try:
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get() or {}
        acc_ref = firebase_db.reference("account_data")
        all_accounts = acc_ref.get() or {}
    except Exception as e:
        logger.error(f"[Daily Snapshot] Error fetching data: {e}")
        return False

    investors = []

    for uid, user_data in all_users.items():
        if (user_data or {}).get("role") != "investor":
            continue

        subscriptions = (user_data or {}).get("subscriptions")
        if not subscriptions:
            continue

        investor_info = {
            "uid": uid,
            "name": user_data.get("fullName") or user_data.get("email") or uid,
            "vps_list": [],
        }

        for vps_key, vps_data in subscriptions.items():
            accounts = (vps_data or {}).get("accounts")
            if not accounts:
                continue

            vps_info = {
                "vps_name": vps_data.get("vps_name") or vps_key,
                "accounts": [],
            }

            for acc_num, acc_info in accounts.items():
                acc_full = (all_accounts or {}).get(acc_num, {})
                daily_hist = (acc_full or {}).get("daily_history", {}).get(today)

                if not daily_hist:
                    # Skip if no trading activity today
                    continue

                profit_share = acc_info.get("profit_share_percent") or acc_info.get("profit_share") or 30
                profit = daily_hist.get("daily_profit") or daily_hist.get("profit") or 0
                growth = daily_hist.get("daily_growth_percent") or daily_hist.get("growth") or 0
                lots = daily_hist.get("daily_lots") or daily_hist.get("lot") or 0

                # Get balance
                balance = (acc_full.get("realtime_stats") or {}).get("balance") or 0
                if not balance:
                    balance = (acc_full.get("metadata") or {}).get("balance") or 0

                fee = max(0, profit * (profit_share / 100))

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
                investor_info["vps_list"].append(vps_info)

        if investor_info["vps_list"]:
            investors.append(investor_info)

    if not investors:
        logger.info("[Daily Snapshot] No investor activity today. Skipping.")
        return True

    # Build message
    msg = f"📊 <b>DAILY SNAPSHOT — INVESTOR REPORT</b>\n"
    msg += f"📅 {date_str}\n"
    msg += f"━━━━━━━━━━━━━━━━━━━━━━\n"

    for inv in investors:
        msg += f"\n👤 <b>INVESTOR: {inv['name']}</b>\n"

        total_profit = 0
        total_fee = 0
        total_balance = 0

        for vps in inv["vps_list"]:
            msg += f"├ 🖥️ VPS: {vps['vps_name']}\n"

            for idx, acc in enumerate(vps["accounts"]):
                is_last = (idx == len(vps["accounts"]) - 1) and (vps == inv["vps_list"][-1])
                prefix = "│  └" if is_last else "│  ├"
                total_profit += acc["profit"]
                total_fee += acc["fee"]
                total_balance += acc["balance"]

                sign = "+" if acc["profit"] >= 0 else ""
                gsign = "+" if acc["growth"] >= 0 else ""

                msg += f"{prefix} 💰 Account {acc['acc_num']}\n"
                msg += f"{'   ' if is_last else '│  │'}  ├ Balance: ${format_currency(acc['balance'])}\n"
                msg += f"{'   ' if is_last else '│  │'}  ├ Profit Hari Ini: {sign}${format_currency(acc['profit'])} ({gsign}{format_percent(acc['growth'])}%)\n"
                msg += f"{'   ' if is_last else '│  │'}  └ Fee ({int(acc['profit_share'])}%): ${format_currency(acc['fee'])}\n"

        ts = "+" if total_profit >= 0 else ""
        msg += f"└ Total Profit: {ts}${format_currency(total_profit)} | Total Fee: ${format_currency(total_fee)}\n"

    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += get_random_quote()
    msg += f"\n━━━━━━━━━━━━━━━━━━━━━━\n"
    msg += f"📊 Dashboard: <a href=\"{DASHBOARD_URL}\">KRX Dashboard</a>\n"
    msg += f"\n#DailySnapshot #KRX"

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] Daily snapshot sent: {success}")
    return success


def send_vps_billing_warning(payload):
    date_str = get_date_string()
    vps_name = payload.get("vps_name") or payload.get("accountNumber") or "N/A"
    investor = payload.get("user_id") or "N/A"
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

    success = send_telegram_message(msg, TOPIC_LOGS)
    logger.info(f"[Telegram] VPS billing warning sent: {success}")
    return success


def send_vps_billing_urgent(payload):
    date_str = get_date_string()
    vps_name = payload.get("vps_name") or payload.get("accountNumber") or "N/A"
    investor = payload.get("user_id") or "N/A"
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

    success = send_telegram_message(msg, TOPIC_LOGS)
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


# ============================================================================
# DISPATCHER
# ============================================================================

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
        "profit_share_invoice_ready": lambda: send_profit_share_notification(payload or {}),
    }

    handler = handlers.get(trigger_name)
    if handler:
        return handler()
    else:
        logger.warning(f"[Telegram Notifier] Unknown trigger: {trigger_name}")
        return False