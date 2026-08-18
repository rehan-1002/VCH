import DOMPurify from "isomorphic-dompurify";

export function sanitizeText(input?: string | null): string {
  if (!input) return "";
  return DOMPurify.sanitize(input.trim(), {
    ALLOWED_TAGS: [], // Strip all HTML tags for pure textual safety
    ALLOWED_ATTR: [],
  });
}
