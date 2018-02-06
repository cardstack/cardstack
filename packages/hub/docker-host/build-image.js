const child_process = require('child_process');
const {spawn} = child_process;
const path = require('path');
const tar = require('tar-stream');
const tarfs = require('tar-fs');
const log = require('@cardstack/logger')('cardstack/hub/build-image');

exports.buildAppImage = function buildAppImage(packages, appName) {
  let context = buildContext(packages, dockerfile(packages, appName));

  let proc = spawn('docker', [
      'build',
      '--label', 'com.cardstack',
      '-t', appName,
      '-'
  ]);

  context.pipe(proc.stdin);

  return proc;
};

exports.buildBaseImage = function buildBaseImage(packages) {
  let context = buildContext(packages, baseDockerfile(packages));
  let proc = spawn('docker', [
      'build',
      '--label', 'com.cardstack',
      '-t', 'cardstack/hub',
      '-'
  ]);

  context.pipe(proc.stdin);
  return proc;
};


// Creates the context for the docker build.
// It contains the Dockerfile, and a folder for each linked module:
//
// - Dockerfile
// - packages
//   - basic-cardstack
//     - package.json
//     - ...
//   - @cardstack
//     - hub
//       - package.json
//       - ...
//     - codgen
//       - ...

function buildContext(packages, dockerfileContents) {
  let archive = tar.pack();
  archive.entry({name: 'Dockerfile'}, dockerfileContents);

  async function archivePackages() {
    for (let package of packages) {
      await archivePackage(archive, package);
    }
    archive.finalize();
  }
  archivePackages();

  return archive;
}


async function archivePackage(archive, package) {
  return new Promise(function(resolve, reject) {
    tarfs.pack(package.path, {
      pack: archive,
      finalize: false,
      ignore: dirs('node_modules', 'tmp', '.git', '.node_modules.ember-try', 'dist'),
      map(header) {
        header.name = path.normalize(path.join('packages', package.name, header.name));
      },
      finish: resolve
    });
    archive.on('error', reject);
  });
}

function dirs() {
  let directories = [].slice.call(arguments);
  return function(x) {
    let base = path.basename(x);
    return directories.includes(base);
  };
}

function copyDependencies(packages, file) {
  // copy in only package.json/yarn.lock at first.
  // This means normal code changes won't invalidate the long
  // yarn install step in the docker build cache
  for (let pack of packages) {
    let dir = `packages/${pack.name}/`; // Don't use path.join, in case host is Windows
    let json = dir+'package.json';
    let yarn = dir+'yarn.loc[k]';        // COPY errors out if a directly specified file is missing, but is ok with a pattern matching 0 files
    let files = JSON.stringify([json, yarn, dir]);
    file.push(`COPY ${files}`);
  }
}

function copyContents(packages, file) {
  for (let pack of packages) {
    // this relies on the fact that node_modules was already excluded
    // when we built the docker context
    let dir = `packages/${pack.name}/`;
    file.push(`COPY ${dir} ${dir}`);
  }
}

function baseDockerfile(packages) {
  let file = [];

  file.push('FROM node:8.6');
  file.push('WORKDIR /hub');
  file.push('RUN curl "https://download.docker.com/linux/static/stable/x86_64/docker-17.09.0-ce.tgz" | tar -xz -C /usr/local/bin --strip-components=1 docker/docker');
  file.push('RUN yarn global add lerna@2.4.0');
  file.push('COPY packages/@cardstack/hub/docker-host/internal-lerna.json lerna.json');
  file.push('COPY packages/@cardstack/hub/docker-host/internal-package.json package.json');
  file.push('COPY packages/@cardstack/hub/docker-host/internal-yarnrc .yarnrc');

  copyDependencies(packages, file);
  file.push(`RUN lerna bootstrap`);
  copyContents(packages, file);
  return file.join('\n');
}

// handle our own app last because it's the most likely to have
// changes, so we can get better build cache reuse if it's at the end
function makeAppLast(packages, appName) {
  let entry = packages.find(package => package.name === appName);
  if (entry) {
    let index = packages.indexOf(entry);
    return packages.slice(0, index).concat(packages.slice(index+1, packages.length)).concat([entry]);
  } else {
    return packages;
  }
}


function dockerfile(packages, appName) {
  packages = makeAppLast(packages, appName);

  let file = [];

  file.push('FROM cardstack/hub:latest');

  file.push(`RUN ln -s packages/${appName} app`);

  copyDependencies(packages, file);
  file.push(`RUN lerna bootstrap`);
  copyContents(packages, file);

  file.push('WORKDIR /hub/app');

  file.push('ENV ELASTICSEARCH=http://elasticsearch:9200 DEBUG=cardstack/*');

  let flags = ['--allow-dev-dependencies', '--containerized'];
  if (process.env.CARDSTACK_LEAVE_SERVICES) {
    log.info('Will leave docker services running after exit');
    flags.push('--leave-services-running');
  }

  let entry = JSON.stringify([
    'npx',
    '--no-install',
    'cardstack-hub',
    '/hub/app/cardstack/seeds/development'
  ]);
  let cmd = JSON.stringify(flags);

  file.push(`ENTRYPOINT ${entry}`);
  file.push(`CMD ${cmd}`);

  return file.join('\n');
}
