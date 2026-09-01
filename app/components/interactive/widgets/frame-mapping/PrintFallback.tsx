/**
 * Static SVG stand-in for `frame-mapping`, drawn for paper.
 *
 * A WebGL canvas prints as a blank rectangle and the sliders mean nothing on
 * paper — so what prints is the widget's authored starting situation: the two
 * frames, the point, the three vectors between them, and the mapping written
 * out with those numbers in it, since the readout panel is gone. Same cameras
 * and same geometry module as the live scene, so the drawing follows the
 * widget instead of drifting from it.
 */
import { arrowHead, project, type Camera } from "../../projection";
import type { Vec3 } from "../../props";
import type { FrameMappingProps } from "./index";
import {
  AXIS_LENGTH,
  RANGE,
  VIEW_CAMERA,
  axisLabelAnchor,
  clampAngles,
  clampVector,
  flatten,
  invertPose,
  isDrawable,
  mapPoint,
  matrixEntries,
  frameLabelAnchor,
  vectorLabelAnchor,
  poseOf,
  targetAxisTip,
  targetLabelAnchor,
  toView,
  vectorEntries,
  viewAxes,
  type AxisKey,
  type Pose,
  type View,
} from "./mapping";

const VIEW = { width: 800, height: 470 };

/**
 * Ink-on-white colours: the screen palette is tuned for a dark surface and
 * washes out on paper, so the hues are kept but darkened. The three vector
 * hues stay as far apart as they are on screen — they are the only thing
 * tying the drawing to the equation printed under it.
 */
const INK = {
  referenceX: "#8f2b23",
  referenceY: "#166030",
  referenceZ: "#155a63",
  targetX: "#c0392b",
  targetY: "#1e7d3c",
  targetZ: "#1c6b76",
  fromReference: "#5b4bab",
  betweenOrigins: "#9a6410",
  toTarget: "#1f5f96",
  grid: "#dde2e0",
  text: "#2c3331",
  point: "#8a7440",
  origin: "#6b7671",
} as const;

const REFERENCE_INK: Record<AxisKey, string> = {
  x: INK.referenceX,
  y: INK.referenceY,
  z: INK.referenceZ,
};

const TARGET_INK: Record<AxisKey, string> = {
  x: INK.targetX,
  y: INK.targetY,
  z: INK.targetZ,
};

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
  opacity = 1,
}: {
  to2d: To2d;
  from: Vec3;
  to: Vec3;
  color: string;
  width: number;
  head: number;
  opacity?: number;
}) {
  const seg = line(to2d, from, to);
  if (!seg) return null;
  const [c1, c2] = arrowHead(seg.p1, seg.p2, head);
  return (
    <g opacity={opacity}>
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

/**
 * The three mapping vectors are drawn translucent, as on screen: they are
 * readings rather than things, and two of them run nearly along each other in
 * the worked example.
 */
const VECTOR_OPACITY = 0.62;

/** The xy plane's graduation, one square per basis vector. */
function Grid({ to2d }: { to2d: To2d }) {
  const ticks: number[] = [];
  for (let t = -RANGE; t <= RANGE; t++) ticks.push(t);
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

/** A basis vector of a frame, drawn from that frame's own origin. */
function BasisAxis({
  to2d,
  axis,
  pose,
  colors,
  frameName,
  showLabel,
  width,
}: {
  to2d: To2d;
  axis: AxisKey;
  /** `null` for {A}, which sits at the origin unrotated. */
  pose: Pose | null;
  colors: Record<AxisKey, string>;
  frameName: string;
  showLabel: boolean;
  width: number;
}) {
  const unit: Vec3 =
    axis === "x" ? [1, 0, 0] : axis === "y" ? [0, 1, 0] : [0, 0, 1];
  const from: Vec3 = pose ? pose.position : [0, 0, 0];
  const tip: Vec3 = pose
    ? targetAxisTip(pose, axis)
    : (unit.map((c) => c * AXIS_LENGTH) as Vec3);
  const labelAt = to2d(
    pose ? targetLabelAnchor(pose, axis) : axisLabelAnchor(axis),
  );
  const color = colors[axis];

  return (
    <g>
      <Arrow
        to2d={to2d}
        from={from}
        to={tip}
        color={color}
        width={width}
        head={8}
      />
      {showLabel && labelAt && (
        <text
          x={labelAt[0]}
          y={labelAt[1]}
          fill={color}
          fontSize={15}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {`${axis}̂`}
          <tspan fontSize={10} dy={4}>
            {frameName}
          </tspan>
        </text>
      )}
    </g>
  );
}

/** One of the three mapping vectors, named at the middle of its own shaft. */
function MappingVector({
  to2d,
  from,
  to,
  color,
  frame,
  of: subscript,
  showLabel,
  at,
  lift,
}: {
  to2d: To2d;
  from: Vec3;
  to: Vec3;
  color: string;
  frame: string;
  of: string;
  showLabel: boolean;
  at: number;
  lift: number;
}) {
  if (!isDrawable(from, to)) return null;
  const labelAt = to2d(vectorLabelAnchor(from, to, { at, offset: 0.5, lift }));

  return (
    <g>
      <Arrow
        to2d={to2d}
        from={from}
        to={to}
        color={color}
        width={2.2}
        head={12}
        opacity={VECTOR_OPACITY}
      />
      {showLabel && labelAt && (
        <text
          x={labelAt[0]}
          y={labelAt[1]}
          fill={color}
          fontSize={15}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          <tspan fontSize={10} dy={-6}>
            {frame}
          </tspan>
          <tspan dy={6}>p</tspan>
          <tspan fontSize={10} dy={5}>
            {subscript}
          </tspan>
        </text>
      )}
    </g>
  );
}

/**
 * The mapping as one line of type, with the student's — here, the author's —
 * numbers already in it.
 *
 * SVG has no matrix notation, so ᴮR_A is written row by row between vertical
 * bars and the vectors as bracketed tuples: on paper the reader needs the
 * arithmetic to be checkable, not typeset.
 */
function Readout({
  pose,
  point,
  view,
  decimals,
  targetName,
  pointLabel,
}: {
  pose: Pose;
  point: Vec3;
  view: View;
  decimals: number;
  /* {A} is not named here: every quantity on this line is read in {B}. */
  targetName: string;
  pointLabel: string;
}) {
  const rows = matrixEntries(pose.rotation, view, decimals)
    .map((row) => row.join(" "))
    .join(" ; ");
  const tuple = (v: Vec3) => `(${vectorEntries(v, view, decimals).join(", ")})`;

  return (
    <text x={16} y={VIEW.height - 16} fill={INK.text} fontSize={15}>
      <tspan fontSize={10} dy={-7}>
        {targetName}
      </tspan>
      <tspan fontWeight={700} dy={7}>
        p
      </tspan>
      <tspan fontSize={10} dy={5}>
        {pointLabel}
      </tspan>
      <tspan dy={-5}>{` = [${rows}] · ${tuple(point)} + ${tuple(
        pose.position,
      )} = ${tuple(mapPoint(pose, point))}`}</tspan>
    </text>
  );
}

const VIEW_NAME: Record<View, string> = {
  "2d": "no plano",
  "3d": "no espaço",
};

export default function FrameMappingPrint({
  point,
  framePosition,
  angles,
  decimals,
  referenceName,
  targetName,
  pointLabel,
  labels,
  grid,
  variant,
}: FrameMappingProps) {
  const view = toView(variant);
  const to2d = projector(VIEW_CAMERA[view]);
  const axes = viewAxes(view);

  const m = flatten(clampVector(point ?? [0, 0, 0]), view);
  const framePos = flatten(clampVector(framePosition ?? [0, 0, 0]), view);
  const deg = clampAngles(angles ?? [0, 0, 0]);
  const shownAngles: Vec3 = view === "2d" ? [0, 0, deg[2]] : deg;

  const referenceToTarget = poseOf(shownAngles, framePos);
  const pose = invertPose(referenceToTarget);

  const origin: Vec3 = [0, 0, 0];
  // Same clearance rule as the live scene: sideways is enough in the plane,
  // and a shaft seen nearly end-on in the 3D view needs the lift as well.
  const labelLift = view === "3d" ? 0.32 : 0;
  const originAt = to2d(origin);
  // Each frame's name is pushed away from the other one, so neither lands on
  // the point or the vectors that live between them.
  const referenceLabelAt = to2d(frameLabelAnchor(origin, framePos));
  const targetLabelAt = to2d(frameLabelAnchor(framePos, origin));
  const frameAt = to2d(framePos);
  const pointAt = to2d(m);

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`O ponto ${pointLabel} mapeado do frame ${referenceName} para o frame ${targetName}, ${VIEW_NAME[view]}`}
    >
      {grid && <Grid to2d={to2d} />}

      {axes.map((axis) => (
        <BasisAxis
          key={`r${axis}`}
          to2d={to2d}
          axis={axis}
          pose={null}
          colors={REFERENCE_INK}
          frameName={referenceName}
          showLabel={labels}
          width={2}
        />
      ))}

      {axes.map((axis) => (
        <BasisAxis
          key={`d${axis}`}
          to2d={to2d}
          axis={axis}
          pose={referenceToTarget}
          colors={TARGET_INK}
          frameName={targetName}
          showLabel={labels}
          width={2}
        />
      ))}

      {/* The height of {B} off the plane, as in the live scene — without it a
          lifted frame is impossible to place by eye under perspective. */}
      {view === "3d" && framePos[2] !== 0 && (
        <>
          <Segment
            to2d={to2d}
            from={origin}
            to={[framePos[0], framePos[1], 0]}
            color={INK.betweenOrigins}
            dashed
            opacity={0.7}
          />
          <Segment
            to2d={to2d}
            from={[framePos[0], framePos[1], 0]}
            to={framePos}
            color={INK.betweenOrigins}
            dashed
            opacity={0.7}
          />
        </>
      )}

      <MappingVector
        to2d={to2d}
        from={origin}
        to={m}
        color={INK.fromReference}
        frame={referenceName}
        of={pointLabel}
        showLabel={labels}
        at={0.45}
        lift={labelLift}
      />
      <MappingVector
        to2d={to2d}
        from={framePos}
        to={origin}
        color={INK.betweenOrigins}
        frame={targetName}
        of={referenceName}
        showLabel={labels}
        at={0.45}
        lift={labelLift}
      />
      <MappingVector
        to2d={to2d}
        from={framePos}
        to={m}
        color={INK.toTarget}
        frame={targetName}
        of={pointLabel}
        showLabel={labels}
        at={0.5}
        lift={labelLift}
      />

      {originAt && (
        <g>
          <circle cx={originAt[0]} cy={originAt[1]} r={3.5} fill={INK.origin} />
          {labels && referenceLabelAt && (
            <text
              x={referenceLabelAt[0]}
              y={referenceLabelAt[1]}
              fill={INK.origin}
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {`{${referenceName}}`}
            </text>
          )}
        </g>
      )}

      {frameAt && (
        <g>
          <circle
            cx={frameAt[0]}
            cy={frameAt[1]}
            r={4}
            fill={INK.betweenOrigins}
          />
          {labels && targetLabelAt && (
            <text
              x={targetLabelAt[0]}
              y={targetLabelAt[1]}
              fill={INK.betweenOrigins}
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {`{${targetName}}`}
            </text>
          )}
        </g>
      )}

      {pointAt && (
        <g>
          <circle cx={pointAt[0]} cy={pointAt[1]} r={5.5} fill={INK.point} />
          {labels && (
            <text
              x={pointAt[0]}
              y={pointAt[1] - 14}
              fill={INK.text}
              fontSize={15}
              fontWeight={700}
              fontStyle="italic"
              textAnchor="middle"
            >
              {pointLabel}
            </text>
          )}
        </g>
      )}

      <Readout
        pose={pose}
        point={m}
        view={view}
        decimals={decimals}
        targetName={targetName}
        pointLabel={pointLabel}
      />
    </svg>
  );
}
