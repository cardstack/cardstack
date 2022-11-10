import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import JsonRpcProvider from '../providers/json-rpc-provider';
import sinon from 'sinon';

chai.use(chaiAsPromised);

const metamaskOriginalError = {
  code: -32603,
  data: {
    originalError: {
      code: 3,
      data: '0x08c379a000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000014d6fabbbf42351ad24b45f9a4833780c5bba79185000000000000000000000000',
      message: 'execution reverted: ����B5\u001a�KE���7�Ż���',
    },
  },
  message: 'execution reverted: ����B5\u001a�KE���7�Ż���',
};

const metamaskError = {
  code: -32603,
  message: 'Internal JSON-RPC error.',
  data: {
    code: 3,
    data: '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000149bd4b4946eabc8a64d198b2fc95866208d1acce5000000000000000000000000',
    message: 'execution reverted: �Դ�n�ȦM\u0019�/�Xf �\u001a��',
  },
};

const commonError = {
  code: 3,
  data: '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000149bd4b4946eabc8a64d198b2fc95866208d1acce5000000000000000000000000',
  message: 'execution reverted: �Դ�n�ȦM\u0019�/�Xf �\u001a��',
};

const expectedErrorBase = {
  reason: 'cannot estimate gas; transaction may fail or may require manual gas limit',
  code: 'UNPREDICTABLE_GAS_LIMIT',
};

const performGasEstimate = async (error: unknown) => {
  const provider = new JsonRpcProvider();

  sinon.stub(provider, 'prepareRequest').returns({} as any);
  sinon.stub(provider, 'send').throws(error);

  try {
    await provider.perform('estimateGas', {
      transaction: {
        data: '0x0000000000000000000',
        to: '0x0000000000000000000',
      },
    });
  } catch (e) {
    return e;
  }
};

const assertErrorStructure = (error: any, expectedError: { data: string; message: string }) => {
  chai.expect(error?.code).to.eq(expectedErrorBase.code);
  chai.expect(error?.reason).to.eq(expectedErrorBase.reason);
  chai.expect(error?.data).to.eq(expectedError?.data);
  chai.expect(error?.message).to.eq(expectedError?.message);
};

describe.only('JsonRpcProvider', () => {
  describe('gasEstimate', () => {
    it('should throw error with correct data and message for error object with level 1', async () => {
      const error = await performGasEstimate(commonError);
      const { data, message } = commonError;

      assertErrorStructure(error, { data, message });
    });
    it('should throw error with correct data and message for error object with level 2', async () => {
      const error = await performGasEstimate(metamaskError);
      const {
        data: { data, message },
      } = metamaskError;

      assertErrorStructure(error, { data, message });
    });
    it('should throw error with correct data and message for error object with level 3', async () => {
      const error = await performGasEstimate(metamaskOriginalError);
      const {
        data: {
          originalError: { data, message },
        },
      } = metamaskOriginalError;

      assertErrorStructure(error, { data, message });
    });
  });
});
