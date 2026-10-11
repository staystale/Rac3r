// Debug / tuning switches in one place: tools set globalThis.__X and env vars.
export function debugValue(name: string): unknown {
  return (globalThis as Record<string, unknown>)["__" + name];
}

export function envValue(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc && proc.env ? proc.env[name] : undefined;
}
