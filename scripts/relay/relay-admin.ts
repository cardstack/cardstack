import HTML from 'node-html-parser';
import fetch, { Response } from 'node-fetch';
import { URLSearchParams } from 'url';

class RelayAdmin {
  host: string;
  csrftoken: string | undefined;
  sessionid: string | undefined;

  constructor(host: string) {
    this.host = host.replace(/\/*$/, '');
  }

  async login(username: string, password: string) {
    let res = await this._get('/admin/login');

    this.csrftoken = this.getCookie('csrftoken', res);
    if (this.csrftoken === '') {
      throw 'no csrf token found';
    }

    let body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);

    res = await this._post('/admin/login/?next=/admin', body);
    this.sessionid = this.getCookie('sessionid', res);
  }

  async getUsers(): Promise<User[]> {
    let users: User[] = [];

    let res = await this._get('/admin/auth/user/');
    const resultlist = this.getResultList(await res.text());

    for (const result of resultlist) {
      const id = result.querySelector('td.action-checkbox > input.action-select')?.getAttribute('value');
      const username = result.querySelector('th.field-username > a')?.text;
      if (!id || !username) {
        throw 'getUsers: error parsing result_list';
      }
      users.push({
        id,
        username,
      });
    }
    return users;
  }

  async addUser(username: string, password: string) {
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password1', password);
    body.append('password2', password);
    body.append('_save', 'Save');

    await this._post(`/admin/auth/user/add`, body);
  }

  async deleteUser(id: string) {
    const body = new URLSearchParams();
    body.append('post', 'yes');

    await this._post(`/admin/auth/user/${id}/delete/`, body);
  }

  async getPriceOracles(): Promise<PriceOracle[]> {
    let priceOracles: PriceOracle[] = [];

    let res = await this._get('/admin/tokens/priceoracle');
    const resultlist = this.getResultList(await res.text());

    for (const result of resultlist) {
      const id = result.querySelector('td.action-checkbox > input.action-select')?.getAttribute('value');
      const name = result.querySelector('th.field-name > a')?.text;
      const configuration = result.querySelector('td.field-configuration')?.text;

      if (!id || !name || !configuration) {
        throw 'getPriceOracles: error parsing result_list';
      }

      priceOracles.push({
        id,
        name,
        configuration: JSON.parse(configuration),
      });
    }

    return priceOracles;
  }

  async addPriceOracle(priceOracle: PriceOracle) {
    const body = new URLSearchParams();
    body.append('configuration', JSON.stringify(priceOracle.configuration));
    body.append('name', priceOracle.name);
    body.append('_save', 'Save');

    await this._post(`/admin/tokens/priceoracle/add/`, body);
  }

  async deletePriceOracle(id: string) {
    const body = new URLSearchParams();
    body.append('post', 'yes');

    await this._post(`/admin/tokens/priceoracle/${id}/delete/`, body);
  }

  async getTokens() {
    let tokens: Token[] = [];

    let res = await this._get('/admin/tokens/token');
    const resultlist = this.getResultList(await res.text());

    for (const result of resultlist) {
      const id = result.querySelector('td.action-checkbox > input.action-select')?.getAttribute('value');
      const relevance = result.querySelector('th.field-relevance > a')?.text;
      const address = result.querySelector('td.field-address')?.text;
      const name = result.querySelector('td.field-name')?.text;
      const symbol = result.querySelector('td.field-symbol')?.text;
      const decimals = result.querySelector('td.field-decimals')?.text;
      const fixedEthConversion = result.querySelector('td.field-fixed_eth_conversion')?.text;
      const gas = result.querySelector('td.field-gas > img')?.getAttribute('alt') == 'True';

      if (!id || !name || !relevance || !address || !symbol || !decimals || !fixedEthConversion) {
        console.error(id, name, relevance, address, symbol, decimals, fixedEthConversion, gas);
        throw 'getTokens: error parsing result_list';
      }

      tokens.push({
        id,
        relevance: parseInt(relevance),
        address,
        name,
        symbol,
        decimals: parseInt(decimals),
        fixedEthConversion: fixedEthConversion != '-' ? parseInt(fixedEthConversion) : undefined,
        gas,
      });
    }

    return tokens;
  }

  async addToken(token: Token) {
    const body = new URLSearchParams();
    body.append('_save', 'Save');
    body.append('address', token.address);
    body.append('name', token.name);
    body.append('symbol', token.symbol);
    body.append('decimals', token.decimals.toString());
    body.append('description', token.description || '');
    body.append('logo_uri', token.logoUri || '');
    body.append('website_uri', token.websiteUri || '');
    body.append('fixed_eth_conversion', token.fixedEthConversion?.toString() || '');
    body.append('relevance', token.relevance.toString() || '');

    if (token.gas) {
      body.append('gas', 'on');
    }

    await this._post(`/admin/tokens/token/add`, body);
  }

  async deleteToken(id: string) {
    const body = new URLSearchParams();
    body.append('post', 'yes');

    await this._post(`/admin/tokens/token/${id}/delete/`, body);
  }

  async getPriceOracleTickers(): Promise<PriceOracleTicker[]> {
    const tokens = await this.getTokens();
    const oracles = await this.getPriceOracles();

    let priceOracleTickers: PriceOracleTicker[] = [];

    let res = await this._get('/admin/tokens/priceoracleticker');
    const resultlist = this.getResultList(await res.text());

    for (const result of resultlist) {
      const id = result.querySelector('td.action-checkbox > input.action-select')?.getAttribute('value');
      const tokenSymbol = result.querySelector('th.field-token_symbol > a')?.text;
      const oracleName = result.querySelector('td.field-price_oracle_name')?.text;
      const ticker = result.querySelector('td.field-ticker')?.text;
      const inverse = result.querySelector('td.field-gas > img')?.getAttribute('alt') == 'True';
      const price = result.querySelector('td.field-price')?.text;

      const token = tokens.find((token) => token.symbol == tokenSymbol);
      const priceOracle = oracles.find((oracle) => oracle.name == oracleName);

      if (!id || !token || !priceOracle || !ticker) {
        throw 'getPriceOracleTickers: error parsing result_list';
      }

      priceOracleTickers.push({
        id,
        token,
        priceOracle,
        ticker,
        inverse,
        price: price === '-' ? '' : price,
      });
    }

    return priceOracleTickers;
  }

  async addPriceOracleTicker(priceOracleTicker: PriceOracleTicker) {
    const body = new URLSearchParams();
    body.append('_save', 'Save');
    body.append('price_oracle', priceOracleTicker.priceOracle.id!);
    body.append('token', priceOracleTicker.token.id!);
    body.append('ticker', priceOracleTicker.ticker);

    if (priceOracleTicker.inverse) {
      body.append('inverse', 'on');
    }

    await this._post(`/admin/tokens/priceoracleticker/add`, body);
  }

  async deletePriceOracleTicker(id: string) {
    const body = new URLSearchParams();
    body.append('post', 'yes');

    await this._post(`/admin/tokens/priceoracleticker/${id}/delete/`, body);
  }

  async _get(endpoint: string): Promise<Response> {
    const url = this.host + endpoint.replace(/^\/*/, '/').replace(/\/*$/, '/');

    const res = await fetch(url, {
      redirect: 'manual',
      headers: this.getHeaders(),
    });

    return res;
  }

  async _post(endpoint: string, body: URLSearchParams): Promise<Response> {
    const url = this.host + endpoint.replace(/^\/*/, '/').replace(/\/*$/, '/');

    let res = await this._get(endpoint);
    const csrfmiddlewaretoken = this.getCsrfMiddlewareToken(await res.text());
    body.append('csrfmiddlewaretoken', csrfmiddlewaretoken);

    res = await fetch(url, {
      method: 'post',
      body,
      redirect: 'manual',
      headers: this.getHeaders(),
    });

    return res;
  }

  getCsrfMiddlewareToken(html: string): string {
    const re = /<input [^<]*>/g;
    const inputs = html.match(re)!;
    let csrfmiddlewaretoken = '';
    for (const input of inputs) {
      if (input.includes('name="csrfmiddlewaretoken"')) {
        csrfmiddlewaretoken = input.match(/value="([^"]+)"/)![1];
      }
    }
    return csrfmiddlewaretoken;
  }

  getCookie(name: string, res: Response): string {
    const cookies = res.headers.get('set-cookie')!.split(', ');

    for (const cookie of cookies) {
      if (cookie.startsWith(`${name}=`)) {
        return cookie.substring(cookie.indexOf('=') + 1, cookie.indexOf(';'));
      }
    }

    return '';
  }

  getHeaders(): any {
    let headers: any = {
      referer: this.host,
    };

    if (this.csrftoken == undefined) {
      return headers;
    }

    let cookie = `csrftoken=${this.csrftoken}`;

    if (this.sessionid == undefined) {
      headers.cookie = cookie;
      return headers;
    }

    cookie = cookie + `; sessionid=${this.sessionid}`;
    headers.cookie = cookie;

    return headers;
  }

  getResultList(html: string) {
    const root = HTML.parse(html);
    const resultlist = root.querySelectorAll('table#result_list > tbody > tr');
    if (resultlist == null) {
      throw 'result_list table not found';
    }
    return resultlist;
  }
}

interface User {
  id?: string;
  username: string;
}

interface PriceOracleTicker {
  id?: string;
  priceOracle: PriceOracle;
  token: Token;
  ticker: string;
  inverse: boolean;
  price?: string;
}

interface PriceOracle {
  id?: string;
  name: string;
  configuration: any;
}

interface Token {
  id?: string;
  address: string;
  name: string;
  symbol: string;
  description?: string;
  decimals: number;
  logoUri?: string;
  websiteUri?: string;
  gas: boolean;
  fixedEthConversion?: number;
  relevance: number;
}

export { RelayAdmin, Token, PriceOracle, PriceOracleTicker };
