// The four-touch outreach cadence from the campaign playbook (section 11):
//   touch 2: 3 to 4 business days after touch 1
//   touch 3: 5 to 7 business days after touch 2
//   touch 4: 7 to 10 business days after touch 3
// The CRM suggests the earliest date in each window; the person decides.
// Business days here follow the team's Cairo week: Friday and Saturday off.

const WINDOWS: Record<1 | 2 | 3, [number, number]> = { 1: [3, 4], 2: [5, 7], 3: [7, 10] };

const isWeekend = (d: Date) => d.getUTCDay() === 5 || d.getUTCDay() === 6;

export function addBusinessDays(day: string, count: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  let left = count;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend(d)) left -= 1;
  }
  return d.toISOString().slice(0, 10);
}

// After touch `n` on `day`, when the next touch is due: null after the fourth.
export function nextTouchWindow(n: number, day: string): { touch: 2 | 3 | 4; earliest: string; latest: string } | null {
  if (n !== 1 && n !== 2 && n !== 3) return null;
  const [min, max] = WINDOWS[n];
  return { touch: (n + 1) as 2 | 3 | 4, earliest: addBusinessDays(day, min), latest: addBusinessDays(day, max) };
}
