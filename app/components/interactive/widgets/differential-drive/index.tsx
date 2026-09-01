"use client";
/**
 * Widget `differential-drive` — the annotated robot the module is built on.
 *
 * It stands in for the static figure that used to open "O robô diferencial",
 * and its job is narrower than most widgets': it is a drawing the student can
 * walk around, not a simulation. Everything the section goes on to write —
 * {R} on the axle, r, d, each wheel's ω and the v = r ω it puts down, and the
 * chassis velocities ẋ_R, ẏ_R, θ̇_R — is labelled on the part of the robot it
 * actually refers to, so the symbols in the equations have somewhere to point.
 *
 * The shell is translucent for one reason: the frame's origin, the axle and
 * the `d` dimension line all live *inside* or *under* the body, and an opaque
 * chassis hides exactly the geometry the figure exists to show.
 *
 * It follows the conventions of the other 3D widgets — z up, x/y/z as
 * red/green/blue, DOM labels rather than drei's `<Text>` (troika would fetch
 * its font from fonts.gstatic.com, which Kuara's CSP blocks) — and takes every
 * coordinate from `./robot`, which the print fallback projects from too.
 */
import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import {
  AXIS_LENGTH,
  CASTOR_RADIUS,
  CHASSIS_HEIGHT,
  CHASSIS_RADIUS,
  DEFAULT_VIEW,
  GROUND_HALF,
  GROUND_STEP,
  GROUND_Z,
  INTERACTION_HINT,
  MAX_DISTANCE,
  MIN_DISTANCE,
  SIDES,
  VELOCITY_LENGTH,
  WHEEL_RADIUS,
  WHEEL_WIDTH,
  arcTangent,
  arrowQuaternion,
  axisLabelAnchor,
  castorCenter,
  WHEEL_VELOCITY_LENGTH,
  radiusLabelAnchor,
  radiusSegment,
  spinArc,
  spinLabelAnchor,
  trackDimension,
  trackLabelAnchor,
  velocityLabelAnchor,
  wheelCenter,
  wheelVelocityLabelAnchor,
  yawArc,
  yawLabelAnchor,
  type Side,
} from "./robot";

export interface DifferentialDriveProps {
  frameName: string;
  labels: boolean;
  measures: boolean;
  wheelSpeeds: boolean;
  chassisSpeeds: boolean;
  grid: boolean;
  opacity: number;
}

type AxisKey = "x" | "y" | "z";

const COLORS = {
  x: "#e05252",
  y: "#3faf5c",
  z: "#2fa8b8",
  // One mid-tone for the floor and the origin: legible on both the light and
  // the dark surface without threading next-themes through the WebGL scene.
  neutral: "#8a9a94",
  body: "#c2603f",
  // Mid-tone rather than near-black: the wheels have to read as wheels on
  // the dark surface too, where a dark grey at a third opacity is a smudge.
  wheel: "#5c666e",
  /** Draughting ink: the r and d annotations. */
  measure: "#b9a37a",
  /** The wheels' own variables: ω_l, ω_r and the v each one puts down. */
  spin: "#9b7bd4",
  /** What the chassis does as a result: ẋ_R and θ̇_R. */
  velocity: "#c98a3f",
  /** The direction the robot cannot move in. */
  blocked: "#d06a6a",
} as const;

/** Proportions of the basis arrows. */
const SHAFT_RADIUS = 0.028;
const HEAD_LENGTH = 0.2;
const HEAD_RADIUS = 0.075;

/**
 * The chassis velocities run along the basis arrows, so their shafts are drawn
 * *thinner* than those: a heavier tube on the same line simply swallows the
 * basis arrow inside itself, and x̂_R disappears from the figure entirely. What
 * distinguishes them is the head — larger, and out past the axis tip, where
 * there is nothing to hide it.
 */
const VELOCITY_SHAFT_RADIUS = 0.019;
const VELOCITY_HEAD_LENGTH = 0.26;
const VELOCITY_HEAD_RADIUS = 0.095;

/** The head that closes an arc. Small — an arc is thin line work. */
const ARC_HEAD_LENGTH = 0.2;
const ARC_HEAD_RADIUS = 0.075;

/**
 * Euler rotations that aim a +Y-oriented cylinder/cone down each axis.
 * three.js builds both primitives along +Y, so x needs -90° about z and z
 * needs +90° about x; y is already in place.
 */
const AXIS_ROTATION: Record<AxisKey, [number, number, number]> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};

// ─── primitives ───────────────────────────────────────────────────────────────

/** A cone parked at `at`, nose along `direction`. Closes every arrow here. */
function Head({
  at,
  direction,
  color,
  length = ARC_HEAD_LENGTH,
  radius = ARC_HEAD_RADIUS,
}: {
  at: Vec3;
  direction: Vec3;
  color: string;
  length?: number;
  radius?: number;
}) {
  return (
    <group position={at} quaternion={arrowQuaternion(direction)}>
      <mesh position={[0, length / 2, 0]}>
        <coneGeometry args={[radius, length, 20]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** One basis vector of {R}, drawn from the origin. */
function BasisArrow({ axis, color }: { axis: AxisKey; color: string }) {
  const shaftLength = AXIS_LENGTH - HEAD_LENGTH;
  return (
    <group rotation={AXIS_ROTATION[axis]}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <cylinderGeometry
          args={[SHAFT_RADIUS, SHAFT_RADIUS, shaftLength, 16]}
        />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh position={[0, shaftLength + HEAD_LENGTH / 2, 0]}>
        <coneGeometry args={[HEAD_RADIUS, HEAD_LENGTH, 20]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
    </group>
  );
}

/** A chassis velocity: same direction as its basis vector, drawn past it. */
function VelocityArrow({ axis, color }: { axis: AxisKey; color: string }) {
  const shaftLength = VELOCITY_LENGTH - VELOCITY_HEAD_LENGTH;
  return (
    <group rotation={AXIS_ROTATION[axis]}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <cylinderGeometry
          args={[VELOCITY_SHAFT_RADIUS, VELOCITY_SHAFT_RADIUS, shaftLength, 20]}
        />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position={[0, shaftLength + VELOCITY_HEAD_LENGTH / 2, 0]}>
        <coneGeometry args={[VELOCITY_HEAD_RADIUS, VELOCITY_HEAD_LENGTH, 24]} />
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** A label in the page's own DOM, anchored to a point in the scene. */
function Label({
  at,
  color,
  children,
}: {
  at: Vec3;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <Html
      position={at}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="whitespace-nowrap text-base font-bold not-italic"
        style={{ color: color ?? "currentColor" }}
      >
        {children}
      </span>
    </Html>
  );
}

// ─── the robot ────────────────────────────────────────────────────────────────

/**
 * The shell and its castor.
 *
 * `depthWrite` is off on the translucent surfaces: with it on, the body writes
 * itself into the depth buffer and hides the triedro, the axle and the `d`
 * line standing behind it — which is precisely what being translucent was
 * supposed to avoid.
 */
function Chassis({ opacity }: { opacity: number }) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry
          args={[CHASSIS_RADIUS, CHASSIS_RADIUS, CHASSIS_HEIGHT, 48]}
        />
        <meshStandardMaterial
          color={COLORS.body}
          roughness={0.5}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>

      <mesh position={castorCenter()}>
        <sphereGeometry args={[CASTOR_RADIUS, 20, 20]} />
        <meshStandardMaterial
          color={COLORS.wheel}
          roughness={0.4}
          transparent
          opacity={Math.min(1, opacity + 0.2)}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * One wheel, plus the axle it shares with the other.
 *
 * three.js builds a cylinder along +Y and the axle *is* ŷ_R, so the wheel
 * needs no rotation at all — the one place in these widgets where the library's
 * convention and the robotics one agree.
 */
function Wheel({ side, opacity }: { side: Side; opacity: number }) {
  return (
    <mesh position={wheelCenter(side)}>
      <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 40]} />
      <meshStandardMaterial
        color={COLORS.wheel}
        roughness={0.45}
        transparent
        opacity={Math.min(1, opacity + 0.25)}
        depthWrite={false}
      />
    </mesh>
  );
}

/** The axle between the wheels — the line the frame's origin sits on. */
function Axle() {
  const [, y] = wheelCenter("l");
  return (
    <mesh>
      <cylinderGeometry args={[0.035, 0.035, 2 * y, 16]} />
      <meshStandardMaterial color={COLORS.wheel} roughness={0.5} />
    </mesh>
  );
}

// ─── annotations ──────────────────────────────────────────────────────────────

/**
 * `r`: a bare line in the wheel's own plane, from its centre to its rim.
 *
 * No arrowhead — a radius is a length, not a vector, and the wheel already
 * carries a real vector on the same line the other way.
 */
function RadiusAnnotation({ side }: { side: Side }) {
  const { from, to } = radiusSegment(side);
  return (
    <group>
      <Line points={[from, to]} color={COLORS.measure} lineWidth={1.6} />
      {/* A tick closing the line on the rim, so where the measurement ends is
          not left to the eye against a translucent tyre. */}
      <mesh position={to}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color={COLORS.measure} roughness={0.45} />
      </mesh>
      <Label at={radiusLabelAnchor(side)} color={COLORS.measure}>
        r
      </Label>
    </group>
  );
}

/** `v_l` / `v_r`: the linear speed the wheel puts down, forward along x̂_R. */
function WheelVelocityAnnotation({ side }: { side: Side }) {
  const shaftLength = WHEEL_VELOCITY_LENGTH - HEAD_LENGTH;
  return (
    <group>
      <group position={wheelCenter(side)} rotation={AXIS_ROTATION.x}>
        <mesh position={[0, shaftLength / 2, 0]}>
          <cylinderGeometry args={[0.026, 0.026, shaftLength, 16]} />
          <meshStandardMaterial color={COLORS.spin} roughness={0.4} />
        </mesh>
        <mesh position={[0, shaftLength + HEAD_LENGTH / 2, 0]}>
          <coneGeometry args={[HEAD_RADIUS, HEAD_LENGTH, 20]} />
          <meshStandardMaterial color={COLORS.spin} roughness={0.4} />
        </mesh>
      </group>
      <Label at={wheelVelocityLabelAnchor(side)} color={COLORS.spin}>
        v<sub className="text-[0.7em]">{side}</sub>
      </Label>
    </group>
  );
}

/** `d`: the dimension line between the contact points, set out behind. */
function TrackAnnotation() {
  const { line, witness } = trackDimension();
  return (
    <group>
      <Line
        points={[line.from, line.to]}
        color={COLORS.measure}
        lineWidth={1.6}
      />
      {/* Heads at both ends: a dimension is measured between two points, and a
          single-headed arrow reads as a vector from one of them. */}
      <Head
        at={line.from}
        direction={[0, -1, 0]}
        color={COLORS.measure}
        length={0.16}
        radius={0.055}
      />
      <Head
        at={line.to}
        direction={[0, 1, 0]}
        color={COLORS.measure}
        length={0.16}
        radius={0.055}
      />
      {witness.map((w, i) => (
        <Line
          key={i}
          points={[w.from, w.to]}
          color={COLORS.measure}
          lineWidth={1}
          dashed
          dashSize={0.12}
          gapSize={0.1}
        />
      ))}
      <Label at={trackLabelAnchor()} color={COLORS.measure}>
        d
      </Label>
    </group>
  );
}

/** `ω`: an arc over the wheel, in the sense that rolls it forwards. */
function SpinAnnotation({
  side,
  frameName,
}: {
  side: Side;
  frameName: string;
}) {
  const arc = spinArc(side);
  const tip = arc[arc.length - 1];
  return (
    <group>
      <Line points={arc} color={COLORS.spin} lineWidth={2} />
      <Head at={tip} direction={arcTangent(arc)} color={COLORS.spin} />
      <Label at={spinLabelAnchor(side)} color={COLORS.spin}>
        {"ω"}
        <sub className="text-[0.7em]">{side}</sub>
        <span className="sr-only">
          {` velocidade angular da roda ${side === "l" ? "esquerda" : "direita"} do robô ${frameName}`}
        </span>
      </Label>
    </group>
  );
}

/** `θ̇_R`: an arc about ẑ_R, in the positive sense (x̂ towards ŷ). */
function YawAnnotation({ frameName }: { frameName: string }) {
  const arc = yawArc();
  const tip = arc[arc.length - 1];
  return (
    <group>
      <Line points={arc} color={COLORS.velocity} lineWidth={2} />
      <Head at={tip} direction={arcTangent(arc)} color={COLORS.velocity} />
      <Label at={yawLabelAnchor()} color={COLORS.velocity}>
        {"θ̇"}
        <sub className="text-[0.7em]">{frameName}</sub>
      </Label>
    </group>
  );
}

/**
 * `ẏ_R = 0`: the direction the wheels cannot drive the chassis in.
 *
 * Drawn dashed and headless along ŷ_R, with its own value written next to it.
 * The restriction is the reason the middle row of the kinematic model is a row
 * of zeros, and a figure that simply omitted the direction would leave the
 * student to wonder whether it had been forgotten.
 */
function BlockedAnnotation({ frameName }: { frameName: string }) {
  return (
    <group>
      <Line
        points={[
          [0, 0, 0],
          [0, VELOCITY_LENGTH, 0],
        ]}
        color={COLORS.blocked}
        lineWidth={2}
        dashed
        dashSize={0.16}
        gapSize={0.12}
      />
      <Label at={velocityLabelAnchor("y")} color={COLORS.blocked}>
        {"ẏ"}
        <sub className="text-[0.7em]">{frameName}</sub>
        <span className="ml-1 font-semibold">= 0</span>
      </Label>
    </group>
  );
}

// ─── stage ────────────────────────────────────────────────────────────────────

/**
 * Points the camera at the scene, and forces the redraw that
 * `frameloop="demand"` would otherwise never issue.
 *
 * The camera is moved **during render**, not in an effect: `OrbitControls`
 * reads `camera.up` once in its constructor to fix its orbit axis and never
 * looks again. The mutation is idempotent, so StrictMode's double render is
 * harmless, and it runs once because `view` is a module constant — re-aiming
 * on every render would throw away a rotation the student had just dragged.
 */
function CameraRig({ view }: { view: Camera }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  // The stage is a flex child, so the canvas mounts at one size and is resized
  // a tick later; under `frameloop="demand"` that resize asks for no frame of
  // its own, and the block would sit blank until the student happened to drag
  // it. Redrawing on every size change also covers the window being resized.
  const size = useThree((s) => s.size);
  const applied = useRef<Camera | null>(null);

  if (applied.current !== view) {
    applied.current = view;
    camera.up.set(view.up[0], view.up[1], view.up[2]);
    camera.position.set(view.position[0], view.position[1], view.position[2]);
    camera.lookAt(view.target[0], view.target[1], view.target[2]);
    camera.updateProjectionMatrix();
  }

  useEffect(() => invalidate(), [view, size, invalidate]);

  return null;
}

export default function DifferentialDrive({
  frameName,
  labels,
  measures,
  wheelSpeeds,
  chassisSpeeds,
  grid,
  opacity,
}: DifferentialDriveProps) {
  const view = DEFAULT_VIEW;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Canvas
          frameloop="demand"
          // Initial framing only; `CameraRig` owns every move after mount.
          camera={{ position: view.position, fov: view.fov, up: view.up }}
          gl={{ antialias: true }}
          style={{ touchAction: "none" }}
        >
          <CameraRig view={view} />

          <ambientLight intensity={1.15} />
          <directionalLight position={[5, -7, 9]} intensity={1.5} />
          <directionalLight position={[-6, 5, -3]} intensity={0.4} />

          {grid && (
            <gridHelper
              args={[
                2 * GROUND_HALF,
                (2 * GROUND_HALF) / GROUND_STEP,
                COLORS.neutral,
                COLORS.neutral,
              ]}
              // three.js lays the grid on xz; robotics wants it on xy — here,
              // on the floor the wheels actually touch.
              rotation={[Math.PI / 2, 0, 0]}
              position={[0, 0, GROUND_Z]}
            />
          )}

          <Chassis opacity={opacity} />
          <Axle />
          {SIDES.map((side) => (
            <Wheel key={side} side={side} opacity={opacity} />
          ))}

          {(["x", "y", "z"] as AxisKey[]).map((axis) => (
            <BasisArrow key={axis} axis={axis} color={COLORS[axis]} />
          ))}

          <mesh>
            <sphereGeometry args={[0.07, 20, 20]} />
            <meshStandardMaterial color={COLORS.neutral} roughness={0.4} />
          </mesh>

          {labels && (
            <>
              {(["x", "y", "z"] as AxisKey[]).map((axis) => (
                <Label
                  key={axis}
                  at={axisLabelAnchor(axis)}
                  color={COLORS[axis]}
                >
                  {axis}
                  {"̂"}
                  <sub className="text-[0.7em]">{frameName}</sub>
                </Label>
              ))}
              {/* The origin's own label is nudged in screen space, away from
                  the three arrows that all start on top of it. */}
              <Html
                position={[0, 0, 0]}
                center
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                <span
                  className="block whitespace-nowrap text-base font-bold not-italic"
                  style={{
                    color: COLORS.neutral,
                    transform: "translate(-1.1em, 1em)",
                  }}
                >
                  O<sub className="text-[0.7em]">{frameName}</sub>
                </span>
              </Html>
            </>
          )}

          {measures && (
            <>
              <TrackAnnotation />
              {SIDES.map((side) => (
                <RadiusAnnotation key={side} side={side} />
              ))}
            </>
          )}

          {wheelSpeeds &&
            SIDES.map((side) => (
              <group key={side}>
                <SpinAnnotation side={side} frameName={frameName} />
                <WheelVelocityAnnotation side={side} />
              </group>
            ))}

          {chassisSpeeds && (
            <>
              <VelocityArrow axis="x" color={COLORS.velocity} />
              <Label at={velocityLabelAnchor("x")} color={COLORS.velocity}>
                {"ẋ"}
                <sub className="text-[0.7em]">{frameName}</sub>
              </Label>
              <YawAnnotation frameName={frameName} />
              <BlockedAnnotation frameName={frameName} />
            </>
          )}

          <OrbitControls
            makeDefault
            enablePan={false}
            target={view.target}
            minDistance={MIN_DISTANCE}
            maxDistance={MAX_DISTANCE}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        <p className="pointer-events-none absolute bottom-1 left-0 w-full text-center text-xs text-muted-foreground">
          {INTERACTION_HINT}
        </p>
      </div>
    </div>
  );
}
