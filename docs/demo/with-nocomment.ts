export function add(a: number, b: number): number {
  // Finite validation required because NaN and Infinity are technically numbers in JS
  if (!Number.isFinite(a)) {
    throw new TypeError(`Expected 'a' to be a finite number, got ${typeof a === 'number' ? 'Infinity or NaN' : typeof a}`);
  }

  if (!Number.isFinite(b)) {
    throw new TypeError(`Expected 'b' to be a finite number, got ${typeof b === 'number' ? 'Infinity or NaN' : typeof b}`);
  }

  return a + b;
}

export function mean(xs: number[]): number {
  // Empty array has no meaningful mean
  if (xs.length === 0) {
    throw new Error('Cannot calculate mean of an empty array');
  }

  return xs.reduce((sum, current) => sum + current, 0) / xs.length;
}
