// ============================================================================
// KRX TELEGRAM NOTIFICATION API ROUTE — v3.0 REDESIGN
// ============================================================================
// Fungsi: Dipanggil oleh SystemTriggerListener saat mendeteksi trigger dari
// Firebase. Memproses data dan mengirim notifikasi Telegram dengan template
// informatif, formal, tidak kaku, serta quotes bijak dari quotes-pool.
//
// Trigger types:
//   - morning_prep      : Morning briefing + Monday kickoff (Mon-Fri 08:45)
//   - daily_report      : End-of-day performance report (Mon-Fri 22:45)
//   - weekly_recap      : Weekly profit recap + weekend wisdom (Sat 07:05)
//   - vps_billing_warning  : VPS H-3 warning notification
//   - vps_billing_urgent   : VPS H-1/overdue urgent notification
//   - profit_share_invoice_ready : Monthly profit share invoice notification
// ============================================================================

import { NextResponse } from "next/server";
import {
  getQuoteForTrigger,
  getMondayKickoffQuote,
} from "../../../../lib/quotes-pool";

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const BOT_TOKEN =
  process.env.TELEGRAM_BOT_TOKEN || "8990692151:AAHOS2dls1dAFfXaMzSQOVZCumLcLyhM9lY";
const ADMIN_GROUP_ID =
  process.env.TELEGRAM_ADMIN_GROUP_ID || "-1003540250006";
const TOPIC_LOGS =
  process.env.TELEGRAM_TOPIC_LOGS || "2076";
const SUPER_ADMIN_ID =
  process.env.TELEGRAM_SUPER_ADMIN_ID || "1111325338";

const DASHBOARD_URL = "https://krx-ea.pages.dev";

// Firebase REST endpoint (read-only, no admin SDK needed)
const FB_DB_URL = process.env.FIREBASE_DATABASE_URL || "";
const FB_DB_SECRET = process.env.FIREBASE_DB_SECRET || "";

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAYS_ID = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu",
];

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function getDateString() {
  const now = new Date();
  const day = DAYS_ID[now.getDay()];
  const date = now.getDate();
  const month = MONTHS_ID[now.getMonth()];
  const year = now.getFullYear();
  return `${day}, ${date} ${month} ${year}`;
}

function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "0.00";
  return Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(val) {
  if (val == null || isNaN(val)) return "0.00";
  return Number(val).toFixed(2);
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error("[Telegram API] Error:", data.description);
    }
    return data;
  } catch (err) {
    console.error("[Telegram API] Fetch error:", err);
    return { ok: false };
  }
}

async function fetchFirebase(path) {
  if (!FB_DB_URL) return null;
  try {
    const url = `${FB_DB_URL}/${path}.json${FB_DB_SECRET ? `?auth=${FB_DB_SECRET}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[Firebase Fetch] Error fetching ${path}:`, err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA FETCHING HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchDailyReportData() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const accountData = await fetchFirebase("account_data");
  if (!accountData) return null;

  const accounts = [];
  let totalPnl = 0;
  let totalLots = 0;
  let winCount = 0;
  let activeCount = 0;

  for (const [accNum, data] of Object.entries(accountData)) {
    const dailyHist = (data?.daily_history || {})[todayStr];
    if (dailyHist) {
      activeCount++;
      const profit = dailyHist.daily_profit || dailyHist.profit || 0;
      const growth = dailyHist.daily_growth_percent || dailyHist.growth || 0;
      const lots = dailyHist.daily_lots || dailyHist.lot || 0;

      totalPnl += profit;
      totalLots += lots;
      if (profit > 0) winCount++;

      accounts.push({
        accNum,
        profit,
        growth,
        lots,
      });
    }
  }

  return {
    activeCount,
    totalPnl,
    totalLots,
    winRate: activeCount > 0 ? ((winCount / activeCount) * 100) : 0,
    accounts: accounts.sort((a, b) => b.profit - a.profit),
  };
}

async function fetchWeeklyData() {
  const today = new Date();
  // Calculate Monday-Friday of this week
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  let mondayOffset;
  if (dayOfWeek === 6) {
    // Saturday → go back to Monday (5 days back)
    mondayOffset = 5;
  } else if (dayOfWeek === 0) {
    // Sunday → go back to Monday (6 days back)
    mondayOffset = 6;
  } else {
    // Mon-Fri → go back to this week's Monday
    mondayOffset = dayOfWeek - 1;
  }

  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  // Generate list of Mon-Fri date strings
  const weekDays = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
  }

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const accountData = await fetchFirebase("account_data");
  if (!accountData) return null;

  const accountSummary = {};
  let totalWeeklyPnl = 0;
  let totalWeeklyLots = 0;
  let bestDay = { date: "N/A", profit: -Infinity };
  let worstDay = { date: "N/A", profit: Infinity };
  let winDays = 0;
  let totalDays = 0;

  for (const [dateStr] of weekDays.entries()) {
    const d = weekDays[dateStr];
    let dayPnl = 0;
    totalDays++;

    for (const [accNum, data] of Object.entries(accountData)) {
      const dailyHist = (data?.daily_history || {})[d];
      if (dailyHist) {
        const profit = dailyHist.daily_profit || dailyHist.profit || 0;
        dayPnl += profit;

        if (!accountSummary[accNum]) {
          accountSummary[accNum] = { profit: 0, lots: 0, growths: [] };
        }
        accountSummary[accNum].profit += profit;
        accountSummary[accNum].lots += dailyHist.daily_lots || dailyHist.lot || 0;
        accountSummary[accNum].growths.push(
          dailyHist.daily_growth_percent || dailyHist.growth || 0
        );
      }
    }

    totalWeeklyPnl += dayPnl;
    totalWeeklyLots += Object.values(accountSummary).reduce(
      (sum, a) => sum + a.lots,
      0
    );
    if (dayPnl > 0) winDays++;
    if (dayPnl > bestDay.profit) bestDay = { date: d, profit: dayPnl };
    if (dayPnl < worstDay.profit) worstDay = { date: d, profit: dayPnl };
  }

  // Format account summary
  const accounts = Object.entries(accountSummary)
    .map(([accNum, s]) => ({
      accNum,
      profit: s.profit,
      avgGrowth:
        s.growths.length > 0
          ? s.growths.reduce((a, b) => a + b, 0) / s.growths.length
          : 0,
    }))
    .sort((a, b) => b.profit - a.profit);

  return {
    totalPnl: totalWeeklyPnl,
    totalLots: totalWeeklyLots,
    winRate: totalDays > 0 ? ((winDays / totalDays) * 100) : 0,
    bestDay: bestDay.profit === -Infinity ? { date: "N/A", profit: 0 } : bestDay,
    worstDay: worstDay.profit === Infinity ? { date: "N/A", profit: 0 } : worstDay,
    accounts,
    monday: monday.toISOString().split("T")[0],
    friday: friday.toISOString().split("T")[0],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function sendMorningPrep() {
  const dateStr = getDateString();
  const isMonday = new Date().getDay() === 1;

  let message = "";
  message += `☀️ <b>MORNING PREP BRIEFING</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (isMonday) {
    message += `\n🚀 <b>SELAMAT HARI SENIN!</b> 🚀\n`;
    message += `Semangat baru, target baru, peluang baru.\n`;
    message += `Saatnya kembali fokus ke chart dan eksekusi strategi.\n`;

    // Monday kickoff quote — special high-energy quote
    const kickoff = getMondayKickoffQuote();
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💡 <b>Monday Kickstart — ${kickoff.category.toUpperCase()}</b>\n`;
    message += `<i>"${kickoff.text}"</i>\n`;
  } else {
    // Regular morning prep
    const quote = getQuoteForTrigger("morning_prep");
    message += `\n📊 <b>STATUS SISTEM KRX</b>\n`;
    message += `├ 🟢 Siap untuk sesi trading hari ini\n`;
    message += `├ 📊 Pantau dashboard untuk update real-time\n`;
    message += `└ 💡 Tetap disiplin dengan trading plan Anda\n`;

    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💡 <b>${quote.category.toUpperCase()}</b>\n`;
    message += `<i>"${quote.text}"</i>\n`;
  }

  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 Dashboard: <a href="${DASHBOARD_URL}">KRX Dashboard</a>\n`;
  message += `\n#MorningPrep #KRX`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
  console.log("[Telegram] Morning prep sent ✓");
}

async function sendDailyReport() {
  const dateStr = getDateString();
  const data = await fetchDailyReportData();

  let message = "";
  message += `🌙 <b>DAILY TRADING REPORT</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (!data || data.activeCount === 0) {
    message += `\n📊 Tidak ada aktivitas trading hari ini.\n`;
    message += `Semua akun dalam kondisi idle.\n`;
  } else {
    message += `\n📊 <b>RINGKASAN HARI INI</b>\n`;
    message += `├ 💰 Total PnL       : $${formatCurrency(data.totalPnl)}\n`;
    message += `├ 🔄 Total Lots      : ${data.totalLots.toFixed(1)}\n`;
    message += `├ 🟢 Win Rate        : ${formatPercent(data.winRate)}%\n`;
    message += `└ 🖥️ Akun Aktif      : ${data.activeCount}\n`;

    // Per-account breakdown (top 5)
    if (data.accounts.length > 0) {
      message += `\n📋 <b>BREAKDOWN PER AKUN</b>\n`;
      const topAccounts = data.accounts.slice(0, 5);
      topAccounts.forEach((acc, idx) => {
        const prefix = idx === topAccounts.length - 1 ? "└" : "├";
        message += `${prefix} 📌 ${acc.accNum}  : ${acc.profit >= 0 ? "+" : ""}$${formatCurrency(acc.profit)} (${acc.growth >= 0 ? "+" : ""}${formatPercent(acc.growth)}%)\n`;
      });
      if (data.accounts.length > 5) {
        message += `└ ... dan ${data.accounts.length - 5} akun lainnya\n`;
      }
    }
  }

  // Quote
  const quote = getQuoteForTrigger("daily_report");
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 <b>${quote.category.toUpperCase()}</b>\n`;
  message += `<i>"${quote.text}"</i>\n`;
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 Dashboard: <a href="${DASHBOARD_URL}">KRX Dashboard</a>\n`;
  message += `\n#DailyReport #KRX`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
  console.log("[Telegram] Daily report sent ✓");
}

async function sendWeeklyRecap() {
  const dateStr = getDateString();
  const data = await fetchWeeklyData();

  let message = "";
  message += `📊 <b>WEEKLY RECAP — SABTU REFLEKSI</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (!data) {
    message += `\n📊 Data mingguan tidak tersedia.\n`;
  } else {
    message += `\n💎 <b>RINGKASAN MINGGU INI (Sen-Jum)</b>\n`;
    message += `├ 💰 Total PnL        : $${formatCurrency(data.totalPnl)}\n`;
    message += `├ 🔄 Total Lots       : ${data.totalLots.toFixed(2)}\n`;
    message += `├ 🟢 Win Rate         : ${formatPercent(data.winRate)}%\n`;
    message += `├ 📊 Hari Terbaik     : ${data.bestDay.date} ($${formatCurrency(data.bestDay.profit)})\n`;
    message += `└ 📉 Hari Terlemah    : ${data.worstDay.date} (${data.worstDay.profit >= 0 ? "+" : ""}$${formatCurrency(data.worstDay.profit)})\n`;

    // Per-account accumulation
    if (data.accounts.length > 0) {
      message += `\n📋 <b>AKUMULASI PER AKUN</b>\n`;
      const topAccounts = data.accounts.slice(0, 5);
      topAccounts.forEach((acc, idx) => {
        const prefix = idx === topAccounts.length - 1 ? "└" : "├";
        message += `${prefix} 📌 ${acc.accNum}  : ${acc.profit >= 0 ? "+" : ""}$${formatCurrency(acc.profit)} (avg ${acc.avgGrowth >= 0 ? "+" : ""}${formatPercent(acc.avgGrowth)}%/hr)\n`;
      });
    }
  }

  // Weekend wisdom quote
  const quote = getQuoteForTrigger("weekly_recap");
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 <b>${quote.category.toUpperCase()}</b>\n`;
  message += `<i>"${quote.text}"</i>\n`;
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `🏖️ Istirahat yang baik adalah bagian dari strategi.\n`;
  message += `Market akan selalu ada hari Senin.\n`;
  message += `\n📊 Dashboard: <a href="${DASHBOARD_URL}">KRX Dashboard</a>\n`;
  message += `\n#WeeklyRecap #KRX`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
  console.log("[Telegram] Weekly recap sent ✓");
}

async function sendVpsBillingWarning(triggerData) {
  const dateStr = getDateString();
  const payload = triggerData?.payload || {};

  const vpsName = payload.vps_name || payload.accountNumber || "N/A";
  const investor = payload.user_id || "N/A";
  const monthlyCost = payload.amount || 0;
  const dueDate = payload.due_date || "N/A";
  const daysRemaining = payload.days_remaining || 3;

  let message = "";
  message += `⚠️ <b>VPS BILLING REMINDER</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `\n🖥️ <b>INFORMASI TAGIHAN VPS</b>\n`;
  message += `├ 📌 Nama VPS      : ${vpsName}\n`;
  message += `├ 👤 Investor      : ${investor}\n`;
  message += `├ 💰 Biaya/Bulan   : $${formatCurrency(monthlyCost)}\n`;
  message += `├ 📅 Jatuh Tempo   : ${dueDate}\n`;
  message += `└ ⏳ Sisa Waktu    : ${daysRemaining} hari lagi\n`;
  message += `\n📋 Status: ⚠️ WARNING — Segera lakukan pembayaran\n`;

  const quote = getQuoteForTrigger("vps_billing_warning");
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 <b>${quote.category.toUpperCase()}</b>\n`;
  message += `<i>"${quote.text}"</i>\n`;
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `#VPSBilling #Warning\n`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
  console.log("[Telegram] VPS billing warning sent ✓");
}

async function sendVpsBillingUrgent(triggerData) {
  const dateStr = getDateString();
  const payload = triggerData?.payload || {};

  const vpsName = payload.vps_name || payload.accountNumber || "N/A";
  const investor = payload.user_id || "N/A";
  const monthlyCost = payload.amount || 0;
  const dueDate = payload.due_date || "N/A";
  const daysRemaining = payload.days_remaining || 1;
  const overdueLabel = daysRemaining <= 0 ? " (TERLAMBAT)" : "";

  let message = "";
  message += `🚨 <b>VPS BILLING — URGENT${overdueLabel}</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `\n🖥️ <b>TAGIHAN JATUH TEMPO</b>\n`;
  message += `├ 📌 Nama VPS      : ${vpsName}\n`;
  message += `├ 👤 Investor      : ${investor}\n`;
  message += `├ 💰 Biaya/Bulan   : $${formatCurrency(monthlyCost)}\n`;
  message += `├ 📅 Jatuh Tempo   : ${dueDate}\n`;
  message += `└ ⏳ Sisa Waktu    : ${daysRemaining <= 0 ? "JATUH TEMPO" : daysRemaining + " hari lagi"}\n`;
  message += `\n📋 Status: 🚨 URGENT — Pembayaran harus segera diproses!\n`;
  message += `\n⚠️ <b>Peringatan:</b> VPS dapat dinonaktifkan jika pembayaran\n`;
  message += `   tidak diterima sebelum tanggal jatuh tempo.\n`;

  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `#VPSBilling #Urgent\n`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
  console.log("[Telegram] VPS billing urgent sent ✓");
}

async function sendProfitShareNotification(triggerData) {
  const dateStr = getDateString();
  const payload = triggerData?.payload || {};

  const invoicesGenerated = payload.invoices_generated || 0;
  const period = payload.period || "N/A";

  let message = "";
  message += `💰 <b>PROFIT SHARE INVOICE GENERATED</b>\n`;
  message += `📅 ${dateStr}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `\n📋 <b>RINGKASAN PROFIT SHARE</b>\n`;
  message += `├ 📅 Periode       : ${period}\n`;
  message += `├ 📊 Invoice Dibuat: ${invoicesGenerated} invoice\n`;
  message += `└ ⏳ Status        : Pending — menunggu pembayaran\n`;
  message += `\n📋 Semua invoice telah tersimpan di dashboard.\n`;
  message += `Silakan cek Subscription Area untuk detail lengkap.\n`;

  const quote = getQuoteForTrigger("profit_share_invoice_ready");
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `💡 <b>${quote.category.toUpperCase()}</b>\n`;
  message += `<i>"${quote.text}"</i>\n`;
  message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 Dashboard: <a href="${DASHBOARD_URL}/subscription-area">Subscription Area</a>\n`;
  message += `\n#ProfitShare #Invoice\n`;

  await sendTelegramMessage(ADMIN_GROUP_ID, message, TOPIC_LOGS);
  console.log("[Telegram] Profit share notification sent ✓");
}

// ═══════════════════════════════════════════════════════════════════════════
// POST handler
// ═══════════════════════════════════════════════════════════════════════════

export async function POST(request) {
  try {
    const body = await request.json();
    const { trigger, timestamp, gmt8_time, payload } = body;

    console.log(`[Telegram Notify API] Processing trigger: ${trigger}`, {
      trigger,
      timestamp,
      gmt8_time,
      hasPayload: !!payload,
    });

    switch (trigger) {
      case "morning_prep":
        await sendMorningPrep();
        break;
      case "daily_report":
        await sendDailyReport();
        break;
      case "weekly_recap":
        await sendWeeklyRecap();
        break;
      case "vps_billing_warning":
        await sendVpsBillingWarning({ payload, timestamp, gmt8_time });
        break;
      case "vps_billing_urgent":
        await sendVpsBillingUrgent({ payload, timestamp, gmt8_time });
        break;
      case "profit_share_invoice_ready":
        await sendProfitShareNotification({ payload, timestamp, gmt8_time });
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