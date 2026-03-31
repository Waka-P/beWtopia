import { parseHTML } from "linkedom";
import sanitizeHtml from "sanitize-html";

// 表示用に使う
export function normalizeUserInput(str: string): string {
  return str
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069\u200F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

// db保存前に使う(改行を3つ以上にしない)
export function sanitizeAndNormalizeTiptapHtml(html: string): string {
  const sanitized = sanitizeHtml(html, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "a",
      "hr",
      "span",
      "img",
    ],
    allowedAttributes: {
      "*": [
        "href",
        "target",
        "rel",
        "src",
        "alt",
        "class",
        "data-type",
        "data-id",
        "data-label",
        "data-bewts-scout",
        "data-bewts-joinrequest-id",
        "data-bewts-scout-status",
        "data-bewts-scout-updated-at",
      ],
    },
  });

  return normalizeTiptapHtml(sanitized);
}

function normalizeTiptapHtml(html: string) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  const body = document.body;
  if (!body) return "";

  cleanTextNodes(body);

  let emptyCount = 0;

  [...body.querySelectorAll("p")].forEach((p) => {
    if (!p.textContent?.trim()) {
      emptyCount++;
      if (emptyCount > 2) {
        p.remove();
      }
    } else {
      emptyCount = 0;
    }
  });

  return body.innerHTML;
}

function cleanTextNodes(node: Node) {
  if (node.nodeType === 3) {
    node.textContent =
      node.textContent
        ?.normalize("NFC")
        .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
        .replace(/[\u202A-\u202E\u2066-\u2069\u200F]/g, "") || "";
  }

  node.childNodes.forEach(cleanTextNodes);
}

/**
 * white-space: pre-wrap;
 * overflow-wrap: break-word;
 * word-break: normal;
 * line-break: anywhere;
 * ↑も併せてCSSで指定
 */
