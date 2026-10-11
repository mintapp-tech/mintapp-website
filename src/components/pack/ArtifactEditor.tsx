"use client";

import { useActionState } from "react";
import type { PackEditState } from "@/app/(admin)/(workspace)/leads/actions";
import type { EditorInput, EditorSection, Fields, OptionSource } from "@/lib/pack/editor";
import SubmitButton from "@/components/dashboard/SubmitButton";

// The structured editor of one Pack part: every section as labelled fields, saved
// as a new version through the same checks as automation. A refused save comes back
// with the reasons and everything that was typed. The spec, labels and choices come
// from the server as plain data.

export interface EditorLabels {
  sections: Record<string, string>;
  fields: Record<string, string>;
  problems: Record<string, string>;
  // "Item {n}", "Screen {n}", "Screen item {n}"
  row: string;
  screen: string;
  screenItem: string;
  phases: string;
  choose: string;
  noPattern: string;
  help: string;
  save: string;
  failed: string;
}
export type EditorOptions = Record<OptionSource, { value: string; label: string }[]>;

type Action = (state: PackEditState, form: FormData) => Promise<PackEditState>;
const n = (template: string, i: number) => template.replace("{n}", String(i + 1));
const field = "w-full rounded-lg border border-ink/15 bg-surface px-3 py-2 text-[14px] leading-relaxed focus:border-ink/40 focus:outline-none";
const label = "mb-1 block text-[12.5px] font-semibold text-ink-soft";

// How many rows to show: every filled one, plus two empty to add, within the limits.
function count(values: Fields, prefix: string, min: number, max: number) {
  let last = -1;
  const re = new RegExp(`^${prefix.replace(/\./g, "\\.")}\\.(\\d+)(\\.|$)`);
  for (const k of Object.keys(values)) {
    const m = re.exec(k);
    if (m && values[k]) last = Math.max(last, Number(m[1]));
  }
  return Math.min(max, Math.max(min, last + 3, 2));
}

function Input({ name, spec, values, labels, options, id }: { name: string; spec: EditorInput; values: Fields; labels: EditorLabels; options: EditorOptions; id: string }) {
  const text = labels.fields[spec.name] ?? spec.name;
  const value = values[name] ?? "";
  if (spec.input === "select") {
    const opts = options[spec.options!];
    return (
      <div className="min-w-0">
        <label htmlFor={id} className={label}>
          {text}
        </label>
        <select id={id} name={name} defaultValue={value} className={field}>
          {spec.options === "pattern" ? <option value="">{labels.noPattern}</option> : spec.optional || !value ? <option value="">{labels.choose}</option> : null}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={label}>
        {text}
      </label>
      {spec.input === "textarea" ? (
        <textarea id={id} name={name} defaultValue={value} maxLength={spec.max} rows={3} dir="auto" className={field} />
      ) : (
        <input id={id} name={name} defaultValue={value} maxLength={spec.max} dir="auto" className={field} />
      )}
    </div>
  );
}

function Rows({ prefix, inputs, min, max, values, labels, options }: { prefix: string; inputs: EditorInput[]; min: number; max: number; values: Fields; labels: EditorLabels; options: EditorOptions }) {
  const rows = count(values, prefix, min, max);
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <fieldset key={i} className="m-0 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
          <legend className="px-1 text-[12.5px] font-bold text-ink">{n(labels.row, i)}</legend>
          {inputs.map((f) => (
            <div key={f.name} className={f.input === "textarea" ? "sm:col-span-2" : undefined}>
              <Input name={`${prefix}.${i}.${f.name}`} id={`${prefix}-${i}-${f.name}`} spec={f} values={values} labels={labels} options={options} />
            </div>
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function Lines({ prefix, title, min, max, length, values, labels }: { prefix: string; title: string; min: number; max: number; length: number; values: Fields; labels: EditorLabels }) {
  const rows = count(values, prefix, min, max);
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className={label}>{title}</legend>
      {Array.from({ length: rows }, (_, i) => (
        <input key={i} name={`${prefix}.${i}`} aria-label={`${title} · ${n(labels.row, i)}`} defaultValue={values[`${prefix}.${i}`] ?? ""} maxLength={length} dir="auto" className={field} />
      ))}
    </fieldset>
  );
}

export default function ArtifactEditor({
  action,
  inquiryId,
  kind,
  source,
  spec,
  phases,
  screens,
  initial,
  labels,
  options,
}: {
  action: Action;
  inquiryId: string;
  kind: "design" | "proposal" | "discovery";
  source: "manual" | "edited";
  spec: EditorSection[];
  phases: { min: number; max: number; fields: EditorInput[] };
  screens: { fields: EditorInput[]; items: number };
  initial: Fields;
  labels: EditorLabels;
  options: EditorOptions;
}) {
  const [state, formAction] = useActionState(action, { problems: [], fields: null, attempt: 0 });
  const values = state.fields ?? initial;

  return (
    <form key={state.attempt} action={formAction} className="mt-3 flex flex-col gap-4" data-artifact-editor={kind}>
      <input type="hidden" name="inquiryId" value={inquiryId} />
      <input type="hidden" name="artifact" value={kind} />
      <input type="hidden" name="source" value={source} />
      <p className="m-0 text-[13px] text-ink-soft">{labels.help}</p>
      {state.problems.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-[13.5px] text-red-900" data-editor-problems>
          <p className="m-0 font-semibold">{labels.failed}</p>
          <ul className="mt-1 mb-0 ps-5">
            {[...new Map(state.problems.map((p) => [`${p.kind}:${p.section ?? ""}`, p])).values()].map((p) => (
              <li key={`${p.kind}:${p.section ?? ""}`}>
                {labels.problems[p.kind] ?? p.kind}
                {p.section && labels.sections[p.section] ? ` (${labels.sections[p.section]})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {spec.map((s) => (
        <details key={s.key} className="rounded-xl border border-line bg-surface-2/40 p-3" open={state.problems.some((p) => p.section === s.key)}>
          <summary className="cursor-pointer text-[14px] font-semibold">{labels.sections[s.key]}</summary>
          <div className="mt-3">
            {s.type === "rows" && <Rows prefix={s.key} inputs={s.fields} min={s.min} max={s.max} values={values} labels={labels} options={options} />}
            {s.type === "lines" && <Lines prefix={s.key} title={labels.sections[s.key]} min={s.min} max={s.max} length={s.length} values={values} labels={labels} />}
            {s.type === "group" && (
              <div className="flex flex-col gap-3">
                {s.parts.map((p) =>
                  p.kind === "field" ? (
                    <Input key={p.name} name={`${s.key}.${p.name}`} id={`${s.key}-${p.name}`} spec={p} values={values} labels={labels} options={options} />
                  ) : (
                    <Lines key={p.name} prefix={`${s.key}.${p.name}`} title={labels.fields[p.name] ?? p.name} min={p.min} max={p.max} length={p.length} values={values} labels={labels} />
                  ),
                )}
                {s.key === "proposal_direction" && (
                  <div>
                    <p className={label}>{labels.phases}</p>
                    <Rows prefix="proposal_direction.phases" inputs={phases.fields} min={phases.min} max={phases.max} values={values} labels={labels} options={options} />
                  </div>
                )}
              </div>
            )}
            {s.type === "screens" && (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <fieldset key={i} className="m-0 grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                    <legend className="px-1 text-[12.5px] font-bold text-ink">{n(labels.screen, i)}</legend>
                    {screens.fields.map((f) => (
                      <Input key={f.name} name={`screens.${i}.${f.name}`} id={`screens-${i}-${f.name}`} spec={f} values={values} labels={labels} options={options} />
                    ))}
                    {Array.from({ length: Math.min(screens.items, Math.max(2, count(values, `screens.${i}.items`, 0, screens.items))) }, (_, j) => (
                      <div key={j} className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                        <div>
                          <label htmlFor={`screens-${i}-item-${j}-title`} className={label}>
                            {`${n(labels.screenItem, j)} · ${labels.fields.item_title}`}
                          </label>
                          <input id={`screens-${i}-item-${j}-title`} name={`screens.${i}.items.${j}.title`} defaultValue={values[`screens.${i}.items.${j}.title`] ?? ""} maxLength={60} dir="auto" className={field} />
                        </div>
                        <div>
                          <label htmlFor={`screens-${i}-item-${j}-text`} className={label}>
                            {`${n(labels.screenItem, j)} · ${labels.fields.item_text}`}
                          </label>
                          <input id={`screens-${i}-item-${j}-text`} name={`screens.${i}.items.${j}.text`} defaultValue={values[`screens.${i}.items.${j}.text`] ?? ""} maxLength={160} dir="auto" className={field} />
                        </div>
                      </div>
                    ))}
                  </fieldset>
                ))}
              </div>
            )}
          </div>
        </details>
      ))}
      <SubmitButton className="self-start rounded-xl bg-dark px-4 py-2.5 text-[14px] font-semibold text-white">{labels.save}</SubmitButton>
    </form>
  );
}
