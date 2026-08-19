import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import type { PdfReportData } from "@/lib/pdf-report";
import { clientStatusLabel } from "@/lib/clients";
import { formatDateTime } from "@/lib/format";
import { formatPercent } from "@/lib/margin-status";
import {
  billingCycleLabel,
  currencySymbol,
  formatMoney,
} from "@/lib/retainers";
import { formatHours } from "@/lib/time";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Rgb = [number, number, number];

const COLORS = {
  primary: [37, 99, 235] as Rgb,
  primaryDark: [30, 64, 175] as Rgb,
  ink: [15, 23, 42] as Rgb,
  muted: [100, 116, 139] as Rgb,
  border: [226, 232, 240] as Rgb,
  fill: [241, 245, 249] as Rgb,
  white: [255, 255, 255] as Rgb,
  softWhite: [191, 219, 254] as Rgb,
  emerald: [5, 150, 105] as Rgb,
  amber: [217, 119, 6] as Rgb,
  red: [220, 38, 38] as Rgb,
};

function moneyColor(value: number): Rgb {
  if (value < 0) return COLORS.red;
  if (value > 0) return COLORS.emerald;
  return COLORS.ink;
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function compactMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  const compact = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(abs);
  return `${value < 0 ? "-" : ""}${currencySymbol(currency)}${compact}`;
}

function formatMarginTick(value: number): string {
  return `${Math.round(value)}%`;
}

function shortMonth(label: string): string {
  return label.split(" ")[0] ?? label;
}

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let value = text;
  while (value.length > 0 && doc.getTextWidth(`${value}…`) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}…`;
}

function fitValue(doc: jsPDF, value: string, maxWidth: number): string {
  let size = 11;
  while (size > 8 && doc.getTextWidth(value) > maxWidth) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  return value;
}

export function reportFilename(data: PdfReportData): string {
  const client = data.client.name
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${client}-${data.periodKey}-report.pdf`;
}

function drawLegendSwatch(
  doc: jsPDF,
  color: Rgb,
  label: string,
  x: number,
  y: number,
) {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(x, y - 4, 6, 6, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.text(label, x + 10, y);
}

function drawTrendChart(
  doc: jsPDF,
  data: PdfReportData,
  x: number,
  top: number,
  w: number,
  h: number,
) {
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(1);
  doc.setFillColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.roundedRect(x, top, w, h, 6, 6, "FD");

  const points = data.trend;
  const leftW = 58;
  const rightW = 44;
  const topPad = 26;
  const bottomPad = 26;
  const px0 = x + leftW;
  const px1 = x + w - rightW;
  const py0 = top + topPad;
  const py1 = top + h - bottomPad;
  const plotW = px1 - px0;
  const plotH = py1 - py0;

  if (points.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text("No trend data", x + w / 2, top + h / 2, { align: "center" });
    return;
  }

  const maxMoney = niceCeil(
    Math.max(
      1,
      ...points.map((point) => Math.max(point.revenue, point.cost)),
    ),
  );
  let marginMin = Math.min(0, ...points.map((point) => point.marginPercent));
  let marginMax = Math.max(0, ...points.map((point) => point.marginPercent));
  if (marginMax - marginMin === 0) {
    marginMax += 10;
    marginMin -= 10;
  }
  const marginSpan = marginMax - marginMin;

  const moneyY = (value: number) => py1 - (value / maxMoney) * plotH;
  const marginY = (value: number) =>
    py1 - ((value - marginMin) / marginSpan) * plotH;

  const gridCount = 4;
  for (let i = 0; i <= gridCount; i += 1) {
    const gy = py0 + (plotH / gridCount) * i;
    const ratio = 1 - i / gridCount;
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.5);
    doc.line(px0, gy, px1, gy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(compactMoney(maxMoney * ratio, data.currency), px0 - 6, gy + 2, {
      align: "right",
    });
    doc.text(
      formatMarginTick(marginMin + marginSpan * ratio),
      px1 + 6,
      gy + 2,
    );
  }

  if (marginMin < 0 && marginMax > 0) {
    doc.setDrawColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([3, 3], 0);
    doc.line(px0, marginY(0), px1, marginY(0));
    doc.setLineDashPattern([], 0);
  }

  const n = points.length;
  const slot = plotW / n;
  const centerX = (index: number) => px0 + slot * index + slot / 2;
  const barW = Math.min(slot * 0.26, 15);

  points.forEach((point, index) => {
    const cx = centerX(index);
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(
      cx - barW - 1.5,
      moneyY(point.revenue),
      barW,
      Math.max(0, py1 - moneyY(point.revenue)),
      "F",
    );
    doc.setFillColor(COLORS.amber[0], COLORS.amber[1], COLORS.amber[2]);
    doc.rect(
      cx + 1.5,
      moneyY(point.cost),
      barW,
      Math.max(0, py1 - moneyY(point.cost)),
      "F",
    );
  });

  doc.setDrawColor(
    COLORS.primaryDark[0],
    COLORS.primaryDark[1],
    COLORS.primaryDark[2],
  );
  doc.setLineWidth(1.3);
  for (let i = 0; i < n - 1; i += 1) {
    doc.line(
      centerX(i),
      marginY(points[i].marginPercent),
      centerX(i + 1),
      marginY(points[i + 1].marginPercent),
    );
  }
  doc.setFillColor(
    COLORS.primaryDark[0],
    COLORS.primaryDark[1],
    COLORS.primaryDark[2],
  );
  points.forEach((point, index) => {
    doc.circle(centerX(index), marginY(point.marginPercent), 1.8, "F");
  });

  points.forEach((point, index) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text(shortMonth(point.label), centerX(index), py1 + 12, {
      align: "center",
    });
  });

  const legendY = top + 12;
  drawLegendSwatch(doc, COLORS.primary, "Revenue", x + 8, legendY);
  drawLegendSwatch(doc, COLORS.amber, "Cost", x + 90, legendY);
  doc.setDrawColor(
    COLORS.primaryDark[0],
    COLORS.primaryDark[1],
    COLORS.primaryDark[2],
  );
  doc.setLineWidth(1.2);
  doc.line(x + 168, legendY - 1, x + 184, legendY - 1);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
  doc.text("Margin %", x + 188, legendY);
}

export function buildClientPdfDocument(data: PdfReportData): jsPDF {
  const doc = new jsPDF({
    unit: "pt",
    format: "letter",
    orientation: "portrait",
  });
  const cursor = { y: 0 };

  function ensure(needed: number) {
    if (cursor.y + needed > PAGE_H - 56) {
      doc.addPage();
      cursor.y = MARGIN;
    }
  }

  function setFont(style: "normal" | "bold", size: number) {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
  }

  function fillText(
    text: string,
    x: number,
    y: number,
    color: Rgb = COLORS.ink,
    align: "left" | "center" | "right" = "left",
  ) {
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, x, y, { align });
  }

  function sectionHeading(title: string) {
    ensure(44);
    setFont("bold", 12.5);
    fillText(title, MARGIN, cursor.y, COLORS.primaryDark);
    cursor.y += 15;
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.75);
    doc.line(MARGIN, cursor.y, PAGE_W - MARGIN, cursor.y);
    cursor.y += 12;
  }

  // Header band
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, PAGE_W, 60, "F");
  doc.setFillColor(COLORS.emerald[0], COLORS.emerald[1], COLORS.emerald[2]);
  doc.rect(0, 60, PAGE_W, 2.5, "F");

  setFont("bold", 17);
  fillText("Pace", MARGIN, 26, COLORS.white);
  setFont("normal", 8.5);
  fillText("Agency profit & performance", MARGIN, 43, COLORS.softWhite);
  setFont("bold", 11);
  fillText(
    "Monthly Profitability Report",
    PAGE_W - MARGIN,
    26,
    COLORS.white,
    "right",
  );
  setFont("normal", 8.5);
  fillText(
    `Generated ${formatDateTime(new Date(data.generatedAt))}`,
    PAGE_W - MARGIN,
    43,
    COLORS.softWhite,
    "right",
  );

  // Title + reporting period
  cursor.y = 60 + 28;
  setFont("bold", 21);
  fillText(data.client.name, MARGIN, cursor.y, COLORS.ink);
  cursor.y += 17;
  setFont("normal", 10.5);
  fillText(
    data.client.company ?? "Client profitability report",
    MARGIN,
    cursor.y,
    COLORS.muted,
  );
  cursor.y += 22;

  const periodText = `Reporting period: ${data.periodLabel}`;
  setFont("bold", 9.5);
  const pillW = doc.getTextWidth(periodText) + 26;
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.roundedRect(MARGIN, cursor.y - 9, pillW, 18, 9, 9, "F");
  fillText(periodText, MARGIN + 13, cursor.y, COLORS.white);
  cursor.y += 24;

  // Client information
  sectionHeading("Client information");

  const clientItems = [
    { label: "Company", value: data.client.company ?? "—" },
    { label: "Website", value: data.client.website ?? "—" },
    { label: "Status", value: clientStatusLabel(data.client.status) },
    { label: "Primary contact", value: data.client.contactName ?? "—" },
    { label: "Contact email", value: data.client.contactEmail ?? "—" },
    { label: "Phone", value: data.client.phone ?? "—" },
  ];
  const boxTop = cursor.y;
  const boxH = 22 + 3 * 34;
  ensure(boxH + 24);
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(1);
  doc.setFillColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.roundedRect(MARGIN, boxTop, CONTENT_W, boxH, 6, 6, "FD");
  const colW = CONTENT_W / 2;
  clientItems.forEach((item, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = MARGIN + 16 + col * colW;
    const labelY = boxTop + 18 + row * 34;
    setFont("normal", 7);
    fillText(item.label.toUpperCase(), x, labelY, COLORS.muted);
    setFont("bold", 9);
    fillText(truncateText(doc, item.value, colW - 34), x, labelY + 13, COLORS.ink);
  });
  cursor.y = boxTop + boxH + 24;

  // Period overview
  sectionHeading("Period overview");

  const tiles: Array<{ label: string; value: string; color: Rgb }> = [
    { label: "Revenue", value: formatMoney(data.revenue, data.currency), color: COLORS.ink },
    { label: "Cost", value: formatMoney(data.cost, data.currency), color: COLORS.ink },
    { label: "Profit", value: formatMoney(data.profit, data.currency), color: moneyColor(data.profit) },
    { label: "Margin %", value: formatPercent(data.marginPercent), color: moneyColor(data.marginPercent) },
    { label: "Total hours", value: formatHours(data.totalHours), color: COLORS.ink },
    {
      label: data.billingCycle
        ? `Budget (${billingCycleLabel(data.billingCycle).toLowerCase()})`
        : "Budget",
      value:
        data.monthlyBudget !== null
          ? formatMoney(data.monthlyBudget, data.currency)
          : "—",
      color: COLORS.ink,
    },
    {
      label: "Scope hours",
      value:
        data.scopeHours !== null
          ? `${data.scopeHours.toLocaleString("en")} hrs`
          : "—",
      color: COLORS.ink,
    },
  ];
  const tileCols = 4;
  const tileGap = 10;
  const tileW = (CONTENT_W - (tileCols - 1) * tileGap) / tileCols;
  const tileH = 54;
  ensure(2 * (tileH + tileGap) + 12);
  tiles.forEach((tile, index) => {
    const row = Math.floor(index / tileCols);
    const col = index % tileCols;
    const x = MARGIN + col * (tileW + tileGap);
    const ty = cursor.y + row * (tileH + tileGap);
    doc.setFillColor(COLORS.fill[0], COLORS.fill[1], COLORS.fill[2]);
    doc.roundedRect(x, ty, tileW, tileH, 5, 5, "F");
    setFont("normal", 7);
    fillText(tile.label.toUpperCase(), x + 12, ty + 16, COLORS.muted);
    setFont("bold", 11);
    fillText(fitValue(doc, tile.value, tileW - 24), x + 12, ty + 37, tile.color);
  });
  cursor.y += 2 * (tileH + tileGap) + 8;

  // Margin trend chart
  sectionHeading("Margin trend");
  const chartH = 150;
  ensure(chartH + 12);
  drawTrendChart(doc, data, MARGIN, cursor.y, CONTENT_W, chartH);
  cursor.y += chartH + 24;

  // Monthly breakdown
  sectionHeading("Monthly breakdown");
  ensure(40);
  const rows = data.trend.slice().reverse().map((point) => [
    point.label,
    formatMoney(point.revenue, data.currency),
    formatMoney(point.cost, data.currency),
    {
      content: formatMoney(point.profit, data.currency),
      styles: { textColor: moneyColor(point.profit) },
    },
    {
      content: formatPercent(point.marginPercent),
      styles: { textColor: moneyColor(point.marginPercent) },
    },
    formatHours(point.hours),
  ]);
  autoTable(doc, {
    startY: cursor.y,
    margin: { left: MARGIN, right: MARGIN },
    head: [["Month", "Revenue", "Cost", "Profit", "Margin %", "Hours"]],
    body: rows,
    theme: "striped",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      cellPadding: 5,
      textColor: COLORS.ink,
      lineColor: COLORS.border,
      lineWidth: 0.5,
    },
    headStyles: {
      fillColor: COLORS.primaryDark,
      textColor: COLORS.white,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: COLORS.fill },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });
  const tableEnd =
    (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? cursor.y;
  cursor.y = tableEnd + 24;

  // Summary
  sectionHeading("Summary");
  ensure(40);
  setFont("normal", 9.5);
  const summaryLines = doc.splitTextToSize(data.summary, CONTENT_W) as string[];
  ensure(summaryLines.length * 13 + 10);
  doc.setTextColor(COLORS.ink[0], COLORS.ink[1], COLORS.ink[2]);
  doc.text(summaryLines, MARGIN, cursor.y, { lineHeightFactor: 1.35 });
  cursor.y += summaryLines.length * 13 + 6;

  // Footer
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, PAGE_H - 42, PAGE_W - MARGIN, PAGE_H - 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(COLORS.muted[0], COLORS.muted[1], COLORS.muted[2]);
    doc.text("Pace · Monthly Profitability Report", MARGIN, PAGE_H - 26);
    doc.text(
      `Generated ${formatDateTime(new Date(data.generatedAt))}`,
      PAGE_W / 2,
      PAGE_H - 26,
      { align: "center" },
    );
    doc.text(`Page ${page} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 26, {
      align: "right",
    });
  }
  doc.setPage(1);

  return doc;
}

export function downloadClientPdf(data: PdfReportData): void {
  const doc = buildClientPdfDocument(data);
  doc.save(reportFilename(data));
}
