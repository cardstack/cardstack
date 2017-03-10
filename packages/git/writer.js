const {
  Repository
} = require('nodegit');

const logger = require('heimdalljs-logger');
const crypto = require('crypto');
const git = require('./merge');
const os = require('os');
const process = require('process');
const Error = require('@cardstack/data-source/error');
const Schema = require('@cardstack/server/schema');

module.exports = class Writer {
  constructor({ repo, idGenerator }) {
    this.repoPath = repo;
    this.repo = null;
    this.log = logger('writer');
    let hostname = os.hostname();
    this.myName = `PID${process.pid} on ${hostname}`;
    this.myEmail = `${os.userInfo().username}@${hostname}`;
    this.idGenerator = idGenerator;
  }

  async create(branch, user, type, document) {
    this._requireType(type, document);
    return this._withErrorHandling(document.id, type, async () => {
      while (true) {
        try {
          // 20 bytes is good enough for git, so it's good enough for
          // me. In practice we probably have a lower collision
          // probability too, because we're allowed to retry if we know
          // the id is already in use (so we can really only collide
          // with things that have not yet merged into our branch).
          let id;
          if (document.id == null) {
            id = this._generateId();
          } else {
            id = document.id;
          }
          let doc = await this._create(branch, user, document, id);
          return doc;
        } catch(err) {
          if (err instanceof git.OverwriteRejected && document.id == null) {
            // ignore so our loop can retry
          } else {
            throw err;
          }
        }
      }
    });
  }

  async update(branch, user, type, id, document) {
    this._requireType(type, document);
    if (document.id == null) {
      throw new Error('missing required field "id"', {
        status: 400,
        source: { pointer: '/data/id' }
      });
    }
    if (!document.meta || !document.meta.version) {
      throw new Error('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' }
      });
    }
    await this._ensureRepo();

    let gitDocument = {};
    if (document.attributes) {
      gitDocument.attributes = document.attributes;
    }
    if (document.relationships) {
      gitDocument.relationships = document.relationships;
    }

    return this._withErrorHandling(id, type, async () => {
      let commitId = await git.mergeCommit(this.repo, document.meta.version, branch, [
        {
          operation: 'update',
          filename: this._filenameFor(document.type, document.id),
          buffer: Buffer.from(JSON.stringify(gitDocument), 'utf8')
        }
      ], this._commitOptions('update', document.type, document.id, user));

      let responseDocument = {
        id: document.id,
        type: document.type,
        meta: {
          version: commitId
        }
      };
      if (gitDocument.attributes) {
        responseDocument.attributes = gitDocument.attributes;
      }
      if (gitDocument.relationships) {
        responseDocument.relationships = gitDocument.relationships;
      }
      return responseDocument;
    });
  }

  async delete(branch, user, version, type, id) {
    if (id == null) {
      throw new Error('id is required', {
        status: 400
      });
    }
    if (!version) {
      throw new Error('version is required', {
        status: 400
      });
    }
    await this._ensureRepo();
    return this._withErrorHandling(id, type, async () => {
      await git.mergeCommit(this.repo, version, branch, [
        {
          operation: 'delete',
          filename: this._filenameFor(type, id)
        }
      ], this._commitOptions('delete', type, id, user));
    });
  }

  async _create(branch, user, document, id) {
    await this._ensureRepo();

    let gitDocument = {};
    if (document.attributes) {
      gitDocument.attributes = document.attributes;
    }
    if (document.relationships) {
      gitDocument.relationships = document.relationships;
    }

    let commitId = await git.mergeCommit(this.repo, null, branch, [
      {
        operation: 'create',
        filename: this._filenameFor(document.type, id),
        buffer: Buffer.from(JSON.stringify(gitDocument), 'utf8')
      }
    ], this._commitOptions('create', document.type, id, user));

    let responseDocument = {
      id,
      type: document.type,
      meta: {
        version: commitId
      }
    };
    if (gitDocument.attributes) {
      responseDocument.attributes = gitDocument.attributes;
    }
    if (gitDocument.relationships) {
      responseDocument.relationships = gitDocument.relationships;
    }

    return responseDocument;
  }

  async _withErrorHandling(id, type, fn) {
    try {
      return await fn();
    } catch (err) {
      if (/Unable to parse OID/.test(err.message) || /Object not found/.test(err.message)) {
        throw new Error(err.message, { status: 400, source: { pointer: '/data/meta/version' }});
      }
      if (err instanceof git.GitConflict) {
        throw new Error("Merge conflict", { status: 409 });
      }
      if (err instanceof git.OverwriteRejected) {
        throw new Error(`id ${id} is already in use`, { status: 409, source: { pointer: '/data/id'}});
      }
      if (err instanceof git.NotFound) {
        throw new Error(`${type} with id ${id} does not exist`, {
          status: 404,
          source: { pointer: '/data/id' }
        });
      }
      throw err;
    }
  }

  _requireType(type, document) {
    if (document.type == null) {
      throw new Error('missing required field "type"', {
        status: 400,
        source: { pointer: '/data/type' }
      });
    }
    if (document.type !== type) {
      throw new Error(`the type "${document.type}" is not allowed here`, {
        status: 409,
        source: { pointer: '/data/type' }
      });
    }
  }

  _commitOptions(operation, type, id, user) {
    return {
      authorName: user.fullName,
      authorEmail: user.email,
      committerName: this.myName,
      committerEmail: this.myEmail,
      message: `${operation} ${type} ${id.slice(12)}`
    };
  }

  _filenameFor(type, id) {
    let category = Schema.ownTypes().includes(type) ? 'schema' : 'contents';
    return `${category}/${type}/${id}.json`;
  }

  async _ensureRepo() {
    if (!this.repo) {
      this.repo = await Repository.open(this.repoPath);
    }
  }

  _generateId() {
    if (this.idGenerator) {
      return this.idGenerator();
    } else {
      return crypto.randomBytes(20).toString('hex');
    }
  }

};
