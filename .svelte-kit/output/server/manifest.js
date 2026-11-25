export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["releases/.gitkeep"]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.DPHjKeNv.js",app:"_app/immutable/entry/app.agYDmzdL.js",imports:["_app/immutable/entry/start.DPHjKeNv.js","_app/immutable/chunks/By8x4Xfi.js","_app/immutable/chunks/C808NSGc.js","_app/immutable/chunks/BfH6jG92.js","_app/immutable/entry/app.agYDmzdL.js","_app/immutable/chunks/C808NSGc.js","_app/immutable/chunks/BJIbnkKj.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
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
