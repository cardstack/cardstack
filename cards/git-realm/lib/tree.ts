import { Repository, Oid } from './git';
import { readTree, ReadTreeResult, TreeEntry as igTreeEntry, readBlob, writeTree, writeBlob } from 'isomorphic-git';
import { join } from 'path';

export const enum FILEMODE {
  TREE = '040000',
  BLOB = '100644',
  EXECUTABLE = '100755',
  LINK = '120000',
  COMMIT = '160000',
}

export default class Tree {
  static async lookup(repo: Repository, oid: Oid, containingEntry?: TreeEntry) {
    let readResult = await readTree({
      gitdir: repo.gitdir,
      oid: oid.sha,
    });
    return new Tree(repo, containingEntry, readResult);
  }

  static create(repo: Repository, containingEntry?: TreeEntry) {
    return new Tree(repo, containingEntry);
  }

  private _entries: TreeEntry[];

  private oid?: Oid;
  public dirty: boolean = false;

  constructor(
    private readonly repo: Repository,
    private readonly containingEntry?: TreeEntry,
    readResult?: ReadTreeResult
  ) {
    if (readResult) {
      this._entries = readResult.tree.map(e => TreeEntry.build(repo, this, e));
      this.oid = new Oid(readResult.oid);
    } else {
      this.dirty = true;
      this._entries = [];
    }
  }

  id() {
    return this.oid;
  }

  entries() {
    return this._entries;
  }

  entryByName(name: string) {
    return this._entries.find(e => e.name() === name);
  }

  insert(name: string, contents: Tree | Buffer, filemode: FILEMODE) {
    this.removeEntryByName(name);
    let entry = TreeEntry.create(this.repo, this, name, contents, filemode);
    this._entries.push(entry);
    this.makeDirty();
    return entry;
  }

  private removeEntryByName(name: string) {
    this._entries = this._entries.filter(e => e.name() !== name);
    this.makeDirty();
  }

  makeDirty() {
    this.dirty = true;
    if (this.containingEntry) {
      this.containingEntry.makeDirty();
    }
  }

  async delete(name: string) {
    this.removeEntryByName(name);
  }

  async fileAtPath(path: string, allowCreate: boolean) {
    let tombstone;
    let { tree, leaf, leafName } = await this.traverse(path, allowCreate);
    if (!leaf || leaf === tombstone || !leaf.isBlob()) {
      leaf = undefined;
    }
    if (!leaf && !allowCreate) {
      throw new FileNotFound(`No such file ${path}`);
    }
    return { tree, leaf, leafName };
  }

  async traverse(path: string, allowCreate = false) {
    let parts = path.split('/');
    let here: Tree = this;

    while (parts.length > 1) {
      let dirName = parts.shift();
      let entry: TreeEntry | undefined = here.entryByName(dirName!);
      if (!entry || !entry.isTree()) {
        if (!allowCreate) {
          throw new FileNotFound(`${path} does not exist`);
        }
        entry = here.insert(dirName!, Tree.create(here.repo, entry), FILEMODE.TREE);
      }
      here = await entry!.getTree();
    }

    return {
      tree: here,
      leaf: here.entryByName(parts[0]),
      leafName: parts[0],
    };
  }

  path(): string {
    if (this.containingEntry) {
      return this.containingEntry.path();
    } else {
      return '';
    }
  }

  async write(allowEmpty = false): Promise<Oid | undefined> {
    if (!this.dirty) {
      return this.id()!;
    }
    for (let entry of this.entries()) {
      await entry.write();
    }

    if (this.entries().length || allowEmpty) {
      let sha = await writeTree({
        gitdir: this.repo.gitdir,
        tree: this.entries().map(e => e.toTreeObject()),
      });
      this.oid = new Oid(sha);
      this.dirty = false;
      return this.id()!;
    } else if (this.containingEntry) {
      this.containingEntry.removeFromParent();
    }
  }
}

interface Blob {
  id: Oid | null;
  content(): Buffer;
}

export class TreeEntry {
  private oid?: Oid;

  static create(repo: Repository, tree: Tree, name: string, contents: Tree | Buffer, filemode: FILEMODE) {
    return new TreeEntry(repo, tree, undefined, name, contents, filemode);
  }

  static build(repo: Repository, tree: Tree, entry: igTreeEntry) {
    return new TreeEntry(repo, tree, entry);
  }

  private dirty: boolean;

  constructor(
    private readonly repo: Repository,
    private readonly tree: Tree,
    private readonly entry?: igTreeEntry,
    private readonly _name?: string,
    private contents?: Tree | Buffer,
    private readonly _filemode?: FILEMODE
  ) {
    if (this.entry) {
      this.dirty = false;
      this.oid = new Oid(this.entry.oid);
    } else {
      this.dirty = true;
    }
  }

  name() {
    return this._name || this.entry!.path;
  }

  path() {
    return join(this.tree.path(), this.name());
  }

  id() {
    return this.oid || null;
  }

  isTree() {
    return this.contents instanceof Tree || (this.entry && this.entry.type == 'tree');
  }

  isBlob() {
    return this.contents instanceof Buffer || (this.entry && this.entry.type == 'blob');
  }

  filemode(): FILEMODE {
    return this._filemode || (this.entry!.mode as FILEMODE);
  }

  async write() {
    if (this.isTree()) {
      let tree = await this.getTree();
      this.oid = await tree.write();
      // this.tree.insert(this.name(), tree, FILEMODE.TREE);
      this.dirty = false;
      return;
    }

    if (!this.dirty) {
      return;
    }

    let sha = await writeBlob({
      gitdir: this.repo.gitdir,
      blob: this.contents as Buffer,
    });

    this.oid = new Oid(sha);

    this.dirty = false;
  }

  async getTree() {
    if (this.isTree() && this.contents) {
      return this.contents as Tree;
    }
    let tree = await Tree.lookup(this.repo, this.id()!, this);
    this.contents = tree;
    return tree;
  }

  makeDirty() {
    this.dirty = true;
    this.tree.makeDirty();
  }

  toTreeObject(): igTreeEntry {
    return {
      mode: this.filemode(),
      path: this.name(),
      type: this.isBlob() ? 'blob' : 'tree',
      oid: this.oid!.sha,
    };
  }

  removeFromParent() {
    this.tree.delete(this.name());
  }

  async getBlob(): Promise<Blob> {
    if (this.contents) {
      let content = this.contents as Buffer;
      return {
        id: null,
        content() {
          return content;
        },
      };
    }
    let { blob: content } = await readBlob({
      gitdir: this.repo.gitdir,
      oid: this.entry!.oid,
    });

    return {
      id: this.id(),
      content() {
        return content;
      },
    };
  }
}

export class FileNotFound extends Error {}
export class OverwriteRejected extends Error {}
