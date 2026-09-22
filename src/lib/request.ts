/**
 * The client's IP address, used as a rate-limit key.
 *
 * On Vercel, `x-forwarded-for` is set by the platform (client-supplied values are overwritten)
 * and its first entry is the original client. On other hosts, including a plain `next start`,
 * the header can be spoofed, so don't rely on it there.
 *
 * IPv6 addresses are reduced to their /64 prefix: one household or server usually controls a
 * whole /64, so limiting individual addresses would be trivial to dodge.
 */
export function clientIp(headers: Headers): string {
  const ip = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim();
  if (!ip) return "local";
  return ip.includes(":") ? ipv6Prefix64(ip) : ip;
}

function ipv6Prefix64(ip: string): string {
  const [head = "", tail = ""] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = Math.max(0, 8 - left.length - right.length);
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  const prefix = groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, ""));
  return `${prefix.join(":")}::/64`;
}
