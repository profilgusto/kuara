/**
 * This widget's control state: an orientation session, plus the half of a pose
 * that a rotation widget does not have — where {R} stands.
 *
 * The turning itself is the shared machinery in
 * `components/interactive/orientation-session.ts`, the same code
 * `rotation-matrix` teaches the own-axis sequence with, because ᴵR_R here *is*
 * the ᴵR_R there. What this module adds is the translation, the assembled
 * ᴵT_R, and the difference between putting the axes back and putting the whole
 * pose back.
 *
 * React only, no three.js, so `session.test.ts` can drive every control.
 */
import { useMemo, useState } from "react";
import type { Vec3 } from "../../props";
import {
  useOrientationSession,
  type OrientationSession,
} from "../../orientation-session";
import {
  clampAngles,
  clampCoord,
  clampPosition,
  formatMatrix4,
  homogeneous,
  matrixToQuaternion,
  stepsFromAngles,
  transformQuaternion,
  type Mat4,
  type Quaternion,
} from "./transform";

export interface TransformSession extends OrientationSession {
  /** ᴵp_R: where {R}'s origin sits, in basis vectors. */
  pos: Vec3;
  /** ᴵT_R, rotation block and translation column assembled. */
  transform: Mat4;
  quaternion: Quaternion;
  /** The orientations this session has passed through, ready for the scene. */
  ghostQuaternions: Quaternion[];
  rows: string[][];
  /** True when {R} sits on the pose the author wrote. */
  atInitialPose: boolean;
  setCoord: (index: number, value: number) => void;
  /** Back to the authored pose: orientation *and* position. */
  resetPose: () => void;
}

export function useTransformSession({
  angles,
  position,
  mode,
  decimals,
}: {
  angles: Vec3 | null;
  position: Vec3 | null;
  mode: string;
  decimals: number;
}): TransformSession {
  const authoredAngles = clampAngles(angles ?? [0, 0, 0]);
  const authoredPos = clampPosition(position ?? [0, 0, 0]);

  const session = useOrientationSession({ angles, mode });
  const [pos, setPos] = useState<Vec3>(authoredPos);

  const { matrix, ghosts } = session;
  const transform = useMemo(() => homogeneous(matrix, pos), [matrix, pos]);
  const quaternion = useMemo(() => transformQuaternion(transform), [transform]);
  const ghostQuaternions = useMemo(
    () => ghosts.map(matrixToQuaternion),
    [ghosts],
  );

  const setCoord = (index: number, value: number) =>
    setPos((prev) => {
      const next: Vec3 = [...prev];
      next[index] = clampCoord(value);
      return next;
    });

  /**
   * Put the pose back where the author left it — both halves of it.
   *
   * Distinct from aligning the axes on purpose: aligning answers "which way is
   * {R} facing", and leaves the student's translation alone so they can watch
   * the last column stay put while the block on the left goes to the identity.
   * This one answers "let me start over", and a student who has driven the
   * frame somewhere unreadable needs that to be one button, not six sliders
   * dragged back by eye.
   */
  const resetPose = () => {
    session.reset();
    setPos(authoredPos);
  };

  /*
    Whether the frame is already back where it started, which is what greys the
    button out. In a session the state is the sequence, not the angles, so the
    comparison is against the steps the authored orientation is made of — the
    very ones `reset` puts back.
  */
  const sameOrientation = session.intrinsic
    ? !session.live?.deg &&
      sameSteps(session.steps, stepsFromAngles(authoredAngles))
    : session.deg.every((d, i) => d === authoredAngles[i]);
  const atInitialPose =
    sameOrientation && pos.every((c, i) => c === authoredPos[i]);

  return {
    ...session,
    pos,
    transform,
    quaternion,
    ghostQuaternions,
    rows: formatMatrix4(transform, decimals),
    atInitialPose,
    setCoord,
    resetPose,
  };
}

const sameSteps = (
  a: readonly { axis: string; deg: number }[],
  b: readonly { axis: string; deg: number }[],
) =>
  a.length === b.length &&
  a.every((s, i) => s.axis === b[i].axis && s.deg === b[i].deg);
