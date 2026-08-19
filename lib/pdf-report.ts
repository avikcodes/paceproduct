import "server-only";

import { prisma } from "@/lib/prisma";
import { clientSelect, type ClientRow } from "@/lib/clients";
import {
  getClientMarginDetails,
  type MonthlyMarginRow,
} from "@/lib/margins";
import {
  billingCycleRateLabel,
  formatMoney,
  formatRetainerDate,
  retainerSelect,
  toRetainerRow,
  type RetainerRow,
} from "@/lib/retainers";
import { formatPercent } from "@/lib/margin-status";
import { formatHours } from "@/lib/time";
import { monthKeyOf } from "@/lib/format";
import type { ClientStatus, BillingCycle } from "@/lib/generated/prisma/enums";
import {
  parseReportTrendJson,
  reportPeriodLabel,
  type ReportSnapshotTrendPoint,
} from "@/lib/report-snapshot";

export type PdfReportClient = {
  name: string;
  company: string | null;
  website: string | null;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  status: ClientStatus;
};

export type PdfTrendPoint = {
  key: string;
  label: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  hours: number;
};

export type PdfReportData = {
  client: PdfReportClient;
  periodKey: string;
  periodLabel: string;
  currency: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  totalHours: number;
  monthlyBudget: number | null;
  scopeHours: number | null;
  billingCycle: BillingCycle | null;
  retainerPeriod: { startLabel: string; endLabel: string | null } | null;
  trend: PdfTrendPoint[];
  summary: string;
  generatedAt: string;
};

function clientToPdfReportClient(client: ClientRow): PdfReportClient {
  return {
    name: client.name,
    company: client.company,
    website: client.website,
    contactName: client.contactName,
    contactEmail: client.contactEmail,
    phone: client.phone,
    status: client.status,
  };
}

function retainerPeriodFromDates(
  startDate: Date | null,
  endDate: Date | null,
): { startLabel: string; endLabel: string | null } | null {
  if (!startDate) return null;
  return {
    startLabel: formatRetainerDate(startDate),
    endLabel: endDate ? formatRetainerDate(endDate) : null,
  };
}

function snapshotTrendToPdf(points: ReportSnapshotTrendPoint[]): PdfTrendPoint[] {
  return points.map((point) => ({
    key: point.key,
    label: point.label,
    revenue: point.revenue,
    cost: point.cost,
    profit: point.profit,
    marginPercent: point.marginPercent,
    hours: point.hours,
  }));
}

function singlePointTrend(
  periodKey: string,
  revenue: number,
  cost: number,
  profit: number,
  marginPercent: number,
  hours: number,
): PdfTrendPoint[] {
  return [
    {
      key: periodKey,
      label: reportPeriodLabel(periodKey),
      revenue,
      cost,
      profit,
      marginPercent,
      hours,
    },
  ];
}

function trendFromMonths(months: MonthlyMarginRow[]): PdfTrendPoint[] {
  return months
    .slice(0, 6)
    .slice()
    .reverse()
    .map((month) => ({
      key: month.key,
      label: reportPeriodLabel(month.key),
      revenue: month.revenue,
      cost: month.cost,
      profit: month.profit,
      marginPercent: month.marginPercent,
      hours: month.hours,
    }));
}

type ComposePdfInput = {
  client: PdfReportClient;
  periodKey: string;
  currency: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  totalHours: number;
  monthlyBudget: number | null;
  scopeHours: number | null;
  billingCycle: BillingCycle | null;
  retainerPeriod: { startLabel: string; endLabel: string | null } | null;
  trend: PdfTrendPoint[];
  generatedAt: string;
};

function composePdfReportData(input: ComposePdfInput): PdfReportData {
  const data: PdfReportData = {
    client: input.client,
    periodKey: input.periodKey,
    periodLabel: reportPeriodLabel(input.periodKey),
    currency: input.currency,
    revenue: input.revenue,
    cost: input.cost,
    profit: input.profit,
    marginPercent: input.marginPercent,
    totalHours: input.totalHours,
    monthlyBudget: input.monthlyBudget,
    scopeHours: input.scopeHours,
    billingCycle: input.billingCycle,
    retainerPeriod: input.retainerPeriod,
    trend: input.trend,
    summary: "",
    generatedAt: input.generatedAt,
  };

  data.summary = buildSummary({
    ...data,
    clientName: data.client.name,
  });

  return data;
}

function buildSummary(input: {
  clientName: string;
  periodLabel: string;
  currency: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPercent: number;
  totalHours: number;
  monthlyBudget: number | null;
  scopeHours: number | null;
  billingCycle: BillingCycle | null;
  trend: PdfTrendPoint[];
}): string {
  const {
    clientName,
    periodLabel,
    currency,
    revenue,
    cost,
    profit,
    marginPercent,
    totalHours,
    monthlyBudget,
    scopeHours,
    billingCycle,
    trend,
  } = input;

  const parts: string[] = [];

  parts.push(
    `During ${periodLabel}, ${clientName} recorded ${formatMoney(revenue, currency)} in revenue against ${formatMoney(cost, currency)} in cost, resulting in a profit of ${formatMoney(profit, currency)} and a ${formatPercent(marginPercent)} margin across ${formatHours(totalHours)} of logged time.`,
  );

  if (monthlyBudget !== null) {
    parts.push(
      `The active retainer carries a budget of ${formatMoney(monthlyBudget, currency)}${billingCycle ? billingCycleRateLabel(billingCycle) : ""}.`,
    );
  }

  if (scopeHours !== null) {
    parts.push(
      `A scope of ${scopeHours.toLocaleString("en")} contracted hours is available per month.`,
    );
  }

  if (trend.length >= 2) {
    const latest = trend[trend.length - 1];
    const previous = trend[trend.length - 2];
    const delta = latest.marginPercent - previous.marginPercent;

    if (Math.abs(delta) < 0.05) {
      parts.push(
        `The margin held steady at ${formatPercent(latest.marginPercent)} compared with ${previous.label}.`,
      );
    } else if (delta > 0) {
      parts.push(
        `The margin improved from ${formatPercent(previous.marginPercent)} to ${formatPercent(latest.marginPercent)} versus ${previous.label}.`,
      );
    } else {
      parts.push(
        `The margin declined from ${formatPercent(previous.marginPercent)} to ${formatPercent(latest.marginPercent)} versus ${previous.label}.`,
      );
    }
  }

  return parts.join(" ");
}

export async function getClientPdfReportData(
  clientId: string,
  workspaceId: string,
): Promise<PdfReportData | null> {
  const client: ClientRow | null = await prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    select: clientSelect,
  });

  if (!client) return null;

  const retainers = await prisma.retainer.findMany({
    where: { clientId: client.id },
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    select: retainerSelect,
  });

  const retainer = retainers.length > 0 ? toRetainerRow(retainers[0]) : null;

  const details = await getClientMarginDetails(client.id, workspaceId);
  if (details.months.length === 0) return null;

  const period = details.months[0];

  return composePdfReportData({
    client: clientToPdfReportClient(client),
    periodKey: period.key,
    currency: details.currency,
    revenue: period.revenue,
    cost: period.cost,
    profit: period.profit,
    marginPercent: period.marginPercent,
    totalHours: period.hours,
    monthlyBudget: retainer?.monthlyBudget ?? null,
    scopeHours: retainer?.scopeHours ?? null,
    billingCycle: retainer?.billingCycle ?? null,
    retainerPeriod: retainer
      ? retainerPeriodFromDates(retainer.startDate, retainer.endDate)
      : null,
    trend: trendFromMonths(details.months),
    generatedAt: new Date().toISOString(),
  });
}

const reportForPdfSelect = {
  id: true,
  clientId: true,
  reportMonth: true,
  version: true,
  revenue: true,
  cost: true,
  profit: true,
  marginPercent: true,
  currency: true,
  hours: true,
  monthlyBudget: true,
  scopeHours: true,
  billingCycle: true,
  retainerStartDate: true,
  retainerEndDate: true,
  trendJson: true,
  generatedAt: true,
} as const;

export async function getReportPdfData(
  reportId: string,
  workspaceId: string,
): Promise<PdfReportData | null> {
  const report = await prisma.report.findFirst({
    where: { id: reportId, workspaceId },
    select: reportForPdfSelect,
  });

  if (!report) return null;

  const client: ClientRow | null = await prisma.client.findFirst({
    where: { id: report.clientId, workspaceId },
    select: clientSelect,
  });

  if (!client) return null;

  const periodKey = monthKeyOf(report.reportMonth);
  const revenue = report.revenue.toNumber();
  const cost = report.cost.toNumber();
  const profit = report.profit.toNumber();
  const marginPercent = report.marginPercent.toNumber();
  const totalHours = report.hours != null ? report.hours.toNumber() : 0;
  const monthlyBudget =
    report.monthlyBudget != null ? report.monthlyBudget.toNumber() : null;
  const scopeHours = report.scopeHours ?? null;

  const storedTrend = parseReportTrendJson(report.trendJson);
  const trend =
    storedTrend && storedTrend.length > 0
      ? snapshotTrendToPdf(storedTrend)
      : singlePointTrend(
          periodKey,
          revenue,
          cost,
          profit,
          marginPercent,
          totalHours,
        );

  return composePdfReportData({
    client: clientToPdfReportClient(client),
    periodKey,
    currency: report.currency,
    revenue,
    cost,
    profit,
    marginPercent,
    totalHours,
    monthlyBudget,
    scopeHours,
    billingCycle: report.billingCycle,
    retainerPeriod: retainerPeriodFromDates(
      report.retainerStartDate,
      report.retainerEndDate,
    ),
    trend,
    generatedAt: report.generatedAt.toISOString(),
  });
}