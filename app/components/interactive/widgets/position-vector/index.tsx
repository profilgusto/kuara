"use client";
/**
 * Widget `position-vector` — the position vector of a point the student moves.
 *
 * Written for the "Posição" section of Representação Espacial, which defines
 * ᴵp_r as the sum x_r x̂_I + y_r ŷ_I + z_r ẑ_I and calls the resulting triple
 * the point's coordinate vector. The widget makes that equation operable: the
 * sliders drive the coordinates, the arrow from the frame origin to the point
 * is the vector, and the panel writes it in both of the forms the text uses.
 *
 * It follows the same conventions as `coord-frame-3d` — z up, x/y/z as
 * red/green/blue, DOM labels rather than drei's `<Text>` (troika would fetch
 * its font from fonts.gstatic.com, which Kuara's CSP blocks) — and shares its
 * dimension logic through `../../dimensions`. What differs is scale: the point
 * ranges over ±5, so the world is ten units across while the basis arrows stay
 * one unit long.
 */
import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import {
  AXIS_LENGTH,
  GRID_DIVISIONS,
  GRID_SIZE,
  MAX_DISTANCE,
  MIN_DISTANCE,
  RANGE,
  SLIDER_MAX,
  SLIDER_MIN,
  VIEW_CAMERA,
  arrowQuaternion,
  axisLabelAnchor,
  basisExpansion,
  clampPoint,
  clampToRange,
  clampVector,
  gridTicks,
  interactionHint,
  isDrawableVector,
  labelAnchor,
  referenceKind,
  rollUp,
  rotationMode,
  shortestAngleDelta,
  showsProjections,
  sliderAxes,
  toDimension,
  vectorComponents,
  visibleAxes,
  type AxisKey,
  type Dimension,
} from "./scene";

export interface PositionVectorProps {
  point: Vec3 | null;
  pointLabel: string;
  frameName: string;
  step: number;
  labels: boolean;
  grid: boolean;
  projections: boolean;
  /**
   * Which view the box's header switch has selected. Optional because the
   * widget also renders outside the box — the admin thumbnail, a test — where
   * nothing sets it; see `toDimension`.
   */
  variant?: string;
}

/** Proportions of the one-unit basis arrows. */
const SHAFT_RADIUS = 0.03;
const HEAD_LENGTH = 0.24;
const HEAD_RADIUS = 0.09;

/** The position vector is drawn heavier: it is the subject of the figure. */
const VECTOR_SHAFT_RADIUS = 0.05;
const VECTOR_HEAD_LENGTH = 0.42;
const VECTOR_HEAD_RADIUS = 0.16;

const COLORS = {
  x: "#e05252",
  y: "#3faf5c",
  z: "#2fa8b8",
  // One mid-tone for grid and guides: legible on both the light and the dark
  // surface without threading next-themes through the WebGL scene.
  neutral: "#8a9a94",
  point: "#c9bfa3",
  vector: "#c98a3f",
} as const;

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

/**
 * The position vector itself: origin to point, in whatever direction the
 * sliders currently put it.
 *
 * The basis arrows can be posed with fixed Euler angles because they only
 * point three ways; this one is aimed with the shortest-arc quaternion from
 * +Y — see `arrowQuaternion`, which keeps that maths out of the component and
 * under test.
 */
function VectorArrow({ to }: { to: Vec3 }) {
  const length = Math.hypot(to[0], to[1], to[2]);
  // A vector short enough that the head alone would overrun it is drawn as
  // head only, scaled down, rather than as a cone poking out the far side.
  const headLength = Math.min(VECTOR_HEAD_LENGTH, length * 0.8);
  const shaftLength = length - headLength;

  return (
    <group quaternion={arrowQuaternion(to)}>
      {shaftLength > 0 && (
        <mesh position={[0, shaftLength / 2, 0]}>
          <cylinderGeometry
            args={[VECTOR_SHAFT_RADIUS, VECTOR_SHAFT_RADIUS, shaftLength, 20]}
          />
          <meshStandardMaterial color={COLORS.vector} roughness={0.35} />
        </mesh>
      )}
      <mesh position={[0, shaftLength + headLength / 2, 0]}>
        <coneGeometry
          args={[
            VECTOR_HEAD_RADIUS * (headLength / VECTOR_HEAD_LENGTH),
            headLength,
            24,
          ]}
        />
        <meshStandardMaterial color={COLORS.vector} roughness={0.35} />
      </mesh>
    </group>
  );
}

function AxisLabel({
  axis,
  color,
  dim,
  frameName,
}: {
  axis: AxisKey;
  color: string;
  dim: Dimension;
  frameName: string;
}) {
  return (
    <Html
      position={axisLabelAnchor(axis, dim)}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        // Bold upright with a combining circumflex and the frame in the
        // subscript: the DOM rendering of \hat{\mathbf{x}}_\mathrm{I}, which
        // is how the section sets its basis vectors.
        className="whitespace-nowrap text-lg font-bold not-italic"
        style={{ color }}
      >
        {axis}
        {"̂"}
        <sub className="text-[0.6em] font-semibold">{frameName}</sub>
      </span>
    </Html>
  );
}

/** The frame origin, nudged clear of its sphere in screen space. */
function OriginLabel() {
  return (
    <Html
      position={[0, 0, 0]}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="block whitespace-nowrap text-lg font-bold not-italic"
        style={{ color: COLORS.neutral, transform: "translate(-1em, 0.9em)" }}
      >
        o
      </span>
    </Html>
  );
}

/** The 1D view's ruler: the plane's graduation seen edge-on. */
function Ruler() {
  const tickHalf = 0.12;
  return (
    <group>
      <Line
        points={[
          [-RANGE, 0, 0],
          [RANGE, 0, 0],
        ]}
        color={COLORS.neutral}
        lineWidth={1}
      />
      {gridTicks().map((t) => (
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

/** One dashed guide from the point back to an axis. */
function Guide({ from, to }: { from: Vec3; to: Vec3 }) {
  return (
    <Line
      points={[from, to]}
      color={COLORS.neutral}
      lineWidth={1}
      dashed
      dashSize={0.22}
      gapSize={0.15}
    />
  );
}

function MarkedPoint({
  position,
  label,
  projections,
  labels,
  dim,
}: {
  position: Vec3;
  label: string;
  projections: boolean;
  labels: boolean;
  dim: Dimension;
}) {
  const [px, py, pz] = position;
  const floor: Vec3 = [px, py, 0];

  return (
    <group>
      {isDrawableVector(position) && <VectorArrow to={position} />}

      {projections && showsProjections(dim) && (
        <>
          {/*
            In 2D the point already lies on the plane and drops straight to the
            two axes; only 3D needs the descent to the floor and the height read
            off z. Drawing those flat would be a zero-length line, i.e. a NaN
            direction.
          */}
          {dim === "3d" && <Guide from={position} to={floor} />}
          <Guide from={floor} to={[px, 0, 0]} />
          <Guide from={floor} to={[0, py, 0]} />
          {dim === "3d" && <Guide from={position} to={[0, 0, pz]} />}
        </>
      )}

      <mesh position={position}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color={COLORS.point} roughness={0.35} />
      </mesh>

      {labels && (
        <Html
          position={labelAnchor(position, dim)}
          center
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <span className="whitespace-nowrap text-sm font-semibold text-foreground">
            {label}
            <span className="ml-1 font-normal text-muted-foreground">
              ({vectorComponents(position, dim).join(", ")})
            </span>
          </span>
        </Html>
      )}
    </group>
  );
}

/**
 * Points the camera at the current view, and forces the redraw that
 * `frameloop="demand"` would otherwise never issue.
 *
 * The camera is moved **during render**, not in an effect: `OrbitControls`
 * reads `camera.up` once in its constructor to fix its orbit axis and never
 * looks again, so an effect would run too late and leave a flat view orbiting
 * about an axis it is looking straight down. The mutation is idempotent, so a
 * double render under StrictMode is harmless, and it only fires on an actual
 * change of view — re-aiming on every render would throw away a rotation the
 * student had just dragged.
 */
function CameraRig({ view }: { view: Camera }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  // The stage is a flex child, so its height is not known until the browser
  // has laid the panel out below it: the canvas mounts at one size and is
  // resized a tick later. Under `frameloop="demand"` that resize does not ask
  // for a frame by itself, and the block sat blank until the student happened
  // to drag it. Redrawing on every size change is the fix, and it covers the
  // window being resized afterwards for free.
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

/**
 * The 2D view's drag: spinning the frame about the ẑ it would have in 3D.
 *
 * `OrbitControls` has no notion of roll, so the gesture is handled here with
 * the controls' own rotation switched off. The pointer is read as an angle
 * about the centre of the stage, so the frame turns like a knob under the
 * finger. Listeners rather than state: a drag would otherwise re-render the
 * whole scene on every pointer move.
 */
function PlaneRoll({ enabled, view }: { enabled: boolean; view: Camera }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
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

/**
 * `ᴵp_r`, set the way the section writes it: the frame as a left superscript,
 * the vector name bold upright, the point as a subscript.
 */
function VectorName({
  frameName,
  pointLabel,
}: {
  frameName: string;
  pointLabel: string;
}) {
  return (
    <span className="whitespace-nowrap">
      <sup className="text-[0.7em]">{frameName}</sup>
      <strong className="font-bold not-italic">p</strong>
      <sub className="text-[0.7em]">{pointLabel}</sub>
    </span>
  );
}

/** The coordinate vector, bracketed as a column the way equation (1) sets it. */
function ColumnVector({ components }: { components: string[] }) {
  return (
    <span className="inline-flex items-stretch text-foreground">
      <span className="w-1.5 rounded-l-sm border-y border-l border-muted-foreground/70" />
      <span className="flex flex-col px-1.5 text-right tabular-nums leading-tight">
        {components.map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </span>
      <span className="w-1.5 rounded-r-sm border-y border-r border-muted-foreground/70" />
    </span>
  );
}

/**
 * The panel under the stage: what the vector currently *is*, in the two forms
 * the text gives it, plus the sliders that drive it.
 *
 * The expansion over the basis vectors is the one that carries the idea, but
 * it is also the widest thing here, so it drops out below `sm` rather than
 * wrapping the panel into three lines on a phone.
 */
function ReadoutPanel({
  point,
  dim,
  frameName,
  pointLabel,
}: {
  point: Vec3;
  dim: Dimension;
  frameName: string;
  pointLabel: string;
}) {
  const components = vectorComponents(point, dim);
  const terms = basisExpansion(point, dim);
  const axes = sliderAxes(dim);

  return (
    <div className="flex items-center gap-2 text-sm">
      <VectorName frameName={frameName} pointLabel={pointLabel} />
      <span aria-hidden>=</span>
      <span className="hidden items-center gap-1.5 sm:flex">
        {terms.map((term, i) => (
          <span key={axes[i]} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>+</span>}
            <span
              className="whitespace-nowrap tabular-nums"
              style={{ color: COLORS[axes[i]] }}
            >
              {term}
              <sub className="text-[0.7em]">{frameName}</sub>
            </span>
          </span>
        ))}
        <span aria-hidden>=</span>
      </span>
      <ColumnVector components={components} />
    </div>
  );
}

/** One coordinate's slider, labelled with the basis vector it runs along. */
function AxisSlider({
  axis,
  value,
  step,
  onChange,
}: {
  axis: AxisKey;
  value: number;
  step: number;
  onChange: (value: number) => void;
}) {
  const color = COLORS[axis];
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span
        className="w-4 text-right font-bold not-italic"
        style={{ color }}
        aria-hidden
      >
        {axis}
        {"̂"}
      </span>
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={step}
        value={value}
        aria-label={`Coordenada ${axis}`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer sm:w-32"
        style={{ accentColor: color }}
      />
      <span className="w-8 text-right tabular-nums text-muted-foreground">
        {value}
      </span>
    </label>
  );
}

export default function PositionVector({
  point,
  pointLabel,
  frameName,
  step,
  labels,
  grid,
  projections,
  variant,
}: PositionVectorProps) {
  const dim = toDimension(variant);
  const view = VIEW_CAMERA[dim];
  const rotation = rotationMode(dim);

  // The authored point is only the starting position; from then on the
  // sliders own it. Clamped on the way in, because `vec3` will happily parse a
  // "9,0,0" that no slider could ever bring back into view.
  const [coords, setCoords] = useState<Vec3>(() =>
    clampVector(point ?? [0, 0, 0]),
  );

  // Coordinates outside the current view are held, not discarded: dropping to
  // 2D and back must return the student's z, not zero it.
  const shown = clampPoint(coords, dim);

  const setAxis = (index: number, value: number) =>
    setCoords((prev) => {
      const next: Vec3 = [...prev];
      next[index] = clampToRange(value);
      return next;
    });

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
          <PlaneRoll enabled={rotation === "roll"} view={view} />

          <ambientLight intensity={1.1} />
          <directionalLight position={[4, -6, 8]} intensity={1.6} />
          <directionalLight position={[-5, 4, -3]} intensity={0.4} />

          {grid &&
            (referenceKind(dim) === "ruler" ? (
              <Ruler />
            ) : (
              <gridHelper
                // One square per basis vector, out to the slider's limit.
                args={[
                  GRID_SIZE,
                  GRID_DIVISIONS,
                  COLORS.neutral,
                  COLORS.neutral,
                ]}
                // three.js lays the grid on xz; robotics wants it on xy.
                rotation={[Math.PI / 2, 0, 0]}
              />
            ))}

          {visibleAxes(dim).map((axis) => (
            <BasisArrow key={axis} axis={axis} color={COLORS[axis]} />
          ))}

          <mesh>
            <sphereGeometry args={[0.1, 20, 20]} />
            <meshStandardMaterial color={COLORS.neutral} roughness={0.4} />
          </mesh>

          {labels && (
            <>
              {visibleAxes(dim).map((axis) => (
                <AxisLabel
                  key={axis}
                  axis={axis}
                  color={COLORS[axis]}
                  dim={dim}
                  frameName={frameName}
                />
              ))}
              <OriginLabel />
            </>
          )}

          <MarkedPoint
            position={shown}
            label={pointLabel}
            projections={projections}
            labels={labels}
            dim={dim}
          />

          <OrbitControls
            // Fresh instance per view: the orbit axis is fixed at construction,
            // and a stale one carries the previous view's rotation into this one.
            key={dim}
            makeDefault
            enablePan={false}
            target={view.target}
            enableRotate={rotation === "orbit"}
            minDistance={MIN_DISTANCE}
            maxDistance={MAX_DISTANCE}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        <p className="pointer-events-none absolute bottom-1 left-0 w-full text-center text-xs text-muted-foreground">
          {interactionHint(dim)}
        </p>
      </div>

      {/*
        Readout over sliders, both centred on the block: the vector is the
        subject of the figure, so it sits under the middle of the scene rather
        than pushed into a corner, and each slider stays under the axis it
        drives instead of drifting to whichever edge the row ends at.
      */}
      <div className="flex flex-col items-center gap-1.5 border-t border-border bg-muted/30 px-3 py-2">
        <ReadoutPanel
          point={shown}
          dim={dim}
          frameName={frameName}
          pointLabel={pointLabel}
        />
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {sliderAxes(dim).map((axis, i) => (
            <AxisSlider
              key={axis}
              axis={axis}
              value={coords[i]}
              step={step}
              onChange={(value) => setAxis(i, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
