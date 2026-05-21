// ============================================================================
// KRX TELEGRAM NOTIFICATION API ROUTE
// ============================================================================
// Fungsi: Dipanggil oleh SystemTriggerListener saat mendeteksi trigger dari
// Firebase. Memproses data dari Firebase DB dan mengirim notifikasi via
// Telegram Bot ke grup Command Center KRX.
//
// Trigger types:
//   - morning_prep: Morning prep briefing + Monday kickoff greeting
//   - daily_report: End-of-day performance report
//   - weekly_recap: Weekly profit recap + weekend message
// ============================================================================

import { NextResponse } from "next/server";

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "8990692151:AAHOS2dls1dAFfXaMzSQOVZCumLcLyhM9lY";
const ADMIN_GROUP_ID = process.env.TELEGRAM_ADMIN_GROUP_ID || "-1003540250006";
const TOPIC_LOGS =
  process.env.TELEGRAM_TOPIC_LOGS || "2076";
const SUPER_ADMIN_ID =
  process.env.TELEGRAM_SUPER_ADMIN_ID || "1111325338";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function getDateString() {
  const now = new Date();
  const day = DAYS_ID[now.getDay()];
  const date = now.getDate();
  const month = MONTHS_ID[now.getMonth()];
  const year = now.getFullYear();
  return `${day}, ${date} ${month} ${year}`;
}

async function sendTelegramMessage(chatId, text, threadId = null) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (threadId) body.message_thread_id = parseInt(threadId);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function sendMorningPrep(triggerData) {
  const dateStr = getDateString();
  const isMonday = new Date().getDay() === 1;

  // Morning motivational quote based on day
  const quotes = {
    0: { theme: "Persiapan", text: "Minggu adalah waktu untuk menata ulang strategi, bukan hanya untuk beristirahat." },
    1: { theme: "Finansial", text: "Disiplin hari ini adalah pondasi kebebasan finansial Anda di masa depan." },
    2: { theme: "Kesehatan", text: "Trading yang hebat dimulai dengan tubuh yang bugar. Jangan lupa bergerak hari ini." },
    3: { theme: "Rohani", text: "Harta hanyalah titipan. Gunakan ia untuk kebermanfaatan dan tetaplah rendah hati." },
    4: { theme: "Sosial", text: "Kesuksesan sejati diukur dari seberapa banyak orang yang terbantu oleh kesuksesan kita." },
    5: { theme: "Refleksi", text: "Jeda sejenak untuk bersyukur adalah investasi mental terbaik bagi seorang trader." },
    6: { theme: "Keluarga", text: "Investasi terbaik adalah waktu yang dihabiskan bersama orang tercinta." },
  };
  const today = new Date().getDay();
  const quote = quotes[today];

  let message = "";
  message += `☀️ <b>Morning Prep Briefing</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;

  if (isMonday) {
    message += `\n🚀 <b>SELAMAT HARI SENIN!</b> 🚀\n`;
    message += `Semangat baru, target baru, profit baru!\n`;
    message += `Saatnya kembali fokus ke chart dan eksekusi strategi.\n`;
  }

  message += `\n💡 <b>Quote Hari Ini</b> — <i>${quote.theme}</i>\n`;
  message += `<i>"${quote.text}"</i>\n`;
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `📊 Cek dashboard Anda: <a href="https://krx-ea.pages.dev">KRX Dashboard</a>\n`;
  message += `\n#MorningPrep #${quote.theme}`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
}

async function sendDailyReport(triggerData) {
  const dateStr = getDateString();

  // Placeholder — will pull real data from Firebase DB in production
  const report = {
    totalPnL: "0.00",
    winRate: "0%",
    activeAccounts: 0,
    dailyPnL: "0.00",
    allTimeGain: "0.00%",
    equityGrowth: "0.00%",
  };

  let message = "";
  message += `🌙 <b>Daily Trading Report</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `\n📊 <b>Ringkasan Hari Ini</b>\n`;
  message += `💰 Total PnL: $${report.totalPnL}\n`;
  message += `📈 Win Rate: ${report.winRate}\n`;
  message += `🖥️ Akun Aktif: ${report.activeAccounts}\n`;
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `\n🏦 <b>All-Time Stats</b>\n`;
  message += `📊 All-Time Gain: ${report.allTimeGain}\n`;
  message += `📈 Equity Growth: ${report.equityGrowth}\n`;
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `📊 Cek dashboard Anda: <a href="https://krx-ea.pages.dev">KRX Dashboard</a>\n`;
  message += `\n#DailyReport #TradingPnL`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
}

async function sendWeeklyRecap(triggerData) {
  const dateStr = getDateString();

  // Placeholder — will pull real weekly data from Firebase DB in production
  const weekly = {
    totalPnL: "0.00",
    bestDay: "N/A",
    worstDay: "N/A",
    totalTrades: 0,
    winRate: "0%",
    profitFactor: "0.00",
  };

  let message = "";
  message += `📊 <b>Weekly Recap — Sabtu Refleksi</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `\n💎 <b>Ringkasan Minggu Ini (Senin-Jumat)</b>\n`;
  message += `💰 Total PnL Mingguan: $${weekly.totalPnL}\n`;
  message += `📈 Win Rate: ${weekly.winRate}\n`;
  message += `🔄 Total Trade: ${weekly.totalTrades}\n`;
  message += `⚡ Profit Factor: ${weekly.profitFactor}\n`;
  message += `\n📊 Hari Terbaik: ${weekly.bestDay}\n`;
  message += `📉 Hari Terburuk: ${weekly.worstDay}\n`;
  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `\n🧘 <b>Pesan Weekend:</b>\n`;
  message += `<i>"Market akan selalu ada hari Senin. Istirahat yang cukup adalah bagian dari strategi trading."</i>\n`;
  message += `\nSelamat beristirahat, trader! 🏖️\n`;
  message += `\n#WeeklyRecap #WeekendBreak`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
}

// ============================================================================
// POST handler
// ============================================================================
export async function POST(request) {
  try {
    const body = await request.json();
    const { trigger, timestamp, gmt8_time } = body;

    console.log(`[Telegram Notify API] Processing trigger: ${trigger}`, {
      trigger,
      timestamp,
      gmt8_time,
    });

    switch (trigger) {
      case "morning_prep":
        await sendMorningPrep({ timestamp, gmt8_time });
        break;
      case "daily_report":
        await sendDailyReport({ timestamp, gmt8_time });
        break;
      case "weekly_recap":
        await sendWeeklyRecap({ timestamp, gmt8_time });
        break;
      default:
        console.warn(`[Telegram Notify API] Unknown trigger: ${trigger}`);
        return NextResponse.json(
          { success: false, error: `Unknown trigger: ${trigger}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      trigger,
      gmt8_time,
      message: `${trigger} notification sent to Telegram`,
    });
  } catch (error) {
    console.error("[Telegram Notify API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}