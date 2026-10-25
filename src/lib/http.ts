import { NextResponse } from "next/server";
import { BadRequest, NotFound, ensureSeeded } from "./services";
import { PlanLimitError } from "./agent/pipeline";

export type Ctx<P extends Record<string, string> = { id: string }> = { params: Promise<P> };

// Wraps a route handler: seeds the demo workspace on first use and maps domain errors to HTTP.
export async function handle(fn: () => Promise<unknown>) {
  try {
    await ensureSeeded();
    const out = await fn();
    return out instanceof Response ? out : NextResponse.json(out);
  } catch (err) {
    const status = err instanceof NotFound ? 404 : err instanceof BadRequest ? 400 : err instanceof PlanLimitError ? 402 : 500;
    if (status === 500) console.error(err);
    return NextResponse.json({ error: (err as Error).message || "Something went wrong" }, { status });
  }
}

export async function body<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new BadRequest("Request body must be JSON");
  }
}
