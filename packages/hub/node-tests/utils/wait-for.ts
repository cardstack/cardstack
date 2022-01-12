// based on https://github.com/TheBrainFamily/wait-for-expect/blob/master/src/index.ts
const waitForDefaults = {
  timeout: 1500,
  interval: 50,
};

export default function waitFor(
  expectation: () => boolean | Promise<boolean>,
  timeout = waitForDefaults.timeout,
  interval = waitForDefaults.interval
) {
  // eslint-disable-next-line no-param-reassign
  if (interval < 1) interval = 1;
  const maxTries = Math.ceil(timeout / interval);
  let tries = 0;
  return new Promise<void>((resolve, reject) => {
    async function rerun() {
      if (tries > maxTries) {
        reject(new Error(`Could not meet expectation within ${timeout}ms`));
        return;
      }
      // eslint-disable-next-line no-use-before-define
      setTimeout(runExpectation, interval);
    }
    async function runExpectation() {
      tries += 1;
      let v = await expectation();
      if (v) resolve();
      else rerun();
    }
    setTimeout(runExpectation, 0);
  });
}
