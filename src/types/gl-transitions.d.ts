declare module 'gl-transitions' {
  export interface GLTransitionEntry {
    name: string;
    author: string;
    license: string;
    description?: string;
    tags: string[];
    glsl: string;
    defaultParams: Record<string, unknown>;
    paramsTypes: Record<string, string>;
    textures?: string[];
  }

  const transitions: GLTransitionEntry[];
  export default transitions;
}
