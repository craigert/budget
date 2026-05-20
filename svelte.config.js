import adapter from '@sveltejs/adapter-static';

const dev = process.env.NODE_ENV !== 'production';
const base = dev ? '' : process.env.BASE_PATH ?? '/budget';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			fallback: 'index.html',
			pages: 'build',
			assets: 'build',
			strict: true
		}),
		paths: {
			base
		}
	}
};

export default config;
