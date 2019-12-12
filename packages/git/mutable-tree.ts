// node git provides Treebuilder, which lets us mutate a
// not-yet-written tree. But you can't recursively put a Treebuilder
// inside a Treebuilder. That's where this class comes in.

import { Treebuilder, FILEMODE, Repository, Oid, Tree, TreeEntry as ConcreteTreeEntry, Blob } from './git';
import { todo } from '@cardstack/plugin-utils/todo-any';

interface Tombstone {
  tombstone: boolean;
  isTree: Function;
  getTree: Function;
}
const tombstone: Tombstone = {
  tombstone: true,
  isTree() {
    return false;
  },
  getTree() {},
};

export type TreeEntry =
  | ConcreteTreeEntry
  | NewEntry
  | MutableEntryWrapper
  | MutableTree
  | MutableBlob
  | Tombstone
  | undefined;

class MutableTree {
  overlay: Map<string, TreeEntry>;

  constructor(readonly repo: Repository, readonly tree?: Tree | MutableTree) {
    this.overlay = new Map();
  }

  entryByName(name: string): TreeEntry {
    if (this.overlay.has(name)) {
      return this.overlay.get(name);
    }
    let result;
    let entry;
    if (this.tree) {
      entry = this.tree.entryByName(name);
    }
    if (entry) {
      result = new MutableEntryWrapper(this.repo, entry as ConcreteTreeEntry);
    }
    this.overlay.set(name, result);
    return result;
  }

  _entryByName(name: string) {
    return this.entryByName(name);
  }

  insert(filename: string, object: TreeEntry | Buffer, filemode: FILEMODE) {
    let entry = new NewEntry(this.repo, object, filemode);
    this.overlay.set(filename, entry);
    return entry;
  }

  delete(filename: string) {
    this.overlay.set(filename, tombstone);
  }

  isBlob() {
    return false;
  }

  isTree() {
    return true;
  }

  getTree() {
    return this.tree;
  }

  async fileAtPath(path: string, allowCreate: boolean) {
    let { tree, leaf, leafName } = await this.traverse(path, allowCreate);
    if (!leaf || leaf === tombstone || !leaf.isBlob()) {
      leaf = undefined;
    }
    if (!leaf && !allowCreate) {
      debugger;
      throw new NotFound(`No such file ${path}`);
    }
    return { tree, leaf, leafName };
  }

  async traverse(path: string, allowCreate = false) {
    let parts = path.split('/');
    let here: todo = this;

    while (parts.length > 1) {
      let dirName = parts.shift();
      let entry: TreeEntry = here!.entryByName(dirName!);
      if (!entry || !entry.isTree()) {
        if (!allowCreate) {
          throw new NotFound(`${path} does not exist`);
        }
        entry = here!.insert(dirName!, new MutableTree(here!.repo), FILEMODE.TREE);
      }
      here = await entry!.getTree();
    }

    return {
      tree: here,
      leaf: here.entryByName(parts[0]),
      leafName: parts[0],
    };
  }

  filemode() {
    return FILEMODE.TREE;
  }

  async write(allowEmpty = false) {
    if (this.overlay.size === 0 && this.tree) {
      return (this.tree as Tree).id();
    }
    let builder = await Treebuilder.create(this.repo, this.tree as Tree);
    for (let [filename, entry] of this.overlay.entries()) {
      if (entry === tombstone) {
        builder.remove(filename);
      } else {
        let childId = await (entry! as MutableBlob).write();
        if (childId) {
          await builder.insert(filename, childId, (entry! as MutableTree).filemode());
        } else {
          builder.remove(filename);
        }
      }
    }
    if (builder.entrycount() > 0 || allowEmpty) {
      return builder.write();
    }
  }
}

class MutableBlob {
  constructor(readonly repo: Repository, readonly buffer: Buffer) {}
  content() {
    return this.buffer;
  }
  isBlob() {
    return true;
  }
  isTree() {
    return false;
  }
  getTree() {
    return null;
  }
  async write() {
    return await this.repo.createBlobFromBuffer(this.buffer);
  }
}

class MutableEntryWrapper {
  _mutableTree?: MutableTree;

  constructor(readonly repo: Repository, readonly entry: ConcreteTreeEntry) {}
  filemode() {
    return this.entry!.filemode();
  }
  isBlob() {
    return this.entry!.isBlob();
  }
  isTree() {
    return this.entry!.isTree();
  }
  id() {
    return this.entry!.id();
  }
  async getBlob() {
    return this.entry!.getBlob();
  }
  async getTree() {
    if (!this._mutableTree) {
      this._mutableTree = new MutableTree(this.repo, await this.entry.getTree());
    }
    return this._mutableTree;
  }
  async write() {
    if (this._mutableTree) {
      return this._mutableTree.write();
    } else {
      return this.entry.id();
    }
  }
}

export class NewEntry {
  _filemode: FILEMODE;
  _object: TreeEntry;
  savedId?: Oid;

  constructor(readonly repo: Repository, object: TreeEntry | Buffer, filemode: FILEMODE) {
    this._filemode = filemode;

    if (this.isTree() && !(object instanceof MutableTree)) {
      this._object = new MutableTree(repo, (object as unknown) as Tree);
    } else if (this.isBlob() && object instanceof Buffer) {
      this._object = new MutableBlob(repo, object);
    } else {
      this._object = object as TreeEntry;
    }
  }
  filemode() {
    return this._filemode;
  }
  isBlob() {
    return this._filemode & FILEMODE.BLOB;
  }
  isTree() {
    return this._filemode & FILEMODE.TREE;
  }
  async getBlob() {
    return this._object as MutableBlob;
  }
  async getTree() {
    return this._object;
  }
  async write() {
    return (this.savedId = await this._write());
  }

  id() {
    return this.savedId;
  }

  async _write(): Promise<Oid | undefined> {
    if (this.isBlob()) {
      if (this._object instanceof MutableBlob) {
        return this._object.write();
      } else {
        return ((this._object as unknown)! as Blob).id();
      }
    } else {
      return (this._object! as MutableTree).write();
    }
  }
}

class NotFound extends Error {}
class OverwriteRejected extends Error {}

export { MutableTree, MutableBlob, NotFound, OverwriteRejected };
