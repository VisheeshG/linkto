/**
 * Columns the analytics UI needs. Raw IP addresses and user agents are never
 * sent to the browser (they are only used server-side for classification).
 */
export const CLICK_ANALYTICS_COLUMNS =
  "id, link_id, creator_username, submission_number, country, state, city, device_type, browser, os, referrer, clicked_at, traffic_type, bot_reason, visitor_hash";

/** Link columns safe to show on a shared (public) project page. */
export const PUBLIC_LINK_COLUMNS =
  "id, project_id, destination_url, short_code, link_title, platform, submission_number, open_app_on_mobile, include_submission_in_url, utm_enabled, expires_at, created_at, updated_at";
