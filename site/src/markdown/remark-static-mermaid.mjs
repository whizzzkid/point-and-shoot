import { renderMermaidSVG } from "beautiful-mermaid";
import { visit } from "unist-util-visit";

const diagramTheme = {
  accent: "var(--accent)",
  bg: "var(--bg-surface)",
  border: "var(--border-default)",
  fg: "var(--text-primary)",
  font: "var(--font-body)",
  line: "var(--text-tertiary)",
  muted: "var(--text-secondary)",
  surface: "var(--bg-elevated)",
  transparent: true,
};

/**
 * Renders Mermaid code blocks to static, token-themed SVG during the build.
 *
 * @returns A Remark transformer.
 */
export function remarkStaticMermaid() {
  return (tree, file) => {
    visit(tree, "code", (node, index, parent) => {
      if (node.lang !== "mermaid" || parent === undefined || index === undefined) {
        return;
      }

      try {
        const svg = renderMermaidSVG(node.value, diagramTheme).replace(
          "<svg ",
          '<svg role="img" aria-label="State diagram" ',
        );
        parent.children[index] = {
          type: "html",
          value: `<figure class="mermaid-diagram">${svg}</figure>`,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Cannot render Mermaid in ${file.path}: ${message}`);
      }
    });
  };
}
