const MARGIN = 8;

/** Keeps a box of `size` at `point` fully inside the viewport, preferring the pointer position. */
export function clampToViewport(
  point: { x: number; y: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = MARGIN,
): { left: number; top: number } {
  const maxLeft = viewport.width - size.width - margin;
  const maxTop = viewport.height - size.height - margin;
  return {
    left: Math.max(margin, Math.min(point.x, maxLeft)),
    top: Math.max(margin, Math.min(point.y, maxTop)),
  };
}
