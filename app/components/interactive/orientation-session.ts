/**
 * The control state behind an own-axis rotation session, shared by every
 * widget whose frame can be turned.
 *
 * Two widgets now offer the same gesture — hold a slider, watch {R} turn about
 * its *current* axis, let go and leave the step behind as a ghost — and the
 * part of it that is easy to get wrong is not the algebra. It is the state
 * machine around a browser's release events, which cost two rounds of bug
 * reports to get right: a drag committed twice because `pointerup` and
 * `lostpointercapture` share a render, a value echoed back by the native
 * `change` Firefox fires after the drag, a blur from the slider the student
 * just left ending the gesture the next one had only begun. Fixed once, here,
 * rather than fixed once and then diverging quietly.
 *
 * React and the shared algebra only — no three.js — so `renderHook` can drive
 * all of it in Phase 1.
 */
import { useRef, useState } from "react";
import type { Vec3 } from "./props";
import {
  ALIGNED_ANGLES,
  ANGLE_AXES,
  clampAngle,
  clampAngles,
  commitStep,
  composeIntrinsic,
  intrinsicTrail,
  isAligned,
  rotationMatrix,
  sliderAngles,
  stepsFromAngles,
  toRotationMode,
  type IntrinsicStep,
  type Mat3,
  type RotationMode,
} from "./rotations";

export interface OrientationSession {
  /** Which axes the sliders turn about. */
  mode: RotationMode;
  /** True while those are {R}'s own axes — the sequence-building mode. */
  intrinsic: boolean;
  /** What the three angle sliders read right now. */
  deg: Vec3;
  /** ᴵR_R as it stands, live drag included. */
  matrix: Mat3;
  /** Where {R} has been this session, oldest first. Empty outside one. */
  ghosts: Mat3[];
  /** The released steps, for a formula that spells the product out. */
  steps: IntrinsicStep[];
  /** The drag in flight, if any. */
  live: IntrinsicStep | null;
  /** The frames lie on each other and no step is recorded. */
  aligned: boolean;
  setAngle: (index: number, value: number) => void;
  /** A press on slider `index`: opens the gesture that becomes a step. */
  beginGesture: (index: number) => void;
  /** A release from slider `index`: spends the gesture, if it owns it. */
  commitLive: (index: number) => void;
  selectMode: (next: RotationMode) => void;
  /** Back to the frames aligned, and to an empty history. */
  align: () => void;
  /** Back to the authored orientation, as the widget first drew it. */
  reset: () => void;
}

export function useOrientationSession({
  angles,
  mode,
  allowIntrinsic = true,
  constrain,
}: {
  angles: Vec3 | null;
  mode: string;
  /**
   * Whether the own-axis session applies at all. A view with one axis of
   * rotation, or none, has no sequence to build: the axis it turns about is
   * the same before and after every turn.
   */
  allowIntrinsic?: boolean;
  /** The caller's honesty filter — e.g. a flat view dropping the turns it has no axis for. */
  constrain?: (angles: Vec3) => Vec3;
}): OrientationSession {
  const narrow = constrain ?? ((a: Vec3) => a);

  // The authored values are only a starting point; from then on the controls
  // own them. Clamped on the way in, because `vec3` will happily parse a
  // "400,0,0" that no slider could ever bring back.
  const authored = narrow(clampAngles(angles ?? [0, 0, 0]));
  const authoredMode = toRotationMode(mode);

  const [rotation, setRotation] = useState<RotationMode>(authoredMode);

  /*
    The two modes keep separate state, because they are not two readings of
    one thing any more.

    About the inertial axes, the three angles *are* the orientation: each
    slider owns a fixed axis that never moves, so the student can hold them
    anywhere and re-reach for any of them.

    About {R}'s own axes they cannot be. An axis the student turns about is
    gone the moment they turn about the next one, so what has to be remembered
    is the *sequence*, and each slider is a gesture that spends itself: it
    turns the frame from wherever it now stands and springs back to zero,
    leaving the step behind it. `live` is only what is under the finger.

    Each mode holding its own state also means flipping the switch and back
    finds the inertial angles where they were left.
  */
  const [inertialDeg, setInertialDeg] = useState<Vec3>(authored);
  const [steps, setSteps] = useState<IntrinsicStep[]>(() =>
    authoredMode === "proprio" ? stepsFromAngles(authored) : [],
  );
  const [live, setLive] = useState<IntrinsicStep | null>(null);

  /*
    One gesture, one step — enforced by identity rather than by choreography.

    A slider release is not a single event, and browsers do not agree on which
    ones it is. `pointerup` and `lostpointercapture` arrive back to back in the
    same task, so React batches both handlers into one render and both read the
    same `live`. Worse, React's `onChange` is wired to the native `change`
    event as well as to `input`, and Firefox fires `change` for a range at the
    *end* of the drag — after the release. That echo carries the value that was
    just committed, so it re-arms the drag behind the commit's back: the step is
    in the sequence, `live` holds it again, and the frame turns 10° twice while
    the ghost sits honestly at 10.

    So the widget stops guessing. Every press starts a gesture and takes a
    number; the step it produces is stamped with that number; and a gesture can
    be spent exactly once. Late events — a second release, an echoing change —
    carry a number that has already been settled, and are ignored. Which events
    a browser fires, and in what order, stops mattering.
  */
  const gesture = useRef(0);
  const settled = useRef(0);
  const pending = useRef<IntrinsicStep | null>(null);

  /*
    And a gesture belongs to the slider that started it.

    Pressing a second slider blurs the first, and the blur is dispatched after
    the press — so an unowned release would end the gesture the press had just
    opened, one event too early. The student would drag a slider that refuses
    to move, let go, and find it working on the second try. Every press and
    release therefore says which slider it came from, and one slider's events
    cannot spend another's turn.
  */
  const owner = useRef<number | null>(null);

  /** True while the press that started a gesture has not been spent. */
  const inGesture = () => gesture.current !== settled.current;

  const intrinsic = rotation === "proprio" && allowIntrinsic;

  // What the sliders read: the three fixed angles, or the single drag in
  // flight with the other two resting at zero.
  const deg: Vec3 = intrinsic ? sliderAngles(live) : inertialDeg;

  const matrix = intrinsic
    ? composeIntrinsic(live && live.deg !== 0 ? [...steps, live] : steps)
    : rotationMatrix(narrow(inertialDeg), rotation);

  const ghosts = intrinsic ? intrinsicTrail(steps) : [];

  const aligned = intrinsic
    ? steps.length === 0 && !live?.deg
    : isAligned(narrow(inertialDeg));

  /**
   * Spend the open gesture, whoever owns it: its turn becomes a step, the
   * slider goes home to zero and the frame keeps the orientation it reached.
   *
   * Committing must not move anything — the student let go of a frame that was
   * already there — and a drag that ended back at zero leaves no step and no
   * ghost, because the frame never moved.
   */
  const bankGesture = () => {
    if (!inGesture()) return;
    settled.current = gesture.current;
    owner.current = null;
    const drag = pending.current;
    pending.current = null;
    setLive(null);
    if (drag) setSteps((prev) => commitStep(prev, drag));
  };

  /**
   * A finger, or a key, goes down on a slider: a new gesture opens.
   *
   * If the last one never got its release — a pointer lost outside the window,
   * a slider that never fired `pointerup` — its turn is banked here rather
   * than dropped, so the step the student can plainly see on screen is the
   * step that ends up in the sequence.
   */
  const beginGesture = (index: number) => {
    bankGesture();
    gesture.current += 1;
    owner.current = index;
  };

  /** Throw the gesture away instead of banking it: the state is being reset. */
  const discardGesture = () => {
    settled.current = gesture.current;
    owner.current = null;
    pending.current = null;
    setLive(null);
  };

  const align = () => {
    discardGesture();
    setSteps([]);
    setInertialDeg([...ALIGNED_ANGLES] as Vec3);
  };

  /** Back to the orientation the author wrote, session and all. */
  const reset = () => {
    discardGesture();
    setSteps(rotation === "proprio" ? stepsFromAngles(authored) : []);
    setInertialDeg(authored);
  };

  /** Leaving a session drops its history; the inertial angles survive it. */
  const selectMode = (next: RotationMode) => {
    if (next === rotation) return;
    discardGesture();
    setSteps([]);
    setRotation(next);
  };

  const setAngle = (index: number, value: number) => {
    const clamped = clampAngle(value);
    if (intrinsic) {
      // Outside this slider's own live gesture the value is an echo of one
      // already spent — the `change` Firefox fires after the release — and
      // acting on it would put the committed turn back under the finger, on
      // top of itself, or write one slider's angle into another's turn.
      if (!inGesture() || owner.current !== index) return;
      pending.current = { axis: ANGLE_AXES[index], deg: clamped };
      setLive(pending.current);
      return;
    }
    setInertialDeg((prev) => {
      const next: Vec3 = [...prev];
      next[index] = clamped;
      return next;
    });
  };

  const commitLive = (index: number) => {
    // A release from a slider that does not hold the gesture is the blur of
    // the one the student just left, arriving after the next press.
    if (owner.current !== index) return;
    bankGesture();
  };

  return {
    mode: rotation,
    intrinsic,
    deg,
    matrix,
    ghosts,
    steps,
    live,
    aligned,
    setAngle,
    beginGesture,
    commitLive,
    selectMode,
    align,
    reset,
  };
}
