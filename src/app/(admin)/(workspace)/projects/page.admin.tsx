import type { Metadata } from "next";
import Link from "next/link";
import Notice from "@/components/crm/Notice";
import { Empty, PageHead, linkClass } from "@/components/crm/parts";
import { Chip, card, formatDate } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { projectList } from "@/lib/crm/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const p = t.crm.projects;
  const rows = await projectList();
  const who = people(teamMembers());
  const sp = await searchParams;

  return (
    <>
      <PageHead eyebrowText={t.crm.nav.projects} title={p.title} />
      <p className="mt-0 mb-5 max-w-[72ch] text-[13.5px] text-ink-soft">{p.intro}</p>
      <Notice n={sp.n} e={sp.e} t={t.crm} />
      {rows.length === 0 ? (
        <Empty>{p.empty}</Empty>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full border-collapse text-start text-[14px]">
            <caption className="sr-only">{p.title}</caption>
            <thead className="border-b border-line bg-surface-2/60">
              <tr className="text-start text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[12.5px] rtl:tracking-normal">
                {(["name", "company", "status", "owners", "created"] as const).map((k) => (
                  <th key={k} scope="col" className="px-5 py-3 text-start">
                    {p.columns[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line first:border-t-0 hover:bg-canvas/70" data-project={r.id}>
                  <td className="px-5 py-3.5">
                    <Link href={`/projects/${r.id}`} className={linkClass}>
                      <bdi>{r.name}</bdi>
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">{r.company ? <bdi>{r.company}</bdi> : <span className="text-ink-faint">–</span>}</td>
                  <td className="px-5 py-3.5">
                    <Chip>{t.crm.projectStatuses[r.status]}</Chip>
                  </td>
                  <td className="px-5 py-3.5">{who.ofIds(r.owners, t.crm.common.unassigned)}</td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-ink-soft">{formatDate(r.created_at, false, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
