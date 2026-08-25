"use client";
/**
 * Widget `coord-frame-3d` — a right-handed Cartesian frame the student rotates.
 *
 * Built for the "Sistemas de coordenadas" section of Representação Espacial,
 * so it follows the robotics convention rather than three.js's: **z is up**
 * (`camera.up = [0,0,1]`, grid rotated onto the xy plane), and the axes carry
 * the canonical x/y/z = red/green/blue colouring the course figures use.
 *
 * Rendering is on demand (`frameloop="demand"`): the scene is static until the
 * student drags, so an idle block on a long page costs no frames. Auto-rotate
 * is the one case that needs a continuous loop, and switches it back on.
 */
import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import {
  AXIS_LENGTH,
  GRID_DIVISIONS,
  GRID_HALF,
  GRID_SIZE,
  VIEW_CAMERA,
  axisLabelAnchor,
  clampPoint,
  formatCoords,
  interactionHint,
  labelAnchor,
  referenceKind,
  rollUp,
  rotationMode,
  rulerTicks,
  shortestAngleDelta,
  showsProjections,
  toDimension,
  visibleAxes,
  type AxisKey,
  type Dimension,
} from "./views";

export interface CoordFrame3DProps {
  labels: boolean;
  grid: boolean;
  /**
   * Kept in the prop shape because the authored `frameName` still names the
   * frame in the print fallback's accessible label; the drawn labels are now
   * bare (x̂, ŷ, ẑ, o) and carry no subscript.
   */
  frameName: string;
  point: Vec3 | null;
  pointLabel: string;
  projections: boolean;
  autoRotate: boolean;
  /**
   * Which view the box's header switch has selected: `"1d"`, `"2d"` or
   * `"3d"`. Optional because the widget also renders outside the box, where
   * nothing sets it — see `toDimension`.
   */
  variant?: string;
}

// Arrow proportions, as fractions of the now unit-length axis: the head was
// 11% of a 2-long arrow and would read as a spearhead on a 1-long one.
const SHAFT_RADIUS = 0.015;
const HEAD_LENGTH = 0.16;
const HEAD_RADIUS = 0.05;

const COLORS = {
  x: "#e05252",
  y: "#3faf5c",
  z: "#2fa8b8",
  // A single mid-tone for grid and guides: legible on both the light and the
  // dark surface without threading next-themes through the WebGL scene.
  neutral: "#8a9a94",
  point: "#c9bfa3",
  vector: "#a56e4a",
} as const;

/**
 * Euler rotations that aim a +Y-oriented cylinder/cone down each axis.
 * three.js builds both primitives along +Y, so x needs -90° about z and
 * z needs +90° about x; y is already in place.
 */
const AXIS_ROTATION: Record<AxisKey, [number, number, number]> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};

function Arrow({ axis, color }: { axis: AxisKey; color: string }) {
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

function AxisLabel({
  axis,
  color,
  dim,
}: {
  axis: AxisKey;
  color: string;
  dim: Dimension;
}) {
  return (
    <Html
      // DOM labels instead of drei's <Text>: troika fetches its default font
      // from fonts.gstatic.com, which Kuara's CSP (font-src 'self' data:
      // cdn.jsdelivr.net) blocks — the labels would silently never appear.
      position={axisLabelAnchor(axis, dim)}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        // Bold upright with a combining circumflex: the DOM rendering of
        // \hat{\mathbf{x}}, matching how the course text sets unit vectors.
        className="whitespace-nowrap text-xl font-bold not-italic"
        style={{ color }}
      >
        {axis}&#770;
      </span>
    </Html>
  );
}

/**
 * The frame origin, labelled **o** in the same neutral tone as the sphere it
 * names. The offset is applied in screen space (a transform on the span, not
 * a shift of the 3D anchor) so the label keeps clear of the sphere from every
 * orbit angle instead of swinging over it.
 */
function OriginLabel() {
  return (
    <Html
      position={[0, 0, 0]}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="block whitespace-nowrap text-xl font-bold not-italic"
        style={{ color: COLORS.neutral, transform: "translate(-1em, 0.9em)" }}
      >
        o
      </span>
    </Html>
  );
}

/**
 * The 1D view's graduated ruler: the x line the axis is read off, ticked once
 * per basis vector — the same spacing as the plane's grid squares in 2D and
 * 3D, because it is the same graduation seen edge-on.
 */
function Ruler() {
  const tickHalf = 0.06;
  return (
    <group>
      <Line
        points={[
          [-GRID_HALF, 0, 0],
          [GRID_HALF, 0, 0],
        ]}
        color={COLORS.neutral}
        lineWidth={1}
      />
      {rulerTicks().map((t) => (
        <Line
          key={t}
          // Ticks stand along +z: the 1D camera looks down -y, so this is the
          // one direction that reads as "across the ruler" on screen.
          points={[
            [t, 0, -tickHalf],
            [t, 0, tickHalf],
          ]}
          color={COLORS.neutral}
          lineWidth={1}
        />
      ))}
    </group>
  );
}

/** One dashed guide line; the projections differ per view, the style does not. */
function Guide({ from, to }: { from: Vec3; to: Vec3 }) {
  return (
    <Line
      points={[from, to]}
      color={COLORS.neutral}
      lineWidth={1}
      dashed
      dashSize={0.09}
      gapSize={0.06}
    />
  );
}

function MarkedPoint({
  position,
  label,
  projections,
  dim,
}: {
  position: Vec3;
  label: string;
  projections: boolean;
  dim: Dimension;
}) {
  const [px, py, pz] = position;
  const floor: Vec3 = [px, py, 0];

  return (
    <group>
      {/* Position vector from the frame origin to the point. */}
      <Line
        points={[[0, 0, 0], position]}
        color={COLORS.vector}
        lineWidth={2}
      />

      {projections && showsProjections(dim) && (
        <>
          {/*
            In 2D the point already lies on the plane, so it drops straight to
            the two axes; only the 3D view needs the descent to the floor and
            the height read off z. Drawing the 3D set flat would put a
            zero-length line in the scene, which is a NaN direction.
          */}
          {dim === "3d" && <Guide from={position} to={floor} />}
          <Guide from={floor} to={[px, 0, 0]} />
          <Guide from={floor} to={[0, py, 0]} />
          {dim === "3d" && <Guide from={position} to={[0, 0, pz]} />}
        </>
      )}

      <mesh position={position}>
        <sphereGeometry args={[0.075, 24, 24]} />
        <meshStandardMaterial color={COLORS.point} roughness={0.35} />
      </mesh>

      <Html
        position={labelAnchor(position, dim)}
        center
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <span className="whitespace-nowrap text-sm font-semibold text-foreground">
          {label}
          <span className="ml-1 font-normal text-muted-foreground">
            {formatCoords(position, dim)}
          </span>
        </span>
      </Html>
    </group>
  );
}

/**
 * Points the camera at the current view, and forces the redraw that
 * `frameloop="demand"` would otherwise never issue.
 *
 * The camera is moved **during render**, not in an effect, and that is the
 * whole trick. `OrbitControls` reads `camera.up` once in its constructor to
 * fix its orbit axis (`_quat`) and never looks again; an effect would run
 * after drei had already built the instance, leaving the 2D view orbiting
 * about +z while its camera looked along it. Paired with a keyed remount of
 * the controls — which also discards the leftover rotation deltas that made a
 * drag in 3D reappear as a skew in the flat views — this keeps one WebGL
 * context alive across every switch. The mutation is idempotent, so a
 * double-render under StrictMode is harmless.
 */
function CameraRig({ view }: { view: Camera }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const applied = useRef<Camera | null>(null);

  // Only on an actual change of view. Re-aiming on every render would snap
  // the camera back to its default framing the next time anything above this
  // widget re-rendered, throwing away a rotation the student had just dragged
  // — now that the 2D view rotates too, that is two views' worth of work to
  // lose. The entries of VIEW_CAMERA are module constants, so identity is the
  // right comparison.
  if (applied.current !== view) {
    applied.current = view;
    camera.up.set(view.up[0], view.up[1], view.up[2]);
    camera.position.set(view.position[0], view.position[1], view.position[2]);
    camera.lookAt(view.target[0], view.target[1], view.target[2]);
    camera.updateProjectionMatrix();
  }

  useEffect(() => invalidate(), [view, invalidate]);

  return null;
}

/**
 * The 2D view's drag: spinning the frame about the ẑ it would have in 3D.
 *
 * `OrbitControls` cannot express this — it orbits a camera around a target
 * and has no notion of roll — so the gesture is handled here, on the same
 * canvas, with the controls' own rotation switched off. The pointer is read
 * as an angle about the centre of the stage, which makes the frame turn like
 * a knob under the finger rather than responding to raw horizontal travel.
 *
 * Listeners rather than React state: a drag would otherwise re-render the
 * whole scene on every pointer move, and the camera is not React's to own.
 */
function PlaneRoll({ enabled, view }: { enabled: boolean; view: Camera }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    // Starts square to the plane on every entry into the view, so switching
    // away and back is a clean slate rather than a resumed half-turn.
    let angle = 0;
    let last: number | null = null;

    const angleAt = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2),
      );
    };

    const down = (e: PointerEvent) => {
      last = angleAt(e);
      el.setPointerCapture(e.pointerId);
    };

    const move = (e: PointerEvent) => {
      if (last === null) return;
      const now = angleAt(e);
      angle += shortestAngleDelta(last, now);
      last = now;
      const up = rollUp(angle);
      camera.up.set(up[0], up[1], up[2]);
      camera.lookAt(view.target[0], view.target[1], view.target[2]);
      invalidate();
    };

    const release = (e: PointerEvent) => {
      last = null;
      if (el.hasPointerCapture(e.pointerId))
        el.releasePointerCapture(e.pointerId);
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", release);
      el.removeEventListener("pointercancel", release);
    };
  }, [enabled, gl, camera, invalidate, view]);

  return null;
}

export default function CoordFrame3D({
  labels,
  grid,
  point,
  pointLabel,
  projections,
  autoRotate,
  variant,
}: CoordFrame3DProps) {
  const dim = toDimension(variant);
  const axes = visibleAxes(dim);
  const view = VIEW_CAMERA[dim];

  const rotation = rotationMode(dim);
  // Auto-rotate is an orbit, so it belongs only to the view that orbits.
  const spinning = autoRotate && rotation === "orbit";

  return (
    <div className="relative h-full w-full">
      <Canvas
        frameloop={spinning ? "always" : "demand"}
        // Initial framing only; `CameraRig` owns every move after mount. The
        // 3D view's camera is the print fallback's too, so paper matches
        // screen.
        camera={{
          position: view.position,
          fov: view.fov,
          up: view.up,
        }}
        gl={{ antialias: true }}
        style={{ touchAction: "none" }}
      >
        <CameraRig view={view} />
        <PlaneRoll enabled={rotation === "roll"} view={view} />

        <ambientLight intensity={1.1} />
        <directionalLight position={[4, -6, 8]} intensity={1.6} />
        <directionalLight position={[-5, 4, -3]} intensity={0.4} />

        {grid &&
          (referenceKind(dim) === "ruler" ? (
            <Ruler />
          ) : (
            <gridHelper
              // One square per basis vector, two squares out from the origin
              // in each direction — see GRID_STEP.
              args={[GRID_SIZE, GRID_DIVISIONS, COLORS.neutral, COLORS.neutral]}
              // three.js lays the grid on xz; robotics wants it on the xy plane.
              rotation={[Math.PI / 2, 0, 0]}
            />
          ))}

        {axes.map((axis) => (
          <Arrow key={axis} axis={axis} color={COLORS[axis]} />
        ))}

        <mesh>
          <sphereGeometry args={[0.055, 20, 20]} />
          <meshStandardMaterial color={COLORS.neutral} roughness={0.4} />
        </mesh>

        {labels && (
          <>
            {axes.map((axis) => (
              <AxisLabel
                key={axis}
                axis={axis}
                color={COLORS[axis]}
                dim={dim}
              />
            ))}
            <OriginLabel />
          </>
        )}

        {point && (
          <MarkedPoint
            position={clampPoint(point, dim)}
            label={pointLabel}
            projections={projections}
            dim={dim}
          />
        )}

        <OrbitControls
          // Fresh instance per view: the orbit axis is fixed at construction,
          // and a stale one carries the previous view's rotation into this one.
          key={dim}
          makeDefault
          enablePan={false}
          target={view.target}
          enableRotate={rotation === "orbit"}
          autoRotate={spinning}
          autoRotateSpeed={0.7}
          minDistance={2.5}
          maxDistance={12}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      <p className="pointer-events-none absolute bottom-2 left-0 w-full text-center text-xs text-muted-foreground">
        {interactionHint(dim)}
      </p>
    </div>
  );
}
