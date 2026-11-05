/** Pages scale to width and grow vertically; fullscreen fits both dimensions. Sizes use unscaled layout units. */
export function planMapFit(
  mapWidth: number,
  mapHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  fullscreen: boolean,
) {
  const padding = 16;
  if (mapWidth <= 0 || mapHeight <= 0 || viewportWidth <= padding * 2)
    return null;
  const widthScale = (viewportWidth - padding * 2) / mapWidth;
  const scale = Math.min(
    1.5,
    widthScale,
    fullscreen
      ? Math.max(1, viewportHeight - padding * 2) / mapHeight
      : Infinity,
  );
  return { scale, height: Math.ceil(mapHeight * scale + padding * 2) };
}
