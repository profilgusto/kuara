import { describe, expect, it } from "vitest";

import { Users } from "./Users.ts";

describe("Users auth config", () => {
  it("keeps a browser signed in for at least a month", () => {
    // Regression guard: reverting to `auth: true` drops back to Payload's
    // 7200s default and forces a re-login every two hours.
    expect(typeof Users.auth).toBe("object");

    const auth = Users.auth as { tokenExpiration?: number };
    const thirtyDays = 60 * 60 * 24 * 30;

    expect(auth.tokenExpiration).toBe(thirtyDays);
    expect(auth.tokenExpiration).toBeGreaterThanOrEqual(60 * 60 * 24 * 30);
  });
});
