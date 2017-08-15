const {spawn} = require('child_process');

module.exports = function startHubService({
  projectRoot,
  projectStructure,
  seedDir,
  useDevDependencies
}) {
  let args = [
    '--env', `CARDSTACK_PROJECT_ROOT=${projectRoot}`,
    '--env', `CARDSTACK_SEED_DIRECTORY=${seedDir}`,
    '--env', `CARDSTACK_PROJECT_LINKAGES=${JSON.stringify(projectStructure)}`,
    '--mount', 'type=bind,src=/var/run/docker.sock,dst=/var/run/docker.sock',
    'cardstack/hub',
  ];

  if (useDevDependencies) {
    args.unshift('--env', 'CARDSTACK_USE_DEV_DEPENDENCIES=true');
  }

  spawn('docker', [
      'run',
      ...args
  ], { stdio: 'inherit' });
};
