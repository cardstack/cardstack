const child_process = require('child_process');
const {spawn} = child_process;
const path = require('path');

const tar = require('tar-stream');
const tarfs = require('tar-fs');

const log = require('@cardstack/plugin-utils/logger')('hub/build-image');

module.exports = function buildAppImage(packages, appName) {
  let context = buildContext(packages, appName);

  let proc = spawn('docker', [
      'build',
      '--label', 'com.cardstack',
      '-t', appName,
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

function buildContext(packages, appName) {
  let archive = tar.pack();
  archive.entry({name: 'Dockerfile'}, dockerfile(packages, appName));

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
      ignore: dirs('node_modules', 'tmp', '.git'),
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
    return directories.some(dir=>x.endsWith('/'+dir));
  };
}


function dockerfile(packages, appName) {
  let file = [];

  file.push('FROM cardstack/hub:alpha');
  file.push('WORKDIR /hub');

  file.push(`RUN ln -s packages/${appName} app`);

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

  // install all dependencies
  for (let pack of packages) {
    let dir = `packages/${pack.name}`;
    file.push(`WORKDIR /hub/${dir}`);
    file.push('RUN yarn install');
    file.push('RUN yarn link');
  }

  // link modules together as they are on the host
  for (let pack of packages) {
    if (pack.links.length) {
      let dir = `packages/${pack.name}`;
      let cmd = JSON.stringify(['yarn', 'link', ...pack.links]);
      file.push(`WORKDIR /hub/${dir}`);
      file.push(`RUN ${cmd}`);
    }
  }


  file.push('WORKDIR /hub');

  for (let pack of packages) {
    let dir = `packages/${pack.name}/`;
    file.push(`COPY ${dir} ${dir}`);
  }

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
