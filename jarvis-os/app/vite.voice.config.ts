/* module vocal de la nouvelle app (orbe, globe, dictée d'une question, lecture d'une réponse ; 0.31.0 : mains libres sur le même Claude, lecture au fil de la réponse) : essais/jarvis-os-maquette/jarvis-voix.js */
import {defineConfig} from 'vite';
export default defineConfig({
  build: {outDir: '../../essais/jarvis-os-maquette', emptyOutDir: false, target: 'safari16', copyPublicDir: false,
    lib: {entry: 'src/voix-page.ts', name: 'JarvisVoice', formats: ['iife'], fileName: () => 'jarvis-voix.js'}}
});
