// TODO: import this from @metamask/detect-provider -- need to figure out why embroider/webpack wasn't bundling it when we tried to use it that way.
interface EthereumProvider {
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export default detectEthereumProvider;

/**
 * Returns a Promise that resolves to the value of window.ethereum if it is
 * set within the given timeout, or null.
 * The Promise will not reject, but an error will be thrown if invalid options
 * are provided.
 *
 * @param options - Options bag.
 * @param options.mustBeMetaMask - Whether to only look for MetaMask providers.
 * Default: false
 * @param options.silent - Whether to silence console errors. Does not affect
 * thrown errors. Default: false
 * @param options.timeout - Milliseconds to wait for 'ethereum#initialized' to
 * be dispatched. Default: 3000
 * @returns A Promise that resolves with the Provider if it is detected within
 * given timeout, otherwise null.
 */
function detectEthereumProvider({
  mustBeMetaMask = false,
  silent = false,
  timeout = 3000,
} = {}): Promise<unknown> {
  _validateInputs();

  let handled = false;

  return new Promise((resolve) => {
    if (window.ethereum) {
      handleEthereum();
    } else {
      window.addEventListener('ethereum#initialized', handleEthereum, {
        once: true,
      });

      setTimeout(() => {
        handleEthereum();
      }, timeout);
    }

    function handleEthereum() {
      if (handled) {
        return;
      }
      handled = true;

      window.removeEventListener('ethereum#initialized', handleEthereum);

      const { ethereum } = window;

      if (ethereum && (!mustBeMetaMask || ethereum.isMetaMask)) {
        resolve(ethereum);
      } else {
        const message =
          mustBeMetaMask && ethereum
            ? 'Non-MetaMask window.ethereum detected.'
            : 'Unable to detect window.ethereum.';

        !silent && console.error('@metamask/detect-provider:', message);
        resolve(null);
      }
    }
  });

  function _validateInputs() {
    if (typeof mustBeMetaMask !== 'boolean') {
      throw new Error(
        `@metamask/detect-provider: Expected option 'mustBeMetaMask' to be a boolean.`
      );
    }
    if (typeof silent !== 'boolean') {
      throw new Error(
        `@metamask/detect-provider: Expected option 'silent' to be a boolean.`
      );
    }
    if (typeof timeout !== 'number') {
      throw new Error(
        `@metamask/detect-provider: Expected option 'timeout' to be a number.`
      );
    }
  }
}
