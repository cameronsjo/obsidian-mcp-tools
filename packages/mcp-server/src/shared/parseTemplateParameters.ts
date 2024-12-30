import { parse } from "acorn";
import { simple } from "acorn-walk";
import { type } from "arktype";
import type { PromptParameter } from "shared";

const CallExpressionSchema = type({
  callee: {
    type: "'MemberExpression'",
    object: {
      type: "'MemberExpression'",
      object: { name: "'tp'" },
      property: { name: "'user'" },
    },
    property: { name: "'promptArg'" },
  },
  arguments: type({ type: "'Literal'", value: "string" }).array(),
});

/**
 * Parses template arguments from the given content string.
 *
 * The function looks for template argument tags in the content string, which are
 * in the format `<% tp.user.promptArg("name", "description") %>`, and extracts
 * the name and description of each argument. The extracted arguments are
 * returned as an array of `PromptArgument` objects.
 *
 * @param content - The content string to parse for template arguments.
 * @returns An array of `PromptArgument` objects representing the extracted
 * template arguments.
 */
export function parseTemplateParameters(content: string): PromptParameter[] {
  const parameters: PromptParameter[] = [];
  for (const match of content.matchAll(/<%(.+?)%>/g)) {
    const code = match[1].trim();

    const ast = parse(code, {
      ecmaVersion: "latest",
    });

    simple(ast, {
      CallExpression(node) {
        if (CallExpressionSchema.allows(node)) {
          const argName = node.arguments[0].value;
          const argDescription = node.arguments[1]?.value;
          parameters.push({
            name: argName,
            ...(argDescription ? { description: argDescription } : {}),
          });
        }
      },
    });
  }
  return parameters;
}
