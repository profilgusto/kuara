/**
 * session.test.ts — the widget's control state, driven the way a student
 * drives it.
 *
 * These are the failures that look like physics bugs but are not: a released
 * drag counted twice, a history that outlives the mode that built it, a
 * slider that keeps a turn it already spent. The hook holds no three.js, so
 * all of it runs in Phase 1.
 */
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { Vec3 } from "../../props";
import { useRotationSession } from "./session";
import { column, composeIntrinsic, elementary, type Mat3 } from "./rotation";

const session = (
  angles: Vec3 | null = null,
  mode = "proprio",
  variant = "3d",
) =>
  renderHook(() => useRotationSession({ angles, mode, variant, decimals: 2 }))
    .result;

const close = (m: Mat3, want: Mat3) =>
  m.forEach((row, i) =>
    row.forEach((entry, j) => expect(entry).toBeCloseTo(want[i][j], 12)),
  );

/** The x slider is index 0 — the order `ANGLE_AXES` fixes. */
const X = 0;
const Y = 1;

/**
 * One drag on a slider, as the DOM actually delivers it.
 *
 * `press` is `pointerdown`/`keydown`, `drag` the `input` events, `release`
 * whichever of `pointerup`, `lostpointercapture`, `keyup` and `blur` the
 * browser chose to send — and `echo` the extra `change` Firefox fires once the
 * drag is over, which React reports through the same `onChange`.
 */
const drag = (s: ReturnType<typeof session>, axis: number, deg: number) => {
  act(() => s.current.beginGesture(axis));
  act(() => s.current.setAngle(axis, deg));
  act(() => s.current.commitLive(axis));
};

describe("a released drag", () => {
  it("lands once when the browser echoes the value after the release", () => {
    // The Firefox bug, replayed. React's onChange is wired to the native
    // `change` event as well as to `input`, and Firefox fires `change` for a
    // range at the end of the drag — after `pointerup`. That echo carries the
    // value just committed; taken as a new turn it re-arms the drag behind the
    // commit's back, and 10° turns the frame 20° with the ghost left at 10.
    const s = session();
    act(() => s.current.beginGesture(X));
    act(() => s.current.setAngle(X, 10));
    act(() => s.current.commitLive(X));
    act(() => s.current.setAngle(X, 10));

    expect(s.current.steps).toEqual([{ axis: "x", deg: 10 }]);
    expect(s.current.live).toBeNull();
    expect(s.current.deg).toEqual([0, 0, 0]);
    close(s.current.matrix, elementary("x", 10));
  });

  it("lands once when the echo arrives between two release events", () => {
    // `pointerup`, then the echo, then `lostpointercapture`: the second
    // release must not find a re-armed drag to commit.
    const s = session();
    act(() => s.current.beginGesture(X));
    act(() => s.current.setAngle(X, 10));
    act(() => s.current.commitLive(X));
    act(() => s.current.setAngle(X, 10));
    act(() => s.current.commitLive(X));

    expect(s.current.steps).toEqual([{ axis: "x", deg: 10 }]);
    close(s.current.matrix, elementary("x", 10));
  });

  it("lands once, however many events the release fires", () => {
    // `pointerup` and `lostpointercapture` arrive in the same task, so React
    // batches both handlers into a single render and both read the same state.
    const s = session();
    act(() => s.current.beginGesture(X));
    act(() => s.current.setAngle(X, 10));
    act(() => {
      s.current.commitLive(X);
      s.current.commitLive(X);
      s.current.commitLive(X);
    });

    expect(s.current.steps).toEqual([{ axis: "x", deg: 10 }]);
    expect(s.current.ghostQuaternions).toHaveLength(1);
    close(s.current.matrix, elementary("x", 10));
  });

  it("turns the frame exactly as far as the slider says, over and over", () => {
    // Ten drags of 10° about x are 100° about x — not 200°, and not a frame
    // that drifts a little further from the sliders on every release.
    const s = session();
    for (let i = 0; i < 10; i++) drag(s, X, 10);
    expect(s.current.steps).toHaveLength(10);
    close(s.current.matrix, elementary("x", 100));
  });

  it("leaves the frame exactly where the drag left it", () => {
    // Committing must not move anything: the student let go of a frame that
    // was already there.
    const s = session();
    act(() => s.current.beginGesture(X));
    act(() => s.current.setAngle(X, 10));
    const during = s.current.matrix;
    act(() => s.current.commitLive(X));
    close(s.current.matrix, during);
  });

  it("springs the slider back to zero and keeps the orientation", () => {
    const s = session();
    act(() => s.current.beginGesture(Y));
    act(() => s.current.setAngle(Y, 25));
    expect(s.current.deg).toEqual([0, 25, 0]);
    act(() => s.current.commitLive(Y));
    expect(s.current.deg).toEqual([0, 0, 0]);
    expect(s.current.live).toBeNull();
    close(s.current.matrix, elementary("y", 25));
  });

  it("commits nothing when the drag came back to zero", () => {
    const s = session();
    act(() => s.current.beginGesture(X));
    act(() => s.current.setAngle(X, 15));
    act(() => s.current.setAngle(X, 0));
    act(() => s.current.commitLive(X));
    expect(s.current.steps).toEqual([]);
    expect(s.current.ghostQuaternions).toEqual([]);
    expect(s.current.aligned).toBe(true);
  });

  it("lets the next slider move on the first try", () => {
    // Pressing a second slider blurs the first, and that blur is dispatched
    // *after* the press — so an unowned release ended the gesture the press
    // had just opened. The student dragged a slider that would not move, let
    // go, and found it working on the second attempt.
    const s = session();
    drag(s, X, 10);

    act(() => s.current.beginGesture(Y)); // press on the y slider…
    act(() => s.current.commitLive(X)); // …blurs the x slider it left
    act(() => s.current.setAngle(Y, 20));

    expect(s.current.deg).toEqual([0, 20, 0]); // the thumb moves at once
    act(() => s.current.commitLive(Y));
    expect(s.current.steps).toEqual([
      { axis: "x", deg: 10 },
      { axis: "y", deg: 20 },
    ]);
  });

  it("ignores a value from a slider that does not hold the gesture", () => {
    // The same blur, and the echo that can follow it: neither may write the
    // slider the student left into the turn they are making now.
    const s = session();
    act(() => s.current.beginGesture(Y));
    act(() => s.current.setAngle(X, 90));
    expect(s.current.live).toBeNull();
    act(() => s.current.setAngle(Y, 20));
    expect(s.current.deg).toEqual([0, 20, 0]);
  });

  it("ignores a value that arrives with no press behind it", () => {
    // Nothing legitimate reaches the slider this way, and the stray `change`
    // after a release does.
    const s = session();
    act(() => s.current.setAngle(X, 45));
    expect(s.current.live).toBeNull();
    expect(s.current.aligned).toBe(true);
  });

  it("banks a drag whose release never came, when the next one starts", () => {
    // A pointer lost outside the window fires nothing the slider hears. The
    // turn is on screen, so it must be the turn that is recorded.
    const s = session();
    act(() => s.current.beginGesture(X));
    act(() => s.current.setAngle(X, 30));
    act(() => s.current.beginGesture(Y));
    act(() => s.current.setAngle(Y, 15));
    act(() => s.current.commitLive(Y));

    expect(s.current.steps).toEqual([
      { axis: "x", deg: 30 },
      { axis: "y", deg: 15 },
    ]);
  });
});

describe("a sequence of drags", () => {
  it("turns each one about {R}'s axis as it stands", () => {
    // x, then y, then x again — the gesture the old three-angle model could
    // not express. The last step's axis must be {R}'s current x̂, not the
    // inertial one.
    const s = session();
    drag(s, X, 30);
    drag(s, Y, 40);

    const beforeThird = s.current.matrix;
    const ownX = column(beforeThird, 0);
    expect(Math.abs(ownX[0] - 1)).toBeGreaterThan(0.1); // no longer inertial x

    drag(s, X, 20);

    close(
      s.current.matrix,
      composeIntrinsic([
        { axis: "x", deg: 30 },
        { axis: "y", deg: 40 },
        { axis: "x", deg: 20 },
      ]),
    );
    // A rotation fixes its own axis: {R}'s x̂ is where it was before the turn.
    column(s.current.matrix, 0).forEach((c, i) =>
      expect(c).toBeCloseTo(ownX[i], 12),
    );
    expect(s.current.ghostQuaternions).toHaveLength(3);
  });

  it("opens on the orientation the author asked for", () => {
    const s = session([0, 0, 30], "proprio");
    close(s.current.matrix, elementary("z", 30));
    // …recorded as the step it is, so the student can build on it.
    expect(s.current.steps).toEqual([{ axis: "z", deg: 30 }]);
  });
});

describe("clearing the session", () => {
  it("drops the ghosts when the axes are aligned", () => {
    const s = session();
    drag(s, X, 30);
    expect(s.current.ghostQuaternions).toHaveLength(1);

    act(() => s.current.align());
    expect(s.current.steps).toEqual([]);
    expect(s.current.ghostQuaternions).toEqual([]);
    expect(s.current.aligned).toBe(true);
  });

  it("drops them on the way back to the inertial axes, too", () => {
    const s = session();
    drag(s, X, 30);

    act(() => s.current.selectMode("inercial"));
    expect(s.current.ghostQuaternions).toEqual([]);
    expect(s.current.intrinsic).toBe(false);
  });

  it("gives the inertial sliders back the angles they were left on", () => {
    // The two modes keep separate state: a trip through a session must not
    // cost the student the three angles they had dialled.
    const s = session([20, 0, 0], "inercial");
    act(() => s.current.setAngle(Y, 45));
    expect(s.current.deg).toEqual([20, 45, 0]);

    act(() => s.current.selectMode("proprio"));
    expect(s.current.deg).toEqual([0, 0, 0]); // a session starts clean
    drag(s, X, 15);

    act(() => s.current.selectMode("inercial"));
    expect(s.current.deg).toEqual([20, 45, 0]);
  });

  it("starts a session from the aligned frame, whatever came before", () => {
    const s = session([20, 30, 40], "inercial");
    act(() => s.current.selectMode("proprio"));
    expect(s.current.steps).toEqual([]);
    expect(s.current.aligned).toBe(true);
  });

  it("ignores a click on the mode already selected", () => {
    const s = session();
    drag(s, X, 30);
    act(() => s.current.selectMode("proprio"));
    expect(s.current.steps).toHaveLength(1);
  });
});

describe("the flat views", () => {
  it("drops an authored turn whose axis is not on the page", () => {
    // A 2D block authored with an x angle must open flat: the axis of that
    // turn does not exist in the plane.
    const s = session([90, 0, 30], "inercial", "2d");
    close(s.current.matrix, elementary("z", 30));
  });

  it("prints the block the view's frames actually have", () => {
    expect(session([0, 0, 30], "inercial", "1d").current.rows).toEqual([
      ["1.00"],
    ]);
    expect(session([0, 0, 0], "inercial", "2d").current.rows).toEqual([
      ["1.00", "0.00"],
      ["0.00", "1.00"],
    ]);
    expect(session([0, 0, 0], "inercial", "3d").current.rows).toHaveLength(3);
  });

  it("keeps the line aligned, whatever the sliders are asked for", () => {
    // There are no sliders in 1D; if anything ever reaches `setAngle` there,
    // the frame must still be the identity.
    const s = session(null, "inercial", "1d");
    act(() => s.current.setAngle(X, 90));
    close(s.current.matrix, [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(s.current.aligned).toBe(true);
  });

  it("keeps the plane out of a session, even switched to own axes", () => {
    // One axis cannot move: turning about it leaves it where it was, so the
    // sequence would only be ceremony. The plane keeps absolute angles.
    const s = session(null, "proprio", "2d");
    expect(s.current.intrinsic).toBe(false);
    act(() => s.current.setAngle(2, 40));
    expect(s.current.deg[2]).toBe(40);
    expect(s.current.ghostQuaternions).toEqual([]);
    close(s.current.matrix, elementary("z", 40));
  });

  it("still turns the plane by the angle it is given", () => {
    const s = session(null, "inercial", "2d");
    act(() => s.current.setAngle(2, -75));
    close(s.current.matrix, elementary("z", -75));
    expect(s.current.aligned).toBe(false);
    act(() => s.current.align());
    expect(s.current.aligned).toBe(true);
  });
});
