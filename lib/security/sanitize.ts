/**
 * Safe, zero-dependency serverless text sanitization
 */
export function sanitizeText(input?: string | null): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .replace(/[&<>"']/g, (match) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[match] || match;
    });
}
