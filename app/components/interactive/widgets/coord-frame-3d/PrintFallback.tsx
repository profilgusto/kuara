/**
 * Static SVG stand-in for `coord-frame-3d`, drawn for paper.
 *
 * A WebGL canvas prints as a blank rectangle, and a bitmap poster would be a
 * hand-maintained snapshot that drifts the moment the scene changes. This
 * draws the same frame from the same `DEFAULT_CAMERA` the live scene uses, in
 * vector form — crisp at any zoom, no asset to upload, and it honours the
 * widget's own parameters so each authored instance prints as itself.
 */
import { arrowHead, project, type Camera } from "../../projection";
import type { Vec3 } from "../../props";
import type { CoordFrame3DProps } from "./index";
import {
  AXIS_LENGTH,
  GRID_HALF,
  VIEW_CAMERA,
  axisLabelAnchor,
  clampPoint,
  formatCoords,
  labelAnchor,
  referenceKind,
  rulerTicks,
  showsProjections,
  toDimension,
  visibleAxes,
  type AxisKey,
  type Dimension,
} from "./views";

const VIEW = { width: 800, height: 400 };

/** Just past the arrow tip, clear of the head. */
const LABEL_OFFSET = 0.28;

/**
 * Ink-on-white colours. The screen palette is tuned for a dark surface and
 * washes out on paper, so the hues are kept but darkened.
 */
const INK = {
  x: "#c0392b",
  y: "#1e7d3c",
  z: "#1c6b76",
  grid: "#d2d8d5",
  text: "#2c3331",
  vector: "#8f5c3a",
  point: "#8a7440",
  origin: "#6b7671",
} as const;

/**
 * World point → SVG coordinates for the active view.
 *
 * Threaded through as a prop rather than kept as a module constant: the header
 * switch moves the camera, and a drawing function that closed over one fixed
 * camera would print the 3D shot no matter what the student had on screen.
 */
type To2d = (p: Vec3) => [number, number] | null;

const projector =
  (camera: Camera): To2d =>
  (p: Vec3) =>
    project(p, VIEW, camera);

/** `null` for anything the camera cannot see, which callers must skip. */
function line(to2d: To2d, a: Vec3, b: Vec3) {
  const p1 = to2d(a);
  const p2 = to2d(b);
  return p1 && p2 ? { p1, p2 } : null;
}

function Segment({
  to2d,
  from,
  to,
  color,
  width = 1,
  dashed = false,
  opacity = 1,
}: {
  to2d: To2d;
  from: Vec3;
  to: Vec3;
  color: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
}) {
  const seg = line(to2d, from, to);
  if (!seg) return null;
  return (
    <line
      x1={seg.p1[0]}
      y1={seg.p1[1]}
      x2={seg.p2[0]}
      y2={seg.p2[1]}
      stroke={color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeDasharray={dashed ? "5 4" : undefined}
      strokeLinecap="round"
    />
  );
}

function Axis({
  to2d,
  axis,
  direction,
  color,
  label,
  showLabel,
  dim,
}: {
  to2d: To2d;
  axis: AxisKey;
  direction: Vec3;
  color: string;
  label: string;
  showLabel: boolean;
  dim: Dimension;
}) {
  const origin = to2d([0, 0, 0]);
  const tip = to2d(direction.map((c) => c * AXIS_LENGTH) as Vec3);
  const labelAt = to2d(axisLabelAnchor(axis, dim, LABEL_OFFSET));
  if (!origin || !tip) return null;

  const [c1, c2] = arrowHead(origin, tip);

  return (
    <g>
      <line
        x1={origin[0]}
        y1={origin[1]}
        x2={tip[0]}
        y2={tip[1]}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <polygon
        points={`${tip[0]},${tip[1]} ${c1[0]},${c1[1]} ${c2[0]},${c2[1]}`}
        fill={color}
      />
      {showLabel && labelAt && (
        <text
          x={labelAt[0]}
          y={labelAt[1]}
          fill={color}
          fontSize={22}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function Grid({ to2d }: { to2d: To2d }) {
  const ticks = rulerTicks();

  return (
    <g>
      {ticks.map((t) => (
        <Segment
          key={`x${t}`}
          to2d={to2d}
          from={[t, -GRID_HALF, 0]}
          to={[t, GRID_HALF, 0]}
          color={INK.grid}
        />
      ))}
      {ticks.map((t) => (
        <Segment
          key={`y${t}`}
          to2d={to2d}
          from={[-GRID_HALF, t, 0]}
          to={[GRID_HALF, t, 0]}
          color={INK.grid}
        />
      ))}
    </g>
  );
}

/** The 1D view's ruler: the same graduation as the plane, seen edge-on. */
function Ruler({ to2d }: { to2d: To2d }) {
  const tickHalf = 0.06;
  return (
    <g>
      <Segment
        to2d={to2d}
        from={[-GRID_HALF, 0, 0]}
        to={[GRID_HALF, 0, 0]}
        color={INK.grid}
      />
      {rulerTicks().map((t) => (
        <Segment
          key={t}
          to2d={to2d}
          from={[t, 0, -tickHalf]}
          to={[t, 0, tickHalf]}
          color={INK.grid}
        />
      ))}
    </g>
  );
}

function MarkedPoint({
  to2d,
  position,
  label,
  projections,
  dim,
}: {
  to2d: To2d;
  position: Vec3;
  label: string;
  projections: boolean;
  dim: Dimension;
}) {
  const [px, py, pz] = position;
  const floor: Vec3 = [px, py, 0];
  const at = to2d(position);
  const labelAt = to2d(labelAnchor(position, dim, 0.26));

  return (
    <g>
      <Segment
        to2d={to2d}
        from={[0, 0, 0]}
        to={position}
        color={INK.vector}
        width={1.8}
      />

      {projections && showsProjections(dim) && (
        <>
          {/* Mirrors the live scene: the descent to the floor and the height
              off z exist only in 3D — flat, they would be zero-length. */}
          {dim === "3d" && (
            <Segment
              to2d={to2d}
              from={position}
              to={floor}
              color={INK.origin}
              dashed
              opacity={0.75}
            />
          )}
          <Segment
            to2d={to2d}
            from={floor}
            to={[px, 0, 0]}
            color={INK.origin}
            dashed
            opacity={0.75}
          />
          <Segment
            to2d={to2d}
            from={floor}
            to={[0, py, 0]}
            color={INK.origin}
            dashed
            opacity={0.75}
          />
          {dim === "3d" && (
            <Segment
              to2d={to2d}
              from={position}
              to={[0, 0, pz]}
              color={INK.origin}
              dashed
              opacity={0.75}
            />
          )}
        </>
      )}

      {at && <circle cx={at[0]} cy={at[1]} r={5} fill={INK.point} />}

      {labelAt && (
        <text
          x={labelAt[0]}
          y={labelAt[1]}
          fill={INK.text}
          fontSize={15}
          fontWeight={600}
          textAnchor="middle"
        >
          {label}
          <tspan fontWeight={400} fontSize={12} fill={INK.origin}>
            {` ${formatCoords(position, dim)}`}
          </tspan>
        </text>
      )}
    </g>
  );
}

const AXIS_DIRECTION: Record<AxisKey, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

const AXIS_INK = { x: INK.x, y: INK.y, z: INK.z } as const;

const AXIS_LABEL = { x: "x&#770;", y: "y&#770;", z: "z&#770;" } as const;

const DIMENSION_NAME: Record<Dimension, string> = {
  "1d": "unidimensional",
  "2d": "bidimensional",
  "3d": "tridimensional",
};

export default function CoordFrame3DPrint({
  labels,
  grid,
  frameName,
  point,
  pointLabel,
  projections,
  variant,
}: CoordFrame3DProps) {
  const dim = toDimension(variant);
  const to2d = projector(VIEW_CAMERA[dim]);
  const origin = to2d([0, 0, 0]);

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`Sistema de coordenadas ${DIMENSION_NAME[dim]} ${frameName}`}
    >
      {grid &&
        (referenceKind(dim) === "ruler" ? (
          <Ruler to2d={to2d} />
        ) : (
          <Grid to2d={to2d} />
        ))}

      {visibleAxes(dim).map((axis) => (
        <Axis
          key={axis}
          to2d={to2d}
          axis={axis}
          dim={dim}
          direction={AXIS_DIRECTION[axis]}
          color={AXIS_INK[axis]}
          label={AXIS_LABEL[axis]}
          showLabel={labels}
        />
      ))}

      {origin && (
        <g>
          <circle cx={origin[0]} cy={origin[1]} r={4} fill={INK.origin} />
          {labels && (
            /* Same offset direction as the live scene's screen-space nudge. */
            <text
              x={origin[0] - 16}
              y={origin[1] + 18}
              fill={INK.origin}
              fontSize={22}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              o
            </text>
          )}
        </g>
      )}

      {point && (
        <MarkedPoint
          to2d={to2d}
          position={clampPoint(point, dim)}
          label={pointLabel}
          projections={projections}
          dim={dim}
        />
      )}
    </svg>
  );
}
