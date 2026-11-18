import GLTransitions, { GLTransitionEntry } from 'gl-transitions';

const VERTEX_SHADER_SRC = `
attribute vec2 a_pos;
varying vec2 _uv;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  _uv = a_pos * 0.5 + 0.5;
}
`;

function buildFragmentShader(transitionGlsl: string): string {
  return `
precision highp float;
varying vec2 _uv;
uniform sampler2D from;
uniform sampler2D to;
uniform float progress;
uniform float ratio;

vec4 getFromColor(vec2 uv) {
  return texture2D(from, clamp(uv, 0.0, 1.0));
}

vec4 getToColor(vec2 uv) {
  return texture2D(to, clamp(uv, 0.0, 1.0));
}

${transitionGlsl}

void main() {
  gl_FragColor = transition(_uv);
}
`;
}

// Curated top pro transitions from GitHub gl-transitions/gl-transitions (plus full searchable list)
export const FEATURED_GL_TRANSITIONS: string[] = [
  'CrossZoom',
  'GlitchMemories',
  'GlitchDisplace',
  'GlitchFlicker',
  'LightningFlash',
  'DreamyZoom',
  'Cube',
  'Spin',
  'Swirl',
  'Kaleidoscope',
  'DirectionalWarp',
  'Doorway',
  'Ripple',
  'Pinwheel',
  'BurnThrough',
  'FilmBurn',
  'FlashFade',
  'Pixelize',
  'GridFlip',
  'CrossWarp',
  'InvertedPageCurl',
  'WaterDrop',
  'Wind',
  'Radial',
  'Bounce',
  'ZoomInCircles',
];

const transitionMap = new Map<string, GLTransitionEntry>();
for (const entry of GLTransitions) {
  if (!entry.textures || entry.textures.length === 0) {
    transitionMap.set(entry.name, entry);
  }
}

export function getAvailableGlTransitions(): GLTransitionEntry[] {
  const featured: GLTransitionEntry[] = [];
  const rest: GLTransitionEntry[] = [];
  const featuredSet = new Set(FEATURED_GL_TRANSITIONS);

  for (const name of FEATURED_GL_TRANSITIONS) {
    const found = transitionMap.get(name);
    if (found) featured.push(found);
  }
  for (const entry of transitionMap.values()) {
    if (!featuredSet.has(entry.name)) {
      rest.push(entry);
    }
  }
  return [...featured, ...rest];
}

export function getGlTransitionEntry(name: string): GLTransitionEntry | undefined {
  return transitionMap.get(name);
}

class GlTransitionContext {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null = null;
  programs = new Map<string, WebGLProgram | null>();
  texFrom: WebGLTexture | null = null;
  texTo: WebGLTexture | null = null;
  contextLost = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 360;
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      this.programs.clear();
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.initGl();
    });
    this.initGl();
  }

  private initGl() {
    this.gl = this.canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      alpha: true,
      premultipliedAlpha: false,
    });
    if (this.gl) {
      this.initBuffers(this.gl);
    }
  }

  private initBuffers(gl: WebGLRenderingContext) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const makeTex = () => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tex;
    };

    this.texFrom = makeTex();
    this.texTo = makeTex();
  }

  private compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private getProgram(name: string): WebGLProgram | null {
    if (!this.gl) return null;
    if (this.programs.has(name)) {
      return this.programs.get(name) ?? null;
    }
    const entry = transitionMap.get(name);
    if (!entry) {
      this.programs.set(name, null);
      return null;
    }

    const gl = this.gl;
    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, buildFragmentShader(entry.glsl));
    if (!vs || !fs) {
      this.programs.set(name, null);
      return null;
    }

    const prog = gl.createProgram();
    if (!prog) {
      this.programs.set(name, null);
      return null;
    }
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      this.programs.set(name, null);
      return null;
    }

    this.programs.set(name, prog);
    return prog;
  }

  render(
    transitionName: string,
    fromCanvas: HTMLCanvasElement,
    toCanvas: HTMLCanvasElement,
    progress: number,
    width: number,
    height: number
  ): HTMLCanvasElement | null {
    const gl = this.gl;
    if (!gl || this.contextLost) return null;
    try {
      const prog = this.getProgram(transitionName);
      const entry = transitionMap.get(transitionName);
      if (!prog || !entry) return null;

    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(prog);

    const posLoc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texFrom);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fromCanvas);
    gl.uniform1i(gl.getUniformLocation(prog, 'from'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texTo);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, toCanvas);
    gl.uniform1i(gl.getUniformLocation(prog, 'to'), 1);

    gl.uniform1f(gl.getUniformLocation(prog, 'progress'), Math.max(0, Math.min(1, progress)));
    gl.uniform1f(gl.getUniformLocation(prog, 'ratio'), width / Math.max(1, height));

    const defaults = entry.defaultParams || {};
    const types = entry.paramsTypes || {};
    for (const [key, paramType] of Object.entries(types)) {
      const loc = gl.getUniformLocation(prog, key);
      if (!loc) continue;
      const val = defaults[key];
      if (val === undefined) continue;
      if (paramType === 'float') {
        gl.uniform1f(loc, Number(val));
      } else if (paramType === 'int') {
        gl.uniform1i(loc, Number(val));
      } else if (paramType === 'bool') {
        gl.uniform1i(loc, val ? 1 : 0);
      } else if (paramType === 'vec2' && Array.isArray(val)) {
        gl.uniform2f(loc, Number(val[0] ?? 0), Number(val[1] ?? 0));
      } else if (paramType === 'ivec2' && Array.isArray(val)) {
        gl.uniform2i(loc, Number(val[0] ?? 1), Number(val[1] ?? 1));
      } else if (paramType === 'vec3' && Array.isArray(val)) {
        gl.uniform3f(loc, Number(val[0] ?? 0), Number(val[1] ?? 0), Number(val[2] ?? 0));
      } else if (paramType === 'vec4' && Array.isArray(val)) {
        gl.uniform4f(
          loc,
          Number(val[0] ?? 0),
          Number(val[1] ?? 0),
          Number(val[2] ?? 0),
          Number(val[3] ?? 1)
        );
      }
    }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return this.canvas;
    } catch {
      return null;
    }
  }
}

let sharedCtx: GlTransitionContext | null = null;
let sampleFromCanvas: HTMLCanvasElement | null = null;
let sampleToCanvas: HTMLCanvasElement | null = null;

function getSharedContext(): GlTransitionContext {
  if (!sharedCtx) sharedCtx = new GlTransitionContext();
  return sharedCtx;
}

export function renderGlTransitionFrame(
  transitionName: string,
  fromCanvas: HTMLCanvasElement,
  toCanvas: HTMLCanvasElement,
  progress: number,
  width: number,
  height: number
): HTMLCanvasElement | null {
  return getSharedContext().render(transitionName, fromCanvas, toCanvas, progress, width, height);
}

function getSampleScenes(): { from: HTMLCanvasElement; to: HTMLCanvasElement } {
  if (!sampleFromCanvas) {
    sampleFromCanvas = document.createElement('canvas');
    sampleFromCanvas.width = 160;
    sampleFromCanvas.height = 96;
    const ctx = sampleFromCanvas.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 160, 96);
      g.addColorStop(0, '#4F46E5');
      g.addColorStop(0.5, '#7C3AED');
      g.addColorStop(1, '#EC4899');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 160, 96);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(46, 48, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 22px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CLIP A', 80, 48);
    }
  }
  if (!sampleToCanvas) {
    sampleToCanvas = document.createElement('canvas');
    sampleToCanvas.width = 160;
    sampleToCanvas.height = 96;
    const ctx = sampleToCanvas.getContext('2d');
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 160, 96);
      g.addColorStop(0, '#0F172A');
      g.addColorStop(0.55, '#0891B2');
      g.addColorStop(1, '#10B981');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 160, 96);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.strokeRect(22, 16, 116, 64);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 22px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CLIP B', 80, 48);
    }
  }
  return { from: sampleFromCanvas, to: sampleToCanvas };
}

export function renderGlTransitionPreviewToCanvas(
  targetCanvas: HTMLCanvasElement,
  transitionName: string,
  progress = 0.45
): boolean {
  const { from, to } = getSampleScenes();
  const out = renderGlTransitionFrame(transitionName, from, to, progress, 160, 96);
  if (!out) return false;
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return false;
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(out, 0, 0, targetCanvas.width, targetCanvas.height);
  return true;
}
