import type { Options } from "mind-elixir";

/** 闭合贝塞尔轮廓使主枝从中心的宽笔触逐渐收细；布局坐标仍由图库提供。 */
export const organicMainBranch: NonNullable<Options["generateMainBranch"]> = ({
  pT,
  pL,
  pW,
  pH,
  cT,
  cL,
  cW,
  cH,
  direction,
}) => {
  const right = direction === "rhs";
  const x1 = pL + pW * (right ? 0.8 : 0.2);
  const y1 = pT + pH / 2;
  // 一级主题的内边距为 25px；主枝止于文字下方，与下一层的起点一致。
  const x2 = right ? cL + cW - 25 : cL + 25;
  const y2 = cT + cH - 4;
  const bend = x1 + (x2 - x1) * 0.5;
  return `M ${x1} ${y1 - 5} C ${bend} ${y1 - 5}, ${bend} ${y2 - 1.5}, ${x2} ${y2 - 1.5} L ${x2} ${y2 + 1.5} C ${bend} ${y2 + 1.5}, ${bend} ${y1 + 5}, ${x1} ${y1 + 5} Z`;
};

/** 子枝从父主题下沿接出，再沿子主题下沿延伸，文字直接坐在线上。 */
export const organicSubBranch: NonNullable<Options["generateSubBranch"]> =
  function ({ pT, pL, pW, pH, cT, cL, cW, cH, direction, isFirst }) {
    const right = direction === "rhs";
    const gap =
      Number.parseFloat(
        this.container.style.getPropertyValue("--node-gap-x"),
      ) || 36;
    // 普通主题的容器左右有 gap、上下有 6px padding，不能把整个容器当作文字边界。
    const parentInset = isFirst ? 25 : gap;
    const x1 = right ? pL + pW - parentInset : pL + parentInset;
    const y1 = pT + pH - (isFirst ? 4 : 6);
    const inner = right ? cL + gap : cL + cW - gap;
    const end = right ? cL + cW - gap : cL + gap;
    const y2 = cT + cH - 6;
    const bend = x1 + (inner - x1) * 0.55;
    return `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${inner} ${y2} L ${end} ${y2}`;
  };
