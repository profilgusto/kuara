/**
 * session.test.ts — the pose controls, driven the way a student drives them.
 *
 * The turning machinery is shared with `rotation-matrix` and tested there and
 * in `orientation-session`; what is this widget's own is the second half of a
 * pose — that aligning the axes leaves the translation alone, that redefining
 * puts both halves back, and that a session's ghosts never claim to remember
 * where the frame stood.
 */
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Vec3 } from "../../props";
import { useTransformSession } from "./session";
import {
  applyTransform,
  column,
  composeIntrinsic,
  elementary,
  rotationBlock,
  translationBlock,
  type Mat3,
} from "./transform";

const POSE = { angles: [0, 0, 30] as Vec3, position: [1.2, 0.8, 0.6] as Vec3 };

const session = (mode = "inercial", pose = POSE) =>
  renderHook(() =>
    useTransformSession({
      angles: pose.angles,
      position: pose.position,
      mode,
      decimals: 2,
    }),
  ).result;

const close = (m: Mat3, want: Mat3) =>
  m.forEach((row, i) =>
    row.forEach((entry, j) => expect(entry).toBeCloseTo(want[i][j], 12)),
  );

const X = 0;

const drag = (s: ReturnType<typeof session>, axis: number, deg: number) => {
  act(() => s.current.beginGesture(axis));
  act(() => s.current.setAngle(axis, deg));
  act(() => s.current.commitLive(axis));
};

describe("the two ways back", () => {
  it("aligns the axes without moving the frame", () => {
    // The figure's argument: the left block goes to the identity while the
    // last column sits exactly still.
    const s = session();
    act(() => s.current.setCoord(0, -1.5));
    const before = translationBlock(s.current.transform);

    act(() => s.current.align());
    close(rotationBlock(s.current.transform), [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(translationBlock(s.current.transform)).toEqual(before);
    expect(translationBlock(s.current.transform)).toEqual([-1.5, 0.8, 0.6]);
  });

  it("redefines both halves of the pose", () => {
    const s = session();
    act(() => s.current.setAngle(X, 90));
    act(() => s.current.setCoord(1, -2));
    expect(s.current.atInitialPose).toBe(false);

    act(() => s.current.resetPose());
    expect(s.current.deg).toEqual(POSE.angles);
    expect(s.current.pos).toEqual(POSE.position);
    close(rotationBlock(s.current.transform), elementary("z", 30));
    expect(s.current.atInitialPose).toBe(true);
  });

  it("knows when each button has nothing left to do", () => {
    const s = session();
    // Authored with a turn and an offset: back where it started, but not
    // aligned — the two questions are different.
    expect(s.current.atInitialPose).toBe(true);
    expect(s.current.aligned).toBe(false);

    act(() => s.current.align());
    expect(s.current.aligned).toBe(true);
    expect(s.current.atInitialPose).toBe(false);
  });

  it("redefines the pose from inside a session too", () => {
    const s = session("proprio");
    drag(s, X, 40);
    expect(s.current.ghostQuaternions).toHaveLength(2); // the authored step, plus this one

    act(() => s.current.resetPose());
    close(rotationBlock(s.current.transform), elementary("z", 30));
    expect(s.current.pos).toEqual(POSE.position);
    // The trail goes back to what the authored orientation is made of.
    expect(s.current.steps).toEqual([{ axis: "z", deg: 30 }]);
    expect(s.current.atInitialPose).toBe(true);
  });

  it("clears the ghosts when the axes are aligned", () => {
    const s = session("proprio");
    drag(s, X, 40);
    act(() => s.current.align());
    expect(s.current.steps).toEqual([]);
    expect(s.current.ghostQuaternions).toEqual([]);
    expect(s.current.aligned).toBe(true);
    // …and the frame has not moved an inch.
    expect(s.current.pos).toEqual(POSE.position);
  });
});

describe("a session on a frame that is not at the origin", () => {
  it("turns about {R}'s own axes, wherever {R} stands", () => {
    // The translation must not enter the rotation block: a pose is a turn and
    // a carry, never a turn *around* the origin of {I}.
    const s = session("proprio");
    act(() => s.current.align());
    act(() => s.current.setCoord(0, 2));

    drag(s, X, 30);
    const ownX = column(rotationBlock(s.current.transform), 0);
    drag(s, 1, 40);
    drag(s, X, 20);

    // The first step was about x̂, so it left x̂ alone: {R}'s x̂ is still the
    // inertial one at that point. And none of this touched where {R} sits.
    expect(ownX).toEqual([1, 0, 0]);
    expect(s.current.steps).toHaveLength(3);
    expect(translationBlock(s.current.transform)).toEqual([2, 0.8, 0.6]);

    // …while the third step's axis is {R}'s x̂ by then, which the y step moved.
    const beforeThird = composeIntrinsic(s.current.steps.slice(0, 2));
    column(beforeThird, 0).forEach((c, i) =>
      expect(column(rotationBlock(s.current.transform), 0)[i]).toBeCloseTo(
        c,
        12,
      ),
    );
    expect(Math.abs(column(beforeThird, 0)[0] - 1)).toBeGreaterThan(0.1);
  });

  it("carries the frame's origin to the translation, not to the rotation", () => {
    const s = session("inercial", { angles: [0, 0, 0], position: [1, 2, 0] });
    // The origin of {R}, written in {I}, is the translation column itself.
    expect(applyTransform(s.current.transform, [0, 0, 0])).toEqual([1, 2, 0]);
  });
});
