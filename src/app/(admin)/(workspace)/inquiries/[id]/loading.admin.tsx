import { DetailSkeleton } from "@/components/dashboard/Skeleton";
import { adminText } from "@/lib/admin/locale";

export default async function Loading() {
  const { t } = await adminText();
  return <DetailSkeleton label={t.states.loadingInquiry} />;
}
