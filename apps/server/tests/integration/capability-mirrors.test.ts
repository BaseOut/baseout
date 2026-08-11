// Pin the basesPerSpace value of every Tier in the engine's
// tier-capabilities mirror against the canonical apps/web copy. When
// apps/web's TIER_CAPABILITIES changes a basesPerSpace value, this test
// fails until the engine mirror is updated to match.
//
// Scope is intentionally narrow: the engine mirror only carries
// `basesPerSpace` (see its header comment), so we don't deep-equal the
// full TIER_CAPABILITIES objects — the canonical web copy also carries
// `frequencies`, which the engine never reads. The contract this guards
// is the one declared in
// openspec/changes/server-workspace-rediscovery/specs/backup-workspace-rediscovery/spec.md
// §Requirement: Tier-cap resolver mirrors apps/web — both sides MUST
// agree on basesPerSpace per Tier.

import { describe, it, expect } from "vitest";

import {
  TIER_CAPABILITIES as ENGINE_TIER_CAPABILITIES,
  type Tier as EngineTier,
} from "../../src/lib/capabilities/tier-capabilities";
import {
  TIER_CAPABILITIES as WEB_TIER_CAPABILITIES,
  type Tier as WebTier,
} from "../../../web/src/lib/capabilities/tier-capabilities";

describe("capability mirrors", () => {
  it("declares the same Tier union as apps/web", () => {
    const engineTiers = Object.keys(ENGINE_TIER_CAPABILITIES).sort();
    const webTiers = Object.keys(WEB_TIER_CAPABILITIES).sort();
    expect(engineTiers).toEqual(webTiers);
  });

  it("matches apps/web on basesPerSpace for every Tier", () => {
    const tiers: EngineTier[] = [
      "starter",
      "launch",
      "growth",
      "pro",
      "business",
      "enterprise",
    ];
    for (const tier of tiers) {
      const webTier = tier as WebTier;
      expect(ENGINE_TIER_CAPABILITIES[tier].basesPerSpace).toBe(
        WEB_TIER_CAPABILITIES[webTier].basesPerSpace,
      );
    }
  });
});
