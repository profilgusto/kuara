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
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
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
  INTERACTION_HINT,
  MAX_DISTANCE,
  MIN_DISTANCE,
  axisLabelAnchor,
  clampAngle,
  clampAngles,
  factorOrder,
  formatMatrix,
  matrixToQuaternion,
  rotationMatrix,
  toRotationMode,
  type AxisKey,
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
}: {
  axis: AxisKey;
  color: string;
  opacity?: number;
  radiusScale?: number;
}) {
  const shaftLength = AXIS_LENGTH - HEAD_LENGTH;
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
      <mesh position={[0, shaftLength + HEAD_LENGTH / 2, 0]}>
        <coneGeometry args={[HEAD_RADIUS * radiusScale, HEAD_LENGTH, 20]} />
        <meshStandardMaterial
          color={color}
          roughness={0.45}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
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
          // two triads stay tellable apart even when {R} lies over {I}.
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
function AngleSlider({
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
  const color = ROTATED[axis];
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
        aria-label={`Ângulo ${ANGLE_SYMBOLS[axis]} em torno do eixo ${axis}, em graus`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-24 cursor-pointer sm:w-32"
        style={{ accentColor: color }}
      />
      <span className="w-11 text-right tabular-nums text-muted-foreground">
        {value}°
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
}: RotationMatrixProps) {
  // The authored values are only a starting point; from then on the controls
  // own them. Clamped on the way in, because `vec3` will happily parse a
  // "400,0,0" that no slider could ever bring back.
  const [deg, setDeg] = useState<Vec3>(() => clampAngles(angles ?? [0, 0, 0]));
  const [rotation, setRotation] = useState<RotationMode>(() =>
    toRotationMode(mode),
  );

  const matrix = useMemo(() => rotationMatrix(deg, rotation), [deg, rotation]);
  const quaternion = useMemo(() => matrixToQuaternion(matrix), [matrix]);
  const rows = formatMatrix(matrix, decimals);

  const setAngle = (index: number, value: number) =>
    setDeg((prev) => {
      const next: Vec3 = [...prev];
      next[index] = clampAngle(value);
      return next;
    });

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
          <Redraw on={quaternion} />

          <ambientLight intensity={1.1} />
          <directionalLight position={[4, -6, 8]} intensity={1.6} />
          <directionalLight position={[-5, 4, -3]} intensity={0.4} />

          {grid && (
            <gridHelper
              // One square per basis vector, two squares out from the origin
              // in each direction.
              args={[GRID_SIZE, GRID_DIVISIONS, NEUTRAL, NEUTRAL]}
              // three.js lays the grid on xz; robotics wants it on the xy
              // plane of {I}.
              rotation={[Math.PI / 2, 0, 0]}
            />
          )}

          <Triad
            colors={INERTIAL}
            frameName={inertialName}
            labels={labels}
            muted
          />

          {/* The matrix, applied: {R} is {I} turned by ᴵR_R, which is exactly
              what makes the columns of the panel the arrows in the scene. */}
          <group quaternion={quaternion}>
            <Triad colors={ROTATED} frameName={rotatedName} labels={labels} />
          </group>

          <mesh>
            <sphereGeometry args={[0.05, 20, 20]} />
            <meshStandardMaterial color={NEUTRAL} roughness={0.4} />
          </mesh>

          {labels && <OriginLabel />}

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
          {INTERACTION_HINT}
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
          <FactorFormula
            mode={rotation}
            inertialName={inertialName}
            rotatedName={rotatedName}
          />
          <div className="flex items-center gap-1.5">
            <MatrixName inertialName={inertialName} rotatedName={rotatedName} />
            <span aria-hidden>=</span>
            <MatrixPanel
              rows={rows}
              columnColors={ANGLE_AXES.map((axis) => ROTATED[axis])}
            />
          </div>
        </div>

        <div className="flex flex-col items-start gap-1.5">
          <ModeSwitch
            mode={rotation}
            inertialName={inertialName}
            rotatedName={rotatedName}
            onSelect={setRotation}
          />
          {ANGLE_AXES.map((axis, i) => (
            <AngleSlider
              key={axis}
              axis={axis}
              value={deg[i]}
              step={step}
              onChange={(value) => setAngle(i, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
