import { describe, expect, test } from "bun:test";
import { convertHtmlToMarkdown } from "./markdown";

describe("convertHtmlToMarkdown", () => {
  const baseUrl = "https://example.com/blog/post";

  test("converts basic HTML to Markdown", () => {
    const html = "<h1>Hello</h1><p>This is a test</p>";
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("# Hello\n\nThis is a test");
  });

  test("resolves relative URLs in links", () => {
    const html = '<a href="/about">About</a>';
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("[About](https://example.com/about)");
  });

  test("resolves relative URLs in images", () => {
    const html = '<img src="/images/test.png" alt="Test">';
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("![Test](https://example.com/images/test.png)");
  });

  test("removes data URL images", () => {
    const html = '<img src="data:image/png;base64,abc123" alt="Test">';
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("");
  });

  test("keeps absolute URLs unchanged", () => {
    const html = '<a href="https://other.com/page">Link</a>';
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("[Link](https://other.com/page)");
  });

  test("extracts article content when present", () => {
    const html = `
      <header>Skip this</header>
      <article>
        <h1>Keep this</h1>
        <p>And this</p>
      </article>
      <footer>Skip this too</footer>
    `;
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("# Keep this\n\nAnd this");
  });

  test("extracts nested article content", () => {
    const html = `
      <div>
        <header>Skip this</header>
        <article>
          <h1>Keep this</h1>
          <p>And this</p>
        </article>
        <footer>Skip this too</footer>
      </div>
    `;
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("# Keep this\n\nAnd this");
  });

  test("removes script and style elements", () => {
    const html = `
      <div>
        <script>alert('test');</script>
        <p>Keep this</p>
        <style>body { color: red; }</style>
      </div>
    `;
    const result = convertHtmlToMarkdown(html, baseUrl);
    expect(result).toBe("Keep this");
  });
});
