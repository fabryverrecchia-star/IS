// Per-tile shader: cover-fit texturing + a "magnet" vertex ripple that
// leans the mesh surface toward the cursor when hovered.

export const vertexShader = /* glsl */ `
  uniform vec2 uHoverPoint;     // cursor position in local uv-space, centered (-0.5..0.5)
  uniform float uHoverStrength; // eased 0..1
  uniform vec2 uPlaneSize;      // plane width/height in world units

  varying vec2 vUv;
  varying float vHoverStrength;

  void main() {
    vUv = uv;
    vHoverStrength = uHoverStrength;

    vec2 local = uv - 0.5;
    vec2 toCursor = uHoverPoint - local;
    float dist = length(toCursor);

    // Magnet pull: vertices near the cursor lean toward it, fading out smoothly.
    float falloff = smoothstep(0.62, 0.0, dist);
    vec2 pull = toCursor * falloff * uHoverStrength * 0.4 * uPlaneSize;

    vec3 pos = position;
    pos.xy += pull;
    pos.z += falloff * uHoverStrength * 32.0;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

export const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uPlaneAspect;
  uniform float uImageAspect;
  uniform float uHoverStrength;
  uniform float uIsVideo;
  uniform float uRevealProgress; // 0..1 load-in reveal

  varying vec2 vUv;
  varying float vHoverStrength;

  void main() {
    // object-fit: cover
    float ratioX = min(uPlaneAspect / uImageAspect, 1.0);
    float ratioY = min(uImageAspect / uPlaneAspect, 1.0);
    vec2 uv = vec2(
      vUv.x * ratioX + (1.0 - ratioX) * 0.5,
      vUv.y * ratioY + (1.0 - ratioY) * 0.5
    );

    vec4 tex = texture2D(uMap, uv);

    // gentle brighten + lift on hover
    tex.rgb += vHoverStrength * 0.06;
    tex.rgb = mix(tex.rgb, tex.rgb * 1.08, vHoverStrength);

    // soft vignette so tiles read as cards, not flat rectangles
    vec2 c = vUv - 0.5;
    float vig = smoothstep(0.72, 0.35, length(c));
    tex.rgb *= mix(0.86, 1.0, vig + vHoverStrength * 0.2);

    // load-in reveal: wipe + fade
    float reveal = step(vUv.y, uRevealProgress + 0.001);
    float edge = smoothstep(uRevealProgress - 0.08, uRevealProgress, vUv.y);
    float alpha = uRevealProgress >= 0.999 ? 1.0 : reveal;
    tex.rgb *= mix(1.0, 0.0, edge * (1.0 - reveal));

    // video badge: small triangle-in-circle, bottom-left corner
    if (uIsVideo > 0.5) {
      vec2 badgeCenter = vec2(0.09, 0.1);
      vec2 bp = (vUv - badgeCenter);
      bp.x *= uPlaneAspect;
      float r = length(bp);
      float ring = smoothstep(0.052, 0.046, r) - smoothstep(0.046, 0.04, r) * 0.0;
      float disc = smoothstep(0.05, 0.046, r);
      vec3 badgeColor = vec3(1.0);
      float glow = smoothstep(0.09, 0.05, r) * 0.35;
      tex.rgb = mix(tex.rgb, vec3(0.05), glow * 0.5);
      tex.rgb = mix(tex.rgb, badgeColor, disc * 0.92);

      // play triangle: signed-area edge test against 3 vertices, offset
      // slightly right of center so it looks optically centered in the disc
      vec2 tp = bp - vec2(0.004, 0.0);
      vec2 pA = vec2(-0.016, 0.02);
      vec2 pB = vec2(-0.016, -0.02);
      vec2 pC = vec2(0.022, 0.0);
      float eAB = (pB.x - pA.x) * (tp.y - pA.y) - (pB.y - pA.y) * (tp.x - pA.x);
      float eBC = (pC.x - pB.x) * (tp.y - pB.y) - (pC.y - pB.y) * (tp.x - pB.x);
      float eCA = (pA.x - pC.x) * (tp.y - pC.y) - (pA.y - pC.y) * (tp.x - pC.x);
      float tri = step(0.0, eAB) * step(0.0, eBC) * step(0.0, eCA);
      tex.rgb = mix(tex.rgb, vec3(0.06, 0.06, 0.08), tri * disc);
    }

    gl_FragColor = vec4(tex.rgb, alpha);
  }
`
