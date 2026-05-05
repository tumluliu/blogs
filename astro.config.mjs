// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://luliu.me',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    sitemap({
      changefreq: 'monthly',
      priority: 0.7,
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      wrap: true,
    },
  },
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
});
