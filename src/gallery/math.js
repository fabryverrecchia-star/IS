export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

// Framerate-independent exponential smoothing ("damp"), per Freya Holmér.
export function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}
