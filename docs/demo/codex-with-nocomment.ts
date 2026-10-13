export function add(a: number, b: number): number {
  // Runtime checks protect callers that bypass TypeScript types.
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new TypeError("Both inputs must be finite numbers.");
  }

  return a + b;
}

export function mean(xs: number[]): number {
  // An empty array has no arithmetic mean.
  if (xs.length === 0) {
    throw new RangeError("Cannot calculate the mean of an empty array.");
  }

  let total = 0;
  for (const x of xs) {
    if (!Number.isFinite(x)) {
      throw new TypeError("Every array element must be a finite number.");
    }
    total += x;
  }

  return total / xs.length;
}
