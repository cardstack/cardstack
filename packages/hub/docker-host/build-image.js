const child_process = require('child_process');
const {spawn} = child_process;

const Dockerfile = require('dockerfile').Dockerfile;

module.exports = async function buildAppImage() {
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

  await new Promise(function(resolve, reject) {
    proc.on('error', reject);
    proc.on('exit', resolve);
  });
}
