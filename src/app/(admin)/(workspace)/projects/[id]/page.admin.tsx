import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SelectField } from "@/components/crm/Fields";
import Notice from "@/components/crm/Notice";
import { Empty, Panel, linkClass, smallMuted } from "@/components/crm/parts";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { Chip, formatDate, primary } from "@/components/dashboard/ui";
import { teamMembers } from "@/lib/admin/auth/config";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { people } from "@/lib/admin/people";
import { projectGet } from "@/lib/crm/data";
import { PROJECT_STATUSES } from "@/lib/crm/types";
import { projectStatusAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await projectGet(id);
  if (!detail) notFound();
  const { locale, t } = await adminText();
  const p = t.crm.projects;
  const who = people(teamMembers());
  const sp = await searchParams;
  const { project, company, contact, inquiry } = detail;
  const scope = project.scope;
  const sourceRows = Object.entries(project.source);

  return (
    <>
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-soft hover:text-ink">
        <span aria-hidden className="rtl:-scale-x-100">←</span> {p.title}
      </Link>
      <header className="mt-4 mb-6">
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Chip>{t.crm.projectStatuses[project.status]}</Chip>
          <span className="text-[13.5px] text-ink-soft">{who.ofIds(project.owners, t.crm.common.unassigned)}</span>
        </p>
        <h1 className="m-0 mt-2 text-[28px] leading-tight font-bold tracking-[-0.02em] sm:text-[32px] rtl:tracking-normal">
          <bdi>{project.name}</bdi>
        </h1>
        <p className="mt-1.5 mb-0 text-[13.5px] text-ink-soft">
          {p.created(formatDate(project.created_at, false, locale), who.ofEmail(project.created_by))}
          {company && (
            <>
              {" · "}
              <Link href={`/companies/${company.id}`} className={linkClass}>
                <bdi>{company.name}</bdi>
              </Link>
            </>
          )}
          {contact && (
            <>
              {" · "}
              <Link href={`/contacts/${contact.id}`} className={linkClass}>
                <bdi>{contact.name}</bdi>
              </Link>
            </>
          )}
        </p>
      </header>
      <Notice n={sp.n} e={sp.e} t={t.crm} />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Panel title={p.scope} id="scope">
            {scope ? (
              <dl className="m-0 grid grid-cols-1 gap-3 text-[14px]">
                {(
                  [
                    [t.crm.proposals.fields.summary, scope.summary],
                    [t.crm.proposals.fields.recommended_scope, scope.recommended_scope],
                    [t.crm.proposals.fields.deliverables, scope.deliverables],
                    [t.crm.proposals.fields.exclusions, scope.exclusions],
                    [t.crm.proposals.fields.assumptions, scope.assumptions],
                    [t.crm.proposals.fields.timeline, scope.timeline_weeks_min || scope.timeline_weeks_max ? t.crm.proposals.weeks(scope.timeline_weeks_min ?? null, scope.timeline_weeks_max ?? null) : null],
                    [t.crm.proposals.fields.price, scope.price_min || scope.price_max ? `${scope.price_min ?? ""} – ${scope.price_max ?? ""} ${scope.currency ?? ""}` : null],
                  ] as [string, string | null | undefined][]
                )
                  .filter(([, v]) => v)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[12.5px] font-semibold text-ink-soft">{label}</dt>
                      <dd dir="auto" className="m-0 mt-0.5 leading-relaxed whitespace-pre-wrap">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <Empty>{p.noScope}</Empty>
            )}
          </Panel>

          <Panel title={p.decisions} id="decisions">
            {project.decisions.length === 0 ? (
              <Empty>{p.noDecisions}</Empty>
            ) : (
              <ol className="m-0 list-none p-0 text-[13.5px]">
                {project.decisions.map((d, i) => (
                  <li key={`${d.at}-${i}`} className="border-t border-line py-2 first:border-t-0 first:pt-0">
                    <span className="font-semibold">{d.what}</span>
                    <span className={`block ${smallMuted}`}>
                      {who.ofEmail(d.by)} · {formatDate(d.at, true, locale)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          <Panel title={p.status} id="status">
            <form action={projectStatusAction} className="flex flex-col gap-3">
              <input type="hidden" name="projectId" value={project.id} />
              <SelectField id="project-status" name="status" text={p.status} defaultValue={project.status} required options={PROJECT_STATUSES.map((s) => ({ value: s, label: t.crm.projectStatuses[s] }))} />
              <SubmitButton className={`${primary} self-start`}>{p.updateStatus}</SubmitButton>
            </form>
          </Panel>

          <Panel title={p.source} id="source">
            {sourceRows.length === 0 ? (
              <Empty>{t.crm.source.direct}</Empty>
            ) : (
              <dl className="m-0 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1 text-[13.5px]">
                {sourceRows.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink-soft">{k.replaceAll("_", " ")}</dt>
                    <dd className="m-0 break-words" dir="ltr">
                      {k === "lead_origin" ? (t.crm.origins[v as keyof typeof t.crm.origins] ?? v) : v}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Panel>

          <Panel title={p.history} id="history">
            <p className="mt-0 mb-3 text-[13px] text-ink-soft">{p.historyText}</p>
            <ul className="m-0 list-none p-0 text-[13.5px]">
              {project.preparation_version && <li className="py-1">{p.preparationVersion(project.preparation_version)}</li>}
              {project.meeting_start_at && <li className="py-1">{p.meeting(formatDate(project.meeting_start_at, true, locale))}</li>}
            </ul>
            {inquiry && (
              <p className="mt-3 mb-0">
                <Link href={`/leads/${inquiry.id}`} className={linkClass}>
                  {p.openInquiry}: <bdi>{inquiry.client_name}</bdi>
                </Link>
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
