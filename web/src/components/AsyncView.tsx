// Shows loading and error states the same way everywhere; renders children only when data is there.
import type { ReactNode } from "react";
import type { AsyncState } from "../hooks/index.ts";

export function AsyncView<T>({
  state,
  label,
  children,
}: {
  state: AsyncState<T>;
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (state.loading) return <p className="text-sm text-ink-muted">Loading {label}…</p>;
  if (state.error)
    return (
      <p role="alert" className="rounded-md border border-danger bg-panel p-sm text-sm text-danger">
        Could not load {label}: {state.error.message}
      </p>
    );
  if (state.data === undefined) return <p className="text-sm text-ink-muted">No {label} yet.</p>;
  return <>{children(state.data)}</>;
}
