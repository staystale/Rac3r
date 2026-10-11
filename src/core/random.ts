export function parkMiller(state: number): () => number {
  let seed = state;
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

export function lcg(state: number): () => number {
  let reg = state;
  return () => { reg = (Math.imul(reg, 1664525) + 1013904223) >>> 0; return reg / 4294967296; };
}

export function hash2d(seed: number): (x: number, y: number) => number {
  return (x, y) => {
    let acc = (x * 374761393 + y * 668265263 + seed) | 0;
    acc = (acc ^ (acc >>> 13)) * 1274126177;
    return ((acc ^ (acc >>> 16)) >>> 0) / 4294967296;
  };
}
