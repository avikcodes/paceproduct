import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type HarvestMe = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: { name: string | null } | null;
};

export type HarvestClient = {
  id: number;
  name: string;
};

export type HarvestProject = {
  id: number;
  name: string;
  is_active: boolean;
  client: HarvestClient | null;
};

export type HarvestUser = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active: boolean;
};

export type HarvestTask = {
  id: number;
  name: string;
};

export type HarvestTimeEntry = {
  id: number;
  spent_date: string;
  hours: number;
  notes: string | null;
  is_running: boolean;
  project: (HarvestProject & { client: HarvestClient | null }) | null;
  user: { id: number; name: string; email: string } | null;
  task: HarvestTask | null;
};

export class HarvestApiError extends Error {
  readonly status: number;
  readonly kind: "NETWORK" | "HTTP" | "AUTH";

  constructor(
    message: string,
    status: number,
    kind: "NETWORK" | "HTTP" | "AUTH" = "HTTP",
  ) {
    super(message);
    this.name = "HarvestApiError";
    this.status = status;
    this.kind = kind;
  }
}

export function isHarvestAuthError(error: unknown): boolean {
  return error instanceof HarvestApiError && error.kind === "AUTH";
}

const HARVEST_API = "https://api.harvestapp.com/v2";
const PER_PAGE = 100;

function harvestStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "Harvest rejected the request. Check the date range and try again.";
    case 401:
      return "Your Harvest API token is invalid or has been revoked.";
    case 403:
      return "Harvest denied access. The token or account ID doesn't match.";
    case 404:
      return "The requested Harvest resource was not found.";
    case 429:
      return "Harvest rate limit reached. Wait a minute and try again.";
    default:
      return status >= 500
        ? "Harvest is having trouble right now. Try again shortly."
        : `Harvest returned an unexpected error (status ${status}).`;
  }
}

type HarvestEnvelope = {
  page: number;
  per_page: number;
  total_pages: number;
  total_entries: number;
};

async function harvestFetch(
  token: string,
  accountId: string,
  path: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${HARVEST_API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Harvest-Account-ID": accountId,
        "Content-Type": "application/json",
        "User-Agent": "Pace (time-tracking import)",
      },
      cache: "no-store",
    });
  } catch {
    throw new HarvestApiError(
      "Couldn't reach Harvest. Check your internet connection and try again.",
      0,
      "NETWORK",
    );
  }
  if (!response.ok) {
    const kind = response.status === 401 || response.status === 403 ? "AUTH" : "HTTP";
    throw new HarvestApiError(
      harvestStatusMessage(response.status),
      response.status,
      kind,
    );
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function harvestList<T>(
  token: string,
  accountId: string,
  path: string,
  key: string,
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  for (;;) {
    const separator = path.includes("?") ? "&" : "?";
    const data = (await harvestFetch(
      token,
      accountId,
      `${path}${separator}page=${page}&per_page=${PER_PAGE}`,
    )) as (HarvestEnvelope & Record<string, unknown>) | null;
    if (!data) break;
    const items = data[key];
    if (Array.isArray(items)) {
      results.push(...(items as T[]));
    }
    if (page >= data.total_pages) break;
    page += 1;
  }
  return results;
}

export async function fetchHarvestMe(
  token: string,
  accountId: string,
): Promise<HarvestMe> {
  return (await harvestFetch(token, accountId, "/users/me")) as HarvestMe;
}

export async function fetchHarvestProjects(
  token: string,
  accountId: string,
): Promise<HarvestProject[]> {
  return harvestList<HarvestProject>(token, accountId, "/projects", "projects");
}

export async function fetchHarvestUsers(
  token: string,
  accountId: string,
): Promise<HarvestUser[]> {
  return harvestList<HarvestUser>(token, accountId, "/users", "users");
}

export async function fetchHarvestTimeEntries(
  token: string,
  accountId: string,
  startDate: string,
  endDate: string,
): Promise<HarvestTimeEntry[]> {
  return harvestList<HarvestTimeEntry>(
    token,
    accountId,
    `/time_entries?from=${startDate}&to=${endDate}`,
    "time_entries",
  );
}

function encryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "Missing TOKEN_ENCRYPTION_KEY. Set it to encrypt and decrypt integration tokens.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptHarvestToken(plaintext: string): {
  ciphertext: string;
  iv: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptHarvestToken(ciphertext: string, iv: string): string {
  const payload = Buffer.from(ciphertext, "base64");
  const tag = payload.subarray(payload.length - 16);
  const data = payload.subarray(0, payload.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export type HarvestCredentials = {
  token: string;
  accountId: string;
};

export async function getHarvestCredentials(
  workspaceId: string,
): Promise<HarvestCredentials | null> {
  const connection = await prisma.harvestConnection.findUnique({
    where: { workspaceId },
    select: { tokenEncrypted: true, tokenIv: true, accountId: true },
  });
  if (!connection) return null;
  try {
    return {
      token: decryptHarvestToken(connection.tokenEncrypted, connection.tokenIv),
      accountId: connection.accountId,
    };
  } catch {
    return null;
  }
}
