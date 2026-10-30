import { z } from "zod";

import { ApiError, apiRequest } from "./api";

export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  avatar_url: z.string().nullable(),
  plan: z.string(),
  quota_photos: z.number(),
  created_at: z.string(),
});
export type User = z.infer<typeof userSchema>;

const tokensSchema = z.object({ access: z.string(), refresh: z.string() });
const registerSchema = tokensSchema.extend({ user: userSchema });

export type Credentials = { email: string; password: string; remember: boolean };

const ACCESS_KEY = "pb.access";
const REFRESH_KEY = "pb.refresh";

/**
 * "Se souvenir de moi" keeps the session in localStorage; otherwise it lives in
 * sessionStorage and ends with the tab.
 */
function saveTokens(tokens: z.infer<typeof tokensSchema>, remember: boolean): void {
  clearTokens();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(ACCESS_KEY, tokens.access);
  store.setItem(REFRESH_KEY, tokens.refresh);
}

export function clearTokens(): void {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(ACCESS_KEY);
    store.removeItem(REFRESH_KEY);
  }
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY) ?? localStorage.getItem(ACCESS_KEY);
}

export async function login({ email, password, remember }: Credentials): Promise<void> {
  const tokens = await apiRequest("POST", "auth/login", tokensSchema, {
    body: { email, password },
  });
  saveTokens(tokens, remember);
}

export async function register({ email, password, remember }: Credentials): Promise<User> {
  const result = await apiRequest("POST", "auth/register", registerSchema, {
    body: { email, password },
  });
  saveTokens(result, remember);
  return result.user;
}

export function fetchMe(): Promise<User> {
  return apiRequest("GET", "auth/me", userSchema, { token: getAccessToken() });
}

export function updateMe(changes: Partial<Pick<User, "name" | "email">>): Promise<User> {
  return apiRequest("PATCH", "auth/me", userSchema, { token: getAccessToken(), body: changes });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiRequest("POST", "auth/password", z.null(), {
    token: getAccessToken(),
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const avatarPresignSchema = z.object({
  key: z.string(),
  upload_url: z.string().url(),
  headers: z.record(z.string(), z.string()),
});

/** presign → direct upload to storage → confirm (the server crops it to a square). */
export async function uploadAvatar(file: File): Promise<User> {
  const token = getAccessToken();
  const presigned = await apiRequest("POST", "auth/me/avatar/presign", avatarPresignSchema, {
    token,
    body: { content_type: file.type, size: file.size },
  });
  let upload: Response;
  try {
    upload = await fetch(presigned.upload_url, {
      method: "PUT",
      headers: presigned.headers,
      body: file,
    });
  } catch {
    throw new ApiError(0, "network", "L'envoi de la photo a échoué. Vérifiez votre connexion.");
  }
  if (!upload.ok)
    throw new ApiError(upload.status, "upload_failed", "L'envoi de la photo a échoué.");
  return apiRequest("POST", "auth/me/avatar", userSchema, { token, body: { key: presigned.key } });
}

export function removeAvatar(): Promise<User> {
  return apiRequest("DELETE", "auth/me/avatar", userSchema, { token: getAccessToken() });
}
