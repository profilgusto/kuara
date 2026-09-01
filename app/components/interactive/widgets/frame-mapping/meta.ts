/**
 * Metadata for the `frame-mapping` widget.
 *
 * Kept apart from the component, like every catalogue entry, so the tests and
 * the authoring-guide generator can read the widget's contract without pulling
 * three.js into their import graph.
 */
import { bool, num, str, vec3 } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "frame-mapping",
  title: "Mapeando de um frame para o outro",
  description:
    "O mesmo ponto m, lido em dois frames. O aluno arrasta m pelo espaço e " +
    "coloca {B} onde quiser em relação a {A} — transladando e girando — " +
    "enquanto o painel instancia os três elementos da conta: ᴬp_m, ᴮR_A e " +
    "ᴮp_A. Abaixo deles a expressão ᴮp_m = ᴮR_A ᴬp_m + ᴮp_A é montada com " +
    "esses números e resolvida em duas etapas, a rotação primeiro e a soma " +
    "depois, exatamente como se faz no papel. O detalhe que a figura torna " +
    "visível é que ᴮp_A não é o simétrico da posição de {B}: é aquele " +
    "deslocamento resolvido nos eixos de {B}, e por isso ele muda quando " +
    "só a rotação muda. Os botões 2D/3D alternam entre o plano do exemplo " +
    "da seção, onde há um único ângulo, e o espaço, com os três — que é " +
    "onde o bloco abre.",
  defaultHeight: 620,
  variants: [
    {
      id: "2d",
      label: "2D",
      title: "Mapeando de um frame para o outro (plano)",
      hint: "Ver no plano, como a figura da seção",
    },
    {
      id: "3d",
      label: "3D",
      title: "Mapeando de um frame para o outro (espaço)",
      hint: "Ver em três dimensões",
    },
  ],
  defaultVariant: "3d",
  props: {
    point: vec3(
      [4, 3, 2],
      'Posição inicial do ponto m, escrita em {A} — o ᴬp_m da conta, no formato "x,y,z". Cada componente é limitada à faixa dos sliders (-7 a 7).',
    ),
    framePosition: vec3(
      [5, 2, 0],
      'Onde a origem de {B} começa, medida em {A} (ᴬp_B), no formato "x,y,z". É a pose que o aluno enxerga; o ᴮp_A do painel é derivado dela. Limitada à faixa dos sliders (-7 a 7).',
    ),
    angles: vec3(
      [0, 0, -180],
      'Orientação inicial de {B} em relação a {A}, em graus, no formato "α,β,γ" — as rotações em torno dos eixos fixos x, y e z de {A}, nessa ordem. No modo 2D só γ é usado.',
    ),
    step: num(
      5,
      "Incremento dos sliders angulares, em graus. Use 15, 30 ou 90 para ângulos notáveis.",
      { min: 1, max: 45 },
    ),
    positionStep: num(
      1,
      "Incremento dos sliders de posição, em vetores de base. O padrão é 1, que mantém m e {B} sobre os nós da malha e as contas em números inteiros.",
      { min: 0.1, max: 1 },
    ),
    decimals: num(1, "Casas decimais das entradas do painel.", {
      min: 0,
      max: 4,
      integer: true,
    }),
    referenceName: str("A", "Nome do frame de referência, onde m é conhecido."),
    targetName: str("B", "Nome do frame de destino, para o qual m é mapeado."),
    pointLabel: str("m", "Nome do ponto. Aparece no subscrito dos vetores."),
    labels: bool(
      true,
      "Exibe os rótulos x̂, ŷ, ẑ (com o subscrito do frame) nas pontas dos eixos, o nome de cada origem, o do ponto e o de cada vetor.",
    ),
    grid: bool(
      true,
      "Desenha a malha de referência sobre o plano xy de {A}. Cada quadrado mede exatamente um vetor de base, que é a unidade de todos os sliders de posição.",
    ),
  },
};

export default meta;
