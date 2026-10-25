import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropZone } from "@/features/upload-outline/drop-zone";

afterEach(cleanup);
const csv = (n = "a.csv") => new File(["x"], n, { type: "text/csv" });
const setup = (over: Partial<Parameters<typeof DropZone>[0]> = {}) => {
  const onFile = vi.fn();
  const onReject = vi.fn();
  const r = render(<DropZone file={null} onFile={onFile} onReject={onReject} {...over} />);
  return { onFile, onReject, ...r };
};

describe("DropZone", () => {
  it("labelled_button", () => {
    setup();
    const b = screen.getByRole("button", { name: "Choose file" });
    expect(b.tagName).toBe("BUTTON");
  });
  it("input_accepts_csv_xlsx", () => {
    const { container } = setup();
    expect(container.querySelector("input[type=file]")).toHaveAttribute("accept", ".csv,.xlsx");
  });
  it("keyboard_opens_picker", async () => {
    const { container } = setup();
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    const spy = vi.spyOn(input, "click");
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Choose file" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(spy).toHaveBeenCalledTimes(2);
  });
  it("hint_text", () => {
    setup();
    const b = screen.getByRole("button", { name: "Choose file" });
    expect(b).toHaveAccessibleDescription("CSV or XLSX, up to 200 rows");
  });
  it("extension_check_only", async () => {
    const { container, onFile, onReject } = setup();
    const input = container.querySelector("input[type=file]") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [csv("a.pdf")] } });
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onFile).not.toHaveBeenCalled();
  });
  it("drop_event", () => {
    const { onFile } = setup();
    const f = csv("B.CSV");
    fireEvent.drop(screen.getByRole("button", { name: "Choose file" }), { dataTransfer: { files: [f] } });
    expect(onFile).toHaveBeenCalledWith(f);
  });
});
