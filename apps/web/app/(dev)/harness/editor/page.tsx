import { notFound } from "next/navigation";
import { galleryEnabled } from "../../gallery/guard";
import { HarnessEditor } from "./harness-editor";

export const metadata = { title: "Editor harness - Lesson Studio" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function Page({ searchParams }: { searchParams: Promise<Params> }) {
  if (!galleryEnabled()) notFound();
  const q = await searchParams;
  return (
    <HarnessEditor
      doc={one(q.doc) ?? "G6.U4.L4"}
      as={one(q.as) ?? "okafor"}
      role={one(q.role) ?? "reviewer"}
      ro={one(q.ro) === "1"}
      seed={one(q.seed) === "1"}
      holdMode={one(q.hold_mode) === "1"}
    />
  );
}
