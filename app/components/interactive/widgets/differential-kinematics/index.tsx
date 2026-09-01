"use client";
/**
 * Widget `differential-kinematics` — Eq. (3), driven from either end.
 *
 * The section states the relation between what the wheels do and what the
 * chassis does, and then leaves it as an equation. This widget is that
 * equation with a robot attached: the student sets ω_l and ω_r and watches the
 * chassis develop the v and θ̇ the matrix predicts, tracing the path it
 * implies. The header's second view runs the same relation backwards — the
 * student asks for a v and a θ̇, and the wheels are told what they must do.
 *
 * Three decisions carry most of the teaching:
 *
 *   - **The stage is a top view and the camera follows the robot**, so the
 *     robot is always on screen while the floor slides under it. What stays
 *     fixed is the grid's alignment, the inertial frame {I} at the world
 *     origin, and the trail — which is the path, i.e. the very thing the
 *     odometry section goes on to integrate.
 *   - **The state is always the pair of wheel speeds.** The inverse view
 *     writes to it through `inverse` and reads back through `forward`, so
 *     switching views never changes the motion: it only changes which two
 *     numbers have sliders under them.
 *   - **The pose is integrated in a ref, never in React state.** Everything on
 *     the panel is a function of the sliders alone, so a moving robot costs
 *     zero re-renders.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { RotateCcw } from "lucide-react";
import {
  GRID_CELL,
  ORIGIN_POSE,
  WHEEL_SPEED_MAX,
  advance,
  bodyLimits,
  bodyVelocity,
  clampTwist,
  clampWheels,
  format,
  forward,
  gridAnchor,
  icrDistance,
  icrIsVisible,
  inverse,
  robotOutline,
  velocityArrowLength,
  viewHalfExtent,
  wheelLinearSpeeds,
  wheelOrigin,
  yawArcSweep,
  type BodyTwist,
  type Pose,
  type RobotParams,
  type RobotOutline,
  type WheelSpeeds,
} from "./kinematics";

export interface DifferentialKinematicsProps {
  wheelRadius: number;
  track: number;
  leftSpeed: number;
  rightSpeed: number;
  trail: boolean;
  icr: boolean;
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
  /** The wheels' own quantities: ω_l, ω_r and the v each puts down. */
  wheel_speed: "#9b7bd4",
  /** What the chassis does as a result. */
  velocity: "#c98a3f",
  trail: "#2fa8b8",
  icr: "#d06a6a",
} as const;

/** How many points of path the trail remembers before it starts forgetting. */
const TRAIL_CAPACITY = 3000;

/** How far the robot must travel before the trail records another point. */
const TRAIL_STEP = 0.004;

/**
 * The longest step the integrator will take.
 *
 * A backgrounded tab hands the first frame after it wakes a delta of every
 * second it slept, which would teleport the robot across the plane and draw a
 * straight line through the middle of its own trail.
 */
const MAX_STEP = 0.05;

/** Wheel speeds this small are a stopped robot, and stop the render loop. */
const MOVING_EPS = 1e-6;

// ─── flat drawing primitives ──────────────────────────────────────────────────

/**
 * An arrowhead in the plane.
 *
 * A three-segment circle *is* a triangle, and three.js builds it with its
 * first vertex on +x — so the head points wherever `angle` says without any
 * geometry of our own.
 */
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

/** A straight arrow in the plane, from a point along an angle. */
function Arrow2D({
  from,
  angle,
  length,
  color,
  width = 2,
  head = 0.018,
}: {
  from: [number, number];
  angle: number;
  length: number;
  color: string;
  width?: number;
  head?: number;
}) {
  // A zero-length arrow has no direction to point in; drawing it would leave a
  // stray arrowhead sitting at the origin of a robot that is not moving.
  if (Math.abs(length) < 1e-6) return null;

  const sign = Math.sign(length);
  const aim = sign > 0 ? angle : angle + Math.PI;
  const tip: [number, number] = [
    from[0] + Math.cos(angle) * length,
    from[1] + Math.sin(angle) * length,
  ];
  return (
    <group>
      <Line
        points={[
          [from[0], from[1], 0],
          [tip[0], tip[1], 0],
        ]}
        color={color}
        lineWidth={width}
      />
      <Head2D at={tip} angle={aim} size={head} color={color} />
    </group>
  );
}

/** An arc about a point in the plane, closed by a head at its far end. */
function Arc2D({
  center,
  radius,
  from,
  sweep,
  color,
  width = 2,
  head = 0.016,
}: {
  center: [number, number];
  radius: number;
  from: number;
  sweep: number;
  color: string;
  width?: number;
  head?: number;
}) {
  const points = useMemo(() => {
    const n = 32;
    const out: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = from + (sweep * i) / (n - 1);
      out.push([
        center[0] + radius * Math.cos(t),
        center[1] + radius * Math.sin(t),
        0,
      ]);
    }
    return out;
  }, [center, radius, from, sweep]);

  if (Math.abs(sweep) < 0.02) return null;

  const end = from + sweep;
  const tip: [number, number] = [
    center[0] + radius * Math.cos(end),
    center[1] + radius * Math.sin(end),
  ];
  // Tangent to the circle at the tip, taken in the direction of travel.
  const aim = end + (sweep > 0 ? Math.PI / 2 : -Math.PI / 2);

  return (
    <group>
      <Line points={points} color={color} lineWidth={width} />
      <Head2D at={tip} angle={aim} size={head} color={color} />
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
 * Everything drawn in the robot's own frame.
 *
 * The group this returns is placed and turned once per frame by `Motion`, so
 * nothing in here needs to know where the robot is — only what it is doing.
 */
function Robot({
  outline,
  wheels,
  twist,
  params,
  frameName,
}: {
  outline: RobotOutline;
  wheels: WheelSpeeds;
  twist: BodyTwist;
  params: RobotParams;
  frameName: string;
}) {
  const rim = wheelLinearSpeeds(wheels, params);
  // Inside the shell: x̂_R runs along the heading and so does ẋ_R, and the
  // thicker velocity arrow would simply paint over an axis of the same length.
  const axis = outline.chassisRadius * 0.85;
  const arcRadius = outline.chassisRadius * 0.62;
  const sweep = yawArcSweep(twist.omega);

  return (
    <group>
      {/* Shell, translucent as in the companion figure, so the axle and the
          frame's origin stay visible under it. */}
      <mesh>
        <circleGeometry args={[outline.chassisRadius, 48]} />
        <meshBasicMaterial color={COLORS.body} transparent opacity={0.3} />
      </mesh>

      <mesh position={[outline.castorOffset, 0, 0]}>
        <circleGeometry args={[outline.castorRadius, 20]} />
        <meshBasicMaterial color={COLORS.wheel} />
      </mesh>

      {(["l", "r"] as const).map((side) => {
        const [wx, wy] = wheelOrigin(side, outline);
        return (
          <mesh key={side} position={[wx, wy, 0]}>
            <planeGeometry args={[outline.wheelLength, outline.wheelWidth]} />
            <meshBasicMaterial color={COLORS.wheel} />
          </mesh>
        );
      })}

      {/* The axle: the line the frame's origin sits on. */}
      <Line
        points={[
          [0, -outline.wheelOffset, 0],
          [0, outline.wheelOffset, 0],
        ]}
        color={COLORS.wheel}
        lineWidth={1.5}
      />

      {/* The frame {R} itself. */}
      <Arrow2D
        from={[0, 0]}
        angle={0}
        length={axis}
        color={COLORS.x}
        width={1.5}
        head={0.012}
      />
      <Arrow2D
        from={[0, 0]}
        angle={Math.PI / 2}
        length={axis}
        color={COLORS.y}
        width={1.5}
        head={0.012}
      />

      {/* What each wheel puts down: v = r ω, forward along x̂_R. */}
      {(["l", "r"] as const).map((side) => {
        const [wx, wy] = wheelOrigin(side, outline);
        const speed = side === "l" ? rim.left : rim.right;
        const length = velocityArrowLength(speed);
        return (
          <group key={side}>
            <Arrow2D
              from={[wx, wy]}
              angle={0}
              length={length}
              color={COLORS.wheel_speed}
              width={2}
            />
            {Math.abs(length) > 0.02 && (
              <Label
                at={[wx + length + Math.sign(length) * 0.035, wy]}
                color={COLORS.wheel_speed}
              >
                v<sub className="text-[0.7em]">{side}</sub>
              </Label>
            )}
          </group>
        );
      })}

      {/* What the chassis does: v along x̂_R, θ̇ about its centre. */}
      <Arrow2D
        from={[0, 0]}
        angle={0}
        length={velocityArrowLength(twist.v)}
        color={COLORS.velocity}
        width={3}
        head={0.024}
      />
      {Math.abs(twist.v) > 0.02 && (
        <Label
          at={[
            velocityArrowLength(twist.v) + Math.sign(twist.v) * 0.045,
            0.035,
          ]}
          color={COLORS.velocity}
        >
          {"ẋ"}
          <sub className="text-[0.7em]">{frameName}</sub>
        </Label>
      )}

      <Arc2D
        center={[0, 0]}
        radius={arcRadius}
        // Starting behind the robot keeps the arc clear of its own velocity
        // arrow, which leaves along +x̂_R.
        from={Math.PI * 0.75}
        sweep={sweep}
        color={COLORS.velocity}
      />
      {Math.abs(sweep) > 0.06 && (
        <Label
          at={[
            arcRadius * 1.5 * Math.cos(Math.PI * 0.75 + sweep / 2),
            arcRadius * 1.5 * Math.sin(Math.PI * 0.75 + sweep / 2),
          ]}
          color={COLORS.velocity}
        >
          {"θ̇"}
          <sub className="text-[0.7em]">{frameName}</sub>
        </Label>
      )}
    </group>
  );
}

/**
 * The instantaneous centre of rotation, and the circle the robot runs on.
 *
 * Drawn in the robot's frame — the ICR is at (0, v/ω) in it, by definition —
 * and therefore carried around by the same group as the robot, which is also
 * the honest picture: the centre is instantaneous, and moves with the robot
 * whenever the wheels change.
 */
function IcrMarker({ distance }: { distance: number }) {
  const tick = Math.max(0.012, Math.abs(distance) * 0.06);
  const circle = useMemo(() => {
    const out: [number, number, number][] = [];
    const n = 96;
    for (let i = 0; i <= n; i++) {
      const t = (2 * Math.PI * i) / n;
      out.push([
        Math.abs(distance) * Math.cos(t),
        distance + Math.abs(distance) * Math.sin(t),
        0,
      ]);
    }
    return out;
  }, [distance]);

  return (
    <group>
      <Line
        points={circle}
        color={COLORS.icr}
        lineWidth={1}
        dashed
        dashSize={0.02}
        gapSize={0.02}
        transparent
        opacity={0.75}
      />
      <Line
        points={[
          [0, 0, 0],
          [0, distance, 0],
        ]}
        color={COLORS.icr}
        lineWidth={1}
        dashed
        dashSize={0.015}
        gapSize={0.015}
      />
      <Line
        points={[
          [-tick, distance, 0],
          [tick, distance, 0],
        ]}
        color={COLORS.icr}
        lineWidth={2}
      />
      <Line
        points={[
          [0, distance - tick, 0],
          [0, distance + tick, 0],
        ]}
        color={COLORS.icr}
        lineWidth={2}
      />
      <Label at={[tick * 2.2, distance + tick * 1.6]} color={COLORS.icr}>
        CIR
      </Label>
    </group>
  );
}

/** The fixed frame the whole motion is measured against. */
function WorldOrigin({ size, name }: { size: number; name: string }) {
  return (
    <group>
      <Arrow2D
        from={[0, 0]}
        angle={0}
        length={size}
        color={COLORS.x}
        width={1.5}
        head={0.012}
      />
      <Arrow2D
        from={[0, 0]}
        angle={Math.PI / 2}
        length={size}
        color={COLORS.y}
        width={1.5}
        head={0.012}
      />
      <Label at={[-size * 0.42, -size * 0.42]} color={COLORS.neutral}>
        {`{${name}}`}
      </Label>
    </group>
  );
}

// ─── the moving parts ─────────────────────────────────────────────────────────

interface Movers {
  robot: React.RefObject<THREE.Group | null>;
  grid: React.RefObject<THREE.GridHelper | null>;
  trail: THREE.Line;
  pose: React.MutableRefObject<Pose>;
  written: React.MutableRefObject<number>;
}

/**
 * The one place per-frame work happens: integrate the pose, then move
 * everything that depends on it.
 *
 * Written as a single `useFrame` rather than one per object so that the robot,
 * the camera, the floor and the trail can never disagree about which instant
 * they are drawing.
 */
function Motion({
  twist,
  movers,
  halfExtent,
  recordTrail,
}: {
  twist: BodyTwist;
  movers: Movers;
  halfExtent: number;
  recordTrail: boolean;
}) {
  const camera = useThree((s) => s.camera);

  useFrame((_, delta) => {
    const pose = advance(movers.pose.current, twist, Math.min(delta, MAX_STEP));
    movers.pose.current = pose;

    if (movers.robot.current) {
      movers.robot.current.position.set(pose.x, pose.y, 0);
      movers.robot.current.rotation.z = pose.theta;
    }

    camera.position.set(pose.x, pose.y, 5);

    if (movers.grid.current) {
      // Snapped to whole cells: the floor has to stay put while the robot
      // crosses it, or the only cue that anything is moving disappears.
      movers.grid.current.position.set(
        gridAnchor(pose.x),
        gridAnchor(pose.y),
        0,
      );
    }

    if (recordTrail) pushTrailPoint(movers, pose, halfExtent);
  });

  return null;
}

/**
 * Append the robot's position to the trail, if it has gone far enough since
 * the last point to be worth another vertex.
 *
 * When the buffer fills, the older half is dropped and the rest slid down:
 * a trail that stopped growing would quietly turn into a lie about where the
 * robot has been, and one that reset would flicker.
 */
function pushTrailPoint(movers: Movers, pose: Pose, halfExtent: number) {
  const geometry = movers.trail.geometry;
  const attribute = geometry.getAttribute("position") as THREE.BufferAttribute;
  const array = attribute.array as Float32Array;
  let count = movers.written.current;

  if (count > 0) {
    const dx = pose.x - array[(count - 1) * 3];
    const dy = pose.y - array[(count - 1) * 3 + 1];
    if (Math.hypot(dx, dy) < Math.max(TRAIL_STEP, halfExtent * 0.006)) return;
  }

  if (count >= TRAIL_CAPACITY) {
    const keep = Math.floor(TRAIL_CAPACITY / 2);
    array.copyWithin(0, (TRAIL_CAPACITY - keep) * 3, TRAIL_CAPACITY * 3);
    count = keep;
  }

  array[count * 3] = pose.x;
  array[count * 3 + 1] = pose.y;
  array[count * 3 + 2] = 0;
  count += 1;

  movers.written.current = count;
  attribute.needsUpdate = true;
  geometry.setDrawRange(0, count);
}

/**
 * Sets the orthographic zoom so the stage always shows the same patch of
 * floor, whatever size the block was given.
 *
 * A top view is a measurement: the grid is the scale the student reads r and d
 * against, so the mapping from metres to pixels may not depend on the
 * viewport. The zoom is written during render — `OrbitControls` is not in this
 * scene, but the same rule applies, and an effect would leave one frame drawn
 * at the wrong scale.
 */
function OrthoRig({ halfExtent }: { halfExtent: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  const zoom = Math.min(size.width, size.height) / (2 * halfExtent);
  if (camera.zoom !== zoom) {
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }

  useEffect(() => invalidate(), [zoom, size, invalidate]);

  return null;
}

// ─── panel ────────────────────────────────────────────────────────────────────

/** A bracketed array of numbers, as the section writes its matrices. */
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
        className="h-1 w-28 cursor-pointer sm:w-40"
        style={{ accentColor: color }}
      />
      <span className="w-20 text-left tabular-nums text-muted-foreground">
        {value.toFixed(2)} {unit}
      </span>
    </label>
  );
}

// ─── the widget ───────────────────────────────────────────────────────────────

export default function DifferentialKinematics({
  wheelRadius,
  track,
  leftSpeed,
  rightSpeed,
  trail,
  icr,
  decimals,
  frameName,
  inertialName,
  variant,
}: DifferentialKinematicsProps) {
  const params: RobotParams = useMemo(
    () => ({ r: wheelRadius, d: track }),
    [wheelRadius, track],
  );
  const outline = useMemo(() => robotOutline(params), [params]);
  const halfExtent = viewHalfExtent(params);
  const inverseMode = variant === "inverso";

  // The wheels are the state, in both views: see the header. Clamped on the
  // way in, because an authored speed may exceed what a motor can do.
  const [wheels, setWheels] = useState<WheelSpeeds>(() =>
    clampWheels({ left: leftSpeed, right: rightSpeed }),
  );

  const twist = forward(wheels, params);
  const limits = bodyLimits(params);
  const moving =
    Math.abs(twist.v) > MOVING_EPS || Math.abs(twist.omega) > MOVING_EPS;

  // Entering the inverse view may require holding the motion back: the direct
  // sliders reach yaw rates the inverse pair cannot express.
  useEffect(() => {
    if (!inverseMode) return;
    setWheels((prev) => {
      const held = clampTwist(forward(prev, params), params);
      return clampWheels(inverse(held, params));
    });
  }, [inverseMode, params]);

  const poseRef = useRef<Pose>(ORIGIN_POSE);
  const robotRef = useRef<THREE.Group>(null);
  const gridRef = useRef<THREE.GridHelper>(null);
  const writtenRef = useRef(0);

  const trailObject = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(TRAIL_CAPACITY * 3), 3),
    );
    geometry.setDrawRange(0, 0);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: COLORS.trail }),
    );
    // The bounding sphere is computed once, from a buffer that is still all
    // zeros, so three.js decides the trail is a point at the origin and culls
    // it the moment the robot drives away from there. Recomputing it every
    // frame would be the other fix, and this one is free.
    line.frustumCulled = false;
    return line;
  }, []);

  useEffect(() => {
    const object = trailObject;
    return () => {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    };
  }, [trailObject]);

  const movers: Movers = {
    robot: robotRef,
    grid: gridRef,
    trail: trailObject,
    pose: poseRef,
    written: writtenRef,
  };

  /**
   * Back to rest: the wheels stopped, the robot on the origin, the trail gone.
   *
   * Stopping the wheels is the part that makes the button mean "reiniciar"
   * rather than "reposicionar". Left running, the robot is already somewhere
   * else by the time the student has read the panel, and the reset they asked
   * for has visibly not happened.
   */
  const reset = () => {
    setWheels({ left: 0, right: 0 });
    poseRef.current = ORIGIN_POSE;
    writtenRef.current = 0;
    trailObject.geometry.setDrawRange(0, 0);
    if (robotRef.current) {
      robotRef.current.position.set(0, 0, 0);
      robotRef.current.rotation.z = 0;
    }
  };

  const radius = icrDistance(twist);
  const showIcr = icr && icrIsVisible(radius, halfExtent);
  const column = bodyVelocity(wheels, params);
  const n = decimals;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Canvas
          orthographic
          // Only while something is actually moving: a stopped robot has no
          // reason to keep a render loop warm on a lesson page.
          frameloop={moving ? "always" : "demand"}
          camera={{ position: [0, 0, 5], up: [0, 1, 0], near: 0.1, far: 50 }}
          style={{ touchAction: "none" }}
        >
          <OrthoRig halfExtent={halfExtent} />
          <Motion
            twist={twist}
            movers={movers}
            halfExtent={halfExtent}
            recordTrail={trail}
          />

          <gridHelper
            ref={gridRef}
            args={[
              // Generous enough that the snapped patch always covers the view.
              6 * halfExtent,
              Math.round((6 * halfExtent) / GRID_CELL),
              COLORS.neutral,
              COLORS.neutral,
            ]}
            // three.js lays a grid on xz; the floor here is the xy plane.
            rotation={[Math.PI / 2, 0, 0]}
          />

          {trail && <primitive object={trailObject} />}

          <WorldOrigin size={halfExtent * 0.25} name={inertialName} />

          <group ref={robotRef}>
            <Robot
              outline={outline}
              wheels={wheels}
              twist={twist}
              params={params}
              frameName={frameName}
            />
            {showIcr && radius !== null && <IcrMarker distance={radius} />}
          </group>
        </Canvas>

        <p className="pointer-events-none absolute bottom-1 left-0 w-full text-center text-xs text-muted-foreground">
          {inverseMode
            ? "Peça uma velocidade ao chassi — as rodas obedecem"
            : "Comande as rodas — o chassi obedece"}
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
        {/* The equation, with the numbers currently in it. */}
        <div className="flex items-center gap-2 overflow-x-auto text-sm">
          {inverseMode ? (
            <>
              <Matrix rows={[[`ω${subscript("l")}`], [`ω${subscript("r")}`]]} />
              <span aria-hidden>=</span>
              <span className="hidden items-center gap-2 sm:flex">
                <Matrix
                  rows={[
                    [
                      format(1 / params.r, n),
                      format(-params.d / (2 * params.r), n),
                    ],
                    [
                      format(1 / params.r, n),
                      format(params.d / (2 * params.r), n),
                    ],
                  ]}
                />
                <Matrix
                  rows={[[format(twist.v, n)], [format(twist.omega, n)]]}
                />
                <span aria-hidden>=</span>
              </span>
              <Matrix
                rows={[[format(wheels.left, n)], [format(wheels.right, n)]]}
              />
            </>
          ) : (
            <>
              <span className="whitespace-nowrap">
                <sup className="text-[0.7em]">{frameName}</sup>
                <strong className="font-bold not-italic">ξ̇</strong>
                <sub className="text-[0.7em]">{frameName}</sub>
              </span>
              <span aria-hidden>=</span>
              <span className="hidden items-center gap-2 sm:flex">
                <Matrix
                  rows={[
                    [format(params.r / 2, n), format(params.r / 2, n)],
                    [format(0, n), format(0, n)],
                    [
                      format(-params.r / params.d, n),
                      format(params.r / params.d, n),
                    ],
                  ]}
                />
                <Matrix
                  rows={[[format(wheels.left, n)], [format(wheels.right, n)]]}
                />
                <span aria-hidden>=</span>
              </span>
              <Matrix
                rows={[
                  [format(column[0], n)],
                  [format(column[1], n)],
                  [format(column[2], n)],
                ]}
              />
            </>
          )}
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
                color={COLORS.wheel_speed}
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
                color={COLORS.wheel_speed}
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

/** A subscript written into a plain string, for the matrix's row labels. */
function subscript(letter: "l" | "r"): string {
  return letter === "l" ? "ₗ" : "ᵣ";
}
