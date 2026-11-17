export async function youtubeFetch(path: string, apiKey: string) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://www.googleapis.com/youtube/v3${path}${sep}key=${apiKey}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${path}: ${res.status} ${text}`);
  }
  return res.json();
}
