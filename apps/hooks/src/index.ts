// @baseout/hooks — public Airtable webhook receiver at
// webhooks.baseout.com. See ./openspec/proposal.md for scope.

export default {
  async fetch(): Promise<Response> {
    return new Response("baseout-hooks placeholder", { status: 200 });
  },
};
