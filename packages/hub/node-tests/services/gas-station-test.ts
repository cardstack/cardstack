import { rest } from 'msw';
import { setupServer, SetupServerApi } from 'msw/node';
import GasStationService from '../../services/gas-station';
import { setupHub } from '../helpers/server';
import config from 'config';
import { ethers } from 'ethers';

const ethereumGasPrice = {
  status: '1',
  message: 'OK',
  result: {
    LastBlock: '15975904',
    SafeGasPrice: '16',
    ProposeGasPrice: '18',
    FastGasPrice: '20',
    suggestBaseFee: '15.660586612',
    gasUsedRatio: '0.206799033333333,0.849954066666667,0.670711266666667,0.480958133333333,0.427384866666667',
  },
};

const polygonGasPrice = {
  safeLow: {
    maxPriorityFee: 1.39333,
    maxFee: 1.39333,
  },
  standard: {
    maxPriorityFee: 1.473333,
    maxFee: 1.4733396,
  },
  fast: {
    maxPriorityFee: 1.69998,
    maxFee: 1.7,
  },
  estimatedBaseFee: 0.000006497,
  blockTime: 5,
  blockNumber: 29161250,
};

const gnosisGasPrice = {
  average: 1.51,
  fast: 1.52,
  slow: 1.51,
};

describe('GasStationService', function () {
  let subject: GasStationService;
  let mockServer: SetupServerApi;

  let { getPrisma, getContainer } = setupHub(this);

  this.beforeEach(async function () {
    subject = (await getContainer().lookup('gas-station-service')) as GasStationService;
  });

  this.beforeEach(async function () {
    mockServer = setupServer(
      rest.get(config.get('gasStationUrls.ethereum'), (_req, res, ctx) => {
        return res(ctx.status(200), ctx.json(ethereumGasPrice));
      }),
      rest.get(config.get('gasStationUrls.polygon'), (_req, res, ctx) => {
        return res(ctx.status(200), ctx.json(polygonGasPrice));
      }),
      rest.get(config.get('gasStationUrls.gnosis'), (_req, res, ctx) => {
        return res(ctx.status(200), ctx.json(gnosisGasPrice));
      })
    );

    mockServer.listen();
  });

  this.afterEach(async function () {
    mockServer.close();
  });

  it('returns gas price for ethereum', async function () {
    let chainId = 1;
    let prisma = await getPrisma();
    let gasPrice = await subject.getGasPriceByChainId(chainId);
    let gasPriceFromDB = await prisma.gasPrice.findFirst({
      where: { chainId },
    });

    expect(gasPrice).not.null;
    expect(gasPrice?.slow).equal(ethers.utils.parseUnits(ethereumGasPrice.result.SafeGasPrice, 'gwei').toString());
    expect(gasPrice?.standard).equal(
      ethers.utils.parseUnits(ethereumGasPrice.result.ProposeGasPrice, 'gwei').toString()
    );
    expect(gasPrice?.fast).equal(ethers.utils.parseUnits(ethereumGasPrice.result.FastGasPrice, 'gwei').toString());
    expect(gasPrice?.chainId).equal(gasPriceFromDB?.chainId);
    expect(gasPrice?.slow).equal(gasPriceFromDB?.slow);
    expect(gasPrice?.standard).equal(gasPriceFromDB?.standard);
    expect(gasPrice?.fast).equal(gasPriceFromDB?.fast);
  });

  it('returns gas price for polygon', async function () {
    let chainId = 137;
    let prisma = await getPrisma();
    let gasPrice = await subject.getGasPriceByChainId(chainId);
    let gasPriceFromDB = await prisma.gasPrice.findFirst({
      where: { chainId },
    });

    expect(gasPrice).not.null;
    expect(gasPrice?.slow).equal(ethers.utils.parseUnits(String(polygonGasPrice.safeLow.maxFee), 'gwei').toString());
    expect(gasPrice?.standard).equal(
      ethers.utils.parseUnits(String(polygonGasPrice.standard.maxFee), 'gwei').toString()
    );
    expect(gasPrice?.fast).equal(ethers.utils.parseUnits(String(polygonGasPrice.fast.maxFee), 'gwei').toString());
    expect(gasPrice?.chainId).equal(gasPriceFromDB?.chainId);
    expect(gasPrice?.slow).equal(gasPriceFromDB?.slow);
    expect(gasPrice?.standard).equal(gasPriceFromDB?.standard);
    expect(gasPrice?.fast).equal(gasPriceFromDB?.fast);
  });

  it('returns gas price for gnosis', async function () {
    let chainId = 100;
    let prisma = await getPrisma();
    let gasPrice = await subject.getGasPriceByChainId(chainId);
    let gasPriceFromDB = await prisma.gasPrice.findFirst({
      where: { chainId },
    });

    expect(gasPrice).not.null;
    expect(gasPrice?.slow).equal(ethers.utils.parseUnits(String(gnosisGasPrice.slow), 'gwei').toString());
    expect(gasPrice?.standard).equal(ethers.utils.parseUnits(String(gnosisGasPrice.average), 'gwei').toString());
    expect(gasPrice?.fast).equal(ethers.utils.parseUnits(String(gnosisGasPrice.fast), 'gwei').toString());
    expect(gasPrice?.chainId).equal(gasPriceFromDB?.chainId);
    expect(gasPrice?.slow).equal(gasPriceFromDB?.slow);
    expect(gasPrice?.standard).equal(gasPriceFromDB?.standard);
    expect(gasPrice?.fast).equal(gasPriceFromDB?.fast);
  });
});
