/**
 * Metadata for the `inertial-odometry` widget.
 *
 * Kept apart from the component, like every catalogue entry, so the tests and
 * the authoring-guide generator can read the widget's contract without pulling
 * three.js into their import graph.
 */
import { bool, num, str } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "inertial-odometry",
  title: "Velocidades e odometria no frame inercial",
  description:
    "O robô diferencial visto de cima, agora com o frame inercial {I} fixo no " +
    "centro do plano: a câmera não acompanha o robô, ela abre à medida que ele " +
    "se afasta, para que a origem contra a qual tudo é medido nunca saia de " +
    "vista. Os sliders comandam as rodas (ω_l e ω_r) ou, pelos botões do " +
    "cabeçalho, diretamente as velocidades do chassi. Enquanto o robô anda, o " +
    "painel mostra as duas contas da seção: a transformada que leva ᴿξ̇_R para " +
    "{I}, com a matriz de rotação preenchida pelo θ corrente, e o somatório " +
    "discreto que acumula a pose ᴵξ_R(T) a partir dessas velocidades. Na cena " +
    "aparecem o rastro do percurso, o vetor posição ᴵp_R, o ângulo θ entre os " +
    "dois frames, as componentes ẋ_I e ẏ_I da velocidade, e — em traço " +
    "pontilhado — a estimativa da odometria, que se descola do robô quanto " +
    "maior for o passo Δt da integração.",
  defaultHeight: 680,
  variants: [
    {
      id: "direto",
      label: "ω→v",
      title: "Odometria comandando as rodas",
      hint: "Comandar ω_l e ω_r",
    },
    {
      id: "inverso",
      label: "v→ω",
      title: "Odometria comandando o chassi",
      hint: "Comandar ẋ_R e θ̇_R",
    },
  ],
  defaultVariant: "direto",
  props: {
    wheelRadius: num(
      0.05,
      "Raio r das rodas, em metros. Também define o desenho: as rodas vistas de cima têm exatamente 2r de comprimento.",
      { min: 0.01, max: 0.5 },
    ),
    track: num(
      0.3,
      "Bitola d, em metros — a distância entre os pontos de contato das rodas. Define a escala do robô e o alcance dos sliders do modo inverso.",
      { min: 0.05, max: 2 },
    ),
    leftSpeed: num(
      0,
      "Velocidade angular inicial da roda esquerda, ω_l, em rad/s. Zero por padrão: o bloco abre parado, para que o primeiro movimento seja o que o aluno comandou.",
      { min: -10, max: 10 },
    ),
    rightSpeed: num(
      0,
      "Velocidade angular inicial da roda direita, ω_r, em rad/s. Zero por padrão, pelo mesmo motivo.",
      { min: -10, max: 10 },
    ),
    step: num(
      0.1,
      "Passo Δt da integração da odometria, em segundos. É o Δt do somatório da seção: com 0,1 s a estimativa já se descola visivelmente do robô numa curva fechada, e valores maiores tornam o erro tão grande quanto o texto avisa.",
      { min: 0.01, max: 2 },
    ),
    trail: bool(
      true,
      "Desenha o rastro do percurso real do robô, em linha cheia, e o da estimativa da odometria, pontilhado.",
    ),
    components: bool(
      true,
      "Decompõe a velocidade do robô nas componentes ẋ_I e ẏ_I do frame inercial, como catetos tracejados sob a seta de velocidade — o conteúdo geométrico da transformada.",
    ),
    decimals: num(2, "Casas decimais dos números do painel.", {
      min: 0,
      max: 3,
      integer: true,
    }),
    frameName: str(
      "R",
      "Nome do frame do robô. Aparece nos rótulos dos eixos do chassi e no subscrito das velocidades.",
    ),
    inertialName: str(
      "I",
      "Nome do frame inercial fixo, marcado na origem do plano.",
    ),
  },
};

export default meta;
