import type { Metadata } from "next";
import { Empty, PageHead, Panel, Stat, smallMuted } from "@/components/crm/parts";
import { TextField } from "@/components/crm/Fields";
import SubmitButton from "@/components/dashboard/SubmitButton";
import { button, card, primary, todayInCairo } from "@/components/dashboard/ui";
import { requireAdmin } from "@/lib/admin/auth/state";
import { adminText } from "@/lib/admin/locale";
import { metrics } from "@/lib/crm/data";
import { defaultRange, funnelRates, rate, type Rate } from "@/lib/crm/rates";
import { dateRange } from "@/lib/crm/schemas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Metrics" };

// Operating numbers for a period: the funnel for inquiries received in it,
// events that happened in it, where leads came from, why deals were lost, and
// outreach activity. Likes and impressions are diagnostic and not tracked here.
export default async function MetricsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { t } = await adminText();
  const m = t.crm.metrics;
  const today = todayInCairo();
  const sp = await searchParams;
  const asked = dateRange.safeParse({ from: typeof sp.from === "string" ? sp.from : "", to: typeof sp.to === "string" ? sp.to : "" });
  const range = asked.success ? asked.data : defaultRange(today);
  const bad = Boolean(sp.from || sp.to) && !asked.success;
  const data = await metrics(range.from, range.to, today);
  const rates = funnelRates(data.cohort);
  const fmt = (r: Rate) => (r.percent === null ? m.rates.none : `${r.percent}% · ${m.rates.of(r.numerator, r.denominator)}`);
  const outreach = data.outreach;
  const qualifiedReply = rate(outreach.qualified, outreach.replied);

  return (
    <>
      <PageHead eyebrowText={t.crm.nav.metrics} title={m.title} />
      <p className="mt-0 mb-5 max-w-[72ch] text-[13.5px] text-ink-soft">{m.intro}</p>

      <form method="get" action="/metrics" className={`${card} mb-6 flex flex-wrap items-end gap-3 p-4`}>
        <TextField id="m-from" name="from" type="date" text={m.from} defaultValue={range.from} required />
        <TextField id="m-to" name="to" type="date" text={m.to} defaultValue={range.to} required />
        <SubmitButton className={primary}>{m.show}</SubmitButton>
        {bad && (
          <p role="alert" className="m-0 text-[13px] font-medium text-red-700">
            {m.exportBad}
          </p>
        )}
      </form>

      <section aria-labelledby="cohort" className="mb-8">
        <h2 id="cohort" className="mb-3 text-[17px] font-bold">
          {m.cohort}
        </h2>
        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4" data-cohort>
          {(["inquiries", "booked", "meeting_ready", "discovery_complete", "qualified", "proposal_sent", "won", "lost"] as const).map((k) => (
            <Stat key={k} value={data.cohort[k]} title={m.cards[k]} />
          ))}
        </dl>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel title={m.rates.title} id="rates">
          <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2.5 text-[14px]" data-rates>
            {(
              [
                [m.rates.readyRate, rates.ready],
                [m.rates.bookingRate, rates.booking],
                [m.rates.discoveryRate, rates.discovery],
                [m.rates.proposalRate, rates.proposal],
                [m.rates.winRate, rates.win],
              ] as [string, Rate][]
            ).map(([label, r]) => (
              <div key={label} className="contents">
                <dt className="text-ink-soft">{label}</dt>
                <dd className="m-0 font-semibold whitespace-nowrap">{fmt(r)}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title={m.events} id="events">
          <dl className="m-0 grid grid-cols-2 gap-3" data-events>
            {(["proposals_sent", "wins", "losses", "meetings_booked", "overdue_follow_ups_now"] as const).map((k) => (
              <Stat key={k} value={data.events[k]} title={m.eventCards[k]} tone={k === "overdue_follow_ups_now" || k === "losses" ? "attention" : undefined} />
            ))}
          </dl>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title={m.sources} id="sources">
          {data.sources.length === 0 ? (
            <Empty>{m.noSources}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start text-[13.5px]" data-sources>
                <caption className="sr-only">{m.sources}</caption>
                <thead>
                  <tr className="text-start text-[11.5px] font-bold tracking-[0.08em] text-ink-faint uppercase rtl:text-[12.5px] rtl:tracking-normal">
                    {(["source", "campaign", "content", "origin", "inquiries", "booked", "qualified", "won", "lost"] as const).map((k) => (
                      <th key={k} scope="col" className="pe-4 pb-2 text-start">
                        {m.sourceColumns[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sources.map((s, i) => (
                    <tr key={i} className="border-t border-line">
                      <th scope="row" className="py-2 pe-4 text-start font-semibold" dir="ltr">
                        {s.source}
                        {s.medium ? <span className="font-normal text-ink-faint"> / {s.medium}</span> : null}
                      </th>
                      <td className="py-2 pe-4" dir="ltr">
                        {s.campaign ?? "–"}
                      </td>
                      <td className="py-2 pe-4" dir="ltr">
                        {s.content ?? "–"}
                      </td>
                      <td className="py-2 pe-4">{t.crm.origins[s.origin]}</td>
                      <td className="py-2 pe-4">{s.inquiries}</td>
                      <td className="py-2 pe-4">{s.booked}</td>
                      <td className="py-2 pe-4">{s.qualified}</td>
                      <td className="py-2 pe-4">{s.won}</td>
                      <td className="py-2 pe-4">{s.lost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel title={m.losses} id="losses">
          {data.loss_reasons.length === 0 ? (
            <Empty>{m.noLosses}</Empty>
          ) : (
            <ul className="m-0 list-none p-0 text-[14px]" data-losses>
              {data.loss_reasons.map((l) => (
                <li key={l.reason} className="flex justify-between gap-3 border-t border-line py-2 first:border-t-0 first:pt-0">
                  <span>{t.crm.lossReasons[l.reason] ?? l.reason}</span>
                  <span className="font-semibold">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={m.outreach} id="outreach">
          <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-3" data-outreach>
            {(["prospects", "touches", "replies", "contacted", "replied", "qualified", "inquiries"] as const).map((k) => (
              <Stat key={k} value={outreach[k]} title={m.outreachCards[k]} />
            ))}
          </dl>
          <p className="mt-4 mb-0 text-[13.5px]">
            <span className="text-ink-soft">{m.qualifiedReplyRate}: </span>
            <strong>{fmt(qualifiedReply)}</strong>
          </p>
          <p className="mt-1 mb-0 text-[13.5px]">
            <span className="text-ink-soft">{m.firstTouchToMeeting}: </span>
            <strong>{outreach.median_days_first_touch_to_meeting === null ? m.rates.none : Math.round(Number(outreach.median_days_first_touch_to_meeting))}</strong>
          </p>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title={m.exports} id="exports">
          <p className="mt-0 mb-4 text-[13px] text-ink-soft">{m.exportsHelp}</p>
          <div className="flex flex-wrap gap-3">
            {(["inquiries", "companies", "prospects", "contacts"] as const).map((kind) => (
              <form key={kind} action={`/export/${kind}`} method="post" className="flex flex-col gap-1">
                <button type="submit" className={button}>
                  {m.exportKinds[kind]}
                </button>
                {kind === "contacts" && <span className={`${smallMuted} max-w-[22ch]`}>{m.exportContactsWarning}</span>}
              </form>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
