/**
 * Constants shared by both processes. Keep this free of Node/Electron/DOM
 * imports.
 */

/**
 * Single thumbnail width (px) used for every downscaled image request
 * (`fcfile://...?w=THUMBNAIL_WIDTH`). The engine pre-generates this exact size at
 * download time, so the renderer must request the same width for the cache to
 * hit. One size keeps generation to one thumbnail per image; it's large enough
 * for detail previews and downscales cleanly to small grid/list covers.
 */
export const THUMBNAIL_WIDTH = 512
