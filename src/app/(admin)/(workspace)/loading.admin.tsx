import { ListSkeleton } from "@/components/dashboard/Skeleton";
import { adminText } from "@/lib/admin/locale";

export default async function Loading() {
  const { t } = await adminText();
  return <ListSkeleton label={t.crm.common.loading} />;
}
