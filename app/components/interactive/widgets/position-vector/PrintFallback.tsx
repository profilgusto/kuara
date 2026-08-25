/**
 * Static SVG stand-in for `position-vector`, drawn for paper.
 *
 * A WebGL canvas prints as a blank rectangle, and the sliders have no meaning
 * on paper — so what prints is the widget's authored starting position: the
 * frame, the point, the vector between them, and the coordinate vector written
 * out, since the on-screen readout panel is gone. Same cameras and same
 * geometry module as the live scene, so the drawing follows the widget instead
 * of drifting from it.
 */
import { arrowHead, project, type Camera } from "../../projection";
import type { Vec3 } from "../../props";
import type { PositionVectorProps } from "./index";
import {
  AXIS_LENGTH,
  RANGE,
  VIEW_CAMERA,
  axisLabelAnchor,
  basisExpansion,
  clampPoint,
  clampVector,
  gridTicks,
  isDrawableVector,
  labelAnchor,
  referenceKind,
  showsProjections,
  toDimension,
  vectorComponents,
  visibleAxes,
  type AxisKey,
  type Dimension,
} from "./scene";

const VIEW = { width: 800, height: 430 };

/**
 * Ink-on-white colours: the screen palette is tuned for a dark surface and
 * washes out on paper, so the hues are kept but darkened.
 */
const INK = {
  x: "#c0392b",
  y: "#1e7d3c",
  z: "#1c6b76",
  grid: "#dde2e0",
  text: "#2c3331",
  vector: "#9a6410",
  point: "#8a7440",
  origin: "#6b7671",
} as const;

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

/** An arrow drawn flat: shaft plus a screen-space head, as on the axes. */
function Arrow({
  to2d,
  from,
  to,
  color,
  width,
  head,
}: {
  to2d: To2d;
  from: Vec3;
  to: Vec3;
  color: string;
  width: number;
  head: number;
}) {
  const seg = line(to2d, from, to);
  if (!seg) return null;
  const [c1, c2] = arrowHead(seg.p1, seg.p2, head);
  return (
    <g>
      <line
        x1={seg.p1[0]}
        y1={seg.p1[1]}
        x2={seg.p2[0]}
        y2={seg.p2[1]}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <polygon
        points={`${seg.p2[0]},${seg.p2[1]} ${c1[0]},${c1[1]} ${c2[0]},${c2[1]}`}
        fill={color}
      />
    </g>
  );
}

const AXIS_DIRECTION: Record<AxisKey, Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

const AXIS_INK = { x: INK.x, y: INK.y, z: INK.z } as const;

function BasisAxis({
  to2d,
  axis,
  dim,
  showLabel,
  frameName,
}: {
  to2d: To2d;
  axis: AxisKey;
  dim: Dimension;
  showLabel: boolean;
  frameName: string;
}) {
  const u = AXIS_DIRECTION[axis];
  const tip = u.map((c) => c * AXIS_LENGTH) as Vec3;
  const labelAt = to2d(axisLabelAnchor(axis, dim));
  const color = AXIS_INK[axis];

  return (
    <g>
      <Arrow
        to2d={to2d}
        from={[0, 0, 0]}
        to={tip}
        color={color}
        width={2}
        head={9}
      />
      {showLabel && labelAt && (
        <text
          x={labelAt[0]}
          y={labelAt[1]}
          fill={color}
          fontSize={17}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {`${axis}̂`}
          <tspan fontSize={11} dy={4}>
            {frameName}
          </tspan>
        </text>
      )}
    </g>
  );
}

/** The xy plane's graduation, one square per basis vector. */
function Grid({ to2d }: { to2d: To2d }) {
  const ticks = gridTicks();
  return (
    <g>
      {ticks.map((t) => (
        <Segment
          key={`x${t}`}
          to2d={to2d}
          from={[t, -RANGE, 0]}
          to={[t, RANGE, 0]}
          color={INK.grid}
        />
      ))}
      {ticks.map((t) => (
        <Segment
          key={`y${t}`}
          to2d={to2d}
          from={[-RANGE, t, 0]}
          to={[RANGE, t, 0]}
          color={INK.grid}
        />
      ))}
    </g>
  );
}

/** The 1D view's ruler: the same graduation seen edge-on. */
function Ruler({ to2d }: { to2d: To2d }) {
  const tickHalf = 0.12;
  return (
    <g>
      <Segment
        to2d={to2d}
        from={[-RANGE, 0, 0]}
        to={[RANGE, 0, 0]}
        color={INK.grid}
      />
      {gridTicks().map((t) => (
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
  labels,
  dim,
}: {
  to2d: To2d;
  position: Vec3;
  label: string;
  projections: boolean;
  labels: boolean;
  dim: Dimension;
}) {
  const [px, py, pz] = position;
  const floor: Vec3 = [px, py, 0];
  const at = to2d(position);
  const labelAt = to2d(labelAnchor(position, dim, 0.55));

  return (
    <g>
      {isDrawableVector(position) && (
        <Arrow
          to2d={to2d}
          from={[0, 0, 0]}
          to={position}
          color={INK.vector}
          width={2.4}
          head={13}
        />
      )}

      {projections && showsProjections(dim) && (
        <>
          {/* As in the live scene, the descent to the floor and the height off
              z exist only in 3D — flat, they would be zero-length. */}
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

      {at && <circle cx={at[0]} cy={at[1]} r={5.5} fill={INK.point} />}

      {labels && labelAt && (
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
            {` (${vectorComponents(position, dim).join(", ")})`}
          </tspan>
        </text>
      )}
    </g>
  );
}

/**
 * The readout the panel would have shown, as one line of type: on paper there
 * is no slider to read the current value off, so the vector has to be written.
 */
function Readout({
  position,
  dim,
  frameName,
  pointLabel,
}: {
  position: Vec3;
  dim: Dimension;
  frameName: string;
  pointLabel: string;
}) {
  // The basis vectors are written bare here, unlike on screen: the frame is
  // already named by the superscript on p, and SVG has no real subscript — a
  // second baseline shift per term would only produce "x̂I".
  const terms = basisExpansion(position, dim);
  const tuple = `(${vectorComponents(position, dim).join(", ")})`;

  return (
    <text x={16} y={VIEW.height - 14} fill={INK.text} fontSize={16}>
      <tspan fontSize={11} dy={-7}>
        {frameName}
      </tspan>
      <tspan fontWeight={700} dy={7}>
        p
      </tspan>
      <tspan fontSize={11} dy={5}>
        {pointLabel}
      </tspan>
      <tspan dy={-5}>{` = ${terms.join(" + ")} = ${tuple}`}</tspan>
    </text>
  );
}

const DIMENSION_NAME: Record<Dimension, string> = {
  "1d": "unidimensional",
  "2d": "bidimensional",
  "3d": "tridimensional",
};

export default function PositionVectorPrint({
  point,
  pointLabel,
  frameName,
  labels,
  grid,
  projections,
  variant,
}: PositionVectorProps) {
  const dim = toDimension(variant);
  const to2d = projector(VIEW_CAMERA[dim]);
  const origin = to2d([0, 0, 0]);
  const position = clampPoint(clampVector(point ?? [0, 0, 0]), dim);

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`Vetor de posição ${DIMENSION_NAME[dim]} do ponto ${pointLabel} no frame ${frameName}`}
    >
      {grid &&
        (referenceKind(dim) === "ruler" ? (
          <Ruler to2d={to2d} />
        ) : (
          <Grid to2d={to2d} />
        ))}

      {visibleAxes(dim).map((axis) => (
        <BasisAxis
          key={axis}
          to2d={to2d}
          axis={axis}
          dim={dim}
          showLabel={labels}
          frameName={frameName}
        />
      ))}

      {origin && (
        <g>
          <circle cx={origin[0]} cy={origin[1]} r={4} fill={INK.origin} />
          {labels && (
            /* Same offset direction as the live scene's screen-space nudge. */
            <text
              x={origin[0] - 15}
              y={origin[1] + 17}
              fill={INK.origin}
              fontSize={18}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              o
            </text>
          )}
        </g>
      )}

      <MarkedPoint
        to2d={to2d}
        position={position}
        label={pointLabel}
        projections={projections}
        labels={labels}
        dim={dim}
      />

      <Readout
        position={position}
        dim={dim}
        frameName={frameName}
        pointLabel={pointLabel}
      />
    </svg>
  );
}
