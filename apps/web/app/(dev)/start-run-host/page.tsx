import { notFound } from "next/navigation";
import { galleryEnabled } from "../gallery/guard";
import { Host } from "./host";

export default function Page() {
  if (!galleryEnabled()) notFound();
  return <Host />;
}
