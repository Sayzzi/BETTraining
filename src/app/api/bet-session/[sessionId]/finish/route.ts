import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { finishBetSession, finishBetSessionInput } from "@/server/bet-session";

export async function POST(request: Request, ctx: RouteContext<"/api/bet-session/[sessionId]/finish">) {
  const [{ sessionId }, body] = await Promise.all([ctx.params, readJson(request)]);
  return withUser(request, async (userId) => {
    const outcome = await finishBetSession(db, userId, sessionId, finishBetSessionInput.parse(body));
    return Response.json(outcome, { status: outcome.status === "finished" ? 200 : 409 });
  });
}
