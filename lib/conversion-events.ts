import { isTestClickId, isValidClickId } from "@/lib/click-id";

/** A click earns credit for events that happen within this many days. */
export const ATTRIBUTION_WINDOW_DAYS = 30;

export const STANDARD_EVENT_TYPES = ["visit", "signup", "purchase"] as const;
export type ConversionEventType = (typeof STANDARD_EVENT_TYPES)[number] | "custom";

export type NormalizedEvent = {
  eventType: ConversionEventType;
  /** Set for custom events only. */
  eventName: string | null;
  clickId: string | null;
  userId: string | null;
  amount: number | null;
  currency: string | null;
  orderId: string | null;
  eventId: string | null;
  /** True for test clicks (`lt_id=lt_test…`): acknowledged, never stored. */
  test: boolean;
};

export type ParseResult =
  | { ok: true; event: NormalizedEvent }
  | { ok: false; error: string };

const CUSTOM_EVENT_NAME = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const MAX_AMOUNT = 999_999_999_999.99;

function pick(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** Identifiers may arrive as numbers (order 1042, user 77); store as text. */
function toIdString(value: unknown, field: string): string | null | { error: string } {
  if (value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number") {
    return { error: `${field} must be a string` };
  }
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > 128) return { error: `${field} is too long (max 128 characters)` };
  return text;
}

/**
 * Validates and normalises an event sent by the browser snippet or a server.
 * Both camelCase and snake_case field names are accepted.
 */
export function parseEventPayload(
  raw: unknown,
  options: { defaultCurrency?: string } = {}
): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const body = raw as Record<string, unknown>;

  const rawEvent = pick(body, "event", "type");
  if (typeof rawEvent !== "string" || !rawEvent.trim()) {
    return { ok: false, error: 'event is required ("visit", "signup", "purchase" or a custom name)' };
  }
  const eventKey = rawEvent.trim().toLowerCase();
  const isStandard = (STANDARD_EVENT_TYPES as readonly string[]).includes(eventKey);
  if (!isStandard && !CUSTOM_EVENT_NAME.test(eventKey)) {
    return {
      ok: false,
      error: "Custom event names may use letters, numbers, _ . : - (max 64 characters)",
    };
  }
  const eventType = (isStandard ? eventKey : "custom") as ConversionEventType;

  const rawClickId = pick(body, "click_id", "clickId", "lt_id");
  if (rawClickId !== undefined && !isValidClickId(rawClickId)) {
    return { ok: false, error: "click_id is not a valid Linkto click ID" };
  }
  const clickId = (rawClickId as string | undefined) ?? null;

  const userId = toIdString(pick(body, "user_id", "userId"), "user_id");
  if (userId && typeof userId === "object") return { ok: false, error: userId.error };
  const orderId = toIdString(pick(body, "order_id", "orderId"), "order_id");
  if (orderId && typeof orderId === "object") return { ok: false, error: orderId.error };
  const eventId = toIdString(pick(body, "event_id", "eventId"), "event_id");
  if (eventId && typeof eventId === "object") return { ok: false, error: eventId.error };

  if (!clickId && !userId) {
    return { ok: false, error: "click_id or user_id is required" };
  }

  let amount: number | null = null;
  let currency: string | null = null;
  if (eventType === "purchase") {
    const rawAmount = pick(body, "amount", "value", "revenue");
    if (rawAmount !== undefined) {
      const parsed =
        typeof rawAmount === "number"
          ? rawAmount
          : typeof rawAmount === "string"
            ? Number(rawAmount.replace(/,/g, "").trim())
            : NaN;
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_AMOUNT) {
        return { ok: false, error: "amount must be a number, for example 499 or 499.50" };
      }
      amount = Math.round(parsed * 100) / 100;
    }

    const rawCurrency = pick(body, "currency");
    if (rawCurrency !== undefined) {
      if (typeof rawCurrency !== "string" || !/^[A-Za-z]{3}$/.test(rawCurrency.trim())) {
        return { ok: false, error: 'currency must be a 3-letter code, for example "INR"' };
      }
      currency = rawCurrency.trim().toUpperCase();
    } else if (amount !== null) {
      currency = (options.defaultCurrency || "INR").toUpperCase();
    }
  }

  return {
    ok: true,
    event: {
      eventType,
      eventName: eventType === "custom" ? eventKey : null,
      clickId,
      userId: userId as string | null,
      amount,
      currency,
      orderId: eventType === "purchase" ? (orderId as string | null) : null,
      eventId: eventId as string | null,
      test: clickId ? isTestClickId(clickId) : false,
    },
  };
}

/** Outcome of record_conversion_event() in the database. */
export type RecordStatus = "recorded" | "duplicate" | "unknown_click" | "forbidden" | "expired";

export function describeRecordStatus(status: RecordStatus): { http: number; message: string } {
  switch (status) {
    case "recorded":
      return { http: 200, message: "Event recorded" };
    case "duplicate":
      return { http: 200, message: "Event already recorded" };
    case "unknown_click":
      return {
        http: 404,
        message: "No Linkto click matches this click_id / user_id, so there is nobody to credit",
      };
    case "forbidden":
      return { http: 403, message: "This click belongs to a different Linkto account than the key" };
    case "expired":
      return {
        http: 410,
        message: `The click is older than the ${ATTRIBUTION_WINDOW_DAYS}-day attribution window`,
      };
  }
}
