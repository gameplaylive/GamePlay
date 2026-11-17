let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getTwitchAppToken(clientId: string, clientSecret: string) {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!res.ok) throw new Error(`Twitch token failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function twitchFetch(
  path: string,
  clientId: string,
  clientSecret: string
) {
  const token = await getTwitchAppToken(clientId, clientSecret);
  const res = await fetch(`https://api.twitch.tv/helix${path}`, {
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch API ${path}: ${res.status} ${text}`);
  }
  return res.json();
}
