# KRX Dashboard - Comprehensive Implementation Plan

## 📋 Table of Contents
1. [Phase 1: Invoicing & Receipt System Enhancement](#phase-1)
2. [Phase 2: Deep Analytics with Account Flags](#phase-2)
3. [Phase 3: Landing Page Optimization](#phase-3)
4. [Data Models & Firebase Structure](#data-models)
5. [Implementation Timeline](#timeline)

---

<a name="phase-1"></a>
## 📄 Phase 1: Invoicing & Receipt System Enhancement

### 1.1 Current State Analysis
**File:** `src/app/subscription-area/page.js`

**Existing Features:**
- Tree View Hierarchy (User → VPS → EA Account)
- Billing Center with invoice listing
- Basic invoice generation (manual & auto from monthly breakdown)
- Profit share calculation based on `computeAccountProfitSummary()`
- Telegram URL scheme for payment notification

**Current Data Flow:**
```
account_data/{accNum}/snapshots 
  → computeAccountProfitSummary()
  → monthlyBreakdown (profit, lots, feeShare, paid, pending, unpaid)
  → Invoice generation per month
```

### 1.2 New Features to Implement

#### A. Enhanced Invoice CRUD Operations

**Edit Invoice Price:**
- Add inline edit button on invoice rows
- Modal/form for editing `amount` field
- Update Firebase path: `invoices/{invId}/amount`
- Recalculate related profit share if needed
- Audit log for price changes

**Delete Invoice:**
- Soft delete with confirmation modal
- Update Firebase path: `invoices/{invId}/status` → "deleted"
- Keep record for audit trail
- Remove from active invoice lists

**Date Range Picker for Custom Period:**
- Add start_date and end_date picker in Billing Center
- Calculate profit within custom date range
- Generate invoice for specific period
- Store period info in invoice: `period_start`, `period_end`

#### B. Receipt Generator System

**New File:** `src/lib/receipt-generator.js`

**Receipt Data Structure:**
```javascript
{
  receiptId: "RCP-{timestamp}",
  invoiceId: "INV-{timestamp}",
  period_start: "2026-05-01",
  period_end: "2026-05-31",
  account_number: "12345678",
  investor_name: "John Doe",
  investor_email: "john@example.com",
  telegram_id: "@johndoe",
  
  // Financial Details
  total_profit: 1500.00,
  profit_share_percent: 30,
  fee_amount: 450.00,
  vps_cost: 25.00,
  total_due: 475.00,
  
  // Account Performance
  total_lots: 45.5,
  trading_days: 22,
  avg_daily_growth: 0.85,
  alltime_gain: 125.50,
  
  // Metadata
  generated_at: "2026-05-26T14:00:00+08:00",
  generated_by: "super_admin_uid",
  status: "issued"
}
```

**Receipt Features:**
1. **PDF Generation** using `jspdf` + `jspdf-autotable`
2. **HTML Receipt** for web preview
3. **Download as PDF** button
4. **Forward to Telegram** using Telegram Bot API

**Telegram Forward Implementation:**
```javascript
// src/app/api/telegram/send-receipt/route.js
POST /api/telegram/send-receipt
{
  invoiceId: string,
  telegramId: string,
  receiptData: object
}

// Sends formatted message with receipt details to investor's Telegram
// Includes inline keyboard for "Download PDF" callback
```

#### C. Sync with Profit Sharing Calculation

**Current Logic (from `computeAccountProfitSummary`):**
```javascript
// Per month:
feeShare = profit * (profitSharePercent / 100)
unpaid = feeShare - paidAmount
```

**Enhanced Logic:**
- Support custom date range calculation
- Calculate pro-rated profit share for partial periods
- Handle edge cases (no trading days, negative profit)
- Sync invoice status with payment records

### 1.3 UI/UX Changes

**Billing Center Tab Enhancements:**
1. Date range picker component
2. Invoice edit modal
3. Delete confirmation dialog
4. Receipt preview modal
5. Telegram send button with status indicator
6. Bulk actions (select multiple invoices)

**New Components to Create:**
- `src/components/invoice/InvoiceEditModal.jsx`
- `src/components/invoice/ReceiptPreview.jsx`
- `src/components/invoice/DateRangePicker.jsx`
- `src/components/invoice/InvoiceActions.jsx`

---

<a name="phase-2"></a>
## 🏆 Phase 2: Deep Analytics with Account Flags

### 2.1 Account Flag System

**Flag Types:**
| Flag | Label | Color | Visibility | Description |
|------|-------|-------|------------|-------------|
| `green` | Public Investor | 🟢 | Public, Admin, Super Admin | Active investor accounts for public display |
| `yellow` | Admin Investor | 🟡 | Admin, Super Admin | Admin's own investment accounts |
| `red` | Tester Account | 🔴 | Super Admin only | Testing/sandbox accounts |
| `black` | Owner Account | ⚫ | Super Admin only | Private owner accounts, hidden from others |

**Firebase Structure:**
```javascript
// users/{uid}/subscriptions/{vpsKey}/accounts/{accNum}
{
  profit_share_percent: 30,
  bot_start_date: "2026-01-01",
  account_flag: "green",  // NEW FIELD
  last_invoiced_date: null
}

// account_data/{accNum}/metadata
{
  bot_type: "GOD_MODE",
  broker: "MT5_SERVER",
  vps_name: "KRX-VPS-01",
  status: "active",
  account_flag: "green"  // MIRRORED HERE FOR QUICK ACCESS
}
```

### 2.2 Deep Analytics Page

**New Tab:** `src/app/deep-analytics/page.js`
**Access:** Super Admin only (tab in admin dashboard or separate route)

**Page Structure:**
```
┌─────────────────────────────────────────────────────┐
│  DEEP ANALYTICS - SUPER ADMIN                       │
├─────────────────────────────────────────────────────┤
│  [Flag Filter: 🟢 All | 🟢 Green | 🟡 Yellow | 🔴 Red | ⚫ Black] │
│  [Metric Filter: Daily Gain | All-Time | Growth Speed] │
│  [Server Filter | VPS Filter]                       │
├─────────────────────────────────────────────────────┤
│  RANKING TABLE                                      │
│  ┌────┬──────────┬────────┬────────┬────────┬──────┐│
│  │ #  │ Account  │ Avg    │ Server │ VPS    │Flag  ││
│  │    │          │ Daily  │ Most   │ Most   │      ││
│  │    │          │ Gain   │ Gain   │ Gain   │      ││
│  ├────┼──────────┼────────┼────────┼────────┼──────┤│
│  │ 1  │ 123456   │ +$45   │ NY-01  │ VPS-01 │ 🟢   ││
│  │ 2  │ 789012   │ +$38   │ NY-02  │ VPS-02 │ 🟡   ││
│  │ 3  │ 345678   │ +$32   │ NY-01  │ VPS-01 │ 🔴   ││
│  └────┴──────────┴────────┴────────┴────────┴──────┘│
├─────────────────────────────────────────────────────┤
│  FORECAST SECTION                                   │
│  Based on consistent performance:                   │
│  Account 123456: Projected +$1,350/month            │
│  Growth Speed: 2.3%/day                             │
│  Consistency Score: 94%                             │
└─────────────────────────────────────────────────────┘
```

### 2.3 Analytics Calculations

**Average Daily Gain:**
```javascript
// Only Mon-Fri (trading days)
const tradingSessions = Object.entries(snapshots)
  .filter(([ts]) => {
    const date = new Date(parseInt(ts));
    const day = date.getDay();
    return day >= 1 && day <= 5; // Mon-Fri
  })
  .map(([ts, data]) => ({
    date: ts,
    profit: data.daily_profit || 0,
    growth: data.daily_growth_percent || 0
  }));

const avgDailyGain = tradingSessions.reduce((sum, s) => sum + s.profit, 0) / tradingSessions.length;
```

**Server & VPS Aggregation:**
```javascript
// Group accounts by server (broker) and VPS
const serverStats = {};
const vpsStats = {};

accounts.forEach(acc => {
  const server = acc.metadata?.broker || "Unknown";
  const vps = acc.metadata?.vps_name || "Unknown";
  
  serverStats[server] = serverStats[server] || { totalGain: 0, accountCount: 0 };
  serverStats[server].totalGain += acc.avgDailyGain;
  serverStats[server].accountCount++;
  
  vpsStats[vps] = vpsStats[vps] || { totalGain: 0, accountCount: 0 };
  vpsStats[vps].totalGain += acc.avgDailyGain;
  vpsStats[vps].accountCount++;
});

// Find "Most Gain Server" and "Most Gain VPS"
const topServer = Object.entries(serverStats).sort((a, b) => b[1].totalGain - a[1].totalGain)[0];
const topVPS = Object.entries(vpsStats).sort((a, b) => b[1].totalGain - a[1].totalGain)[0];
```

**Growth Speed & Future Forecast:**
```javascript
// Calculate growth velocity (compound)
const growthSpeed = calculateCompoundGrowth(dailyGrowths);

// Future projection (if consistent)
const projectedMonthlyGain = currentBalance * (Math.pow(1 + growthSpeed, 30) - 1);
const consistencyScore = calculateConsistency(dailyProfits);
```

### 2.4 Visibility Rules

**Public View (Landing Page / Public Dashboard):**
- Only `account_flag === "green"`
- Show: Account number (partial masked), avg daily gain, alltime gain
- Hide: Server details, VPS details, owner info

**Admin View:**
- `account_flag IN ("green", "yellow")`
- Can see server & VPS details
- Cannot see black flag accounts

**Super Admin View:**
- All flags visible
- Full details including forecast
- Ability to change flags
- Export data capability

### 2.5 Components to Create

- `src/app/deep-analytics/page.js` - Main page
- `src/components/analytics/RankingTable.jsx` - Sortable ranking table
- `src/components/analytics/ForecastCard.jsx` - Future projection display
- `src/components/analytics/FlagBadge.jsx` - Flag indicator component
- `src/components/analytics/FilterBar.jsx` - Multi-filter component

---

<a name="phase-3"></a>
## 🎯 Phase 3: Landing Page Optimization

### 3.1 Current Landing Page Analysis
**File:** `src/app/page.js`

**Current Sections:**
1. Hero Section with CTA
2. Interactive Banner (calculator)
3. Arsenal Grid (bot types)
4. Projection Matrix (simulator)
5. Bottom CTA with Telegram link

### 3.2 New Section: Green Flag Investors Showcase

**Location:** Between Arsenal Grid and Projection Matrix

**Design:**
```
┌─────────────────────────────────────────────────────┐
│  TRUSTED BY ELITE INVESTORS                         │
│  Real-time performance from our Green Flag accounts │
├─────────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐           │
│  │K***1 │  │M***3 │  │S***7 │  │R***2 │           │
│  │+$42/d│  │+$38/d│  │+$35/d│  │+$31/d│           │
│  │+156% │  │+142% │  │+128% │  │+115% │           │
│  │3 mo  │  │2 mo  │  │4 mo  │  │1 mo  │           │
│  └──────┘  └──────┘  └──────┘  └──────┘           │
│                                                     │
│  🔒 Investor privacy protected                      │
│  📊 Data updated in real-time                       │
│  ✅ Verified Green Flag accounts only               │
└─────────────────────────────────────────────────────┘
```

### 3.3 Data Fetching for Public Display

**API Endpoint:** `src/app/api/public/investors/route.js`

```javascript
// GET /api/public/investors
// Returns anonymized Green Flag investor data

export async function GET() {
  // Fetch all accounts with account_flag === "green"
  // Anonymize: mask account number, remove personal info
  // Calculate metrics: avg daily gain, alltime gain, duration
  // Sort by alltime gain descending
  // Limit to top 8
  
  return Response.json({
    investors: [
      {
        id: "acc_masked_1",
        displayName: "K***1",
        avgDailyGain: 42.5,
        alltimeGain: 156.3,
        monthsActive: 3,
        botType: "GOD_MODE"
      },
      // ... more
    ],
    lastUpdated: new Date().toISOString()
  });
}
```

### 3.4 Enhanced Landing Page Components

**New Section Component:**
```javascript
// src/components/landing/InvestorShowcase.jsx

// Features:
// - Auto-refresh every 60 seconds
// - Animated counters for gains
// - Responsive grid layout
// - Privacy-first design (no PII)
// - Trust indicators (verified badge)
```

### 3.5 Trust Building Elements

1. **Real-time Badge:** "Live Data" indicator
2. **Verification Checkmark:** Green checkmark for verified accounts
3. **Performance Metrics:** Daily/Weekly/Monthly gains
4. **Testimonial Integration:** Optional investor quotes (if available)
5. **Statistics Bar:** Total investors, total gains, average return

---

<a name="data-models"></a>
## 🗄️ Data Models & Firebase Structure

### Complete Firebase Schema

```javascript
{
  // USER DATA
  users: {
    {uid}: {
      email: "investor@example.com",
      fullName: "John Doe",
      telegramId: "@johndoe",
      role: "investor", // | "admin" | "super_admin"
      setup_status: "completed",
      createdAt: "2026-01-01T00:00:00Z",
      
      // Managed groups (for admin role)
      managed_groups: {
        {groupId}: true
      },
      
      // Owned accounts reference
      owned_accounts: {
        {accNum}: true
      },
      
      // Subscription tree
      subscriptions: {
        {vpsKey}: {
          vps_name: "KRX-VPS-01",
          vps_monthly_cost: 25,
          billing_cycle_date: "2026-01-01",
          next_billing_date: "2026-02-01",
          status: "active",
          
          accounts: {
            {accNum}: {
              profit_share_percent: 30,
              bot_start_date: "2026-01-01",
              account_flag: "green", // 🟢🟡🔴⚫
              last_invoiced_date: "2026-05-01"
            }
          }
        }
      }
    }
  },
  
  // ACCOUNT DATA (EA Trading Data)
  account_data: {
    {accNum}: {
      metadata: {
        bot_type: "GOD_MODE", // | "BEAST_MODE" | "ENIGMA_OTE" | "NON_ML"
        broker: "NY_SERVER_01",
        vps_name: "KRX-VPS-01",
        investor_name: "John Doe",
        status: "active",
        account_flag: "green", // Mirrored for quick access
        bot_start_date: "2026-01-01"
      },
      
      realtime_stats: {
        balance: 15000,
        equity: 15500,
        margin: 2500,
        margin_level: 620,
        total_floating: 500,
        pure_profit: 5000,
        absolute_growth_percent: 33.33,
        drawdown_percent: 2.5,
        initial_deposit: 10000,
        additional_deposits: 2000,
        total_withdrawals: 500,
        last_update: 1716710400000
      },
      
      snapshots: {
        {timestamp}: {
          daily_profit: 42.50,
          daily_lots: 1.5,
          daily_growth_percent: 0.28,
          balance: 15000
        }
      },
      
      open_trades: [
        {
          ticket: 123456,
          symbol: "XAUUSD",
          type: "BUY",
          volume: 0.1,
          profit: 42.50
        }
      ],
      
      ai_terminal: {
        status: "PROFIT_SECURED",
        info: "Position closed with profit",
        timestamp: 1716710400000
      }
    }
  },
  
  // INVOICES
  invoices: {
    {invId}: {
      id: "INV-ABC123",
      uid: "user_uid",
      user_id: "user_uid",
      user_name: "John Doe",
      telegram_id: "@johndoe",
      
      type: "profit_share", // | "vps"
      account_number: "12345678",
      accountNumber: "12345678",
      
      // Period
      period_start: "2026-05-01",
      period_end: "2026-05-31",
      
      // Amounts
      amount: 450.00,
      total_profit: 1500.00,
      share_percentage: 30,
      
      // Status
      status: "pending", // | "paid" | "deleted"
      created_at: "2026-05-26T14:00:00Z",
      due_date: "2026-06-02T00:00:00Z",
      paid_at: null,
      
      // Receipt reference
      receipt_id: "RCP-XYZ789"
    }
  },
  
  // RECEIPTS
  receipts: {
    {rcpId}: {
      id: "RCP-XYZ789",
      invoiceId: "INV-ABC123",
      
      // Period
      period_start: "2026-05-01",
      period_end: "2026-05-31",
      
      // Account info
      account_number: "12345678",
      investor_name: "John Doe",
      telegram_id: "@johndoe",
      
      // Financial
      total_profit: 1500.00,
      profit_share_percent: 30,
      fee_amount: 450.00,
      vps_cost: 25.00,
      total_due: 475.00,
      
      // Performance
      total_lots: 45.5,
      trading_days: 22,
      avg_daily_growth: 0.85,
      alltime_gain: 125.50,
      
      // Metadata
      generated_at: "2026-05-26T14:00:00Z",
      generated_by: "super_admin_uid",
      status: "issued", // | "sent" | "downloaded"
      sent_to_telegram: true,
      sent_at: "2026-05-26T14:05:00Z"
    }
  },
  
  // GROUPS (for admin clustering)
  groups: {
    {groupId}: {
      name: "Cluster Alpha",
      accounts: {
        {accNum}: true
      }
    }
  },
  
  // PUBLIC ANALYTICS CACHE (for landing page)
  public_analytics: {
    lastUpdated: 1716710400000,
    topInvestors: [
      {
        account_number_masked: "K***1",
        avg_daily_gain: 42.50,
        alltime_gain: 156.30,
        months_active: 3,
        bot_type: "GOD_MODE"
      }
    ],
    statistics: {
      total_investors: 45,
      total_gains: 125000,
      avg_return_percent: 28.5
    }
  }
}
```

---

<a name="timeline"></a>
## 📅 Implementation Timeline

### Week 1: Invoice & Receipt System
| Day | Task | Priority |
|-----|------|----------|
| 1-2 | Create receipt-generator.js library | High |
| 2-3 | Build InvoiceEditModal component | High |
| 3-4 | Implement DateRangePicker component | High |
| 4-5 | Create /api/telegram/send-receipt endpoint | High |
| 5-6 | Build ReceiptPreview component | Medium |
| 6-7 | Integrate delete invoice functionality | High |
| 7 | Testing & bug fixes | High |

### Week 2: Deep Analytics - Part 1
| Day | Task | Priority |
|-----|------|----------|
| 1 | Add account_flag field to user registration | High |
| 2 | Create FlagBadge component | Medium |
| 3 | Build FilterBar component | High |
| 4 | Create RankingTable component | High |
| 5-6 | Build main Deep Analytics page | High |
| 7 | Testing & refinements | Medium |

### Week 3: Deep Analytics - Part 2
| Day | Task | Priority |
|-----|------|----------|
| 1-2 | Implement average daily gain calculation | High |
| 2-3 | Implement server & VPS aggregation | High |
| 3-4 | Build forecast/growth speed algorithm | Medium |
| 5 | Create visibility rules (role-based filtering) | High |
| 6 | Build admin-only tab access control | High |
| 7 | Testing & optimization | Medium |

### Week 4: Landing Page & Integration
| Day | Task | Priority |
|-----|------|----------|
| 1 | Create /api/public/investors endpoint | High |
| 2 | Build InvestorShowcase component | High |
| 3 | Integrate showcase into landing page | High |
| 4 | Add trust indicators & animations | Medium |
| 5 | Create public_analytics cache updater | Medium |
| 6-7 | Full integration testing | High |

---

## 🔧 Technical Dependencies

```json
{
  "dependencies": {
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "date-fns": "^3.6.0",
    "react-day-picker": "^9.0.0"
  }
}
```

## 🔐 Security Considerations

1. **Receipt Access:** Only super_admin can generate receipts
2. **Invoice Editing:** Only super_admin can edit/delete invoices
3. **Flag Management:** Only super_admin can change account flags
4. **Public API:** Rate-limited, cached, no PII exposure
5. **Telegram Integration:** Authenticated bot, encrypted messages

## 📊 Performance Optimizations

1. **Cache public_analytics** - Update hourly via cron
2. **Index Firebase queries** - on `account_flag`, `status`
3. **Lazy load Deep Analytics** - Only fetch when tab active
4. **Debounce filter changes** - Prevent excessive queries
5. **Memoize calculations** - React useMemo for heavy computations

---

## ✅ Acceptance Criteria

### Invoice System
- [ ] Can edit invoice price with audit trail
- [ ] Can delete invoice (soft delete)
- [ ] Can select custom date range for invoice
- [ ] Receipt generates correctly with all data
- [ ] Receipt can be downloaded as PDF
- [ ] Receipt can be forwarded to Telegram
- [ ] Profit share calculation is accurate

### Deep Analytics
- [ ] Only super_admin can access Deep Analytics tab
- [ ] Account flags work correctly (green/yellow/red/black)
- [ ] Public sees only green flag accounts
- [ ] Admin sees green + yellow flags
- [ ] Super admin sees all flags
- [ ] Ranking table sorts correctly
- [ ] Filters work for flag, metric, server, VPS
- [ ] Forecast calculation is reasonable

### Landing Page
- [ ] Green flag investors displayed
- [ ] Data anonymized (no PII)
- [ ] Real-time updates working
- [ ] Trust indicators visible
- [ ] Responsive on all devices

---

*Plan Created: 2026-05-26*
*Last Updated: 2026-05-26*