"use strict";
/*
   This module is deliberately not implemented using nodegit. Instead,
   it's implemented via regular shell git commands. That way, our test
   suite's assertions would notice inconsistencies between what
   nodegit sees and what stock git sees.
*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const change_1 = __importDefault(require("../change"));
function inRepo(path) {
    return new RepoExplorer(path);
}
exports.inRepo = inRepo;
class RepoExplorer {
    constructor(path) {
        this.path = path;
    }
    async runGit(...args) {
        return await run('git', args, { cwd: this.path });
    }
    async getCommit(which) {
        let props = Object.keys(formats);
        let result = await this.runGit('show', which, '-s', `--format=format:${props.map(p => '%' + formats[p]).join('|')}`);
        let values = result.stdout.split('|');
        let output = {};
        for (let i = 0; i < props.length; i++) {
            output[props[i]] = values[i];
        }
        return output;
    }
    async getContents(refSpec, path) {
        return (await this.runGit('show', `${refSpec}:${path}`)).stdout;
    }
    async getJSONContents(refSpec, path) {
        return JSON.parse((await this.runGit('show', `${refSpec}:${path}`)).stdout);
    }
    async listTree(refSpec, path) {
        let contents = (await this.runGit('ls-tree', `${refSpec}:${path}`)).stdout;
        return contents.split("\n").filter(line => line.length > 0).map(line => {
            let [filemode, type, oid, name] = line.split(/\s+/);
            return { filemode, type, oid, name };
        });
    }
}
const formats = {
    id: 'H',
    authorName: 'an',
    authorEmail: 'ae',
    authorDate: 'ai',
    committerName: 'cn',
    committerEmail: 'ce',
    message: 'B'
};
async function run(command, args, opts) {
    return await new Promise(function (resolve, reject) {
        let p = child_process_1.spawn(command, args, opts || {});
        let stderr = '';
        let stdout = '';
        p.stdout.on('data', function (output) {
            stdout += output;
        });
        p.stderr.on('data', function (output) {
            stderr += output;
        });
        p.on('close', function (code) {
            if (code !== 0) {
                let err = new Error(command + " " + args.join(" ") + " exited with nonzero status");
                err.stderr = stderr;
                err.stdout = stdout;
                reject(err);
            }
            else {
                let result = { stdout, stderr };
                resolve(result);
            }
        });
    });
}
function commitOpts(opts) {
    return Object.assign({}, {
        authorName: 'John Milton',
        authorEmail: 'john@paradiselost.com',
        message: 'Default test message'
    }, opts);
}
exports.commitOpts = commitOpts;
async function makeRepo(path, files) {
    let change = await change_1.default.createInitial(path, 'master');
    let repo = change.repo;
    if (files) {
        for (let [filename, content] of Object.entries(files)) {
            let file = await change.get(filename, { allowCreate: true });
            file.setContent(content);
        }
    }
    let opts = commitOpts({
        message: 'First commit'
    });
    let head = await change.finalize(opts);
    return { head, repo };
}
exports.makeRepo = makeRepo;
//# sourceMappingURL=support.js.map