/**
 * Static SVG stand-in for `differential-kinematics`, drawn for paper.
 *
 * A printed page has no sliders and no motion, so what prints is the instant
 * the block opens on: the robot at the origin with the authored wheel speeds,
 * the velocities they produce, and — standing in for the animation — the whole
 * circle the robot would run along, with the centre it turns about marked on
 * it. A reader of the paper version sees the trajectory the screen version
 * traces out; they just do not get to change it.
 *
 * Every number comes from `./kinematics`, the same module the live scene uses,
 * so the drawing cannot claim a motion the widget would not perform.
 *
 * It doubles as the widget's thumbnail in the Payload library, which is why it
 * is plain SVG with no Tailwind: the admin layout loads only Payload's CSS.
 */
import type { DifferentialKinematicsProps } from "./index";
import {
  GRID_CELL,
  advance,
  gridAnchor,
  clampWheels,
  forward,
  format,
  icrDistance,
  icrIsVisible,
  quantisePose,
  robotOutline,
  velocityArrowLength,
  viewHalfExtent,
  wheelLinearSpeeds,
  svgScale,
  wheelOrigin,
  worldToSvg,
  yawArcSweep,
  type BodyTwist,
  type Pose,
  type RobotParams,
  type Viewport,
} from "./kinematics";

const VIEW: Viewport = { width: 800, height: 430 };

/**
 * What the drawing falls back to when the block is authored at rest.
 *
 * The widget opens stopped on purpose — the first motion a student sees
 * should be one they commanded. On paper there is nobody to command it, and a
 * stopped robot prints as a robot with no velocities, no path and no centre of
 * rotation: everything the figure is for. So a still of the block at rest
 * shows a worked example instead, and says so in as many words on the line
 * underneath.
 */
const EXAMPLE_WHEELS = { left: 3, right: 6 };

/** Wheel speeds below this are a robot that is not going anywhere. */
const AT_REST = 1e-6;

/**
 * Ink-on-white colours: the screen palette is tuned for a dark surface and
 * washes out on paper, so the hues are kept but darkened.
 */
const INK = {
  x: "#c0392b",
  y: "#1e7d3c",
  grid: "#e2e6e4",
  body: "#9c4c31",
  wheel: "#394146",
  wheelSpeed: "#6a4fa3",
  velocity: "#9a6410",
  path: "#1c6b76",
  icr: "#a83f3f",
  text: "#2c3331",
} as const;

type To2d = (point: [number, number]) => [number, number];

/**
 * Coordinates are rounded on their way into the markup.
 *
 * Same reason as `quantisePose`, one step further down: an attribute written
 * as "123.45600000000002" on one engine and "…003" on the other is a hydration
 * mismatch, and no drawing needs that many digits of a user unit.
 */
function px(value: number): number {
  return Number(value.toFixed(2));
}

/** A point in the robot's frame, taken to the page through the robot's pose. */
function bodyPoint(
  pose: Pose,
  x: number,
  y: number,
  to2d: To2d,
): [number, number] {
  const c = Math.cos(pose.theta);
  const s = Math.sin(pose.theta);
  return to2d([pose.x + c * x - s * y, pose.y + s * x + c * y]);
}

function Segment({
  a,
  b,
  color,
  width = 1,
  dashed = false,
  opacity = 1,
}: {
  a: [number, number];
  b: [number, number];
  color: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
}) {
  return (
    <line
      x1={px(a[0])}
      y1={px(a[1])}
      x2={px(b[0])}
      y2={px(b[1])}
      stroke={color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeDasharray={dashed ? "5 4" : undefined}
      strokeLinecap="round"
    />
  );
}

/** An arrow whose head is built in page space, so it prints a constant size. */
function Arrow({
  a,
  b,
  color,
  width,
  head = 9,
}: {
  a: [number, number];
  b: [number, number];
  color: string;
  width: number;
  head?: number;
}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  // Nothing to draw, and no direction to point a head in.
  if (len < 1) return null;

  const ux = dx / len;
  const uy = dy / len;
  const bx = b[0] - ux * head;
  const by = b[1] - uy * head;
  const half = head * 0.42;

  return (
    <g>
      <Segment a={a} b={b} color={color} width={width} />
      <polygon
        points={`${px(b[0])},${px(b[1])} ${px(bx - uy * half)},${px(by + ux * half)} ${px(bx + uy * half)},${px(by - ux * half)}`}
        fill={color}
      />
    </g>
  );
}

function Symbol({
  at,
  color,
  glyph,
  sub,
  size = 15,
}: {
  at: [number, number];
  color: string;
  glyph: string;
  sub?: string;
  size?: number;
}) {
  return (
    <text
      x={px(at[0])}
      y={px(at[1])}
      fill={color}
      fontSize={size}
      fontWeight={700}
      textAnchor="middle"
      dominantBaseline="middle"
    >
      {glyph}
      {sub && (
        <tspan fontSize={size * 0.65} dy={4}>
          {sub}
        </tspan>
      )}
    </text>
  );
}

/**
 * The floor's graduation, one square per `GRID_CELL` metres, laid around
 * wherever the drawing is centred and snapped to whole cells — the same rule
 * the live scene's floor follows, so the printed squares fall on the same
 * metres.
 */
function Ground({
  to2d,
  halfExtent,
  centre,
}: {
  to2d: To2d;
  halfExtent: number;
  centre: [number, number];
}) {
  const reach = halfExtent * 2;
  const anchor: [number, number] = [
    gridAnchor(centre[0]),
    gridAnchor(centre[1]),
  ];
  const ticks: number[] = [];
  for (let t = -reach; t <= reach + 1e-9; t += GRID_CELL) {
    ticks.push(Number(t.toFixed(4)));
  }
  return (
    <g>
      {ticks.map((t) => (
        <Segment
          key={`v${t}`}
          a={to2d([anchor[0] + t, anchor[1] - reach])}
          b={to2d([anchor[0] + t, anchor[1] + reach])}
          color={INK.grid}
        />
      ))}
      {ticks.map((t) => (
        <Segment
          key={`h${t}`}
          a={to2d([anchor[0] - reach, anchor[1] + t])}
          b={to2d([anchor[0] + reach, anchor[1] + t])}
          color={INK.grid}
        />
      ))}
    </g>
  );
}

/**
 * How far along its path the robot is drawn.
 *
 * Not at the start: there it sits exactly on the world origin, hiding the
 * inertial frame the whole motion is measured against. A quarter of the way
 * round also gives the printed figure what the animation has and a still
 * cannot — a robot with a path behind it and a path ahead of it.
 */
const PRINTED_PROGRESS = 0.25;

/** How long the printed path runs for: one full circle, or across the stage. */
function pathSeconds(twist: BodyTwist, halfExtent: number): number {
  return Math.abs(twist.omega) > 1e-9
    ? (2 * Math.PI) / Math.abs(twist.omega)
    : (2.2 * halfExtent) / Math.max(Math.abs(twist.v), 1e-6);
}

/**
 * Where the robot is drawn, and the poses of the path either side of it.
 *
 * Every pose is quantised on the way out. `advance` reaches them through
 * `Math.sin`/`Math.cos`, which Node and the browser round differently in the
 * last bit — measured, not assumed: 192 of these 201 points differ between the
 * two engines. The values are identical to seventeen digits, but this drawing
 * is server-rendered and then hydrated, and *any* rounding downstream turns a
 * last-bit difference into a different string whenever a point lands on a
 * rounding boundary. Over two hundred points that is not a rare event, and
 * React reports the whole path as a hydration mismatch. Quantising to a
 * millionth of a metre — twelve orders of magnitude coarser than the
 * disagreement, and far finer than the page can draw — makes both engines
 * round the same number.
 */
function samplePath(
  twist: BodyTwist,
  halfExtent: number,
  steps = 200,
): { poses: Pose[]; index: number } {
  const seconds = pathSeconds(twist, halfExtent);
  const poses: Pose[] = [];
  let pose: Pose = { x: 0, y: 0, theta: 0 };
  for (let i = 0; i <= steps; i++) {
    poses.push(quantisePose(pose));
    pose = advance(pose, twist, seconds / steps);
  }
  return { poses, index: Math.round(steps * PRINTED_PROGRESS) };
}

/**
 * The path the robot runs, drawn with the widget's own `advance` rather than
 * as a circle of radius v/ω — so the printed trajectory is the very
 * computation the animation performs. What is behind the robot is drawn solid,
 * as the trail on screen would be; what is ahead of it, dashed.
 */
function Path({
  poses,
  index,
  to2d,
}: {
  poses: Pose[];
  index: number;
  to2d: To2d;
}) {
  const asPoints = (from: number, to: number) =>
    poses
      .slice(from, to)
      .map((p) => {
        const [x, y] = to2d([p.x, p.y]);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <g>
      <polyline
        points={asPoints(0, index + 1)}
        fill="none"
        stroke={INK.path}
        strokeWidth={2}
      />
      <polyline
        points={asPoints(index, poses.length)}
        fill="none"
        stroke={INK.path}
        strokeWidth={1.5}
        strokeDasharray="6 4"
        strokeOpacity={0.7}
      />
    </g>
  );
}

export default function DifferentialKinematicsPrint({
  wheelRadius,
  track,
  leftSpeed,
  rightSpeed,
  icr,
  decimals,
  frameName,
  inertialName,
  variant,
}: DifferentialKinematicsProps) {
  const params: RobotParams = { r: wheelRadius, d: track };
  const outline = robotOutline(params);
  const halfExtent = viewHalfExtent(params);

  const authored = clampWheels({ left: leftSpeed, right: rightSpeed });
  const atRest =
    Math.abs(authored.left) < AT_REST && Math.abs(authored.right) < AT_REST;
  const wheels = atRest ? EXAMPLE_WHEELS : authored;
  const twist = forward(wheels, params);
  const rim = wheelLinearSpeeds(wheels, params);
  const radius = icrDistance(twist);
  const showIcr = icr && icrIsVisible(radius, halfExtent);

  // Drawn part of the way along its own path, so the world origin stays
  // legible and the figure shows both where it has been and where it is going.
  const { poses, index } = samplePath(twist, halfExtent);
  // Already quantised by `samplePath`, which is what keeps the server's
  // rendering and the browser's identical.
  const pose: Pose = poses[index];

  // The page is centred on the robot, exactly as the live camera is: the robot
  // is the subject and must not wander off the edge, while the floor, the
  // trail and the inertial frame fall where the motion puts them.
  const to2d: To2d = (point) =>
    worldToSvg([point[0] - pose.x, point[1] - pose.y], VIEW, halfExtent);
  const at = (x: number, y: number) => bodyPoint(pose, x, y, to2d);
  const centre = at(0, 0);
  const scale = svgScale(VIEW, halfExtent);
  const chassisR = outline.chassisRadius * scale;
  // Inside the shell: x̂_R runs along the heading, and so does ẋ_R — drawn the
  // same length, the thicker velocity arrow simply paints over the axis.
  const axis = outline.chassisRadius * 0.85;
  const n = decimals;

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`Vista superior de um robô diferencial com ω_l = ${format(wheels.left, n)} e ω_r = ${format(wheels.right, n)} rad/s, a trajetória resultante e as velocidades do chassi`}
    >
      <Ground to2d={to2d} halfExtent={halfExtent} centre={[pose.x, pose.y]} />
      <Path poses={poses} index={index} to2d={to2d} />

      {/* The fixed frame the motion is measured against. */}
      <g>
        <Arrow
          a={to2d([0, 0])}
          b={to2d([halfExtent * 0.25, 0])}
          color={INK.x}
          width={1.5}
          head={7}
        />
        <Arrow
          a={to2d([0, 0])}
          b={to2d([0, halfExtent * 0.25])}
          color={INK.y}
          width={1.5}
          head={7}
        />
        <Symbol
          at={to2d([-halfExtent * 0.1, -halfExtent * 0.1])}
          color={INK.text}
          glyph={`{${inertialName}}`}
          size={13}
        />
      </g>

      {showIcr && radius !== null && (
        <g>
          <Segment
            a={centre}
            b={at(0, radius)}
            color={INK.icr}
            dashed
            width={1.2}
          />
          <Symbol at={at(0, radius)} color={INK.icr} glyph="✕" size={15} />
          <Symbol
            at={[at(0, radius)[0] + 26, at(0, radius)[1] - 12]}
            color={INK.icr}
            glyph="CIR"
            size={13}
          />
        </g>
      )}

      {/* The robot itself. */}
      <g>
        <circle
          cx={px(centre[0])}
          cy={px(centre[1])}
          r={px(chassisR)}
          fill={INK.body}
          fillOpacity={0.18}
          stroke={INK.body}
          strokeWidth={1.3}
        />
        <circle
          cx={px(at(outline.castorOffset, 0)[0])}
          cy={px(at(outline.castorOffset, 0)[1])}
          r={px(
            Math.max(
              2,
              chassisR * (outline.castorRadius / outline.chassisRadius),
            ),
          )}
          fill={INK.wheel}
          fillOpacity={0.6}
        />
        {(["l", "r"] as const).map((side) => {
          const [wx, wy] = wheelOrigin(side, outline);
          const half = outline.wheelLength / 2;
          const halfW = outline.wheelWidth / 2;
          const corners = [
            at(wx - half, wy - halfW),
            at(wx + half, wy - halfW),
            at(wx + half, wy + halfW),
            at(wx - half, wy + halfW),
          ];
          return (
            <polygon
              key={side}
              points={corners.map(([x, y]) => `${px(x)},${px(y)}`).join(" ")}
              fill={INK.wheel}
              fillOpacity={0.55}
              stroke={INK.wheel}
              strokeWidth={1}
            />
          );
        })}
        <Segment
          a={at(0, -outline.wheelOffset)}
          b={at(0, outline.wheelOffset)}
          color={INK.wheel}
          width={1.4}
        />

        <Arrow a={centre} b={at(axis, 0)} color={INK.x} width={1.4} head={7} />
        <Arrow a={centre} b={at(0, axis)} color={INK.y} width={1.4} head={7} />
      </g>

      {/* What each wheel puts down, and what the chassis does with it. */}
      <g>
        {(["l", "r"] as const).map((side) => {
          const [wx, wy] = wheelOrigin(side, outline);
          const length = velocityArrowLength(
            side === "l" ? rim.left : rim.right,
          );
          return (
            <g key={side}>
              <Arrow
                a={at(wx, wy)}
                b={at(wx + length, wy)}
                color={INK.wheelSpeed}
                width={1.8}
              />
              {Math.abs(length) > 0.02 && (
                <Symbol
                  at={at(wx + length + Math.sign(length) * 0.05, wy)}
                  color={INK.wheelSpeed}
                  glyph="v"
                  sub={side}
                />
              )}
            </g>
          );
        })}

        <Arrow
          a={centre}
          b={at(velocityArrowLength(twist.v), 0)}
          color={INK.velocity}
          width={2.6}
          head={12}
        />
        {Math.abs(twist.v) > 0.02 && (
          <Symbol
            at={at(
              velocityArrowLength(twist.v) + Math.sign(twist.v) * 0.06,
              0.05,
            )}
            color={INK.velocity}
            glyph="ẋ"
            sub={frameName}
          />
        )}
      </g>

      {/* The numbers, since the panel does not print. */}
      <text x={16} y={VIEW.height - 16} fill={INK.text} fontSize={14}>
        {`${atRest ? "exemplo" : variant === "inverso" ? "inversa" : "direta"}:  ω\u2097 = ${format(wheels.left, n)}   ω\u1D63 = ${format(wheels.right, n)} rad/s`}
        <tspan fill={INK.velocity}>
          {`   →   ẋ = ${format(twist.v, n)} m/s   θ̇ = ${format(twist.omega, n)} rad/s`}
        </tspan>
        {radius !== null && Math.abs(yawArcSweep(twist.omega)) > 0.02 && (
          <tspan fill={INK.icr}>{`   ·   v/θ̇ = ${format(radius, n)} m`}</tspan>
        )}
      </text>
    </svg>
  );
}
