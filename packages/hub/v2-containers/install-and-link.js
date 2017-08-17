const {spawn} = require('child_process');
const path = require('path');

const ROOT = '/packages';

let packages = JSON.parse(process.env.CARDSTACK_PROJECT_LINKAGES);

go();

async function go() {
  for (let p of packages) {
    await installPackage(p);
  }
  await makeLinks();
}

function makeLinks() {
  let all = [];

  for (let package of packages) {
    for (let link of package.links) {
      all.push(makeLink(package, link));
    }
  }

  return Promise.all(all);
}

async function makeLink(package, link) {
  let packagePath = `${ROOT}/${link.package}`;
  let linkPath = `${ROOT}/${package.name}/node_modules/${link.name}`;

  console.log(`Linking ${link.package} into ${package.name}`);

  await processToPromise(spawn('rm', ['-rf', linkPath]));
  await processToPromise(spawn('mkdir', ['-p', path.dirname(linkPath)]));
  return processToPromise(spawn('ln', [ '-s', packagePath, linkPath ]));
}

function processToPromise(process, msg='') {
  return new Promise(function(resolve, reject) {
    process.on('error', reject);
    process.on('exit', function(code) {
      if (code === 0) {
        resolve();
      } else {
        reject(msg + code);
      }
    });
  });
}


function installPackage(package) {
  console.log(`yarn installing for ${package.name}`);
  let p = spawn('yarn', [
      'install'
  ],{
    cwd: `${ROOT}/${package.name}`,
    stdio: 'inherit'
  });
  return processToPromise(p, 'yarn install failed with code ');
}

async function testLinking() {
  packages = [{
    name: 'thing',
    links: [
      { name: 'ding', package: '@cardstack/other' }
    ]
  }];

  await makeLinks();
}
