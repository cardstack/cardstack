const archiver = require('archiver');

module.exports = function(outputStream, fn) {
  return new Promise((resolve, reject) => {
    let archive = archiver('zip', {
      zlib: { level: 9 }
    });

    outputStream.on('close', function() {
      resolve();
    });

    archive.on('error', function(err) {
      reject(err);
    });

    archive.pipe(outputStream);
    fn(archive);
    archive.finalize();
  });
};
