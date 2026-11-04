/** Maximum size of a stored drawing (scene and preview) in characters. */
export const MAX_DRAWING_SIZE = 3 * 1024 * 1024;

/**
 * Convert an SVG string into a data url that can be used safely as an image
 * source, scripts inside an SVG never run when it is loaded as an image.
 *
 * @param svg The SVG markup.
 * @returns A data url.
 */
export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
