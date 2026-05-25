#!/usr/bin/env python3
"""
=============================================================================
KRX QUANTITATIVE - Unified VPS Trigger, Notifications & Billing Engine
Single Script Bot (Python 24/7 Scheduler) - Version 2.2.0
=============================================================================

Unified Firebase Paths (SYNC with Next.js frontend):
  users/{uid}/
    subscriptions/{vpsKey}/
      vps_name, vps_monthly_cost, billing_cycle_date, next_billing_date, status, expiry_date
      accounts/{accNum}/
        profit_share_percent, bot_start_date, last_invoiced_date
  account_data/{accNum}/
    metadata/{ vps_name, balance, equity, bot_start_date, ... }
    daily_history/{YYYY-MM-DD}/{ daily_profit, daily_growth_percent, daily_lots }
    snapshots/{timestamp}/{ balance, daily_profit, ... }
  invoices/{id}/
    { type, accountNumber, user_id, amount, status, description, due_date,
      billing_cycle_date, period_start, period_end, total_profit,
      share_percentage, daily_breakdown, created_at }
  system_triggers/{name}/
    { fired, timestamp, gmt8_time, trigger_name, payload }
  cron_heartbeat/
    { last_ping, gmt8_time, status, timezone }

Schedule (WITA / Asia/Makassar):
  Existing:
    A. Morning Prep & Monday Kickoff : 08:45 (Mon-Fri)
    B. Daily Report                   : 22:45 (Mon-Fri)
    C. Weekly Recap                   : 07:05 (Sat)
  Billing (v2.2):
    D. VPS Billing Check + Invoice    : 00:01 (Daily)
    E. VPS Expiry Check               : 00:03 (Daily)
    F. Bot Start Date Detection       : 00:05 (Daily)
    G. Profit Share Invoice Gen       : 08:00 (Daily; only acts on 1st Sat)
    H. Profit Snapshot                : 23:55 (Daily)

Author: KRX Quantitative Dev Team
=============================================================================
"""

import os
import sys
import json
import time
import signal
import logging
from datetime import datetime, date, timedelta

# -- Optional: .env loader --
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# -- Required: schedule --
try:
    import schedule
except ImportError:
    print("[ERROR] 'schedule' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

# -- Required: firebase-admin --
try:
    import firebase_admin
    from firebase_admin import credentials, db
except ImportError:
    print("[ERROR] 'firebase-admin' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

# -- Required: python-dateutil --
try:
    from dateutil.relativedelta import relativedelta
except ImportError:
    print("[ERROR] 'python-dateutil' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)


# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
LOG_PATH = os.path.join(SCRIPT_DIR, "krx_trigger_bot.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_PATH, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

TODAY = date.today  # callable for lazy evaluation in jobs


# ============================================================================
# INITIALIZATION
# ============================================================================

def load_config(path: str) -> dict:
    if not os.path.exists(path):
        logger.error(f"Config file not found: {path}")
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def init_firebase(fb_config: dict):
    db_url = fb_config.get("database_url")
    sa_path = fb_config.get("service_account_path")
    if not sa_path:
        logger.error("service_account_path not found in config.json")
        sys.exit(1)

    full_sa_path = os.path.join(SCRIPT_DIR, sa_path)
    if not os.path.exists(full_sa_path):
        logger.error(f"Service account file not found: {full_sa_path}")
        sys.exit(1)

    try:
        cred = credentials.Certificate(full_sa_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred, {"databaseURL": db_url})
        logger.info(f"Firebase connected: {db_url}")
        return db
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        sys.exit(1)


# ============================================================================
# SECTION 1: SYSTEM TRIGGER FUNCTIONS
# ============================================================================

def set_trigger(firebase_db, trigger_name: str) -> None:
    try:
        trigger_data = {
            "fired": True,
            "timestamp": int(time.time() * 1000),
            "gmt8_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "trigger_name": trigger_name,
        }
        firebase_db.reference(f"system_triggers/{trigger_name}").set(trigger_data)
        logger.info(f"Trigger SET: {trigger_name}")
    except Exception as e:
        logger.error(f"Failed to set trigger [{trigger_name}]: {e}")


def reset_heartbeat(firebase_db) -> None:
    try:
        firebase_db.reference("cron_heartbeat").set({
            "last_ping": int(time.time() * 1000),
            "gmt8_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "online",
            "timezone": "Asia/Makassar",
        })
    except Exception as e:
        logger.error(f"Failed to update heartbeat: {e}")


def set_billing_trigger(firebase_db, trigger_name: str, payload: dict) -> None:
    """Set a system trigger with a payload (used by billing notifications)."""
    try:
        trigger_data = {
            "fired": True,
            "timestamp": int(time.time() * 1000),
            "gmt8_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "trigger_name": trigger_name,
            "payload": payload,
        }
        firebase_db.reference(f"system_triggers/{trigger_name}").set(trigger_data)
        logger.info(f"Billing trigger SET: {trigger_name} | {payload}")
    except Exception as e:
        logger.error(f"Failed to set billing trigger [{trigger_name}]: {e}")


# ============================================================================
# SECTION 2: VPS BILLING CHECK + INVOICE GENERATION
# ============================================================================

def check_vps_billing_cycle(firebase_db) -> None:
    """
    Daily at 00:01 WITA.
    Iterate ALL users/{uid}/subscriptions/{vpsKey}/ entries.
    For each active VPS:
      - Skip non-active VPS (suspended/expired).
      - Check expiry_date and trigger warnings if expired or expiring soon.
      - If next_billing_date is null, calculate from billing_cycle_date.
      - If H-3: set trigger WARNING + generate a 'warning' VPS invoice.
      - If H-1 or overdue: set trigger URGENT + generate 'urgent' VPS invoice.
    """
    logger.info("[VPS BILLING] Starting VPS billing cycle check...")

    try:
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get()

        if not all_users:
            logger.info("[VPS BILLING] No users found. Skipping.")
            return

        today = TODAY()
        warning_count = 0
        urgent_count = 0
        invoice_count = 0

        for uid, user_data in all_users.items():
            if user_data.get("role") != "investor":
                continue

            subscriptions = user_data.get("subscriptions", {})
            if not subscriptions:
                continue

            for vps_key, vps_data in subscriptions.items():
                vps_name = vps_data.get("vps_name", vps_key)
                monthly_cost = vps_data.get("vps_monthly_cost", 0)
                billing_cycle_day = vps_data.get("billing_cycle_date", "1")
                next_billing_str = vps_data.get("next_billing_date")
                vps_status = vps_data.get("status", "active")
                expiry_date_str = vps_data.get("expiry_date")

                # Skip non-active VPS
                if vps_status and vps_status not in ("active",):
                    logger.info(f"[VPS BILLING] Skipping {vps_name}/{uid}: status={vps_status}")
                    continue

                # Check expiry date - warn if expired
                if expiry_date_str:
                    try:
                        expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
                        days_until_expiry = (expiry_date - today).days
                        if days_until_expiry <= 0:
                            logger.warning(f"[VPS BILLING] {vps_name}/{uid}: EXPIRED on {expiry_date_str}")
                            set_billing_trigger(firebase_db, "vps_expired", {
                                "user_id": uid, "vps_key": vps_key, "vps_name": vps_name,
                                "expiry_date": expiry_date_str, "days_expired": abs(days_until_expiry),
                            })
                        elif days_until_expiry <= 3:
                            logger.warning(f"[VPS BILLING] {vps_name}/{uid}: Expiring in {days_until_expiry}d!")
                            set_billing_trigger(firebase_db, "vps_expiry_warning", {
                                "user_id": uid, "vps_key": vps_key, "vps_name": vps_name,
                                "expiry_date": expiry_date_str, "days_remaining": days_until_expiry,
                            })
                    except ValueError:
                        logger.warning(f"[VPS BILLING] Invalid expiry_date: {expiry_date_str} for {vps_name}")

                # Calculate next_billing_date if empty
                if not next_billing_str:
                    try:
                        cycle_day = int(billing_cycle_day)
                    except (ValueError, TypeError):
                        cycle_day = 1
                    # Clamp to valid day
                    import calendar
                    last_day = calendar.monthrange(today.year, today.month)[1]
                    cycle_day = min(cycle_day, last_day)

                    candidate = date(today.year, today.month, cycle_day)
                    if candidate <= today:
                        # Move to next month
                        candidate += relativedelta(months=1)
                        last_day = calendar.monthrange(candidate.year, candidate.month)[1]
                        cycle_day = min(int(billing_cycle_day), last_day)
                        candidate = date(candidate.year, candidate.month, cycle_day)

                    next_billing_date = candidate
                    firebase_db.reference(
                        f"users/{uid}/subscriptions/{vps_key}/next_billing_date"
                    ).set(candidate.strftime("%Y-%m-%d"))
                    logger.info(f"[VPS BILLING] Set next_billing_date = {candidate} for {vps_name}/{uid}")
                else:
                    try:
                        next_billing_date = datetime.strptime(next_billing_str, "%Y-%m-%d").date()
                    except ValueError:
                        logger.warning(f"[VPS BILLING] Invalid date format: {next_billing_str} for {vps_name}")
                        continue

                days_remaining = (next_billing_date - today).days
                logger.info(f"[VPS BILLING] {vps_name}/{uid}: {days_remaining}d until {next_billing_date}")

                if days_remaining <= 3 and days_remaining > 1:
                    # H-3 WARNING
                    severity = "warning"
                    trigger_name = "vps_billing_warning"
                elif days_remaining <= 1:
                    # H-1 or overdue URGENT
                    severity = "urgent"
                    trigger_name = "vps_billing_urgent"
                else:
                    # Not yet time
                    continue

                # Generate VPS Invoice
                invoice_id = f"vps_{uid}_{vps_key}_{today.strftime('%Y%m%d')}"

                invoice_data = {
                    "type": "vps_rental",
                    "accountNumber": vps_name,
                    "user_id": uid,
                    "vps_key": vps_key,
                    "amount": float(monthly_cost),
                    "status": severity,
                    "description": f"VPS {vps_name} - {severity.upper()}: {days_remaining} day(s) remaining",
                    "due_date": next_billing_date.strftime("%Y-%m-%d"),
                    "billing_cycle_date": str(billing_cycle_day),
                    "created_at": int(time.time() * 1000),
                }

                firebase_db.reference(f"invoices/{invoice_id}").set(invoice_data)
                invoice_count += 1
                logger.info(f"[VPS BILLING] Invoice generated: {invoice_id} ({severity})")

                # Set billing trigger
                payload = {
                    "user_id": uid,
                    "vps_key": vps_key,
                    "vps_name": vps_name,
                    "amount": float(monthly_cost),
                    "due_date": next_billing_date.strftime("%Y-%m-%d"),
                    "days_remaining": days_remaining,
                    "invoice_id": invoice_id,
                }
                set_billing_trigger(firebase_db, trigger_name, payload)

                if severity == "warning":
                    warning_count += 1
                else:
                    urgent_count += 1

                # Auto-update next_billing_date if today is due date or past
                if days_remaining <= 0:
                    try:
                        cycle_day = int(billing_cycle_day)
                    except (ValueError, TypeError):
                        cycle_day = 1
                    import calendar
                    new_next = date(today.year, today.month, min(cycle_day, calendar.monthrange(today.year, today.month)[1]))
                    if new_next <= today:
                        new_next += relativedelta(months=1)
                        last_day = calendar.monthrange(new_next.year, new_next.month)[1]
                        new_next = date(new_next.year, new_next.month, min(cycle_day, last_day))
                    firebase_db.reference(
                        f"users/{uid}/subscriptions/{vps_key}/next_billing_date"
                    ).set(new_next.strftime("%Y-%m-%d"))
                    logger.info(f"[VPS BILLING] Updated next_billing_date -> {new_next} for {vps_name}")

        logger.info(
            f"[VPS BILLING] Complete. Warnings: {warning_count}, Urgent: {urgent_count}, Invoices: {invoice_count}"
        )

    except Exception as e:
        logger.error(f"[VPS BILLING] Error during VPS billing check: {e}")


# ============================================================================
# SECTION 3: VPS EXPIRY CHECK (NEW v2.2)
# ============================================================================

def check_vps_expiry(firebase_db) -> None:
    """
    Daily at 00:03 WITA.
    Check all VPS expiry dates and auto-suspend expired VPS.
    """
    logger.info("[VPS EXPIRY] Starting VPS expiry check...")

    try:
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get()

        if not all_users:
            return

        today = TODAY()
        expired_count = 0

        for uid, user_data in all_users.items():
            if user_data.get("role") != "investor":
                continue

            subscriptions = user_data.get("subscriptions", {})
            if not subscriptions:
                continue

            for vps_key, vps_data in subscriptions.items():
                vps_name = vps_data.get("vps_name", vps_key)
                expiry_date_str = vps_data.get("expiry_date")
                vps_status = vps_data.get("status", "active")

                if not expiry_date_str:
                    continue

                try:
                    expiry_date = datetime.strptime(expiry_date_str, "%Y-%m-%d").date()
                except ValueError:
                    continue

                days_until_expiry = (expiry_date - today).days

                if days_until_expiry <= 0 and vps_status == "active":
                    # Auto-suspend expired VPS
                    firebase_db.reference(
                        f"users/{uid}/subscriptions/{vps_key}/status"
                    ).set("expired")
                    logger.warning(f"[VPS EXPIRY] Auto-suspended {vps_name}/{uid}: expired {abs(days_until_expiry)}d ago")
                    set_billing_trigger(firebase_db, "vps_auto_suspended", {
                        "user_id": uid, "vps_key": vps_key, "vps_name": vps_name,
                        "expiry_date": expiry_date_str,
                    })
                    expired_count += 1

                elif days_until_expiry <= 3 and days_until_expiry > 0:
                    logger.warning(f"[VPS EXPIRY] {vps_name}/{uid}: Expiring in {days_until_expiry}d!")
                    set_billing_trigger(firebase_db, "vps_expiry_warning", {
                        "user_id": uid, "vps_key": vps_key, "vps_name": vps_name,
                        "expiry_date": expiry_date_str, "days_remaining": days_until_expiry,
                    })

        logger.info(f"[VPS EXPIRY] Complete. Auto-suspended: {expired_count}")

    except Exception as e:
        logger.error(f"[VPS EXPIRY] Error: {e}")


# ============================================================================
# SECTION 4: PROFIT SHARE INVOICE GENERATION
# ============================================================================

def is_first_saturday_of_month() -> bool:
    """True if today is the first Saturday of the current month."""
    today = TODAY()
    return today.weekday() == 5 and today.day <= 7


def generate_profit_share_invoices(firebase_db) -> None:
    """
    Runs daily at 08:00 WITA; only acts on first Saturday of the month.

    Data sources (UNIFIED):
      - users/{uid}/subscriptions/{vpsKey}/accounts/{accNum}/
          profit_share_percent, bot_start_date, last_invoiced_date
      - account_data/{accNum}/daily_history/{YYYY-MM-DD}/
          daily_profit

    Output:
      - invoices/{invoice_id}/  ->  type: profit_share
      - Update last_invoiced_date in users/.../accounts/{accNum}/
      - Trigger: profit_share_invoice_ready
    """
    today = TODAY()

    if not is_first_saturday_of_month():
        logger.info("[PROFIT SHARE] Not first Saturday. Skipping.")
        return

    logger.info("[PROFIT SHARE] First Saturday detected! Generating profit share invoices...")

    try:
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get()

        if not all_users:
            logger.info("[PROFIT SHARE] No users found. Skipping.")
            return

        generated_count = 0

        for uid, user_data in all_users.items():
            if user_data.get("role") != "investor":
                continue

            subscriptions = user_data.get("subscriptions", {})
            if not subscriptions:
                continue

            for vps_key, vps_data in subscriptions.items():
                accounts = vps_data.get("accounts", {})
                if not accounts:
                    continue

                for acc_num, acc_config in accounts.items():
                    try:
                        percentage = acc_config.get("profit_share_percent", 30)
                        last_invoiced_str = acc_config.get("last_invoiced_date")
                        bot_start_str = acc_config.get("bot_start_date")

                        # Determine period_start
                        if last_invoiced_str:
                            try:
                                period_start = datetime.strptime(last_invoiced_str, "%Y-%m-%d").date()
                                period_start += timedelta(days=1)
                            except ValueError:
                                logger.warning(f"[PROFIT SHARE] Invalid last_invoiced_date: {last_invoiced_str}")
                                if bot_start_str:
                                    try:
                                        period_start = datetime.strptime(bot_start_str, "%Y-%m-%d").date()
                                    except ValueError:
                                        period_start = date(today.year, today.month, 1)
                                else:
                                    period_start = date(today.year, today.month, 1)
                        elif bot_start_str:
                            try:
                                period_start = datetime.strptime(bot_start_str, "%Y-%m-%d").date()
                            except ValueError:
                                period_start = date(today.year, today.month, 1)
                        else:
                            period_start = date(today.year, today.month, 1)

                        period_end = today

                        # Fetch daily history from account_data/{accNum}/daily_history
                        total_profit = 0.0
                        daily_breakdown = []

                        daily_ref = firebase_db.reference(f"account_data/{acc_num}/daily_history")
                        daily_history = daily_ref.get()

                        if daily_history:
                            for date_str, day_data in daily_history.items():
                                try:
                                    day_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                                except ValueError:
                                    continue

                                if period_start <= day_date <= period_end:
                                    profit = (
                                        day_data.get("daily_profit")
                                        or day_data.get("profit")
                                        or 0
                                    )
                                    total_profit += profit
                                    daily_breakdown.append({
                                        "date": date_str,
                                        "profit": profit,
                                        "growth": day_data.get("daily_growth_percent")
                                                   or day_data.get("growth")
                                                   or 0,
                                        "lots": day_data.get("daily_lots")
                                                or day_data.get("lot")
                                                or 0,
                                    })

                        if total_profit <= 0:
                            logger.info(
                                f"[PROFIT SHARE] Account {acc_num}: No positive profit "
                                f"(${total_profit:.2f}). Skipping invoice."
                            )
                            continue

                        share_amount = total_profit * (percentage / 100.0)
                        invoice_id = f"ps_{acc_num}_{today.strftime('%Y%m%d')}"

                        invoice_data = {
                            "type": "profit_share",
                            "accountNumber": acc_num,
                            "user_id": uid,
                            "vps_key": vps_key,
                            "amount": round(share_amount, 2),
                            "status": "pending",
                            "description": (
                                f"Profit Share {period_start.strftime('%Y-%m-%d')} -> "
                                f"{period_end.strftime('%Y-%m-%d')}"
                            ),
                            "due_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
                            "period_start": period_start.strftime("%Y-%m-%d"),
                            "period_end": period_end.strftime("%Y-%m-%d"),
                            "total_profit": round(total_profit, 2),
                            "share_percentage": percentage,
                            "daily_breakdown": daily_breakdown,
                            "created_at": int(time.time() * 1000),
                        }

                        firebase_db.reference(f"invoices/{invoice_id}").set(invoice_data)
                        logger.info(
                            f"[PROFIT SHARE] Invoice: {invoice_id} | "
                            f"Profit: ${total_profit:.2f} | Share ({percentage}%): ${share_amount:.2f}"
                        )

                        # Update last_invoiced_date
                        firebase_db.reference(
                            f"users/{uid}/subscriptions/{vps_key}/accounts/{acc_num}/last_invoiced_date"
                        ).set(today.strftime("%Y-%m-%d"))

                        generated_count += 1

                    except Exception as e:
                        logger.error(
                            f"[PROFIT SHARE] Error processing {acc_num} for {uid}: {e}"
                        )

        if generated_count > 0:
            payload = {
                "invoices_generated": generated_count,
                "period": (
                    f"{date(today.year, today.month, 1).strftime('%Y-%m-%d')} "
                    f"-> {today.strftime('%Y-%m-%d')}"
                ),
            }
            set_billing_trigger(firebase_db, "profit_share_invoice_ready", payload)

        logger.info(f"[PROFIT SHARE] Complete. Generated: {generated_count}")

    except Exception as e:
        logger.error(f"[PROFIT SHARE] Error during invoice generation: {e}")


# ============================================================================
# SECTION 5: BOT START DATE DETECTION + METADATA BOOTSTRAP
# ============================================================================

def detect_and_set_bot_start_date(firebase_db) -> None:
    """
    Daily at 00:05 WITA.
    For every account in account_data/{accNum}/metadata,
    if bot_start_date is missing, set it to today.
    Also sync back to users/{uid}/subscriptions/{vpsKey}/accounts/{accNum}/bot_start_date.
    """
    logger.info("[BOOTSTRAP] Checking bot_start_date in account_data metadata...")

    try:
        acc_ref = firebase_db.reference("account_data")
        all_accounts = acc_ref.get()

        if not all_accounts:
            logger.info("[BOOTSTRAP] No account_data entries.")
            return

        today_str = TODAY().strftime("%Y-%m-%d")
        updated_count = 0

        for acc_num, acc_data in all_accounts.items():
            metadata = acc_data.get("metadata") or {}
            if not metadata.get("bot_start_date"):
                firebase_db.reference(f"account_data/{acc_num}/metadata/bot_start_date").set(today_str)
                logger.info(f"[BOOTSTRAP] Set bot_start_date = {today_str} for account {acc_num}")
                updated_count += 1

        # Also ensure all users/{uid}/subscriptions/.../accounts/{accNum}/ have bot_start_date
        users_ref = firebase_db.reference("users")
        all_users = users_ref.get() or {}

        for uid, user_data in all_users.items():
            if user_data.get("role") != "investor":
                continue
            subscriptions = user_data.get("subscriptions", {})
            for vps_key, vps_data in subscriptions.items():
                accounts = vps_data.get("accounts", {})
                for acc_num, acc_cfg in accounts.items():
                    if not acc_cfg.get("bot_start_date"):
                        # Try from account_data metadata
                        acc_meta = (all_accounts.get(acc_num) or {}).get("metadata") or {}
                        bs = acc_meta.get("bot_start_date", today_str)
                        firebase_db.reference(
                            f"users/{uid}/subscriptions/{vps_key}/accounts/{acc_num}/bot_start_date"
                        ).set(bs)
                        logger.info(f"[BOOTSTRAP] Synced bot_start_date = {bs} for {acc_num} (user {uid})")
                        updated_count += 1

        logger.info(f"[BOOTSTRAP] bot_start_date sync complete. Updated: {updated_count}")

    except Exception as e:
        logger.error(f"[BOOTSTRAP] Error: {e}")


# ============================================================================
# SECTION 6: DAILY PROFIT SNAPSHOT (ensures daily_history exists)
# ============================================================================

def daily_profit_snapshot(firebase_db) -> None:
    """
    Runs daily at 23:55 WITA.
    For each account in account_data/{accNum} with live balance/equity,
    ensure a daily_history/{today} entry exists for continuity.
    This is a safety net - the MT4/MT5 bot should already write this.
    """
    logger.info("[SNAPSHOT] Running daily profit snapshot check...")

    try:
        acc_ref = firebase_db.reference("account_data")
        all_accounts = acc_ref.get()

        if not all_accounts:
            return

        today_str = TODAY().strftime("%Y-%m-%d")
        snap_count = 0

        for acc_num, acc_data in all_accounts.items():
            existing_history = (acc_data.get("daily_history") or {}).get(today_str)
            if existing_history:
                continue  # Already exists

            balance = acc_data.get("balance") or acc_data.get("equity") or 0
            profit = acc_data.get("profit") or acc_data.get("daily_profit") or 0
            growth = acc_data.get("growth") or acc_data.get("daily_growth_percent") or 0
            lots = acc_data.get("lots") or acc_data.get("daily_lots") or 0

            snapshot = {
                "daily_profit": float(profit),
                "daily_growth_percent": float(growth),
                "daily_lots": float(lots),
                "balance": float(balance),
            }

            firebase_db.reference(f"account_data/{acc_num}/daily_history/{today_str}").set(
                snapshot
            )
            snap_count += 1

        if snap_count > 0:
            logger.info(f"[SNAPSHOT] Created {snap_count} daily history snapshots for {today_str}")

    except Exception as e:
        logger.error(f"[SNAPSHOT] Error: {e}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    config = load_config(CONFIG_PATH)
    fb_config = config.get("firebase", {})
    fb_db = init_firebase(fb_config)

    # Bootstrap: detect bot start dates on first run
    detect_and_set_bot_start_date(fb_db)

    # ====================================================================
    # SCHEDULE (WITA / Asia/Makassar)
    # ====================================================================

    # === Existing Triggers ===
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        getattr(schedule.every(), day).at("08:45").do(
            set_trigger, firebase_db=fb_db, trigger_name="morning_prep"
        )
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        getattr(schedule.every(), day).at("22:45").do(
            set_trigger, firebase_db=fb_db, trigger_name="daily_report"
        )
    schedule.every().saturday.at("07:05").do(
        set_trigger, firebase_db=fb_db, trigger_name="weekly_recap"
    )

    # === Billing & Expiry Jobs (v2.2) ===
    schedule.every().day.at("00:01").do(check_vps_billing_cycle, firebase_db=fb_db)
    schedule.every().day.at("00:03").do(check_vps_expiry, firebase_db=fb_db)
    schedule.every().day.at("00:05").do(detect_and_set_bot_start_date, firebase_db=fb_db)
    schedule.every().day.at("08:00").do(generate_profit_share_invoices, firebase_db=fb_db)
    schedule.every().day.at("23:55").do(daily_profit_snapshot, firebase_db=fb_db)

    # === Heartbeat ===
    schedule.every(2).minutes.do(reset_heartbeat, firebase_db=fb_db)
    reset_heartbeat(fb_db)  # Initial ping

    # === Graceful Shutdown ===
    def shutdown_handler(signum, frame):
        logger.info(f"Received signal {signum}. Shutting down...")
        try:
            fb_db.reference("cron_heartbeat").update({"status": "shutdown"})
        except Exception:
            pass
        logger.info("KRX Trigger Bot stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    # ====================================================================
    # BANNER & RUN
    # ====================================================================
    banner = f"""
+-----------------------------------------------------------+
|     KRX UNIFIED TRIGGER & BILLING ENGINE v2.2             |
|                                                           |
|  Timezone: Asia/Makassar (WITA / GMT+8)                  |
|  Firebase: {fb_config.get('database_url', 'N/A'):<45}|
|                                                           |
|  Schedule -- Triggers:                                    |
|    Morning Prep      : Mon-Fri 08:45 WITA                |
|    Daily Report      : Mon-Fri 22:45 WITA                |
|    Weekly Recap      : Sat 07:05 WITA                    |
|                                                           |
|  Schedule -- Billing (v2.2 UNIFIED PATHS):               |
|    VPS Billing Check : Daily 00:01 WITA                  |
|    VPS Expiry Check  : Daily 00:03 WITA                  |
|    Bot Start Detect  : Daily 00:05 WITA                  |
|    Profit Share Inv. : 1st Sat 08:00 WITA                |
|    Profit Snapshot   : Daily 23:55 WITA                  |
|    Heartbeat         : Every 2 minutes                   |
+-----------------------------------------------------------+
"""
    logger.info(banner)
    logger.info("KRX Unified Bot is RUNNING. Press Ctrl+C to stop.")

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()