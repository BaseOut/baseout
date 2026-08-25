// Cloudflare D1 REST + HTTP query client (server-d1-backend).
// Per-Space databases cannot be Worker bindings (created at runtime), so
// lifecycle and queries both go over HTTPS. I/O is `fetch` so tests inject
// a fake.

export interface D1ApiConfig {
  accountId: string;
  apiToken: string;
  fetchImpl?: typeof fetch;
}

export interface CreatedD1Database {
  uuid: string;
  name: string;
}

interface CfEnvelope<T> {
  success: boolean;
  errors?: { code?: number; message?: string }[];
  result?: T;
}

function cfApi(config: D1ApiConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;
  const base = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/d1/database`;
  const headers = {
    authorization: `Bearer ${config.apiToken}`,
    "content-type": "application/json",
  };
  return { fetchImpl, base, headers };
}

function alreadyExists(status: number, body: CfEnvelope<unknown>): boolean {
  if (status === 409) return true;
  const messages = (body.errors ?? []).map((e) => (e.message ?? "").toLowerCase());
  return messages.some(
    (m) => m.includes("already exists") || m.includes("duplicate"),
  );
}

export async function createD1Database(
  config: D1ApiConfig,
  name: string,
): Promise<CreatedD1Database> {
  const { fetchImpl, base, headers } = cfApi(config);
  const res = await fetchImpl(base, {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });
  const body = (await res.json()) as CfEnvelope<{ uuid: string; name: string }>;
  if (res.ok && body.success && body.result?.uuid) {
    return { uuid: body.result.uuid, name: body.result.name ?? name };
  }
  if (alreadyExists(res.status, body)) {
    const existing = await findD1DatabaseByName(config, name);
    if (existing) return existing;
  }
  const detail = body.errors?.map((e) => e.message).filter(Boolean).join("; ");
  throw new Error(
    `D1 create failed (${res.status})${detail ? `: ${detail}` : ""}`,
  );
}

export async function findD1DatabaseByName(
  config: D1ApiConfig,
  name: string,
): Promise<CreatedD1Database | null> {
  const { fetchImpl, base, headers } = cfApi(config);
  const res = await fetchImpl(`${base}?name=${encodeURIComponent(name)}`, {
    headers,
  });
  const body = (await res.json()) as CfEnvelope<
    { uuid: string; name: string }[] | { uuid: string; name: string }
  >;
  if (!res.ok || !body.success) return null;
  const result = body.result;
  if (Array.isArray(result)) {
    const match = result.find((row) => row.name === name);
    return match ? { uuid: match.uuid, name: match.name } : null;
  }
  if (result && result.name === name) {
    return { uuid: result.uuid, name: result.name };
  }
  return null;
}

export async function deleteD1Database(
  config: D1ApiConfig,
  uuid: string,
): Promise<void> {
  const { fetchImpl, base, headers } = cfApi(config);
  const res = await fetchImpl(`${base}/${uuid}`, {
    method: "DELETE",
    headers,
  });
  if (res.status === 404) return;
  const body = (await res.json()) as CfEnvelope<unknown>;
  if (!res.ok || body.success === false) {
    const detail = body.errors?.map((e) => e.message).filter(Boolean).join("; ");
    throw new Error(
      `D1 delete failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
}

export async function queryD1(
  config: D1ApiConfig,
  databaseId: string,
  sql: string,
  params: unknown[] = [],
): Promise<unknown[]> {
  const { fetchImpl, base, headers } = cfApi(config);
  const res = await fetchImpl(`${base}/${databaseId}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sql, params }),
  });
  const body = (await res.json()) as CfEnvelope<{ results?: unknown[] }[]>;
  if (!res.ok || !body.success) {
    const detail = body.errors?.map((e) => e.message).filter(Boolean).join("; ");
    throw new Error(
      `D1 query failed (${res.status})${detail ? `: ${detail}` : ""}`,
    );
  }
  const first = Array.isArray(body.result) ? body.result[0] : undefined;
  return first?.results ?? [];
}

export async function queryD1Batch(
  config: D1ApiConfig,
  databaseId: string,
  statements: { sql: string; params?: unknown[] }[],
): Promise<void> {
  for (const stmt of statements) {
    await queryD1(config, databaseId, stmt.sql, stmt.params ?? []);
  }
}
