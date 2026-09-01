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
    "seletora escolhe o que os sliders significam. Em `inercial` " +
    "(extrínseca) eles são três ângulos absolutos em torno dos eixos fixos " +
    "de {I}. Em `proprio` (intrínseca) cada slider gira {R} em torno do " +
    "próprio eixo, a partir de onde o frame está, e volta a zero quando " +
    "solto: a rotação vira um passo da sequência e deixa um triedro " +
    "fantasma marcando por onde {R} passou. Assim o aluno pode girar duas " +
    "vezes em torno do mesmo eixo e ver que, da segunda vez, esse eixo já " +
    "não é o mesmo. O botão “alinhar eixos” zera tudo e apaga os fantasmas, " +
    "e trocar de modo também. O painel exibe, a todo momento, a matriz de " +
    "rotação ᴵR_R, cujas colunas são os vetores de base de {R} escritos em " +
    "{I}. Os botões 1D/2D/3D no cabeçalho trocam a dimensão dos dois " +
    "frames, e com ela quantas rotações existem: nenhuma na reta (ᴵR_R = " +
    "[1]), uma no plano (em torno do ẑ que sai da página, onde as duas " +
    "convenções coincidem) e três no espaço.",
  defaultHeight: 560,
  // 1D → 2D → 3D reads as a build-up, and here it is a build-up of degrees of
  // freedom: none, one, three. The block still opens on the full triedro,
  // which is what the section is about.
  variants: [
    {
      id: "1d",
      label: "1D",
      title: "Rotação em 1D",
      hint: "Ver em uma dimensão: uma reta não gira",
    },
    {
      id: "2d",
      label: "2D",
      title: "Matriz de rotação no plano",
      hint: "Ver em duas dimensões: uma rotação, em torno de ẑ",
    },
    {
      id: "3d",
      label: "3D",
      title: "Matriz de rotação",
      hint: "Ver em três dimensões: três rotações e a ordem entre elas",
    },
  ],
  defaultVariant: "3d",
  props: {
    angles: vec3(
      [0, 0, 30],
      'Ângulos iniciais em graus, no formato "α,β,γ" — as rotações em torno de x, y e z, nessa ordem. Cada um é limitado à faixa dos sliders (-180 a 180). Nas vistas 1D e 2D, os ângulos cujo eixo não existe ali são lidos como zero. O padrão já deixa {R} levemente girado, para que os dois triedros não nasçam sobrepostos.',
    ),
    mode: enumOf(
      ["inercial", "proprio"],
      "inercial",
      "Posição inicial da chave: `inercial` gira {R} em torno dos eixos fixos de {I}; `proprio` gira em torno dos eixos do próprio {R}. Só aparece na vista 3D — com uma rotação só, as duas dão o mesmo resultado.",
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
