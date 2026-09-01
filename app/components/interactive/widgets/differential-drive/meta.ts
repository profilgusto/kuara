/**
 * Metadata for the `differential-drive` widget.
 *
 * Kept apart from the component, like every catalogue entry, so the tests and
 * the authoring-guide generator can read the widget's contract without pulling
 * three.js into their import graph.
 */
import { bool, num, str } from "../../props";
import type { WidgetMeta } from "../../catalog";

const meta: WidgetMeta = {
  id: "differential-drive",
  title: "Robô diferencial: medidas e variáveis",
  description:
    "O chassi de um robô diferencial genérico, translúcido e girável, com " +
    "todos os símbolos da modelagem escritos sobre aquilo que eles medem: o " +
    "frame {R} na origem do eixo das rodas, o raio r, a bitola d entre os " +
    "pontos de contato, a velocidade angular de cada roda (ω_l e ω_r) com a " +
    "velocidade linear que ela produz (v_l e v_r), e as velocidades do chassi " +
    "ao longo dos eixos em que são expressas (ẋ_R, ẏ_R = 0 pela restrição " +
    "não-holonômica, e θ̇_R). Cada grupo de anotações pode ser desligado por " +
    "parâmetro, para usar a mesma figura em pontos diferentes da aula.",
  defaultHeight: 480,
  props: {
    frameName: str(
      "R",
      "Nome do frame do robô. Aparece no subscrito dos vetores de base (x̂_R) e das velocidades do chassi (ẋ_R).",
    ),
    labels: bool(
      true,
      "Exibe o triedro rotulado: x̂, ŷ e ẑ nas pontas dos eixos e a origem O do frame sobre o eixo das rodas.",
    ),
    measures: bool(
      true,
      "Exibe as medidas geométricas: a linha do raio r, do centro de cada roda até o seu bordo, e a linha de cota da bitola d entre os dois pontos de contato com o solo.",
    ),
    wheelSpeeds: bool(
      true,
      "Exibe o que cada roda faz: a velocidade angular ω_l e ω_r, como arcos em torno do eixo no sentido positivo (que rola a roda para a frente), e a velocidade linear resultante v_l e v_r, como setas para a frente.",
    ),
    chassisSpeeds: bool(
      true,
      "Exibe as velocidades do chassi expressas em {R}: ẋ_R para a frente, θ̇_R em torno de ẑ_R, e ẏ_R tracejada e anulada, que é a restrição não-holonômica.",
    ),
    grid: bool(
      true,
      "Desenha o piso graduado sob o robô. Cada quadrado mede uma unidade do mundo, servindo de escala para r e d.",
    ),
    opacity: num(
      0.34,
      "Opacidade do chassi e das rodas. Valores baixos deixam ver o triedro e a linha de cota através do corpo; 1 desenha o robô sólido.",
      { min: 0.1, max: 1 },
    ),
  },
};

export default meta;
