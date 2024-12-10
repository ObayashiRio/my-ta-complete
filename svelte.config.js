import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      runtime: 'nodejs18.x'  // 必要なら 'nodejs20.x'
    }),
    alias: {
      $components: './src/components',
      $lib: './src/lib'
    }
  }
};

export default config;
