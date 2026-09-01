/**
 * components/interactive/previews.ts
 *
 * Each widget's static vector drawing, keyed by id.
 *
 * These are plain SVG components — no three.js, no `next/dynamic`, no Tailwind
 * — which is what lets two very different consumers share them:
 *   - `registry.ts`, as the widget's print fallback on the public site;
 *   - the Payload admin's library view, as a thumbnail. The admin layout loads
 *     only Payload's own CSS, so a Tailwind-styled preview would render
 *     unstyled there; an SVG does not care.
 */
import type { ComponentType } from "react";
import CoordFrame3DPrint from "./widgets/coord-frame-3d/PrintFallback";
import PositionVectorPrint from "./widgets/position-vector/PrintFallback";
import RotationMatrixPrint from "./widgets/rotation-matrix/PrintFallback";
import HomogeneousTransformPrint from "./widgets/homogeneous-transform/PrintFallback";
import DifferentialDrivePrint from "./widgets/differential-drive/PrintFallback";
import DifferentialKinematicsPrint from "./widgets/differential-kinematics/PrintFallback";
import InertialOdometryPrint from "./widgets/inertial-odometry/PrintFallback";
import FrameMappingPrint from "./widgets/frame-mapping/PrintFallback";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const previews: Record<string, ComponentType<any>> = {
  "coord-frame-3d": CoordFrame3DPrint,
  "position-vector": PositionVectorPrint,
  "rotation-matrix": RotationMatrixPrint,
  "homogeneous-transform": HomogeneousTransformPrint,
  "differential-drive": DifferentialDrivePrint,
  "differential-kinematics": DifferentialKinematicsPrint,
  "inertial-odometry": InertialOdometryPrint,
  "frame-mapping": FrameMappingPrint,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPreview(id: string): ComponentType<any> | undefined {
  return previews[id];
}
