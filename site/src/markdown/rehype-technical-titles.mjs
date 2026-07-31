import { visit } from "unist-util-visit";

function nodeText(node) {
  if (typeof node.value === "string") {
    return node.value;
  }
  if (!Array.isArray(node.children)) {
    return "";
  }
  return node.children.map(nodeText).join("");
}

/**
 * Preserves the full value of truncated inline technical strings in a title.
 *
 * @returns A Rehype transformer.
 */
export function rehypeTechnicalTitles() {
  return (tree) => {
    visit(tree, "element", (node, _index, parent) => {
      if (node.tagName !== "code" || parent?.tagName === "pre") {
        return;
      }
      node.properties ??= {};
      node.properties.title = nodeText(node);
    });
  };
}
