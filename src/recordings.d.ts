/** The recordings found in public/audio/sfx and public/audio/voice at build time (vite.config.ts). */
declare module 'virtual:recordings' {
  const files: string[];
  export default files;
}
