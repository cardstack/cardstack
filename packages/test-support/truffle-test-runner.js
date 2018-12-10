/* eslint-disable no-process-exit */

const path = require('path');
const glob = require('glob');
const spawn = require('child_process').spawn;

function testPackage(pkg) {
  return new Promise((res, reject) => {
    let truffleBin = './node_modules/.bin/truffle';
    let proc = spawn(process.execPath, [truffleBin, 'test'], { stdio: ['ignore', process.stdout, process.stderr], cwd: pkg });
    proc.on('exit', function (code, signal) {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        if (code === 0) {
          res();
        } else {
          reject(new Error("child test suite exited with status " + code));
        }
      }
    });

    // terminate children.
    process.on('SIGINT', function () {
      proc.kill('SIGINT'); // calls runner.abort()
      proc.kill('SIGTERM'); // if that didn't work, we're probably in an infinite loop, so make it die.
    });
  });
}

async function run() {
  let packages = glob.sync(path.join(__dirname, '..', '*', 'truffle.js')).map(p => path.dirname(p));
  for (let pkg of packages) {
    process.stdout.write(`Starting truffle test suite for ${path.basename(pkg)}\n`);
    await testPackage(pkg);
  }
  process.stdout.write(`Finished truffle test suites\n`);
}

run().then(() => process.exit(0), err => {
  /* eslint-disable no-console */
  console.log(err);
  process.exit(-1);
});
