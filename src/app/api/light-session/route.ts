import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { AssessmentRequiredError, startLightSession, startLightSessionInput } from "@/server/bet-session";
import { testTimeScale } from "@/server/time-scale";

export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const input = startLightSessionInput.parse(await readJson(request));
    try {
      return Response.json(await startLightSession(db, userId, input, testTimeScale()), { status: 201 });
    } catch (error) {
      if (error instanceof AssessmentRequiredError) {
        return Response.json({ error: "assessment_required" }, { status: 409 });
      }
      throw error;
    }
  });
}
