export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png","svelte.svg","tauri.svg","vite.svg"]),
	mimeTypes: {".png":"image/png",".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.BZ-waxFN.js",app:"_app/immutable/entry/app.BBvVfs30.js",imports:["_app/immutable/entry/start.BZ-waxFN.js","_app/immutable/chunks/Af95OWGT.js","_app/immutable/chunks/DTLKjO-7.js","_app/immutable/chunks/BJSTtiyO.js","_app/immutable/entry/app.BBvVfs30.js","_app/immutable/chunks/DDAiwh4r.js","_app/immutable/chunks/DTLKjO-7.js","_app/immutable/chunks/DWpynuAo.js","_app/immutable/chunks/CI-vtyen.js","_app/immutable/chunks/DLXK_Zry.js","_app/immutable/chunks/BJSTtiyO.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
