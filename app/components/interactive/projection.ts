/**
 * Perspective projection shared by the widgets’ static print fallbacks.
 *
 * A printed page gets no WebGL, so the block falls back to an SVG drawing of
 * the same scene. Rather than hand-placing that drawing's coordinates — which
 * would silently drift the moment the camera moves — this module reproduces
 * three.js's look-at + perspective maths, and both the `<Canvas>` and the SVG
 * read the camera from `DEFAULT_CAMERA`. Change the camera once and the paper
 * version follows.
 *
 * Pure and browser-free, so the geometry is verifiable in Phase 1.
 */
import type { Vec3 } from "./props";

export interface Camera {
  position: Vec3;
  target: Vec3;
  /** Which way is up. Robotics convention here: +z. */
  up: Vec3;
  /** Vertical field of view, in degrees — same convention as three.js. */
  fov: number;
}

export const DEFAULT_CAMERA: Camera = {
  position: [3.4, -3.9, 2.8],
  // Aimed a little above the origin: the triedro sits in the grid's upper
  // half, so centring on the origin leaves dead space below it and crowds the
  // ẑ label against the top edge.
  target: [0, 0, 0.3],
  up: [0, 0, 1],
  fov: 40,
};

type V = Vec3;

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export function normalize(v: V): V {
  const len = Math.hypot(v[0], v[1], v[2]);
  // A zero-length vector has no direction; returning it unchanged keeps the
  // caller free of NaN, which would poison every downstream coordinate.
  if (len === 0) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Project a world point onto SVG user-space coordinates.
 *
 * Returns `null` for anything at or behind the camera plane, which the caller
 * must treat as "do not draw" rather than as a coordinate.
 */
export function project(
  point: V,
  viewport: Viewport,
  camera: Camera = DEFAULT_CAMERA,
): [number, number] | null {
  const forward = normalize(sub(camera.target, camera.position));
  const right = normalize(cross(forward, camera.up));
  const up = cross(right, forward);

  const rel = sub(point, camera.position);
  const depth = dot(rel, forward);
  if (depth <= 1e-6) return null;

  const x = dot(rel, right);
  const y = dot(rel, up);

  const aspect = viewport.width / viewport.height;
  const focal = 1 / Math.tan((camera.fov * Math.PI) / 360);

  const ndcX = (focal * x) / (depth * aspect);
  const ndcY = (focal * y) / depth;

  // NDC is y-up and centred; SVG user space is y-down with its origin at the
  // top-left corner.
  return [
    ((ndcX + 1) / 2) * viewport.width,
    ((1 - ndcY) / 2) * viewport.height,
  ];
}

/**
 * The two base corners of a 2D arrowhead pointing from `from` towards `to`.
 * Working in screen space keeps the head a constant size on paper regardless
 * of how foreshortened the axis is.
 */
export function arrowHead(
  from: [number, number],
  to: [number, number],
  size = 11,
): [[number, number], [number, number]] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [to, to];

  const ux = dx / len;
  const uy = dy / len;
  // Step back along the shaft, then out along the perpendicular.
  const bx = to[0] - ux * size;
  const by = to[1] - uy * size;
  const half = size * 0.42;

  return [
    [bx - uy * half, by + ux * half],
    [bx + uy * half, by - ux * half],
  ];
}
