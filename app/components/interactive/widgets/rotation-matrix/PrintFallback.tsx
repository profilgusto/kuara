/**
 * Static SVG stand-in for `rotation-matrix`, drawn for paper.
 *
 * A WebGL canvas prints as a blank rectangle and the sliders mean nothing on
 * paper, so what prints is the widget's authored starting orientation: the two
 * triads about their shared origin, and the matrix that relates them written
 * out — on paper there is no panel to read it off. Same camera and same maths
 * module as the live scene, so the drawing follows the widget instead of
 * drifting from it.
 */
import { arrowHead, project, type Camera } from "../../projection";
import type { Vec3 } from "../../props";
import type { RotationMatrixProps } from "./index";
import {
  ANGLE_AXES,
  AXIS_LENGTH,
  AXIS_UNIT,
  CAMERA,
  GRID_HALF,
  GRID_STEP,
  apply,
  axisLabelAnchor,
  clampAngles,
  factorOrder,
  formatMatrix,
  rotationMatrix,
  toRotationMode,
  type AxisKey,
  type Mat3,
} from "./rotation";

const VIEW = { width: 800, height: 460 };

/**
 * Ink-on-white colours: the screen palette is tuned for a dark surface and
 * washes out on paper, so the hues are kept but darkened — and {I} stays the
 * paler of the two frames, as it is on screen.
 */
const INK = {
  rotated: { x: "#c0392b", y: "#1e7d3c", z: "#1c6b76" },
  inertial: { x: "#c98d86", y: "#8ab598", z: "#8ab2ba" },
  grid: "#dde2e0",
  text: "#2c3331",
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
}: {
  to2d: To2d;
  from: Vec3;
  to: Vec3;
  color: string;
  width?: number;
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
 * One triad. `orientation` is `null` for {I}, which sits where the world does;
 * for {R} it is ᴵR_R, and every point of the triad — tips and label anchors
 * alike — passes through it, exactly as the live scene's rotated group does.
 */
function Triad({
  to2d,
  colors,
  frameName,
  labels,
  orientation,
  width,
  head,
}: {
  to2d: To2d;
  colors: Record<AxisKey, string>;
  frameName: string;
  labels: boolean;
  orientation: Mat3 | null;
  width: number;
  head: number;
}) {
  const place = (v: Vec3): Vec3 => (orientation ? apply(orientation, v) : v);

  return (
    <g>
      {ANGLE_AXES.map((axis) => {
        const tip = place(scaled(AXIS_UNIT[axis], AXIS_LENGTH));
        const labelAt = to2d(place(axisLabelAnchor(axis)));
        return (
          <g key={axis}>
            <Arrow
              to2d={to2d}
              from={[0, 0, 0]}
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

/**
 * The matrix, bracketed, in the corner the scene leaves empty — plus the
 * product it came from, since the mode is not otherwise visible on paper.
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
  const top = VIEW.height - 122;
  const rowHeight = 26;
  const colWidth = 62;
  const boxHeight = rowHeight * 3 + 10;
  const nameWidth = 46;
  const bracketX = x + nameWidth + 26;
  const boxWidth = colWidth * 3 + 16;

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
          R
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

      {rows.map((row, r) =>
        row.map((entry, c) => (
          <text
            key={`${r}-${c}`}
            x={bracketX + 12 + colWidth * (c + 1) - 12}
            y={top + 14 + rowHeight * r}
            // Columns tinted by the axis they are: column c of ᴵR_R is the
            // basis vector of {R} of that colour, resolved in {I}.
            fill={INK.rotated[ANGLE_AXES[c]]}
            fontSize={15}
            textAnchor="end"
            dominantBaseline="middle"
          >
            {entry}
          </text>
        )),
      )}
    </g>
  );
}

export default function RotationMatrixPrint({
  angles,
  mode,
  decimals,
  inertialName,
  rotatedName,
  labels,
  grid,
}: RotationMatrixProps) {
  const to2d = projector(CAMERA);
  const rotation = toRotationMode(mode);
  const deg = clampAngles(angles ?? [0, 0, 0]);
  const matrix = rotationMatrix(deg, rotation);
  const rows = formatMatrix(matrix, decimals);
  const origin = to2d([0, 0, 0]);

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`Matriz de rotação do frame {${rotatedName}} em relação ao frame inercial {${inertialName}}`}
    >
      {grid && <Grid to2d={to2d} />}

      <Triad
        to2d={to2d}
        colors={INK.inertial}
        frameName={inertialName}
        labels={labels}
        orientation={null}
        width={1.8}
        head={9}
      />

      <Triad
        to2d={to2d}
        colors={INK.rotated}
        frameName={rotatedName}
        labels={labels}
        orientation={matrix}
        width={2.4}
        head={11}
      />

      {origin && (
        <g>
          <circle cx={origin[0]} cy={origin[1]} r={4} fill={INK.origin} />
          {labels && (
            /* Same offset direction as the live scene's screen-space nudge. */
            <text
              x={origin[0] - 15}
              y={origin[1] + 17}
              fill={INK.origin}
              fontSize={17}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              o
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
