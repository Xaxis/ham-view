// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: 'static',
  site: 'https://wilneeley.github.io',
  base: '/ham-view',
  build: {
    assets: 'assets'
  }
});
