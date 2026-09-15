// Per-tile shader: cover-fit texturing + a subtle "magnet" vertex ripple
// that leans the mesh surface toward the cursor when hovered.

export const vertexShader = /* glsl */ `
  uniform vec2 uHoverPoint;     // cursor position in local uv-space, centered (-0.5..0.5)
  uniform float uHoverStrength; // eased 0..1
  uniform vec2 uPlaneSize;      // plane width/height in world units

  varying vec2 vUv;

  void main() {
    vUv = uv;

    vec2 local = uv - 0.5;
    vec2 toCursor = uHoverPoint - local;
    float dist = length(toCursor);

    // Magnet pull: vertices near the cursor lean toward it, fading out smoothly.
    float falloff = smoothstep(0.62, 0.0, dist);
    vec2 pull = toCursor * falloff * uHoverStrength * 0.16 * uPlaneSize;

    vec3 pos = position;
    pos.xy += pull;
    pos.z += falloff * uHoverStrength * 10.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

export const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uPlaneAspect;
  uniform float uImageAspect;
  uniform float uRevealProgress; // 0..1 load-in reveal
  uniform float uDim;            // 0..1, dims tiles not in focus (detail view open)

  varying vec2 vUv;

  void main() {
    // object-fit: cover
    float ratioX = min(uPlaneAspect / uImageAspect, 1.0);
    float ratioY = min(uImageAspect / uPlaneAspect, 1.0);
    vec2 uv = vec2(
      vUv.x * ratioX + (1.0 - ratioX) * 0.5,
      vUv.y * ratioY + (1.0 - ratioY) * 0.5
    );

    vec4 tex = texture2D(uMap, uv);

    // load-in reveal: wipe + fade
    float reveal = step(vUv.y, uRevealProgress + 0.001);
    float edge = smoothstep(uRevealProgress - 0.08, uRevealProgress, vUv.y);
    float alpha = uRevealProgress >= 0.999 ? 1.0 : reveal;
    tex.rgb *= mix(1.0, 0.0, edge * (1.0 - reveal));

    // fade everything but the tile open in detail view back into the white page
    tex.rgb = mix(tex.rgb, vec3(0.97), uDim * 0.9);

    gl_FragColor = vec4(tex.rgb, alpha);
  }
`
