import { notFound } from "next/navigation";
import { Suspense } from "react";
import { galleryEnabled } from "../../gallery/guard";
import { Harness } from "./harness";

export default function Page() {
  if (!galleryEnabled()) notFound();
  return (
    <Suspense>
      <Harness />
    </Suspense>
  );
}
