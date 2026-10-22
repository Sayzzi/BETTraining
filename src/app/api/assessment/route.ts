import { db } from "@/db/client";
import { readJson, withUser } from "@/server/api";
import { startAssessment } from "@/server/assessment";
import { deviceInput } from "@/server/training";

/** Shortens every assessment duration for automated tests (ASSESSMENT_TIME_SCALE=0.02); 1 otherwise. */
function timeScale() {
  const value = Number(process.env.ASSESSMENT_TIME_SCALE ?? 1);
  return value > 0 && value <= 1 ? value : 1;
}

export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const input = deviceInput.parse(await readJson(request));
    return Response.json(await startAssessment(db, userId, input, timeScale()), { status: 201 });
  });
}
