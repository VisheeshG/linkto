/*
  # Verified purchases

  tracking_sites.server_purchases_only: when on, POST /api/v1/events ignores
  purchase events sent by the browser snippet (public site key) and only
  counts purchases sent by the site's server with its secret key.

  Anything sent from a browser can be forged by the visitor, so a site that
  pays out on purchase numbers turns this on and reports purchases from its
  payment webhook. Visits and signups are unaffected.

  Safe to run more than once.
*/

ALTER TABLE tracking_sites
  ADD COLUMN IF NOT EXISTS server_purchases_only boolean NOT NULL DEFAULT false;

GRANT UPDATE (server_purchases_only) ON tracking_sites TO authenticated;
