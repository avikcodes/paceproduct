import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildClientHealthRow,
  computeBiggestProfitLeak,
  computeBudgetUsage,
  computeFinances,
  computeHealthScore,
  computeNeedsAttention,
  computeScopeUsage,
  computeTeamRows,
  localDateParts,
  marginStatusFor,
  resolvePeriod,
  type ClientHealthRow,
  type RetainerLike,
} from "@/lib/dashboard-metrics";

const NOW = new Date(Date.UTC(2026, 7, 14, 12, 0, 0));
const TZ = "America/New_York";

function retainer(overrides: Partial<RetainerLike> = {}): RetainerLike {
  return {
    clientId: "c1",
    monthlyBudget: 3000,
    currency: "USD",
    billingCycle: "MONTHLY",
    scopeHours: 40,
    startDate: new Date(Date.UTC(2026, 0, 1)),
    endDate: null,
    ...overrides,
  };
}

describe("localDateParts", () => {
  it("returns the wall-clock date in the target timezone", () => {
    const parts = localDateParts(
      new Date(Date.UTC(2026, 7, 14, 4, 0, 0)),
      TZ,
    );
    assert.deepEqual(parts, { year: 2026, month: 8, day: 14 });
  });

  it("handles a positive-offset timezone", () => {
    const parts = localDateParts(
      new Date(Date.UTC(2026, 7, 14, 20, 0, 0)),
      "Asia/Kolkata",
    );
    assert.deepEqual(parts, { year: 2026, month: 8, day: 15 });
  });
});

describe("resolvePeriod", () => {
  it("today spans the user's local day at UTC-midnight anchors", () => {
    const resolved = resolvePeriod("today", NOW, TZ);
    assert.equal(resolved.label, "Today");
    assert.equal(
      resolved.current.start.getTime(),
      Date.UTC(2026, 7, 14),
    );
    assert.equal(resolved.current.end.getTime(), Date.UTC(2026, 7, 15));
    assert.equal(
      resolved.previous.start.getTime(),
      Date.UTC(2026, 7, 13),
    );
    assert.equal(resolved.previous.end.getTime(), Date.UTC(2026, 7, 14));
  });

  it("30d covers exactly 30 calendar days ending today", () => {
    const resolved = resolvePeriod("30d", NOW, TZ);
    const spanDays =
      (resolved.current.end.getTime() - resolved.current.start.getTime()) /
      86_400_000;
    assert.equal(spanDays, 30);
    assert.equal(resolved.current.end.getTime(), Date.UTC(2026, 7, 15));
    assert.equal(resolved.current.start.getTime(), Date.UTC(2026, 6, 16));
  });

  it("quarter uses the current calendar quarter", () => {
    const resolved = resolvePeriod("quarter", NOW, TZ);
    assert.equal(resolved.label, "Q3 2026");
    assert.equal(resolved.previousLabel, "Q2 2026");
    assert.equal(resolved.current.start.getTime(), Date.UTC(2026, 6, 1));
    assert.equal(resolved.current.end.getTime(), Date.UTC(2026, 9, 1));
    assert.equal(resolved.previous.start.getTime(), Date.UTC(2026, 3, 1));
  });

  it("year spans the current calendar year", () => {
    const resolved = resolvePeriod("year", NOW, TZ);
    assert.equal(resolved.label, "2026");
    assert.equal(resolved.previousLabel, "2025");
    assert.equal(resolved.current.start.getTime(), Date.UTC(2026, 0, 1));
    assert.equal(resolved.current.end.getTime(), Date.UTC(2027, 0, 1));
  });

  it("Q1 previous quarter rolls back to Q4 of the prior year", () => {
    const jan = new Date(Date.UTC(2026, 0, 10, 12, 0, 0));
    const resolved = resolvePeriod("quarter", jan, TZ);
    assert.equal(resolved.label, "Q1 2026");
    assert.equal(resolved.previousLabel, "Q4 2025");
    assert.equal(resolved.previous.start.getTime(), Date.UTC(2025, 9, 1));
  });
});

describe("computeFinances", () => {
  it("prorates retainer revenue across the overlapping portion of a month", () => {
    const bounds = { start: new Date(Date.UTC(2026, 7, 10)), end: new Date(Date.UTC(2026, 8, 1)) };
    const finances = computeFinances({
      retainers: [retainer()],
      entries: [],
      bounds,
      timeZone: TZ,
      now: NOW,
    });
    assert.equal(finances.revenue, 2129.03);
  });

  it("counts hours and cost only for entries inside the period", () => {
    const bounds = { start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 8, 1)) };
    const finances = computeFinances({
      retainers: [retainer()],
      entries: [
        { id: "a", clientId: "c1", memberId: "m1", task: "x", hours: 4, workDate: new Date(Date.UTC(2026, 7, 5)), createdAt: new Date(Date.UTC(2026, 7, 5)), costRate: 50 },
        { id: "b", clientId: "c1", memberId: "m1", task: "y", hours: 2, workDate: new Date(Date.UTC(2026, 8, 1)), createdAt: new Date(Date.UTC(2026, 8, 1)), costRate: 50 },
      ],
      bounds,
      timeZone: TZ,
      now: NOW,
    });
    assert.equal(finances.hours, 4);
    assert.equal(finances.cost, 200);
    assert.equal(finances.revenue, 3000);
    assert.equal(finances.profit, 2800);
    assert.equal(finances.marginPercent, 93.3);
  });

  it("reports zero margin and zero revenue when nothing is billable", () => {
    const bounds = { start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 8, 1)) };
    const finances = computeFinances({
      retainers: [],
      entries: [],
      bounds,
      timeZone: TZ,
      now: NOW,
    });
    assert.equal(finances.revenue, 0);
    assert.equal(finances.marginPercent, 0);
  });

  it("does not count revenue for retainers that start after the period", () => {
    const bounds = { start: new Date(Date.UTC(2026, 5, 1)), end: new Date(Date.UTC(2026, 6, 1)) };
    const finances = computeFinances({
      retainers: [retainer({ startDate: new Date(Date.UTC(2026, 7, 1)) })],
      entries: [],
      bounds,
      timeZone: TZ,
      now: NOW,
    });
    assert.equal(finances.revenue, 0);
  });

  it("counts the Aug 1-3 CSV entries as 9.5 hours when the period includes those dates", () => {
    const bounds = { start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 8, 1)) };
    const finances = computeFinances({
      retainers: [retainer()],
      entries: [
        { id: "a", clientId: "c1", memberId: "m1", task: "SEO keyword research", hours: 2.5, workDate: new Date(Date.UTC(2026, 7, 1)), createdAt: new Date(Date.UTC(2026, 7, 1)), costRate: 50 },
        { id: "b", clientId: "c1", memberId: "m1", task: "Landing page copy", hours: 4, workDate: new Date(Date.UTC(2026, 7, 2)), createdAt: new Date(Date.UTC(2026, 7, 2)), costRate: 50 },
        { id: "c", clientId: "c1", memberId: "m1", task: "Backlink audit", hours: 3, workDate: new Date(Date.UTC(2026, 7, 3)), createdAt: new Date(Date.UTC(2026, 7, 3)), costRate: 50 },
      ],
      bounds,
      timeZone: TZ,
      now: NOW,
    });
    assert.equal(finances.hours, 9.5);
  });

  it("flags cost as unknown when any in-period entry has an unset cost rate", () => {
    const bounds = { start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 8, 1)) };
    const finances = computeFinances({
      retainers: [retainer()],
      entries: [
        { id: "a", clientId: "c1", memberId: "m1", task: "x", hours: 4, workDate: new Date(Date.UTC(2026, 7, 5)), createdAt: new Date(Date.UTC(2026, 7, 5)), costRate: 0 },
      ],
      bounds,
      timeZone: TZ,
      now: NOW,
    });
    assert.equal(finances.hasUnknownCost, true);
    assert.equal(marginStatusFor(finances, { healthy: 20, warning: 10, critical: 0 }), null);
  });
});

describe("computeBudgetUsage", () => {
  it("is OVER when spend reaches the limit", () => {
    const usage = computeBudgetUsage({
      limit: 100,
      entries: [
        { id: "a", clientId: "c1", memberId: "m1", task: "x", hours: 5, workDate: new Date(Date.UTC(2026, 7, 2)), createdAt: new Date(Date.UTC(2026, 7, 2)), costRate: 25 },
      ],
      now: NOW,
      timeZone: TZ,
    });
    assert.equal(usage.used, 125);
    assert.equal(usage.status, "OVER");
  });

  it("is ON_TRACK when projection stays within the limit", () => {
    const usage = computeBudgetUsage({
      limit: 1000,
      entries: [],
      now: NOW,
      timeZone: TZ,
    });
    assert.equal(usage.status, "ON_TRACK");
    assert.equal(usage.projectedOverrun, 0);
  });
});

describe("computeScopeUsage", () => {
  it("maps percent to the expected status tiers", () => {
    const make = (hours: number) =>
      computeScopeUsage({
        limit: 100,
        entries: [{ id: "a", clientId: "c1", memberId: "m1", task: "x", hours, workDate: new Date(Date.UTC(2026, 7, 2)), createdAt: new Date(Date.UTC(2026, 7, 2)), costRate: 0 }],
        now: NOW,
        timeZone: TZ,
      }).status;
    assert.equal(make(120), "OVERRUN");
    assert.equal(make(105), "EXCEEDED");
    assert.equal(make(95), "AT_RISK");
    assert.equal(make(85), "NEARING");
    assert.equal(make(50), "ON_TRACK");
  });
});

function clientRow(overrides: Partial<ClientHealthRow> = {}): ClientHealthRow {
  return {
    clientId: "c1",
    name: "Acme",
    status: "ACTIVE",
    healthyThreshold: 20,
    marginStatus: "HEALTHY",
    marginPercent: 30,
    revenue: 3000,
    cost: 2100,
    profit: 900,
    hours: 30,
    hasUnknownCost: false,
    budget: null,
    scope: null,
    health: "HEALTHY",
    ...overrides,
  };
}

describe("buildClientHealthRow", () => {
  it("treats no-revenue clients as having no financial data, not critical", () => {
    const row = buildClientHealthRow({
      clientId: "c2",
      name: "Globex",
      status: "ACTIVE",
      healthyThreshold: 20,
      thresholds: { healthy: 20, warning: 10, critical: 0 },
      finances: { revenue: 0, cost: 0, profit: 0, marginPercent: 0, hours: 0, currency: "USD", hasUnknownCost: false },
      budget: null,
      scope: null,
    });
    assert.equal(row.marginStatus, null);
    assert.equal(row.revenue, 0);
    assert.equal(row.health, "HEALTHY");
  });

  it("flags a client below the healthy threshold as CRITICAL", () => {
    const row = buildClientHealthRow({
      clientId: "c3",
      name: "Boom",
      status: "ACTIVE",
      healthyThreshold: 20,
      thresholds: { healthy: 20, warning: 10, critical: 0 },
      finances: { revenue: 1000, cost: 920, profit: 80, marginPercent: 8, hours: 10, currency: "USD", hasUnknownCost: false },
      budget: null,
      scope: null,
    });
    assert.equal(row.marginStatus, "CRITICAL");
    assert.equal(row.health, "CRITICAL");
  });

  it("marks a client with unset cost rates as cost-unavailable, not financially healthy", () => {
    const row = buildClientHealthRow({
      clientId: "c4",
      name: "GrowthForge",
      status: "ACTIVE",
      healthyThreshold: 20,
      thresholds: { healthy: 20, warning: 10, critical: 0 },
      finances: { revenue: 4112.9, cost: 0, profit: 4112.9, marginPercent: 0, hours: 40, currency: "USD", hasUnknownCost: true },
      budget: null,
      scope: null,
    });
    assert.equal(row.hasUnknownCost, true);
    assert.equal(row.marginStatus, null);
    assert.equal(row.marginPercent, null);
  });
});

describe("computeHealthScore", () => {
  it("reports a perfect score with no risk factors", () => {
    const finances = { revenue: 10000, cost: 6000, profit: 4000, marginPercent: 40, hours: 100, currency: "USD", hasUnknownCost: false };
    const previous = { revenue: 10000, cost: 6000, profit: 4000, marginPercent: 40, hours: 100, currency: "USD", hasUnknownCost: false };
    const score = computeHealthScore({
      finances,
      previousFinances: previous,
      clientRows: [clientRow()],
      previousClientRows: [clientRow()],
      alerts: { unresolved: 0, critical: 0, warning: 0 },
    });
    assert.equal(score.score, 90);
    assert.equal(score.status, "HEALTHY");
  });

  it("penalizes critical alerts, budget overruns, and weak margins", () => {
    const healthy = { revenue: 10000, cost: 6000, profit: 4000, marginPercent: 40, hours: 100, currency: "USD", hasUnknownCost: false };
    const degraded = { revenue: 10000, cost: 9500, profit: 500, marginPercent: 5, hours: 100, currency: "USD", hasUnknownCost: false };
    const atRisk = computeHealthScore({
      finances: degraded,
      previousFinances: healthy,
      clientRows: [
        clientRow({
          marginStatus: "CRITICAL",
          marginPercent: 5,
          revenue: 3000,
          health: "CRITICAL",
          budget: { limit: 1000, used: 1300, remaining: -300, percent: 130, projectedOverrun: 300, status: "OVER" },
        }),
        clientRow({
          clientId: "c2",
          name: "Globex",
          scope: { limit: 40, used: 45, remaining: -5, percent: 112.5, status: "EXCEEDED" },
        }),
        clientRow({
          clientId: "c3",
          name: "Initech",
          budget: { limit: 500, used: 600, remaining: -100, percent: 120, projectedOverrun: 100, status: "OVER" },
        }),
      ],
      previousClientRows: [clientRow()],
      alerts: { unresolved: 6, critical: 4, warning: 2 },
    });
    assert.ok(atRisk.score! < 40);
    assert.equal(atRisk.status, "CRITICAL");
  });

  it("does not award margin or profit points when cost is unknown", () => {
    const unknown = { revenue: 10000, cost: 0, profit: 10000, marginPercent: 0, hours: 100, currency: "USD", hasUnknownCost: true };
    const score = computeHealthScore({
      finances: unknown,
      previousFinances: unknown,
      clientRows: [
        clientRow({
          budget: { limit: 5000, used: 2500, remaining: 2500, percent: 50, projectedOverrun: 0, status: "ON_TRACK" },
        }),
      ],
      previousClientRows: [clientRow()],
      alerts: { unresolved: 0, critical: 0, warning: 0 },
    });
    const margin = score.drivers.find((driver) => driver.label === "Margin");
    assert.ok(!margin);
    assert.equal(score.score, 60);
    assert.equal(score.status, "WATCH");
  });

  it("returns no score when no signal has real data", () => {
    const score = computeHealthScore({
      finances: { revenue: 0, cost: 0, profit: 0, marginPercent: 0, hours: 0, currency: "USD", hasUnknownCost: false },
      previousFinances: { revenue: 0, cost: 0, profit: 0, marginPercent: 0, hours: 0, currency: "USD", hasUnknownCost: false },
      clientRows: [],
      previousClientRows: [],
      alerts: { unresolved: 0, critical: 0, warning: 0 },
    });
    assert.equal(score.score, null);
    assert.equal(score.status, null);
  });

  it("only surfaces signals that have real data", () => {
    const score = computeHealthScore({
      finances: { revenue: 10000, cost: 6000, profit: 4000, marginPercent: 40, hours: 100, currency: "USD", hasUnknownCost: false },
      previousFinances: { revenue: 10000, cost: 6000, profit: 4000, marginPercent: 40, hours: 100, currency: "USD", hasUnknownCost: false },
      clientRows: [],
      previousClientRows: [],
      alerts: { unresolved: 2, critical: 1, warning: 1 },
    });
    const labels = score.drivers.map((driver) => driver.label);
    assert.deepEqual(labels, ["Margin", "Profitability", "Open alerts"]);
    const alerts = score.drivers.find((driver) => driver.label === "Open alerts");
    assert.equal(alerts!.detail, "1 critical, 1 warning unresolved");
    assert.equal(alerts!.impact, -6);
  });
});

describe("computeNeedsAttention", () => {
  it("surfaces budget and margin problems with no financial-data noise", () => {
    const items = computeNeedsAttention({
      clientRows: [
        clientRow({ clientId: "c1", name: "Acme", health: "CRITICAL", marginStatus: "CRITICAL", marginPercent: 5, revenue: 3000 }),
        clientRow({
          clientId: "c2",
          name: "Globex",
          budget: { limit: 1000, used: 1200, remaining: -200, percent: 120, projectedOverrun: 200, status: "OVER" },
        }),
      ],
      currency: "USD",
    });
    const kinds = items.map((item) => item.kind);
    assert.ok(kinds.includes("MARGIN"));
    assert.ok(kinds.includes("BUDGET"));
  });

  it("surfaces unresolved alerts alongside financial risks", () => {
    const items = computeNeedsAttention({
      clientRows: [],
      currency: "USD",
      alerts: [
        { id: "a1", clientId: "c1", severity: "CRITICAL", title: "Margin below healthy", description: "GrowthForge margin is 0%", client: { name: "GrowthForge" } },
        { id: "a2", clientId: "c1", severity: "CRITICAL", title: "Budget exceeded", description: "Spend is over the monthly budget", client: { name: "GrowthForge" } },
        { id: "a3", clientId: "c2", severity: "WARNING", title: "Scope nearing limit", description: null, client: { name: "Acme" } },
      ],
    });
    const critical = items.filter((item) => item.kind === "ALERT" && item.severity === "CRITICAL");
    const warning = items.filter((item) => item.kind === "ALERT" && item.severity === "WARNING");
    assert.equal(critical.length, 2);
    assert.equal(warning.length, 1);
    assert.ok(items[0]!.kind === "ALERT" && items[0]!.severity === "CRITICAL");
  });
});

describe("computeBiggestProfitLeak", () => {
  it("returns null when no client is below the healthy threshold", () => {
    assert.equal(
      computeBiggestProfitLeak([
        clientRow({ clientId: "c1", name: "Acme", marginPercent: 30, healthyThreshold: 20 }),
      ]),
      null,
    );
  });

  it("quantifies the missed profit for an underperforming client", () => {
    const leak = computeBiggestProfitLeak([
      clientRow({ clientId: "c1", name: "Acme", marginPercent: 10, revenue: 2000, healthyThreshold: 20 }),
      clientRow({ clientId: "c2", name: "Globex", marginPercent: 5, revenue: 1000, healthyThreshold: 20 }),
    ]);
    assert.ok(leak);
    assert.equal(leak!.clientId, "c1");
    assert.equal(leak!.impact, 200);
    assert.equal(leak!.cost, 2100);
    assert.match(leak!.reason, /below the 20% healthy target/);
  });

  it("does not invent a leak when cost is unknown for the client", () => {
    const leak = computeBiggestProfitLeak([
      clientRow({
        clientId: "c1",
        name: "GrowthForge",
        revenue: 4112.9,
        cost: 0,
        profit: 4112.9,
        marginStatus: null,
        marginPercent: null,
        hasUnknownCost: true,
        healthyThreshold: 20,
      }),
    ]);
    assert.equal(leak, null);
  });
});

describe("computeTeamRows", () => {
  it("attribures revenue by client and sums hours and cost per member", () => {
    const rows = computeTeamRows({
      members: [
        { memberId: "m1", userId: "u1", name: "Ada" },
        { memberId: "m2", userId: "u2", name: "Lin" },
      ],
      entries: [
        { id: "a", clientId: "c1", memberId: "m1", task: "x", hours: 4, workDate: new Date(Date.UTC(2026, 7, 3)), createdAt: new Date(Date.UTC(2026, 7, 3)), costRate: 50 },
        { id: "b", clientId: "c1", memberId: "m1", task: "y", hours: 6, workDate: new Date(Date.UTC(2026, 7, 4)), createdAt: new Date(Date.UTC(2026, 7, 4)), costRate: 50 },
        { id: "c", clientId: "c1", memberId: "m2", task: "z", hours: 5, workDate: new Date(Date.UTC(2026, 8, 1)), createdAt: new Date(Date.UTC(2026, 8, 1)), costRate: 50 },
      ],
      clientRevenue: new Map([["c1", 3000]]),
      bounds: { start: new Date(Date.UTC(2026, 7, 1)), end: new Date(Date.UTC(2026, 8, 1)) },
    });
    assert.equal(rows[0].name, "Ada");
    assert.equal(rows[0].hours, 10);
    assert.equal(rows[0].cost, 500);
    assert.equal(rows[1].hours, 0);
    assert.equal(rows[1].cost, 0);
  });
});
