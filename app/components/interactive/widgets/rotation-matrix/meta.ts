/**
 * Metadata for the `rotation-matrix` widget.
 *
 * Kept apart from the component, like every catalogue entry, so the tests and
 * the authoring-guide generator can read the widget's contract without pulling
 * three.js into their import graph.
 */
import { bool, enumOf, num, str, vec3 } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "rotation-matrix",
  title: "Matriz de rotação",
  description:
    "Dois sistemas de coordenadas de mesma origem — o inercial {I}, fixo, e " +
    "{R}, que o aluno gira com três sliders (um por eixo). Uma chave " +
    "seletora alterna entre girar em torno dos eixos do próprio {R} " +
    "(rotação intrínseca) e em torno dos eixos inerciais de {I} " +
    "(extrínseca), mostrando que os mesmos ângulos em ordens diferentes " +
    "dão orientações diferentes. O painel exibe, a todo momento, a matriz " +
    "de rotação ᴵR_R, cujas colunas são os vetores de base de {R} escritos " +
    "em {I}.",
  defaultHeight: 560,
  props: {
    angles: vec3(
      [0, 0, 30],
      'Ângulos iniciais em graus, no formato "α,β,γ" — as rotações em torno de x, y e z, nessa ordem. Cada um é limitado à faixa dos sliders (-180 a 180). O padrão já deixa {R} levemente girado, para que os dois triedros não nasçam sobrepostos.',
    ),
    mode: enumOf(
      ["inercial", "proprio"],
      "inercial",
      "Posição inicial da chave: `inercial` gira {R} em torno dos eixos fixos de {I}; `proprio` gira em torno dos eixos do próprio {R}.",
    ),
    step: num(
      5,
      "Incremento dos sliders, em graus. Use 15 ou 30 para ângulos notáveis.",
      { min: 1, max: 45 },
    ),
    decimals: num(2, "Casas decimais das entradas da matriz.", {
      min: 0,
      max: 4,
      integer: true,
    }),
    inertialName: str("I", "Nome do frame inercial (o fixo)."),
    rotatedName: str("R", "Nome do frame que gira."),
    labels: bool(
      true,
      "Exibe os rótulos x̂, ŷ, ẑ (com o subscrito do frame) nas pontas dos eixos e o na origem.",
    ),
    grid: bool(
      true,
      "Desenha a malha de referência sobre o plano xy de {I}. Cada quadrado mede exatamente um vetor de base.",
    ),
  },
};

export default meta;
