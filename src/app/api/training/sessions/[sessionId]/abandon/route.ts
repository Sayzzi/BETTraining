import { db } from "@/db/client";
import { withUser } from "@/server/api";
import { abandonSession } from "@/server/training";

// Called with navigator.sendBeacon when the page is closed mid-session.
export async function POST(request: Request, ctx: RouteContext<"/api/training/sessions/[sessionId]/abandon">) {
  const { sessionId } = await ctx.params;
  return withUser(request, async (userId) => {
    await abandonSession(db, userId, sessionId);
    return new Response(null, { status: 204 });
  });
}
