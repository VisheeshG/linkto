import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
};

export type Brand = {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  brand_id: string | null;
  name: string;
  description: string | null;
  slug: string;
  created_at: string;
  updated_at: string;
};

export type Link = {
  id: string;
  project_id: string;
  destination_url: string;
  short_code: string;
  link_title: string;
  platform: string;
  submission_number: string | null;
  open_app_on_mobile?: boolean;
  include_submission_in_url?: boolean;
  utm_enabled?: boolean;
  expires_at?: string | null;
  /** Missing before the conversion-tracking migration; treated as on. */
  click_id_enabled?: boolean;
  created_at: string;
  updated_at: string;
};

/** A brand website or app that reports conversions (see /dashboard/integration). */
export type TrackingSite = {
  id: string;
  user_id: string;
  name: string;
  domain: string | null;
  default_currency: string;
  public_key: string;
  secret_key_hint: string;
  last_event_at: string | null;
  test_visit_at: string | null;
  test_signup_at: string | null;
  test_purchase_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrafficType = "human" | "bot" | "datacenter" | "suspicious";

/** Columns fetched for analytics (see lib/click-columns.ts). */
export type LinkClick = {
  id: string;
  link_id: string;
  creator_username: string | null;
  submission_number: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  referrer: string | null;
  clicked_at: string;
  /** Missing on rows fetched before the bot-filtering migration ran. */
  traffic_type?: TrafficType | null;
  bot_reason?: string | null;
  visitor_hash?: string | null;
};

export type ProjectPassword = {
  id: string;
  project_id: string;
  password_hash: string;
  description: string | null;
  created_at: string;
  created_by: string | null;
};
