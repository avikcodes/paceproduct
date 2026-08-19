import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  max: 1,
});

async function query(text: string, params: unknown[] = []) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const res = await pool.query(text, params as never);
      return res.rows;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("ETIMEDOUT") || msg.includes("terminating connection") || msg.includes("ECONNREFUSED") || msg.includes("ENETUNREACH")) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("DB unreachable after retries");
}

async function main() {
  const koreaId = "cmsvwwkc30003d4mcocj11gt5";

  const members = await query(
    `select id, "userId", "billingRate", "costRate", currency from "WorkspaceMember" where "workspaceId" = $1 order by "createdAt"`,
    [koreaId],
  );
  console.log("members:");
  for (const m of members) {
    console.log(`  ${m.id} user=${m.userId} billing=${m.billingRate} cost=${m.costRate} cur=${m.currency}`);
  }

  const clients = await query(
    `select c.id, c.name, c.status from "Client" c where c."workspaceId" = $1 order by c.name`,
    [koreaId],
  );
  console.log("\nclients:");
  for (const c of clients) {
    const rets = await query(
      `select r."monthlyBudget", r.currency, r."billingCycle", r."startDate", r."endDate", r."isActive", r."scopeHours" from "Retainer" r where r."clientId" = $1 order by r."updatedAt" desc`,
      [c.id],
    );
    const entries = await query(
      `select e."memberId", e.hours, e."workDate", e.task from "TimeEntry" e where e."clientId" = $1 order by e."workDate"`,
      [c.id],
    );
    console.log(`  ${c.name} (${c.status})`);
    for (const r of rets) {
      console.log(`    retainer: ${r.monthlyBudget} ${r.currency} ${r.billingCycle} active=${r.isActive} scope=${r.scopeHours} start=${r.startDate} end=${r.endDate}`);
    }
    for (const e of entries) {
      console.log(`    entry: member=${e.memberId} hours=${e.hours} date=${e.workDate} task="${e.task}"`);
    }
  }

  const allEntries = await query(
    `select count(*)::int as n, min("workDate") as min, max("workDate") as max from "TimeEntry" where "workspaceId" = $1`,
    [koreaId],
  );
  console.log("\nall time entries in korea:", allEntries);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
