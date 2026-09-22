/**
 * The client's IP address. On Vercel, `x-forwarded-for` is set by the platform (client-supplied
 * values are overwritten), and its first entry is the original client.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "local";
}
