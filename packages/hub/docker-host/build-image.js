const child_process = require('child_process');
const {spawn} = child_process;
const path = require('path');

const Dockerfile = require('dockerfilejs').Dockerfile;
const tar = require('tar-stream');
const tarfs = require('tar-fs');

const log = require('@cardstack/plugin-utils/logger')('hub/build-image');

module.exports = function buildAppImage(packages) {
  let tarlist = spawn('tar', ['-t']);
  let context = buildContext(packages);
  context.pipe(tarlist.stdin);
  // let tarpack = spawn('tar', ['-c', 'package.json']);
  // tarpack.stdout.pipe(tarlist.stdin);

  return tarlist;

  let proc = spawn('docker', [
      'build',
      '-t', 'cardstack-app',
      '-f', '-',
      '.'
  ],{
    cwd: '/Users/aaron/dev/basic-cardstack',
    stdio: 'pipe'
  });


  let file = new Dockerfile();

  let flags = ['--allow-dev-dependencies', '--containerized'];
  if (process.env.CARDSTACK_LEAVE_SERVICES) {
    log.info('Will leave docker services running after exit');
    flags.push('--leave-services-running');
  }

  file.from('cardstack/hub')
    .workdir('/hub/app')
    .copy({src: ['package.json', 'yarn.lock'], dest: '/hub/app/'})
    .run('yarn install --frozen-lockfile')
    .copy({src: '.', dest: '/hub/app'})
    .env({
      ELASTICSEARCH: 'http://elasticsearch:9200',
      DEBUG: 'cardstack/*'
    })
    .cmd({command:'node', params: [
      '/hub/app/node_modules/@cardstack/hub/bin/server.js',
      '/hub/app/cardstack/seeds/development',
      ...flags
    ]});

  proc.stdin.end(file.render());

  return proc;
}

// create the Dockerfile
// create the context
// run the docker build
// return process for the 

function dockerfile(packages) {
  let file = new Dockerfile();

  let flags = ['--allow-dev-dependencies', '--containerized'];
  if (true /*process.env.CARDSTACK_LEAVE_SERVICES*/) {
    log.info('Will leave docker services running after exit');
    flags.push('--leave-services-running');
  }

  file.from('cardstack/hub')
    .workdir('/hub')
    .copy({src: ['app', 'packages'], dest: '.'})
    .cmd({command:'sh'});

  return file.render();
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
    })
    pack.on('error', reject);
  });
}

function dirs() {
  let directories = [].slice.call(arguments);
  return function(x) {
    return directories.some(dir=>x.endsWith('/'+dir));
  }
}
