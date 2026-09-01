"use client";
/**
 * Widget `inertial-odometry` — the same robot, now measured from somewhere.
 *
 * "Velocidades do robô em relação a um frame inercial" does two things to the
 * velocities the previous section derived: it turns them into a fixed frame,
 * and then it adds them up. This block shows both at once. The robot drives;
 * the panel prints ᴵξ̇_R = ᵀR_R ᴿξ̇_R with the rotation matrix filled in at the
 * current heading, and underneath it the running sum that is the pose.
 *
 * What separates it from `differential-kinematics`, deliberately:
 *
 *   - **The camera frames the pair, not the robot.** There the robot was the
 *     subject and the floor slid under it; here the subject is the robot *and*
 *     the origin, because a pose only means something with respect to
 *     something. So the view sits between them and opens as they part, and the
 *     position vector spanning them is drawn.
 *   - **Two paths, not one.** The robot runs the exact arc; the odometry runs
 *     the section's discrete sum, at its own Δt, and is drawn as a ghost with
 *     a dotted trail. At the default step they part by a couple of centimetres
 *     over a turn — visible, which is the point the text closes on. Drawing
 *     only the sum would have hidden its own error.
 *
 * The model is shared with the other robot widget (`../../differential`); the
 * integration and the framing are this widget's own (`./odometry`).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { RotateCcw } from "lucide-react";
import {
  ORIGIN_POSE,
  WHEEL_SPEED_MAX,
  advance,
  bodyLimits,
  clampTwist,
  clampWheels,
  format,
  forward,
  inverse,
  robotOutline,
  velocityArrowLength,
  wheelOrigin,
  type BodyTwist,
  type Pose,
  type RobotOutline,
  type RobotParams,
  type WheelSpeeds,
} from "../../differential";
import {
  ODOMETRY_START,
  baseHalfExtent,
  elapsedTime,
  fitCentre,
  fitHalfExtent,
  gridCellFor,
  headingArc,
  inertialTwist,
  integrate,
  positionMagnitude,
  rotationMatrix,
  toDegrees,
  type OdometryState,
} from "./odometry";

export interface InertialOdometryProps {
  wheelRadius: number;
  track: number;
  leftSpeed: number;
  rightSpeed: number;
  step: number;
  trail: boolean;
  components: boolean;
  decimals: number;
  frameName: string;
  inertialName: string;
  /** Which view the box's header switch has selected: "direto" or "inverso". */
  variant?: string;
}

const COLORS = {
  x: "#e05252",
  y: "#3faf5c",
  neutral: "#8a9a94",
  body: "#c2603f",
  wheel: "#5c666e",
  wheelSpeed: "#9b7bd4",
  velocity: "#c98a3f",
  trail: "#2fa8b8",
  /** The odometry's own colour: its ghost, its dotted path, its numbers. */
  odometry: "#c9bfa3",
  position: "#d08a4f",
} as const;

const TRAIL_CAPACITY = 3000;
const TRAIL_STEP_FRACTION = 0.004;
const MAX_FRAME = 0.05;
const MOVING_EPS = 1e-6;

// ─── flat drawing primitives ──────────────────────────────────────────────────

/** An arrowhead in the plane: a three-segment circle is a triangle. */
function Head2D({
  at,
  angle,
  size,
  color,
}: {
  at: [number, number];
  angle: number;
  size: number;
  color: string;
}) {
  return (
    <mesh position={[at[0], at[1], 0]} rotation={[0, 0, angle]}>
      <circleGeometry args={[size, 3]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/** A straight arrow between two points of the plane. */
function Arrow2D({
  from,
  to,
  color,
  width = 2,
  head = 0.02,
  dashed = false,
}: {
  from: [number, number];
  to: [number, number];
  color: string;
  width?: number;
  head?: number;
  dashed?: boolean;
}) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  // Nothing to draw, and no direction to aim a head along.
  if (length < 1e-6) return null;

  return (
    <group>
      <Line
        points={[
          [from[0], from[1], 0],
          [to[0], to[1], 0],
        ]}
        color={color}
        lineWidth={width}
        dashed={dashed}
        dashSize={dashed ? length / 14 : undefined}
        gapSize={dashed ? length / 20 : undefined}
      />
      <Head2D at={to} angle={Math.atan2(dy, dx)} size={head} color={color} />
    </group>
  );
}

function Label({
  at,
  color,
  children,
}: {
  at: [number, number];
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Html
      position={[at[0], at[1], 0]}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="whitespace-nowrap text-sm font-bold not-italic"
        style={{ color }}
      >
        {children}
      </span>
    </Html>
  );
}

// ─── the robot, from above ────────────────────────────────────────────────────

/**
 * The robot drawn in its own frame. `ghost` is the odometry's copy of it:
 * outline only, so the reader can tell an estimate from a robot at a glance.
 */
function Robot({
  outline,
  ghost = false,
}: {
  outline: RobotOutline;
  ghost?: boolean;
}) {
  const color = ghost ? COLORS.odometry : COLORS.body;
  return (
    <group>
      <mesh>
        <circleGeometry args={[outline.chassisRadius, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={ghost ? 0.12 : 0.3}
        />
      </mesh>
      {!ghost && (
        <>
          <mesh position={[outline.castorOffset, 0, 0]}>
            <circleGeometry args={[outline.castorRadius, 20]} />
            <meshBasicMaterial color={COLORS.wheel} />
          </mesh>
          {(["l", "r"] as const).map((side) => {
            const [wx, wy] = wheelOrigin(side, outline);
            return (
              <mesh key={side} position={[wx, wy, 0]}>
                <planeGeometry
                  args={[outline.wheelLength, outline.wheelWidth]}
                />
                <meshBasicMaterial color={COLORS.wheel} />
              </mesh>
            );
          })}
          <Line
            points={[
              [0, -outline.wheelOffset, 0],
              [0, outline.wheelOffset, 0],
            ]}
            color={COLORS.wheel}
            lineWidth={1.5}
          />
        </>
      )}

      {/* The heading, which is what θ measures. */}
      <Arrow2D
        from={[0, 0]}
        to={[outline.chassisRadius * 0.85, 0]}
        color={ghost ? COLORS.odometry : COLORS.x}
        width={ghost ? 1 : 1.5}
        head={0.012}
        dashed={ghost}
      />
      {!ghost && (
        <Arrow2D
          from={[0, 0]}
          to={[0, outline.chassisRadius * 0.85]}
          color={COLORS.y}
          width={1.5}
          head={0.012}
        />
      )}
    </group>
  );
}

/** The fixed frame everything on the stage is measured against. */
function InertialFrame({ size, name }: { size: number; name: string }) {
  return (
    <group>
      <Arrow2D
        from={[0, 0]}
        to={[size, 0]}
        color={COLORS.x}
        width={2}
        head={0.02}
      />
      <Arrow2D
        from={[0, 0]}
        to={[0, size]}
        color={COLORS.y}
        width={2}
        head={0.02}
      />
      <Label at={[size * 1.15, 0]} color={COLORS.x}>
        x̂<sub className="text-[0.7em]">{name}</sub>
      </Label>
      <Label at={[0, size * 1.15]} color={COLORS.y}>
        ŷ<sub className="text-[0.7em]">{name}</sub>
      </Label>
      <Label at={[-size * 0.28, -size * 0.28]} color={COLORS.neutral}>
        {`{${name}}`}
      </Label>
      <mesh>
        <circleGeometry args={[size * 0.045, 16]} />
        <meshBasicMaterial color={COLORS.neutral} />
      </mesh>
    </group>
  );
}

/**
 * What the odometry has worked out: the vector from the origin to the pose it
 * believes, and the angle it believes the robot is turned by.
 *
 * Drawn against the *estimate* rather than against the robot, because these
 * are the two numbers the panel prints, and a figure whose arrow pointed
 * somewhere other than its own caption would be worse than no figure.
 */
function OdometryMarks({
  pose,
  scale,
  frameName,
  inertialName,
}: {
  pose: Pose;
  scale: number;
  frameName: string;
  inertialName: string;
}) {
  const distance = positionMagnitude(pose);
  const arc = headingArc(pose, scale * 0.9);

  return (
    <group>
      {distance > 1e-4 && (
        <>
          <Arrow2D
            from={[0, 0]}
            to={[pose.x, pose.y]}
            color={COLORS.position}
            width={2.4}
            head={scale * 0.22}
          />
          <Label
            at={[pose.x * 0.5 - scale * 0.5, pose.y * 0.5 + scale * 0.5]}
            color={COLORS.position}
          >
            <sup className="text-[0.7em]">{inertialName}</sup>p
            <sub className="text-[0.7em]">{frameName}</sub>
          </Label>
        </>
      )}

      {/* θ, swept from the direction {I} calls forward round to the heading. */}
      <Line
        points={[
          [pose.x, pose.y, 0],
          [pose.x + scale * 1.5, pose.y, 0],
        ]}
        color={COLORS.neutral}
        lineWidth={1}
        dashed
        dashSize={scale * 0.16}
        gapSize={scale * 0.16}
      />
      {Math.abs(pose.theta) > 0.05 && (
        <>
          <Line
            points={arc.map(([x, y]) => [x, y, 0] as [number, number, number])}
            color={COLORS.neutral}
            lineWidth={1.5}
          />
          <Label
            at={[
              pose.x + scale * 1.3 * Math.cos(pose.theta / 2),
              pose.y + scale * 1.3 * Math.sin(pose.theta / 2),
            ]}
            color={COLORS.neutral}
          >
            θ
          </Label>
        </>
      )}
    </group>
  );
}

/**
 * The velocity at the robot, and the two components the transform resolves it
 * into — drawn as the legs of the right triangle they form.
 */
function VelocityComponents({
  pose,
  twist,
  show,
  inertialName,
}: {
  pose: Pose;
  twist: BodyTwist;
  show: boolean;
  inertialName: string;
}) {
  const [dx, dy] = inertialTwist(twist, pose.theta);
  const tip: [number, number] = [
    pose.x + velocityArrowLength(dx),
    pose.y + velocityArrowLength(dy),
  ];
  const corner: [number, number] = [tip[0], pose.y];

  if (Math.abs(twist.v) < 1e-4) return null;

  return (
    <group>
      <Arrow2D
        from={[pose.x, pose.y]}
        to={tip}
        color={COLORS.velocity}
        width={3}
        head={0.026}
      />
      {show && (
        <>
          <Arrow2D
            from={[pose.x, pose.y]}
            to={corner}
            color={COLORS.velocity}
            width={1.4}
            head={0.016}
            dashed
          />
          <Arrow2D
            from={corner}
            to={tip}
            color={COLORS.velocity}
            width={1.4}
            head={0.016}
            dashed
          />
          <Label
            at={[(pose.x + corner[0]) / 2, pose.y - 0.055]}
            color={COLORS.velocity}
          >
            ẋ<sub className="text-[0.7em]">{inertialName}</sub>
          </Label>
          <Label
            at={[tip[0] + 0.055, (pose.y + tip[1]) / 2]}
            color={COLORS.velocity}
          >
            ẏ<sub className="text-[0.7em]">{inertialName}</sub>
          </Label>
        </>
      )}
    </group>
  );
}

// ─── the moving parts ─────────────────────────────────────────────────────────

interface Movers {
  robot: React.RefObject<THREE.Group | null>;
  ghost: React.RefObject<THREE.Group | null>;
  marks: React.RefObject<THREE.Group | null>;
  truth: React.MutableRefObject<Pose>;
  odometry: React.MutableRefObject<OdometryState>;
  trails: { truth: THREE.Line; estimate: THREE.Line };
  written: React.MutableRefObject<{ truth: number; estimate: number }>;
  /** Set when the pose changed enough that the React tree needs redrawing. */
  version: React.MutableRefObject<number>;
}

/**
 * One `useFrame` for the whole stage: the robot's exact motion, the odometry's
 * stepped motion, both trails, and the zoom that keeps the pair in view.
 *
 * The two integrations are deliberately different — see the module header —
 * and running them side by side here is what keeps them on the same clock.
 */
function Motion({
  twist,
  movers,
  step,
  base,
  recordTrail,
  onPose,
}: {
  twist: BodyTwist;
  movers: Movers;
  step: number;
  base: number;
  recordTrail: boolean;
  onPose: (pose: Pose) => void;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const extent = useRef(base);
  const centre = useRef<[number, number]>([0, 0]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_FRAME);

    const truth = advance(movers.truth.current, twist, dt);
    movers.truth.current = truth;
    movers.odometry.current = integrate(
      movers.odometry.current,
      twist,
      dt,
      step,
    );
    const guess = movers.odometry.current.pose;

    if (movers.robot.current) {
      movers.robot.current.position.set(truth.x, truth.y, 0);
      movers.robot.current.rotation.z = truth.theta;
    }
    if (movers.ghost.current) {
      movers.ghost.current.position.set(guess.x, guess.y, 0);
      movers.ghost.current.rotation.z = guess.theta;
    }

    if (recordTrail) {
      pushTrail(
        movers.trails.truth,
        movers.written.current,
        "truth",
        truth,
        base,
      );
      pushTrail(
        movers.trails.estimate,
        movers.written.current,
        "estimate",
        guess,
        base,
      );
    }

    // The view frames the pair — origin and robot — and opens as they part;
    // smoothed, so a student dragging a slider does not get a jolt with it.
    const wanted = fitHalfExtent(base, truth);
    const [wx, wy] = fitCentre(truth);
    const ease = Math.min(1, dt * 3);
    extent.current += (wanted - extent.current) * ease;
    centre.current[0] += (wx - centre.current[0]) * ease;
    centre.current[1] += (wy - centre.current[1]) * ease;
    camera.position.set(centre.current[0], centre.current[1], 5);
    const zoom = Math.min(size.width, size.height) / (2 * extent.current);
    if (camera.zoom !== zoom) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }

    // The marks and the panel are React, and redrawing them every frame would
    // undo the point of keeping the pose in a ref. Ten times a second is
    // faster than a reader can follow a number and cheap enough to ignore.
    movers.version.current += dt;
    if (movers.version.current >= 0.1) {
      movers.version.current = 0;
      onPose(guess);
    }
  });

  return null;
}

/** Append a point to one of the trails, if the robot has gone far enough. */
function pushTrail(
  line: THREE.Line,
  written: { truth: number; estimate: number },
  key: "truth" | "estimate",
  pose: Pose,
  base: number,
) {
  const attribute = line.geometry.getAttribute(
    "position",
  ) as THREE.BufferAttribute;
  const array = attribute.array as Float32Array;
  let count = written[key];

  if (count > 0) {
    const dx = pose.x - array[(count - 1) * 3];
    const dy = pose.y - array[(count - 1) * 3 + 1];
    if (Math.hypot(dx, dy) < base * TRAIL_STEP_FRACTION) return;
  }

  if (count >= TRAIL_CAPACITY) {
    const keep = Math.floor(TRAIL_CAPACITY / 2);
    array.copyWithin(0, (TRAIL_CAPACITY - keep) * 3, TRAIL_CAPACITY * 3);
    count = keep;
  }

  array[count * 3] = pose.x;
  array[count * 3 + 1] = pose.y;
  array[count * 3 + 2] = 0;
  written[key] = count + 1;
  attribute.needsUpdate = true;
  line.geometry.setDrawRange(0, count + 1);
}

/** Builds one trail line, ready to be filled in a frame at a time. */
function makeTrail(color: string, dotted: boolean): THREE.Line {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(TRAIL_CAPACITY * 3), 3),
  );
  geometry.setDrawRange(0, 0);
  const material = dotted
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 0.02,
        gapSize: 0.02,
      })
    : new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geometry, material);
  // The bounding sphere is computed once, from a buffer still full of zeros,
  // so three.js would cull the whole trail as soon as the robot left the
  // origin — which is the only place it ever goes.
  line.frustumCulled = false;
  return line;
}

// ─── panel ────────────────────────────────────────────────────────────────────

function Matrix({ rows }: { rows: string[][] }) {
  return (
    <span className="inline-flex items-stretch text-foreground">
      <span className="w-1.5 rounded-l-sm border-y border-l border-muted-foreground/70" />
      <span className="flex flex-col gap-0.5 px-1.5 py-0.5 leading-tight">
        {rows.map((row, i) => (
          <span key={i} className="flex justify-end gap-2 tabular-nums">
            {row.map((cell, j) => (
              <span key={j} className="min-w-[2.6em] text-right">
                {cell}
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="w-1.5 rounded-r-sm border-y border-r border-muted-foreground/70" />
    </span>
  );
}

function Slider({
  label,
  unit,
  value,
  min,
  max,
  step,
  color,
  onChange,
}: {
  label: React.ReactNode;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="w-8 text-right font-bold not-italic" style={{ color }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer sm:w-36"
        style={{ accentColor: color }}
      />
      <span className="w-20 text-left tabular-nums text-muted-foreground">
        {value.toFixed(2)} {unit}
      </span>
    </label>
  );
}

// ─── the widget ───────────────────────────────────────────────────────────────

export default function InertialOdometry({
  wheelRadius,
  track,
  leftSpeed,
  rightSpeed,
  step,
  trail,
  components,
  decimals,
  frameName,
  inertialName,
  variant,
}: InertialOdometryProps) {
  const params: RobotParams = useMemo(
    () => ({ r: wheelRadius, d: track }),
    [wheelRadius, track],
  );
  const outline = useMemo(() => robotOutline(params), [params]);
  const base = baseHalfExtent(track);
  const inverseMode = variant === "inverso";

  const [wheels, setWheels] = useState<WheelSpeeds>(() =>
    clampWheels({ left: leftSpeed, right: rightSpeed }),
  );
  // A sampled copy of the odometry, for the parts that are React: the panel's
  // numbers and the marks drawn against the estimate. Ten times a second.
  const [shown, setShown] = useState<Pose>(ORIGIN_POSE);
  const [steps, setSteps] = useState(0);

  const twist = forward(wheels, params);
  const limits = bodyLimits(params);
  const moving =
    Math.abs(twist.v) > MOVING_EPS || Math.abs(twist.omega) > MOVING_EPS;

  useEffect(() => {
    if (!inverseMode) return;
    setWheels((prev) => {
      const held = clampTwist(forward(prev, params), params);
      return clampWheels(inverse(held, params));
    });
  }, [inverseMode, params]);

  const truthRef = useRef<Pose>(ORIGIN_POSE);
  const odometryRef = useRef<OdometryState>(ODOMETRY_START);
  const robotRef = useRef<THREE.Group>(null);
  const ghostRef = useRef<THREE.Group>(null);
  const marksRef = useRef<THREE.Group>(null);
  const writtenRef = useRef({ truth: 0, estimate: 0 });
  const versionRef = useRef(0);

  const trails = useMemo(
    () => ({
      truth: makeTrail(COLORS.trail, false),
      estimate: makeTrail(COLORS.odometry, false),
    }),
    [],
  );

  useEffect(() => {
    const { truth, estimate } = trails;
    return () => {
      for (const line of [truth, estimate]) {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
    };
  }, [trails]);

  const movers: Movers = {
    robot: robotRef,
    ghost: ghostRef,
    marks: marksRef,
    truth: truthRef,
    odometry: odometryRef,
    trails,
    written: writtenRef,
    version: versionRef,
  };

  const reset = () => {
    setWheels({ left: 0, right: 0 });
    truthRef.current = ORIGIN_POSE;
    odometryRef.current = ODOMETRY_START;
    writtenRef.current = { truth: 0, estimate: 0 };
    trails.truth.geometry.setDrawRange(0, 0);
    trails.estimate.geometry.setDrawRange(0, 0);
    setShown(ORIGIN_POSE);
    setSteps(0);
    for (const ref of [robotRef, ghostRef]) {
      if (ref.current) {
        ref.current.position.set(0, 0, 0);
        ref.current.rotation.z = 0;
      }
    }
  };

  const onPose = (pose: Pose) => {
    setShown(pose);
    setSteps(odometryRef.current.steps);
  };

  const n = decimals;
  const m = rotationMatrix(shown.theta);
  const [ix, iy, itheta] = inertialTwist(twist, shown.theta);
  const elapsed = elapsedTime({ ...odometryRef.current, steps }, step);
  const markScale = base * 0.16;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Canvas
          orthographic
          frameloop={moving ? "always" : "demand"}
          camera={{ position: [0, 0, 5], up: [0, 1, 0], near: 0.1, far: 50 }}
          style={{ touchAction: "none" }}
        >
          <Motion
            twist={twist}
            movers={movers}
            step={step}
            base={base}
            recordTrail={trail}
            onPose={onPose}
          />

          <gridHelper
            args={[
              2 * base * 12,
              Math.round((2 * base * 12) / gridCellFor(base * 3)),
              COLORS.neutral,
              COLORS.neutral,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
          />

          {trail && (
            <>
              <primitive object={trails.truth} />
              <primitive object={trails.estimate} />
            </>
          )}

          <InertialFrame size={base * 0.34} name={inertialName} />

          <group ref={marksRef}>
            <OdometryMarks
              pose={shown}
              scale={markScale}
              frameName={frameName}
              inertialName={inertialName}
            />
          </group>

          <VelocityComponents
            pose={shown}
            twist={twist}
            show={components}
            inertialName={inertialName}
          />

          <group ref={ghostRef}>
            <Robot outline={outline} ghost />
          </group>
          <group ref={robotRef}>
            <Robot outline={outline} />
          </group>
        </Canvas>

        <p className="pointer-events-none absolute bottom-1 left-0 w-full text-center text-xs text-muted-foreground">
          {`Δt = ${step.toFixed(2)} s · o traço claro é a pose que a odometria calcula`}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
        {/* The transform: the velocities, turned into the fixed frame. */}
        <div className="flex items-center gap-2 overflow-x-auto text-sm">
          <span className="whitespace-nowrap">
            <sup className="text-[0.7em]">{inertialName}</sup>
            <strong className="font-bold not-italic">ξ̇</strong>
            <sub className="text-[0.7em]">{frameName}</sub>
          </span>
          <span aria-hidden>=</span>
          <span className="hidden items-center gap-2 sm:flex">
            <Matrix rows={m.map((row) => row.map((cell) => format(cell, n)))} />
            <Matrix
              rows={[
                [format(twist.v, n)],
                [format(0, n)],
                [format(twist.omega, n)],
              ]}
            />
            <span aria-hidden>=</span>
          </span>
          <Matrix
            rows={[[format(ix, n)], [format(iy, n)], [format(itheta, n)]]}
          />
        </div>

        {/* The sum: the pose those velocities have accumulated. */}
        <div className="flex items-center gap-2 overflow-x-auto text-sm">
          <span className="whitespace-nowrap">
            <sup className="text-[0.7em]">{inertialName}</sup>
            <strong className="font-bold not-italic">ξ</strong>
            <sub className="text-[0.7em]">{frameName}</sub>
            <span className="text-muted-foreground">
              ({format(elapsed, 1)} s)
            </span>
          </span>
          <span aria-hidden>≈</span>
          <span className="hidden items-center gap-1 text-muted-foreground sm:flex">
            <span className="whitespace-nowrap">Σ</span>
            <Matrix
              rows={[[format(ix, n)], [format(iy, n)], [format(itheta, n)]]}
            />
            <span className="whitespace-nowrap">Δt</span>
            <span aria-hidden>=</span>
          </span>
          <Matrix
            rows={[
              [format(shown.x, n)],
              [format(shown.y, n)],
              [format(toDegrees(shown.theta), Math.max(0, n - 1))],
            ]}
          />
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            m, m, graus
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {inverseMode ? (
            <>
              <Slider
                label={<>ẋ</>}
                unit="m/s"
                value={twist.v}
                min={-limits.vMax}
                max={limits.vMax}
                step={0.01}
                color={COLORS.velocity}
                onChange={(v) =>
                  setWheels(clampWheels(inverse({ ...twist, v }, params)))
                }
              />
              <Slider
                label={<>θ̇</>}
                unit="rad/s"
                value={twist.omega}
                min={-limits.omegaMax}
                max={limits.omegaMax}
                step={0.01}
                color={COLORS.velocity}
                onChange={(omega) =>
                  setWheels(clampWheels(inverse({ ...twist, omega }, params)))
                }
              />
            </>
          ) : (
            <>
              <Slider
                label={
                  <>
                    ω<sub className="text-[0.7em]">l</sub>
                  </>
                }
                unit="rad/s"
                value={wheels.left}
                min={-WHEEL_SPEED_MAX}
                max={WHEEL_SPEED_MAX}
                step={0.1}
                color={COLORS.wheelSpeed}
                onChange={(left) => setWheels((prev) => ({ ...prev, left }))}
              />
              <Slider
                label={
                  <>
                    ω<sub className="text-[0.7em]">r</sub>
                  </>
                }
                unit="rad/s"
                value={wheels.right}
                min={-WHEEL_SPEED_MAX}
                max={WHEEL_SPEED_MAX}
                step={0.1}
                color={COLORS.wheelSpeed}
                onChange={(right) => setWheels((prev) => ({ ...prev, right }))}
              />
            </>
          )}

          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <RotateCcw className="h-3 w-3" />
            reiniciar
          </button>
        </div>
      </div>
    </div>
  );
}
