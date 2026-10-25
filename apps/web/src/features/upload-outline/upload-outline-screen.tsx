"use client";

import { PageSheet } from "@/components/layout";
import { Link } from "@/components/ui/link";
import { useSetBreadcrumb } from "@/features/frame/breadcrumb";
import { useSession } from "@/features/frame/session-context";
import { can } from "@/lib/roles";
import { UploadForm } from "./upload-form";
import { unitLabel } from "./unit-label";

export function UploadOutlineScreen({ unitKey }: { unitKey: string }) {
  const { role } = useSession();
  useSetBreadcrumb([
    { label: "Units", href: "/units" },
    { label: unitLabel(unitKey), href: `/units/${unitKey}/board` },
    { label: "Upload outline" },
  ]);
  return (
    <PageSheet className="mx-auto w-full max-w-(--layout-dialog-md)">
      <h1 className="text-page text-ink mb-4">Upload outline</h1>
      {can(role, "upload_outline") ? (
        <UploadForm />
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body text-ink">Only authors can upload an outline</p>
          <Link href={`/units/${unitKey}/board`}>Back to the board</Link>
        </div>
      )}
    </PageSheet>
  );
}
