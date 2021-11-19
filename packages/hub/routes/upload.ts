import Router from '@koa/router';
import Koa from 'koa';
import KoaBody from 'koa-body';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { ensureLoggedIn } from './utils/auth';

export interface Upload {
  id: string;
  cid: string;
  service: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  ownerAddress: string;
}

export default class UploadRouter {
  uploadQueries = inject('upload-queries', {
    as: 'uploadQueries',
  });

  web3Storage = inject('web3-storage', {
    as: 'web3Storage',
  });

  routes() {
    let uploadRouter = new Router();
    let middleware = KoaBody({
      formidable: {
        keepExtensions: true,
      },
      multipart: true,
      urlencoded: true,
    });

    uploadRouter.post('/upload', middleware, async (ctx: Koa.Context) => {
      if (!ensureLoggedIn(ctx)) {
        return;
      }

      if (await this.uploadQueries.isAbusing(ctx.state.userAddress)) {
        ctx.body = `Too many uploads. Try again later.`;
        ctx.status = 429;
        return;
      }

      let contextFiles = ctx!.request.files as any;
      let filenames: string[] = Object.keys(contextFiles);

      if (filenames.length !== 1) {
        ctx.body = `Expected 1 file, got ${filenames.length} files`;
        ctx.status = 422;
        return;
      }

      let filename = filenames[0];
      let file = contextFiles[filename];
      let { size, type } = file;

      let validationError = this.validate(size, type);

      if (validationError) {
        ctx.body = validationError;
        ctx.status = 422;
        return;
      }

      let cid = await this.web3Storage.upload(file.path, filename);

      // Use CloudFlare's IPFS CDN: https://developers.cloudflare.com/distributed-web/ipfs-gateway
      let url = `https://cloudflare-ipfs.com/ipfs/${cid}/${filename}`;

      await this.uploadQueries.insert({
        id: shortUuid.uuid(),
        cid,
        service: 'web3.storage',
        url,
        filename,
        size,
        type,
        ownerAddress: ctx.state.userAddress,
      });

      ctx.body = url;
      ctx.status = 200;
    });

    return uploadRouter.routes();
  }

  validate(byteSize: number, type: string): string | void {
    let allowedTypes = ['image/jpeg', 'image/png'];

    if (!allowedTypes.includes(type)) {
      return `File type unsupported. Allowed types: JPG, JPEG, PNG`;
    }

    let maxBytes = 1000000; // 1MB

    if (byteSize > maxBytes) {
      return `File is too large. Max file size is 1MB.`;
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'upload-router': UploadRouter;
  }
}
