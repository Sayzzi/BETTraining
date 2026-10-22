import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { savePreferences } from "@/server/preferences";

export async function POST(request: Request) {
  const body = await readJson(request);
  return withUser(request, async (userId) => Response.json(await savePreferences(db, userId, body)));
}
