/** Seed composition: a small 4/4 club groove with clearly labelled regions and two audible sliders. */
export const DEMO_PATTERN = `setcps(0.52)

stack(
  // kick
  s("bd*4").bank("RolandTR909").gain(1.1),

  // snare
  s("~ sd ~ sd").bank("RolandTR909").room(0.25).gain(0.9),

  // hats
  s("hh*8").bank("RolandTR909").gain(slider(0.5, 0, 1)).pan(sine.range(0.3, 0.7)),

  // bass
  note("<c2 c2 eb2 g1>*4").s("sawtooth").lpf(slider(600, 100, 4000)).decay(0.25).sustain(0),

  // texture / lead
  note("<c4 eb4 g4 bb4>/2").s("triangle").gain(0.35).room(0.6).delay(0.3)
)
`;
