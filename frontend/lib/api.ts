import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

/** Every API error has this shape (see backend config/exceptions.py). */
const apiErrorSchema = z.object({
  code: z.string(),
  detail: z.string(),
  fields: z.record(z.string(), z.unknown()).default({}),
});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

const NETWORK_ERROR = "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.";
const UNKNOWN_ERROR = "Une erreur inattendue est survenue. Réessayez dans un instant.";

type RequestOptions = { body?: unknown; token?: string | null };

/** Calls the API and validates the response; rejects instead of guessing. */
export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  schema: z.ZodType<T>,
  { body, token }: RequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", NETWORK_ERROR);
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(data);
    if (!parsed.success) throw new ApiError(response.status, "unknown", UNKNOWN_ERROR);
    throw new ApiError(
      response.status,
      parsed.data.code,
      parsed.data.detail,
      flattenFields(parsed.data.fields),
    );
  }

  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(response.status, "invalid_response", UNKNOWN_ERROR);
  return parsed.data;
}

/** DRF returns lists of messages per field: keep the first one. */
function flattenFields(fields: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, value]) => [
      name,
      Array.isArray(value) ? String(value[0]) : String(value),
    ]),
  );
}
