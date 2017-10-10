const child_process = require('child_process');
const {spawn} = child_process;
const path = require('path');

const tar = require('tar-stream');
const tarfs = require('tar-fs');

const log = require('@cardstack/plugin-utils/logger')('hub/build-image');

module.exports = function buildAppImage(packages) {
  let context = buildContext(packages);

  let proc = spawn('docker', [
      'build',
      '-t', 'cardstack-app',
      '-'
  ],{
    cwd: '/Users/aaron/dev/basic-cardstack',
    stdio: 'pipe'
  });

  context.pipe(proc.stdin);

  return proc;
};

function dockerfile(packages) {
  let file = [];

  file.push('FROM cardstack/hub');
  file.push('WORKDIR /hub');

  for (let pack of packages) {
    let dir = `packages/${pack.name}/`; // Don't use path.join, in case host is Windows
    let json = dir+'package.json';
    let yarn = dir+'yarn.lock?';        // Docker copy errors if a specific file exists, but is ok with a pattern matching 0 files
    let files = JSON.stringify([json, yarn, dir]);
    file.push(`COPY ${files}`);
  }

  for (let pack of packages) {
    let dir = `packages/${pack.name}`;
    file.push(`WORKDIR /hub/${dir}`);
    file.push('RUN yarn install');
    file.push('RUN yarn link');
  }

  for (let pack of packages) {
    if (pack.links.length) {
      let dir = `packages/${pack.name}`;
      let cmd = JSON.stringify(['yarn', 'link', ...pack.links]);
      file.push(`WORKDIR /hub/${dir}`);
      file.push(`RUN ${cmd}`);
    }
  }


  file.push('WORKDIR /hub');
  file.push('RUN ln -s packages/basic-cardstack app');

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
    'node',
    '/hub/app/node_modules/@cardstack/hub/bin/server.js',
    '/hub/app/cardstack/seeds/development'
  ]);
  let cmd = JSON.stringify(flags);

  file.push(`ENTRYPOINT ${entry}`);
  file.push(`CMD ${cmd}`);

  return file.join('\n');
}

function buildContext(packages) {
  let pack = tar.pack();
  pack.entry({name: 'Dockerfile'}, dockerfile(packages));

  async function packPackages() {
    for (let package of packages) {
      await packPackage(pack, package);
    }
    pack.finalize();
  }
  packPackages();

  return pack;
}


async function packPackage(pack, package) {
  return new Promise(function(resolve, reject) {
    tarfs.pack(package.path, {
      pack,
      finalize: false,
      ignore: dirs('node_modules', 'tmp', '.git'),
      map(header) {
        header.name = path.normalize(path.join('packages', package.name, header.name));
      },
      finish: resolve
    });
    pack.on('error', reject);
  });
}

function dirs() {
  let directories = [].slice.call(arguments);
  return function(x) {
    return directories.some(dir=>x.endsWith('/'+dir));
  };
}
