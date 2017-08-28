const fs = require('fs');
const path = require('path');
const {spawn} = require('child_process');

module.exports = function launchOrchestrator({
  projectName,
  projectRoot,
  projectStructure,
  seedDir,
  useDevDependencies
}) {
  let args = [
    '--label', `io.cardstack.hub.project=${projectName}`,
    '--env', `CARDSTACK_PROJECT_NAME=${projectName}`,
    '--env', `CARDSTACK_PROJECT_ROOT=${projectRoot}`,
    '--env', `CARDSTACK_SEED_DIRECTORY=${seedDir}`,
    '--env', `CARDSTACK_PROJECT_LINKAGES=${JSON.stringify(projectStructure)}`,
    '--env', 'CARDSTACK_SESSIONS_KEY=FPrrXR6HxckEtjvaevse4qf4Bsp0z+1hetQ69r0oi/c=',
    '--mount', 'type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    '--workdir', '/hub/src',
    'cardstack/hub',
    'node', 'v2-containers/orchestrate.js'
  ];

  if (useDevDependencies) {
    args.unshift('--env', 'CARDSTACK_USE_DEV_DEPENDENCIES=true');
  }

  let p = spawn('docker', [
      'run',
      ...args
  ], { stdio: 'inherit' });

  return new Promise(function(resolve, reject) {
    p.on('error', reject);
    p.on('exit', function(code) {
      if (code === 0) {
        resolve();
      } else {
        reject("docker run failed with code "+code);
      }
    });
  });
};

process.on('warning', (warning) => {
  process.stderr.write(warning.stack);
});
