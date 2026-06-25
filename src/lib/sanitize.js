import sanitizeHtml from "sanitize-html";

/**
 * Sanitize rich-text HTML coming from the editor before storing it.
 * Allows a small, safe subset of formatting tags. Returns "" when the content
 * has no actual text (e.g. an empty "<p></p>").
 */
export function cleanHtml(input) {
  if (!input) return "";

  const clean = sanitizeHtml(input, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "s",
      "u",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "blockquote",
      "code",
      "pre",
      "a",
    ],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });

  // Treat formatting-only / empty content as empty.
  const text = clean.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  return text ? clean : "";
}
