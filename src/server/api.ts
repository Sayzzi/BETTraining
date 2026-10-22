import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { NotFoundError } from "./training";

type Handler = (userId: string) => Promise<Response>;

/** Authenticates the request and maps domain errors to HTTP statuses. */
export async function withUser(request: Request, handler: Handler): Promise<Response> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return await handler(session.user.id);
  } catch (error) {
    if (error instanceof NotFoundError) return Response.json({ error: "not_found" }, { status: 404 });
    if (error instanceof ZodError) return Response.json({ error: "invalid_input" }, { status: 400 });
    throw error;
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
