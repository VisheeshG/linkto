import { beforeAll, describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/lib/project-access";

beforeAll(() => {
  process.env.PROJECT_ACCESS_SECRET = "test-secret";
});

describe("project access tokens", () => {
  it("round-trips a valid token", () => {
    const { token } = signAccessToken("project-1", "password-1");
    expect(verifyAccessToken(token, "project-1")).toBe("password-1");
  });

  it("rejects tokens for another project", () => {
    const { token } = signAccessToken("project-1", "password-1");
    expect(verifyAccessToken(token, "project-2")).toBeNull();
  });

  it("rejects expired tokens", () => {
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000;
    const { token } = signAccessToken("project-1", "password-1", issuedAt);
    expect(verifyAccessToken(token, "project-1")).toBeNull();
  });

  it("rejects tampered or forged tokens", () => {
    const { token } = signAccessToken("project-1", "password-1");
    const [payload, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ p: "project-1", pw: "other", exp: 9999999999 })
    ).toString("base64url");
    expect(verifyAccessToken(`${forgedPayload}.${signature}`, "project-1")).toBeNull();
    expect(verifyAccessToken(`${payload}.x${signature.slice(1)}`, "project-1")).toBeNull();
    // The old format (base64 of "id:timestamp:random") is no longer accepted.
    expect(
      verifyAccessToken(Buffer.from("project-1:1:0.5").toString("base64"), "project-1")
    ).toBeNull();
    expect(verifyAccessToken(null, "project-1")).toBeNull();
  });
});
