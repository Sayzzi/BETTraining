import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { AssessmentRequiredError, startBetSession, startBetSessionInput } from "@/server/bet-session";
import { testTimeScale } from "@/server/time-scale";

export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const input = startBetSessionInput.parse(await readJson(request));
    try {
      return Response.json(await startBetSession(db, userId, input, testTimeScale()), { status: 201 });
    } catch (error) {
      if (error instanceof AssessmentRequiredError) {
        return Response.json({ error: "assessment_required" }, { status: 409 });
      }
      throw error;
    }
  });
}
