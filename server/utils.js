function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function isEven(num) {
  return num % 2 === 0;
}

module.exports = { capitalize, isEven };