import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { CircleAlert } from "lucide-react";
import { cx } from "./ui";

// Fields (board 05): label above, help or error below.

const control =
  "block w-full min-h-11 rounded-ctl border bg-surface px-3.5 text-[16px] text-ink placeholder:text-control " +
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
      <label htmlFor={id} className="mb-1.5 block text-[15px] leading-6 font-semibold text-ink">
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
            suffix && "pr-14",
            error ? "border-grenade focus:ring-grenade/25" : "border-control/60 focus:border-primary focus:ring-primary/25",
            className,
          )}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center font-mono text-[13px] text-mute">
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
          "cursor-pointer appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10",
          error ? "border-grenade" : "border-control/60 focus:border-primary focus:ring-primary/25",
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
