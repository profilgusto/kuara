import { describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("resolves with the work's value when it settles in time", async () => {
    await expect(withTimeout(Promise.resolve(42), 50)).resolves.toBe(42);
  });

  it("propagates the work's own rejection", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 50),
    ).rejects.toThrow("boom");
  });

  it("rejects with TimeoutError when the work never settles", async () => {
    const never = new Promise<void>(() => {});
    await expect(withTimeout(never, 10, "db")).rejects.toBeInstanceOf(
      TimeoutError,
    );
  });

  it("names the operation in the error message", async () => {
    const never = new Promise<void>(() => {});
    await expect(withTimeout(never, 10, "SELECT 1")).rejects.toThrow(
      "SELECT 1 timed out after 10ms",
    );
  });

  it("clears its timer once the work settles", async () => {
    vi.useFakeTimers();
    try {
      await withTimeout(Promise.resolve(1), 1000);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
