import type { Metadata } from "next";
import Link from "next/link";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { button, primary } from "@/components/dashboard/ui";
import Notice from "@/components/crm/Notice";
import { PageHead, Panel, linkClass } from "@/components/crm/parts";
import { SelectField } from "@/components/crm/Fields";
import { requireAdmin } from "@/lib/admin/auth/state";
import { teamMembers } from "@/lib/admin/auth/config";
import { adminText } from "@/lib/admin/locale";
import { automationPaused, settings } from "@/lib/crm/data";
import { errorLabel } from "@/lib/dashboard/status";
import { selectGenerator } from "@/lib/preparation/config";
import { resumeAutomationSettingsAction, saveSettingsAction } from "../leads/actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings" };

// The restrained secondary area: who reviews by default, whether automation is
// on, and the technical status the dashboard deliberately does not show.
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const { locale, t } = await adminText();
  const s = t.lead.settings;
  const members = teamMembers();
  const [current, paused] = await Promise.all([settings(), automationPaused()]);
  const generator = selectGenerator();

  return (
    <>
      <PageHead title={s.title} />
      <p className="mt-[-12px] mb-5 max-w-[70ch] text-[14px] text-ink-soft">{s.intro}</p>
      <Notice n={sp.n} e={sp.e} t={t.crm} />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel title={s.defaultOwner} id="default-owner">
          <form action={saveSettingsAction} className="flex flex-col gap-3">
            <SelectField
              id="default-owner-select"
              name="default_owner"
              text={s.defaultOwner}
              hint={s.defaultOwnerHelp}
              blank={s.nobody}
              defaultValue={current.default_owner?.value ?? ""}
              options={members.map((m) => ({ value: m.id, label: m.name }))}
            />
            <SubmitButton className={`${primary} self-start`}>{s.save}</SubmitButton>
          </form>
        </Panel>

        <Panel title={s.automation} id="automation">
          <p className="m-0 text-[14px]" data-automation={generator.enabled ? generator.generator.id : "off"}>
            {generator.enabled ? s.automationOn(generator.generator.id, generator.generator.model) : s.automationOff}
          </p>
          {paused.length > 0 && (
            <ul className="mt-3 mb-0 flex list-none flex-col gap-2 p-0" data-automation-paused>
              {paused.map((p) => (
                <li key={p.provider} className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13.5px] text-amber-950">
                  <span>{s.pausedSince(p.provider, errorLabel(p.paused_reason, locale))}</span>
                  <form action={resumeAutomationSettingsAction}>
                    <input type="hidden" name="provider" value={p.provider} />
                    <SubmitButton className={button}>{s.resume(p.provider)}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={s.data} id="data">
          <p className="m-0 text-[14px]">
            <Link href="/companies" className={linkClass}>
              {t.lead.nav.companies}
            </Link>
          </p>
          <p className="mt-2 mb-0 text-[13.5px] text-ink-soft">{s.exports}</p>
          <p className="mt-4 mb-0 text-[14px]">
            <Link href="/settings/design-library" className={linkClass}>
              {s.library}
            </Link>
          </p>
          <p className="mt-1 mb-0 text-[13.5px] text-ink-soft">{s.libraryHelp}</p>
        </Panel>
      </div>
    </>
  );
}
