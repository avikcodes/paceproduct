// Run: NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-scope-alerts.ts
import "dotenv/config";
import dns from "node:dns";
import pg from "pg";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { evaluateAllScopeAlerts } from "@/lib/scope-alerts";

async function createDb(): Promise<PrismaClient> {
  const url = new URL(process.env.DATABASE_URL!);
  const port = Number(url.port || 5432);
  const addresses = await dns.promises.resolve4(url.hostname);

  for (const address of addresses) {
    const pool = new pg.Pool({
      host: address,
      port,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.slice(1),
      ssl: {
        servername: url.hostname,
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 10_000,
    });

    try {
      await pool.query("SELECT 1");
      return new PrismaClient({ adapter: new PrismaPg(pool) });
    } catch {
      await pool.end().catch(() => undefined);
    }
  }

  throw new Error("Could not connect to the database.");
}

async function main() {
  const db = await createDb();

  try {
    const workspaces = await db.workspace.findMany({
      select: { id: true },
    });

    let evaluated = 0;
    for (const workspace of workspaces) {
      await evaluateAllScopeAlerts(workspace.id, db);
      evaluated += 1;
      console.log(`Evaluated scope alerts for workspace ${workspace.id}`);
    }

    console.log(`Done. Evaluated ${evaluated} workspace(s).`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
