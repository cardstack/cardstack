// Types for compiled templates
declare module '@cardstack/ssr-web/templates/*' {
  import { TemplateFactory } from 'htmlbars-inline-precompile';
  const tmpl: TemplateFactory;
  export default tmpl;
}

// Taken from https://gist.github.com/josemarluedke/ee2612055aae28e4fa842d74f63caee9
declare module 'ember-cli-fastboot/services/fastboot' {
  import Service from '@ember/service';

  interface Request {
    method: string;
    body: unknown;
    cookies: unknown;
    headers: any;
    queryParams: unknown;
    path: string;
    protocol: string;
    host: string;
  }

  interface Shoebox {
    put(key: string, value: unknown): void;
    retrieve(key: string): undefined | JSON;
  }

  export default class Fastboot extends Service {
    public isFastBoot: boolean;
    public request: Request;
    public shoebox: Shoebox;
    public response: any; // need types
    public metadata: unknown; // need types
    public deferRendering(promise: Promise<unknown>): unknown;
  }
}
