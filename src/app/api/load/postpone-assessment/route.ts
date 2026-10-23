import { db } from "@/db/client";
import { withUser } from "@/server/api";
import { postponeAssessment } from "@/server/load";

export async function POST(request: Request) {
  return withUser(request, async (userId) => {
    const postponed = await postponeAssessment(db, userId);
    return Response.json({ postponed }, { status: postponed ? 200 : 409 });
  });
}
