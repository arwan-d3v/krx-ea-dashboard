/**
 * PDF Generator Utility - Monthly Performance Report
 * Generates comprehensive PDF reports with weekly breakdown and analysis
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const COLORS = {
  primary: '#06b6d4',    // cyan-500
  success: '#10b981',    // emerald-500
  danger: '#ef4444',     // red-500
  warning: '#f59e0b',    // amber-500
  muted: '#64748b',      // slate-500
  dark: '#0f172a',       // slate-900
  light: '#f8fafc',      // slate-50
};

/**
 * Generate complete Monthly Performance Report PDF
 */
export const generateMonthlyReport = async ({
  account,
  month,
  year,
  summary,
  initialDeposit,
  weeklyData,
  monthDaysWithData,
  calendarDays,
}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Page 1: Cover & Summary
  generateCoverPage(doc, {
    account,
    month,
    year,
    summary,
    initialDeposit,
    pageWidth,
    pageHeight,
  });
  
  // Page 2: Weekly Breakdown
  doc.addPage();
  generateWeeklyBreakdown(doc, {
    weeklyData,
    initialDeposit,
    pageWidth,
    pageHeight,
  });
  
  // Page 3: Heatmap & Analytics
  doc.addPage();
  generateHeatmapPage(doc, {
    monthDaysWithData,
    month,
    year,
    pageWidth,
    pageHeight,
  });
  
  // Page 4: Advanced Analytics & Recommendations
  doc.addPage();
  generateAnalyticsPage(doc, {
    summary,
    weeklyData,
    initialDeposit,
    month,
    year,
    pageWidth,
    pageHeight,
  });
  
  // Save PDF
  const fileName = `Analytics_${account}_${year}-${String(month).padStart(2, '0')}.pdf`;
  doc.save(fileName);
  
  return fileName;
};

/**
 * Page 1: Cover & Monthly Summary
 */
const generateCoverPage = (doc, { account, month, year, summary, initialDeposit, pageWidth, pageHeight }) => {
  // Header background
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 60, 'F');
  
  // Title
  doc.setTextColor(6, 182, 212); // cyan-500
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTHLY PERFORMANCE REPORT', pageWidth / 2, 30, { align: 'center' });
  
  // Account info
  doc.setTextColor(148, 163, 184); // slate-400
  doc.setFontSize(12);
  doc.text(`Account: ${account}`, pageWidth / 2, 45, { align: 'center' });
  doc.text(`Period: ${month} ${year}`, pageWidth / 2, 52, { align: 'center' });
  
  // Summary section
  doc.setTextColor(15, 23, 42); // dark
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTHLY SUMMARY', 20, 80);
  
  // Summary cards
  const cardWidth = 42;
  const cardHeight = 25;
  const startX = 20;
  const startY = 90;
  const gap = 5;
  
  const summaryData = [
    { label: 'NET PROFIT', value: `$${summary.totalProfit.toLocaleString()}`, color: summary.totalProfit >= 0 ? '#10b981' : '#ef4444' },
    { label: 'GROSS PROFIT', value: `$${summary.grossProfit?.toLocaleString() || '0'}`, color: '#10b981' },
    { label: 'GROSS LOSS', value: `-$${summary.grossLoss?.toLocaleString() || '0'}`, color: '#ef4444' },
    { label: 'PROFIT FACTOR', value: summary.profitFactor?.toString() || '0', color: '#8b5cf6' },
    { label: 'WIN RATE', value: `${summary.winRate || 0}%`, color: '#f59e0b' },
    { label: 'TRADES', value: `${summary.tradingDays} Days`, color: '#06b6d4' },
  ];
  
  summaryData.forEach((item, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardWidth + gap);
    const y = startY + row * (cardHeight + gap + 15);
    
    // Card background
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
    
    // Label
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139); // muted
    doc.setFont('helvetica', 'bold');
    doc.text(item.label, x + 3, y + 8);
    
    // Value
    doc.setFontSize(12);
    doc.setTextColor(...hexToRgb(item.color));
    doc.text(item.value, x + 3, y + 18);
  });
  
  // Initial deposit & Monthly growth
  const depositY = startY + 2 * (cardHeight + gap + 15) + 20;
  
  doc.setFillColor(6, 182, 212); // cyan
  doc.roundedRect(20, depositY, pageWidth - 40, 20, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`Initial Deposit: $${initialDeposit.toLocaleString()}`, 25, depositY + 8);
  
  const monthlyGrowth = initialDeposit > 0 ? ((summary.totalProfit / initialDeposit) * 100).toFixed(2) : 0;
  doc.text(`Monthly Growth: ${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth}%`, 25, depositY + 15);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
};

/**
 * Page 2: Weekly Breakdown
 */
const generateWeeklyBreakdown = (doc, { weeklyData, initialDeposit, pageWidth, pageHeight }) => {
  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(6, 182, 212);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('WEEKLY PERFORMANCE BREAKDOWN', pageWidth / 2, 17, { align: 'center' });
  
  let yPos = 35;
  
  weeklyData.forEach((week, weekIndex) => {
    // Check if we need a new page
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }
    
    // Week header
    doc.setFillColor(241, 245, 249); // slate-100
    doc.roundedRect(15, yPos, pageWidth - 30, 8, 2, 2, 'F');
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`WEEK ${weekIndex + 1} (${week.startDate} - ${week.endDate})`, 20, yPos + 6);
    
    yPos += 12;
    
    // Daily breakdown table
    const tableData = week.days.map(day => [
      day.dayName,
      day.date.toString(),
      `${day.growth >= 0 ? '+' : ''}${day.growth.toFixed(2)}%`,
      `$${day.profit.toFixed(2)}`,
      `${day.lot.toFixed(2)} L`,
      day.status === 'win' ? 'WIN' : day.status === 'loss' ? 'LOSS' : '-',
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Day', 'Date', 'Growth', 'Profit', 'Volume', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [6, 182, 212], fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 15 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
      },
      margin: { left: 15, right: 15 },
    });
    
    yPos = doc.lastAutoTable.finalY + 5;
    
    // Week summary
    const weekProfit = week.days.reduce((sum, d) => sum + d.profit, 0);
    const weekGrowth = initialDeposit > 0 ? ((weekProfit / initialDeposit) * 100).toFixed(2) : 0;
    const tradingDays = week.days.filter(d => d.lot > 0).length;
    const winDays = week.days.filter(d => d.profit > 0).length;
    const winRate = tradingDays > 0 ? ((winDays / tradingDays) * 100).toFixed(1) : 0;
    
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    
    doc.text(`Total Profit: $${weekProfit.toFixed(2)}`, 20, yPos);
    doc.text(`Weekly Growth: ${weekGrowth >= 0 ? '+' : ''}${weekGrowth}%`, 80, yPos);
    doc.text(`Trading Days: ${tradingDays}/7`, 140, yPos);
    doc.text(`Win Rate: ${winRate}%`, 20, yPos + 5);
    
    yPos += 12;
    
    // Analysis text
    if (week.analysis) {
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.setFont('helvetica', 'italic');
      
      const analysisLines = doc.splitTextToSize(`Analysis: ${week.analysis}`, pageWidth - 40);
      doc.text(analysisLines, 20, yPos);
      yPos += analysisLines.length * 3 + 5;
    }
  });
};

/**
 * Page 3: Heatmap Visualization
 */
const generateHeatmapPage = (doc, { monthDaysWithData, month, year, pageWidth, pageHeight }) => {
  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(6, 182, 212);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${month.toUpperCase()} ${year} HEATMAP VISUALIZATION`, pageWidth / 2, 17, { align: 'center' });
  
  // Heatmap grid
  const cellWidth = 23;
  const cellHeight = 18;
  const startX = 20;
  const startY = 40;
  const gap = 2;
  
  // Day headers
  const dayHeaders = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'bold');
  
  dayHeaders.forEach((day, i) => {
    doc.text(day, startX + i * (cellWidth + gap) + cellWidth / 2, startY, { align: 'center' });
  });
  
  // Generate calendar grid
  const firstDay = new Date(year, month === 'January' ? 0 : getMonthIndex(month), 1).getDay();
  const daysInMonth = new Date(year, getMonthIndex(month) + 1, 0).getDate();
  
  let currentX = startX + firstDay * (cellWidth + gap);
  let currentY = startY + 8;
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(getMonthIndex(month) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = monthDaysWithData.find(d => d.dateStr === dateStr);
    
    // Cell background color
    const profit = dayData?.data?.daily_profit || 0;
    let fillColor;
    
    if (!dayData || (!dayData.data)) {
      fillColor = [30, 41, 59]; // slate-800 (no data)
    } else if (profit > 500) {
      fillColor = [16, 185, 129]; // emerald-500
    } else if (profit >= 200) {
      fillColor = [52, 211, 153]; // emerald-400
    } else if (profit > 0) {
      fillColor = [100, 116, 139]; // slate-500
    } else if (profit >= -199) {
      fillColor = [100, 116, 139]; // slate-500
    } else if (profit >= -500) {
      fillColor = [248, 113, 113]; // red-400
    } else {
      fillColor = [239, 68, 68]; // red-500
    }
    
    doc.setFillColor(...fillColor);
    doc.roundedRect(currentX, currentY, cellWidth, cellHeight, 2, 2, 'F');
    
    // Day number
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(day.toString(), currentX + 2, currentY + 6);
    
    // Growth percentage
    if (dayData?.data) {
      const growth = dayData.data.percentage_growth || 0;
      doc.setFontSize(6);
      doc.text(`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`, currentX + 2, currentY + 11);
      
      doc.setFontSize(5);
      doc.text(`$${Math.abs(profit).toFixed(0)}`, currentX + 2, currentY + 15);
    }
    
    // Move to next cell
    currentX += cellWidth + gap;
    if ((firstDay + day) % 7 === 0) {
      currentX = startX;
      currentY += cellHeight + gap;
    }
  }
  
  // Legend
  const legendY = currentY + 20;
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('LEGEND:', 20, legendY);
  
  const legendItems = [
    { color: [16, 185, 129], label: 'Profit >$500' },
    { color: [52, 211, 153], label: 'Profit $200-500' },
    { color: [100, 116, 139], label: 'Neutral/Minimal' },
    { color: [248, 113, 113], label: 'Loss $200-500' },
    { color: [239, 68, 68], label: 'Loss >$500' },
    { color: [30, 41, 59], label: 'No Data' },
  ];
  
  legendItems.forEach((item, i) => {
    const x = 20 + i * 30;
    doc.setFillColor(...item.color);
    doc.rect(x, legendY + 5, 8, 5, 'F');
    doc.setFontSize(5);
    doc.setTextColor(71, 85, 105);
    doc.text(item.label, x + 10, legendY + 9);
  });
};

/**
 * Page 4: Advanced Analytics & Recommendations
 */
const generateAnalyticsPage = (doc, { summary, weeklyData, initialDeposit, month, year, pageWidth, pageHeight }) => {
  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  doc.setTextColor(6, 182, 212);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ADVANCED ANALYTICS & RECOMMENDATIONS', pageWidth / 2, 17, { align: 'center' });
  
  let yPos = 40;
  
  // Performance Metrics
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Performance Metrics', 20, yPos);
  yPos += 8;
  
  // Find best/worst week
  let bestWeek = { profit: -Infinity, index: 0 };
  let worstWeek = { profit: Infinity, index: 0 };
  let bestDay = { profit: -Infinity, date: '' };
  let worstDay = { profit: Infinity, date: '' };
  
  weeklyData.forEach((week, i) => {
    const weekProfit = week.days.reduce((sum, d) => sum + d.profit, 0);
    if (weekProfit > bestWeek.profit) bestWeek = { profit: weekProfit, index: i + 1 };
    if (weekProfit < worstWeek.profit) worstWeek = { profit: weekProfit, index: i + 1 };
    
    week.days.forEach(day => {
      if (day.profit > bestDay.profit) bestDay = { profit: day.profit, date: day.dateStr };
      if (day.profit < worstDay.profit) worstDay = { profit: day.profit, date: day.dateStr };
    });
  });
  
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  
  const bestWeekGrowth = initialDeposit > 0 ? ((bestWeek.profit / initialDeposit) * 100).toFixed(2) : 0;
  const worstWeekGrowth = initialDeposit > 0 ? ((worstWeek.profit / initialDeposit) * 100).toFixed(2) : 0;
  const bestDayGrowth = initialDeposit > 0 ? ((bestDay.profit / initialDeposit) * 100).toFixed(2) : 0;
  const worstDayGrowth = initialDeposit > 0 ? ((worstDay.profit / initialDeposit) * 100).toFixed(2) : 0;
  
  doc.text(`• Best Week: Week ${bestWeek.index} ($${bestWeek.profit.toFixed(2)} / ${bestWeekGrowth}%)`, 25, yPos);
  doc.text(`• Worst Week: Week ${worstWeek.index} ($${worstWeek.profit.toFixed(2)} / ${worstWeekGrowth}%)`, 25, yPos + 6);
  doc.text(`• Best Day: ${bestDay.date} (+$${bestDay.profit.toFixed(2)} / +${bestDayGrowth}%)`, 25, yPos + 12);
  doc.text(`• Worst Day: ${worstDay.date} (-$${Math.abs(worstDay.profit).toFixed(2)} / ${worstDayGrowth}%)`, 25, yPos + 18);
  
  yPos += 30;
  
  // Trend Analysis
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Trend Analysis', 20, yPos);
  yPos += 8;
  
  // Calculate trends
  const totalWeeks = weeklyData.length;
  const avgDailyProfit = summary.tradingDays > 0 ? summary.totalProfit / summary.tradingDays : 0;
  const avgDailyGrowth = initialDeposit > 0 ? ((avgDailyProfit / initialDeposit) * 100).toFixed(2) : 0;
  
  // Weekend analysis
  let weekendTradingDays = 0;
  weeklyData.forEach(week => {
    weekendTradingDays += week.days.filter(d => (d.dayName === 'Sat' || d.dayName === 'Sun') && d.lot > 0).length;
  });
  
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`• Average Daily Profit: $${avgDailyProfit.toFixed(2)} (${avgDailyGrowth}%)`, 25, yPos);
  doc.text(`• Weekend Trading Activity: ${weekendTradingDays} days`, 25, yPos + 6);
  doc.text(`• Total Trading Days: ${summary.tradingDays}`, 25, yPos + 12);
  
  yPos += 25;
  
  // Recommendations
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Recommendations', 20, yPos);
  yPos += 8;
  
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  
  const recommendations = generateRecommendations(summary, weeklyData, initialDeposit);
  recommendations.forEach((rec, i) => {
    doc.text(`${i + 1}. ${rec}`, 25, yPos + (i * 6));
  });
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('This report is generated for informational purposes only.', pageWidth / 2, pageHeight - 10, { align: 'center' });
};

/**
 * Generate AI-like recommendations based on data analysis
 */
const generateRecommendations = (summary, weeklyData, initialDeposit) => {
  const recommendations = [];
  
  // Win rate analysis
  const winRate = parseFloat(summary.winRate) || 0;
  if (winRate >= 80) {
    recommendations.push('Excellent win rate maintained. Continue current strategy with consistent execution.');
  } else if (winRate >= 60) {
    recommendations.push('Good win rate. Consider optimizing entry/exit points to improve further.');
  } else {
    recommendations.push('Win rate needs improvement. Review trading strategy and risk management rules.');
  }
  
  // Profit factor analysis
  const profitFactor = summary.profitFactor || 0;
  if (profitFactor >= 2) {
    recommendations.push('Strong profit factor indicates good risk-reward ratio. Maintain current position sizing.');
  } else if (profitFactor >= 1.5) {
    recommendations.push('Adequate profit factor. Focus on reducing losing trades while maintaining winners.');
  } else {
    recommendations.push('Profit factor below optimal. Review trade selection and consider tighter stop losses.');
  }
  
  // Volatility analysis
  if (summary.maxDailyProfit && summary.maxDailyLoss) {
    const volatility = summary.maxDailyLoss / summary.maxDailyProfit;
    if (volatility > 0.8) {
      recommendations.push('High volatility detected. Consider implementing stricter risk management.');
    }
  }
  
  // Weekend trading
  let hasWeekendTrading = false;
  weeklyData.forEach(week => {
    week.days.forEach(day => {
      if ((day.dayName === 'Sat' || day.dayName === 'Sun') && day.lot > 0) {
        hasWeekendTrading = true;
      }
    });
  });
  
  if (!hasWeekendTrading) {
    recommendations.push('No weekend trading detected. Consider analyzing Monday gaps for positioning opportunities.');
  }
  
  // Monthly growth
  const monthlyGrowth = initialDeposit > 0 ? ((summary.totalProfit / initialDeposit) * 100) : 0;
  if (monthlyGrowth >= 10) {
    recommendations.push(`Outstanding ${monthlyGrowth.toFixed(1)}% monthly growth. Consider taking partial profits to secure gains.`);
  } else if (monthlyGrowth >= 5) {
    recommendations.push(`Good ${monthlyGrowth.toFixed(1)}% monthly growth. Maintain consistent approach for compounding.`);
  }
  
  return recommendations.slice(0, 5); // Return max 5 recommendations
};

/**
 * Helper: Convert hex color to RGB array
 */
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [0, 0, 0];
};

/**
 * Helper: Get month index from name
 */
const getMonthIndex = (monthName) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months.indexOf(monthName);
};

export default generateMonthlyReport;