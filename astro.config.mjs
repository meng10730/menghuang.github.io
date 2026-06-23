// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  // 請替換為您的 GitHub Pages 網址。例如：https://samww.github.io
  site: 'https://samww.github.io',
  // 若部署在個人主網頁（username.github.io），base 設為 '/'。
  // 若部署在專案子網頁（username.github.io/repo-name），base 請修改為 '/repo-name'。
  base: '/',
  integrations: [mdx()],
});
