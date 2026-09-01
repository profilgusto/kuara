/**
 * What is particular to the `differential-kinematics` widget's staging.
 *
 * The model it drives — the relation itself, the robot's outline, the
 * integrator — is shared with `inertial-odometry` and lives in
 * `../../differential`. What is left here is the framing: how much floor this
 * block shows, how wide it draws the yaw arc, and when the centre of rotation
 * is close enough to be worth marking. Re-exported alongside the shared names
 * so the component and the print fallback keep one import between them.
 */
import { VELOCITY_SECONDS, clamp, type RobotParams } from "../../differential";

export * from "../../differential";

/**
 * Half the width of the world the camera shows, in metres, as a multiple of
 * the track. The robot is meant to read as a robot in a room, not as a
 * diagram filling the frame.
 */
export const VIEW_HALF_EXTENT_IN_TRACKS = 2;

export function viewHalfExtent({ d }: RobotParams): number {
  return VIEW_HALF_EXTENT_IN_TRACKS * d;
}

/**
 * Only draw the ICR when it is close enough to be on the stage. Further out
 * the marker is off-screen anyway, and the arc through the robot is
 * indistinguishable from a straight line.
 */
export function icrIsVisible(
  distance: number | null,
  halfExtent: number,
): boolean {
  return distance !== null && Math.abs(distance) <= 2.5 * halfExtent;
}

/** The widest the yaw arc is drawn, so it cannot close on itself. */
export const YAW_ARC_MAX_SWEEP = 2.4;

/**
 * The yaw arc spans the angle the robot turns in the same second — clamped,
 * because a sweep past a full turn would draw a circle that reads as no
 * rotation at all.
 */
export function yawArcSweep(omega: number): number {
  return clamp(omega * VELOCITY_SECONDS, YAW_ARC_MAX_SWEEP);
}
