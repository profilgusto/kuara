/**
 * Metadata for the `homogeneous-transform` widget.
 *
 * Kept apart from the component, like every catalogue entry, so the tests and
 * the authoring-guide generator can read the widget's contract without pulling
 * three.js into their import graph.
 */
import { bool, enumOf, num, str, vec3 } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "homogeneous-transform",
  title: "Transformação homogênea",
  description:
    "A pose completa de um frame: {R} gira com três sliders angulares e se " +
    "desloca com três sliders de posição, enquanto o painel monta, entrada " +
    "por entrada, a matriz ᴵT_R. As quatro colunas são pintadas como no " +
    "texto — a rotação ᴵR_R no bloco 3×3, a translação ᴵp_R na última " +
    "coluna e a linha [0 0 0 1] embaixo, apenas para fechar o quadrado. " +
    "Girar sem transladar mexe só no bloco esquerdo; transladar sem girar " +
    "mexe só na última coluna, que é o argumento visual de que a matriz não " +
    "é um objeto novo, e sim dois já conhecidos escritos lado a lado.",
  defaultHeight: 620,
  props: {
    angles: vec3(
      [0, 0, 30],
      'Ângulos iniciais em graus, no formato "α,β,γ" — as rotações em torno de x, y e z, nessa ordem. Cada um é limitado à faixa dos sliders (-180 a 180).',
    ),
    position: vec3(
      [1.2, 0.8, 0.6],
      'Translação inicial ᴵp_R, no formato "x,y,z", medida em vetores de base (um quadrado da malha). Limitada à faixa dos sliders (-2 a 2). O padrão já afasta {R} da origem, para que os dois triedros não nasçam sobrepostos.',
    ),
    mode: enumOf(
      ["inercial", "proprio"],
      "inercial",
      "Posição inicial da chave: `inercial` gira {R} em torno dos eixos fixos de {I}; `proprio` gira em torno dos eixos do próprio {R}.",
    ),
    step: num(
      5,
      "Incremento dos sliders angulares, em graus. Use 15 ou 30 para ângulos notáveis.",
      { min: 1, max: 45 },
    ),
    positionStep: num(
      0.1,
      "Incremento dos sliders de translação, em vetores de base. Use 0.5 ou 1 para posições sobre os nós da malha.",
      { min: 0.05, max: 1 },
    ),
    decimals: num(2, "Casas decimais das entradas da matriz.", {
      min: 0,
      max: 4,
      integer: true,
    }),
    inertialName: str("I", "Nome do frame inercial (o fixo)."),
    rotatedName: str("R", "Nome do frame que gira e se desloca."),
    labels: bool(
      true,
      "Exibe os rótulos x̂, ŷ, ẑ (com o subscrito do frame) nas pontas dos eixos, o nome de cada origem e o do vetor de translação.",
    ),
    grid: bool(
      true,
      "Desenha a malha de referência sobre o plano xy de {I}. Cada quadrado mede exatamente um vetor de base, que é a unidade dos sliders de translação.",
    ),
  },
};

export default meta;
