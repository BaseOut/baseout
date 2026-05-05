// @baseout/sql — public versioned read-only SQL API at sql.baseout.com.
// See ./openspec/proposal.md for scope.

export default {
  async fetch(): Promise<Response> {
    return new Response("baseout-sql placeholder", { status: 200 });
  },
};
