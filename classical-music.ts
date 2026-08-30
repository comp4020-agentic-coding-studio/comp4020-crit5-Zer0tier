export const CLASSICAL_PIANO_BPM = 94;
export const PIANO_STEPS_PER_BEAT = 2;
export const CLASSICAL_PIANO_STEP_MILLISECONDS =
  60_000 / CLASSICAL_PIANO_BPM / PIANO_STEPS_PER_BEAT;
export const CLASSICAL_PIANO_PATTERN_LENGTH = 64;

export interface PianoMelodyNote {
  midi: number;
  durationSteps: number;
}

export interface PianoVoicing {
  bass: number | null;
  harmony: number;
  melody: PianoMelodyNote | null;
}

const harmony = [
  { bass: 45, notes: [57, 60, 64] }, // A minor
  { bass: 41, notes: [53, 57, 60] }, // F major
  { bass: 36, notes: [48, 52, 55] }, // C major
  { bass: 43, notes: [55, 59, 62] }, // G major
  { bass: 38, notes: [50, 53, 57] }, // D minor
  { bass: 45, notes: [57, 60, 64] }, // A minor
  { bass: 40, notes: [52, 56, 59] }, // E major
  { bass: 45, notes: [57, 60, 64] }, // A minor
] as const;

const arpeggioOrder = [0, 1, 2, 1, 0, 2, 1, 2] as const;
const note = (midi: number, durationSteps = 1): PianoMelodyNote => ({
  midi,
  durationSteps,
});

const melody: ReadonlyArray<PianoMelodyNote | null> = [
  note(76, 2), null, note(81, 2), null, note(84, 2), null, note(83), note(81),
  note(81, 2), null, note(84, 2), null, note(88, 2), null, note(86), note(84),
  note(79, 2), null, note(88, 2), null, note(86, 2), null, note(84), note(83),
  note(83, 2), null, note(86, 2), null, note(91, 4), null, null, null,
  note(77, 2), null, note(81, 2), null, note(86, 2), null, note(84), note(81),
  note(76, 2), null, note(81, 2), null, note(84, 2), null, note(83), note(81),
  note(80, 2), null, note(83, 2), null, note(88, 2), null, note(86), note(83),
  note(81, 2), null, note(84, 2), null, note(88, 2), null, note(84), note(81, 5),
];

export function midiNoteFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function classicalPianoVoicing(stepIndex: number): PianoVoicing {
  const step =
    ((Math.floor(stepIndex) % CLASSICAL_PIANO_PATTERN_LENGTH) +
      CLASSICAL_PIANO_PATTERN_LENGTH) %
    CLASSICAL_PIANO_PATTERN_LENGTH;
  const bar = Math.floor(step / 8);
  const stepInBar = step % 8;
  const chord = harmony[bar];

  return {
    bass:
      stepInBar === 0
        ? chord.bass
        : stepInBar === 4
          ? chord.bass + 7
          : null,
    harmony: chord.notes[arpeggioOrder[stepInBar]],
    melody: melody[step],
  };
}
