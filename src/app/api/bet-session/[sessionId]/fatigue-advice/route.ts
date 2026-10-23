import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { chooseFatigueAdvice, fatigueChoiceInput, getFatigueAdvice } from "@/server/bet-session";

export async function GET(request: Request, ctx: RouteContext<"/api/bet-session/[sessionId]/fatigue-advice">) {
  const { sessionId } = await ctx.params;
  return withUser(request, async (userId) => Response.json(await getFatigueAdvice(db, userId, sessionId)));
}

export async function POST(request: Request, ctx: RouteContext<"/api/bet-session/[sessionId]/fatigue-advice">) {
  const [{ sessionId }, body] = await Promise.all([ctx.params, readJson(request)]);
  return withUser(request, async (userId) =>
    Response.json(await chooseFatigueAdvice(db, userId, sessionId, fatigueChoiceInput.parse(body))),
  );
}
