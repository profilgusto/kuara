"use client";
/**
 * Widget `homogeneous-transform` — the pose of a frame, and the 4×4 that holds it.
 *
 * Written for the "Transformação homogênea" section, which introduces ᴵT_R as
 * the composition of two things the student already has: the rotation matrix
 * ᴵR_R and the position vector ᴵp_R, concatenated into one square matrix. The
 * figure exists to make that assembly literal — six sliders, three that turn
 * {R} and three that move it, and a panel where each group of numbers lights
 * up only when its own sliders are touched.
 *
 * The colour scheme carries the argument: the 3×3 block is tinted per column,
 * exactly as in the `rotation-matrix` widget, because those columns are still
 * {R}'s basis vectors; the last column takes the colour of the translation
 * arrow drawn between the two origins; the bottom row is greyed, because it
 * measures nothing at all.
 *
 * Conventions follow the rest of the family — z up, x/y/z as red/green/blue,
 * DOM labels rather than drei's `<Text>` (troika would fetch its font from
 * fonts.gstatic.com, which Kuara's CSP blocks) — and every number the scene
 * depends on comes from `./transform`.
 */
import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import type { Vec3 } from "../../props";
import {
  ANGLE_AXES,
  ANGLE_MAX,
  ANGLE_MIN,
  ANGLE_SYMBOLS,
  AXIS_LENGTH,
  CAMERA,
  GRID_DIVISIONS,
  GRID_SIZE,
  MAX_DISTANCE,
  MIN_DISTANCE,
  POSITION_MAX,
  POSITION_MIN,
  arrowQuaternion,
  axisLabelAnchor,
  blockOf,
  factorOrder,
  formatCoord,
  interactionHint,
  shownFactors,
  isDrawableTranslation,
  translationLabelAnchor,
  type AxisKey,
  type IntrinsicStep,
  type Quaternion,
  type RotationMode,
} from "./transform";
import { useTransformSession } from "./session";

export interface HomogeneousTransformProps {
  angles: Vec3 | null;
  position: Vec3 | null;
  mode: string;
  step: number;
  positionStep: number;
  decimals: number;
  inertialName: string;
  rotatedName: string;
  labels: boolean;
  grid: boolean;
}

/** Proportions of the unit basis arrows. The two frames share them. */
const SHAFT_RADIUS = 0.015;
const HEAD_LENGTH = 0.15;
const HEAD_RADIUS = 0.05;

/** The translation arrow is drawn heavier: it is a length, not a direction. */
const VECTOR_SHAFT_RADIUS = 0.022;
const VECTOR_HEAD_LENGTH = 0.18;
const VECTOR_HEAD_RADIUS = 0.07;

/**
 * Two palettes of the same three hues: {R} in full strength because it is what
 * the student is driving, {I} muted because it is the backdrop ᴵT_R is written
 * against. Same hue per axis in both, so a reader can still pair x with x
 * across the frames.
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

/**
 * The translation gets a hue no axis uses. ᴵp_R is not one of the frame's
 * directions — it is where the frame *is* — so it must not be mistaken for a
 * fourth basis vector.
 */
const TRANSLATION = "#d9a13b";

// A single mid-tone for grid, origins and the structural bottom row: legible
// on both the light and the dark surface without threading next-themes through
// the WebGL scene.
const NEUTRAL = "#8a9a94";

/**
 * Euler rotations that aim a +Y-oriented cylinder/cone down each axis.
 * three.js builds both primitives along +Y, so x needs -90° about z and z
 * needs +90° about x; y is already in place. Both triads are drawn in their
 * own canonical pose — {R}'s group carries the transform, not its arrows.
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
      position={axisLabelAnchor(axis, muted ? 0.26 : 0.18)}
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
 * A frame's origin, named. Two of them here, unlike the rotation widget: the
 * gap between o_I and o_R is precisely what the last column of ᴵT_R measures,
 * so both ends of it have to be labelled for the number to mean anything.
 */
function OriginLabel({
  frameName,
  color,
}: {
  frameName: string;
  color: string;
}) {
  return (
    <Html
      position={[0, 0, 0]}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="block whitespace-nowrap text-base font-bold not-italic"
        style={{ color, transform: "translate(-1em, 0.9em)" }}
      >
        o<sub className="text-[0.62em] font-semibold">{frameName}</sub>
      </span>
    </Html>
  );
}

/**
 * The orientations {R} has already been through this session, drawn faint at
 * wherever it stands now.
 *
 * They mark turns, not places: the translation is an absolute slider that the
 * student can move afterwards, so pinning a ghost to the position it was
 * committed at would claim the sequence had recorded something it did not.
 * Thin, unlabelled and headless — a trail behind the frame, never a third
 * thing competing with it.
 */
function GhostTrail({ orientations }: { orientations: Quaternion[] }) {
  return (
    <>
      {orientations.map((quaternion, i) => (
        <group key={i} quaternion={quaternion}>
          {ANGLE_AXES.map((axis) => (
            <Arrow
              key={axis}
              axis={axis}
              color={ROTATED[axis]}
              // The oldest steps fade the furthest, so a long session reads as
              // a trail with a direction rather than a thicket — but never to
              // nothing, which would hide a step the student took.
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

/** One triad: three arrows and, optionally, their labels. */
function Triad({
  colors,
  frameName,
  labels,
  muted = false,
}: {
  colors: Record<AxisKey, string>;
  frameName: string;
  labels: boolean;
  muted?: boolean;
}) {
  return (
    <group>
      {ANGLE_AXES.map((axis) => (
        <Arrow
          key={axis}
          axis={axis}
          color={colors[axis]}
          // The fixed frame is drawn thinner and slightly translucent so the
          // two triads stay tellable apart even when {R} sits over {I}.
          opacity={muted ? 0.75 : 1}
          radiusScale={muted ? 0.8 : 1}
        />
      ))}
      {labels &&
        ANGLE_AXES.map((axis) => (
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
 * ᴵp_R itself, from o_I to o_R.
 *
 * Aimed with the shortest-arc quaternion rather than fixed Euler angles,
 * because unlike a basis arrow this one points wherever the three position
 * sliders put it.
 */
function TranslationArrow({ to }: { to: Vec3 }) {
  const length = Math.hypot(to[0], to[1], to[2]);
  // A translation short enough that the head alone would overrun it is drawn
  // as head only, scaled down, rather than as a cone poking out the far side.
  const headLength = Math.min(VECTOR_HEAD_LENGTH, length * 0.8);
  const shaftLength = length - headLength;

  return (
    <group quaternion={arrowQuaternion(to)}>
      {shaftLength > 0 && (
        <mesh position={[0, shaftLength / 2, 0]}>
          <cylinderGeometry
            args={[VECTOR_SHAFT_RADIUS, VECTOR_SHAFT_RADIUS, shaftLength, 20]}
          />
          <meshStandardMaterial color={TRANSLATION} roughness={0.35} />
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
        <meshStandardMaterial color={TRANSLATION} roughness={0.35} />
      </mesh>
    </group>
  );
}

/** The translation's name, floating at the middle of its shaft. */
function TranslationLabel({
  position,
  inertialName,
  rotatedName,
}: {
  position: Vec3;
  inertialName: string;
  rotatedName: string;
}) {
  return (
    <Html
      position={translationLabelAnchor(position)}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <span
        className="whitespace-nowrap text-sm font-bold not-italic"
        style={{ color: TRANSLATION }}
      >
        <sup className="text-[0.7em]">{inertialName}</sup>p
        <sub className="text-[0.7em]">{rotatedName}</sub>
      </span>
    </Html>
  );
}

/**
 * The dashed path o_I → (pₓ, p_y, 0) → o_R.
 *
 * Without it, a frame lifted off the plane is impossible to place by eye: the
 * arrow alone is ambiguous under perspective. With it, the student reads the
 * two horizontal components off the grid and the third off the vertical leg —
 * which is the last column of the matrix, drawn.
 */
function TranslationGuides({ to }: { to: Vec3 }) {
  const foot: Vec3 = [to[0], to[1], 0];
  return (
    <group>
      <Line
        points={[[0, 0, 0], foot]}
        color={TRANSLATION}
        lineWidth={1}
        dashed
        dashSize={0.16}
        gapSize={0.12}
        transparent
        opacity={0.75}
      />
      <Line
        points={[foot, to]}
        color={TRANSLATION}
        lineWidth={1}
        dashed
        dashSize={0.16}
        gapSize={0.12}
        transparent
        opacity={0.75}
      />
    </group>
  );
}

/**
 * Forces the redraw that `frameloop="demand"` would otherwise never issue when
 * a slider changes the pose, or when the stage is resized — it is a flex
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
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const applied = useRef(false);

  if (!applied.current) {
    applied.current = true;
    camera.up.set(CAMERA.up[0], CAMERA.up[1], CAMERA.up[2]);
    camera.position.set(
      CAMERA.position[0],
      CAMERA.position[1],
      CAMERA.position[2],
    );
    camera.lookAt(CAMERA.target[0], CAMERA.target[1], CAMERA.target[2]);
    camera.updateProjectionMatrix();
  }

  return null;
}

/**
 * A quantity set the way the section writes it: frame above, frame below —
 * ᴵT_R, ᴵR_R, ᴵp_R all come out of here.
 */
function PoseSymbol({
  letter,
  inertialName,
  rotatedName,
  color,
}: {
  letter: string;
  inertialName: string;
  rotatedName: string;
  color?: string;
}) {
  return (
    <span className="whitespace-nowrap" style={color ? { color } : undefined}>
      <sup className="text-[0.7em]">{inertialName}</sup>
      <strong className="font-bold not-italic">{letter}</strong>
      <sub className="text-[0.7em]">{rotatedName}</sub>
    </span>
  );
}

/**
 * The 4×4, bracketed as the section sets it, and partitioned as the section
 * describes it: a rule down the left of the last column and along the top of
 * the last row, so the three blocks are visibly three.
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
      <span className="px-1.5 py-0.5">
        {rows.map((row, r) => (
          <span
            key={r}
            className={[
              "flex leading-tight",
              // The partition, drawn once: above the structural row.
              blockOf(r, 0) === "bottom"
                ? "mt-0.5 border-t border-dashed border-muted-foreground/40 pt-0.5"
                : "",
            ].join(" ")}
          >
            {row.map((entry, c) => {
              const block = blockOf(r, c);
              return (
                <span
                  key={c}
                  className={[
                    "w-11 px-1 text-right tabular-nums",
                    // …and left of the translation column.
                    c === 3
                      ? "ml-1 border-l border-dashed border-muted-foreground/40 pl-2"
                      : "",
                    block === "bottom" ? "text-muted-foreground/70" : "",
                  ].join(" ")}
                  style={
                    block === "bottom" ? undefined : { color: columnColors[c] }
                  }
                >
                  {entry}
                </span>
              );
            })}
          </span>
        ))}
      </span>
      <span className="w-2 rounded-r-sm border-y border-r border-muted-foreground/70" />
    </span>
  );
}

/**
 * The blocks named above the matrix: which product built the rotation, and
 * that the last column is just the position vector. Watching the factors swap
 * ends when the mode switch is flipped is the point of showing them at all.
 */
function BlockLegend({
  mode,
  steps,
  live,
  intrinsic,
  inertialName,
  rotatedName,
}: {
  mode: RotationMode;
  steps: IntrinsicStep[];
  live: IntrinsicStep | null;
  intrinsic: boolean;
  inertialName: string;
  rotatedName: string;
}) {
  return (
    <span className="whitespace-nowrap text-xs text-muted-foreground">
      <PoseSymbol
        letter="R"
        inertialName={inertialName}
        rotatedName={rotatedName}
      />
      {" = "}
      {intrinsic ? (
        <SessionFactors steps={steps} live={live} />
      ) : (
        factorOrder(mode).map((axis) => (
          <span key={axis} style={{ color: ROTATED[axis] }}>
            <strong className="font-bold not-italic">R</strong>
            <sub className="text-[0.7em]">{axis}</sub>({ANGLE_SYMBOLS[axis]}
            ){" "}
          </span>
        ))
      )}
      <span className="mx-1 opacity-50">·</span>
      <PoseSymbol
        letter="p"
        inertialName={inertialName}
        rotatedName={rotatedName}
        color={TRANSLATION}
      />
      <span style={{ color: TRANSLATION }}> = última coluna</span>
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

/** One angle's slider, labelled with its Greek letter and its axis. */
/**
 * The two ways back, and they are not the same question.
 *
 * "Alinhar eixos" answers *which way is {R} facing* — it zeroes the three
 * angles and leaves the translation exactly where the student put it, so the
 * left block of ᴵT_R goes to the identity while the last column sits still.
 * That contrast is the figure's whole argument, and it is worth a button.
 *
 * "Redefinir" answers *let me start over*: the authored pose, both halves of
 * it. A student who has driven the frame somewhere unreadable needs one
 * button, not six sliders dragged back by eye.
 *
 * Each is disabled once it has nothing to do, so the pair also reports where
 * the pose stands rather than only changing it.
 */
function PoseButton({
  children,
  disabled,
  hint,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      {children}
    </button>
  );
}

/**
 * The same equation for an own-axis session: not three fixed slots, but the
 * product as it was actually built, one factor per released step and the drag
 * in flight on the right — which is what post-multiplication looks like.
 */
function SessionFactors({
  steps,
  live,
}: {
  steps: IntrinsicStep[];
  live: IntrinsicStep | null;
}) {
  const all = live && live.deg !== 0 ? [...steps, live] : steps;
  const { shown, elided } = shownFactors(all);
  return (
    <>
      {shown.length === 0 && <span className="italic">I</span>}
      {elided && <span aria-hidden>⋯ </span>}
      {shown.map((step, i) => (
        <span
          // Position in the product, not the axis: the same axis can appear in
          // it more than once, which is the whole reason this mode exists.
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
    </>
  );
}

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
        // takes only the turns that fall inside one — see
        // `components/interactive/orientation-session.ts` for why guessing
        // from the release alone is not enough.
        onPointerDown={incremental ? onPress : undefined}
        onKeyDown={incremental ? onPress : undefined}
        onPointerUp={incremental ? onRelease : undefined}
        onLostPointerCapture={incremental ? onRelease : undefined}
        onKeyUp={incremental ? onRelease : undefined}
        onBlur={incremental ? onRelease : undefined}
        className="h-1 w-24 cursor-pointer sm:w-28"
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

/** One component of ᴵp_R, in the colour of the column it feeds. */
function PositionSlider({
  axis,
  value,
  step,
  decimals,
  onChange,
}: {
  axis: AxisKey;
  value: number;
  step: number;
  decimals: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span
        className="w-8 text-right font-medium"
        style={{ color: TRANSLATION }}
        aria-hidden
      >
        p<sub className="text-[0.85em]">{axis}</sub>
      </span>
      <input
        type="range"
        min={POSITION_MIN}
        max={POSITION_MAX}
        step={step}
        value={value}
        aria-label={`Componente ${axis} da translação, em vetores de base`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer sm:w-28"
        style={{ accentColor: TRANSLATION }}
      />
      <span className="w-11 text-right tabular-nums text-muted-foreground">
        {formatCoord(value, decimals)}
      </span>
    </label>
  );
}

export default function HomogeneousTransform({
  angles,
  position,
  mode,
  step,
  positionStep,
  decimals,
  inertialName,
  rotatedName,
  labels,
  grid,
}: HomogeneousTransformProps) {
  const {
    mode: rotation,
    intrinsic,
    deg,
    pos,
    quaternion,
    ghostQuaternions,
    steps,
    live,
    aligned,
    rows,
    atInitialPose,
    setAngle,
    setCoord,
    beginGesture,
    commitLive,
    selectMode,
    align,
    resetPose,
  } = useTransformSession({ angles, position, mode, decimals });

  const columnColors = [
    ROTATED.x,
    ROTATED.y,
    ROTATED.z,
    // The fourth column is the translation, and takes the arrow's colour.
    TRANSLATION,
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="relative min-h-0 flex-1">
        <Canvas
          frameloop="demand"
          // Initial framing only; `CameraRig` owns the aim after mount.
          camera={{ position: CAMERA.position, fov: CAMERA.fov, up: CAMERA.up }}
          gl={{ antialias: true }}
          style={{ touchAction: "none" }}
        >
          <CameraRig />
          {/* A commit lands on the orientation the drag already reached, so
              the transform alone would not tell the renderer a ghost had
              appeared. A string, not an array: a fresh array every render
              would invalidate on every render. */}
          <Redraw
            on={`${quaternion.join()}|${pos.join()}|${ghostQuaternions.length}`}
          />

          <ambientLight intensity={1.1} />
          <directionalLight position={[4, -6, 8]} intensity={1.6} />
          <directionalLight position={[-5, 4, -3]} intensity={0.4} />

          {grid && (
            <gridHelper
              // One square per basis vector, two squares out from the origin
              // in each direction — the unit the position sliders are in.
              args={[GRID_SIZE, GRID_DIVISIONS, NEUTRAL, NEUTRAL]}
              // three.js lays the grid on xz; robotics wants it on the xy
              // plane of {I}.
              rotation={[Math.PI / 2, 0, 0]}
            />
          )}

          <group>
            <Triad
              colors={INERTIAL}
              frameName={inertialName}
              labels={labels}
              muted
            />
            <mesh>
              <sphereGeometry args={[0.045, 20, 20]} />
              <meshStandardMaterial color={NEUTRAL} roughness={0.4} />
            </mesh>
            {labels && <OriginLabel frameName={inertialName} color={NEUTRAL} />}
          </group>

          {isDrawableTranslation(pos) && (
            <>
              <TranslationArrow to={pos} />
              <TranslationGuides to={pos} />
              {labels && (
                <TranslationLabel
                  position={pos}
                  inertialName={inertialName}
                  rotatedName={rotatedName}
                />
              )}
            </>
          )}

          {/* Where {R} has been this session, faintest first, at the origin
              it stands on now. */}
          <group position={pos}>
            <GhostTrail orientations={ghostQuaternions} />
          </group>

          {/* The matrix, applied: {R} is {I} turned by the rotation block and
              carried out to the translation one — which is all ᴵT_R says. */}
          <group position={pos} quaternion={quaternion}>
            <Triad colors={ROTATED} frameName={rotatedName} labels={labels} />
            <mesh>
              <sphereGeometry args={[0.05, 20, 20]} />
              <meshStandardMaterial color={TRANSLATION} roughness={0.4} />
            </mesh>
            {labels && (
              <OriginLabel frameName={rotatedName} color={TRANSLATION} />
            )}
          </group>

          <OrbitControls
            makeDefault
            enablePan={false}
            target={CAMERA.target}
            minDistance={MIN_DISTANCE}
            maxDistance={MAX_DISTANCE}
            enableDamping
            dampingFactor={0.08}
          />
        </Canvas>

        <p className="pointer-events-none absolute bottom-1 left-0 w-full text-center text-xs text-muted-foreground">
          {interactionHint(rotation)}
        </p>
      </div>

      {/*
        Matrix on the left, controls on the right, and they stack on a phone:
        the matrix is the subject of the figure, so it keeps the reading
        position, while the two slider groups stay together under the switch
        that decides what the angles mean.
      */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-border bg-muted/30 px-3 py-2">
        <div className="flex flex-col items-center gap-1">
          <BlockLegend
            mode={rotation}
            steps={steps}
            live={live}
            intrinsic={intrinsic}
            inertialName={inertialName}
            rotatedName={rotatedName}
          />
          <div className="flex items-center gap-1.5">
            <PoseSymbol
              letter="T"
              inertialName={inertialName}
              rotatedName={rotatedName}
            />
            <span aria-hidden>=</span>
            <MatrixPanel rows={rows} columnColors={columnColors} />
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <ModeSwitch
              mode={rotation}
              inertialName={inertialName}
              rotatedName={rotatedName}
              onSelect={selectMode}
            />
            <PoseButton
              disabled={aligned}
              hint={`Zerar os três ângulos, alinhando os eixos de {${rotatedName}} com os de {${inertialName}}. A posição não muda.`}
              onClick={align}
            >
              alinhar eixos
            </PoseButton>
            <PoseButton
              disabled={atInitialPose}
              hint={`Voltar {${rotatedName}} à pose inicial do bloco: orientação e posição`}
              onClick={resetPose}
            >
              redefinir
            </PoseButton>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <div className="flex flex-col gap-1.5">
              {ANGLE_AXES.map((axis, i) => (
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
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              {ANGLE_AXES.map((axis, i) => (
                <PositionSlider
                  key={axis}
                  axis={axis}
                  value={pos[i]}
                  step={positionStep}
                  decimals={decimals}
                  onChange={(value) => setCoord(i, value)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
