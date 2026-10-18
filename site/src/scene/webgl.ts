// Cheap WebGL probe shared by the scene and the bead; the answer is kept, so a page creates one context at most.

let known: boolean | undefined;

export function hasWebGL(): boolean {
  if (known === undefined) known = probe();
  return known;
}

function probe(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
