const path = require('path');
const glob = require('glob');
const spawn = require('child_process').spawn;
const resolve = require('resolve');

function testPackage(package) {
  return new Promise((res, reject) => {
    let emberBin = resolve.sync('ember-cli/bin/ember', { basedir: package });
    let proc = spawn(process.execPath, [emberBin, 'test'], { stdio: ['ignore', process.stdout, process.stderr], cwd: package });
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
  let packages = glob.sync(path.join(__dirname, '..', '*', 'ember-cli-build.js')).map(p => path.dirname(p));
  for (let package of packages) {
    process.stdout.write(`Starting test suite for ${path.basename(package)}\n`);
    await testPackage(package);
  }
  process.stdout.write(`Finished all test suites\n`);
}

run().then(() => process.exit(0), err => {
  /* eslint-disable no-console */
  console.log(err);
  process.exit(-1);
});
