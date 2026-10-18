// GLSL for the toolpath / deposit particles.
// Act 2: particles run along each layer's perimeter (the toolpath) and appear layer by layer;
//        colour encodes heat history: the layer just printed is hot (accent), older layers cool down.
// Act 3: particles are re-deposited into a short list of bars, bar by bar, left to right.

export const particleVertex = /* glsl */ `
  attribute vec3 aRect;   // x0, x1, layer index
  attribute vec2 aSeed;   // start along perimeter, random
  attribute vec3 aTarget; // deposit target
  attribute float aOrder; // deposit order 0..1

  uniform float uTime;
  uniform float uP1;      // explode 0..1
  uniform float uP2;      // print progress 0..1
  uniform float uP3;      // re-deposit progress 0..1
  uniform float uLayers;
  uniform float uPitch;
  uniform float uHeight;
  uniform float uDepth;
  uniform float uGap;
  uniform float uSize;
  uniform float uPR;

  varying float vHeat;
  varying float vAlpha;

  vec3 perimeter(float x0, float x1, float t) {
    float w = x1 - x0;
    float d = uDepth;
    float per = 2.0 * w + 2.0 * d;
    float s = t * per;
    if (s < w) return vec3(x0 + s, 0.0, d * 0.5);
    s -= w;
    if (s < d) return vec3(x1, 0.0, d * 0.5 - s);
    s -= d;
    if (s < w) return vec3(x1 - s, 0.0, -d * 0.5);
    s -= w;
    return vec3(x0, 0.0, -d * 0.5 + s);
  }

  void main() {
    float layer = aRect.z;
    float y = (layer + 0.5) * uPitch - uHeight * 0.5 + (layer - (uLayers - 1.0) * 0.5) * uGap * uP1;

    float w = aRect.y - aRect.x;
    float per = 2.0 * w + 2.0 * uDepth;
    float t = fract(aSeed.x + uTime * 0.5 / max(per, 0.001));
    vec3 pathPos = perimeter(aRect.x, aRect.y, t);
    pathPos.y = y + (aSeed.y - 0.5) * uPitch * 0.3;

    // Act 2: layers appear in print order; heat decays with layers printed since
    float current = uP2 * uLayers;
    float printed = clamp(current - layer, 0.0, 1.0);
    float heat = printed > 0.0 ? exp(-(current - layer) / 10.0) : 0.0;

    // Act 3: move to deposit target in order; freshly deposited material is hot
    float head = uP3 * 1.02;
    float local = clamp((head - aOrder) / 0.02, 0.0, 1.0);
    float e = local * local * (3.0 - 2.0 * local);
    vec3 pos = mix(pathPos, aTarget, e);
    if (uP3 > 0.0) {
      float since = head - aOrder;
      heat = since > 0.0 ? mix(heat, 1.0 - clamp(since / 0.12, 0.0, 1.0), e) : heat * (1.0 - uP3);
    }

    vHeat = heat;
    // Material not yet re-deposited recedes while the new rows are laid down
    float source = printed * (1.0 - 0.7 * smoothstep(0.0, 0.25, uP3));
    vAlpha = mix(source, 1.0, e) * smoothstep(0.0, 0.04, uP2);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPR * (8.0 / -mv.z);
  }
`;

export const particleFragment = /* glsl */ `
  precision mediump float;
  uniform vec3 uCool;
  uniform vec3 uHot;
  uniform float uFade;
  varying float vHeat;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.3, d) * vAlpha * uFade;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(uCool, uHot, vHeat), a);
  }
`;
