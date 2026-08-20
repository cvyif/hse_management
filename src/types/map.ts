/**
 * A point on the station map. Coordinates are normalized to the range
 * 0..1 in both axes so they remain valid regardless of the rendered map
 * size. x is the horizontal axis, y the vertical axis.
 */
export interface MapPoint {
  x: number
  y: number
}