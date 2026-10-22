import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { startAssessment } from "@/server/assessment";
import { testTimeScale } from "@/server/time-scale";
import { deviceInput } from "@/server/training";

export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const input = deviceInput.parse(await readJson(request));
    return Response.json(await startAssessment(db, userId, input, testTimeScale()), { status: 201 });
  });
}
