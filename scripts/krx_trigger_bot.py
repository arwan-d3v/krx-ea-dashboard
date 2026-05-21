#!/usr/bin/env python3
"""
=============================================================================
KRX QUANTITATIVE - Pure VPS Trigger & Firebase Architecture
VPS Trigger Bot (Python 24/7 Scheduler)
=============================================================================

Fungsi: Berjalan 24/7 di VPS KRX. Tugasnya HANYA sebagai "Jam Weker Murni" 
yang mengirim sinyal (set trigger = true) ke Firebase Realtime Database 
pada jadwal yang telah ditentukan (WITA / Asia/Makassar).

Alur Kerja (The Workflow):
  1. THE REMINDER (Script ini) : Set trigger di Firebase (system_triggers/*)
  2. THE BRAIN (Dashboard)     : Next.js listener mendeteksi trigger, memproses
                                  data, menghitung, dan meracik pesan.
  3. THE MESSENGER (Bot)       : Dashboard mengirim notifikasi via Telegram Bot.

Keuntungan Arsitektur:
  - Tidak ada Endpoint API publik yang terekspos → Keamanan Maksimal.
  - Tidak ada batasan timeout dari layanan eksternal.
  - Firebase Realtime Database memastikan trigger dieksekusi dalam hitungan ms.

Jadwal Eksekusi (WITA / Asia/Makassar):
  A. Morning Prep & Monday Kickoff : 08:45 (Senin - Jumat)
  B. Daily Report                   : 22:45 (Senin - Jumat)
  C. Weekly Recap                   : 07:05 (Sabtu)

Author: KRX Quantitative Dev Team
Version: 1.0.0
Based on: KRX_VPS_Firebase_Trigger_Blueprint.txt
=============================================================================
"""

import os
import sys
import json
import time
import signal
import logging
from datetime import datetime

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional

# Third-party imports
try:
    import schedule
except ImportError:
    print("[ERROR] 'schedule' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

try:
    import firebase_admin
    from firebase_admin import credentials, db
except ImportError:
    print("[ERROR] 'firebase-admin' not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, "config.json")
LOG_PATH = os.path.join(SCRIPT_DIR, "krx_trigger_bot.log")

# Configure logging
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

# ============================================================================
# INITIALIZATION
# ============================================================================

def load_config(path: str) -> dict:
    """Load configuration from JSON file."""
    if not os.path.exists(path):
        logger.error(f"Config file not found: {path}")
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def init_firebase(fb_config: dict):
    """Initialize Firebase Admin SDK."""
    db_url = fb_config.get("database_url")
    sa_path = fb_config.get("service_account_path")

    if not sa_path:
        logger.error("service_account_path not found in config.json")
        sys.exit(1)

    full_sa_path = os.path.join(SCRIPT_DIR, sa_path)
    if not os.path.exists(full_sa_path):
        logger.error(f"Service account file not found: {full_sa_path}")
        logger.error("Download from: Firebase Console > Project Settings > Service Accounts")
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
# TRIGGER FUNCTIONS
# ============================================================================

def set_trigger(firebase_db, trigger_name: str) -> None:
    """
    Set a system trigger in Firebase Realtime Database.

    The Dashboard Next.js has a real-time listener on 'system_triggers'
    that will detect this change and execute the corresponding workflow.

    Args:
        firebase_db: Firebase database instance
        trigger_name: Name of trigger (e.g., 'morning_prep', 'daily_report', 'weekly_recap')
    """
    try:
        trigger_path = f"system_triggers/{trigger_name}"
        trigger_data = {
            "fired": True,
            "timestamp": int(time.time() * 1000),
            "gmt8_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "trigger_name": trigger_name,
        }
        firebase_db.reference(trigger_path).set(trigger_data)
        logger.info(f"✓ Trigger SET: {trigger_name} -> system_triggers/{trigger_name}")
    except Exception as e:
        logger.error(f"✗ Failed to set trigger [{trigger_name}]: {e}")

def reset_heartbeat(firebase_db) -> None:
    """Update heartbeat to signal script is alive."""
    try:
        heartbeat_data = {
            "last_ping": int(time.time() * 1000),
            "gmt8_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "online",
            "timezone": "Asia/Makassar",
        }
        firebase_db.reference("cron_heartbeat").set(heartbeat_data)
    except Exception as e:
        logger.error(f"Failed to update heartbeat: {e}")

# ============================================================================
# MAIN
# ============================================================================

def main():
    config = load_config(CONFIG_PATH)
    fb_config = config.get("firebase", {})
    fb_db = init_firebase(fb_config)

    # ── Jadwal Eksekusi (WITA / Asia/Makassar) ──

    # A. Morning Prep & Monday Kickoff (Senin - Jumat, 08:45)
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        getattr(schedule.every(), day).at("08:45").do(
            set_trigger, firebase_db=fb_db, trigger_name="morning_prep"
        )

    # B. Daily Report (Senin - Jumat, 22:45)
    for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
        getattr(schedule.every(), day).at("22:45").do(
            set_trigger, firebase_db=fb_db, trigger_name="daily_report"
        )

    # C. Weekly Recap (Sabtu, 07:05)
    schedule.every().saturday.at("07:05").do(
        set_trigger, firebase_db=fb_db, trigger_name="weekly_recap"
    )

    # Heartbeat setiap 2 menit
    schedule.every(2).minutes.do(reset_heartbeat, firebase_db=fb_db)

    # Initial heartbeat
    reset_heartbeat(fb_db)

    # Graceful shutdown
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

    # Banner
    banner = f"""
╔═══════════════════════════════════════════════════════════╗
║     KRX VPS TRIGGER BOT - Firebase Trigger Engine        ║
║                                                           ║
║  Timezone: Asia/Makassar (WITA / GMT+8)                  ║
║  Firebase: {fb_config.get('database_url', 'N/A'):<45}║
║                                                           ║
║  Schedule:                                                ║
║    Morning Prep   : Mon-Fri 08:45 WITA                   ║
║    Daily Report   : Mon-Fri 22:45 WITA                   ║
║    Weekly Recap   : Sat 07:05 WITA                       ║
║    Heartbeat      : Every 2 minutes                      ║
╚═══════════════════════════════════════════════════════════╝
"""
    logger.info(banner)
    logger.info("KRX Trigger Bot is RUNNING. Press Ctrl+C to stop.")

    while True:
        schedule.run_pending()
        time.sleep(30)

if __name__ == "__main__":
    main()