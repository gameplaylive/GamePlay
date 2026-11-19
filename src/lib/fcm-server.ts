/**
 * FCM HTTP v1 sender for Cloudflare Workers / Node (no firebase-admin).
 * Needs FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 */
import { SignJWT, importPKCS8 } from "jose";

type ServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function readServiceAccount(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (!projectId || !clientEmail || !privateKey) return null;
  privateKey = privateKey.replace(/\\n/g, "\n");
  return { projectId, clientEmail, privateKey };
}

let cachedToken: { value: string; exp: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.value;

  const key = await importPKCS8(sa.privateKey, "RS256");
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.clientEmail)
    .setSubject(sa.clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error || `FCM token exchange failed (${res.status})`);
  }
  cachedToken = { value: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

export type FcmPayload = {
  title: string;
  body: string;
  imageUrl?: string | null;
  url?: string;
};

export function fcmConfigured(): boolean {
  return Boolean(readServiceAccount());
}

export async function sendFcmToToken(token: string, payload: FcmPayload): Promise<{ ok: boolean; error?: string }> {
  const sa = readServiceAccount();
  if (!sa) return { ok: false, error: "FCM not configured" };

  try {
    const access = await getAccessToken(sa);
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.projectId}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: {
            title: payload.title,
            body: payload.body,
            ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
          },
          data: {
            title: payload.title,
            body: payload.body,
            url: payload.url || "/",
            ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
          },
          webpush: {
            fcmOptions: { link: payload.url || "/" },
            headers: payload.imageUrl ? { image: payload.imageUrl } : undefined,
          },
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err.slice(0, 400) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export async function sendFcmToMany(
  tokens: string[],
  payload: FcmPayload
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  // Sequential to stay gentle on Workers CPU; batch later if needed
  for (const token of tokens) {
    const r = await sendFcmToToken(token, payload);
    if (r.ok) sent += 1;
    else {
      failed += 1;
      if (r.error && errors.length < 5) errors.push(r.error);
    }
  }
  return { sent, failed, errors };
}
