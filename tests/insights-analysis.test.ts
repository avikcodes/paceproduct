import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyInsightsFilter,
  categorizeTask,
  computeAnalysis,
  type InsightDataset,
} from "@/lib/insights-analysis";

const now = new Date(Date.UTC(2026, 5, 15));

function dataset(): InsightDataset {
  return {
    currency: "USD",
    clients: [
      {
        id: "c1",
        name: "Acme",
        status: "ACTIVE",
        healthyThreshold: 20,
        warningThreshold: 10,
        criticalThreshold: 0,
        createdAt: new Date(Date.UTC(2026, 0, 1)),
        retainers: [
          {
            monthlyBudget: 5000,
            currency: "USD",
            billingCycle: "MONTHLY",
            scopeHours: 20,
            startDate: new Date(Date.UTC(2026, 0, 1)),
            endDate: null,
          },
        ],
      },
      {
        id: "c2",
        name: "Globex",
        status: "ACTIVE",
        healthyThreshold: 20,
        warningThreshold: 10,
        criticalThreshold: 0,
        createdAt: new Date(Date.UTC(2026, 0, 1)),
        retainers: [
          {
            monthlyBudget: 10000,
            currency: "USD",
            billingCycle: "MONTHLY",
            scopeHours: 40,
            startDate: new Date(Date.UTC(2026, 0, 1)),
            endDate: null,
          },
        ],
      },
    ],
    members: [
      { id: "m1", name: "Alice", costRate: 40, billingRate: 120, currency: "USD" },
      { id: "m2", name: "Bob", costRate: 60, billingRate: 150, currency: "USD" },
    ],
    entries: [
      {
        id: "e1",
        clientId: "c1",
        memberId: "m1",
        task: "SEO keyword research",
        hours: 10,
        workDate: new Date(Date.UTC(2026, 5, 3)),
        createdAt: new Date(Date.UTC(2026, 5, 3)),
      },
      {
        id: "e2",
        clientId: "c1",
        memberId: "m2",
        task: "Support ticket",
        hours: 10,
        workDate: new Date(Date.UTC(2026, 5, 4)),
        createdAt: new Date(Date.UTC(2026, 5, 4)),
      },
      {
        id: "e3",
        clientId: "c2",
        memberId: "m1",
        task: "Build landing page",
        hours: 20,
        workDate: new Date(Date.UTC(2026, 5, 5)),
        createdAt: new Date(Date.UTC(2026, 5, 5)),
      },
    ],
    reports: [],
  };
}

describe("categorizeTask", () => {
  it("maps tasks to time categories", () => {
    assert.equal(categorizeTask("SEO keyword research"), "SEO");
    assert.equal(categorizeTask("Support ticket"), "Support");
    assert.equal(categorizeTask("Build landing page"), "Design");
    assert.equal(categorizeTask("Update logo"), "Other");
  });
});

describe("computeAnalysis", () => {
  it("computes range totals from retainer revenue and costed hours", () => {
    const analysis = computeAnalysis(dataset(), now, {
      clientId: null,
      memberId: null,
      range: "THIS_MONTH",
    });

    assert.equal(analysis.financial.revenue, 7500);
    assert.equal(analysis.financial.cost, 1800);
    assert.equal(analysis.financial.profit, 5700);
    assert.equal(analysis.efficiency.billableHours, 40);
    assert.equal(analysis.monthCount, 1);
    assert.equal(analysis.timeByCategory.length, 3);
  });

  it("ranks clients into opportunities by margin and median revenue", () => {
    const analysis = computeAnalysis(dataset(), now, {
      clientId: null,
      memberId: null,
      range: "THIS_MONTH",
    });

    const byClient = new Map(
      analysis.opportunities.map((row) => [row.clientId, row.kind]),
    );
    assert.equal(byClient.get("c1"), "upsell");
    assert.equal(byClient.get("c2"), "safeToExpand");
  });

  it("flags low-capacity members as recommendations", () => {
    const analysis = computeAnalysis(dataset(), now, {
      clientId: null,
      memberId: null,
      range: "THIS_MONTH",
    });

    assert.ok(analysis.recommendations.length >= 2);
    assert.ok(
      analysis.recommendations.some((rec) => rec.category === "Capacity"),
    );
  });

  it("projects forward from the current run rate", () => {
    const analysis = computeAnalysis(dataset(), now, {
      clientId: null,
      memberId: null,
      range: "THIS_MONTH",
    });

    assert.equal(analysis.forecast.next30Days.revenue, 15000);
    assert.equal(analysis.forecast.next30Days.cost, 3600);
    assert.equal(analysis.forecast.next30Days.profit, 11400);
  });

  it("merges duplicate member names into a single team row", () => {
    const dup = dataset();
    dup.members = [
      { id: "m1", name: "Alex", costRate: 40, billingRate: 120, currency: "USD" },
      { id: "m2", name: "Alex", costRate: 60, billingRate: 150, currency: "USD" },
    ];
    const analysis = computeAnalysis(dup, now, {
      clientId: null,
      memberId: null,
      range: "THIS_MONTH",
    });

    assert.equal(analysis.team.length, 1);
    assert.equal(analysis.team[0].name, "Alex");
    assert.equal(analysis.team[0].billableHours, 40);
    assert.equal(analysis.team[0].cost, 1800);
    assert.equal(analysis.team[0].hasUnknownCost, false);
  });

  it("flags team cost as unknown when a member has no cost rate", () => {
    const dup = dataset();
    dup.members[0] = { ...dup.members[0], costRate: 0 };
    const analysis = computeAnalysis(dup, now, {
      clientId: null,
      memberId: null,
      range: "THIS_MONTH",
    });

    const alice = analysis.team.find((row) => row.name === "Alice");
    assert.ok(alice);
    assert.equal(alice.hasUnknownCost, true);
  });
});

describe("applyInsightsFilter", () => {
  it("restricts to a single client", () => {
    const filtered = applyInsightsFilter(
      dataset(),
      { clientId: "c1", memberId: null, range: "THIS_MONTH" },
      now,
    );
    const analysis = computeAnalysis(filtered, now, {
      clientId: "c1",
      memberId: null,
      range: "THIS_MONTH",
    });

    assert.equal(analysis.clientProfitability.length, 1);
    assert.equal(analysis.clientProfitability[0].clientId, "c1");
    assert.equal(analysis.financial.revenue, 2500);
    assert.equal(analysis.financial.cost, 1000);
  });

  it("computes member revenue from billable hours times billing rate", () => {
    const filtered = applyInsightsFilter(
      dataset(),
      { clientId: null, memberId: "m1", range: "THIS_MONTH" },
      now,
    );
    const analysis = computeAnalysis(filtered, now, {
      clientId: null,
      memberId: "m1",
      range: "THIS_MONTH",
    });

    assert.equal(analysis.efficiency.billableHours, 30);
    assert.equal(analysis.financial.revenue, 3600);
    assert.equal(analysis.financial.cost, 1200);
    assert.equal(analysis.financial.profit, 2400);
  });

  it("excludes entries outside the range", () => {
    const filtered = applyInsightsFilter(
      dataset(),
      { clientId: null, memberId: null, range: "LAST_QUARTER" },
      now,
    );
    assert.equal(filtered.entries.length, 3);
  });
});
