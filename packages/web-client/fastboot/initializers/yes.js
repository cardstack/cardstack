function initialize() {
  // @ts-ignore
  if (typeof FastBoot !== 'undefined') {
    console.log('quee?');
    // @ts-ignore
    global.btoa = () => {};
  }
}

export default {
  name: 'bar',
  initialize: initialize,
};
