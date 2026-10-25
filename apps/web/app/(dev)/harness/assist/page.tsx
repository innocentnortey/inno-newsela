import { notFound } from "next/navigation";
import { Suspense } from "react";
import { assistEnabled } from "@/features/assist/cut";
import { galleryEnabled } from "../../gallery/guard";
import { Harness } from "./harness";

export default function Page() {
  if (!galleryEnabled() || !assistEnabled()) notFound();
  return (
    <Suspense>
      <Harness />
    </Suspense>
  );
}
