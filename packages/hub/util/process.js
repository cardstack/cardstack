module.exports = {
  waitForExit(child_proc) {
    return new Promise(function(resolve, reject) {
      child_proc.on('error', reject);
      child_proc.on('exit', resolve);
    });
  },
};
