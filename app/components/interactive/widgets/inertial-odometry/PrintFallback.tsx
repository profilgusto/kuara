/**
 * Static SVG stand-in for `inertial-odometry`, drawn for paper.
 *
 * The screen version's subject is a motion, so the still shows the motion's
 * record: the fixed frame at the origin, the path the robot ran from it, the
 * robot part of the way along, the position vector and the angle that make up
 * its pose, and the odometry's own dotted path beside the real one so the gap
 * the section warns about is visible on paper too.
 *
 * Both paths are computed here with exactly the functions the live block uses
 * — `advance` for the robot, `integrate` for the estimate — so the printed
 * figure cannot claim a motion the widget would not perform.
 *
 * It doubles as the widget's thumbnail in the Payload library, which is why it
 * is plain SVG with no Tailwind: the admin layout loads only Payload's CSS.
 */
import {
  ORIGIN_POSE,
  advance,
  clampWheels,
  format,
  forward,
  quantisePose,
  robotOutline,
  svgScale,
  velocityArrowLength,
  wheelOrigin,
  worldToSvg,
  type BodyTwist,
  type Pose,
  type RobotParams,
  type Viewport,
} from "../../differential";
import {
  ODOMETRY_START,
  baseHalfExtent,
  elapsedTime,
  gridCellFor,
  headingArc,
  inertialTwist,
  integrate,
  toDegrees,
} from "./odometry";
import type { InertialOdometryProps } from "./index";

const VIEW: Viewport = { width: 800, height: 430 };

/**
 * What the drawing falls back to when the block is authored at rest — the
 * widget opens stopped on purpose, and a still of a stopped robot has no
 * path, no pose worth reading and no odometry to compare it against.
 */
const EXAMPLE_WHEELS = { left: 3, right: 6 };
const AT_REST = 1e-6;

/** How long a run the still summarises, and how finely it is sampled. */
const PRINTED_SECONDS = 6;
const SAMPLES = 200;

const INK = {
  x: "#c0392b",
  y: "#1e7d3c",
  grid: "#e2e6e4",
  body: "#9c4c31",
  wheel: "#394146",
  velocity: "#9a6410",
  path: "#1c6b76",
  odometry: "#8a7440",
  position: "#a85a22",
  text: "#2c3331",
} as const;

type To2d = (point: [number, number]) => [number, number];

/** Rounded on the way into the markup: this drawing is hydrated, and a last-bit
 * disagreement between Node and the browser would read as a mismatch. */
function px(value: number): number {
  return Number(value.toFixed(2));
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
  sup,
  size = 15,
}: {
  at: [number, number];
  color: string;
  glyph: string;
  sub?: string;
  sup?: string;
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
      {sup && (
        <tspan fontSize={size * 0.65} dy={-5}>
          {sup}
        </tspan>
      )}
      <tspan dy={sup ? 5 : 0}>{glyph}</tspan>
      {sub && (
        <tspan fontSize={size * 0.65} dy={4}>
          {sub}
        </tspan>
      )}
    </text>
  );
}

/** The floor, ruled in whatever round unit suits the zoom. */
function Ground({ to2d, halfExtent }: { to2d: To2d; halfExtent: number }) {
  const cell = gridCellFor(halfExtent);
  const reach = halfExtent * 2;
  const ticks: number[] = [];
  for (let t = -reach; t <= reach + 1e-9; t += cell) {
    ticks.push(Number(t.toFixed(4)));
  }
  return (
    <g>
      {ticks.map((t) => (
        <Segment
          key={`v${t}`}
          a={to2d([t, -reach])}
          b={to2d([t, reach])}
          color={INK.grid}
        />
      ))}
      {ticks.map((t) => (
        <Segment
          key={`h${t}`}
          a={to2d([-reach, t])}
          b={to2d([reach, t])}
          color={INK.grid}
        />
      ))}
    </g>
  );
}

/** Samples of both integrations over the printed run. */
function samplePaths(twist: BodyTwist, step: number) {
  const truth: Pose[] = [];
  const estimate: Pose[] = [];
  const dt = PRINTED_SECONDS / SAMPLES;

  let pose: Pose = ORIGIN_POSE;
  let odometry = ODOMETRY_START;
  for (let i = 0; i <= SAMPLES; i++) {
    // Quantised for the same reason the other robot widget quantises: this is
    // server-rendered and hydrated, and sin/cos disagree in the last bit
    // between Node and the browser.
    truth.push(quantisePose(pose));
    estimate.push(quantisePose(odometry.pose));
    pose = advance(pose, twist, dt);
    odometry = integrate(odometry, twist, dt, step);
  }
  return { truth, estimate, odometry };
}

function Path({
  poses,
  to2d,
  color,
  dashed,
  width,
}: {
  poses: Pose[];
  to2d: To2d;
  color: string;
  dashed?: boolean;
  width: number;
}) {
  return (
    <polyline
      points={poses
        .map((p) => {
          const [x, y] = to2d([p.x, p.y]);
          return `${px(x)},${px(y)}`;
        })
        .join(" ")}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dashed ? "4 4" : undefined}
    />
  );
}

export default function InertialOdometryPrint({
  wheelRadius,
  track,
  leftSpeed,
  rightSpeed,
  step,
  components,
  decimals,
  frameName,
  inertialName,
}: InertialOdometryProps) {
  const params: RobotParams = { r: wheelRadius, d: track };
  const outline = robotOutline(params);

  const authored = clampWheels({ left: leftSpeed, right: rightSpeed });
  const atRest =
    Math.abs(authored.left) < AT_REST && Math.abs(authored.right) < AT_REST;
  const wheels = atRest ? EXAMPLE_WHEELS : authored;
  const twist = forward(wheels, params);

  const { truth, estimate, odometry } = samplePaths(twist, step);
  const pose = truth[truth.length - 1];
  const guess = estimate[estimate.length - 1];

  // On paper the view cannot open as the robot leaves, so it starts open —
  // framed on what is actually drawn rather than on the world origin. A run
  // that curls away into one quadrant would otherwise print in a corner with
  // three quarters of the page blank, which is what centring on {I} gives.
  const bounds = truth.concat(estimate).reduce(
    (box, p) => ({
      minX: Math.min(box.minX, p.x),
      maxX: Math.max(box.maxX, p.x),
      minY: Math.min(box.minY, p.y),
      maxY: Math.max(box.maxY, p.y),
    }),
    // The origin is always in frame: the pose is measured from it, and a
    // position vector with one end off the page measures nothing.
    { minX: 0, maxX: 0, minY: 0, maxY: 0 },
  );
  const centre: [number, number] = [
    (bounds.minX + bounds.maxX) / 2,
    (bounds.minY + bounds.maxY) / 2,
  ];
  // `worldToSvg` scales by the page's shorter side, so the wider one holds
  // proportionally more world; dividing by the aspect is what lets a wide run
  // use the width it has.
  const aspect = VIEW.width / VIEW.height;
  const halfExtent =
    Math.max(
      (bounds.maxY - bounds.minY) / 2,
      (bounds.maxX - bounds.minX) / 2 / aspect,
      baseHalfExtent(track),
    ) * 1.25;
  const to2d: To2d = (point) =>
    worldToSvg([point[0] - centre[0], point[1] - centre[1]], VIEW, halfExtent);
  const scale = svgScale(VIEW, halfExtent);

  const at = (x: number, y: number): [number, number] => {
    const c = Math.cos(pose.theta);
    const s = Math.sin(pose.theta);
    return to2d([pose.x + c * x - s * y, pose.y + s * x + c * y]);
  };

  const origin = to2d([0, 0]);
  const frameSize = halfExtent * 0.22;
  const [ix, iy] = inertialTwist(twist, pose.theta);
  const tip = to2d([
    pose.x + velocityArrowLength(ix),
    pose.y + velocityArrowLength(iy),
  ]);
  const corner = to2d([pose.x + velocityArrowLength(ix), pose.y]);
  const n = decimals;

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`Robô diferencial visto de cima a partir do frame inercial ${inertialName}, com o percurso, o vetor posição e a pose calculada por odometria`}
    >
      <Ground to2d={to2d} halfExtent={halfExtent} />

      <Path poses={truth} to2d={to2d} color={INK.path} width={2} />
      <Path
        poses={estimate}
        to2d={to2d}
        color={INK.odometry}
        width={1.6}
        dashed
      />

      {/* The fixed frame, and the vector from it to the robot. */}
      <g>
        <Arrow
          a={origin}
          b={to2d([frameSize, 0])}
          color={INK.x}
          width={1.8}
          head={8}
        />
        <Arrow
          a={origin}
          b={to2d([0, frameSize])}
          color={INK.y}
          width={1.8}
          head={8}
        />
        <Symbol
          at={to2d([frameSize * 1.2, 0])}
          color={INK.x}
          glyph="x̂"
          sub={inertialName}
        />
        <Symbol
          at={to2d([0, frameSize * 1.2])}
          color={INK.y}
          glyph="ŷ"
          sub={inertialName}
        />
        <Symbol
          at={to2d([-frameSize * 0.3, -frameSize * 0.3])}
          color={INK.text}
          glyph={`{${inertialName}}`}
          size={13}
        />
      </g>

      <g>
        <Arrow
          a={origin}
          b={to2d([pose.x, pose.y])}
          color={INK.position}
          width={2}
          head={10}
        />
        <Symbol
          at={to2d([
            pose.x / 2 - halfExtent * 0.06,
            pose.y / 2 + halfExtent * 0.06,
          ])}
          color={INK.position}
          glyph="p"
          sup={inertialName}
          sub={frameName}
        />
      </g>

      {/* θ, from the direction {I} calls forward round to the heading. */}
      <g>
        <Segment
          a={to2d([pose.x, pose.y])}
          b={to2d([pose.x + halfExtent * 0.22, pose.y])}
          color={INK.text}
          dashed
          opacity={0.5}
        />
        <polyline
          points={headingArc(pose, halfExtent * 0.13)
            .map(([x, y]) => {
              const [sx, sy] = to2d([x, y]);
              return `${px(sx)},${px(sy)}`;
            })
            .join(" ")}
          fill="none"
          stroke={INK.text}
          strokeWidth={1.4}
          strokeOpacity={0.7}
        />
        <Symbol
          at={to2d([
            pose.x + halfExtent * 0.18 * Math.cos(pose.theta / 2),
            pose.y + halfExtent * 0.18 * Math.sin(pose.theta / 2),
          ])}
          color={INK.text}
          glyph="θ"
        />
      </g>

      {/* The odometry's own idea of where the robot is. */}
      <circle
        cx={px(to2d([guess.x, guess.y])[0])}
        cy={px(to2d([guess.x, guess.y])[1])}
        r={px(outline.chassisRadius * scale)}
        fill="none"
        stroke={INK.odometry}
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />

      {/* The robot. */}
      <g>
        <circle
          cx={px(at(0, 0)[0])}
          cy={px(at(0, 0)[1])}
          r={px(outline.chassisRadius * scale)}
          fill={INK.body}
          fillOpacity={0.18}
          stroke={INK.body}
          strokeWidth={1.3}
        />
        {(["l", "r"] as const).map((side) => {
          const [wx, wy] = wheelOrigin(side, outline);
          const half = outline.wheelLength / 2;
          const halfW = outline.wheelWidth / 2;
          return (
            <polygon
              key={side}
              points={[
                at(wx - half, wy - halfW),
                at(wx + half, wy - halfW),
                at(wx + half, wy + halfW),
                at(wx - half, wy + halfW),
              ]
                .map(([x, y]) => `${px(x)},${px(y)}`)
                .join(" ")}
              fill={INK.wheel}
              fillOpacity={0.55}
              stroke={INK.wheel}
              strokeWidth={1}
            />
          );
        })}
        <Arrow
          a={at(0, 0)}
          b={at(outline.chassisRadius * 0.85, 0)}
          color={INK.x}
          width={1.4}
          head={6}
        />
      </g>

      {/* The velocity, and the two components the transform resolves it into. */}
      <g>
        <Arrow
          a={at(0, 0)}
          b={tip}
          color={INK.velocity}
          width={2.4}
          head={11}
        />
        {components && (
          <>
            <Segment a={at(0, 0)} b={corner} color={INK.velocity} dashed />
            <Segment a={corner} b={tip} color={INK.velocity} dashed />
            <Symbol
              at={[(at(0, 0)[0] + corner[0]) / 2, corner[1] + 14]}
              color={INK.velocity}
              glyph="ẋ"
              sub={inertialName}
              size={13}
            />
            <Symbol
              at={[corner[0] + 16, (corner[1] + tip[1]) / 2]}
              color={INK.velocity}
              glyph="ẏ"
              sub={inertialName}
              size={13}
            />
          </>
        )}
      </g>

      <text x={16} y={VIEW.height - 16} fill={INK.text} fontSize={13}>
        {`${atRest ? "exemplo" : "autorado"}:  ωₗ = ${format(wheels.left, n)}   ωᵣ = ${format(wheels.right, n)} rad/s   ·   Δt = ${format(step, 2)} s`}
        <tspan fill={INK.position}>
          {`   →   ᴵξ${frameName}(${format(elapsedTime(odometry, step), 1)} s) = (${format(guess.x, n)} m, ${format(guess.y, n)} m, ${format(toDegrees(guess.theta), 0)}°)`}
        </tspan>
      </text>
    </svg>
  );
}
