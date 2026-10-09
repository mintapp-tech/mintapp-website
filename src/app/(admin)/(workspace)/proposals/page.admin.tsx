import type { Metadata } from "next";
import Link from "next/link";
import Notice from "@/components/crm/Notice";
import { Empty, PageHead, linkClass, smallMuted } from "@/components/crm/parts";
import { Chip, button, card, formatDate, type ChipTone } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { proposalList } from "@/lib/crm/data";
import { PROPOSAL_STATUSES } from "@/lib/crm/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Proposals" };

const TONES: Record<string, ChipTone> = { draft: "neutral", internal_review: "info", approved: "ok", sent: "info", accepted: "ok", rejected: "attention", withdrawn: "neutral", superseded: "neutral" };

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { locale, t } = await adminText();
  const p = t.crm.proposals;
  const sp = await searchParams;
  const all = sp.all === "1";
  const rows = await proposalList(all ? PROPOSAL_STATUSES.filter((s) => s !== "superseded") : undefined);
  const who = people(teamMembers());

  return (
    <>
      <PageHead eyebrowText={t.crm.nav.proposals} title={p.listTitle}>
        <Link href={all ? "/proposals" : "/proposals?all=1"} className={button}>
          {all ? t.crm.overview.sections.proposals : p.showAll}
        </Link>
      </PageHead>
      <p className="mt-0 mb-5 max-w-[72ch] text-[13.5px] text-ink-soft">{p.listIntro}</p>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      {rows.length === 0 ? (
        <Empty>{p.listEmpty}</Empty>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0" aria-label={p.listTitle}>
          {rows.map((r) => (
            <li key={r.id} className={`${card} p-4`} data-proposal={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/inquiries/${r.inquiry_id}#proposal`} className={linkClass}>
                    <bdi>{r.client_name}</bdi>
                  </Link>
                  {r.company_name && (
                    <span className="text-ink-soft">
                      {" · "}
                      <bdi>{r.company_name}</bdi>
                    </span>
                  )}
                  {r.summary && (
                    <p dir="auto" className="m-0 mt-1 max-w-[70ch] text-[13.5px] text-ink-soft">
                      {r.summary}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Chip tone={TONES[r.status]}>{t.crm.proposalStatuses[r.status]}</Chip>
                  <span className={smallMuted}>{p.nextStep[r.status] ?? ""}</span>
                </div>
              </div>
              <p className={`m-0 mt-2 ${smallMuted}`}>
                {p.version(r.version)} · {who.ofEmail(r.updated_by)} · {formatDate(r.updated_at, true, locale)}
                {r.owners.length > 0 && ` · ${who.ofIds(r.owners, "")}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
