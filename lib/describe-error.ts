/** Human-readable message for errors from fetch / Supabase (PostgrestError is not an Error). */
export function describeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "unknown error";
}
