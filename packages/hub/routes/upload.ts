import Router from '@koa/router';
import Koa from 'koa';
import KoaBody from 'koa-body';
import { inject } from '@cardstack/di';
import shortUuid from 'short-uuid';
import { unlink } from 'fs';
import * as Sentry from '@sentry/node';
import { ensureLoggedIn } from './utils/auth';
import { handleError } from './utils/error';

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
        handleError(ctx, 429, 'Too many uploads', `Too many uploads. Try again later.`);
        return;
      }

      let contextFiles = ctx!.request.files as any;
      let filenames: string[] = Object.keys(contextFiles);

      if (filenames.length !== 1) {
        handleError(ctx, 422, 'Invalid upload', `Expected 1 file, got ${filenames.length} files`);
        return;
      }

      let filename = filenames[0];
      let file = contextFiles[filename];
      let { size, type } = file;

      try {
        let validationError = this.validate(size, type);

        if (validationError) {
          handleError(ctx, 422, 'Invalid upload', validationError);
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
          ownerAddress: '0x0',
        });

        ctx.body = {
          data: {
            type: 'uploaded-asset',
            attributes: {
              url,
            },
          },
        };
        ctx.append('Location', url);
        ctx.type = 'application/vnd.api+json';
        ctx.status = 201;
      } catch (error) {
        Sentry.captureException(error);
        handleError(ctx, 422, 'Invalid upload', `Unexpected error while uploading`);
      } finally {
        console.log(file.path);
        unlink(file.path, () => {});
      }
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
