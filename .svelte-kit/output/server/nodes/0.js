import * as universal from '../entries/pages/_layout.ts.js';

export const index = 0;
let component_cache;
export const component = async () => component_cache ??= (await import('../entries/fallbacks/layout.svelte.js')).default;
export { universal };
export const universal_id = "src/routes/+layout.ts";
export const imports = ["_app/immutable/nodes/0.B9-pPA5y.js","_app/immutable/chunks/BJLS7oZo.js","_app/immutable/chunks/DAyWrFPU.js","_app/immutable/chunks/BHKHB_e5.js"];
export const stylesheets = [];
export const fonts = [];
