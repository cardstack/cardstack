module.exports = function format(v){
  if (!v) {
    return 'none';
  }
  if (typeof v === 'function') {
    v = v();
  }
  let colWidths = [];
  for (let row of v) {
    for (let [colIndex, col] of row.entries()) {
      colWidths[colIndex] = Math.max(colWidths[colIndex] || 0, String(col).length);
    }
  }
  let output = '';
  for (let row of v) {
    for (let [colIndex, col] of row.entries()) {
      let s = String(col);
      output += s;
      for (let i = s.length; i < colWidths[colIndex]; i++) {
        output += ' ';
      }
      output += ' ';
    }
    output += "\n";
  }
  return output;
};
