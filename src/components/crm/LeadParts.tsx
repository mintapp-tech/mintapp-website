import { Chip, formatDate, formatDay, type ChipTone } from "@/components/dashboard/ui";
import type { AdminLocale, AdminMessages } from "@/lib/admin/messages";
import { simpleStage } from "@/lib/crm/simple-stages";
import type { PackState } from "@/lib/pack/state";

// Small building blocks shared by Leads & Clients, the lead page and the dashboard.

export const PACK_TONES: Record<PackState, ChipTone> = {
  not_started: "neutral",
  preparing: "info",
  needs_manual: "warn",
  ready_for_review: "info",
  approved: "ok",
  needs_attention: "attention",
};

const POSITION_TONES: Record<string, ChipTone> = { new: "info", reviewing: "neutral", meeting: "info", qualified: "ok", proposal: "info", decision: "warn", won: "ok", lost: "neutral" };
const PRIORITY_TONES: Record<string, ChipTone> = { high: "attention", medium: "warn", low: "neutral" };

export function PackChip({ state, waiting, t }: { state: PackState; waiting?: boolean; t: AdminMessages }) {
  // Before a booking, "Not started" reads as what it is: waiting for the booking.
  return (
    <Chip tone={PACK_TONES[state]} data-pack-state={state}>
      {state === "not_started" && waiting ? t.lead.waitingBooking : t.lead.packStates[state]}
    </Chip>
  );
}

export function PositionChip({ stage, t }: { stage: string; t: AdminMessages }) {
  const s = simpleStage(stage);
  return (
    <Chip tone={POSITION_TONES[s]} data-position={s}>
      {t.lead.positions[s]}
    </Chip>
  );
}

export function PriorityChip({ priority, t }: { priority: string | null; t: AdminMessages }) {
  if (!priority) return null;
  return (
    <Chip tone={PRIORITY_TONES[priority] ?? "neutral"} data-priority={priority}>
      {t.lead.priorities[priority] ?? priority}
    </Chip>
  );
}

export function PausedChip({ until, t, locale }: { until: string | null; t: AdminMessages; locale: AdminLocale }) {
  if (!until) return null;
  return (
    <Chip tone="neutral" data-paused={until}>
      {t.lead.common.pausedUntil(formatDay(until, locale))}
    </Chip>
  );
}

// The same rule as the public booking-recovery page: a Cal.com booking uid
// becomes its manage link; anything else gets no link.
const CAL_BOOKING_UID = /^[A-Za-z0-9_-]{8,64}$/;
export const manageUrl = (uid: string | null | undefined) => (uid && CAL_BOOKING_UID.test(uid) ? `https://cal.com/booking/${uid}` : null);

const IANA_ZONE = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/;

// The meeting as the founders need it: Cairo time first, the client's own time
// when it differs, and the manage link.
export function MeetingSummary({
  status,
  start,
  timezone,
  uid,
  t,
  locale,
  compact = false,
}: {
  status: string;
  start: string | null;
  timezone: string | null;
  uid: string | null;
  t: AdminMessages;
  locale: AdminLocale;
  compact?: boolean;
}) {
  const m = t.lead.meeting;
  if (status === "not_booked" || !start) return <span className="text-ink-soft" data-meeting="not_booked">{m.notBooked}</span>;
  const when = formatDate(start, true, locale);
  if (status !== "booked") {
    const word = status === "cancelled" ? m.cancelled : status === "completed" ? m.completed : status === "no_show" ? m.noShow : status;
    return (
      <span data-meeting={status}>
        <Chip tone={status === "completed" ? "info" : "warn"}>{word}</Chip> <span className="text-ink-soft">{when}</span>
      </span>
    );
  }
  const zone = timezone && IANA_ZONE.test(timezone) && timezone !== "Africa/Cairo" ? timezone : null;
  let clientTime: string | null = null;
  if (zone) {
    try {
      clientTime = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { timeZone: zone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(start));
    } catch {
      clientTime = null;
    }
  }
  const link = manageUrl(uid);
  return (
    <span className="flex flex-col gap-0.5" data-meeting="booked">
      <span className="font-semibold">
        {when} <span className="text-[12px] font-normal text-ink-faint">({m.cairoTime})</span>
      </span>
      {clientTime && zone && <span className="text-[12.5px] text-ink-soft">{m.clientTime(clientTime, zone)}</span>}
      {link && !compact && (
        <a href={link} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-ink underline decoration-mint decoration-2 underline-offset-4" data-manage-link>
          {m.manage}
          <span className="sr-only"> ({m.manageHint})</span>
        </a>
      )}
    </span>
  );
}
