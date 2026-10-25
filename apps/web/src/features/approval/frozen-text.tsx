import type { ReactNode } from "react";
import type { components } from "@/lib/api-types";
import { COPY } from "./copy";

type Section = components["schemas"]["Section"];
interface Node {
  type?: string;
  text?: string;
  content?: Node[];
  marks?: { type?: string }[];
  attrs?: { level?: number };
}

// NL-62's read-view components replace this renderer when the integration ticket NL-115 joins the screens.
// Elements are built from allow-listed node types; nothing from the content becomes markup, a URL or an attribute (R-58).
function renderChildren(node: Node, key: string): ReactNode[] {
  return (node.content ?? []).map((c, i) => renderNode(c, `${key}.${i}`));
}

function renderText(node: Node): ReactNode {
  let out: ReactNode = node.text ?? "";
  for (const m of node.marks ?? []) {
    if (m.type === "strong") out = <strong>{out}</strong>;
    else if (m.type === "em") out = <em>{out}</em>;
    else if (m.type === "code") out = <code>{out}</code>;
  }
  return out;
}

export function renderNode(node: Node, key: string): ReactNode {
  const kids = renderChildren(node, key);
  switch (node.type) {
    case "text":
      return <span key={key}>{renderText(node)}</span>;
    case "paragraph":
      return <p key={key} className="mb-2">{kids}</p>;
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 1) + 2);
      const H = `h${level}` as "h3" | "h4" | "h5" | "h6";
      return <H key={key} className="text-body mt-3 mb-1 font-semibold">{kids}</H>;
    }
    case "bullet_list":
      return <ul key={key} className="mb-2 list-disc pl-5">{kids}</ul>;
    case "ordered_list":
      return <ol key={key} className="mb-2 list-decimal pl-5">{kids}</ol>;
    case "list_item":
      return <li key={key}>{kids}</li>;
    case "table":
      return <table key={key} className="mb-2 w-full"><tbody>{kids}</tbody></table>;
    case "table_row":
      return <tr key={key}>{kids}</tr>;
    case "table_cell":
      return <td key={key} className="border-hair border p-1">{kids}</td>;
    case "table_header":
      return <th key={key} scope="col" className="border-hair border p-1 text-left">{kids}</th>;
    case "blockquote":
      return <blockquote key={key} className="border-hair border-l-2 pl-3">{kids}</blockquote>;
    case "hard_break":
      return <br key={key} />;
    case "routine_heading":
      return <h4 key={key} className="text-body mt-3 mb-1 font-semibold">{kids}</h4>;
    case "quote_placeholder":
    case "excerpt_slot":
      return <p key={key}>{COPY.frozenExcerptPlaceholder}</p>;
    default:
      return <div key={key}>{kids}</div>;
  }
}

export function FrozenText({ sections }: { sections: Section[] }) {
  return (
    <div className="text-body text-ink">
      {sections.map((s) => (
        <section key={s.address} id={`sec-${s.address}`} tabIndex={-1} aria-labelledby={`h-${s.address}`} className="mb-4 scroll-mt-16">
          <h3 id={`h-${s.address}`} className="text-body text-ink mb-1 font-semibold">
            {s.name} <span className="text-ink2 font-normal">· {s.minutes} min</span>
          </h3>
          {renderChildren(s.content as Node, s.address)}
        </section>
      ))}
    </div>
  );
}
