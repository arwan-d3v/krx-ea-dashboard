"use client";

import { useState, useEffect } from "react";
import { X, Download, Share2, Send, Printer, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ref, get } from "firebase/database";
import { db } from "../lib/firebase";

// ── Helper: Process snapshots timestamp keys to date-keyed map ──
function processSnapshotsToDailyData(snapshots) {
  if (!snapshots || typeof snapshots !== "object") return {};
  const dailyData = {};

  Object.keys(snapshots).forEach((tsKey) => {
    let timeMs = parseInt(tsKey);
    if (isNaN(timeMs)) return;
    if (timeMs < 10000000000) timeMs = timeMs * 1000;
    const exactDateWITA = new Date(timeMs + 28800000);
    const y = exactDateWITA.getUTCFullYear();
    const m = String(exactDateWITA.getUTCMonth() + 1).padStart(2, "0");
    const d = String(exactDateWITA.getUTCDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;
    dailyData[dateKey] = snapshots[tsKey];
  });

  return dailyData;
}

// ── Helper: Compute profit summary from account snapshots ──
function computeAccountProfitSummary(snapshots, profitSharePercent) {
  const empty = {
    totalProfit: 0, totalLots: 0, totalTradingDays: 0,
    totalFee: 0, totalPaid: 0, totalPending: 0, totalUnpaid: 0,
    monthlyBreakdown: [], balance: 0,
  };

  const dailyData = processSnapshotsToDailyData(snapshots);
  if (Object.keys(dailyData).length === 0) return empty;

  const monthlyMap = {};
  let latestBalance = 0;

  Object.entries(dailyData).forEach(([dateStr, data]) => {
    const monthKey = dateStr.substring(0, 7);
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { profit: 0, lots: 0, growthSum: 0, tradingDays: 0 };
    monthlyMap[monthKey].profit += Number(data.daily_profit || data.profit || 0);
    monthlyMap[monthKey].lots += Number(data.daily_lots || data.lot || data.lots || 0);
    monthlyMap[monthKey].growthSum += Number(data.daily_growth_percent || data.growth || data.growth_percent || 0);
    monthlyMap[monthKey].tradingDays++;
    if (data.balance) latestBalance = Number(data.balance);
  });

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthlyBreakdown = Object.entries(monthlyMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, data]) => {
      const feeShare = Math.max(0, data.profit * (profitSharePercent / 100));
      const [y, m] = month.split("-");
      return {
        month, label: `${MONTH_NAMES[parseInt(m) - 1]} ${y}`,
        totalProfit: +data.profit.toFixed(2), totalLots: +data.lots.toFixed(2),
        avgGrowth: data.tradingDays > 0 ? +(data.growthSum / data.tradingDays).toFixed(2) : 0,
        tradingDays: data.tradingDays,
        feeShare: +feeShare.toFixed(2),
      };
    });

  const sum = (arr, key) => arr.reduce((s, m) => s + m[key], 0);
  return {
    totalProfit: +sum(monthlyBreakdown, "totalProfit").toFixed(2),
    totalLots: +sum(monthlyBreakdown, "totalLots").toFixed(2),
    totalTradingDays: sum(monthlyBreakdown, "tradingDays"),
    totalFee: +sum(monthlyBreakdown, "feeShare").toFixed(2),
    monthlyBreakdown, balance: latestBalance,
  };
}

// ── Helper: Get account balance from multiple sources ──
function getAccountBalance(accData) {
  if (!accData) return 0;
  const rtBalance = Number(accData?.realtime_stats?.balance || 0);
  if (rtBalance > 0) return rtBalance;
  const metaBalance = Number(accData?.metadata?.balance || 0);
  if (metaBalance > 0) return metaBalance;
  const snapshots = accData?.snapshots;
  if (snapshots && typeof snapshots === "object") {
    let latestBalance = 0, latestTs = 0;
    Object.entries(snapshots).forEach(([tsKey, data]) => {
      const ts = parseInt(tsKey);
      if (data.balance && ts > latestTs) { latestBalance = Number(data.balance); latestTs = ts; }
    });
    if (latestBalance > 0) return +latestBalance.toFixed(2);
  }
  return 0;
}

export default function ReceiptModal({ isOpen, onClose, invoice, userData, accountData }) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountSummary, setAccountSummary] = useState({
    balance: accountData?.balance || invoice?.balance || 0,
    totalProfit: accountData?.totalProfit || invoice?.total_profit || 0,
    totalTradingDays: accountData?.totalTradingDays || invoice?.trading_days || 0,
    profitShare: accountData?.profitShare || invoice?.share_percentage || 30,
  });

  // Fetch account data from Firebase if not provided or incomplete
  useEffect(() => {
    if (!invoice || !invoice.account_number) return;

    const fetchAccountData = async () => {
      setLoading(true);
      try {
        const accNum = invoice.account_number || invoice.accountNumber;
        const snapshot = await get(ref(db, `account_data/${accNum}`));
        
        if (snapshot.exists()) {
          const accData = snapshot.val();
          const profitShare = invoice.share_percentage || accountData?.profitShare || 30;
          const balance = getAccountBalance(accData);
          const profitSummary = computeAccountProfitSummary(accData.snapshots || null, profitShare);
          
          setAccountSummary({
            balance: balance,
            totalProfit: profitSummary.totalProfit,
            totalTradingDays: profitSummary.totalTradingDays,
            profitShare: profitShare,
          });
        }
      } catch (error) {
        console.error("Error fetching account data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [invoice, accountData]);

  if (!isOpen || !invoice) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  const generateReceiptHTML = () => {
    const periodStart = invoice.period_start || invoice.created_at;
    const periodEnd = invoice.period_end || invoice.created_at;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${invoice.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      background: #f5f5f5; 
      padding: 20px;
    }
    .receipt {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 12px;
      opacity: 0.9;
    }
    .receipt-id {
      background: rgba(255,255,255,0.1);
      padding: 8px 16px;
      border-radius: 8px;
      display: inline-block;
      margin-top: 12px;
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e5e5;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
    }
    .info-label {
      font-size: 10px;
      color: #999;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .info-value {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .amount-box {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      margin: 24px 0;
    }
    .amount-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.9;
      margin-bottom: 8px;
    }
    .amount-value {
      font-size: 36px;
      font-weight: 900;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    .details-table th {
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #666;
      padding: 12px 8px;
      border-bottom: 2px solid #e5e5e5;
    }
    .details-table td {
      padding: 12px 8px;
      font-size: 13px;
      border-bottom: 1px solid #f0f0f0;
    }
    .details-table tr:last-child td {
      border-bottom: none;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-pending {
      background: #fef3c7;
      color: #92400e;
    }
    .status-paid {
      background: #d1fae5;
      color: #065f46;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e5e5e5;
    }
    .footer p {
      font-size: 10px;
      color: #999;
      line-height: 1.6;
    }
    .divider {
      height: 1px;
      background: #e5e5e5;
      margin: 24px 0;
    }
    @media print {
      body { background: white; padding: 0; }
      .receipt { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1>KRX QUANTITATIVE</h1>
      <p>Trading Performance Receipt</p>
      <div class="receipt-id">${invoice.id}</div>
    </div>
    
    <div class="content">
      <div class="section">
        <div class="section-title">Investor Information</div>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Full Name</span>
            <span class="info-value">${userData?.fullName || invoice.user_name || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Email</span>
            <span class="info-value">${userData?.email || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Telegram ID</span>
            <span class="info-value">${userData?.telegramId || invoice.telegram_id || "N/A"}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Account Number</span>
            <span class="info-value" style="font-family: monospace;">${(() => {
              const accNum = invoice.account_number || invoice.accountNumber || "";
              return accNum ? `****${accNum.slice(-4)}` : "N/A";
            })()}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Invoice Details</div>
        <table class="details-table">
          <tr>
            <th>Invoice Type</th>
            <th>Period</th>
            <th>Status</th>
          </tr>
          <tr>
            <td>${invoice.type === "vps" || invoice.type === "vps_rental" ? "VPS Rental" : "Profit Share"}</td>
            <td>${invoice.period_start && invoice.period_end 
              ? `${formatDate(invoice.period_start)} - ${formatDate(invoice.period_end)}`
              : formatDate(invoice.created_at)}</td>
            <td><span class="status-badge ${invoice.status === 'paid' ? 'status-paid' : 'status-pending'}">${invoice.status}</span></td>
          </tr>
        </table>
      </div>

      ${invoice.type === "profit_share" ? `
      <div class="section">
        <div class="section-title">Trading Performance</div>
        ${loading ? `
        <div style="text-align: center; padding: 20px;">
          <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #3b82f6; border-top: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <p style="margin-top: 8px; font-size: 12px; color: #666;">Loading account data...</p>
        </div>
        ` : `
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Total Profit</span>
            <span class="info-value" style="color: #10b981;">${formatCurrency(accountSummary.totalProfit)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Profit Share (${accountSummary.profitShare}%)</span>
            <span class="info-value">${formatCurrency(invoice.amount || 0)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Balance</span>
            <span class="info-value">${formatCurrency(accountSummary.balance)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Trading Days</span>
            <span class="info-value">${accountSummary.totalTradingDays}</span>
          </div>
        </div>
        `}
      </div>
      ` : ""}

      <div class="amount-box">
        <div class="amount-label">Total Amount Due</div>
        <div class="amount-value">${formatCurrency(invoice.amount)}</div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Created Date</span>
            <span class="info-value">${formatDate(invoice.created_at)}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Due Date</span>
            <span class="info-value">${formatDate(invoice.due_date)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>This is an official receipt from KRX Quantitative Trading System.</p>
      <p>Generated on ${new Date().toLocaleString("en-US", { timeZone: "Asia/Singapore" })} GMT+8</p>
      <p style="margin-top: 12px; font-weight: 600; color: #666;">© 2026 KRX Trading. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
    `;
  };

  const generateTelegramMessage = () => {
    const periodStart = invoice.period_start || invoice.created_at;
    const periodEnd = invoice.period_end || invoice.created_at;
    
    return `📊 KRX TRADING - INVOICE NOTIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━

📄 Invoice: ${invoice.id}
👤 Name: ${userData?.fullName || invoice.user_name || "N/A"}
📧 Email: ${userData?.email || "N/A"}

💰 Amount: ${formatCurrency(invoice.amount)}
📋 Type: ${invoice.type === "vps" || invoice.type === "vps_rental" ? "VPS Rental" : "Profit Share"}
${invoice.account_number || invoice.accountNumber ? `🖥️ Account: ${invoice.account_number || invoice.accountNumber}` : ""}
${invoice.period_start && invoice.period_end ? `📅 Period: ${formatDate(periodStart)} - ${formatDate(periodEnd)}` : ""}

⏰ Due: ${formatDate(invoice.due_date)}
📌 Status: ${invoice.status.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━
Please confirm payment at your earliest convenience.

Thank you for your trust in KRX Quantitative Trading.
🔗 https://krx-trading.com`;
  };

  const handleDownload = () => {
    const html = generateReceiptHTML();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `KRX_Receipt_${invoice.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Receipt downloaded!");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(generateReceiptHTML());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const handleForwardTelegram = () => {
    const message = generateTelegramMessage();
    const telegramUrl = `https://t.me/${userData?.telegramId || ""}?text=${encodeURIComponent(message)}`;
    window.open(telegramUrl, "_blank");
    toast.success("Opening Telegram...");
  };

  const handleCopyLink = async () => {
    const message = generateTelegramMessage();
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Message copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[var(--card-bg)] border border-[var(--card-border)] w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-[var(--card-border)] bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[var(--foreground)]">Receipt Preview</h2>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">{invoice.id}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[var(--muted)] transition-colors"
            >
              <X size={20} className="text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div 
            className="bg-white rounded-xl p-6 text-black shadow-inner"
            dangerouslySetInnerHTML={{ __html: generateReceiptHTML() }}
            style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}
          />
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-[var(--card-border)] bg-[var(--muted)]/30">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition-all"
            >
              <Download size={16} />
              Download HTML
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-xl transition-all"
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={handleForwardTelegram}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white text-sm font-bold rounded-xl transition-all"
            >
              <Send size={16} />
              Telegram
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}