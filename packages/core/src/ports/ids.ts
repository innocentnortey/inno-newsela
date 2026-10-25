import { randomBytes } from "node:crypto";
import type { IdPrefix } from "@ls/schema/ids";

export type { IdPrefix };

export interface IdGenerator {
  new_id(prefix: IdPrefix): string;
}

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const MAX_RAND = 2n ** 80n - 1n;

function draw(random: (bytes: number) => Uint8Array): bigint {
  let v = 0n;
  for (const b of random(10)) v = (v << 8n) | BigInt(b);
  return v;
}

function encode(value: bigint): string {
  let out = "";
  for (let i = 25; i >= 0; i--) out += ALPHABET[Number((value >> BigInt(i * 5)) & 31n)];
  return out;
}

// "<prefix>_<ulid>": 26 Crockford characters, time first, strictly increasing within one process.
export class PrefixedIdGenerator implements IdGenerator {
  private readonly now: () => number;
  private readonly random: (bytes: number) => Uint8Array;
  private last_ms = -1;
  private last_rand = 0n;

  constructor(opts: { now?: () => number; random?: (bytes: number) => Uint8Array } = {}) {
    this.now = opts.now ?? Date.now;
    this.random = opts.random ?? ((n) => randomBytes(n));
  }

  new_id(prefix: IdPrefix): string {
    let ms = Math.max(this.now(), this.last_ms);
    let rand: bigint;
    if (ms === this.last_ms) {
      rand = this.last_rand + 1n;
      if (rand > MAX_RAND) {
        ms = this.last_ms + 1;
        rand = draw(this.random);
      }
    } else {
      rand = draw(this.random);
    }
    this.last_ms = ms;
    this.last_rand = rand;
    return `${prefix}_${encode((BigInt(ms) << 80n) | rand)}`;
  }
}
