// NL-100: the unknown-schema view names the version for an unknown version and the node for an unknown node, and always says nothing was dropped.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import { SchemaUnknownView } from "@/features/workspace/error-views";

afterEach(cleanup);

describe("SchemaUnknownView", () => {
  it("blames the version when the version is unknown", () => {
    render(<SchemaUnknownView lessonLabel="Lesson 8" schemaVersion={99} unknownNodes={["doc"]} boardHref="/b" />);
    expect(screen.getByRole("alert").textContent).toContain("Lesson 8 won't open. It uses schema version 99, which this app doesn't know yet. Nothing has been dropped.");
  });
  it("names the node when the version is known", () => {
    render(<SchemaUnknownView lessonLabel="Lesson 9" schemaVersion={SCHEMA_VERSION} unknownNodes={["mystery_block"]} boardHref="/b" />);
    const t = screen.getByRole("alert").textContent;
    expect(t).toContain("content this app doesn't know how to show (mystery_block)");
    expect(t).toContain("Nothing has been dropped.");
    expect(t).not.toContain("schema version");
  });
});
