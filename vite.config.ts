import { defineConfig } from 'vite';

// GitHub Pages의 하위 경로(/raccoon/)에서도 열리도록 상대 경로로 빌드한다
export default defineConfig({ base: './' });
