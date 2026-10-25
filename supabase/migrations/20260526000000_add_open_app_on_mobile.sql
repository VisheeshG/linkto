-- When enabled, mobile visitors get a native-app open attempt (YouTube, Instagram, etc.)

ALTER TABLE links
ADD COLUMN IF NOT EXISTS open_app_on_mobile boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN links.open_app_on_mobile IS 'On mobile, try to open destination in native app (YouTube, Instagram, TikTok, etc.)';
