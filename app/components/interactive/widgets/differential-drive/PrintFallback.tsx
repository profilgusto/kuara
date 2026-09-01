/**
 * Static SVG stand-in for `differential-drive`, drawn for paper.
 *
 * A WebGL canvas prints as a blank rectangle, so what prints is the same robot
 * seen from the same station point, drawn as outlines: the shell and the wheels
 * as projected rims rather than as solids, which is what a technical figure
 * would have used anyway. Every coordinate comes from `./robot` and goes
 * through the shared `project`, so the printed drawing cannot drift from the
 * live scene — move the camera once and both follow.
 *
 * It doubles as the widget's thumbnail in the Payload library, which is why it
 * is plain SVG with no Tailwind: the admin layout loads only Payload's CSS.
 */
import { arrowHead, project, type Camera } from "../../projection";
import type { Vec3 } from "../../props";
import type { DifferentialDriveProps } from "./index";
import {
  AXIS_LENGTH,
  CASTOR_RADIUS,
  DEFAULT_VIEW,
  GROUND_HALF,
  GROUND_Z,
  SIDES,
  VELOCITY_LENGTH,
  axisLabelAnchor,
  castorCenter,
  chassisRings,
  groundTicks,
  radiusLabelAnchor,
  radiusSegment,
  ring,
  spinArc,
  spinLabelAnchor,
  trackDimension,
  trackLabelAnchor,
  velocityLabelAnchor,
  wheelCenter,
  wheelRing,
  wheelVelocityLabelAnchor,
  wheelVelocitySegment,
  yawArc,
  yawLabelAnchor,
  type Side,
} from "./robot";

const VIEW = { width: 800, height: 470 };

/**
 * Ink-on-white colours: the screen palette is tuned for a dark surface and
 * washes out on paper, so the hues are kept but darkened.
 */
const INK = {
  x: "#c0392b",
  y: "#1e7d3c",
  z: "#1c6b76",
  grid: "#e2e6e4",
  body: "#9c4c31",
  wheel: "#394146",
  measure: "#8a7440",
  spin: "#6a4fa3",
  velocity: "#9a6410",
  blocked: "#a83f3f",
  origin: "#6b7671",
} as const;

type To2d = (p: Vec3) => [number, number] | null;

const projector =
  (camera: Camera): To2d =>
  (p: Vec3) =>
    project(p, VIEW, camera);

/** `null` when either end is behind the camera, which callers must skip. */
function segment(to2d: To2d, a: Vec3, b: Vec3) {
  const p1 = to2d(a);
  const p2 = to2d(b);
  return p1 && p2 ? { p1, p2 } : null;
}

/**
 * A run of world points as an SVG points list.
 *
 * Points the camera cannot see are dropped rather than clamped: a projected
 * coordinate from behind the lens is a mirrored ghost, and one of them in the
 * middle of a polyline drags the whole outline across the page.
 */
function points2d(to2d: To2d, points: Vec3[]): string {
  return points
    .map(to2d)
    .filter((p): p is [number, number] => p !== null)
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
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
  const seg = segment(to2d, from, to);
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

/** A straight arrow: shaft plus a screen-space head. */
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
  const seg = segment(to2d, from, to);
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

/**
 * An arc, closed by a head aimed along its final step.
 *
 * The head is placed in screen space from the arc's last two projected points
 * rather than from the world-space tangent: a cone foreshortened by the
 * projection would otherwise print as a sliver.
 */
function Arc({
  to2d,
  points,
  color,
  width = 1.8,
  head = 10,
}: {
  to2d: To2d;
  points: Vec3[];
  color: string;
  width?: number;
  head?: number;
}) {
  const flat = points
    .map(to2d)
    .filter((p): p is [number, number] => p !== null);
  if (flat.length < 2) return null;
  const tip = flat[flat.length - 1];
  const before = flat[flat.length - 2];
  const [c1, c2] = arrowHead(before, tip, head);
  return (
    <g>
      <polyline
        points={flat
          .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
          .join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`${tip[0]},${tip[1]} ${c1[0]},${c1[1]} ${c2[0]},${c2[1]}`}
        fill={color}
      />
    </g>
  );
}

/** A symbol with a subscript, e.g. x̂ᴿ or φ̇_l. */
function Symbol({
  at,
  color,
  glyph,
  sub,
  suffix,
  size = 16,
}: {
  at: [number, number] | null;
  color: string;
  glyph: string;
  sub?: string;
  suffix?: string;
  size?: number;
}) {
  if (!at) return null;
  return (
    <text
      x={at[0]}
      y={at[1]}
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
      {suffix && (
        <tspan fontSize={size * 0.9} dy={-4}>
          {suffix}
        </tspan>
      )}
    </text>
  );
}

// ─── the robot, as outlines ───────────────────────────────────────────────────

/** The floor's graduation, one square per world unit. */
function Ground({ to2d }: { to2d: To2d }) {
  const ticks = groundTicks();
  return (
    <g>
      {ticks.map((t) => (
        <Segment
          key={`x${t}`}
          to2d={to2d}
          from={[t, -GROUND_HALF, GROUND_Z]}
          to={[t, GROUND_HALF, GROUND_Z]}
          color={INK.grid}
        />
      ))}
      {ticks.map((t) => (
        <Segment
          key={`y${t}`}
          to2d={to2d}
          from={[-GROUND_HALF, t, GROUND_Z]}
          to={[GROUND_HALF, t, GROUND_Z]}
          color={INK.grid}
        />
      ))}
    </g>
  );
}

/**
 * The shell as a drum: its two rims, joined at every sixth sample.
 *
 * Drawn as a wireframe rather than a filled solid for the same reason the live
 * scene is translucent — the frame, the axle and the dimension line all pass
 * behind it, and on paper there is no second view to recover them from.
 */
function Chassis({ to2d, opacity }: { to2d: To2d; opacity: number }) {
  const [low, high] = chassisRings(48);
  const fill = Math.min(0.25, opacity * 0.5);
  return (
    <g>
      <polygon
        points={points2d(to2d, low)}
        fill={INK.body}
        fillOpacity={fill * 0.6}
        stroke={INK.body}
        strokeWidth={1}
        strokeOpacity={0.7}
      />
      {low.map(
        (p, i) =>
          i % 6 === 0 && (
            <Segment
              key={i}
              to2d={to2d}
              from={p}
              to={high[i]}
              color={INK.body}
              opacity={0.5}
            />
          ),
      )}
      <polygon
        points={points2d(to2d, high)}
        fill={INK.body}
        fillOpacity={fill}
        stroke={INK.body}
        strokeWidth={1.3}
      />
    </g>
  );
}

function Wheels({ to2d, opacity }: { to2d: To2d; opacity: number }) {
  return (
    <g>
      {SIDES.map((side) => (
        <polygon
          key={side}
          points={points2d(to2d, wheelRing(side, 48))}
          fill={INK.wheel}
          fillOpacity={Math.min(0.45, opacity + 0.1)}
          stroke={INK.wheel}
          strokeWidth={1.3}
        />
      ))}
      <polygon
        points={points2d(to2d, ring(castorCenter(), CASTOR_RADIUS, "y", 24))}
        fill={INK.wheel}
        fillOpacity={Math.min(0.45, opacity + 0.1)}
        stroke={INK.wheel}
        strokeWidth={1}
      />
      <Segment
        to2d={to2d}
        from={wheelCenter("r")}
        to={wheelCenter("l")}
        color={INK.wheel}
        width={1.6}
      />
    </g>
  );
}

const AXIS_UNIT: Record<"x" | "y" | "z", Vec3> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

const AXIS_INK = { x: INK.x, y: INK.y, z: INK.z } as const;

function Triedro({
  to2d,
  labels,
  frameName,
}: {
  to2d: To2d;
  labels: boolean;
  frameName: string;
}) {
  return (
    <g>
      {(["x", "y", "z"] as const).map((axis) => {
        const u = AXIS_UNIT[axis];
        const tip = u.map((c) => c * AXIS_LENGTH) as Vec3;
        return (
          <g key={axis}>
            <Arrow
              to2d={to2d}
              from={[0, 0, 0]}
              to={tip}
              color={AXIS_INK[axis]}
              width={2}
              head={9}
            />
            {labels && (
              <Symbol
                at={to2d(axisLabelAnchor(axis))}
                color={AXIS_INK[axis]}
                glyph={`${axis}̂`}
                sub={frameName}
                size={17}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

function TrackMeasure({ to2d }: { to2d: To2d }) {
  const { line, witness } = trackDimension();
  return (
    <g>
      {witness.map((w, i) => (
        <Segment
          key={i}
          to2d={to2d}
          from={w.from}
          to={w.to}
          color={INK.measure}
          dashed
          opacity={0.8}
        />
      ))}
      {/* A dimension is measured between two points, so it gets a head at each
          end; one head alone would read as a vector from the other. */}
      <Arrow
        to2d={to2d}
        from={line.to}
        to={line.from}
        color={INK.measure}
        width={1.5}
        head={9}
      />
      <Arrow
        to2d={to2d}
        from={line.from}
        to={line.to}
        color={INK.measure}
        width={1.5}
        head={9}
      />
      <Symbol
        at={to2d(trackLabelAnchor())}
        color={INK.measure}
        glyph="d"
        size={17}
      />
    </g>
  );
}

/**
 * `r`, drawn over the wheels rather than under them.
 *
 * The wheel is a filled outline on paper, so a radius painted before it is a
 * radius that is not there. The `d` dimension has the opposite problem and
 * stays behind: it is set out on the floor, where the robot belongs in front.
 */
function RadiusMeasures({ to2d }: { to2d: To2d }) {
  return (
    <g>
      {SIDES.map((side: Side) => {
        const seg = radiusSegment(side);
        const rim = to2d(seg.to);
        return (
          <g key={side}>
            <Segment
              to2d={to2d}
              from={seg.from}
              to={seg.to}
              color={INK.measure}
              width={1.5}
            />
            {/* Closing the line on the rim: where the measurement ends should
                not be left to the eye against the tyre's own outline. */}
            {rim && (
              <circle cx={rim[0]} cy={rim[1]} r={2.6} fill={INK.measure} />
            )}
            <Symbol
              at={to2d(radiusLabelAnchor(side))}
              color={INK.measure}
              glyph="r"
              size={16}
            />
          </g>
        );
      })}
    </g>
  );
}

function WheelSpeeds({ to2d }: { to2d: To2d }) {
  return (
    <g>
      {SIDES.map((side: Side) => {
        const v = wheelVelocitySegment(side);
        return (
          <g key={side}>
            <Arc to2d={to2d} points={spinArc(side)} color={INK.spin} />
            <Symbol
              at={to2d(spinLabelAnchor(side))}
              color={INK.spin}
              glyph={"ω"}
              sub={side}
              size={17}
            />
            <Arrow
              to2d={to2d}
              from={v.from}
              to={v.to}
              color={INK.spin}
              width={1.8}
              head={10}
            />
            <Symbol
              at={to2d(wheelVelocityLabelAnchor(side))}
              color={INK.spin}
              glyph="v"
              sub={side}
              size={17}
            />
          </g>
        );
      })}
    </g>
  );
}

function ChassisSpeeds({ to2d, frameName }: { to2d: To2d; frameName: string }) {
  const arc = yawArc();
  return (
    <g>
      <Arrow
        to2d={to2d}
        from={[0, 0, 0]}
        to={[VELOCITY_LENGTH, 0, 0]}
        color={INK.velocity}
        width={2.2}
        head={12}
      />
      <Symbol
        at={to2d(velocityLabelAnchor("x"))}
        color={INK.velocity}
        glyph={"ẋ"}
        sub={frameName}
        size={17}
      />

      <Arc to2d={to2d} points={arc} color={INK.velocity} width={2} head={11} />
      <Symbol
        at={to2d(yawLabelAnchor())}
        color={INK.velocity}
        glyph={"θ̇"}
        sub={frameName}
        size={17}
      />

      {/* The direction the wheels cannot drive: dashed, headless, and written
          out as the zero it is — the middle row of the kinematic model. */}
      <Segment
        to2d={to2d}
        from={[0, 0, 0]}
        to={[0, VELOCITY_LENGTH, 0]}
        color={INK.blocked}
        width={2}
        dashed
      />
      <Symbol
        at={to2d(velocityLabelAnchor("y"))}
        color={INK.blocked}
        glyph={"ẏ"}
        sub={frameName}
        suffix=" = 0"
        size={17}
      />
    </g>
  );
}

export default function DifferentialDrivePrint({
  frameName,
  labels,
  measures,
  wheelSpeeds,
  chassisSpeeds,
  grid,
  opacity,
}: DifferentialDriveProps) {
  const to2d = projector(DEFAULT_VIEW);
  const origin = to2d([0, 0, 0]);

  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className="mx-auto block w-full max-w-2xl"
      role="img"
      aria-label={`Robô diferencial com o frame ${frameName} na origem do eixo das rodas, o raio r, a bitola d, as velocidades angulares ω e lineares v de cada roda e as velocidades do chassi`}
    >
      {grid && <Ground to2d={to2d} />}
      {measures && <TrackMeasure to2d={to2d} />}
      <Chassis to2d={to2d} opacity={opacity} />
      <Wheels to2d={to2d} opacity={opacity} />
      {measures && <RadiusMeasures to2d={to2d} />}
      <Triedro to2d={to2d} labels={labels} frameName={frameName} />

      {origin && (
        <g>
          <circle cx={origin[0]} cy={origin[1]} r={3.5} fill={INK.origin} />
          {labels && (
            /* Nudged in screen space, away from the three arrows that all
               start on top of it — the same offset the live scene uses. */
            <Symbol
              at={[origin[0] - 16, origin[1] + 16]}
              color={INK.origin}
              glyph="O"
              sub={frameName}
              size={17}
            />
          )}
        </g>
      )}

      {wheelSpeeds && <WheelSpeeds to2d={to2d} />}
      {chassisSpeeds && <ChassisSpeeds to2d={to2d} frameName={frameName} />}
    </svg>
  );
}
