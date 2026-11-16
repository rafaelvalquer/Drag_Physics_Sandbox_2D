/**
 * Shared geometry of the side-view world. The world container uses PPM_BASE pixels per metre
 * (the camera scales the container), x grows to the right along the track and y grows downwards
 * on screen; the near lane's ground line is y = 0.
 *
 * The road is drawn as a band seen slightly from above, so depth across the track becomes a
 * vertical offset on screen: the far lane sits LANE_GAP_M "screen metres" above the near lane.
 */
export const PPM_BASE = 40;
/** Vertical screen offset between the ground lines of the two lanes (m). */
export const LANE_GAP_M = 1.9;
/** Asphalt below the near lane's ground line and above the far lane's (m). */
export const LANE_EDGE_M = 0.9;
/** Far-side tyres of a car touch the ground this far "into" the picture (m on screen). */
export const FAR_TYRE_OFFSET_M = 0.33;
/** Scale of everything in the far lane (depth cue). */
export const FAR_LANE_SCALE = 0.92;
/** The camera never shows the track before this point (m). */
export const TRACK_START_M = -30;
/** Run-off after the end of the track (m). */
export const TRACK_END_MARGIN_M = 12;
/** Foot of the far wall above the far lane edge (m on screen) and the wall's height (m). */
export const WALL_GAP_M = 0.25;
export const WALL_HEIGHT_M = 2.4;
/** The starting-line tree stands between the lanes, this far down-track from the line (m). */
export const TREE_X_M = 4.6;

/** Road band limits in world pixels. */
export const ROAD_TOP_PX = -(LANE_GAP_M + LANE_EDGE_M) * PPM_BASE;
export const ROAD_BOTTOM_PX = LANE_EDGE_M * PPM_BASE;
export const WALL_FOOT_PX = -(LANE_GAP_M + LANE_EDGE_M + WALL_GAP_M) * PPM_BASE;

export function laneYPx(lane: 0 | 1): number {
  return lane === 1 ? -LANE_GAP_M * PPM_BASE : 0;
}

export function laneScale(lane: 0 | 1): number {
  return lane === 1 ? FAR_LANE_SCALE : 1;
}
