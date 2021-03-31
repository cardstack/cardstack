export {};

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

declare module '**/*.png' {
  const value: string;
  export default value;
}

declare module '**/*.jpg' {
  const value: string;
  export default value;
}
