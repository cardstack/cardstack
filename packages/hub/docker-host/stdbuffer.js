// Should probably add tracking of whether the streams have
// closed, but I don't really need it yet.

function StdBuffer({ stdout, stderr }) {
  this._out_chunks = [];
  this._err_chunks = [];
  stdout.on('data', chunk => this._out_chunks.push(chunk));
  stderr.on('data', chunk => this._err_chunks.push(chunk));
}

Object.defineProperty(StdBuffer.prototype, 'out', {
  get() {
    return Buffer.concat(this._out_chunks).toString();
  },
});

Object.defineProperty(StdBuffer.prototype, 'err', {
  get() {
    return Buffer.concat(this._err_chunks).toString();
  },
});

module.exports = StdBuffer;
