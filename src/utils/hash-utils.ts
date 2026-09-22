/**
 * A small, stable, non-cryptographic string hash (djb2) rendered as a compact
 * base-36 token. Used to derive a per-block state key from a code block's source
 * so structurally-different blocks separate automatically while byte-identical
 * ones collide (and can be disambiguated with an explicit key).
 */
export function hashString(input: string): string {
  const DJB2_SEED = 5381;
  const DJB2_MULTIPLIER = 33;
  const BASE36 = 36;
  let hash = DJB2_SEED;
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(hash, DJB2_MULTIPLIER) + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(BASE36);
}
