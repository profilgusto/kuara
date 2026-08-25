/**
 * Metadata for the `coord-frame-3d` widget.
 *
 * Kept apart from the component so that the catalogue, the unit tests and the
 * authoring-guide generator can read a widget's contract without pulling
 * three.js (or `next/dynamic`) into their import graph.
 */
import { bool, str, vec3 } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "coord-frame-3d",
  title: "Sistema de coordenadas 3D",
  description:
    "Triedro cartesiano destro (x vermelho, y verde, z azul) que o aluno " +
    "rotaciona com o mouse. Os botões 1D/2D/3D no cabeçalho alternam entre a " +
    "reta, o plano e o espaço. Opcionalmente marca um ponto e projeta suas " +
    "coordenadas sobre os eixos.",
  defaultHeight: 420,
  // 1D → 2D → 3D reads as a build-up, so the buttons sit in that order; the
  // block still opens on the full triedro, which is what the section is about.
  variants: [
    {
      id: "1d",
      label: "1D",
      title: "Sistema de coordenadas 1D",
      hint: "Ver em uma dimensão",
    },
    {
      id: "2d",
      label: "2D",
      title: "Sistema de coordenadas 2D",
      hint: "Ver em duas dimensões",
    },
    {
      id: "3d",
      label: "3D",
      title: "Sistema de coordenadas 3D",
      hint: "Ver em três dimensões",
    },
  ],
  defaultVariant: "3d",
  props: {
    labels: bool(
      true,
      "Exibe os rótulos x̂, ŷ, ẑ nas pontas dos eixos e o na origem.",
    ),
    grid: bool(
      true,
      "Desenha a graduação de referência: a malha sobre o plano xy em 2D/3D e a régua sobre a reta em 1D. Cada quadrado (ou divisão) mede exatamente um vetor de base.",
    ),
    frameName: str(
      "A",
      "Nome do frame. Não aparece nos rótulos desenhados; descreve a figura para leitores de tela.",
    ),
    point: vec3(
      null,
      'Coordenadas de um ponto a marcar, no formato "x,y,z" (ex.: "1.5,1,0.8").',
    ),
    pointLabel: str("P", "Rótulo do ponto marcado."),
    projections: bool(
      true,
      "Traça as linhas tracejadas do ponto até os eixos (só com `point`).",
    ),
    autoRotate: bool(false, "Gira a cena lentamente até o aluno interagir."),
  },
};

export default meta;
