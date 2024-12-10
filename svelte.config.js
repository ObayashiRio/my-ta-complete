// Vercel用のアダプターをインポート
import vercel from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // 使用するアダプターを1つだけ指定
    adapter: vercel({
      runtime: 'nodejs18.x'  // 必要に応じて変更
    }),
    alias: {
      $components: './src/components',
      $lib: './src/lib'
    }
  }
};

export default config;
