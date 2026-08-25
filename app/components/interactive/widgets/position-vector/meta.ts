/**
 * Metadata for the `position-vector` widget.
 *
 * Kept apart from the component, like every catalogue entry, so the tests and
 * the authoring-guide generator can read the widget's contract without pulling
 * three.js into their import graph.
 */
import { bool, num, str, vec3 } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "position-vector",
  title: "Vetor de posição 3D",
  description:
    "O vetor de posição de um ponto no espaço, traçado da origem do frame " +
    "até o ponto. Sliders movem o ponto ao longo de cada eixo (de -5 a 5) e o " +
    "painel mostra o vetor de coordenadas correspondente, tanto na forma " +
    "matricial quanto como combinação dos vetores de base. Os botões 1D/2D/3D " +
    "no cabeçalho alternam entre a reta, o plano e o espaço.",
  defaultHeight: 520,
  variants: [
    {
      id: "1d",
      label: "1D",
      title: "Vetor de posição 1D",
      hint: "Ver em uma dimensão",
    },
    {
      id: "2d",
      label: "2D",
      title: "Vetor de posição 2D",
      hint: "Ver em duas dimensões",
    },
    {
      id: "3d",
      label: "3D",
      title: "Vetor de posição 3D",
      hint: "Ver em três dimensões",
    },
  ],
  defaultVariant: "3d",
  props: {
    point: vec3(
      [3, 2, 1],
      'Posição inicial do ponto, no formato "x,y,z". Cada componente é limitada à faixa dos sliders (-5 a 5).',
    ),
    pointLabel: str(
      "r",
      "Nome do ponto. Aparece como o subscrito do vetor no painel (ᴵp_r) e ao lado do marcador.",
    ),
    frameName: str(
      "I",
      "Nome do frame de referência. Aparece como o sobrescrito do vetor no painel e no subscrito dos vetores de base (x̂_I).",
    ),
    step: num(0.5, "Incremento dos sliders. Use 1 para coordenadas inteiras.", {
      min: 0.1,
      max: 1,
    }),
    labels: bool(
      true,
      "Exibe os rótulos x̂, ŷ, ẑ nas pontas dos eixos, o na origem e o nome do ponto ao lado do marcador.",
    ),
    grid: bool(
      true,
      "Desenha a graduação de referência: a malha sobre o plano xy em 2D/3D e a régua sobre a reta em 1D. Cada quadrado mede exatamente um vetor de base.",
    ),
    projections: bool(
      true,
      "Traça as linhas tracejadas do ponto até os eixos, mostrando de onde vem cada coordenada.",
    ),
  },
};

export default meta;
