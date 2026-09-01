/**
 * This widget's control state: the shared orientation session, plus what only
 * this figure has — a dimension, and the block of the matrix its panel prints.
 *
 * The session machinery itself lives in `components/interactive/orientation-session.ts`,
 * shared with `homogeneous-transform`, because the two widgets offer the same
 * gesture and its browser-event handling is the part that must not diverge.
 * What stays here is the reading of that state through this widget's 1D/2D/3D
 * switch. React only — `index.tsx` pulls in three.js, which no unit test can
 * mount, and `session.test.ts` drives all of this without it.
 */
import { useMemo } from "react";
import type { Vec3 } from "../../props";
import {
  useOrientationSession,
  type OrientationSession,
} from "../../orientation-session";
import {
  anglesFor,
  formatEntry,
  matrixToQuaternion,
  submatrix,
  toDimension,
  turnAxes,
  type Dimension,
  type Quaternion,
} from "./rotation";

export interface RotationSession extends OrientationSession {
  /** Which view is on the stage: the line, the plane or space. */
  dim: Dimension;
  quaternion: Quaternion;
  /** The trail, ready for the scene. */
  ghostQuaternions: Quaternion[];
  rows: string[][];
}

export function useRotationSession({
  angles,
  mode,
  variant,
  decimals,
}: {
  angles: Vec3 | null;
  mode: string;
  variant?: string;
  decimals: number;
}): RotationSession {
  const dim = toDimension(variant);

  const session = useOrientationSession({
    angles,
    mode,
    /*
      The own-axis session belongs to the 3D view alone.

      It exists because an axis turned about is gone by the next turn — a
      problem a plane does not have, since its one axis is the same before and
      after every rotation, and a line has no axis at all. In those views the
      absolute angles (one, really) say everything there is to say, and a
      slider that sprang back would be ceremony over nothing.
    */
    allowIntrinsic: turnAxes(dim).length > 1,
    // Only the turns this view has an axis for: a 2D block authored with an x
    // angle must not open on a frame tipped out of its own page.
    constrain: (a) => anglesFor(dim, a),
  });

  const { matrix, ghosts } = session;
  const quaternion = useMemo(() => matrixToQuaternion(matrix), [matrix]);
  const ghostQuaternions = useMemo(
    () => ghosts.map(matrixToQuaternion),
    [ghosts],
  );

  return {
    ...session,
    dim,
    quaternion,
    ghostQuaternions,
    // Only the block this view's frames actually have: [1] on a line, the
    // 2×2 of the section on a plane.
    rows: submatrix(matrix, dim).map((row) =>
      row.map((entry) => formatEntry(entry, decimals)),
    ),
  };
}
