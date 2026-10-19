import { DEFAULT_SETTINGS } from '../domain/defaults';
import type { Settings } from '../domain/types';

type Migration = (s: Record<string, unknown>) => Record<string, unknown>;

/** Index i migrates from version i+1 to i+2. Add new steps here when the schema changes. */
const settingsMigrations: Migration[] = [];

function deepMerge<T>(base: T, over: unknown): T {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return (over ?? base) as T;
  if (typeof over !== 'object' || over === null) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

/** Brings stored settings up to the current schema and fills new fields with defaults. */
export function migrateSettings(raw: Partial<Settings> | null | undefined): Settings {
  let s = { ...(raw ?? {}) } as Record<string, unknown>;
  let v = typeof s.version === 'number' ? s.version : 1;
  while (v - 1 < settingsMigrations.length) {
    s = settingsMigrations[v - 1](s);
    v++;
  }
  const merged = deepMerge(DEFAULT_SETTINGS, s);
  merged.version = DEFAULT_SETTINGS.version;
  return merged;
}
