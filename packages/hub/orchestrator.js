
function start() {
  console.log('totally starting everything up');
  return Promise.resolve();
}

function stop() {
  console.log('ok, everything totally shut down successfully');
  process.exit();
}


module.exports = {
  start,
  stop
};
