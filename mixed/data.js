function filterArray(arr, predicate) {
  return arr.filter(predicate)
}

function sortNumbers(arr) {
  return [...arr].sort((a, b) => a - b)
}

module.exports = { filterArray, sortNumbers }
