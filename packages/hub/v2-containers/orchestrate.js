const {
  spawn
} = require('child_process');

// const PROJECT_NAME = process.env.CARDSTACK_PROJECT_NAME;
const PROJECT_NAME = "project-name";

// let packages = JSON.parse(process.env.CARDSTACK_PROJECT_LINKAGES);
let packages = [{
  name: 'minimal-cardstack',
  path: '/Users/aaron/dev/minimal-cardstack',
  links: [
    { name: '@cardstack/hub', package: '@cardstack/hub' }
  ]
},{
  name: '@cardstack/hub',
  path: '/Users/aaron/dev/cardstack/packages/hub',
  links: []
}]

go();

async function go() {
  try {
    let packs = await withVolumes(packages);
    await installAndLink(packs);
    await launchServer(packs);
  } catch (e) {
    console.error('ehhh');
  }
}

function launchServer(packages) {
  let mounts = mountsForPackageList(packages);

  let p = spawn('docker', [
      'run',
      ...mounts,
      '--mount', `type=bind,src=${process.env.CARDSTACK_SEED_DIRECTORY},dst=/hub/seeds`,
      '--env', `CARDSTACK_SESSIONS_KEY=${process.env.CARDSTACK_SESSIONS_KEY}`,
      '--detach',
      'cardstack/hub',
      'node', '/hub/src/bin/server.js',
      '/hub/seeds', '--allow-dev-dependencies'
  ]);
}

function mountsForPackageList(packages) {
  let mounts = [];
  for (let p of packages) {
    mounts.push('--mount', `type=bind,src=${p.path},dst=/packages/${p.name}`);
    mounts.push('--mount', `type=volume,src=${p.volumeName},dst=/packages/${p.name}/node_modules`);
  }
  return mounts;
}


/*
 * Creates a container to do all yarn installing and linking between
 * packages.
 */
function installAndLink(packages) {
  let mounts = mountsForPackageList(packages);

  let p = spawn('docker', [
      'run',
      ...mounts,
      '--label', `io.cardstack.hub.project=${PROJECT_NAME}`,
      '--env', `CARDSTACK_PROJECT_LINKAGES=${JSON.stringify(packages)}`,
      '--workdir', '/hub/src',
      'cardstack/hub',
      'node', 'v2-containers/install-and-link.js'
  ], {stdio: 'inherit'});

  function printExaminer(val) {
    console.log("To inspect contents, use this command:");
    console.log([
      'docker', 'run',
      '-it', '--rm',
      ...mounts,
      '--workdir', '/packages',
      'cardstack/hub',
      'sh'
    ].join(' '));
    return val;
  }

  return new Promise(function(resolve, reject) {
    p.on('error', reject);
    p.on('exit', function(code) {
      if (code === 0) {
        resolve();
      } else {
        reject('install/link step failed with code '+code);
      }
    });
  }).then(printExaminer, printExaminer);
}



/*
 * Deletes (via label) all volumes associated with a project
 */
function clearVolumesForProject(projectName) {
  let p = spawn('docker', [
      'volume', 'prune',
      '--force', // avoid interactive prompt, doesn't force remove attached volumes or anything
      '--filter', `label=io.cardstack.hub.project=${projectName}`
  ]);

  return new Promise(function(resolve, reject) {
    p.on('error', reject);
    p.on('exit', function(code) {
      if (code === 0) {
        resolve();
      } else {
        reject('Docker volume prune exited with code ' + code);
      }
    });
  });
}


/*
 * Takes a list of packages, creates a docker volume for the node_modules
 * of each one, and returns a new package list with the names of those volumes
 *
 * [{
 *   name: 'package-name',
 *   path: '/path/to/package',
 *   links: []
 * }]
 *
 * ->
 *
 * [{
 *   name: 'package-name',
 *   path: '/path/to/package',
 *   volumeName: 'xcoivbsdlkfjsxiso2348hcx9h',
 *   links: []
 * }]
 *
 */
function withVolumes(packages) {
  return Promise.all(packages.map(function(package) {
    let volumeName = '';
    let p = spawn('docker', [
        'volume', 'create',
        '--label', `io.cardstack.hub.project=${PROJECT_NAME}`,
        '--label', `io.cardstack.hub.package=${package.name}`
    ]);
    p.stdout.on('data', d => volumeName += d);

    return new Promise(function(resolve, reject) {
      p.on('error', reject);
      p.on('close', function(code) {
        if (code === 0) {
          resolve(Object.assign({}, package, { volumeName: volumeName.trim() }));
        } else {
          reject('docker exited with code '+code);
        }
      });
    });
  }));
}


// clearVolumesForProject(PROJECT_NAME);
// testCreation();
async function testCreation() {
  let packages = [{
    name: '@cardstack/thing',
    path: '/Users/aaron/dev/thing',
    links: []
  }];

  console.log(packages);
  console.log('->');
  console.log(await withVolumes(packages));
}

