// Shared plumbing for the hooks. Every hook returns at least { data, loading, error }.
import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
}

const toError = (err: unknown) => (err instanceof Error ? err : new Error(String(err)));

// Runs `load` when the component mounts and again whenever `key` changes. Cancels stale calls.
// `reload` runs it again on demand.
export function useQuery<T>(load: (signal: AbortSignal) => Promise<T>, key: string): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, loading: true, error: undefined });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ data: s.data, loading: true, error: undefined }));
    loadRef.current(controller.signal).then(
      (data) => !controller.signal.aborted && setState({ data, loading: false, error: undefined }),
      (err) => !controller.signal.aborted && setState({ data: undefined, loading: false, error: toError(err) }),
    );
    return () => controller.abort();
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

// For calls the user triggers (a button): nothing runs until `run` is called.
export function useMutation<A extends unknown[], T>(
  call: (...args: [...A, AbortSignal]) => Promise<T>,
): AsyncState<T> & { run: (...args: A) => Promise<T | undefined> } {
  const [state, setState] = useState<AsyncState<T>>({ data: undefined, loading: false, error: undefined });
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const callRef = useRef(call);
  callRef.current = call;

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(async (...args: A) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((s) => ({ data: s.data, loading: true, error: undefined }));
    try {
      const data = await callRef.current(...args, controller.signal);
      if (!controller.signal.aborted) setState({ data, loading: false, error: undefined });
      return data;
    } catch (err) {
      if (!controller.signal.aborted) setState({ data: undefined, loading: false, error: toError(err) });
      return undefined;
    }
  }, []);

  return { ...state, run };
}
