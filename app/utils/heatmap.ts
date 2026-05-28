// heatmap.ts

/**
 * Calculates a logarithmic scale factor and a color hue based on file size.
 * @param size The file size in bytes
 * @param minSize The minimum file size in the current repository graph
 * @param maxSize The maximum file size in the current repository graph
 * @returns An object containing `scale` (0.7 to 1.8) and `color` (HSL string from blue to red)
 */
export function calculateHeatmapStyles(size: number | undefined, minSize: number, maxSize: number): { scale: number, color: string } {
  const safeSize = size || 0;
  
  if (safeSize === 0 || maxSize === 0) {
    return { scale: 0.75, color: 'hsl(220, 80%, 60%)' }; // Cool blue for empty/tiny files
  }

  // Use logarithmic scale to prevent large files (outliers) from squashing the rest of the distribution
  const logMin = Math.log(Math.max(minSize, 1));
  const logMax = Math.log(Math.max(maxSize, 1));
  const logSize = Math.log(Math.max(safeSize, 1));

  let ratio = 0;
  if (logMax > logMin) {
    ratio = (logSize - logMin) / (logMax - logMin);
  }
  
  ratio = Math.max(0, Math.min(1, ratio));

  // Scale between 0.75x and 1.75x
  const scale = 0.75 + (ratio * 1.0);

  // Hue transitions from 220 (Blue) -> 120 (Green) -> 60 (Yellow) -> 0 (Red)
  const hue = Math.round(220 - (ratio * 220));
  
  return { scale, color: `hsl(${hue}, 85%, 60%)` };
}

/**
 * Returns a color string transitioning from blue/cool to red/warm.
 * Start: rgba(59, 130, 246, 0.6)
 * End: rgba(239, 68, 68, 0.6)
 */
export function getHeatmapColor(sizeFactor: number): string {
  const r = Math.round(59 + (239 - 59) * sizeFactor);
  const g = Math.round(130 + (68 - 130) * sizeFactor);
  const b = Math.round(246 + (68 - 246) * sizeFactor);
  return `rgba(${r}, ${g}, ${b}, 0.6)`;
}
