const {
  Repository
} = require('nodegit');

const logger = require('heimdalljs-logger');
const crypto = require('crypto');
const git = require('./git');
const os = require('os');
const process = require('process');

module.exports = class Indexer {
  constructor({ repoPath }) {
    this.repoPath = repoPath;
    this.repo = null;
    this.log = logger('writer');
    let hostname = os.hostname();
    this.myName = `PID${process.pid} on ${hostname}`;
    this.myEmail = `${os.userInfo().username}@${hostname}`;
  }

  async create(branch, user, document) {
    while (true) {
      try {
        // 20 bytes is good enough for git, so it's good enough for
        // me. In practice we probably have a lower collision
        // probability too, because we're allowed to retry if we know
        // the id is already in use (so we can really only collide
        // with things that have not yet merged into our branch).
        let id = crypto.randomBytes(20).toString('hex');
        let doc = await this._create(branch, user, document, id);
        return doc;
      } catch(err) {
        if (!(err instanceof DuplicateId)) {
          throw err;
        }
      }
    }
  }

  async _create(branch, user, document, id) {
    let commitOpts = {
      authorName: user.fullName,
      authorEmail: user.email,
      committerName: this.myName,
      committerEmail: this.myEmail,
      message: `create ${document.type} ${id.slice(12)}`
    };
    await this._ensureRepo();
    await git.mergeCommit(this.repo, null, branch, [
      {
        operation: 'create',
        filename: `contents/${document.type}/${id}.json`,
        buffer: Buffer.from(JSON.stringify(document.attributes), 'utf8')
      }
    ], commitOpts);

    return { id };
  }

  async _ensureRepo() {
    if (!this.repo) {
      this.repo = await Repository.open(this.repoPath);
    }
  }

};

class DuplicateId extends Error {}
