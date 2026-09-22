import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/request";
import { describeUserAgent } from "@/lib/ui";
import { accountDeleteSchema, passwordChangeSchema } from "@/lib/validations";

describe("clientIp", () => {
  it("uses the first address in x-forwarded-for (the original client)", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to 'local'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("local");
  });
});

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      "Chrome on Windows",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari on iPhone",
    ],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:130.0) Gecko/20100101 Firefox/130.0", "Firefox on macOS"],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
      "Chrome on Android",
    ],
  ])("%s", (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected);
  });

  it("handles missing or unknown user agents", () => {
    expect(describeUserAgent(null)).toBe("Unknown device");
    expect(describeUserAgent("curl/8.0")).toBe("Unknown browser");
  });
});

describe("passwordChangeSchema", () => {
  it("applies the sign-up password rules to the new password", () => {
    expect(passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "short" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ currentPassword: "x", newPassword: "long-enough" }).success).toBe(true);
  });

  it("rejects reusing the current password", () => {
    const res = passwordChangeSchema.safeParse({ currentPassword: "same-password", newPassword: "same-password" });
    expect(res.success).toBe(false);
  });
});

describe("accountDeleteSchema", () => {
  it("allows an empty body (demo accounts have no known password)", () => {
    expect(accountDeleteSchema.parse({})).toEqual({});
  });
});
