// Base-metadata courier (openspec/changes/workflows-base-collaborators).
//
// A "dumb courier": fetch GET /v0/meta/bases/{baseId} with the four collaborator
// includes and return the body VERBATIM for the engine to parse. No task-side
// interpretation — unrecognized blocks are forwarded untouched, so payload
// evolution (e.g. the `packages` shape) needs no workflows deploy. Best-effort:
// any failure returns a typed skip reason, never throws — collaborator capture
// must never fail or delay record/attachment/comment capture.

const AIRTABLE_BASE_URL = "https://api.airtable.com";

export type BaseMetadataResult =
  | { ok: true; metadata: unknown }
  | { ok: false; reason: string };

export interface FetchBaseMetadataArgs {
  baseId: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export async function fetchBaseMetadata(args: FetchBaseMetadataArgs): Promise<BaseMetadataResult> {
  const fetchImpl = args.fetchImpl ?? fetch;
  const includes = ["collaborators", "inviteLinks", "interfaces", "packages"]
    .map((i) => `include=${i}`)
    .join("&");
  const url = `${AIRTABLE_BASE_URL}/v0/meta/bases/${encodeURIComponent(args.baseId)}?${includes}`;
  try {
    const res = await fetchImpl(url, {
      headers: { authorization: `Bearer ${args.accessToken}`, accept: "application/json" },
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    try {
      const metadata = await res.json();
      return { ok: true, metadata };
    } catch {
      return { ok: false, reason: "parse" };
    }
  } catch {
    return { ok: false, reason: "transport" };
  }
}
