import { createElement, Fragment, type ReactNode } from "react";
import { Marker } from "@/components/ui/badge";
import type { components } from "@/lib/api-types";

type Doc = components["schemas"]["Section"]["content"];

export interface RenderCtx {
  counters: { slot: number; headingLast: number };
  sectionAddress: string;
}

export const DEFAULT_QUOTE_RIGHTS = "short-quote-commentary";

interface PmMark {
  type: string;
}
interface PmNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: PmMark[];
}

export function newCtx(): RenderCtx {
  return { counters: { slot: 0, headingLast: 2 }, sectionAddress: "" };
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function renderMarks(text: string, marks: PmMark[] | undefined, key: number): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === "strong") out = <strong>{out}</strong>;
    else if (mark.type === "em") out = <em>{out}</em>;
    else if (mark.type === "teacher_talk") out = <span data-role="teacher_talk" className="font-semibold">{out}</span>;
    else if (mark.type === "sample_response") out = <span data-role="sample_response" className="italic">{out}</span>;
  }
  return <Fragment key={key}>{out}</Fragment>;
}

function children(node: PmNode, ctx: RenderCtx): ReactNode[] {
  return (node.content ?? []).map((c, i) => renderNode(c, ctx, i));
}

function heading(node: PmNode, ctx: RenderCtx, key: number, desired: number): ReactNode {
  const rendered = Math.min(desired, ctx.counters.headingLast + 1, 6);
  ctx.counters.headingLast = rendered;
  return createElement(
    "h" + rendered,
    { key, "data-node": node.type, className: "text-ink font-semibold" },
    children(node, ctx),
  );
}

const CALLOUT_LABEL: Record<string, string> = { purpose: "Purpose", say: "Say", watch: "Watch" };

function renderNode(node: PmNode, ctx: RenderCtx, key: number): ReactNode {
  const attrs = node.attrs ?? {};
  switch (node.type) {
    case "text":
      return renderMarks(node.text ?? "", node.marks, key);
    case "hard_break":
      return <br key={key} />;
    case "paragraph":
      return (
        <p key={key} className={attrs.align === "center" ? "text-center" : undefined}>
          {children(node, ctx)}
        </p>
      );
    case "bullet_list":
      return <ul key={key} className="list-disc pl-6">{children(node, ctx)}</ul>;
    case "ordered_list":
      return (
        <ol key={key} className="list-decimal pl-6" start={num(attrs.order)} type={attrs.type === "A" ? "A" : undefined}>
          {children(node, ctx)}
        </ol>
      );
    case "list_item":
      return <li key={key}>{children(node, ctx)}</li>;
    case "table":
      return (
        <table key={key} className="border-hair w-full border-collapse border">
          <tbody>{children(node, ctx)}</tbody>
        </table>
      );
    case "table_row":
      return <tr key={key}>{children(node, ctx)}</tr>;
    case "table_cell":
      return (
        <td key={key} colSpan={num(attrs.colspan)} rowSpan={num(attrs.rowspan)} className="border-hair border p-2 align-top">
          {children(node, ctx)}
        </td>
      );
    case "table_header":
      return (
        <th key={key} scope="col" colSpan={num(attrs.colspan)} rowSpan={num(attrs.rowspan)} className="border-hair bg-well border p-2 text-left">
          {children(node, ctx)}
        </th>
      );
    case "heading":
      return heading(node, ctx, key, (num(attrs.level) ?? 1) + 2);
    case "routine_heading":
      return heading(node, ctx, key, 3);
    case "callout": {
      const variant = str(attrs.variant) || "purpose";
      const label = CALLOUT_LABEL[variant] ?? "Note";
      return (
        <div key={key} role="group" aria-label={label} data-node="callout" data-variant={variant} className="bg-well rounded-lg p-3">
          <span className="text-caps text-ink2 uppercase">{label}</span>
          {children(node, ctx)}
        </div>
      );
    }
    case "collapsible":
      return (
        <details key={key} data-node="collapsible">
          <summary>{str(attrs.label) || "Details"}</summary>
          {children(node, ctx)}
        </details>
      );
    case "teacher_tip":
      return (
        <div key={key} role="group" aria-label="Teacher tip" data-node="teacher_tip" className="bg-selected rounded-lg p-3">
          {children(node, ctx)}
        </div>
      );
    case "quote_placeholder": {
      ctx.counters.slot += 1;
      return (
        <div key={key} data-node="quote_placeholder" data-slot-id={str(attrs.slot_id)} tabIndex={-1} className="border-edge flex items-start gap-2 rounded-lg border border-dashed p-3">
          <Marker n={ctx.counters.slot} />
          <div>
            <p>{str(attrs.reason)}</p>
            <p className="text-small text-ink2">{`Rights: ${DEFAULT_QUOTE_RIGHTS}`}</p>
          </div>
        </div>
      );
    }
    case "excerpt_slot": {
      ctx.counters.slot += 1;
      const source = typeof attrs.source_ref === "string" && attrs.source_ref ? attrs.source_ref : "not chosen yet";
      return (
        <div key={key} data-node="excerpt_slot" data-slot-id={str(attrs.slot_id)} tabIndex={-1} className="border-edge flex items-start gap-2 rounded-lg border border-dashed p-3">
          <Marker n={ctx.counters.slot} />
          <div>
            <p>Excerpt slot</p>
            <p className="text-small text-ink2">{`Rights: ${str(attrs.rights) || "unset"}`}</p>
            <p className="text-small text-ink2">{`Source: ${source}`}</p>
          </div>
        </div>
      );
    }
    case "quote":
      return (
        <blockquote key={key} data-node="quote" data-slot-id={str(attrs.slot_id)} className="border-hair border-l-2 pl-4">
          <p>{children(node, ctx)}</p>
          <footer className="text-small text-ink2">{`Source: ${str(attrs.source_ref) || "not recorded"} · Rights: ${str(attrs.rights) || "unset"}`}</footer>
        </blockquote>
      );
    default:
      return (
        <div key={key} data-node="unsupported" role="note" className="text-small text-ink2">
          {`Unsupported content: ${node.type} is not shown.`}
        </div>
      );
  }
}

export function renderDoc(doc: Doc, ctx: RenderCtx): ReactNode {
  const root = doc as unknown as PmNode;
  return <>{(root.content ?? []).map((c, i) => renderNode(c, ctx, i))}</>;
}
