import { db } from "@/db/client";
import { withUser } from "@/server/api";
import { completeAssessment } from "@/server/assessment";

export async function POST(request: Request, ctx: RouteContext<"/api/assessment/[assessmentId]/complete">) {
  const { assessmentId } = await ctx.params;
  return withUser(request, async (userId) => {
    const outcome = await completeAssessment(db, userId, assessmentId);
    return Response.json(outcome, { status: outcome.status === "completed" ? 200 : 409 });
  });
}
