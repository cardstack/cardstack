exports.hello = async function() {
  await new Promise(resolve => setTimeout(resolve, 10));
  return 'world';
};
