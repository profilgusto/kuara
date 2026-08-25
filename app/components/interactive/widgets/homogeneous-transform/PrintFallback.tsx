/**
 * Static SVG stand-in for `homogeneous-transform`, drawn for paper.
 *
 * A WebGL canvas prints as a blank rectangle and six sliders mean nothing on
 * paper, so what prints is the widget's authored starting pose: {I} at the
 * origin, {R} turned and carried out to ᴵp_R, the translation drawn between
 * the two origins, and the 4×4 written out — on paper there is no panel to
 * read it off. Same camera and same maths module as the live scene, so the
 * drawing follows the widget instead of drifting from it.
 */
import { arrowHead, project, type Camera } from "../../projection";
import type { Vec3 } from "../../props";
import type { HomogeneousTransformProps } from "./index";
import {
  ANGLE_AXES,
  AXIS_LENGTH,
  AXIS_UNIT,
  CAMERA,
  GRID_HALF,
  GRID_STEP,
  applyTransform,
  blockOf,
  clampAngles,
  clampPosition,
  factorOrder,
  formatMatrix4,
  homogeneous,
  isDrawableTranslation,
  rotatedAxisTip,
  rotatedLabelAnchor,
  rotationMatrix,
  toRotationMode,
  translationLabelAnchor,
  type AxisKey,
  type Mat4,
} from "./transform";

const VIEW = { width: 800, height: 500 };

/**
 * Ink-on-white colours: the screen palette is tuned for a dark surface and
 * washes out on paper, so the hues are kept but darkened — and {I} stays the
 * paler of the two frames, as it is on screen.
 */
const INK = {
  rotated: { x: "#c0392b", y: "#1e7d3c", z: "#1c6b76" },
  inertial: { x: "#c98d86", y: "#8ab598", z: "#8ab2ba" },
  translation: "#9a6b12",
  grid: "#dde2e0",
  text: "#2c3331",
  structural: "#96a09c",
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
  dash,
}: {
  to2d: To2d;
  from: Vec3;
  to: Vec3;
  color: string;
  width?: number;
  dash?: string;
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
      strokeDasharray={dash}
      strokeLinecap="round"
    />
  );
}

/** An arrow drawn flat: shaft plus a screen-space head. */
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

const scaled = (u: Vec3, k: number): Vec3 => [u[0] * k, u[1] * k, u[2] * k];

/**
 * One triad. `pose` is `null` for {I}, which sits where the world does; for
 * {R} it is ᴵT_R, and every point of the triad — tips and label anchors alike
 * — passes through it, exactly as the live scene's transformed group does.
 */
function Triad({
  to2d,
  colors,
  frameName,
  labels,
  pose,
  width,
  head,
}: {
  to2d: To2d;
  colors: Record<AxisKey, string>;
  frameName: string;
  labels: boolean;
  pose: Mat4 | null;
  width: number;
  head: number;
}) {
  const origin: Vec3 = pose ? applyTransform(pose, [0, 0, 0]) : [0, 0, 0];

  return (
    <g>
      {ANGLE_AXES.map((axis) => {
        const tip = pose
          ? rotatedAxisTip(pose, axis)
          : scaled(AXIS_UNIT[axis], AXIS_LENGTH);
        const labelAt = to2d(
          pose
            ? rotatedLabelAnchor(pose, axis)
            : scaled(AXIS_UNIT[axis], AXIS_LENGTH + 0.2),
        );
        return (
          <g key={axis}>
            <Arrow
              to2d={to2d}
              from={origin}
              to={tip}
              color={colors[axis]}
              width={width}
              head={head}
            />
            {labels && labelAt && (
              <text
                x={labelAt[0]}
                y={labelAt[1]}
                fill={colors[axis]}
                fontSize={16}
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
      })}
    </g>
  );
}

/** The xy plane of {I}, one square per basis vector. */
function Grid({ to2d }: { to2d: To2d }) {
  const ticks: number[] = [];
  for (let t = -GRID_HALF; t <= GRID_HALF + 1e-9; t += GRID_STEP) {
    ticks.push(Number(t.toFixed(4)));
  }
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

/** ᴵp_R, its dashed path through the plane, and its name. */
function Translation({
  to2d,
  position,
  labels,
  inertialName,
  rotatedName,
}: {
  to2d: To2d;
  position: Vec3;
  labels: boolean;
  inertialName: string;
  rotatedName: string;
}) {
  const foot: Vec3 = [position[0], position[1], 0];
  const labelAt = to2d(translationLabelAnchor(position, 0.2));

  return (
    <g>
      <Segment
        to2d={to2d}
        from={[0, 0, 0]}
        to={foot}
        color={INK.translation}
        dash="5 4"
      />
      <Segment
        to2d={to2d}
        from={foot}
        to={position}
        color={INK.translation}
        dash="5 4"
      />
      <Arrow
        to2d={to2d}
        from={[0, 0, 0]}
        to={position}
        color={INK.translation}
        width={2.6}
        head={12}
      />
      {labels && labelAt && (
        <text
          x={labelAt[0]}
          y={labelAt[1]}
          fill={INK.translation}
          fontSize={15}
          fontWeight={700}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          <tspan fontSize={10} dy={-6}>
            {inertialName}
          </tspan>
          <tspan dy={6}>p</tspan>
          <tspan fontSize={10} dy={5}>
            {rotatedName}
          </tspan>
        </text>
      )}
    </g>
  );
}

/**
 * The 4×4, bracketed and partitioned, in the corner the scene leaves empty —
 * plus the product the rotation block came from, since the mode is not
 * otherwise visible on paper.
 */
function MatrixReadout({
  rows,
  mode,
  inertialName,
  rotatedName,
}: {
  rows: string[][];
  mode: ReturnType<typeof toRotationMode>;
  inertialName: string;
  rotatedName: string;
}) {
  const x = 22;
  const rowHeight = 25;
  const boxHeight = rowHeight * 4 + 10;
  const top = VIEW.height - boxHeight - 24;
  const colWidth = 56;
  const nameWidth = 46;
  const bracketX = x + nameWidth + 26;
  const boxWidth = colWidth * 4 + 16;
  // Where the partition falls: left of the translation column, above the
  // structural row.
  const splitX = bracketX + 12 + colWidth * 3 + 4;
  const splitY = top + rowHeight * 3 + 5;

  return (
    <g>
      {/* Paper behind the readout: the grid runs under this corner, and its
          lines crossing the digits is the one thing that would make the
          printed matrix harder to read than the screen one. */}
      <rect
        x={x - 10}
        y={top - 30}
        width={bracketX + boxWidth + 26 - x}
        height={boxHeight + 42}
        fill="#ffffff"
        fillOpacity={0.92}
        rx={4}
      />

      <text
        x={x}
        y={top - 14}
        fill={INK.origin}
        fontSize={13}
        dominantBaseline="middle"
      >
        <tspan fontSize={10} dy={-6}>
          {inertialName}
        </tspan>
        <tspan fontWeight={700} dy={6}>
          R
        </tspan>
        <tspan fontSize={10} dy={5}>
          {rotatedName}
        </tspan>
        <tspan dy={-5}>
          {` = ${factorOrder(mode)
            .map((axis) => `R${axis}`)
            .join(" · ")}`}
        </tspan>
      </text>

      <text
        x={x}
        y={top + boxHeight / 2}
        fill={INK.text}
        fontSize={16}
        dominantBaseline="middle"
      >
        <tspan fontSize={11} dy={-7}>
          {inertialName}
        </tspan>
        <tspan fontWeight={700} dy={7}>
          T
        </tspan>
        <tspan fontSize={11} dy={5}>
          {rotatedName}
        </tspan>
        <tspan dy={-5}> =</tspan>
      </text>

      {/* Square brackets, drawn as three strokes each. */}
      {[bracketX, bracketX + boxWidth].map((bx, i) => {
        const dir = i === 0 ? 1 : -1;
        return (
          <g key={bx} stroke={INK.origin} strokeWidth={1.4} fill="none">
            <line x1={bx} y1={top} x2={bx} y2={top + boxHeight} />
            <line x1={bx} y1={top} x2={bx + dir * 8} y2={top} />
            <line
              x1={bx}
              y1={top + boxHeight}
              x2={bx + dir * 8}
              y2={top + boxHeight}
            />
          </g>
        );
      })}

      {/* The partition: the same two rules the on-screen panel draws. */}
      <g stroke={INK.structural} strokeWidth={0.9} strokeDasharray="4 3">
        <line x1={splitX} y1={top + 4} x2={splitX} y2={top + boxHeight - 4} />
        <line
          x1={bracketX + 6}
          y1={splitY}
          x2={bracketX + boxWidth - 6}
          y2={splitY}
        />
      </g>

      {rows.map((row, r) =>
        row.map((entry, c) => {
          const block = blockOf(r, c);
          return (
            <text
              key={`${r}-${c}`}
              x={bracketX + 12 + colWidth * (c + 1) - 12}
              y={top + 14 + rowHeight * r}
              // Columns tinted by what they are: the first three are {R}'s
              // basis vectors resolved in {I}, the fourth is where {R} sits,
              // and the last row measures nothing.
              fill={
                block === "bottom"
                  ? INK.structural
                  : block === "translation"
                    ? INK.translation
                    : INK.rotated[ANGLE_AXES[c]]
              }
              fontSize={14}
              textAnchor="end"
              dominantBaseline="middle"
            >
              {entry}
            </text>
          );
        }),
      )}
    </g>
  );
}

export default function HomogeneousTransformPrint({
  angles,
  position,
  mode,
  decimals,
  inertialName,
  rotatedName,
  labels,
  grid,
}: HomogeneousTransformProps) {
  const to2d = projector(CAMERA);
  const rotation = toRotationMode(mode);
  const deg = clampAngles(angles ?? [0, 0, 0]);
  const pos = clampPosition(position ?? [0, 0, 0]);
  const transform = homogeneous(rotationMatrix(deg, rotation), pos);
  const rows = formatMatrix4(transform, decimals);

  const originI = to2d([0, 0, 0]);
  const originR = to2d(pos);

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`Transformação homogênea do frame {${rotatedName}} em relação ao frame inercial {${inertialName}}`}
    >
      {grid && <Grid to2d={to2d} />}

      <Triad
        to2d={to2d}
        colors={INK.inertial}
        frameName={inertialName}
        labels={labels}
        pose={null}
        width={1.8}
        head={9}
      />

      {isDrawableTranslation(pos) && (
        <Translation
          to2d={to2d}
          position={pos}
          labels={labels}
          inertialName={inertialName}
          rotatedName={rotatedName}
        />
      )}

      <Triad
        to2d={to2d}
        colors={INK.rotated}
        frameName={rotatedName}
        labels={labels}
        pose={transform}
        width={2.4}
        head={11}
      />

      {originI && (
        <g>
          <circle cx={originI[0]} cy={originI[1]} r={3.5} fill={INK.origin} />
          {labels && (
            /* Same offset direction as the live scene's screen-space nudge. */
            <text
              x={originI[0] - 15}
              y={originI[1] + 17}
              fill={INK.origin}
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              o
              <tspan fontSize={10} dy={4}>
                {inertialName}
              </tspan>
            </text>
          )}
        </g>
      )}

      {originR && (
        <g>
          <circle
            cx={originR[0]}
            cy={originR[1]}
            r={4}
            fill={INK.translation}
          />
          {labels && (
            <text
              x={originR[0] - 15}
              y={originR[1] + 17}
              fill={INK.translation}
              fontSize={15}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              o
              <tspan fontSize={10} dy={4}>
                {rotatedName}
              </tspan>
            </text>
          )}
        </g>
      )}

      <MatrixReadout
        rows={rows}
        mode={rotation}
        inertialName={inertialName}
        rotatedName={rotatedName}
      />
    </svg>
  );
}
