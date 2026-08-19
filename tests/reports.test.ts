import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeClientProfitabilityRows } from "@/lib/profitability";
import { computeReportsTeam } from "@/lib/team-performance";
import { computeMarginTrends } from "@/lib/margins";

const now = new Date(Date.UTC(2026, 7, 15));

type ClientFixture = {
  id: string;
  name: string;
  currency: string;
  healthyThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  retainerRevenue: number;
};

const clients5: ClientFixture[] = [
  { id: "c1", name: "GrowthForge", currency: "USD", healthyThreshold: 20, warningThreshold: 10, criticalThreshold: 0, retainerRevenue: 7500 },
  { id: "c2", name: "BluePeak Digital", currency: "USD", healthyThreshold: 20, warningThreshold: 10, criticalThreshold: 0, retainerRevenue: 6000 },
  { id: "c3", name: "Northstar SEO", currency: "USD", healthyThreshold: 20, warningThreshold: 10, criticalThreshold: 0, retainerRevenue: 5000 },
  { id: "c4", name: "LaunchLab PPC", currency: "USD", healthyThreshold: 20, warningThreshold: 10, criticalThreshold: 0, retainerRevenue: 4500 },
  { id: "c5", name: "MarketPilot", currency: "USD", healthyThreshold: 20, warningThreshold: 10, criticalThreshold: 0, retainerRevenue: 3000 },
];

const members2 = [
  { id: "m1", userId: "u1", currency: "USD" },
  { id: "m2", userId: "u2", currency: "USD" },
];

const entries6 = [
  { id: "e1", clientId: "c1", memberId: "m1", task: "SEO keyword research", hours: 10, workDate: new Date(Date.UTC(2026, 6, 10)), createdAt: new Date(Date.UTC(2026, 6, 10)), costRate: 50 },
  { id: "e2", clientId: "c1", memberId: "m2", task: "Backlink audit", hours: 10, workDate: new Date(Date.UTC(2026, 7, 5)), createdAt: new Date(Date.UTC(2026, 7, 5)), costRate: 75 },
  { id: "e3", clientId: "c2", memberId: "m1", task: "Landing page copy", hours: 8, workDate: new Date(Date.UTC(2026, 7, 6)), createdAt: new Date(Date.UTC(2026, 7, 6)), costRate: 50 },
  { id: "e4", clientId: "c3", memberId: "m2", task: "Crawl analysis", hours: 12, workDate: new Date(Date.UTC(2026, 6, 12)), createdAt: new Date(Date.UTC(2026, 6, 12)), costRate: 75 },
  { id: "e5", clientId: "c4", memberId: "m1", task: "PPC campaign setup", hours: 5, workDate: new Date(Date.UTC(2026, 6, 15)), createdAt: new Date(Date.UTC(2026, 6, 15)), costRate: 50 },
  { id: "e6", clientId: "c5", memberId: "m2", task: "Support ticket", hours: 10, workDate: new Date(Date.UTC(2026, 5, 10)), createdAt: new Date(Date.UTC(2026, 5, 10)), costRate: 75 },
];

describe("computeClientProfitabilityRows", () => {
  it("reports the real retainer revenue and costed hours for every client", () => {
    const rows = computeClientProfitabilityRows(
      clients5.map((client) => ({
        id: client.id,
        name: client.name,
        currency: client.currency,
        healthyThreshold: client.healthyThreshold,
        warningThreshold: client.warningThreshold,
        criticalThreshold: client.criticalThreshold,
        retainerRevenue: client.retainerRevenue,
        entries: entries6
          .filter((entry) => entry.clientId === client.id)
          .map((entry) => ({ hours: entry.hours, costRate: entry.costRate })),
      })),
    );

    const byClient = new Map(rows.map((row) => [row.clientId, row]));
    assert.equal(byClient.get("c1")!.revenue, 7500);
    assert.equal(byClient.get("c2")!.revenue, 6000);
    assert.equal(byClient.get("c3")!.revenue, 5000);
    assert.equal(byClient.get("c4")!.revenue, 4500);
    assert.equal(byClient.get("c5")!.revenue, 3000);

    const gf = byClient.get("c1")!;
    assert.equal(gf.totalHours, 20);
    assert.equal(gf.cost, 1250);
    assert.equal(gf.profit, 6250);
    assert.equal(gf.marginPercent, 83.3);
    assert.equal(gf.hasUnknownCost, false);
  });

  it("flags missing cost rates instead of reporting a false 100% margin", () => {
    const rows = computeClientProfitabilityRows([
      {
        id: "c6",
        name: "NoRate",
        currency: "USD",
        healthyThreshold: 20,
        warningThreshold: 10,
        criticalThreshold: 0,
        retainerRevenue: 5000,
        entries: [{ hours: 10, costRate: 0 }],
      },
    ]);
    assert.equal(rows[0].cost, 0);
    assert.equal(rows[0].hasUnknownCost, true);
    assert.equal(rows[0].marginPercent, 0);
    assert.equal(rows[0].badge, "CRITICAL");
  });
});

describe("computeReportsTeam", () => {
  it("allocates the same client revenue to members by hours and costs at member rate", () => {
    const { rows, summary } = computeReportsTeam({
      members: members2,
      clients: clients5.map((client) => ({
        id: client.id,
        retainerRevenue: client.retainerRevenue,
      })),
      entries: entries6,
    });

    const m1 = rows.find((row) => row.memberId === "m1")!;
    const m2 = rows.find((row) => row.memberId === "m2")!;

    assert.equal(m1.revenue, 14250);
    assert.equal(m2.revenue, 11750);
    assert.equal(m1.billableHours, 23);
    assert.equal(m2.billableHours, 32);
    assert.equal(m1.cost, 1150);
    assert.equal(m2.cost, 2400);
    assert.equal(m1.profit, 13100);
    assert.equal(m2.profit, 9350);
    assert.equal(m1.hasUnknownCost, false);

    assert.equal(m1.revenue + m2.revenue, 26000);

    assert.equal(summary.highestRevenue!.memberId, "m1");
    assert.equal(summary.highestProfit!.memberId, "m1");
    assert.equal(summary.highestProfitCostUnknown, false);
    assert.equal(summary.mostBillableHours!.memberId, "m2");
    assert.equal(summary.leastUtilized!.memberId, "m1");
  });

  it("excludes members with missing cost rates from highest profit", () => {
    const { rows, summary } = computeReportsTeam({
      members: members2,
      clients: [{ id: "c1", retainerRevenue: 7500 }],
      entries: [
        {
          id: "a",
          clientId: "c1",
          memberId: "m1",
          task: "x",
          hours: 4,
          workDate: new Date(Date.UTC(2026, 7, 1)),
          createdAt: new Date(Date.UTC(2026, 7, 1)),
          costRate: 0,
        },
      ],
    });

    const m1 = rows.find((row) => row.memberId === "m1")!;
    assert.equal(m1.hasUnknownCost, true);
    assert.equal(m1.cost, 0);
    assert.equal(summary.highestRevenue!.memberId, "m1");
    assert.equal(summary.highestProfit, null);
    assert.equal(summary.highestProfitCostUnknown, true);
  });
});

describe("computeMarginTrends", () => {
  const trendClients = clients5.map((client) => ({
    id: client.id,
    name: client.name,
    currency: client.currency,
    retainer: {
      monthlyBudget: client.retainerRevenue,
      billingCycle: "MONTHLY" as const,
      startDate: new Date(Date.UTC(2026, 0, 1)),
      endDate: null as Date | null,
    },
    entries: entries6
      .filter((entry) => entry.clientId === client.id)
      .map((entry) => ({
        hours: entry.hours,
        workDate: entry.workDate,
        costRate: entry.costRate,
      })),
  }));

  it("returns exactly the latest N calendar months, preserving zero months", () => {
    const trends = computeMarginTrends(trendClients, now, 12);
    const gf = trends.clients.find((client) => client.id === "c1")!;

    assert.equal(gf.months.length, 12);
    assert.equal(gf.months[0].key, "2025-09");
    assert.equal(gf.months[gf.months.length - 1].key, "2026-08");

    const beforeRetainer = gf.months.find((month) => month.key === "2025-10")!;
    assert.equal(beforeRetainer.revenue, 0);
    assert.equal(beforeRetainer.cost, 0);
    assert.equal(beforeRetainer.hours, 0);
    assert.equal(beforeRetainer.marginPercent, 0);

    const jan = gf.months.find((month) => month.key === "2026-01")!;
    assert.equal(jan.revenue, 7500);
    const jul = gf.months.find((month) => month.key === "2026-07")!;
    const aug = gf.months.find((month) => month.key === "2026-08")!;
    assert.equal(jul.cost, 500);
    assert.equal(aug.cost, 750);
    assert.equal(jul.profit, 7000);
    assert.equal(aug.profit, 6750);
  });

  it("handles the current partial month as the newest point with full revenue", () => {
    const trends = computeMarginTrends(trendClients, now, 6);
    const gf = trends.clients.find((client) => client.id === "c1")!;
    assert.equal(gf.months.length, 6);
    const newest = gf.months[gf.months.length - 1];
    assert.equal(newest.key, "2026-08");
    assert.equal(newest.revenue, 7500);
    assert.equal(newest.cost, 750);
    assert.equal(newest.profit, 6750);
  });

  it("changes the number of data points with the selected range", () => {
    const three = computeMarginTrends(trendClients, now, 3);
    const six = computeMarginTrends(trendClients, now, 6);
    const twelve = computeMarginTrends(trendClients, now, 12);

    assert.deepEqual(
      three.allMonths.map((month) => month.key),
      ["2026-06", "2026-07", "2026-08"],
    );
    assert.equal(three.allMonths.length, 3);
    assert.equal(six.allMonths.length, 6);
    assert.equal(six.allMonths[0].key, "2026-03");
    assert.equal(twelve.allMonths.length, 12);
    assert.equal(twelve.allMonths[0].key, "2025-09");
    assert.equal(twelve.allMonths[11].key, "2026-08");
  });

  it("aggregates the same monthly revenue across clients", () => {
    const trends = computeMarginTrends(trendClients, now, 12);
    assert.equal(trends.allMonths.length, 12);
    const aug = trends.allMonths.find((month) => month.key === "2026-08")!;
    assert.equal(aug.revenue, 26000);
    assert.equal(aug.cost, 1150);
  });
});