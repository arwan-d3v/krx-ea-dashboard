# KRX Trigger Bot v2.2 - Windows VPS Deployment Guide

## Prerequisites

- Windows Server 2016+ or Windows 10/11 (any edition)
- Python 3.9+ installed (https://python.org)
- Internet connection
- Firebase Service Account JSON file (from Firebase Console)

## Step 1: Install Python

Download and install Python 3.9+ from https://python.org/downloads/

**IMPORTANT**: Check "Add Python to PATH" during installation.

Verify:
```
python --version
```

## Step 2: Copy Bot Files to VPS

Copy the entire `scripts/` folder to the VPS. Recommended path:
```
C:\KRX_Bot\
```

Your folder structure should be:
```
C:\KRX_Bot\
  krx_trigger_bot.py
  config.json
  requirements.txt
  service-account.json    <-- Your Firebase service account key
```

## Step 3: Configure config.json

Edit `config.json` and set:
```json
{
  "firebase": {
    "database_url": "https://YOUR-PROJECT.firebaseio.com",
    "service_account_path": "service-account.json"
  }
}
```

## Step 4: Install Dependencies

Open Command Prompt or PowerShell in `C:\KRX_Bot\`:
```
pip install -r requirements.txt
```

## Step 5: Test Run

```
python krx_trigger_bot.py
```

You should see the banner with schedule info. Press Ctrl+C to stop.

## Step 6: Run as Windows Service (24/7)

### Option A: Task Scheduler (Recommended)

1. Open Task Scheduler (search in Start menu)
2. Click "Create Basic Task"
3. Name: `KRX Trigger Bot`
4. Trigger: "When the computer starts"
5. Action: "Start a program"
   - Program: `C:\Python312\python.exe` (adjust path to your Python)
   - Arguments: `krx_trigger_bot.py`
   - Start in: `C:\KRX_Bot\`
6. Open task Properties:
   - Check "Run whether user is logged on or not"
   - Check "Run with highest privileges"
   - Settings: "If the task is already running" -> "Do not start a new instance"

### Option B: NSSM (Non-Sucking Service Manager)

1. Download NSSM: https://nssm.cc/download
2. Extract `nssm.exe` to `C:\KRX_Bot\`
3. Run as Administrator:
```
nssm install KRXTriggerBot
```
4. In the GUI:
   - Path: `C:\Python312\python.exe`
   - Startup directory: `C:\KRX_Bot\`
   - Arguments: `krx_trigger_bot.py`
5. Click "Install service"
6. Start:
```
nssm start KRXTriggerBot
```

### Option C: Python Script Wrapper

Create `start_bot.bat` in `C:\KRX_Bot\`:
```bat
@echo off
cd /d C:\KRX_Bot\
:loop
python krx_trigger_bot.py
echo Bot crashed, restarting in 30 seconds...
timeout /t 30
goto loop
```

Add this .bat to Task Scheduler as in Option A.

## Step 7: Verify Operation

Check the log file:
```
type C:\KRX_Bot\krx_trigger_bot.log
```

Check Firebase Console:
- `cron_heartbeat` should show `status: online`
- `system_triggers/morning_prep` should fire at 08:45 WITA

## Schedule Summary (WITA / GMT+8)

| Job                    | Schedule               | Description                          |
|------------------------|------------------------|--------------------------------------|
| Morning Prep           | Mon-Fri 08:45          | Daily morning trigger                |
| Daily Report           | Mon-Fri 22:45          | Evening trigger                      |
| Weekly Recap           | Sat 07:05              | Weekly summary trigger               |
| VPS Billing Check      | Daily 00:01            | Check billing dates, generate inv.   |
| VPS Expiry Check       | Daily 00:03            | Auto-suspend expired VPS             |
| Bot Start Detection    | Daily 00:05            | Bootstrap bot_start_date             |
| Profit Share Invoice   | 1st Sat 08:00          | Generate profit share invoices       |
| Profit Snapshot        | Daily 23:55            | Ensure daily_history completeness    |
| Heartbeat              | Every 2 minutes        | Keep-alive ping to Firebase          |

## Troubleshooting

### Bot won't start
- Check `config.json` path and Firebase URL
- Ensure `service-account.json` exists and is valid
- Run `pip install -r requirements.txt` again

### Bot stops after a few hours
- Use Task Scheduler or NSSM to auto-restart
- Check Windows Event Viewer for crash logs
- Check `krx_trigger_bot.log` for errors

### Firebase connection errors
- Verify internet connection
- Check Firebase project is active
- Ensure service account has Realtime Database permissions

### Timezone mismatch
- Bot uses `datetime.now()` which uses system timezone
- Set Windows timezone to UTC+8 (Makassar):
  Settings > Time & Language > Time zone > UTC+08:00

## Updating the Bot

1. Stop the service
2. Replace `krx_trigger_bot.py` with new version
3. Run `pip install -r requirements.txt` (if deps changed)
4. Start the service

## Security Notes

- Never commit `service-account.json` to Git
- Keep `config.json` out of version control
- Use Windows Firewall to restrict unnecessary ports
- Run the service under a dedicated Windows account with minimal permissions