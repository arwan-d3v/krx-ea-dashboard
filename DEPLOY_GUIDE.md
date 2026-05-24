# 🚀 KRX EA Dashboard — Deployment Guide (VPS Windows)

> **Last Updated: 24 May 2026**  
> **Repository: https://github.com/arwan-d3v/krx-ea-dashboard**

---

## 📋 Daftar Isi

1. [Status Git & File Checklist](#1-status-git--file-checklist)
2. [Deploy Frontend ke Cloudflare Pages](#2-deploy-frontend-ke-cloudflare-pages)
3. [Setup Python Trigger Bot di VPS Windows](#3-setup-python-trigger-bot-di-vps-windows)
4. [Menjalankan Bot 24/7 di Windows Background](#4-menjalankan-bot-247-di-windows-background)
5. [Verifikasi & Testing](#5-verifikasi--testing)
6. [Billing & Subscription Architecture](#6-billing--subscription-architecture)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Status Git & File Checklist

### ✅ Semua File Sudah Ter-Commit & Ter-Push

```
Branch: main
Remote: origin -> https://github.com/arwan-d3v/krx-ea-dashboard.git
Status: working tree clean (up to date)
```

### 📁 File yang Sudah di-Repo:

| File | Status | Fungsi |
|------|--------|--------|
| `scripts/krx_trigger_bot.py` | ✅ Pushed | Python scheduler 24/7 (trigger + billing + notifikasi) |
| `scripts/config.json` | ✅ Pushed | Konfigurasi Firebase URL & jadwal cron |
| `scripts/requirements.txt` | ✅ Pushed | Dependencies Python |
| `src/app/api/telegram/notify/route.js` | ✅ Pushed | API route Telegram notification handler |
| `src/app/api/notify/route.js` | ✅ Pushed | API route Telegram generic notify |
| `src/components/SystemTriggerListener.jsx` | ✅ Pushed | React listener Firebase real-time trigger |
| `src/lib/firebase.js` | ✅ Pushed | Firebase client configuration |
| `next.config.mjs` | ✅ Pushed | Next.js config |
| `firebase-rules.json` | ✅ Pushed | Firebase Realtime Database security rules |
| `src/app/onboarding/page.js` | ✅ Pushed | Halaman onboarding investor baru |
| `src/app/user-management/page.js` | ✅ Pushed | Manual Register (Super Admin) |
| `src/app/subscription-area/page.js` | ✅ Pushed | Subscription Area (Super Admin) |
| `src/app/analytics/page.js` | ✅ Pushed | Investor Analytics Calendar View |
| `src/app/investor-subscription/page.js` | ✅ Pushed | Investor Subscription Area |

### ⚠️ File yang TIDAK di-Repo (dan seharusnya):

| File | Alasan |
|------|--------|
| `.env*` | Gitignored — berisi secret keys |
| `scripts/serviceAccountKey.json` | HARUS di-upload manual ke VPS Windows |
| `node_modules/` | Gitignored |

---

## 2. Deploy Frontend ke Cloudflare Pages

### 2.1 Prerequisites

- Akun Cloudflare (daftar gratis di https://dash.cloudflare.com)
- Repository GitHub `arwan-d3v/krx-ea-dashboard` sudah ter-push
- Node.js 18+ terinstall di lokal

### 2.2 Deploy via Cloudflare Dashboard

**Step 1: Login ke Cloudflare Dashboard**
```
https://dash.cloudflare.com
```

**Step 2: Buat Project Pages baru**
1. Klik menu **Workers & Pages** di sidebar kiri
2. Klik **Create Application**
3. Pilih tab **Pages**
4. Klik **Connect to Git**

**Step 3: Hubungkan GitHub Repository**
1. Authorize Cloudflare untuk mengakses GitHub Anda
2. Pilih repository `arwan-d3v/krx-ea-dashboard`
3. Klik **Begin Setup**

**Step 4: Konfigurasi Build**

| Setting | Value |
|---------|-------|
| **Production branch** | `main` |
| **Framework preset** | `Next.js` |
| **Build command** | `npm run build` |
| **Build output directory** | `.next` |
| **Node.js version** | `18` atau `20` |

**Step 5: Environment Variables**

Klik **Add variable** dan masukkan:

```
TELEGRAM_BOT_TOKEN          = 8990692151:AAHOS2dls1dAFfXaMzSQOVZCumLcLyhM9lY
TELEGRAM_SUPER_ADMIN_ID     = 1111325338
TELEGRAM_ADMIN_GROUP_ID     = -1003540250006
TELEGRAM_TOPIC_APPROVAL     = 2076
TELEGRAM_TOPIC_LOGS         = 2076
NEXT_PUBLIC_BASE_URL        = https://krx-ea.pages.dev
```

> ⚠️ **Ganti `NEXT_PUBLIC_BASE_URL`** sesuai domain Cloudflare Pages Anda!

**Step 6: Deploy**
1. Klik **Save and Deploy**
2. Tunggu build selesai (1-3 menit)
3. Akses di: `https://krx-ea.pages.dev`

---

## 3. Setup Python Trigger Bot di VPS Windows

> ⚠️ **PENTING**: Panduan ini khusus untuk **VPS Windows Server 2016/2019/2022**.  
> Bot berjalan 24/7 menggunakan **Windows Service (NSSM)** — tanpa perlu logout.

### 3.1 Prasyarat di VPS Windows

Sebelum mulai, pastikan VPS Windows Anda sudah terinstall:

| Software | Cara Cek | Download Link |
|----------|----------|---------------|
| **Python 3.10+** | Buka `cmd`, ketik `python --version` | https://www.python.org/downloads/ |
| **Git** | Buka `cmd`, ketik `git --version` | https://git-scm.com/download/win |
| **NSSM** (Non-Sucking Service Manager) | — | https://nssm.cc/download |

> ✅ **Saat install Python**: Centang ✅ **"Add Python to PATH"** dan ✅ **"Install pip"**.  
> ✅ **Saat install Git**: Pilih opsi **"Git from the command line and also from 3rd-party software"**.

### 3.2 Download / Clone Repository ke VPS Windows

Buka **Command Prompt (cmd)** sebagai **Administrator**, lalu jalankan:

```cmd
REM === 1. Buat folder untuk bot ===
mkdir C:\opt\krx-trigger-bot
cd C:\opt\krx-trigger-bot

REM === 2. Clone repository (hanya folder scripts) ===
git clone --depth 1 --filter=blob:none --sparse https://github.com/arwan-d3v/krx-ea-dashboard.git temp-repo
cd temp-repo
git sparse-checkout set scripts
cd ..

REM === 3. Copy file scripts ke C:\opt\krx-trigger-bot ===
xcopy /E /Y temp-repo\scripts\* C:\opt\krx-trigger-bot\

REM === 4. Hapus folder temp ===
rmdir /S /Q temp-repo

REM === 5. Verifikasi file ===
dir C:\opt\krx-trigger-bot
REM Harus terlihat: krx_trigger_bot.py, config.json, requirements.txt
```

> **Alternatif**: Jika sudah clone full repo di lokal, cukup upload via RDP / FTP / OneDrive / Google Drive. Pastikan ketiga file ada di `C:\opt\krx-trigger-bot\`.

### 3.3 Upload Service Account Key Firebase ke VPS

> ⚠️ **PENTING**: File ini berisi kredensial rahasia — **JANGAN** di-push ke GitHub!

**Cara mendapatkan `serviceAccountKey.json`:**

1. Buka https://console.firebase.google.com
2. Pilih project Firebase Anda
3. Klik ⚙️ **Project Settings** → tab **Service Accounts**
4. Klik **Generate New Private Key**
5. File `.json` akan otomatis terdownload

**Upload ke VPS Windows:**
- Copy file `serviceAccountKey.json` ke folder `C:\opt\krx-trigger-bot\`
- Verifikasi:
```cmd
dir C:\opt\krx-trigger-bot\serviceAccountKey.json
```

### 3.4 Install Dependencies Python

**Buka Command Prompt (cmd) sebagai Administrator**, lalu jalankan:

```cmd
REM === 1. Masuk ke folder bot ===
cd C:\opt\krx-trigger-bot

REM === 2. Buat virtual environment ===
python -m venv venv

REM === 3. Aktifkan virtual environment ===
venv\Scripts\activate

REM === 4. Upgrade pip ===
python -m pip install --upgrade pip

REM === 5. Install semua dependencies ===
pip install -r requirements.txt

REM === 6. Verifikasi instalasi ===
python -c "import firebase_admin; import schedule; print('✅ All dependencies OK')"
```

Output yang diharapkan:
```
✅ All dependencies OK
```

Isi `requirements.txt` yang harus terinstall:
```
firebase-admin
schedule
python-telegram-bot
python-dotenv
requests
```

### 3.5 Set Timezone ke WITA (Asia/Makassar, UTC+8)

Di VPS Windows, buka **PowerShell sebagai Administrator**:

```powershell
# Cek timezone saat ini
Get-TimeZone

# Set ke Singapore Standard Time (UTC+8 — sama dengan WITA)
Set-TimeZone -Id "Singapore Standard Time"

# Verifikasi
Get-TimeZone
# Output: Id: Singapore Standard Time, DisplayName: (UTC+08:00) Kuala Lumpur, Singapore
```

> ℹ️ Windows tidak memiliki timezone khusus "Makassar". Gunakan **"Singapore Standard Time"** yang juga UTC+8 (sama dengan WITA). Atau jika tersedia:
> ```powershell
> tzutil /l | findstr /i "utc+08"
> tzutil /s "Singapore Standard Time"
> ```

Verifikasi dengan:
```cmd
REM === Cek waktu saat ini ===
date /t
time /t
REM Pastikan sesuai WITA (contoh: Sat 05/24/2026  23:45)
```

### 3.6 Cek Environment Variable (Opsional tapi Direkomendasikan)

```cmd
REM === 1. Buat file .env di folder bot ===
echo TELEGRAM_BOT_TOKEN=8990692151:AAHOS2dls1dAFfXaMzSQOVZCumLcLyhM9lY > C:\opt\krx-trigger-bot\.env
echo TELEGRAM_SUPER_ADMIN_ID=1111325338 >> C:\opt\krx-trigger-bot\.env
echo TELEGRAM_ADMIN_GROUP_ID=-1003540250006 >> C:\opt\krx-trigger-bot\.env
echo FIREBASE_DB_URL=https://krx-modern-dev-default-rtdb.asia-southeast1.firebasedatabase.app >> C:\opt\krx-trigger-bot\.env

REM === 2. Verifikasi ===
type C:\opt\krx-trigger-bot\.env
```

> ⚠️ **Ganti `FIREBASE_DB_URL`** dengan URL Firebase Realtime Database Anda yang sebenarnya (cek di Firebase Console → Realtime Database → URL di bagian atas).

### 3.7 Test Run Manual (PENTING — Lakukan Sebelum Install Service!)

```cmd
cd C:\opt\krx-trigger-bot
venv\Scripts\activate
python krx_trigger_bot.py
```

Output yang diharapkan:
```
╔═══════════════════════════════════════════════════════════╗
║     KRX VPS TRIGGER BOT - Firebase Trigger Engine        ║
║  Timezone: Asia/Makassar (WITA / GMT+8)                  ║
║  Firebase: https://krx-modern-dev-default-rtdb...        ║
╚═══════════════════════════════════════════════════════════╝
KRX Trigger Bot is RUNNING. Press Ctrl+C to stop.
```

**Biarkan berjalan ~2 menit**, lalu cek di Firebase Console apakah:
- `cron_heartbeat/last_ping` terupdate
- `cron_heartbeat/status` = `"online"`

Setelah konfirmasi berhasil, **tekan `Ctrl+C`** untuk menghentikan bot.

---

## 4. Menjalankan Bot 24/7 di Windows Background

Ada **3 metode** untuk menjalankan Python script 24/7 di Windows. **Pilih salah satu**.

### ⭐ METODE A: NSSM (Windows Service) — PALING DIREKOMENDASIKAN

NSSM mengubah script Python menjadi **Windows Service** resmi — auto-start saat boot, auto-restart jika crash, tidak perlu login user.

#### Step 1: Download & Install NSSM

1. Download NSSM: https://nssm.cc/download
2. Extract file zip
3. Copy `nssm.exe` (pilih folder `win64` jika VPS 64-bit) ke `C:\Windows\System32\`

```cmd
REM === Verifikasi NSSM terinstall ===
where nssm
REM Output: C:\Windows\System32\nssm.exe
```

#### Step 2: Buat Windows Service untuk Bot

Buka **Command Prompt (cmd) sebagai Administrator**:

```cmd
REM === Install service baru ===
nssm install KRXTriggerBot
```

Akan muncul **GUI popup window** NSSM. Isi sebagai berikut:

**Tab "Application":**

| Field | Value |
|-------|-------|
| **Path** | `C:\opt\krx-trigger-bot\venv\Scripts\python.exe` |
| **Startup directory** | `C:\opt\krx-trigger-bot` |
| **Arguments** | `C:\opt\krx-trigger-bot\krx_trigger_bot.py` |

**Tab "Details":**

| Field | Value |
|-------|-------|
| **Display name** | `KRX Trigger Bot - Firebase Scheduler` |
| **Description** | `KRX EA Dashboard: Trigger Bot + Billing Engine (24/7)` |
| **Startup type** | `Automatic` |

**Tab "Exit actions":**

| Field | Value |
|-------|-------|
| **Exit action (first)** | `Restart application` |
| **Delay restart (first)** | `10000` (10 detik dalam ms) |

> ⚠️ **PENTING**: Pada tab "Exit actions", pastikan restart delay **minimal 10000 ms**. Tanpa delay, Windows pump/filter bisa reject jika service gagal berturut-turut.

Klik **Install service**.

#### Step 3: Start Service

```cmd
REM === Start service ===
nssm start KRXTriggerBot

REM === Cek status ===
nssm status KRXTriggerBot
REM Output: SERVICE_RUNNING

REM === Cek di Windows Services GUI ===
services.msc
REM Cari "KRX Trigger Bot - Firebase Scheduler"
```

#### Step 4: Verifikasi Service Berjalan

```cmd
REM === Cek log NSSM ===
nssm rotate KRXTriggerBot
type C:\opt\krx-trigger-bot\nssm.log

REM === Atau cek langsung dari Event Viewer ===
eventvwr.msc
REM Buka "Windows Logs" → "Application" → cari source "KRXTriggerBot"
```

#### Step 5: Cek Heartbeat di Firebase

Buka https://console.firebase.google.com → Realtime Database → `cron_heartbeat`

Pastikan:
- `last_ping` → terupdate setiap 2 menit
- `status` → `"online"`
- `gmt8_time` → menampilkan waktu saat ini (WITA)

---

### ⭐ METODE B: Task Scheduler (Windows Built-in) — Alternatif Tanpa Install Software

Gunakan **Windows Task Scheduler** bawaan untuk menjalankan script setiap kali sistem boot.

#### Step 1: Buat Batch File Runner

Buat file `C:\opt\krx-trigger-bot\start_bot.bat`:

```cmd
REM === Buat batch file ===
echo @echo off > C:\opt\krx-trigger-bot\start_bot.bat
echo cd /d C:\opt\krx-trigger-bot >> C:\opt\krx-trigger-bot\start_bot.bat
echo set PYTHONUNBUFFERED=1 >> C:\opt\krx-trigger-bot\start_bot.bat
echo venv\Scripts\python.exe krx_trigger_bot.py ^>^> bot.log 2^>^&1 >> C:\opt\krx-trigger-bot\start_bot.bat
```

> Alternatif: Buka Notepad, copy-paste:
> ```bat
> @echo off
> cd /d C:\opt\krx-trigger-bot
> set PYTHONUNBUFFERED=1
> venv\Scripts\python.exe krx_trigger_bot.py >> bot.log 2>&1
> ```

#### Step 2: Buat Scheduled Task

Buka **Task Scheduler** (cari di Start Menu), atau via cmd:

```cmd
REM === Buat task dengan trigger saat system startup ===
schtasks /create /tn "KRX Trigger Bot" /tr "C:\opt\krx-trigger-bot\start_bot.bat" /sc onstart /ru SYSTEM /rl HIGHEST /f

REM === Verifikasi task terbuat ===
schtasks /query /tn "KRX Trigger Bot"
```

#### Step 3: Test Manual Task

```cmd
REM === Run task manual ===
schtasks /run /tn "KRX Trigger Bot"

REM === Cek apakah berjalan ===
tasklist | findstr /i python
REM Harus muncul python.exe

REM === Cek log ===
type C:\opt\krx-trigger-bot\bot.log
```

**Kelebihan**: Tidak perlu install software tambahan.  
**Kekurangan**: Jika script crash, tidak auto-restart sampai reboot berikutnya.

---

### ⭐ METODE C: PM2 for Windows — Untuk Yang Familiar Node.js

Jika di VPS Windows sudah terinstall Node.js:

```cmd
REM === Install PM2 global ===
npm install -g pm2

REM === Install pm2-windows-startup ===
npm install -g pm2-windows-startup
pm2-startup install

REM === Start bot ===
cd C:\opt\krx-trigger-bot
pm2 start krx_trigger_bot.py --name krx-bot --interpreter venv\Scripts\python.exe

REM === Save PM2 process list ===
pm2 save

REM === Cek status ===
pm2 status
pm2 logs krx-bot
```

**Kelebihan**: Auto-restart jika crash, dashboard monitoring, log management.  
**Kekurangan**: Perlu install Node.js terlebih dahulu.

---

### 📊 Rangkuman Perbandingan Metode

| Fitur | NSSM (A) | Task Scheduler (B) | PM2 (C) |
|-------|----------|-------------------|---------|
| Install software tambahan | NSSM (3MB) | Tidak perlu | Node.js + PM2 |
| Auto-start saat boot | ✅ | ✅ | ✅ |
| Auto-restart jika crash | ✅ | ❌ | ✅ |
| Log management | Via Event Viewer / file | Via file .log | `pm2 logs` |
| Monitoring real-time | Manual | Manual | `pm2 monit` |
| Kompleksitas setup | Medium | Low | Medium |
| **Rekomendasi** | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |

---

## 5. Verifikasi & Testing

### 5.1 Cek Dashboard Cloudflare Pages

```cmd
REM Pastikan bisa diakses
start https://krx-ea.pages.dev
```

**Verifikasi checklist:**
- ✅ Login page muncul tanpa error
- ✅ Dashboard bisa diakses setelah login
- ✅ Tidak ada error di browser console (F12 → Console)
- ✅ SystemTriggerListener mendeteksi trigger dari Firebase (cek browser console)

### 5.2 Cek Service Bot di VPS Windows

```cmd
REM === NSSM ===
nssm status KRXTriggerBot

REM === Task Scheduler ===
schtasks /query /tn "KRX Trigger Bot"

REM === Cek apakah python.exe berjalan ===
tasklist | findstr /i python
REM Harus muncul python.exe (PID, memory usage)
```

### 5.3 Cek Heartbeat di Firebase Console

Buka https://console.firebase.google.com → Realtime Database → Data:

Path yang harus terisi:
```
cron_heartbeat/
├── last_ping: 1716562800
├── gmt8_time: "2026-05-24 23:45:00"
├── status: "online"
└── timezone: "Asia/Makassar"
```

> Jika `last_ping` update setiap ~2 menit → bot berjalan normal.

### 5.4 Test Trigger Manual

1. Buka Firebase Console → Realtime Database
2. Buka node `system_triggers/`
3. Klik `+` tambah child → nama: `morning_prep`
4. Tambah properti:
   - `fired`: `true`
   - `timestamp`: (current Unix timestamp, cek di https://www.unixtimestamp.com)
   - `gmt8_time`: `"2026-05-24 23:45:00"`
5. Dalam ~5 detik, seharusnya:
   - SystemTriggerListener (di dashboard browser) mendeteksi trigger
   - Telegram bot mengirim pesan ke Admin Group
   - Log di VPS: `[VPS Bot] Trigger fired: morning_prep`

### 5.5 Cek Semua Firebase Path Baru

```
daily_profit_history/
invoices/
onboarding_requests/
profit_sharing_config/
billing_config/
subscription_data/
```

Semua path harus sudah bisa dibaca/tulis sesuai rules di `firebase-rules.json`.

---

## 6. Billing & Subscription Architecture (v2.1 UNIFIED)

### 6.1 Unified Firebase Data Paths

```
Firebase Realtime Database — Single Source of Truth (v2.1):
├── users/
│   └── {uid}/
│       ├── name, email, telegram_id, role
│       └── subscriptions/
│           └── {vpsKey}/                         ← vps-1, vps-2, ...
│               ├── vps_name: string
│               ├── vps_monthly_cost: number
│               ├── billing_cycle_date: string      ← "1"–"28"
│               ├── next_billing_date: string       ← "2026-06-01"
│               ├── status: "active" | "suspended"
│               └── accounts/
│                   └── {accNum}/                   ← 12345678
│                       ├── profit_share_percent: number (0–100)
│                       ├── bot_start_date: string   ← "2026-05-25"
│                       └── last_invoiced_date: string
├── account_data/
│   └── {accNum}/
│       ├── balance, equity, profit, lots (live)
│       ├── metadata/
│       │   ├── broker_server, investor_name, vps_name
│       │   ├── bot_start_date: string              ← set by script.py
│       │   └── ...
│       └── daily_history/
│           └── {YYYY-MM-DD}/
│               ├── daily_profit: number            ← from MT4/MT5 EA bot
│               ├── daily_growth_percent: number
│               ├── daily_lots: number
│               └── balance: number
├── invoices/
│   └── {invoice_id}/
│       ├── type: "vps_rental" | "profit_share"
│       ├── accountNumber: string                   ← account number
│       ├── user_id: string
│       ├── vps_key: string
│       ├── amount: number
│       ├── status: "pending" | "warning" | "urgent" | "paid" | "overdue"
│       ├── description: string
│       ├── due_date: string
│       ├── billing_cycle_date: string
│       ├── period_start: string                    ← profit share only
│       ├── period_end: string                      ← profit share only
│       ├── total_profit: number                    ← profit share only
│       ├── share_percentage: number                ← profit share only
│       ├── daily_breakdown: [...]                  ← profit share only
│       └── created_at: number (Unix ms)
├── system_triggers/
│   ├── morning_prep/
│   ├── daily_report/
│   ├── weekly_recap/
│   ├── vps_billing_warning/                        ← H-3 VPS reminder
│   ├── vps_billing_urgent/                         ← H-1 VPS reminder
│   └── profit_share_invoice_ready/                 ← 1st Sat generation
├── onboarding_requests/
│   └── {request_id}/
│       ├── name, email, telegram_id
│       ├── status: "pending_setup"
│       └── created_at: number
├── cron_heartbeat/
│   ├── last_ping: number
│   ├── gmt8_time: string
│   ├── status: "online" | "shutdown"
│   └── timezone: "Asia/Makassar"
├── profit_sharing_config/                          ← legacy; superseded
├── billing_config/                                 ← legacy; superseded
└── subscription_data/                              ← legacy; superseded
```

> ⚠️ **Legacy paths**: `profit_sharing_config`, `billing_config`, `subscription_data` are superseded by `users/{uid}/subscriptions/`. Keep them for backward compatibility.

### 6.2 Python Bot Billing Modules (`krx_trigger_bot.py`)

The unified `scripts/krx_trigger_bot.py` now includes:

1. **VPS Billing Notification (Cron: 00:01 WITA daily)**
   - Checks `billing_cycle_date` for each user's VPS subscription
   - H-3: Sends "WARNING" notification via Telegram
   - H-1: Sends "URGENT" notification via Telegram
   - Trigger type: `vps_billing_warning` / `vps_billing_urgent`

2. **Profit Share Invoice Generation (Cron: First Saturday, 08:00 WITA)**
   - Aggregates `daily_profit_history` since last invoice or `bot_start_date`
   - Multiplies by `profit_sharing_config/{account}/percentage`
   - Generates invoice in Firebase `invoices/` node
   - Trigger type: `profit_share_invoice_generated`

### 6.3 Frontend Components Added

| Component | Path | Description |
|-----------|------|-------------|
| Onboarding | `src/app/onboarding/page.js` | Name, Email, Telegram ID → pending_setup |
| Investor Analytics | `src/app/analytics/page.js` | Calendar view, Lot Volume, % Growth, Nominal Profit |
| Investor Subscription | `src/app/investor-subscription/page.js` | VPS + Profit Share invoices, tg://msg URL scheme |
| Super Admin Subscription | `src/app/subscription-area/page.js` | TreeView hierarchy + Billing Center |
| User Management | `src/app/user-management/page.js` | Manual Register form for Super Admin |

### 6.4 Local Testing Protocol — Billing

```cmd
REM === 1. Jalankan bot di local ===
cd C:\opt\krx-trigger-bot
venv\Scripts\activate
python krx_trigger_bot.py

REM === 2. Set data dummy di Firebase Console ===
REM    - daily_profit_history/{account}/{YYYY-MM-DD}/daily_profit = 50.25
REM    - profit_sharing_config/{account}/percentage = 30
REM    - billing_config/vps_monthly_rate = 15
REM    - subscription_data/{user_id}/vps_subscriptions/...

REM === 3. Test invoice generation manual ===
REM    Set system_triggers/profit_share_invoice_test/fired = true di Firebase

REM === 4. Verify frontend ===
start https://localhost:3000
REM    Login sebagai investor → Investor Subscription tab
REM    Login sebagai super_admin → Subscription Area tab
```

---

## 7. Troubleshooting

### 7.1 Bot Tidak Berjalan / Service Stopped

**Cek Event Viewer Windows:**
```cmd
eventvwr.msc
```
Buka **Windows Logs → Application**, cari error dari source `KRXTriggerBot` atau `Python`.

**Cek log manual (jika pakai batch file):**
```cmd
type C:\opt\krx-trigger-bot\bot.log
```

**Penyebab umum:**
1. `serviceAccountKey.json` tidak ada atau invalid
2. Firebase URL salah di `config.json`
3. Koneksi internet VPS terputus
4. Python virtual environment corrupt → rebuild venv (Step 3.4)

### 7.2 Error: "No module named 'firebase_admin'"

```cmd
cd C:\opt\krx-trigger-bot
venv\Scripts\activate
pip install --force-reinstall -r requirements.txt
```

### 7.3 Error: "Firebase credentials not found"

Pastikan `serviceAccountKey.json` ada di folder yang benar:
```cmd
dir C:\opt\krx-trigger-bot\serviceAccountKey.json
```

Dan pastikan `config.json` isinya benar:
```cmd
type C:\opt\krx-trigger-bot\config.json
```

### 7.4 Timezone Bot Tidak Sesuai WITA

```powershell
# Cek timezone Windows
Get-TimeZone

# Set ke UTC+8
Set-TimeZone -Id "Singapore Standard Time"

# Restart bot
nssm restart KRXTriggerBot
```

### 7.5 Service Berhenti Setelah Windows Update / Reboot

**Untuk NSSM**: Service sudah auto-restart (pastikan Startup type = Automatic)

```cmd
REM === Cek startup type ===
sc qc KRXTriggerBot
REM Cari: START_TYPE : 2 AUTO_START

REM === Jika bukan AUTO_START ===
sc config KRXTriggerBot start=auto
```

### 7.6 Error: "pip is not recognized"

```cmd
REM === Re-install pip ===
python -m ensurepip --upgrade
python -m pip install --upgrade pip
```

### 7.7 Windows Firewall Block Koneksi Firebase

```cmd
REM === Tambahkan rule untuk Python ===
netsh advfirewall firewall add rule name="Python Outbound" dir=out action=allow program="C:\opt\krx-trigger-bot\venv\Scripts\python.exe" enable=yes
```

### 7.8 Memonitor Resource Usage Bot

```cmd
REM === Cek CPU & Memory python.exe ===
tasklist /v | findstr python

REM === Atau buka Task Manager ===
taskmgr
REM Cari python.exe di tab "Details"
```

---

## 📊 Ringkasan Arsitektur (Windows VPS Edition)

```
┌─────────────────────────────────────────────────────────────────┐
│                    KRX EA DASHBOARD v2                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐   ┌──────────────────┐   ┌─────────────┐ │
│  │  VPS Windows     │   │  Cloudflare      │   │  Telegram   │ │
│  │  (Python 24/7)   │──▶│  Pages (Next.js) │──▶│  Bot API    │ │
│  │                   │   │                  │   │             │ │
│  │  NSSM Service:    │   │  - Dashboard UI  │   │  - Admin    │ │
│  │  - Morning Prep   │   │  - API Routes    │   │  - Groups   │ │
│  │  - Daily Report   │   │  - Listener      │   │  - Topics   │ │
│  │  - Weekly Recap   │   │  - Analytics     │   │             │ │
│  │  - VPS Billing ⚡ │   │  - Subscription  │   │             │ │
│  │  - Profit Share ⚡│   │  - Onboarding    │   │             │ │
│  └────────┬─────────┘   └────────┬─────────┘   └─────────────┘ │
│           │                      │                              │
│           └──────────┬───────────┘                              │
│                      │                                          │
│          ┌───────────▼───────────┐                              │
│          │   Firebase Realtime   │                              │
│          │       Database        │                              │
│          │                       │                              │
│          │  system_triggers      │                              │
│          │  cron_heartbeat       │                              │
│          │  daily_profit_history │                              │
│          │  invoices             │                              │
│          │  profit_sharing_config│                              │
│          │  billing_config       │                              │
│          └───────────────────────┘                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

FLOW:
1. VPS Windows Bot (NSSM Service) → Set trigger di Firebase setiap jadwal
2. Cloudflare Pages Listener → Deteksi trigger yang fired
3. Cloudflare Pages API → Proses & kirim notifikasi ke Telegram
4. Semua data disimpan & dibaca dari Firebase Realtime Database
```

---

## 📝 Final Deployment Checklist

- [ ] Semua file sudah ter-push ke GitHub
- [ ] Cloudflare Pages project dibuat & terhubung GitHub
- [ ] Environment variables di-set di Cloudflare Dashboard
- [ ] Build & deploy Cloudflare berhasil
- [ ] Python 3.10+ terinstall di VPS Windows
- [ ] Virtual environment bot dibuat & dependencies terinstall
- [ ] `serviceAccountKey.json` di-upload ke `C:\opt\krx-trigger-bot\`
- [ ] Timezone Windows di-set ke `Singapore Standard Time` (UTC+8 / WITA)
- [ ] Test manual `python krx_trigger_bot.py` berhasil
- [ ] NSSM service terinstall & berjalan (status: SERVICE_RUNNING)
- [ ] Heartbeat muncul di Firebase `cron_heartbeat/status = "online"`
- [ ] Test trigger manual via Firebase Console
- [ ] Verifikasi Telegram notification terkirim
- [ ] Cek semua path Firebase baru (`daily_profit_history`, `invoices`, dll)
- [ ] Dashboard frontend bisa diakses tanpa error

---

**Repository: https://github.com/arwan-d3v/krx-ea-dashboard**  
**Last Updated: 2026-05-24 | VPS Windows Edition**