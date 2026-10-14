// WebGL cannot read CSS custom properties, so the scene keeps its own copy of the
// tokens it shares with tokens.css (atmosphere, terminator, node, hot) plus the
// globe-only paint from the two design renders. Night is index 0, day index 1.
export const palette = {
  oceanDark: ["#04070c", "#b9cad8"],
  oceanLit: ["#07101b", "#dce6ee"],
  land: ["#0a111b", "#ebe5d8"],
  dotDim: ["#2b3747", "#4b4842"],
  dotLit: ["#a9b8ca", "#3a3833"],
  terminator: ["#ffb46a", "#ffb46a"],
  atmosphere: ["#8fd3ff", "#7f9bb1"],
  graticule: ["#8fd3ff", "#8eabc1"],
  node: ["#ffe2a8", "#a85a12"],
  hot: ["#fff3da", "#a85a12"],
  arc: ["#8fd3ff", "#1f6fa8"],
  arcHot: ["#eef7ff", "#a85a12"],
  star: ["#d6e9ff", "#d6e9ff"],
} as const;
