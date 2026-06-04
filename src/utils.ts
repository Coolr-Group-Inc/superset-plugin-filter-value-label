// Based on the Apache Superset native filter Select plugin.

/**
 * Returns a debounced version of `fn` that delays invoking it until `delay`
 * milliseconds have elapsed since the last call.
 */
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
