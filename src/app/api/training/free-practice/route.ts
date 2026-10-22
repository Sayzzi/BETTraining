import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { startFreePractice, startFreePracticeInput } from "@/server/training";

export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const input = startFreePracticeInput.parse(await readJson(request));
    return Response.json(await startFreePractice(db, userId, input), { status: 201 });
  });
}
