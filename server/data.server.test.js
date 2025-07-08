const { filterArray, sortNumbers } = require('./data');

describe('Data processing functions', () => {
  test('filterArray function', () => {
    const numbers = [1, 2, 3, 4, 5];
    const evens = filterArray(numbers, n => n % 2 === 0);
    expect(evens).toEqual([2, 4]);
  });

  test('sortNumbers function', () => {
    const unsorted = [3, 1, 4, 1, 5, 9, 2, 6];
    const sorted = sortNumbers(unsorted);
    expect(sorted).toEqual([1, 1, 2, 3, 4, 5, 6, 9]);
    expect(unsorted).toEqual([3, 1, 4, 1, 5, 9, 2, 6]); // Original unchanged
  });
});