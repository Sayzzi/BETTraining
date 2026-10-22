import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { completeRun, completeRunInput } from "@/server/training";

export async function POST(request: Request, ctx: RouteContext<"/api/training/runs/[runId]/complete">) {
  const [{ runId }, body] = await Promise.all([ctx.params, readJson(request)]);
  return withUser(request, async (userId) => {
    const outcome = await completeRun(db, userId, runId, completeRunInput.parse(body));
    return Response.json(outcome, { status: outcome.status === "completed" ? 200 : 409 });
  });
}
