// GLSL for the globe. Every shader mixes its night and day look by uDay so the
// theme switch is one 600 ms uniform tween, and fades in by uExposure for the intro.

export const sphereVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vObject;
varying vec3 vView;
void main() {
  vObject = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const sphereFragment = /* glsl */ `
uniform float uDay;
uniform float uExposure;
uniform float uLandOn;
uniform vec3 uSun;
uniform sampler2D uLand;
uniform vec3 uOceanDark0;
uniform vec3 uOceanLit0;
uniform vec3 uLand0;
uniform vec3 uOceanDark1;
uniform vec3 uOceanLit1;
uniform vec3 uLand1;
uniform vec3 uTerminator;
uniform vec3 uAtmosphere0;
uniform vec3 uAtmosphere1;
uniform vec3 uGraticule1;
varying vec3 vNormalW;
varying vec3 vObject;
varying vec3 vView;
const float PI = 3.14159265;
void main() {
  vec3 n = normalize(vNormalW);
  vec3 v = normalize(vView);
  vec3 p = normalize(vObject);
  float lat = asin(clamp(p.y, -1.0, 1.0));
  float lon = atan(p.x, p.z);
  float land = texture2D(uLand, vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5)).r * uLandOn;
  float light = dot(n, uSun);
  float facing = clamp(dot(n, v), 0.0, 1.0);

  vec3 night = mix(uOceanDark0, uOceanLit0, smoothstep(-0.2, 0.9, light));
  night = mix(night, uLand0 + night * 0.6, land * 0.6);
  float bandX = (light - 0.02) / 0.16;
  float band = exp(-bandX * bandX);
  night += uTerminator * band * 0.1;
  float rim = pow(1.0 - facing, 4.0);
  night += uAtmosphere0 * rim * (0.1 + 0.9 * smoothstep(-0.3, 0.7, light)) * 0.55;

  float shade = 0.86 + 0.14 * smoothstep(-0.6, 0.9, dot(n, normalize(vec3(-0.45, 0.6, 0.65))));
  vec3 day = mix(uOceanDark1, uOceanLit1, pow(facing, 0.55));
  day = mix(day, uLand1, land);
  vec2 grid = vec2(lon, lat) * (180.0 / PI) / 15.0;
  vec2 width = fwidth(grid);
  vec2 distance = abs(fract(grid - 0.5) - 0.5) / max(width, vec2(1e-4));
  float line = 1.0 - min(min(distance.x, distance.y), 1.0);
  day = mix(day, uGraticule1, line * 0.6);
  day *= shade;
  day = mix(day, uAtmosphere1, pow(1.0 - facing, 5.0) * 0.4);

  gl_FragColor = vec4(mix(night, day, uDay), uExposure);
}`;

export const dotsVertex = /* glsl */ `
attribute float aSeed;
uniform float uSize;
uniform float uScale;
uniform float uDay;
uniform vec3 uSun;
uniform float uMaxSize;
varying float vLight;
varying float vFacing;
varying float vSize;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(world.xyz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
  vLight = dot(n, uSun);
  vFacing = dot(n, normalize(cameraPosition - world.xyz));
  vec4 view = viewMatrix * world;
  float lit = smoothstep(-0.25, 0.5, vLight);
  float size = uSize * mix(mix(0.78, 1.14, lit), 1.0, uDay) * (0.9 + 0.2 * aSeed);
  // Capped so a close dive keeps a crisp halftone instead of soft discs.
  vSize = min(size * uScale / -view.z, uMaxSize);
  gl_PointSize = vSize;
  gl_Position = projectionMatrix * view;
}`;

export const dotsFragment = /* glsl */ `
uniform float uDay;
uniform float uExposure;
uniform vec3 uDim0;
uniform vec3 uLit0;
uniform vec3 uTerminator;
uniform vec3 uDot1;
varying float vLight;
varying float vFacing;
varying float vSize;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float edge0 = max(0.5 - 1.6 / max(vSize, 1.0), 0.28);
  float alpha = 1.0 - smoothstep(edge0, 0.5, d);
  if (alpha < 0.02) discard;
  vec3 night = mix(uDim0, uLit0, smoothstep(-0.1, 0.6, vLight));
  float bandX = (vLight + 0.02) / 0.13;
  float band = exp(-bandX * bandX);
  night = mix(night, uTerminator, band * 0.9);
  vec3 color = mix(night, uDot1, uDay);
  float rim = smoothstep(0.0, 0.2, vFacing);
  gl_FragColor = vec4(color, alpha * rim * mix(0.95, 0.85, uDay) * uExposure);
}`;

export const atmosphereVertex = /* glsl */ `
varying vec3 vNormalW;
varying vec3 vView;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const atmosphereFragment = /* glsl */ `
uniform float uDay;
uniform float uExposure;
uniform float uBreath;
uniform float uThickness;
uniform vec3 uSun;
uniform vec3 uAtmosphere0;
uniform vec3 uAtmosphere1;
varying vec3 vNormalW;
varying vec3 vView;
void main() {
  float f = -dot(normalize(vNormalW), normalize(vView));
  float glow = pow(clamp(f / uThickness, 0.0, 1.0), 3.2);
  float sun = 0.12 + 1.1 * smoothstep(-0.5, 0.8, dot(normalize(vNormalW), uSun));
  float night = glow * sun * uBreath;
  float day = pow(clamp(f / uThickness, 0.0, 1.0), 5.0) * 0.32;
  vec3 color = mix(uAtmosphere0, uAtmosphere1, uDay);
  gl_FragColor = vec4(color, mix(night, day, uDay) * uExposure);
}`;

export const flareVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const flareFragment = /* glsl */ `
uniform float uStrength;
uniform vec3 uTerminator;
varying vec2 vUv;
void main() {
  vec2 p = vUv - 0.5;
  float r2 = dot(p, p);
  float core = exp(-r2 * 1400.0);
  float glow = exp(-r2 * 60.0) * 0.4 + exp(-r2 * 12.0) * 0.12;
  float streak = exp(-abs(p.y) * 220.0) * exp(-abs(p.x) * 6.0) * 0.7;
  vec3 color = mix(mix(uTerminator, vec3(0.86, 0.94, 1.0), 0.55), vec3(1.0), clamp(core, 0.0, 1.0));
  gl_FragColor = vec4(color, clamp(core + glow + streak, 0.0, 1.0) * uStrength);
}`;

export const starsVertex = /* glsl */ `
attribute float aSeed;
attribute float aSize;
uniform float uPixelRatio;
uniform float uTime;
uniform float uTwinkle;
varying float vAlpha;
void main() {
  float wave = sin(uTime * (0.5 + aSeed * 1.7) + aSeed * 37.0);
  vAlpha = (0.45 + 0.55 * aSeed) * (1.0 - uTwinkle * 0.35 * (0.5 + 0.5 * wave));
  gl_PointSize = aSize * uPixelRatio;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const starsFragment = /* glsl */ `
uniform float uFade;
uniform vec3 uStar;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = 1.0 - smoothstep(0.1, 0.5, d);
  gl_FragColor = vec4(uStar, alpha * vAlpha * uFade);
}`;

export const nodesVertex = /* glsl */ `
attribute float aSize;
attribute float aLit;
attribute float aLitFrom;
attribute float aSelected;
attribute float aBorn;
uniform float uTime;
uniform float uLitTime;
uniform float uPixelRatio;
uniform float uZoom;
varying float vLit;
varying float vSelected;
varying float vBorn;
varying float vFacing;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(world.xyz - (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
  vFacing = dot(n, normalize(cameraPosition - world.xyz));
  vLit = mix(aLitFrom, aLit, smoothstep(0.0, 0.24, uTime - uLitTime));
  vSelected = aSelected;
  vBorn = clamp((uTime - aBorn) / 0.8, 0.0, 1.0);
  float grow = 1.0 - pow(1.0 - vBorn, 3.0);
  float size = (12.0 + 20.0 * aSize) * mix(1.0, 2.3, aSelected) * max(grow, 0.001);
  gl_PointSize = size * uPixelRatio * uZoom;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const nodesFragment = /* glsl */ `
uniform float uDay;
uniform float uExposure;
uniform float uDim;
uniform vec3 uNode0;
uniform vec3 uHot0;
uniform vec3 uNode1;
varying float vLit;
varying float vSelected;
varying float vBorn;
varying float vFacing;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float coreRadius = mix(0.26, 0.24, vSelected);
  float core = 1.0 - smoothstep(coreRadius * 0.7, coreRadius, d);
  float halo = exp(-d * d * mix(7.0, 4.5, vSelected)) * mix(0.5, 0.75, vSelected);
  float ring = 0.0;
  if (vBorn < 1.0) {
    float wave = fract(vBorn * 2.0);
    float ringX = (d - (0.3 + 0.65 * wave)) / 0.06;
    ring = exp(-ringX * ringX) * (1.0 - wave) * (1.0 - vBorn);
  }
  vec3 night = mix(uNode0, uHot0, max(core * 0.7, vSelected));
  vec3 color = mix(night, uNode1, uDay);
  float dayHalo = mix(halo, halo * 0.55, uDay);
  float focus = mix(uDim, 1.0, vSelected);
  float alpha = (core + dayHalo + ring) * mix(0.32, 1.0, vLit) * focus;
  alpha *= smoothstep(-0.02, 0.12, vFacing) * uExposure;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}`;

export const arcsVertex = /* glsl */ `
attribute float aT;
attribute float aLit;
attribute float aLitFrom;
attribute float aHot;
attribute float aSeed;
attribute float aOrder;
attribute float aBorn;
varying float vT;
varying float vLit;
varying float vHot;
varying float vSeed;
varying float vOrder;
varying float vBorn;
varying float vFacing;
uniform float uTime;
uniform float uLitTime;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vFacing = abs(dot(n, normalize(cameraPosition - world.xyz)));
  vT = aT;
  vLit = mix(aLitFrom, aLit, smoothstep(0.0, 0.24, uTime - uLitTime));
  vHot = aHot;
  vSeed = aSeed;
  vOrder = aOrder;
  vBorn = aBorn;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

export const arcsFragment = /* glsl */ `
uniform float uTime;
uniform float uIntro;
uniform float uHotTime;
uniform float uRestart;
uniform float uPackets;
uniform float uPacketsAll;
uniform float uFocus;
uniform float uDim;
uniform float uDay;
uniform float uExposure;
uniform vec3 uArc0;
uniform vec3 uArcHot0;
uniform vec3 uArc1;
uniform vec3 uArcHot1;
varying float vT;
varying float vLit;
varying float vHot;
varying float vSeed;
varying float vOrder;
varying float vBorn;
varying float vFacing;
void main() {
  float draw = clamp((uIntro - 2.4 - vOrder) / 0.6, 0.0, 1.0);
  draw = min(draw, clamp((uTime - vBorn) / 0.8, 0.0, 1.0));
  if (vT > draw) discard;
  float core = pow(vFacing, 1.4);
  float hot = vHot * smoothstep(0.08, 0.4, uTime - uHotTime);
  float base = mix(0.32, 1.0, vLit) * 0.6;
  base *= mix(1.0, 0.32, uFocus * (1.0 - vHot) * smoothstep(0.08, 0.4, uTime - uHotTime));
  float head = fract((uTime - uRestart) * 0.32 + vSeed) * 1.45;
  float behind = head - vT;
  float trail = behind >= 0.0 && behind < 0.3 ? pow(1.0 - behind / 0.3, 2.6) : 0.0;
  float packet = trail * uPackets * mix(uPacketsAll * 0.25, 1.0, step(0.9, vLit));
  vec3 arc = mix(uArc0, uArc1, uDay);
  vec3 arcHot = mix(uArcHot0, uArcHot1, uDay);
  vec3 color = mix(arc, arcHot, clamp(hot + packet * 1.2, 0.0, 1.0));
  float alpha = (base + hot * 0.9 + packet * 1.4) * core * uDim * uExposure;
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
}`;
