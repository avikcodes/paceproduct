import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

export type ClerkUserInfo = {
  name: string | null;
  email: string | null;
  imageUrl: string | null;
};

const BATCH_SIZE = 100;

export async function getClerkUserInfos(
  userIds: string[],
): Promise<Map<string, ClerkUserInfo>> {
  const uniqueIds = [...new Set(userIds)];
  const infos = new Map<string, ClerkUserInfo>();

  const client = await clerkClient();
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
    const { data } = await client.users.getUserList({ userId: chunk });
    for (const user of data) {
      infos.set(user.id, {
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
        email: user.primaryEmailAddress?.emailAddress ?? null,
        imageUrl: user.imageUrl,
      });
    }
  }

  return infos;
}
