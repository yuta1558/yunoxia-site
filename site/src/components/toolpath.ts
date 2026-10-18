// One printed layer drawn as a gently waving contour, shared by the static toolpath drawings
// (hero fallback, Works cards, the Research band). Layer i sits `step` above layer i-1.
export const contour = (i: number, cx: number, base: number, step: number, amp: number) => {
  const y = base - i * step;
  const w = amp + Math.sin(i / 3.2) * amp * 0.28;
  return `M ${(cx - w).toFixed(1)} ${y} C ${(cx - w / 2).toFixed(1)} ${y - 14}, ${(cx + w / 2).toFixed(1)} ${y + 14}, ${(cx + w).toFixed(1)} ${y}`;
};
