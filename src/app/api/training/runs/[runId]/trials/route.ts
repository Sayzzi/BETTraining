import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { recordTrials } from "@/server/training";

export async function POST(request: Request, ctx: RouteContext<"/api/training/runs/[runId]/trials">) {
  const [{ runId }, body] = await Promise.all([ctx.params, readJson(request)]);
  return withUser(request, async (userId) => {
    await recordTrials(db, userId, runId, body);
    return new Response(null, { status: 204 });
  });
}
