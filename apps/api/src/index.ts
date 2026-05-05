// @baseout/api — public versioned ingestion API at api.baseout.com.
// See ./openspec/proposal.md for scope.

export default {
  async fetch(): Promise<Response> {
    return new Response("baseout-api placeholder", { status: 200 });
  },
};
