// CHANGED: Added input validation to ensure both parameters are finite numbers,
// and now throws TypeError if validation fails. Previously had no validation.
export function add(a, b) {
  // Check if 'a' is a finite number using Number.isFinite()
  // This returns false for Infinity, -Infinity, NaN, and non-numeric values
  if (!Number.isFinite(a)) {
    throw new TypeError(`First argument must be a finite number, got: ${typeof a}`);
  }

  // Check if 'b' is a finite number using the same validation logic
  if (!Number.isFinite(b)) {
    throw new TypeError(`Second argument must be a finite number, got: ${typeof b}`);
  }

  // Once both inputs are validated as finite numbers, perform the addition
  return a + b;
}

// NEW: Calculate the arithmetic mean (average) of an array of numbers
export function mean(xs: number[]): number {
  // Validate that xs is an array with at least one element
  // This prevents division by zero and ensures meaningful calculations
  if (!Array.isArray(xs) || xs.length === 0) {
    throw new TypeError("Input must be a non-empty array");
  }

  // Iterate through each element in the array and sum them all up
  // The reduce() method accumulates values: (accumulator, current) => new accumulator
  const sum = xs.reduce((acc, val) => {
    // Ensure each element is a finite number before adding
    if (!Number.isFinite(val)) {
      throw new TypeError(`All array elements must be finite numbers, got: ${typeof val}`);
    }
    // Add the current value to the accumulator
    return acc + val;
  }, 0); // Start the accumulator at 0

  // Divide the sum by the number of elements to get the arithmetic mean
  return sum / xs.length;
}
