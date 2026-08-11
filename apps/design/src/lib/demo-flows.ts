// Compatibility shim over the canonical FLOW_REGISTRY (./flow-registry.ts).
//
// The ScenarioSwitcher panel and the harness pages import { DEMO_FLOWS } and the
// DemoFlow / FlowStep types from here. Those are now DERIVED from the registry so
// there is one source of truth: the panel shows the curated subset (inSwitcher),
// the /handoff index shows everything. Add or edit flows in flow-registry.ts.

import { FLOW_REGISTRY } from './flow-registry';

export interface FlowStep {
  label: string; // short step name, shown in the step indicator
  href: string; // where this step lives (pathname + query)
  caption: string; // presenter note shown under the indicator
}
export interface DemoFlow {
  key: string;
  name: string;
  blurb: string; // one line shown in the flow list
  steps: FlowStep[];
}

// The panel only plays flows that are curated in (`inSwitcher`), built, and have
// every step clickable (no null hrefs). Everything else lives in /handoff.
export const DEMO_FLOWS: DemoFlow[] = FLOW_REGISTRY.filter(
  (f) => f.inSwitcher && f.status === 'built' && f.steps.every((s) => s.href),
).map((f) => ({
  key: f.id,
  name: f.name,
  blurb: f.blurb,
  steps: f.steps.map((s) => ({ label: s.label, href: s.href as string, caption: s.caption })),
}));
