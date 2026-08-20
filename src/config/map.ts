/**
 * Site Map asset configuration (Phase 6).
 *
 * The station Site Map is a static asset served from the Vite `public`
 * directory. The real map image is provided separately by the station; to use
 * it, drop the file into `public/maps/` and point `SITE_MAP_IMAGE_URL` at it
 * (e.g. `/maps/site-map.png`).
 *
 * A placeholder (`public/maps/site-map.svg`) ships so the map UI is usable in
 * development and tests until the real asset is installed. Serving the map
 * from `public/` means it is a public frontend asset — no Firebase
 * credentials are involved and no Storage upload infrastructure is required
 * (documented decision, Phase 6 §27).
 */
export const SITE_MAP_IMAGE_URL = '/maps/site-map.svg'

/** Fallback map label used while the asset is loading. */
export const SITE_MAP_IMAGE_ALT = 'Site Map'