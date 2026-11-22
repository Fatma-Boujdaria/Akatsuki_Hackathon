import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { L } from "../lib/i18n";
import { cx } from "./ui";

// Fields (board 05): label above, help or error below.

// Design: 52 px fields, 14 px corners, hairline border on the card colour.
const control =
  "block w-full min-h-[52px] rounded-ctl border bg-surface px-4 text-[15px] font-medium text-ink placeholder:text-control " +
  "transition-colors focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-offset-0 disabled:opacity-40";

function FieldShell({
  id,
  label,
  help,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] leading-5 font-semibold text-body">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="mt-1.5 flex items-start gap-1.5 text-[14px] leading-5 text-grenade">
          <CircleAlert size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-msg`} className="mt-1.5 text-[14px] leading-5 text-mute">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  help,
  error,
  className,
  suffix,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; help?: ReactNode; error?: string | null; suffix?: string }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={help || error ? `${id}-msg` : undefined}
          className={cx(
            control,
            suffix && "pe-14",
            error ? "border-grenade focus:ring-grenade/25" : "border-hairline focus:border-link focus:ring-link/25",
            className,
          )}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 end-3.5 flex items-center text-[13px] font-semibold text-mute">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

export function SelectField({
  label,
  help,
  error,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; help?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={help || error ? `${id}-msg` : undefined}
        className={cx(
          control,
          "cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pe-10 rtl:bg-[left_12px_center]",
          error ? "border-grenade" : "border-hairline focus:border-link focus:ring-link/25",
          className,
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237C8796' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** Password with a show / hide button. */
export function PasswordField({
  label,
  help,
  error,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; help?: ReactNode; error?: string | null }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  return (
    <FieldShell id={id} label={label} help={help} error={error}>
      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={help || error ? `${id}-msg` : undefined}
          className={cx(
            control,
            "pe-14",
            error ? "border-grenade focus:ring-grenade/25" : "border-hairline focus:border-link focus:ring-link/25",
            className,
          )}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? L("Masquer le mot de passe", "Hide password", "خبّي كلمة السر") : L("Afficher le mot de passe", "Show password", "ورّي كلمة السر")}
          aria-pressed={shown}
          className="absolute inset-y-0 end-1 my-auto inline-flex size-11 cursor-pointer items-center justify-center rounded-ctl text-mute hover:text-ink"
        >
          {shown ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
        </button>
      </div>
    </FieldShell>
  );
}

/** Checkbox with its label on the same line (44 px tall). */
export function CheckboxField({
  label,
  checked,
  onChange,
  help,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: ReactNode;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-semibold text-body">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-5 shrink-0 cursor-pointer accent-[var(--primary)]"
        />
        {label}
      </label>
      {help && <p className="ms-8 text-[13px] text-mute">{help}</p>}
    </div>
  );
}
