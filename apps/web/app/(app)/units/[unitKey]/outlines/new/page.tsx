import { UploadOutlineScreen } from "@/features/upload-outline/upload-outline-screen";

export const metadata = { title: "Upload outline · Lesson Studio" };

export default async function Page({ params }: { params: Promise<{ unitKey: string }> }) {
  const { unitKey } = await params;
  return <UploadOutlineScreen unitKey={unitKey} />;
}
