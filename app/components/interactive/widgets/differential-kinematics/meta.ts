/**
 * Metadata for the `differential-kinematics` widget.
 *
 * Kept apart from the component, like every catalogue entry, so the tests and
 * the authoring-guide generator can read the widget's contract without pulling
 * three.js into their import graph.
 */
import { bool, num, str } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "differential-kinematics",
  title: "Cinemática do robô diferencial",
  description:
    "A Eq. (3) do módulo virada objeto manipulável, vista de cima. Dois " +
    "sliders comandam as velocidades angulares das rodas (ω_l e ω_r) e o robô " +
    "passa a se deslocar no plano com a velocidade linear e angular " +
    "resultantes, deixando o rastro do caminho percorrido e o centro " +
    "instantâneo de rotação em que ele gira. O painel mostra a mesma conta em " +
    "forma matricial, com os números correntes. Os botões no cabeçalho " +
    "invertem a relação: em ω→v os sliders são as rodas e o chassi obedece; " +
    "em v→ω os sliders são as velocidades do chassi e as rodas recebem, pela " +
    "fórmula inversa, o que precisam fazer para produzi-las. O bloco abre com " +
    "o robô parado, e o botão reiniciar devolve tudo ao repouso: velocidades " +
    "zeradas, robô na origem e rastro apagado.",
  defaultHeight: 620,
  variants: [
    {
      id: "direto",
      label: "ω→v",
      title: "Cinemática direta: das rodas ao chassi",
      hint: "Comandar as rodas e ver o chassi obedecer",
    },
    {
      id: "inverso",
      label: "v→ω",
      title: "Cinemática inversa: do chassi às rodas",
      hint: "Comandar o chassi e ver o que as rodas precisam fazer",
    },
  ],
  defaultVariant: "direto",
  props: {
    wheelRadius: num(
      0.05,
      "Raio r das rodas, em metros. Também define o desenho: as rodas vistas de cima têm exatamente 2r de comprimento, para que a figura nunca discorde dos números.",
      { min: 0.01, max: 0.5 },
    ),
    track: num(
      0.3,
      "Bitola d, em metros — a distância entre os pontos de contato das rodas. Define a escala do robô inteiro e o alcance dos sliders do modo inverso.",
      { min: 0.05, max: 2 },
    ),
    leftSpeed: num(
      0,
      "Velocidade angular inicial da roda esquerda, ω_l, em rad/s. Zero por padrão: o bloco abre com o robô parado, para que o primeiro movimento que o aluno vê seja o que ele mesmo comandou. Limitada a ±10 rad/s, o que o widget assume ser o limite dos motores.",
      { min: -10, max: 10 },
    ),
    rightSpeed: num(
      0,
      "Velocidade angular inicial da roda direita, ω_r, em rad/s. Zero por padrão, pelo mesmo motivo de ω_l. Autore as duas com valores diferentes para que o bloco já abra descrevendo uma curva.",
      { min: -10, max: 10 },
    ),
    trail: bool(
      true,
      "Deixa o rastro do caminho percorrido no plano — a trajetória que a seção de odometria vai calcular depois.",
    ),
    icr: bool(
      true,
      "Marca o centro instantâneo de rotação, a uma distância v/ω sobre o eixo ŷ_R, e a circunferência que o robô descreve em torno dele. Some quando o caminho é reto, que é o centro no infinito.",
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
