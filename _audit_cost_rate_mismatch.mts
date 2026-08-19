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
      if (
        msg.includes("ETIMEDOUT") ||
        msg.includes("terminating connection") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("ENETUNREACH")
      ) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("DB unreachable after retries");
}

async function main() {
  const workspaceId = process.argv[2] || "cmsvwwkc30003d4mcocj11gt5";

  const members = await query(
    `select id, "userId", role, "costRate", currency, "createdAt"
       from "WorkspaceMember" where "workspaceId" = $1 order by "createdAt"`,
    [workspaceId],
  );
  console.log(`WorkspaceMember records in workspace ${workspaceId}:`);
  for (const m of members) {
    console.log(
      `  id=${m.id} user=${m.userId} role=${m.role} costRate=${m.costRate} cur=${m.currency} created=${m.createdAt}`,
    );
  }

  const byMember = await query(
    `select "memberId", count(*)::int as entries, sum(hours)::float as hours
       from "TimeEntry" where "workspaceId" = $1
       group by "memberId" order by "memberId"`,
    [workspaceId],
  );
  console.log("\nTimeEntry.memberId -> hours/entries in workspace:");
  for (const row of byMember) {
    console.log(
      `  memberId=${row.memberId} entries=${row.entries} hours=${row.hours}`,
    );
  }

  console.log(
    "\nCost rates on the members who own time entries (what the Dashboard uses):",
  );
  for (const row of byMember) {
    const member = members.find((m) => m.id === row.memberId);
    if (member) {
      console.log(
        `  memberId=${member.id} costRate=${member.costRate} (used for ${row.entries} entries / ${row.hours}h)`,
      );
    } else {
      console.log(`  memberId=${row.memberId} => NO matching WorkspaceMember`);
    }
  }

  const costed = byMember.filter((row) =>
    members.find((m) => m.id === row.memberId && Number(m.costRate) > 0),
  );
  const uncosted = byMember.filter(
    (row) =>
      !members.find(
        (m) => m.id === row.memberId && Number(m.costRate) > 0,
      ),
  );
  console.log(
    "\nMembers whose entries are costed:",
    costed.length
      ? costed.map((r) => `${r.memberId} (${r.hours}h)`).join(", ")
      : "none",
  );
  console.log(
    'Members whose entries have no cost rate ("Cost data unavailable"):',
    uncosted.length
      ? uncosted.map((r) => `${r.memberId} (${r.hours}h)`).join(", ")
      : "none",
  );

  const otherCosted = members.filter(
    (m) => Number(m.costRate) > 0 && !byMember.some((r) => r.memberId === m.id),
  );
  if (otherCosted.length) {
    console.log(
      "\nMembers with a cost rate that own NO time entries (your $40 rate is probably here):",
    );
    for (const m of otherCosted) {
      console.log(`  id=${m.id} costRate=${m.costRate}`);
    }
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
