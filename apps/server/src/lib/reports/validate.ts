// Definition request-body validation (pure, unit-tested) — server-reports task 3.1.
//
// Server-side validation for definition create/update. Recipient validation lives
// in store.ts (validateRecipients) and is composed here.

import { validateRecipients } from "./store";
import { REPORT_SECTION_KEYS, type ReportCadence, type ReportSectionKey } from "./types";
import type { ReportRecipient } from "../../db/schema";

const WINDOW_KINDS = ["since_last", "rolling", "all_time"] as const;
const CADENCES = ["data_backup", "schema_backup", "weekly", "monthly"] as const;
const FORMATS = ["pdf", "html"] as const;

export interface ParsedDefinition {
  name: string;
  sections: ReportSectionKey[];
  baseScope: string[] | null;
  windowKind: (typeof WINDOW_KINDS)[number];
  windowDays: number | null;
  scheduleCadence: ReportCadence | null;
  scheduleDay: number | null;
  scheduleTime: string | null;
  scheduleFormats: string[];
  scheduleRecipients: ReportRecipient[];
  scheduleSuppressEmpty: boolean;
  scheduleEnabled: boolean;
}

export type ParseResult =
  | { ok: true; value: ParsedDefinition }
  | { ok: false; error: string };

function parseSections(raw: unknown): ReportSectionKey[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ReportSectionKey[] = [];
  for (const s of raw) {
    if (typeof s !== "string" || !REPORT_SECTION_KEYS.includes(s as ReportSectionKey)) {
      return null;
    }
    if (!out.includes(s as ReportSectionKey)) out.push(s as ReportSectionKey);
  }
  return out;
}

function parseFormats(raw: unknown): string[] | null {
  if (raw == null) return ["pdf"];
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: string[] = [];
  for (const f of raw) {
    if (typeof f !== "string" || !FORMATS.includes(f as (typeof FORMATS)[number])) return null;
    if (!out.includes(f)) out.push(f);
  }
  return out;
}

/** Full validation for create. Every field required to be well-formed. */
export function parseCreateDefinition(raw: unknown): ParseResult {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "body must be an object" };
  }
  const b = raw as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim() === "") {
    return { ok: false, error: "name is required" };
  }
  const sections = parseSections(b.sections);
  if (!sections) return { ok: false, error: "sections must be a non-empty array of valid keys" };

  let baseScope: string[] | null = null;
  if (b.baseScope != null) {
    if (!Array.isArray(b.baseScope) || b.baseScope.some((x) => typeof x !== "string")) {
      return { ok: false, error: "baseScope must be an array of base ids or null" };
    }
    baseScope = b.baseScope as string[];
  }

  const windowKind = b.windowKind;
  if (typeof windowKind !== "string" || !WINDOW_KINDS.includes(windowKind as never)) {
    return { ok: false, error: "windowKind must be since_last | rolling | all_time" };
  }
  let windowDays: number | null = null;
  if (windowKind === "rolling") {
    if (typeof b.windowDays !== "number" || !Number.isInteger(b.windowDays) || b.windowDays <= 0) {
      return { ok: false, error: "windowDays must be a positive integer for a rolling window" };
    }
    windowDays = b.windowDays;
  } else if (b.windowDays != null) {
    return { ok: false, error: "windowDays is only valid for a rolling window" };
  }

  // Schedule (optional — null cadence = manual-only).
  let scheduleCadence: ReportCadence | null = null;
  let scheduleDay: number | null = null;
  let scheduleTime: string | null = null;
  if (b.scheduleCadence != null) {
    if (typeof b.scheduleCadence !== "string" || !CADENCES.includes(b.scheduleCadence as never)) {
      return { ok: false, error: "scheduleCadence must be a valid cadence or null" };
    }
    scheduleCadence = b.scheduleCadence as ReportCadence;
    if (scheduleCadence === "weekly" || scheduleCadence === "monthly") {
      if (typeof b.scheduleDay !== "number" || !Number.isInteger(b.scheduleDay)) {
        return { ok: false, error: "scheduleDay is required for weekly/monthly" };
      }
      const okDay =
        scheduleCadence === "weekly"
          ? b.scheduleDay >= 0 && b.scheduleDay <= 6
          : b.scheduleDay >= 1 && b.scheduleDay <= 28;
      if (!okDay) return { ok: false, error: "scheduleDay out of range" };
      scheduleDay = b.scheduleDay;
      if (typeof b.scheduleTime !== "string" || !/^\d{2}:\d{2}$/.test(b.scheduleTime)) {
        return { ok: false, error: "scheduleTime must be HH:MM for weekly/monthly" };
      }
      scheduleTime = b.scheduleTime;
    }
  }

  const scheduleFormats = parseFormats(b.scheduleFormats);
  if (!scheduleFormats) return { ok: false, error: "scheduleFormats must be a non-empty subset of pdf|html" };

  const recip = validateRecipients(b.scheduleRecipients);
  if (!recip.ok) return { ok: false, error: recip.error! };

  return {
    ok: true,
    value: {
      name: b.name.trim(),
      sections,
      baseScope,
      windowKind: windowKind as (typeof WINDOW_KINDS)[number],
      windowDays,
      scheduleCadence,
      scheduleDay,
      scheduleTime,
      scheduleFormats,
      scheduleRecipients: recip.recipients!,
      scheduleSuppressEmpty: b.scheduleSuppressEmpty !== false,
      scheduleEnabled: b.scheduleEnabled !== false,
    },
  };
}
