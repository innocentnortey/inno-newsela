import { notFound } from "next/navigation";
import { Gallery } from "./gallery";
import { galleryEnabled } from "./guard";

export const metadata = { title: "Gallery - Lesson Studio" };

export default function GalleryPage() {
  if (!galleryEnabled()) notFound();
  return <Gallery />;
}
