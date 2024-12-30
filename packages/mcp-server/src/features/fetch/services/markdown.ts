import TurndownService from "turndown";

/**
 * Resolves a URL path relative to a base URL.
 *
 * @param base - The base URL to use for resolving relative paths.
 * @param path - The URL path to be resolved.
 * @returns The resolved absolute URL.
 */
function resolveUrl(base: string, path: string): string {
  // Return path if it's already absolute
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Handle absolute paths that start with /
  if (path.startsWith("/")) {
    const baseUrl = new URL(base);
    return `${baseUrl.protocol}//${baseUrl.host}${path}`;
  }

  // Resolve relative paths
  const resolved = new URL(path, base);
  return resolved.toString();
}

/**
 * Converts the given HTML content to Markdown format, resolving any relative URLs
 * using the provided base URL.
 *
 * @param html - The HTML content to be converted to Markdown.
 * @param baseUrl - The base URL to use for resolving relative URLs in the HTML.
 * @returns The Markdown representation of the input HTML.
 *
 * @example
 * ```ts
 * const html = await fetch("https://bcurio.us/resources/hdkb/gates/44");
 * const md = convertHtmlToMarkdown(await html.text(), "https://bcurio.us");
 * await Bun.write("playground/bcurious-gate-44.md", md);
 * ```
 */

export function convertHtmlToMarkdown(html: string, baseUrl?: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  if (baseUrl) {
    // Extend the anchor rule to handle URL resolution
    turndownService
      .addRule("anchor", {
        filter: "a",
        // @ts-expect-error - We know this node is an anchor element
        replacement: function (content, node: HTMLAnchorElement) {
          const href = node.getAttribute("href");
          if (!href) return content;

          const url = resolveUrl(baseUrl, href);
          const title = node.getAttribute("title");
          const titlePart = title ? ` "${title}"` : "";

          return `[${content}](${url}${titlePart})`;
        },
      })
      .addRule("img", {
        filter: "img",
        // @ts-expect-error - We know this node is an image element
        replacement: function (content, node: HTMLImageElement) {
          const alt = node.getAttribute("alt") || "";
          const src = node.getAttribute("src") || "";

          return `![${alt}](${resolveUrl(baseUrl, src)})`;
        },
      });
  }

  return turndownService.turndown(html);
}
