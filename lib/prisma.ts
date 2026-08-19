import dns from "node:dns";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | dns.LookupAddress[],
  family: number,
) => void;

const originalLookup = dns.lookup;
dns.lookup = ((
  hostname: string,
  options?: dns.LookupOptions | number | LookupCallback,
  callback?: LookupCallback,
) => {
  if (typeof options === "function") {
    callback = options;
    options = {};
  } else if (typeof options === "number") {
    options = { family: options };
  }
  return originalLookup(
    hostname,
    { ...(options as dns.LookupOptions), family: 4 },
    callback!,
  );
}) as typeof dns.lookup;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const adapter = new PrismaNeon({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
