import { randomBytes } from "crypto";

/** Query parameter Linkto appends to destination URLs. */
export const CLICK_ID_PARAM = "lt_id";

/**
 * Click IDs starting with this prefix are test clicks: the events API
 * confirms the integration works but stores nothing.
 */
export const TEST_CLICK_ID_PREFIX = "lt_test";

const CLICK_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Unguessable ID for one click (96 random bits, URL-safe). */
export function generateClickId(): string {
  return randomBytes(12).toString("base64url");
}

export function isValidClickId(value: unknown): value is string {
  return typeof value === "string" && CLICK_ID_PATTERN.test(value);
}

export function isTestClickId(value: string): boolean {
  return value.startsWith(TEST_CLICK_ID_PREFIX);
}

/**
 * Adds the click ID to a destination URL. A destination that cannot be
 * parsed is returned unchanged so the redirect still works.
 */
export function appendClickId(destinationUrl: string, clickId: string): string {
  try {
    const url = new URL(destinationUrl);
    url.searchParams.set(CLICK_ID_PARAM, clickId);
    return url.toString();
  } catch {
    return destinationUrl;
  }
}
