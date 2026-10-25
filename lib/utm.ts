export type UtmContext = {
  platform: string;
  projectSlug: string;
  creatorUsername: string | null;
  submissionNumber: string | null;
};

/**
 * Appends UTM parameters to a destination URL so the destination's own
 * analytics (GA, Shopify, ...) can attribute the visit. Parameters already
 * present on the destination URL are never overwritten.
 */
export function applyUtmParameters(destinationUrl: string, ctx: UtmContext): string {
  let url: URL;
  try {
    url = new URL(destinationUrl);
  } catch {
    return destinationUrl;
  }

  const params: Record<string, string | null> = {
    utm_source: "linkto",
    utm_medium: ctx.platform ? ctx.platform.toLowerCase() : null,
    utm_campaign: ctx.projectSlug,
    utm_content: ctx.creatorUsername,
    utm_term: ctx.submissionNumber,
  };

  for (const [key, value] of Object.entries(params)) {
    if (value && !url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
