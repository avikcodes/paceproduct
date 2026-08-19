import "dotenv/config";
import pg from "pg";
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  max: 1,
});
async function query(text: string, params: unknown[] = []) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try { return (await pool.query(text, params as never)).rows; }
    catch (err) {
      const m = String(err);
      if (m.includes("ETIMEDOUT") || m.includes("terminating") || m.includes("ECONNREFUSED") || m.includes("ENETUNREACH")) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue;
      }
      throw err;
    }
  }
  throw new Error("DB unreachable");
}
async function main() {
  const ws = await query(`select id, name, "createdAt" from "Workspace" order by "createdAt"`);
  console.log("workspaces:", JSON.stringify(ws, null, 1));

  for (const w of ws as { id: string; name: string }[]) {
    const rets = await query(`select r."clientId", c.name as client, r."monthlyBudget", r.currency, r."billingCycle", r."isActive", r."startDate", r."endDate" from "Retainer" r join "Client" c on c.id = r."clientId" where c."workspaceId" = $1 order by c.name`, [w.id]);
    const members = await query(`select m.id, m."userId", m."billingRate", m."costRate", m.currency from "WorkspaceMember" m where m."workspaceId" = $1 order by m."createdAt"`, [w.id]);
    const clients = await query(`select count(*)::int as n from "Client" c where c."workspaceId" = $1`, [w.id]);
    console.log(`\n=== workspace ${w.name} (${w.id}) clients=${clients[0].n} members=${members.length} retainers=${rets.length}`);
    for (const m of members) console.log(`  member ${m.id} user=${m.userId} billing=${m.billingRate} cost=${m.costRate} cur=${m.currency}`);
    for (const r of rets) console.log(`  retainer client="${r.client}" budget=${r.monthlyBudget} ${r.currency} ${r.billingCycle} active=${r.isActive} start=${r.startDate} end=${r.endDate}`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
