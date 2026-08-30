export const SHIELD_BLOCK_FLASH_HUES = [192, 146, 215, 272, 49] as const;

export function randomShieldBlockFlashColour(
  random: () => number = Math.random,
): string {
  const sample = Math.max(0, Math.min(0.999999, random()));
  const hue =
    SHIELD_BLOCK_FLASH_HUES[
      Math.floor(sample * SHIELD_BLOCK_FLASH_HUES.length)
    ];

  return `hsla(${hue} 92% 63% / 0.42)`;
}
