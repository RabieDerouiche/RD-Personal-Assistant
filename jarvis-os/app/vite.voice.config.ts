/* module vocal autonome (orbe, voile, conversation continue) pour la nouvelle app : essais/jarvis-os-maquette/jarvis-voix.js */
import {defineConfig} from 'vite';
export default defineConfig({
  build: {outDir: '../../essais/jarvis-os-maquette', emptyOutDir: false, target: 'safari16', copyPublicDir: false,
    lib: {entry: 'src/voice-overlay.ts', name: 'JarvisVoice', formats: ['iife'], fileName: () => 'jarvis-voix.js'}}
});
