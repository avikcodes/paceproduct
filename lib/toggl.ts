import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export type TogglMe = {
  id: number;
  email: string;
  fullname: string;
  default_workspace_id: number;
  workspaces: { id: number; name: string }[];
};

export type TogglProject = {
  id: number;
  workspace_id: number;
  name: string;
  client_id?: number | null;
  client_name?: string | null;
  active?: boolean;
};

export type TogglTimeEntry = {
  id: string;
  workspace_id: number;
  project_id: number | null;
  description: string | null;
  start: string;
  stop: string | null;
  duration: number;
};

export class TogglApiError extends Error {
  readonly status: number;
  readonly kind: "NETWORK" | "HTTP";

  constructor(
    message: string,
    status: number,
    kind: "NETWORK" | "HTTP" = "HTTP",
  ) {
    super(message);
    this.name = "TogglApiError";
    this.status = status;
    this.kind = kind;
  }
}

const TOGGL_API = "https://api.track.toggl.com/api/v9";

function togglStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "Toggl rejected the request. Check the date range and try again.";
    case 401:
      return "Your Toggl API token is invalid or has been revoked.";
    case 403:
      return "Toggl denied access with this token.";
    case 404:
      return "The requested Toggl resource was not found.";
    case 429:
      return "Toggl rate limit reached. Wait a minute and try again.";
    default:
      return status >= 500
        ? "Toggl is having trouble right now. Try again shortly."
        : `Toggl returned an unexpected error (status ${status}).`;
  }
}

async function togglFetch(token: string, path: string): Promise<unknown> {
  const auth = Buffer.from(`${token}:api_token`, "utf8").toString("base64");
  let response: Response;
  try {
    response = await fetch(`${TOGGL_API}${path}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });
  } catch {
    throw new TogglApiError(
      "Couldn't reach Toggl. Check your internet connection and try again.",
      0,
      "NETWORK",
    );
  }
  if (!response.ok) {
    throw new TogglApiError(togglStatusMessage(response.status), response.status);
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchTogglMe(token: string): Promise<TogglMe> {
  return (await togglFetch(token, "/me")) as TogglMe;
}

export async function fetchTogglProjects(token: string): Promise<TogglProject[]> {
  const data = await togglFetch(token, "/me/projects?include_archived=false");
  return Array.isArray(data) ? (data as TogglProject[]) : [];
}

export async function fetchTogglTimeEntries(
  token: string,
  startDate: string,
  endDate: string,
): Promise<TogglTimeEntry[]> {
  const path = `/me/time_entries?start_date=${startDate}&end_date=${endDate}`;
  const data = await togglFetch(token, path);
  return Array.isArray(data) ? (data as TogglTimeEntry[]) : [];
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

export function encryptTogglToken(plaintext: string): {
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

export function decryptTogglToken(ciphertext: string, iv: string): string {
  const payload = Buffer.from(ciphertext, "base64");
  const tag = payload.subarray(payload.length - 16);
  const data = payload.subarray(0, payload.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export async function getTogglToken(workspaceId: string): Promise<string | null> {
  const connection = await prisma.togglConnection.findUnique({
    where: { workspaceId },
    select: { apiTokenEncrypted: true, apiTokenIv: true },
  });
  if (!connection) return null;
  try {
    return decryptTogglToken(connection.apiTokenEncrypted, connection.apiTokenIv);
  } catch {
    return null;
  }
}
