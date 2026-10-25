/**
 * Utility functions for generating random project slugs and short codes
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { slugifyName } from "@/lib/slug-utils";

/**
 * Generate a random project slug with configurable format
 * @param letterCount - Number of letters (default: 1)
 * @param numberCount - Number of numbers (default: 0)
 * @returns Random string in format: letters + numbers (e.g., "a" or "a12")
 */
export function generateRandomProjectSlug(
  letterCount: number = 1,
  numberCount: number = 0
): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";

  let slug = "";

  // Generate random letters
  for (let i = 0; i < letterCount; i++) {
    slug += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // Generate random numbers
  for (let i = 0; i < numberCount; i++) {
    slug += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return slug;
}

/**
 * Generate a random short code with configurable format
 * @param letterCount - Number of letters (default: 2)
 * @param numberCount - Number of numbers (default: 3)
 * @returns Random string in format: letters + numbers (e.g., "ab123")
 */
export function generateRandomShortCode(
  letterCount: number = 2,
  numberCount: number = 3
): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";

  let result = "";

  // Generate random letters
  for (let i = 0; i < letterCount; i++) {
    result += letters.charAt(Math.floor(Math.random() * letters.length));
  }

  // Generate random numbers
  for (let i = 0; i < numberCount; i++) {
    result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  }

  return result;
}

/**
 * Check if a project slug is unique in the database
 * @param slug - The slug to check
 * @param supabase - Supabase client
 * @returns Promise<boolean> - true if unique, false if exists
 */
export async function isProjectSlugUnique(
  slug: string,
  supabase: SupabaseClient
): Promise<boolean> {
  // Projects are only readable by their owner, so global availability is
  // checked through a SECURITY DEFINER RPC.
  const { data, error } = await supabase.rpc("is_project_slug_available", {
    p_slug: slug,
  });
  if (error) throw error;
  return data === true;
}

/**
 * Check if a short code is unique in the database
 * @param shortCode - The short code to check
 * @param supabase - Supabase client
 * @returns Promise<boolean> - true if unique, false if exists
 */
export async function isShortCodeUnique(
  shortCode: string,
  supabase: SupabaseClient
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("links")
      .select("id")
      .eq("short_code", shortCode)
      .single();

    // If error means no record found, which means it's unique
    return !!error;
  } catch {
    return true; // Assume unique if error occurs
  }
}

/**
 * Generate a unique project slug with progressive format
 * Starts with single letters, then moves to 1 letter + 2 numbers, then 2 letters + 1 number, and so on
 * @param supabase - Supabase client
 * @param maxAttempts - Maximum attempts per format (default: 50)
 * @returns Promise<string> - Unique project slug
 */
export async function generateUniqueProjectSlug(
  supabase: SupabaseClient,
  maxAttempts: number = 50
): Promise<string> {
  // Define format patterns: [letterCount, numberCount]
  const formats: [number, number][] = [
    [1, 0], // a - 26 combinations
    [1, 2], // a12 - 26 * 100 = 2,600 combinations
    [2, 1], // ab1 - 26^2 * 10 = 6,760 combinations
    [1, 3], // a123 - 26 * 1,000 = 26,000 combinations
    [3, 0], // abc - 26^3 = 17,576 combinations
    [2, 2], // ab12 - 26^2 * 100 = 67,600 combinations
    [3, 1], // abc1 - 26^3 * 10 = 175,760 combinations
    [2, 3], // ab123 - 26^2 * 1,000 = 676,000 combinations
    [4, 0], // abcd - 26^4 = 456,976 combinations
    [3, 2], // abc12 - 26^3 * 100 = 1,757,600 combinations
  ];

  // Try each format pattern
  for (const [letterCount, numberCount] of formats) {
    // For single letters, try to find an available one directly
    if (letterCount === 1 && numberCount === 0) {
      const letters = "abcdefghijklmnopqrstuvwxyz"
        .split("")
        .sort(() => Math.random() - 0.5);

      for (const letter of letters) {
        if (await isProjectSlugUnique(letter, supabase)) {
          return letter;
        }
      }
      continue;
    }

    // For other formats, try random generation
    for (let i = 0; i < maxAttempts; i++) {
      const slug = generateRandomProjectSlug(letterCount, numberCount);
      const isUnique = await isProjectSlugUnique(slug, supabase);

      if (isUnique) {
        return slug;
      }
    }
  }

  // Final fallback: use longest format with timestamp
  return generateRandomProjectSlug(3, 2) + Date.now().toString().slice(-2);
}

/**
 * Generate a unique short code with progressive format
 * Starts with 2 letters + 3 numbers, then moves to 3 letters + 2 numbers, and so on
 * @param supabase - Supabase client
 * @param maxAttempts - Maximum attempts per format (default: 50)
 * @returns Promise<string> - Unique short code
 */
export async function generateUniqueShortCode(
  supabase: SupabaseClient,
  maxAttempts: number = 50
): Promise<string> {
  // Define format patterns: [letterCount, numberCount]
  const formats: [number, number][] = [
    [2, 3], // ab123 - 26^2 * 10^3 = 676,000 combinations
    [3, 2], // abc12 - 26^3 * 10^2 = 1,757,600 combinations
    [4, 1], // abcd1 - 26^4 * 10 = 4,569,760 combinations
    [3, 3], // abc123 - 26^3 * 10^3 = 17,576,000 combinations
    [4, 2], // abcd12 - 26^4 * 10^2 = 45,697,600 combinations
  ];

  // Try each format pattern
  for (const [letterCount, numberCount] of formats) {
    for (let i = 0; i < maxAttempts; i++) {
      const shortCode = generateRandomShortCode(letterCount, numberCount);
      const isUnique = await isShortCodeUnique(shortCode, supabase);

      if (isUnique) {
        return shortCode;
      }
    }
  }

  // Final fallback: use longest format with timestamp
  return generateRandomShortCode(4, 2) + Date.now().toString().slice(-2);
}

/**
 * Generate a unique project-level short code that can be shared across all links in a project
 * @param supabase - Supabase client
 * @param projectId - The project ID to generate a short code for
 * @param maxAttempts - Maximum attempts to generate unique short code (default: 10)
 * @returns Promise<string> - Unique project-level short code
 */
export async function generateUniqueProjectShortCode(
  supabase: SupabaseClient,
  projectId: string,
  maxAttempts: number = 10
): Promise<string> {
  // First, check if this project already has a short code
  const { data: existingLinks, error } = await supabase
    .from("links")
    .select("short_code")
    .eq("project_id", projectId)
    .limit(1);

  if (error) {
    console.error("Error checking existing project short code:", error);
  }

  // If project already has links with a short code, return that short code
  if (existingLinks && existingLinks.length > 0) {
    return existingLinks[0].short_code;
  }

  // Generate a new unique short code for this project
  for (let i = 0; i < maxAttempts; i++) {
    const shortCode = generateRandomShortCode();
    const isUnique = await isShortCodeUnique(shortCode, supabase);

    if (isUnique) {
      return shortCode;
    }
  }

  // Fallback: add timestamp to make it unique
  return generateRandomShortCode() + Date.now().toString().slice(-2);
}

export async function isBrandSlugUniqueForUser(
  slug: string,
  userId: string,
  supabase: SupabaseClient,
  excludeBrandId?: string
): Promise<boolean> {
  let query = supabase
    .from("brands")
    .select("id")
    .eq("user_id", userId)
    .ilike("slug", slug);

  if (excludeBrandId) {
    query = query.neq("id", excludeBrandId);
  }

  const { data, error } = await query.maybeSingle();
  if (error && error.code !== "PGRST116") {
    console.error("Brand slug check error:", error);
  }
  return !data;
}

export async function generateUniqueBrandSlug(
  name: string,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const base = slugifyName(name);
  let candidate = base;
  let n = 0;

  while (!(await isBrandSlugUniqueForUser(candidate, userId, supabase))) {
    n += 1;
    candidate = `${base}-${n}`;
  }

  return candidate;
}
