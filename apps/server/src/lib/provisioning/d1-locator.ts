// D1 locator (de)serialization for space_databases (server-d1-backend 1.3).
//
// The query API addresses the database by UUID; the name is dashboard
// legibility only. JSON on the wire so markActive can keep a single locator
// string for the orchestrator while the writer splits columns.

export interface D1Locator {
  d1DatabaseId: string;
  d1DatabaseName: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function serializeD1Locator(locator: D1Locator): string {
  if (!UUID_RE.test(locator.d1DatabaseId)) {
    throw new Error("d1DatabaseId must be a UUID");
  }
  if (locator.d1DatabaseName.trim().length === 0) {
    throw new Error("d1DatabaseName must not be empty");
  }
  return JSON.stringify({
    d1DatabaseId: locator.d1DatabaseId,
    d1DatabaseName: locator.d1DatabaseName,
  });
}

export function parseD1Locator(raw: string): D1Locator {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("d1 locator is not valid JSON");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("d1DatabaseId" in parsed) ||
    !("d1DatabaseName" in parsed)
  ) {
    throw new Error("d1 locator must include d1DatabaseId and d1DatabaseName");
  }
  const id = (parsed as D1Locator).d1DatabaseId;
  const name = (parsed as D1Locator).d1DatabaseName;
  if (typeof id !== "string" || typeof name !== "string") {
    throw new Error("d1 locator fields must be strings");
  }
  if (!UUID_RE.test(id)) {
    throw new Error("d1DatabaseId must be a UUID");
  }
  if (name.trim().length === 0) {
    throw new Error("d1DatabaseName must not be empty");
  }
  return { d1DatabaseId: id, d1DatabaseName: name };
}
