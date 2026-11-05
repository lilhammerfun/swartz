import type { Options } from "mind-elixir";

/** Closed Bezier outlines taper each main branch; the graph library still supplies layout coordinates. */
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
  // Top-level topics have 25px padding; main branches end below the text at the next branch's start.
  const x2 = right ? cL + cW - 25 : cL + 25;
  const y2 = cT + cH - 4;
  const bend = x1 + (x2 - x1) * 0.5;
  return `M ${x1} ${y1 - 5} C ${bend} ${y1 - 5}, ${bend} ${y2 - 1.5}, ${x2} ${y2 - 1.5} L ${x2} ${y2 + 1.5} C ${bend} ${y2 + 1.5}, ${bend} ${y1 + 5}, ${x1} ${y1 + 5} Z`;
};

/** Child branches start below the parent topic and extend beneath the child text, which sits on the line. */
export const organicSubBranch: NonNullable<Options["generateSubBranch"]> =
  function ({ pT, pL, pW, pH, cT, cL, cW, cH, direction, isFirst }) {
    const right = direction === "rhs";
    const gap =
      Number.parseFloat(
        this.container.style.getPropertyValue("--node-gap-x"),
      ) || 36;
    // Topic containers include horizontal gaps and 6px vertical padding; their bounds are not the text bounds.
    const parentInset = isFirst ? 25 : gap;
    const x1 = right ? pL + pW - parentInset : pL + parentInset;
    const y1 = pT + pH - (isFirst ? 4 : 6);
    const inner = right ? cL + gap : cL + cW - gap;
    const end = right ? cL + cW - gap : cL + gap;
    const y2 = cT + cH - 6;
    const bend = x1 + (inner - x1) * 0.55;
    return `M ${x1} ${y1} C ${bend} ${y1}, ${bend} ${y2}, ${inner} ${y2} L ${end} ${y2}`;
  };
