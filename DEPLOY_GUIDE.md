# 🚀 KRX EA Dashboard - Deployment Guide

## 📋 Daftar Isi

1. [Status Git & File Checklist](#1-status-git--file-checklist)
2. [Deploy ke Cloudflare Pages](#2-deploy-ke-cloudflare-pages)
3. [Setup Python Trigger Bot di VPS](#3-setup-python-trigger-bot-di-vps)
4. [Verifikasi & Testing](#4-verifikasi--testing)
5. [Troubleshooting](#5-troubleshooting)

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
| `scripts/krx_trigger_bot.py` | ✅ Pushed | Python scheduler 24/7 untuk Firebase trigger |
| `scripts/config.json` | ✅ Pushed | Konfigurasi Firebase URL & jadwal |
| `scripts/requirements.txt` | ✅ Pushed | Dependencies Python (firebase-admin, schedule, dotenv) |
| `src/app/api/telegram/notify/route.js` | ✅ Pushed | API route Telegram notification handler |
| `src/app/api/notify/route.js` | ✅ Pushed | API route Telegram generic notify |
| `src/components/SystemTriggerListener.jsx` | ✅ Pushed | React listener Firebase real-time trigger |
| `src/lib/firebase.js` | ✅ Pushed | Firebase client configuration |
| `next.config.mjs` | ✅ Pushed | Next.js config (images.unoptimized: true) |
| `firebase-rules.json` | ✅ Pushed | Firebase security rules |
| `.env.local` | ⚠️ Gitignored | Telegram bot credentials (local only) |

### ⚠️ File yang TIDAK di-Repo (dan seharusnya):

| File | Alasan |
|------|--------|
| `.env*` | Gitignored - berisi secret keys |
| `scripts/serviceAccountKey.json` | HARUS di-upload manual ke VPS |
| `node_modules/` | Gitignored |

---

## 2. Deploy ke Cloudflare Pages

### 2.1 Prerequisites

- Akun Cloudflare (daftar gratis di https://dash.cloudflare.com)
- Repository GitHub `arwan-d3v/krx-ea-dashboard` sudah ter-push
- Node.js terinstall di lokal

### 2.2 PENTING: Next.js 16 + Cloudflare Compatibility

> ⚠️ **Project ini menggunakan Next.js 16.2.4** yang sangat baru. 
> Cloudflare Pages mendukung Next.js melalui adapter `@opennextjs/cloudflare`.
> Jika ada compatibility issue, alternatifnya deploy ke **Vercel** (zero-config untuk Next.js).

### 2.3 Opsi A: Deploy via Cloudflare Dashboard (Recommended)

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
| **Framework preset** | `Next.js (Static HTML Export)` atau `Next.js` |
| **Build command** | `npm run build` |
| **Build output directory** | `.next` (atau `out` jika static export) |
| **Node.js version** | `18` atau `20` |

**Step 5: Environment Variables**

Klik **Add variable** dan masukkan semua variabel berikut:

```
TELEGRAM_BOT_TOKEN          = 8990692151:AAHOS2dls1dAFfXaMzSQOVZCumLcLyhM9lY
TELEGRAM_SUPER_ADMIN_ID     = 1111325338
TELEGRAM_ADMIN_GROUP_ID     = -1003540250006
TELEGRAM_TOPIC_APPROVAL     = 2076
TELEGRAM_TOPIC_LOGS         = 2076
NEXT_PUBLIC_BASE_URL        = https://krx-ea.pages.dev
```

> ⚠️ **Ganti `NEXT_PUBLIC_BASE_URL`** sesuai domain Cloudflare Pages Anda yang sebenarnya!

**Step 6: Deploy**
1. Klik **Save and Deploy**
2. Tunggu build selesai (biasanya 1-3 menit)
3. Akses di: `https://krx-ea.pages.dev` (atau domain yang diberikan Cloudflare)

### 2.4 Opsi B: Deploy via Wrangler CLI (Advanced)

**Step 1: Install Wrangler**
```bash
npm install -g wrangler
```

**Step 2: Login ke Cloudflare**
```bash
wrangler login
```

**Step 3: Install OpenNext Cloudflare Adapter**
```bash
npm install --save-dev @opennextjs/cloudflare
```

**Step 4: Buat wrangler.toml**
```toml
# wrangler.toml
name = "krx-ea-dashboard"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
TELEGRAM_SUPER_ADMIN_ID = "1111325338"
TELEGRAM_ADMIN_GROUP_ID = "-1003540250006"
TELEGRAM_TOPIC_APPROVAL = "2076"
TELEGRAM_TOPIC_LOGS = "2076"
NEXT_PUBLIC_BASE_URL = "https://krx-ea.pages.dev"
```

**Step 5: Build & Deploy**
```bash
npx @opennextjs/cloudflare build
npx wrangler pages deploy .vercel/output/static
```

### 2.5 Opsi C: Jika Cloudflare Bermasalah → Deploy ke Vercel (Paling Mudah)

Next.js adalah framework buatan Vercel, jadi **zero-config deployment**:

1. Buka https://vercel.com
2. Login dengan GitHub
3. Klik **New Project**
4. Import `arwan-d3v/krx-ea-dashboard`
5. Tambahkan environment variables yang sama seperti di atas
6. Klik **Deploy** → Done!

### 2.6 Setup Custom Domain di Cloudflare Pages

1. Buka project Pages di Cloudflare Dashboard
2. Klik tab **Custom domains**
3. Klik **Set up a custom domain**
4. Masukkan domain Anda (misal: `krx-ea.yourdomain.com`)
5. Ikuti instruksi DNS (tambah CNAME record)
6. Tunggu SSL provisioning (biasanya < 5 menit)

---

## 3. Setup Python Trigger Bot di VPS

### 3.1 Prerequisites VPS

- VPS Ubuntu/Debian (minimal 1 vCPU, 512MB RAM)
- SSH access ke VPS
- Python 3.8+ terinstall

### 3.2 Upload File ke VPS

**Upload dari lokal ke VPS:**
```bash
# Dari komputer lokal
scp -r scripts/ user@YOUR_VPS_IP:/opt/krx-trigger-bot/

# Atau upload satu per satu
scp scripts/krx_trigger_bot.py user@YOUR_VPS_IP:/opt/krx-trigger-bot/
scp scripts/config.json user@YOUR_VPS_IP:/opt/krx-trigger-bot/
scp scripts/requirements.txt user@YOUR_VPS_IP:/opt/krx-trigger-bot/
```

### 3.3 Upload Service Account Key Firebase

> ⚠️ **PENTING**: File ini TIDAK boleh di-push ke GitHub!

```bash
# Download dari Firebase Console:
# https://console.firebase.google.com → Project Settings → Service Accounts → Generate New Private Key

# Upload ke VPS
scp serviceAccountKey.json user@YOUR_VPS_IP:/opt/krx-trigger-bot/serviceAccountKey.json
```

### 3.4 Install Dependencies & Setup di VPS

**SSH ke VPS:**
```bash
ssh user@YOUR_VPS_IP
```

**Setup Python Environment:**
```bash
# Masuk ke direktori bot
cd /opt/krx-trigger-bot

# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Python3 & pip (jika belum)
sudo apt install -y python3 python3-pip python3-venv

# Buat virtual environment
python3 -m venv venv

# Aktifkan virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify instalasi
python3 -c "import firebase_admin; import schedule; print('All dependencies OK')"
```

### 3.5 Set Timezone ke WITA (Asia/Makassar)

```bash
# Cek timezone saat ini
timedatectl

# Set ke WITA
sudo timedatectl set-timezone Asia/Makassar

# Verifikasi
date
# Output harus: WITA (UTC+8)
```

### 3.6 Test Run Manual

```bash
# Aktifkan venv
cd /opt/krx-trigger-bot
source venv/bin/activate

# Jalankan bot (test)
python3 krx_trigger_bot.py

# Output yang diharapkan:
# ╔═══════════════════════════════════════════════════════════╗
# ║     KRX VPS TRIGGER BOT - Firebase Trigger Engine        ║
# ║  Timezone: Asia/Makassar (WITA / GMT+8)                  ║
# ║  Firebase: https://krx-modern-dev-default-rtdb...        ║
# ╚═══════════════════════════════════════════════════════════╝
# KRX Trigger Bot is RUNNING. Press Ctrl+C to stop.

# Tekan Ctrl+C untuk stop
```

### 3.7 Jalankan 24/7 dengan Systemd (Recommended)

**Buat systemd service:**
```bash
sudo nano /etc/systemd/system/krx-trigger-bot.service
```

**Isi file:**
```ini
[Unit]
Description=KRX VPS Trigger Bot - Firebase Scheduler
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/krx-trigger-bot
ExecStart=/opt/krx-trigger-bot/venv/bin/python3 /opt/krx-trigger-bot/krx_trigger_bot.py
Restart=always
RestartSec=10
StandardOutput=append:/var/log/krx-trigger-bot.log
StandardError=append:/var/log/krx-trigger-bot.log
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

**Aktifkan & Jalankan:**
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start saat boot
sudo systemctl enable krx-trigger-bot

# Start service
sudo systemctl start krx-trigger-bot

# Cek status
sudo systemctl status krx-trigger-bot

# Lihat log real-time
sudo journalctl -u krx-trigger-bot -f
```

### 3.8 Alternatif: Jalankan dengan PM2 (Jika Node.js sudah ada di VPS)

```bash
# Install PM2
npm install -g pm2

# Jalankan bot
cd /opt/krx-trigger-bot
pm2 start krx_trigger_bot.py --name krx-trigger-bot --interpreter ./venv/bin/python3

# Auto-start saat boot
pm2 startup
pm2 save

# Monitor
pm2 monit
pm2 logs krx-trigger-bot
```

### 3.9 Alternatif: Jalankan dengan Screen (Simple)

```bash
# Buat screen session
screen -S krx-bot

# Jalankan bot
cd /opt/krx-trigger-bot
source venv/bin/activate
python3 krx_trigger_bot.py

# Detach: tekan Ctrl+A, lalu D
# Reattach: screen -r krx-bot
```

---

## 4. Verifikasi & Testing

### 4.1 Cek Dashboard Cloudflare Pages

```bash
# Buka browser
# https://krx-ea.pages.dev

# Pastikan:
# ✅ Login page muncul
# ✅ Dashboard bisa diakses setelah login
# ✅ Tidak ada error di browser console (F12)
```

### 4.2 Cek VPS Trigger Bot

```bash
# SSH ke VPS
ssh user@YOUR_VPS_IP

# Cek status service
sudo systemctl status krx-trigger-bot

# Cek log terbaru
tail -50 /opt/krx-trigger-bot/krx_trigger_bot.log

# Pastikan:
# ✅ Status: active (running)
# ✅ Heartbeat ter-update setiap 2 menit
# ✅ Tidak ada error di log
```

### 4.3 Cek Firebase Realtime Database

```
https://console.firebase.google.com → Realtime Database

Path yang harus ada:
├── system_triggers/
│   ├── morning_prep (akan muncul Senin-Jumat 08:45 WITA)
│   ├── daily_report (akan muncul Senin-Jumat 22:45 WITA)
│   └── weekly_recap (akan muncul Sabtu 07:05 WITA)
└── cron_heartbeat/
    ├── last_ping
    ├── gmt8_time
    ├── status: "online"
    └── timezone: "Asia/Makassar"
```

### 4.4 Test Telegram Notification

1. Buka Dashboard → Buka browser console (F12)
2. Tunggu jadwal trigger berikutnya, ATAU
3. Manual test di Firebase Console:
   - Buka `system_triggers/morning_prep`
   - Set `fired` ke `true`
   - Set `timestamp` ke timestamp saat ini
4. Periksa apakah pesan muncul di Telegram group

---

## 5. Troubleshooting

### Problem: Cloudflare Build Gagal

```
Error: Build failed with exit code 1
```

**Solution:**
```bash
# Coba build lokal dulu untuk cek error
npm run build

# Jika error terkait Next.js 16, coba:
# Opsi 1: Gunakan Vercel (paling kompatibel)
# Opsi 2: Tambahkan @opennextjs/cloudflare adapter
```

### Problem: API Routes Tidak Jalan di Cloudflare Pages

Cloudflare Pages mungkin tidak mendukung semua Next.js API routes. Pastikan:
- Environment variables sudah di-set di Cloudflare Dashboard
- Coba akses endpoint langsung: `https://your-domain.pages.dev/api/telegram/notify`

### Problem: Python Bot Tidak Bisa Connect ke Firebase

```bash
# Cek koneksi
python3 -c "
from firebase_admin import credentials
cred = credentials.Certificate('/opt/krx-trigger-bot/serviceAccountKey.json')
print('Service Account Key OK')
"

# Pastikan file serviceAccountKey.json ada dan valid
ls -la /opt/krx-trigger-bot/serviceAccountKey.json
```

### Problem: Timezone Salah

```bash
# Pastikan VPS pakai WITA
timedatectl
# Harus: Time zone: Asia/Makassar (WITA, +0800)

# Jika salah:
sudo timedatectl set-timezone Asia/Makassar
sudo systemctl restart krx-trigger-bot
```

### Problem: Service Bot Mati Setelah Reboot

```bash
# Pastikan systemd enabled
sudo systemctl is-enabled krx-trigger-bot
# Harus: enabled

# Jika belum:
sudo systemctl enable krx-trigger-bot
```

---

## 📊 Ringkasan Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    KRX EA DASHBOARD                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │  VPS Linux   │     │  Cloudflare  │     │   Telegram   │ │
│  │  (Python)    │────▶│   Pages      │────▶│   Bot API    │ │
│  │              │     │  (Next.js)   │     │              │ │
│  │  - schedule  │     │  - Dashboard │     │  - Messages  │ │
│  │  - firebase  │     │  - API Routes│     │  - Groups    │ │
│  │  - heartbeat │     │  - Listener  │     │  - Topics    │ │
│  └──────┬───────┘     └──────┬───────┘     └──────────────┘ │
│         │                    │                               │
│         └────────┬───────────┘                               │
│                  │                                           │
│         ┌────────▼────────┐                                  │
│         │    Firebase     │                                  │
│         │  Realtime DB    │                                  │
│         │                 │                                  │
│         │ system_triggers │                                  │
│         │ cron_heartbeat  │                                  │
│         └─────────────────┘                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Flow:
1. VPS Python Bot → Set trigger di Firebase (setiap jadwal)
2. Cloudflare Pages → Listener mendeteksi trigger
3. Cloudflare Pages → Fetch data dari Firebase, proses pesan
4. Cloudflare Pages → Kirim notifikasi ke Telegram
```

---

## 📝 Checklist Deploy

- [ ] Semua file sudah ter-push ke GitHub ✅
- [ ] Cloudflare Pages project dibuat
- [ ] Environment variables di-set di Cloudflare
- [ ] Build & deploy berhasil
- [ ] Custom domain di-setup (opsional)
- [ ] VPS Python bot di-setup
- [ ] Service Account Key Firebase di-upload ke VPS
- [ ] Timezone VPS di-set ke WITA
- [ ] Systemd service di-enable
- [ ] Test trigger manual
- [ ] Verifikasi Telegram notification
- [ ] Cek heartbeat di Firebase

---

**Last Updated: 2026-05-21**
**Repository: https://github.com/arwan-d3v/krx-ea-dashboard**