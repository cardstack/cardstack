/*
   This module is deliberately not implemented using nodegit. Instead,
   it's implemented via regular shell git commands. That way, our test
   suite's assertions would notice inconsistencies between what
   nodegit sees and what stock git sees.
*/

import { spawn } from 'child_process';
import Change from '../../../../cards/git-realm/lib/change';
import { CommitOpts } from '../../../../cards/git-realm/lib/git';

export function inRepo(path: string) {
  return new RepoExplorer(path);
}

class RepoExplorer {
  constructor(readonly path: string) {}

  async runGit(...args: string[]) {
    return await run('git', args, { cwd: this.path });
  }
  async getCommit(which: string) {
    let props = Object.keys(formats);
    let result = await this.runGit(
      'show',
      which,
      '-s',
      `--format=format:${props.map(p => '%' + formats[p]).join('|')}`
    );
    let values = result.stdout.split('|');
    let output: Record<string, string> = {};
    for (let i = 0; i < props.length; i++) {
      output[props[i]] = values[i];
    }
    return output;
  }
  async getContents(refSpec: string, path: string) {
    return (await this.runGit('show', `${refSpec}:${path}`)).stdout;
  }
  async push(remote = 'origin', branch = 'master') {
    return (await this.runGit('push', '--set-upstream', remote, branch)).stdout;
  }
  async getJSONContents(refSpec: string, path: string) {
    return JSON.parse((await this.runGit('show', `${refSpec}:${path}`)).stdout);
  }
  async listTree(refSpec: string, path: string) {
    let contents = (await this.runGit('ls-tree', `${refSpec}:${path}`)).stdout;
    return contents
      .split('\n')
      .filter(line => line.length > 0)
      .map(line => {
        let [filemode, type, oid, name] = line.split(/\s+/);
        return { filemode, type, oid, name };
      });
  }
}

const formats: Record<string, string> = {
  id: 'H',
  authorName: 'an',
  authorEmail: 'ae',
  authorDate: 'ai',
  committerName: 'cn',
  committerEmail: 'ce',
  message: 'B',
};

class StdOutError extends Error {
  public stdout?: string;
  public stderr?: string;
}

async function run(command: string, args: string[], opts: Record<string, string>): Promise<Record<string, string>> {
  return await new Promise(function(resolve, reject) {
    let p = spawn(command, args, opts || {});
    let stderr = '';
    let stdout = '';
    p.stdout.on('data', function(output) {
      stdout += output;
    });
    p.stderr.on('data', function(output) {
      stderr += output;
    });
    p.on('close', function(code) {
      if (code !== 0) {
        let err: StdOutError = new Error(`${command} ${args.join(' ')} exited with nonzero status: ${stderr}`);
        err.stderr = stderr;
        err.stdout = stdout;
        reject(err);
      } else {
        let result: Record<string, string> = { stdout, stderr };
        resolve(result);
      }
    });
  });
}

type CommitOptsPartial = Partial<CommitOpts>;

export function commitOpts(opts?: CommitOptsPartial) {
  return Object.assign(
    {},
    {
      authorName: 'John Milton',
      authorEmail: 'john@paradiselost.com',
      message: 'Default test message',
    },
    opts
  ) as CommitOpts;
}

export async function makeRepo(path: string, files?: Record<string, string>) {
  let change = await Change.createInitial(path, 'master');
  let repo = change.repo;

  if (files) {
    for (let [filename, content] of Object.entries(files)) {
      let file = await change.get(filename, { allowCreate: true });
      file.setContent(content);
    }
  }

  let opts = commitOpts({
    message: 'First commit',
  });

  let head = await change.finalize(opts);

  return { head, repo };
}
