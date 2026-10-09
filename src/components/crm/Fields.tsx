import type { ReactNode } from "react";
import { field } from "@/components/dashboard/ui";
import { SCORE_KEYS, type Score } from "@/lib/crm/types";
import type { CrmMessages } from "@/lib/admin/crm-messages";

// Labelled form controls. Every control has a visible label tied to it, and a
// hint where one helps; text typed in either language keeps its own direction.

const labelClass = "text-[13px] font-semibold";
const hintClass = "m-0 text-[12.5px] text-ink-faint";

export function Labeled({ id, text, hint, children }: { id: string; text: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {text}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className={hintClass}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function TextField({
  id,
  name,
  text,
  defaultValue,
  required,
  maxLength,
  type = "text",
  hint,
  placeholder,
  ltr,
  min,
}: {
  id: string;
  name: string;
  text: string;
  defaultValue?: string | number | null;
  required?: boolean;
  maxLength?: number;
  type?: "text" | "email" | "tel" | "date" | "number" | "url";
  hint?: string;
  placeholder?: string;
  ltr?: boolean;
  min?: string | number;
}) {
  return (
    <Labeled id={id} text={text} hint={hint}>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        min={min}
        dir={ltr ? "ltr" : "auto"}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={field}
      />
    </Labeled>
  );
}

export function TextAreaField({
  id,
  name,
  text,
  defaultValue,
  rows = 3,
  maxLength,
  required,
  hint,
  placeholder,
}: {
  id: string;
  name: string;
  text: string;
  defaultValue?: string | null;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Labeled id={id} text={text} hint={hint}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        dir="auto"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`${field} leading-relaxed`}
      />
    </Labeled>
  );
}

export function SelectField({
  id,
  name,
  text,
  options,
  defaultValue,
  required,
  blank,
  hint,
}: {
  id: string;
  name: string;
  text: string;
  options: readonly { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  blank?: string;
  hint?: string;
}) {
  return (
    <Labeled id={id} text={text} hint={hint}>
      <select id={id} name={name} defaultValue={defaultValue ?? ""} required={required} aria-describedby={hint ? `${id}-hint` : undefined} className={field}>
        {blank !== undefined && (
          <option value="" disabled={required}>
            {blank}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Labeled>
  );
}

export function CheckboxField({ id, name, text, defaultChecked, hint }: { id: string; name: string; text: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="inline-flex items-center gap-2.5 text-[14px] font-semibold">
        <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} aria-describedby={hint ? `${id}-hint` : undefined} className="size-4 accent-mint-deep" />
        {text}
      </label>
      {hint && (
        <p id={`${id}-hint`} className={`${hintClass} ps-7`}>
          {hint}
        </p>
      )}
    </div>
  );
}

export const optionsOf = (labels: Record<string, string>, values: readonly string[]) => values.map((value) => ({ value, label: labels[value] ?? value }));

// The seven lead-score categories. All blank means "not scored".
export function ScoreFields({ idPrefix, score, t }: { idPrefix: string; score: Score | null; t: CrmMessages["score"] }) {
  return (
    <fieldset className="m-0 rounded-xl border border-line p-3.5">
      <legend className="px-1 text-[13px] font-semibold">{t.title}</legend>
      <p className={`${hintClass} mb-3`}>{t.help}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SCORE_KEYS.map((key) => {
          const [title, zero, one, two] = t.categories[key];
          return (
            <SelectField
              key={key}
              id={`${idPrefix}-${key}`}
              name={`score_${key}`}
              text={title}
              defaultValue={score && key in score ? String(score[key]) : ""}
              blank={t.blank}
              options={[
                { value: "0", label: `0 · ${zero}` },
                { value: "1", label: `1 · ${one}` },
                { value: "2", label: `2 · ${two}` },
              ]}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
