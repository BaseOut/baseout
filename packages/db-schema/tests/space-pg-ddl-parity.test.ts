import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { SPACE_PG_DDL, spacePgDdlStatements } from "../src/space/pg-ddl";

// pg-ddl.ts is the bundled, executable copy of the per-Space Postgres migration
// (the engine Worker can't read the .sql at runtime). It is GENERATED from the
// migration; this test fails if the two drift, forcing a regenerate.

const MIG_DIR = resolve(__dirname, "../migrations/space-pg");

function migrationSql(): string {
  const file = readdirSync(MIG_DIR).find((f) => f.endsWith(".sql"));
  if (!file) throw new Error(`no .sql migration in ${MIG_DIR}`);
  return readFileSync(resolve(MIG_DIR, file), "utf8");
}

// Whitespace-insensitive compare: tabs-vs-spaces / trailing newlines must not
// trip the guard — only real SQL drift should.
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

describe("per-Space PG DDL ↔ migration parity", () => {
  it("bundled SPACE_PG_DDL matches the generated migration (statement for statement)", () => {
    const fromMigration = migrationSql()
      .split("--> statement-breakpoint")
      .map(norm)
      .filter(Boolean);
    const fromModule = spacePgDdlStatements().map(norm);
    expect(fromModule).toEqual(fromMigration);
  });

  it("covers all 45 bo_at_ tables", () => {
    // 20 base + 4 Health metric (server-schema-health-scoring)
    // + 1 synced-view-candidates (server-relationships)
    // + 2 chat (server-schema-chat: threads + messages)
    // + 2 inbox (server-notifications-inbox: triage state + per-base mutes)
    // + 5 interface entity/link tables (server-interfaces-normalize:
    //   bo_at_pages, bo_at_forms, bo_at_page_tables, bo_at_page_fields,
    //   bo_at_form_fields — bo_at_interfaces was reshaped, not added).
    // + 1 comment attachments (server-comment-attachments: bo_at_comment_attachments).
    // + 4 base collaborators (server-base-collaborators: bo_at_principals,
    //   bo_at_base_access, bo_at_invite_links, bo_at_base_collab_meta).
    // + 1 entity tags (server-automations-interfaces-manual-crud: bo_at_entity_tags).
    const creates = (SPACE_PG_DDL.match(/CREATE TABLE/g) ?? []).length;
    expect(creates).toBe(45);
  });
});
