export type ErrorCode =
  "invalid_input" | "rate_limited" | "not_found" | "unauthorized" | "internal";

const STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  unauthorized: 401,
  not_found: 404,
  rate_limited: 429,
  internal: 500,
};

export function errorResponse(code: ErrorCode, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status: STATUS[code], headers });
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

export function withErrorBoundary<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(error);
      return errorResponse("internal", "Something went wrong on our side. Please try again.");
    }
  };
}
