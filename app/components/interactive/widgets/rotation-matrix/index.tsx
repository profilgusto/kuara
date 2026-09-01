"use client";
/**
 * Widget `rotation-matrix` — two frames sharing an origin, and the matrix
 * between them.
 *
 * Written for the "Matriz de rotação" section of Representação Espacial, which
 * defines ᴵR_R as the matrix whose columns are {R}'s basis vectors projected
 * onto {I}'s. Here the student turns {R} with three sliders and watches those
 * nine numbers move: each column of the panel *is* the arrow of the same
 * colour in the scene, which is why the columns are tinted rather than the
 * rows.
 *
 * The selector switches which axes the angles are taken about — {R}'s own
 * (intrinsic) or {I}'s fixed ones (extrinsic). Nothing about the sliders
 * changes; only the order the three factors multiply in, which is the whole
 * lesson: the same α, β, γ land the frame somewhere else.
 *
 * Conventions follow the other widgets in the family — z up, x/y/z as
 * red/green/blue, DOM labels rather than drei's `<Text>` (troika would fetch
 * its font from fonts.gstatic.com, which Kuara's CSP blocks) — and every
 * number the scene depends on comes from `./rotation`.
 */
import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Vec3 } from "../../props";
import { useRotationSession } from "./session";
import {
  ANGLE_AXES,
  ANGLE_MAX,
  ANGLE_MIN,
  ANGLE_SYMBOLS,
  AXIS_LENGTH,
  GRID_DIVISIONS,
  GRID_HALF,
  GRID_SIZE,
  VIEW_CAMERA,
  MAX_DISTANCE,
  MIN_DISTANCE,
  axisLabelAnchor,
  dimensionNote,
  dragMode,
  factorOrder,
  interactionHint,
  referenceKind,
  rollUp,
  rulerTicks,
  shortestAngleDelta,
  showsModeSwitch,
  shownFactors,
  turnAxes,
  visibleAxes,
  type AxisKey,
  type Camera,
  type IntrinsicStep,
  type Quaternion,
  type RotationMode,
} from "./rotation";

export interface RotationMatrixProps {
  angles: Vec3 | null;
  mode: string;
  step: number;
  decimals: number;
  inertialName: string;
  rotatedName: string;
  labels: boolean;
  grid: boolean;
  /** Which of the header's 1D/2D/3D buttons is active. */
  variant?: string;
}

/** Proportions of the unit basis arrows. The two frames share them. */
const SHAFT_RADIUS = 0.016;
const HEAD_LENGTH = 0.17;
const HEAD_RADIUS = 0.055;

/**
 * Two palettes of the same three hues: {R} in full strength because it is what
 * the student is driving, {I} muted because it is the backdrop the matrix is
 * written against. Same hue per axis in both, so a reader can still pair x
 * with x across the frames.
 */
const ROTATED = {
  x: "#e05252",
  y: "#3faf5c",
  z: "#2fa8b8",
} as const;

const INERTIAL = {
  x: "#9d6a6a",
  y: "#5f8a6e",
  z: "#5c8791",
} as const;

// A single mid-tone for grid and origin: legible on both the light and the
// dark surface without threading next-themes through the WebGL scene.
const NEUTRAL = "#8a9a94";

/**
 * Euler rotations that aim a +Y-oriented cylinder/cone down each axis.
 * three.js builds both primitives along +Y, so x needs -90° about z and z
 * needs +90° about x; y is already in place. Both triads are drawn in their
 * own canonical pose — {R}'s group carries the rotation, not its arrows.
 */
const AXIS_ROTATION: Record<AxisKey, [number, number, number]> = {
  x: [0, 0, -Math.PI / 2],
  y: [0, 0, 0],
  z: [Math.PI / 2, 0, 0],
};

function Arrow({
  axis,
  color,
  opacity = 1,
  radiusScale = 1,
  headless = false,
}: {
  axis: AxisKey;
  color: string;
  opacity?: number;
  radiusScale?: number;
  /** A shaft with no head: for the ghosts, which mark a pose, not a vector. */
  headless?: boolean;
}) {
  const shaftLength = AXIS_LENGTH - (headless ? 0 : HEAD_LENGTH);
  return (
    <group rotation={AXIS_ROTATION[axis]}>
      <mesh position={[0, shaftLength / 2, 0]}>
        <cylinderGeometry
          args={[
            SHAFT_RADIUS * radiusScale,
            SHAFT_RADIUS * radiusScale,
            shaftLength,
            16,
          ]}
        />
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      {!headless && (
        <mesh position={[0, shaftLength + HEAD_LENGTH / 2, 0]}>
          <coneGeometry args={[HEAD_RADIUS * radiusScale, HEAD_LENGTH, 20]} />
          <meshStandardMaterial
            color={color}
            roughness={0.45}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
      )}
    </group>
  );
}

function AxisLabel({
  axis,
  color,
  frameName,
  muted,
}: {
  axis: AxisKey;
  color: string;
  frameName: string;
  muted: boolean;
}) {
  return (
    <Html
      position={axisLabelAnchor(axis, muted ? 0.28 : 0.2)}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        // Bold upright with a combining circumflex and the frame in the
        // subscript: the DOM rendering of \hat{\mathbf{x}}_\mathrm{R}, which
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
 * The shared origin, labelled **o** — one point, not two: the frames differ in
 * orientation only, which is precisely what makes a 3×3 matrix enough to
 * relate them.
 */
function OriginLabel() {
  return (
    <Html
      position={[0, 0, 0]}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="block whitespace-nowrap text-lg font-bold not-italic"
        style={{ color: NEUTRAL, transform: "translate(-1em, 0.9em)" }}
      >
        o
      </span>
    </Html>
  );
}

/** One triad: three arrows and, optionally, their labels. */
function Triad({
  colors,
  frameName,
  labels,
  axes,
  muted = false,
}: {
  colors: Record<AxisKey, string>;
  frameName: string;
  labels: boolean;
  /** The axes this view has: x̂ on a line, x̂ ŷ on a plane, all three in space. */
  axes: AxisKey[];
  muted?: boolean;
}) {
  return (
    <group>
      {axes.map((axis) => (
        <Arrow
          key={axis}
          axis={axis}
          color={colors[axis]}
          // The fixed frame is drawn thinner and slightly translucent so the
          // two triads stay tellable apart even when {R} lies over {I}.
          opacity={muted ? 0.75 : 1}
          radiusScale={muted ? 0.8 : 1}
        />
      ))}
      {labels &&
        axes.map((axis) => (
          <AxisLabel
            key={axis}
            axis={axis}
            color={colors[axis]}
            frameName={frameName}
            muted={muted}
          />
        ))}
    </group>
  );
}

/**
 * The frames the student has already left: one faint triad per released step.
 *
 * They are what makes an own-axis session readable. Without them the arrows
 * simply arrive somewhere and the sequence that got them there is gone, which
 * is the same thing as not being able to see that the third turn happened
 * about an axis the second turn had moved. Drawn thin, unlabelled and without
 * heads: a trail behind the frame, never a fourth thing competing with it.
 */
function GhostTrail({
  orientations,
  axes,
}: {
  orientations: Quaternion[];
  axes: AxisKey[];
}) {
  return (
    <>
      {orientations.map((quaternion, i) => (
        <group key={i} quaternion={quaternion}>
          {axes.map((axis) => (
            <Arrow
              key={axis}
              axis={axis}
              color={ROTATED[axis]}
              // The oldest steps fade the furthest, so a long session reads as
              // a trail with a direction rather than a thicket. Never to
              // nothing, though: an invisible ghost is a step the student took
              // and can no longer find.
              opacity={0.18 + (0.22 * (i + 1)) / orientations.length}
              radiusScale={0.5}
              headless
            />
          ))}
        </group>
      ))}
    </>
  );
}

/**
 * The 1D reference: a graduated line where the other views lay a grid.
 *
 * A line has no plane to sit on, but it still deserves something to be read
 * off — and its graduation is the same unit as every grid square elsewhere.
 */
function Ruler() {
  const tickHalf = 0.05;
  return (
    <group>
      <Line
        points={[
          [-GRID_HALF, 0, 0],
          [GRID_HALF, 0, 0],
        ]}
        color={NEUTRAL}
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
          color={NEUTRAL}
          lineWidth={1}
        />
      ))}
    </group>
  );
}

/**
 * The drag a plane answers with: a roll of the camera about the view axis.
 *
 * Orbiting a 2D view would tip the page and show the student a rotation the
 * plane cannot have. Rolling the *camera* rather than turning the scene keeps
 * every object at the world coordinates the print fallback projects from, and
 * keeps the label DOM upright and readable however far the view has spun.
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

/**
 * Forces the redraw that `frameloop="demand"` would otherwise never issue when
 * a slider changes the matrix, or when the stage is resized — it is a flex
 * child, so its height is only known once the panel below it has been
 * measured.
 */
function Redraw({ on }: { on: unknown }) {
  const invalidate = useThree((s) => s.invalidate);
  const size = useThree((s) => s.size);
  useEffect(() => invalidate(), [on, size, invalidate]);
  return null;
}

/**
 * Aims the camera once, at mount.
 *
 * Done during render rather than in an effect because `OrbitControls` reads
 * `camera.up` in its constructor to fix its orbit axis and never looks again.
 * Applied only once, so a re-render from a slider does not throw away the
 * angle the student has orbited to.
 */
function CameraRig({ view }: { view: Camera }) {
  const camera = useThree((s) => s.camera);
  const applied = useRef<Camera | null>(null);

  // Only on an actual change of view. Re-aiming on every render would snap the
  // camera back to its default framing the next time anything above this
  // widget re-rendered, throwing away an orbit the student had just dragged.
  // The entries of `VIEW_CAMERA` are module constants, so identity is the
  // right comparison.
  if (applied.current !== view) {
    applied.current = view;
    camera.up.set(view.up[0], view.up[1], view.up[2]);
    camera.position.set(view.position[0], view.position[1], view.position[2]);
    camera.lookAt(view.target[0], view.target[1], view.target[2]);
    camera.updateProjectionMatrix();
  }

  return null;
}

/** `ᴵR_R`, set the way the section writes it: frame above, frame below. */
function MatrixName({
  inertialName,
  rotatedName,
}: {
  inertialName: string;
  rotatedName: string;
}) {
  return (
    <span className="whitespace-nowrap">
      <sup className="text-[0.7em]">{inertialName}</sup>
      <strong className="font-bold not-italic">R</strong>
      <sub className="text-[0.7em]">{rotatedName}</sub>
    </span>
  );
}

/**
 * The matrix itself, bracketed as equation (5) sets it.
 *
 * Each column is tinted with the axis it belongs to, because a column of ᴵR_R
 * is the basis vector of {R} of that colour, written in {I} — the same arrow
 * the student is watching turn.
 */
function MatrixPanel({
  rows,
  columnColors,
}: {
  rows: string[][];
  columnColors: string[];
}) {
  return (
    <span className="inline-flex items-stretch text-sm">
      <span className="w-2 rounded-l-sm border-y border-l border-muted-foreground/70" />
      <span className="px-2 py-0.5">
        {rows.map((row, r) => (
          <span key={r} className="flex gap-3 leading-tight">
            {row.map((entry, c) => (
              <span
                key={c}
                className="w-11 text-right tabular-nums"
                style={{ color: columnColors[c] }}
              >
                {entry}
              </span>
            ))}
          </span>
        ))}
      </span>
      <span className="w-2 rounded-r-sm border-y border-r border-muted-foreground/70" />
    </span>
  );
}

/**
 * The product the current mode builds, written out: R_z R_y R_x about the
 * inertial axes, R_x R_y R_z about the frame's own. Watching the factors swap
 * ends when the switch is flipped is the point of showing it at all.
 */
function FactorFormula({
  mode,
  inertialName,
  rotatedName,
}: {
  mode: RotationMode;
  inertialName: string;
  rotatedName: string;
}) {
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      <MatrixName inertialName={inertialName} rotatedName={rotatedName} />
      {" = "}
      {factorOrder(mode).map((axis) => (
        <span key={axis} style={{ color: ROTATED[axis] }}>
          <strong className="font-bold not-italic">R</strong>
          <sub className="text-[0.7em]">{axis}</sub>({ANGLE_SYMBOLS[axis]}){" "}
        </span>
      ))}
    </span>
  );
}

/**
 * The same equation for an own-axis session: not three fixed slots, but the
 * product as it was actually built, one factor per released step and the drag
 * in flight on the right.
 *
 * Writing each step with the angle the student chose, rather than with α, β
 * and γ, is the honest reading — the sequence is the state now, and the new
 * factor joining on the right *is* what post-multiplication looks like.
 */
function SessionFormula({
  steps,
  live,
  inertialName,
  rotatedName,
}: {
  steps: IntrinsicStep[];
  live: IntrinsicStep | null;
  inertialName: string;
  rotatedName: string;
}) {
  const all = live && live.deg !== 0 ? [...steps, live] : steps;
  const { shown, elided } = shownFactors(all);
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      <MatrixName inertialName={inertialName} rotatedName={rotatedName} />
      {" = "}
      {shown.length === 0 && <span className="italic">I</span>}
      {elided && <span aria-hidden>⋯ </span>}
      {shown.map((step, i) => (
        <span
          // Position in the product, not the axis: the same axis can appear
          // in it more than once, which is the whole reason this mode exists.
          key={all.length - shown.length + i}
          style={{ color: ROTATED[step.axis] }}
          className={
            live && live.deg !== 0 && i === shown.length - 1
              ? "underline decoration-dotted underline-offset-2"
              : undefined
          }
        >
          <strong className="font-bold not-italic">R</strong>
          <sub className="text-[0.7em]">{step.axis}</sub>({step.deg}°){" "}
        </span>
      ))}
    </span>
  );
}

/**
 * The selector. `radiogroup` rather than two buttons: the choices are mutually
 * exclusive readings of the same three angles, which is what a screen reader
 * should hear.
 */
function ModeSwitch({
  mode,
  inertialName,
  rotatedName,
  onSelect,
}: {
  mode: RotationMode;
  inertialName: string;
  rotatedName: string;
  onSelect: (mode: RotationMode) => void;
}) {
  const options: { id: RotationMode; label: string; hint: string }[] = [
    {
      id: "inercial",
      label: `eixos de {${inertialName}}`,
      hint: `Girar em torno dos eixos fixos do frame inercial {${inertialName}}`,
    },
    {
      id: "proprio",
      label: `eixos de {${rotatedName}}`,
      hint: `Girar em torno dos eixos do próprio frame {${rotatedName}}`,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Girar em torno dos:</span>
      <div
        role="radiogroup"
        aria-label="Eixos em torno dos quais o frame gira"
        className="flex items-center overflow-hidden rounded-md border border-border"
      >
        {options.map((o) => {
          const selected = o.id === mode;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={o.hint}
              title={o.hint}
              onClick={() => onSelect(o.id)}
              className={[
                "px-2 py-0.5 text-xs font-medium transition-colors",
                // Hairlines between the buttons, not around each one, so the
                // group reads as one control.
                "border-l border-border first:border-l-0",
                selected
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The escape hatch back to the identity.
 *
 * Three sliders stepping in fives, with nothing to catch them at the middle,
 * make zero a position the student can aim at and miss; the interesting
 * question the widget asks — what the same angles do in a different order —
 * is much easier to ask again from a frame that starts aligned. Disabled once
 * there is nothing to undo, so the control also *reports* alignment rather
 * than only causing it.
 */
function AlignButton({
  disabled,
  rotatedName,
  inertialName,
  onAlign,
}: {
  disabled: boolean;
  rotatedName: string;
  inertialName: string;
  onAlign: () => void;
}) {
  const hint = `Zerar os três ângulos, alinhando {${rotatedName}} com {${inertialName}}`;
  return (
    <button
      type="button"
      onClick={onAlign}
      disabled={disabled}
      aria-label={hint}
      title={hint}
      className={[
        "rounded-md border border-border px-2 py-0.5 text-xs font-medium transition-colors",
        disabled
          ? "cursor-default text-muted-foreground/50"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      ].join(" ")}
    >
      alinhar eixos
    </button>
  );
}

/** One angle's slider, labelled with its Greek letter and its axis. */
function AngleSlider({
  axis,
  value,
  step,
  incremental,
  rotatedName,
  onChange,
  onPress,
  onRelease,
}: {
  axis: AxisKey;
  value: number;
  step: number;
  /** Own-axis mode: the slider is a turn from here, not an absolute angle. */
  incremental: boolean;
  rotatedName: string;
  onChange: (value: number) => void;
  onPress: () => void;
  onRelease: () => void;
}) {
  const color = ROTATED[axis];
  const label = incremental
    ? `Girar {${rotatedName}} em torno do próprio eixo ${axis}: solte para fixar o passo`
    : `Ângulo ${ANGLE_SYMBOLS[axis]} em torno do eixo ${axis}, em graus`;
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span
        className="w-8 text-right font-medium"
        style={{ color }}
        aria-hidden
      >
        {ANGLE_SYMBOLS[axis]}
        <span className="ml-0.5 text-[0.85em] font-bold not-italic">
          {axis}
          {"̂"}
        </span>
      </span>
      <input
        type="range"
        min={ANGLE_MIN}
        max={ANGLE_MAX}
        step={step}
        value={value}
        aria-label={label}
        title={incremental ? label : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        // A gesture is bracketed by a press and a release, and the session
        // takes only the turns that fall inside one. The press matters as much
        // as the release: React's `onChange` also fires for the native
        // `change` event, which Firefox emits *after* the drag is over, and
        // that stray value must not be mistaken for a new turn.
        onPointerDown={incremental ? onPress : undefined}
        onKeyDown={incremental ? onPress : undefined}
        // Every way a drag can end. They overlap — a mouse fires both pointer
        // up and lost capture — and the gesture is spent by whichever arrives
        // first. A keyboard user gets one step per key, which is the same
        // gesture, bracketed the same way.
        onPointerUp={incremental ? onRelease : undefined}
        onLostPointerCapture={incremental ? onRelease : undefined}
        onKeyUp={incremental ? onRelease : undefined}
        onBlur={incremental ? onRelease : undefined}
        className="h-1 w-24 cursor-pointer sm:w-32"
        style={{ accentColor: color }}
      />
      <span className="w-11 text-right tabular-nums text-muted-foreground">
        {/* A sign while the turn is still in the student's hand: it is being
            added to what the frame already has, not replacing it. */}
        {incremental && value > 0 ? `+${value}°` : `${value}°`}
      </span>
    </label>
  );
}

export default function RotationMatrix({
  angles,
  mode,
  step,
  decimals,
  inertialName,
  rotatedName,
  labels,
  grid,
  variant,
}: RotationMatrixProps) {
  const {
    dim,
    mode: rotation,
    intrinsic,
    deg,
    quaternion,
    ghostQuaternions,
    steps,
    live,
    aligned,
    rows,
    setAngle,
    beginGesture,
    commitLive,
    selectMode,
    align,
  } = useRotationSession({ angles, mode, variant, decimals });

  const view = VIEW_CAMERA[dim];
  const axes = visibleAxes(dim);
  const drag = dragMode(dim);
  const turning = turnAxes(dim);
  const note = dimensionNote(dim);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Canvas
          frameloop="demand"
          // Initial framing only; `CameraRig` owns the aim after mount.
          camera={{ position: view.position, fov: view.fov, up: view.up }}
          gl={{ antialias: true }}
          style={{ touchAction: "none" }}
        >
          <CameraRig view={view} />
          <PlaneRoll enabled={drag === "roll"} view={view} />
          {/* A commit lands on the orientation the drag already reached, so
              the quaternion alone would not tell the renderer a ghost had
              appeared. A string, not an array: a fresh array every render
              would invalidate on every render. */}
          <Redraw on={`${quaternion.join()}|${ghostQuaternions.length}`} />

          <ambientLight intensity={1.1} />
          <directionalLight position={[4, -6, 8]} intensity={1.6} />
          <directionalLight position={[-5, 4, -3]} intensity={0.4} />

          {grid &&
            (referenceKind(dim) === "ruler" ? (
              <Ruler />
            ) : (
              <gridHelper
                // One square per basis vector, two squares out from the origin
                // in each direction.
                args={[GRID_SIZE, GRID_DIVISIONS, NEUTRAL, NEUTRAL]}
                // three.js lays the grid on xz; robotics wants it on the xy
                // plane of {I}.
                rotation={[Math.PI / 2, 0, 0]}
              />
            ))}

          <Triad
            colors={INERTIAL}
            frameName={inertialName}
            labels={labels}
            axes={axes}
            muted
          />

          {/* Where {R} has been this session, faintest first. */}
          <GhostTrail orientations={ghostQuaternions} axes={axes} />

          {/* The matrix, applied: {R} is {I} turned by ᴵR_R, which is exactly
              what makes the columns of the panel the arrows in the scene. */}
          <group quaternion={quaternion}>
            <Triad
              colors={ROTATED}
              frameName={rotatedName}
              labels={labels}
              axes={axes}
            />
          </group>

          <mesh>
            <sphereGeometry args={[0.05, 20, 20]} />
            <meshStandardMaterial color={NEUTRAL} roughness={0.4} />
          </mesh>

          {labels && <OriginLabel />}

          <OrbitControls
            // Fresh instance per view: the orbit axis is fixed at construction,
            // and a stale one carries the previous view's rotation into this.
            key={dim}
            makeDefault
            enablePan={false}
            // A plane rolls and a line does neither: only space orbits.
            enableRotate={drag === "orbit"}
            target={view.target}
            minDistance={MIN_DISTANCE}
            maxDistance={MAX_DISTANCE}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        <p className="pointer-events-none absolute bottom-1 left-0 w-full text-center text-xs text-muted-foreground">
          {interactionHint(dim, rotation)}
        </p>
      </div>

      {/*
        Matrix on the left, controls on the right, and they swap to stacked on
        a phone: the matrix is the subject of the figure, so it keeps the
        reading position, while each slider stays beside the switch that
        decides what it means.
      */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-border bg-muted/30 px-3 py-2">
        <div className="flex flex-col items-center gap-1">
          {!showsModeSwitch(dim) ? null : intrinsic ? (
            <SessionFormula
              steps={steps}
              live={live}
              inertialName={inertialName}
              rotatedName={rotatedName}
            />
          ) : (
            <FactorFormula
              mode={rotation}
              inertialName={inertialName}
              rotatedName={rotatedName}
            />
          )}
          <div className="flex items-center gap-1.5">
            <MatrixName inertialName={inertialName} rotatedName={rotatedName} />
            <span aria-hidden>=</span>
            <MatrixPanel
              rows={rows}
              // One tint per column of the block this view prints: column c is
              // the basis vector of {R} of that colour, resolved in {I}.
              columnColors={axes.map((axis) => ROTATED[axis])}
            />
          </div>
        </div>

        <div className="flex max-w-xs flex-col items-start gap-1.5">
          {/* A line has nothing to drive, so it gets the reason instead of a
              row of controls that could not do anything. */}
          {note && (
            <p className="max-w-xs text-xs leading-snug text-muted-foreground">
              {note}
            </p>
          )}

          {turning.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              {showsModeSwitch(dim) && (
                <ModeSwitch
                  mode={rotation}
                  inertialName={inertialName}
                  rotatedName={rotatedName}
                  onSelect={selectMode}
                />
              )}
              <AlignButton
                disabled={aligned}
                rotatedName={rotatedName}
                inertialName={inertialName}
                onAlign={align}
              />
            </div>
          )}

          {/* One slider per axis this view can turn about — which in 2D is the
              ẑ it does not draw, and in 1D is none at all. */}
          {ANGLE_AXES.map((axis, i) =>
            turning.includes(axis) ? (
              <AngleSlider
                key={axis}
                axis={axis}
                value={deg[i]}
                step={step}
                incremental={intrinsic}
                rotatedName={rotatedName}
                onChange={(value) => setAngle(i, value)}
                onPress={() => beginGesture(i)}
                onRelease={() => commitLive(i)}
              />
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
