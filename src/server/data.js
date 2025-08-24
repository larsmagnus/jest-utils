export function filterArray(arr, predicate) {
  return arr.filter(predicate)
}

export function sortNumbers(arr) {
  return [...arr].sort((a, b) => a - b)
}
