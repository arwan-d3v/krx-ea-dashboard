// ============================================================================
// RECEIPT GENERATOR LIBRARY
// - Generate professional receipts/invoices
// - Export to PDF/HTML
// - Calculate profit sharing based on cycle periods
// ============================================================================

/**
 * Generate receipt HTML for an invoice
 * @param {Object} invoice - Invoice data
 * @param {Object} userData - User data
 * @param {Object} accountData - Account data
 * @returns {string} HTML string
 */
export function generateReceiptHTML(invoice, userData, accountData) {
  const invoiceDate = new Date(invoice.created_at || Date.now()).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  const periodStart = invoice.period_start
    ? new Date(invoice.period_start).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A";

  const periodEnd = invoice.period_end
    ? new Date(invoice.period_end).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "N/A";

  const isVPS = invoice.type === "vps" || invoice.type === "vps_rental";
  const typeLabel = isVPS ? "VPS Rental" : "Profit Share";
  const typeColor = isVPS ? "#3b82f6" : "#8b5cf6";

  const amount = Number(invoice.amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const totalProfit = Number(invoice.total_profit || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sharePercentage = Number(invoice.share_percentage || invoice.profit_share_percent || 30);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.id}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #f5f5f5;
      padding: 40px 20px;
      color: #1a1a1a;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
      overflow: hidden;
    }
    .invoice-header {
      background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
      color: white;
      padding: 40px;
      position: relative;
    }
    .invoice-header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: ${typeColor};
    }
    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 48px;
      height: 48px;
      background: ${typeColor};
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: 900;
      color: white;
    }
    .brand-name {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 11px;
      opacity: 0.6;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-top: 2px;
    }
    .invoice-badge {
      background: ${typeColor};
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .invoice-title {
      font-size: 36px;
      font-weight: 900;
      letter-spacing: -1px;
    }
    .invoice-id {
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 14px;
      opacity: 0.7;
      margin-top: 4px;
    }
    .invoice-body {
      padding: 40px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    .info-block h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #64748b;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .info-block p {
      font-size: 14px;
      color: #1e293b;
      font-weight: 600;
      line-height: 1.6;
    }
    .info-block .highlight {
      font-size: 16px;
      color: ${typeColor};
      font-weight: 700;
    }
    .period-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 40px;
    }
    .period-box h3 {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #64748b;
      margin-bottom: 12px;
      font-weight: 700;
    }
    .period-dates {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .period-date {
      flex: 1;
      text-align: center;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .period-date .label {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .period-date .value {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
    }
    .period-arrow {
      font-size: 20px;
      color: ${typeColor};
      font-weight: 900;
    }
    .amount-section {
      background: linear-gradient(135deg, ${typeColor}10 0%, ${typeColor}05 100%);
      border: 2px solid ${typeColor}30;
      border-radius: 16px;
      padding: 30px;
      text-align: center;
      margin-bottom: 40px;
    }
    .amount-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #64748b;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .amount-value {
      font-size: 42px;
      font-weight: 900;
      color: ${typeColor};
      letter-spacing: -2px;
    }
    .amount-currency {
      font-size: 24px;
      opacity: 0.6;
      margin-right: 4px;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 40px;
    }
    .details-table th {
      text-align: left;
      padding: 12px 16px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #64748b;
      border-bottom: 2px solid #e2e8f0;
      font-weight: 700;
    }
    .details-table th:last-child {
      text-align: right;
    }
    .details-table td {
      padding: 16px;
      font-size: 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    .details-table td:last-child {
      text-align: right;
      font-weight: 700;
      font-family: 'Monaco', 'Consolas', monospace;
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-paid {
      background: #dcfce7;
      color: #16a34a;
    }
    .status-pending {
      background: #fef3c7;
      color: #d97706;
    }
    .status-unpaid {
      background: #fee2e2;
      color: #dc2626;
    }
    .invoice-footer {
      padding: 30px 40px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .footer-brand {
      font-size: 16px;
      font-weight: 900;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .footer-text {
      font-size: 11px;
      color: #94a3b8;
    }
    @media print {
      body { background: white; padding: 0; }
      .invoice-container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="invoice-header">
      <div class="header-top">
        <div class="brand">
          <div class="brand-icon">K</div>
          <div>
            <div class="brand-name">KRX Capital</div>
            <div class="brand-sub">Quantitative Trading System</div>
          </div>
        </div>
        <div class="invoice-badge">${typeLabel}</div>
      </div>
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-id">${invoice.id}</div>
    </div>

    <div class="invoice-body">
      <div class="info-grid">
        <div class="info-block">
          <h3>Bill To</h3>
          <p>${userData?.fullName || "N/A"}</p>
          <p style="font-size: 12px; color: #64748b;">${userData?.email || ""}</p>
          ${userData?.telegramId ? `<p style="font-size: 12px; color: #64748b;">Telegram: ${userData.telegramId}</p>` : ""}
        </div>
        <div class="info-block">
          <h3>Invoice Details</h3>
          <p>Date: ${invoiceDate}</p>
          <p>Due: ${dueDate}</p>
          <p class="highlight">Status: ${(invoice.status || "pending").toUpperCase()}</p>
        </div>
      </div>

      ${
        !isVPS && invoice.period_start && invoice.period_end
          ? `
      <div class="period-box">
        <h3>Profit Share Period</h3>
        <div class="period-dates">
          <div class="period-date">
            <div class="label">Start Date</div>
            <div class="value">${periodStart}</div>
          </div>
          <div class="period-arrow">→</div>
          <div class="period-date">
            <div class="label">End Date</div>
            <div class="value">${periodEnd}</div>
          </div>
        </div>
      </div>
      `
          : ""
      }

      <div class="amount-section">
        <div class="amount-label">Amount Due</div>
        <div class="amount-value">
          <span class="amount-currency">$</span>${amount}
        </div>
      </div>

      <table class="details-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Details</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${isVPS ? "VPS Hosting Fee" : "Profit Share Fee"}</td>
            <td>${
              isVPS
                ? `Monthly VPS rental for account ${invoice.account_number || invoice.accountNumber || "N/A"}`
                : `${sharePercentage}% of profit for account ${invoice.account_number || invoice.accountNumber || "N/A"}`
            }</td>
            <td>$${amount}</td>
          </tr>
          ${
            !isVPS && invoice.total_profit
              ? `
          <tr>
            <td>Total Profit Generated</td>
            <td>Trading profit during period</td>
            <td>$${totalProfit}</td>
          </tr>
          `
              : ""
          }
        </tbody>
      </table>

      <div style="text-align: center;">
        <span class="status-badge status-${invoice.status || "pending"}">
          ${
            invoice.status === "paid"
              ? "✓ PAID"
              : invoice.status === "pending"
              ? "⏳ PENDING PAYMENT"
              : "✗ UNPAID"
          }
        </span>
      </div>
    </div>

    <div class="invoice-footer">
      <div class="footer-brand">KRX Capital</div>
      <div class="footer-text">Quantitative Trading System • Powered by AI Machine Learning</div>
      <div class="footer-text" style="margin-top: 4px;">This is a computer-generated invoice. No signature required.</div>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Generate Telegram message for invoice
 * @param {Object} invoice - Invoice data
 * @param {Object} userData - User data
 * @returns {string} Encoded Telegram message
 */
export function generateTelegramMessage(invoice, userData) {
  const isVPS = invoice.type === "vps" || invoice.type === "vps_rental";
  const typeLabel = isVPS ? "VPS Rental" : "Profit Share";
  const amount = Number(invoice.amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
  });

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  const periodInfo =
    !isVPS && invoice.period_start && invoice.period_end
      ? `\n📅 Period: ${new Date(invoice.period_start).toLocaleDateString()} → ${new Date(invoice.period_end).toLocaleDateString()}`
      : "";

  const message = `📄 *INVOICE PAYMENT*\n\n` +
    `Invoice: \`${invoice.id}\`\n` +
    `Name: ${userData?.fullName || invoice.user_name || "N/A"}\n` +
    `Type: ${typeLabel}\n` +
    `Account: \`${invoice.account_number || invoice.accountNumber || "N/A"}\`\n` +
    `${periodInfo}\n` +
    `Amount: *$${amount}*\n` +
    `Due: ${dueDate}\n` +
    `Status: ${(invoice.status || "pending").toUpperCase()}\n\n` +
    `Please confirm this payment. Thank you! 🙏`;

  return encodeURIComponent(message);
}

/**
 * Calculate profit share for a period
 * @param {Array} dailyData - Array of daily profit data
 * @param {number} sharePercentage - Profit share percentage
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object} Calculation result
 */
export function calculateProfitShareForPeriod(dailyData, sharePercentage, startDate, endDate) {
  let totalProfit = 0;
  let totalLots = 0;
  let tradingDays = 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  dailyData.forEach((day) => {
    const dayDate = new Date(day.date);
    if (dayDate >= start && dayDate <= end) {
      totalProfit += day.profit || 0;
      totalLots += day.lots || 0;
      tradingDays++;
    }
  });

  const feeAmount = totalProfit * (sharePercentage / 100);

  return {
    totalProfit: +totalProfit.toFixed(2),
    totalLots: +totalLots.toFixed(2),
    tradingDays,
    sharePercentage,
    feeAmount: +feeAmount.toFixed(2),
    startDate,
    endDate,
  };
}

/**
 * Format currency for display
 * @param {number} value - Numeric value
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/**
 * Generate unique invoice ID
 * @returns {string} Unique invoice ID
 */
export function generateInvoiceId() {
  const prefix = "INV";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}