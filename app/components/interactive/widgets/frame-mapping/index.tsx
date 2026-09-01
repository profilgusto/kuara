"use client";
/**
 * Widget `frame-mapping` — the same point, read in two frames.
 *
 * Written for the "Mapeando de um frame para o outro" section, which states
 * the mapping as ᴮp_m = ᴮR_A ᴬp_m + ᴮp_A and works one numeric example
 * through it. The figure exists to make that example movable: the student
 * drags m anywhere, puts {B} anywhere, and watches the three quantities on
 * the right-hand side re-instantiate and the arithmetic redo itself.
 *
 * The one thing the widget must not let a student believe is that ᴮp_A is
 * minus the place they dragged {B} to. It is that displacement *resolved in
 * {B}'s axes* — so turning {B} without moving it changes ᴮp_A, and the panel
 * shows that happening. `./mapping` owns the inversion; nothing here does
 * arithmetic of its own.
 *
 * Conventions follow the rest of the family — z up, x/y/z as red/green/blue,
 * DOM labels rather than drei's `<Text>` (troika would fetch its font from
 * fonts.gstatic.com, which Kuara's CSP blocks).
 */
import { useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Vec3 } from "../../props";
import type { Camera } from "../../projection";
import {
  ANGLE_MAX,
  ANGLE_MIN,
  ANGLE_SYMBOLS,
  AXIS_LENGTH,
  GRID_DIVISIONS,
  GRID_SIZE,
  MAX_DISTANCE,
  MIN_DISTANCE,
  SLIDER_MAX,
  SLIDER_MIN,
  VIEW_CAMERA,
  angleAxes,
  arrowQuaternion,
  axisLabelAnchor,
  clampAngle,
  clampAngles,
  clampCoord,
  clampVector,
  flatten,
  interactionHint,
  invertPose,
  isDrawable,
  mapPoint,
  matrixEntries,
  matrixToQuaternion,
  frameLabelAnchor,
  vectorLabelAnchor,
  poseOf,
  rotatedTerm,
  unmapPoint,
  toView,
  vectorEntries,
  viewAxes,
  type AxisKey,
  type View,
} from "./mapping";

export interface FrameMappingProps {
  point: Vec3 | null;
  framePosition: Vec3 | null;
  angles: Vec3 | null;
  step: number;
  positionStep: number;
  decimals: number;
  referenceName: string;
  targetName: string;
  pointLabel: string;
  labels: boolean;
  grid: boolean;
  /**
   * Which view the box's header switch has selected. Optional because the
   * widget also renders outside the box — the admin thumbnail, a test — where
   * nothing sets it; see `toView`.
   */
  variant?: string;
}

/** Proportions of the unit basis arrows. The two frames share them. */
const SHAFT_RADIUS = 0.035;
const HEAD_LENGTH = 0.3;
const HEAD_RADIUS = 0.11;

/** The three mapping vectors are drawn heavier: they are the subject. */
const VECTOR_SHAFT_RADIUS = 0.05;
const VECTOR_HEAD_LENGTH = 0.4;
const VECTOR_HEAD_RADIUS = 0.16;

/**
 * ...but translucent, because they are readings rather than things. All three
 * meet at the point and two of them run nearly along each other, so a solid
 * shaft hides whichever arrow, triad or marker sits behind it — and what is
 * behind them is exactly what the figure is about.
 */
const VECTOR_OPACITY = 0.62;

/**
 * Two palettes of the same three hues, so a reader can still pair x with x
 * across the frames while telling the frames apart. Both are drawn at the
 * same weight and fully opaque: neither frame is a backdrop here — the whole
 * question is what the *same* point looks like from each of them, and a
 * faded triad reads as the less real of the two.
 */
const REFERENCE = {
  x: "#b0392f",
  y: "#2c8a49",
  z: "#1f8593",
} as const;

const TARGET = {
  x: "#e05252",
  y: "#3faf5c",
  z: "#2fa8b8",
} as const;

/**
 * One hue per term of the equation, and none of them an axis hue: these are
 * positions, not directions, and must not read as a fourth basis vector.
 * The same three colours label the arrows on the stage and the columns in the
 * panel, which is the only thing tying the drawing to the arithmetic.
 */
const INK = {
  /** ᴬp_m — o_A to m. */
  fromReference: "#8a7ad0",
  /** ᴮp_A — o_B to o_A, the arrow whose coordinates are read in {B}. */
  betweenOrigins: "#d9a13b",
  /** ᴮp_m — o_B to m, the answer. */
  toTarget: "#3f8fd0",
  point: "#c9bfa3",
} as const;

// A single mid-tone for the grid and the origins: legible on both the light
// and the dark surface without threading next-themes through the WebGL scene.
const NEUTRAL = "#8a9a94";

/**
 * Euler rotations that aim a +Y-oriented cylinder/cone down each axis.
 * three.js builds both primitives along +Y, so x needs -90° about z and z
 * needs +90° about x; y is already in place. Both triads are drawn in their
 * own canonical pose — {B}'s group carries the rotation, not its arrows.
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

function AxisLabel({
  axis,
  color,
  frameName,
}: {
  axis: AxisKey;
  color: string;
  frameName: string;
}) {
  return (
    <Html
      position={axisLabelAnchor(axis)}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        // Bold upright with a combining circumflex and the frame in the
        // subscript: the DOM rendering of \hat{\mathbf{x}}_\mathrm{A}, which
        // is how the section sets its basis vectors.
        className="whitespace-nowrap text-base font-bold not-italic"
        style={{ color }}
      >
        {axis}
        {"̂"}
        <sub className="text-[0.62em] font-semibold">{frameName}</sub>
      </span>
    </Html>
  );
}

/**
 * A frame's origin, named and braced — {A} and {B} as the section writes them.
 * Both ends of every arrow in this figure are origins or the point, so all
 * three have to be labelled for any of the numbers to mean anything.
 */
function FrameLabel({
  frameName,
  color,
  at,
}: {
  frameName: string;
  color: string;
  /** In the frame's own coordinates, since it hangs inside that frame's group. */
  at: Vec3;
}) {
  return (
    <Html
      position={at}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="block whitespace-nowrap text-base font-bold not-italic"
        style={{ color }}
      >
        {`{${frameName}}`}
      </span>
    </Html>
  );
}

/** One triad: three arrows and, optionally, their labels. */
function Triad({
  colors,
  frameName,
  axes,
  labels,
}: {
  colors: Record<AxisKey, string>;
  frameName: string;
  axes: AxisKey[];
  labels: boolean;
}) {
  return (
    <group>
      {axes.map((axis) => (
        <BasisArrow key={axis} axis={axis} color={colors[axis]} />
      ))}
      {labels &&
        axes.map((axis) => (
          <AxisLabel
            key={axis}
            axis={axis}
            color={colors[axis]}
            frameName={frameName}
          />
        ))}
    </group>
  );
}

/**
 * One of the three mapping vectors, drawn between two points of the scene.
 *
 * Aimed with the shortest-arc quaternion rather than fixed Euler angles,
 * because unlike a basis arrow these point wherever the sliders put them.
 */
function MappingArrow({
  from,
  to,
  color,
}: {
  from: Vec3;
  to: Vec3;
  color: string;
}) {
  const delta: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(delta[0], delta[1], delta[2]);
  // An arrow short enough that the head alone would overrun it is drawn as
  // head only, scaled down, rather than as a cone poking out the far side.
  const headLength = Math.min(VECTOR_HEAD_LENGTH, length * 0.8);
  const shaftLength = length - headLength;

  return (
    <group position={from} quaternion={arrowQuaternion(delta)}>
      {shaftLength > 0 && (
        <mesh position={[0, shaftLength / 2, 0]}>
          <cylinderGeometry
            args={[VECTOR_SHAFT_RADIUS, VECTOR_SHAFT_RADIUS, shaftLength, 20]}
          />
          <meshStandardMaterial
            color={color}
            roughness={0.35}
            transparent
            opacity={VECTOR_OPACITY}
          />
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
        <meshStandardMaterial
          color={color}
          roughness={0.35}
          transparent
          opacity={VECTOR_OPACITY}
        />
      </mesh>
    </group>
  );
}

/**
 * A quantity set the way the section writes it: the frame it is read in as a
 * left superscript, the name bold upright, what it points at as a subscript.
 * ᴬp_m, ᴮp_A, ᴮp_m and ᴮR_A all come out of here.
 */
function Quantity({
  letter,
  from,
  of: subscript,
  color,
}: {
  letter: string;
  from: string;
  of: string;
  color?: string;
}) {
  return (
    <span className="whitespace-nowrap" style={color ? { color } : undefined}>
      <sup className="text-[0.7em]">{from}</sup>
      <strong className="font-bold not-italic">{letter}</strong>
      <sub className="text-[0.7em]">{subscript}</sub>
    </span>
  );
}

/**
 * A vector's name, floating beside its own shaft.
 *
 * `at` and `side` come from the caller because only the caller knows which
 * other arrows this one shares the stage with — see `vectorLabelAnchor` for
 * why three midpoints are not enough in this figure.
 */
function VectorLabel({
  from,
  to,
  letter,
  frame,
  of: subscript,
  color,
  at,
  lift,
}: {
  from: Vec3;
  to: Vec3;
  letter: string;
  frame: string;
  of: string;
  color: string;
  at: number;
  lift: number;
}) {
  return (
    <Html
      position={vectorLabelAnchor(from, to, { at, offset: 0.5, lift })}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span className="whitespace-nowrap text-sm font-bold not-italic">
        <Quantity letter={letter} from={frame} of={subscript} color={color} />
      </span>
    </Html>
  );
}

/** The point m itself, with its name beside it. */
function MarkedPoint({
  position,
  label,
  labels,
  up,
}: {
  position: Vec3;
  label: string;
  labels: boolean;
  up: Vec3;
}) {
  return (
    <group>
      <mesh position={position}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshStandardMaterial color={INK.point} roughness={0.35} />
      </mesh>
      {labels && (
        <Html
          // Offset along whichever way is up *on screen* in this view: a fixed
          // +z nudge would land the label on the marker in the flat one.
          position={[
            position[0] + up[0] * 0.5,
            position[1] + up[1] * 0.5,
            position[2] + up[2] * 0.5,
          ]}
          center
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <span className="whitespace-nowrap text-base font-bold italic text-foreground">
            {label}
          </span>
        </Html>
      )}
    </group>
  );
}

/**
 * The dashed path o_A → (pₓ, p_y, 0) → o_B, drawn only in space.
 *
 * Without it, a frame lifted off the plane is impossible to place by eye: the
 * arrow alone is ambiguous under perspective. In the flat view the whole scene
 * lies on the grid, so the guide would be a line drawn over another line.
 */
function HeightGuide({ to, color }: { to: Vec3; color: string }) {
  const foot: Vec3 = [to[0], to[1], 0];
  return (
    <group>
      <Line
        points={[[0, 0, 0], foot]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={0.2}
        gapSize={0.15}
        transparent
        opacity={0.7}
      />
      <Line
        points={[foot, to]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={0.2}
        gapSize={0.15}
        transparent
        opacity={0.7}
      />
    </group>
  );
}

/**
 * Points the camera at the current view, and forces the redraw that
 * `frameloop="demand"` would otherwise never issue.
 *
 * The camera is moved **during render**, not in an effect: `OrbitControls`
 * reads `camera.up` once in its constructor to fix its orbit axis and never
 * looks again, so an effect would run too late and leave the flat view
 * orbiting about an axis it is looking straight down. The mutation is
 * idempotent, and it only fires on an actual change of view — re-aiming on
 * every render would throw away a rotation the student had just dragged.
 */
function CameraRig({ view, on }: { view: Camera; on: unknown }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  // The stage is a flex child, so its height is not known until the browser
  // has laid the panel out below it: the canvas mounts at one size and is
  // resized a tick later, and under `frameloop="demand"` that resize does not
  // ask for a frame by itself.
  const size = useThree((s) => s.size);
  const applied = useRef<Camera | null>(null);

  if (applied.current !== view) {
    applied.current = view;
    camera.up.set(view.up[0], view.up[1], view.up[2]);
    camera.position.set(view.position[0], view.position[1], view.position[2]);
    camera.lookAt(view.target[0], view.target[1], view.target[2]);
    camera.updateProjectionMatrix();
  }

  useEffect(() => invalidate(), [on, view, size, invalidate]);

  return null;
}

/** A column vector, bracketed as the section sets it. */
function ColumnVector({
  entries,
  color,
}: {
  entries: string[];
  color?: string;
}) {
  return (
    <span className="inline-flex items-stretch">
      <span className="w-1.5 rounded-l-sm border-y border-l border-muted-foreground/70" />
      <span
        className="flex flex-col px-1.5 text-right tabular-nums leading-tight"
        style={color ? { color } : undefined}
      >
        {entries.map((e, i) => (
          <span key={i} className="w-9">
            {e}
          </span>
        ))}
      </span>
      <span className="w-1.5 rounded-r-sm border-y border-r border-muted-foreground/70" />
    </span>
  );
}

/**
 * ᴮR_A, bracketed and tinted by column.
 *
 * The columns keep the axis hues of {A}, because that is what the columns of
 * ᴮR_A *are*: the basis vectors of {A} resolved in {B} — the same reading the
 * `rotation-matrix` widget teaches, and the two panels must not disagree.
 */
function MatrixPanel({ rows, axes }: { rows: string[][]; axes: AxisKey[] }) {
  return (
    <span className="inline-flex items-stretch">
      <span className="w-1.5 rounded-l-sm border-y border-l border-muted-foreground/70" />
      <span className="px-1 py-0.5">
        {rows.map((row, r) => (
          <span key={r} className="flex leading-tight">
            {row.map((entry, c) => (
              <span
                key={c}
                className="w-9 px-0.5 text-right tabular-nums"
                style={{ color: REFERENCE[axes[c]] }}
              >
                {entry}
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="w-1.5 rounded-r-sm border-y border-r border-muted-foreground/70" />
    </span>
  );
}

/**
 * The three quantities the formula needs, each named and instantiated.
 *
 * They sit above the equation rather than inside it because they come from
 * three different places: one is where the student put m, one is how they
 * turned {B}, and one is derived from both — and a student who cannot find
 * ᴮp_A on the stage should be able to find it here.
 */
function GivensRow({
  point,
  rotationRows,
  translation,
  axes,
  view,
  decimals,
  referenceName,
  targetName,
  pointLabel,
}: {
  point: Vec3;
  rotationRows: string[][];
  translation: Vec3;
  axes: AxisKey[];
  view: View;
  decimals: number;
  referenceName: string;
  targetName: string;
  pointLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
      <span className="flex items-center gap-1.5">
        <Quantity
          letter="p"
          from={referenceName}
          of={pointLabel}
          color={INK.fromReference}
        />
        <span aria-hidden>=</span>
        <ColumnVector
          entries={vectorEntries(point, view, decimals)}
          color={INK.fromReference}
        />
      </span>

      <span className="flex items-center gap-1.5">
        <Quantity letter="R" from={targetName} of={referenceName} />
        <span aria-hidden>=</span>
        <MatrixPanel rows={rotationRows} axes={axes} />
      </span>

      <span className="flex items-center gap-1.5">
        <Quantity
          letter="p"
          from={targetName}
          of={referenceName}
          color={INK.betweenOrigins}
        />
        <span aria-hidden>=</span>
        <ColumnVector
          entries={vectorEntries(translation, view, decimals)}
          color={INK.betweenOrigins}
        />
      </span>
    </div>
  );
}

/**
 * The mapping, done: the symbols, then the numbers, then the product, then the
 * answer — the four stages the worked example writes out by hand.
 *
 * The middle two collapse below `sm`: on a phone the line would otherwise wrap
 * into something no student would recognise as one equation, and the stage
 * that has to survive is the last one, ᴮp_m itself.
 */
function EquationRow({
  point,
  rotationRows,
  translation,
  rotated,
  mapped,
  axes,
  view,
  decimals,
  referenceName,
  targetName,
  pointLabel,
}: {
  point: Vec3;
  rotationRows: string[][];
  translation: Vec3;
  rotated: Vec3;
  mapped: Vec3;
  axes: AxisKey[];
  view: View;
  decimals: number;
  referenceName: string;
  targetName: string;
  pointLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
      <Quantity
        letter="p"
        from={targetName}
        of={pointLabel}
        color={INK.toTarget}
      />
      <span aria-hidden>=</span>
      <Quantity letter="R" from={targetName} of={referenceName} />
      <Quantity
        letter="p"
        from={referenceName}
        of={pointLabel}
        color={INK.fromReference}
      />
      <span aria-hidden>+</span>
      <Quantity
        letter="p"
        from={targetName}
        of={referenceName}
        color={INK.betweenOrigins}
      />

      <span className="hidden items-center gap-2 sm:flex">
        <span aria-hidden>=</span>
        <MatrixPanel rows={rotationRows} axes={axes} />
        <ColumnVector
          entries={vectorEntries(point, view, decimals)}
          color={INK.fromReference}
        />
        <span aria-hidden>+</span>
        <ColumnVector
          entries={vectorEntries(translation, view, decimals)}
          color={INK.betweenOrigins}
        />
      </span>

      <span className="hidden items-center gap-2 md:flex">
        <span aria-hidden>=</span>
        <ColumnVector entries={vectorEntries(rotated, view, decimals)} />
        <span aria-hidden>+</span>
        <ColumnVector
          entries={vectorEntries(translation, view, decimals)}
          color={INK.betweenOrigins}
        />
      </span>

      <span aria-hidden>=</span>
      <ColumnVector
        entries={vectorEntries(mapped, view, decimals)}
        color={INK.toTarget}
      />
    </div>
  );
}

/** One slider, in the colour of whatever it drives. */
function Slider({
  label,
  hint,
  value,
  min,
  max,
  step,
  color,
  readout,
  onChange,
}: {
  label: React.ReactNode;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  color: string;
  readout: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span
        className="w-9 text-right font-medium"
        style={{ color }}
        aria-hidden
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={hint}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-20 cursor-pointer sm:w-28"
        style={{ accentColor: color }}
      />
      <span className="w-10 text-right tabular-nums text-muted-foreground">
        {readout}
      </span>
    </label>
  );
}

/** A titled column of sliders — one group per thing the student can move. */
function SliderGroup({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {children}
    </div>
  );
}

export default function FrameMapping({
  point,
  framePosition,
  angles,
  step,
  positionStep,
  decimals,
  referenceName,
  targetName,
  pointLabel,
  labels,
  grid,
  variant,
}: FrameMappingProps) {
  const view = toView(variant);
  const camera = VIEW_CAMERA[view];
  const axes = viewAxes(view);

  // The authored values are only a starting position; from then on the
  // sliders own them. Clamped on the way in, because `vec3` will happily
  // parse a "20,0,0" that no slider could ever bring back into view.
  const initial = useRef({
    point: clampVector(point ?? [0, 0, 0]),
    framePosition: clampVector(framePosition ?? [0, 0, 0]),
    angles: clampAngles(angles ?? [0, 0, 0]),
  });

  const [pointCoords, setPointCoords] = useState<Vec3>(initial.current.point);
  const [frameCoords, setFrameCoords] = useState<Vec3>(
    initial.current.framePosition,
  );
  const [deg, setDeg] = useState<Vec3>(initial.current.angles);

  // Coordinates and angles outside the current view are held, not discarded:
  // dropping to 2D and back must return the student's z, not zero it.
  const shownPoint = flatten(pointCoords, view);
  const shownFrame = flatten(frameCoords, view);
  const shownAngles: Vec3 =
    view === "2d" ? [0, 0, deg[2]] : [deg[0], deg[1], deg[2]];

  // The two descriptions of one arrangement: what the student placed, and
  // what the formula reads. Everything below comes from the second.
  const referenceToTarget = poseOf(shownAngles, shownFrame);
  const pose = invertPose(referenceToTarget);

  const rotated = rotatedTerm(pose, shownPoint);
  const mapped = mapPoint(pose, shownPoint);
  const rotationRows = matrixEntries(pose.rotation, view, decimals);
  const quaternion = matrixToQuaternion(referenceToTarget.rotation);

  const atInitialPose =
    pointCoords.every((c, i) => c === initial.current.point[i]) &&
    frameCoords.every((c, i) => c === initial.current.framePosition[i]) &&
    deg.every((d, i) => d === initial.current.angles[i]);

  const setCoord =
    (set: typeof setPointCoords) => (index: number, value: number) =>
      set((prev) => {
        const next: Vec3 = [...prev];
        next[index] = clampCoord(value);
        return next;
      });

  const setPointCoord = setCoord(setPointCoords);
  const setFrameCoord = setCoord(setFrameCoords);

  const setAngle = (index: number, value: number) =>
    setDeg((prev) => {
      const next: Vec3 = [...prev];
      next[index] = clampAngle(value);
      return next;
    });

  const reset = () => {
    setPointCoords(initial.current.point);
    setFrameCoords(initial.current.framePosition);
    setDeg(initial.current.angles);
  };

  const origin: Vec3 = [0, 0, 0];
  // A label pushed sideways is enough to clear a shaft seen across; one seen
  // nearly end-on, which only happens in the 3D view, needs the vertical
  // clearance too.
  const labelLift = view === "3d" ? 0.32 : 0;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Canvas
          frameloop="demand"
          // Initial framing only; `CameraRig` owns every move after mount.
          camera={{ position: camera.position, fov: camera.fov, up: camera.up }}
          gl={{ antialias: true }}
          style={{ touchAction: "none" }}
        >
          {/* A string, not an array: a fresh array every render would ask for
              a frame on every render. */}
          <CameraRig
            view={camera}
            on={`${shownPoint.join()}|${shownFrame.join()}|${shownAngles.join()}`}
          />

          <ambientLight intensity={1.1} />
          <directionalLight position={[4, -6, 8]} intensity={1.6} />
          <directionalLight position={[-5, 4, -3]} intensity={0.4} />

          {grid && (
            <gridHelper
              // One square per basis vector, out to the sliders' limit.
              args={[GRID_SIZE, GRID_DIVISIONS, NEUTRAL, NEUTRAL]}
              // three.js lays the grid on xz; robotics wants it on the xy
              // plane of {A}.
              rotation={[Math.PI / 2, 0, 0]}
            />
          )}

          {/* {A}: where m is given, and where {B} is placed. */}
          <group>
            <Triad
              colors={REFERENCE}
              frameName={referenceName}
              axes={axes}
              labels={labels}
            />
            <mesh>
              <sphereGeometry args={[0.09, 20, 20]} />
              <meshStandardMaterial color={NEUTRAL} roughness={0.4} />
            </mesh>
            {labels && (
              <FrameLabel
                frameName={referenceName}
                color={NEUTRAL}
                at={frameLabelAnchor(origin, shownFrame)}
              />
            )}
          </group>

          {/* {B}: turned by ᴬR_B and carried out to ᴬp_B. */}
          <group position={shownFrame} quaternion={quaternion}>
            <Triad
              colors={TARGET}
              frameName={targetName}
              axes={axes}
              labels={labels}
            />
            <mesh>
              <sphereGeometry args={[0.1, 20, 20]} />
              <meshStandardMaterial
                color={INK.betweenOrigins}
                roughness={0.4}
              />
            </mesh>
            {labels && (
              <FrameLabel
                frameName={targetName}
                color={INK.betweenOrigins}
                // Inside {B}'s own group, so the anchor has to be expressed
                // there: the outward direction, carried back through the pose.
                at={unmapPoint(
                  referenceToTarget,
                  frameLabelAnchor(shownFrame, origin),
                )}
              />
            )}
          </group>

          {view === "3d" && shownFrame[2] !== 0 && (
            <HeightGuide to={shownFrame} color={INK.betweenOrigins} />
          )}

          {/* The three vectors of the equation, drawn where they live: ᴬp_m
              from {A}, ᴮp_A from {B} back to {A}, and their sum ᴮp_m from
              {B} to the point. The triangle closes on the stage exactly as
              the formula closes on the panel. */}
          {isDrawable(origin, shownPoint) && (
            <>
              <MappingArrow
                from={origin}
                to={shownPoint}
                color={INK.fromReference}
              />
              {labels && (
                <VectorLabel
                  from={origin}
                  to={shownPoint}
                  letter="p"
                  frame={referenceName}
                  of={pointLabel}
                  color={INK.fromReference}
                  at={0.45}
                  lift={labelLift}
                />
              )}
            </>
          )}

          {isDrawable(shownFrame, origin) && (
            <>
              <MappingArrow
                from={shownFrame}
                to={origin}
                color={INK.betweenOrigins}
              />
              {labels && (
                <VectorLabel
                  from={shownFrame}
                  to={origin}
                  letter="p"
                  frame={targetName}
                  of={referenceName}
                  color={INK.betweenOrigins}
                  at={0.45}
                  lift={labelLift}
                />
              )}
            </>
          )}

          {isDrawable(shownFrame, shownPoint) && (
            <>
              <MappingArrow
                from={shownFrame}
                to={shownPoint}
                color={INK.toTarget}
              />
              {labels && (
                <VectorLabel
                  from={shownFrame}
                  to={shownPoint}
                  letter="p"
                  frame={targetName}
                  of={pointLabel}
                  color={INK.toTarget}
                  at={0.5}
                  lift={labelLift}
                />
              )}
            </>
          )}

          <MarkedPoint
            position={shownPoint}
            label={pointLabel}
            labels={labels}
            up={camera.up}
          />

          <OrbitControls
            // Fresh instance per view: the orbit axis is fixed at
            // construction, and a stale one carries the previous view's
            // rotation into this one.
            key={view}
            makeDefault
            enablePan={false}
            target={camera.target}
            // The plane does not orbit: seen from an angle it is no longer a
            // plane, and the only rotation this scene has belongs to γ.
            enableRotate={view === "3d"}
            minDistance={MIN_DISTANCE}
            maxDistance={MAX_DISTANCE}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        <p className="pointer-events-none absolute bottom-1 left-0 w-full text-center text-xs text-muted-foreground">
          {interactionHint(view)}
        </p>
      </div>

      {/*
        The givens above the equation above the sliders: the student reads
        down from what is instantiated, through the arithmetic, to the
        controls that changed it.
      */}
      <div className="flex flex-col items-center gap-2 border-t border-border bg-muted/30 px-3 py-2">
        <GivensRow
          point={shownPoint}
          rotationRows={rotationRows}
          translation={pose.position}
          axes={axes}
          view={view}
          decimals={decimals}
          referenceName={referenceName}
          targetName={targetName}
          pointLabel={pointLabel}
        />

        <EquationRow
          point={shownPoint}
          rotationRows={rotationRows}
          translation={pose.position}
          rotated={rotated}
          mapped={mapped}
          axes={axes}
          view={view}
          decimals={decimals}
          referenceName={referenceName}
          targetName={targetName}
          pointLabel={pointLabel}
        />

        <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-3 pt-1">
          <SliderGroup
            title={
              <>
                ponto {pointLabel} (
                <Quantity letter="p" from={referenceName} of={pointLabel} />)
              </>
            }
          >
            {axes.map((axis, i) => (
              <Slider
                key={axis}
                label={
                  <>
                    {pointLabel}
                    <sub className="text-[0.85em]">{axis}</sub>
                  </>
                }
                hint={`Coordenada ${axis} do ponto ${pointLabel} em {${referenceName}}`}
                value={pointCoords[i]}
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={positionStep}
                color={INK.fromReference}
                readout={vectorEntries(pointCoords, "3d", decimals)[i]}
                onChange={(value) => setPointCoord(i, value)}
              />
            ))}
          </SliderGroup>

          <SliderGroup
            title={
              <>
                {`posição de {${targetName}} `}(
                <Quantity letter="p" from={referenceName} of={targetName} />)
              </>
            }
          >
            {axes.map((axis, i) => (
              <Slider
                key={axis}
                label={
                  <>
                    p<sub className="text-[0.85em]">{axis}</sub>
                  </>
                }
                hint={`Componente ${axis} da posição de {${targetName}} em {${referenceName}}`}
                value={frameCoords[i]}
                min={SLIDER_MIN}
                max={SLIDER_MAX}
                step={positionStep}
                color={INK.betweenOrigins}
                readout={vectorEntries(frameCoords, "3d", decimals)[i]}
                onChange={(value) => setFrameCoord(i, value)}
              />
            ))}
          </SliderGroup>

          <SliderGroup title={`orientação de {${targetName}}`}>
            {angleAxes(view).map((axis) => {
              const i = axis === "x" ? 0 : axis === "y" ? 1 : 2;
              return (
                <Slider
                  key={axis}
                  label={
                    <>
                      {ANGLE_SYMBOLS[axis]}
                      <span className="ml-0.5 text-[0.85em] font-bold not-italic">
                        {axis}
                        {"̂"}
                      </span>
                    </>
                  }
                  hint={`Ângulo ${ANGLE_SYMBOLS[axis]} de {${targetName}} em torno do eixo ${axis} de {${referenceName}}, em graus`}
                  value={deg[i]}
                  min={ANGLE_MIN}
                  max={ANGLE_MAX}
                  step={step}
                  color={TARGET[axis]}
                  readout={`${deg[i]}°`}
                  onChange={(value) => setAngle(i, value)}
                />
              );
            })}
            <button
              type="button"
              onClick={reset}
              disabled={atInitialPose}
              aria-label="Voltar m e {B} à situação inicial do bloco"
              title="Voltar m e {B} à situação inicial do bloco"
              className={[
                "mt-0.5 rounded-md border border-border px-2 py-0.5 text-xs font-medium transition-colors",
                atInitialPose
                  ? "cursor-default text-muted-foreground/50"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              redefinir
            </button>
          </SliderGroup>
        </div>
      </div>
    </div>
  );
}
