// nodegit provides Treebuilder, which lets us mutate a
// not-yet-written tree. But you can't recursively put a Treebuilder
// inside a Treebuilder. That's where this class comes in.

const { TreeEntry, Treebuilder, Blob } = require('nodegit');
const { FILEMODE } = TreeEntry;
const tombstone = {};

class MutableTree {
  constructor(repo, tree) {
    this.repo = repo;
    this.tree = tree;
    this.overlay = new Map();
  }
  entryByName(name) {
    if (this.overlay.has(name)) {
      return this.overlay.get(name);
    }
    let result;
    let entry;
    if (this.tree) {
      entry = safeEntryByName(this.tree, name);
    }
    if (entry) {
      result = new MutableEntryWrapper(this.repo, entry);
    }
    this.overlay.set(name, result);
    return result;
  }

  // object is a Blob, MutableBlob, Tree, or MutableTree
  insert(filename, object, filemode) {
    let entry = new NewEntry(this.repo, object, filemode);
    this.overlay.set(filename, entry);
    return entry;
  }

  async insertPath(path, object, filemode, { allowCreate, allowUpdate }) {
    let { tree, leaf, leafName } = await this.traverse(path, allowCreate);

    if (!allowUpdate && leaf && leaf !== tombstone) {
      throw new OverwriteRejected(`Refusing to overwrite ${path}`);
    }

    if (!allowCreate && (!leaf || leaf === tombstone)) {
      throw new NotFound(`${path} does not exist`);
    }

    return tree.insert(leafName, object, filemode);
  }

  async deletePath(path) {
    let { tree, leaf, leafName } = await this.traverse(path);
    if (!leaf || leaf === tombstone) {
      throw new NotFound(`No such file ${path}`);
    }
    tree.overlay.set(leafName, tombstone);
  }

  async patchPath(path, patcher, patcherArg, { allowCreate }) {
    let { tree, leaf, leafName } = await this.traverse(path, allowCreate);
    if (!leaf || leaf === tombstone || !leaf.isBlob()) {
      throw new NotFound(`No such file ${path}`);
    }
    let originalBuffer = (await leaf.getBlob()).content();
    let newBuffer = patcher(originalBuffer, patcherArg);
    if (newBuffer) {
      return tree.insert(leafName, newBuffer, leaf.filemode());
    }
  }

  async traverse(path, allowCreate=false) {
    let parts = path.split('/');
    let here = this;

    while (parts.length > 1) {
      let dirName = parts.shift();
      let entry = here.entryByName(dirName);
      if (!entry || !entry.isTree()) {
        if (!allowCreate) {
          throw new NotFound(`${path} does not exist`);
        }
        entry = here.insert(dirName, new MutableTree(here.repo, null), FILEMODE.TREE);
      }
      here = await entry.getTree();
    }

    return {
      tree: here,
      leaf: here.entryByName(parts[0]),
      leafName: parts[0]
    };
  }

  async write(allowEmpty=false) {
    if (this.overlay.size === 0 && this.tree) {
      return this.tree.id();
    }
    let builder = await Treebuilder.create(this.repo, this.tree);
    for (let [filename, entry] of this.overlay.entries()) {
      if (entry === tombstone) {
        builder.remove(filename);
      } else {
        let childId = await entry.write();
        if (childId) {
          await builder.insert(filename, childId, entry.filemode());
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
  constructor(repo, buffer) {
    this.repo = repo;
    this.buffer = buffer;
  }
  content() {
    return this.buffer;
  }
  async write() {
    return Blob.createFromBuffer(this.repo, this.buffer, this.buffer.length);
  }
}

class MutableEntryWrapper {
  constructor(repo, entry) {
    this.repo = repo;
    this.entry = entry;
    this._mutableTree = null;
  }
  filemode() {
    return this.entry.filemode();
  }
  isBlob() {
    return this.entry.isBlob();
  }
  isTree() {
    return this.entry.isTree();
  }
  async getBlob() {
    return this.entry.getBlob();
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

class NewEntry {
  constructor(repo, object, filemode) {
    this.repo = repo;
    this._filemode = filemode;
    if (this.isTree() && !(object instanceof MutableTree)) {
      this._object = new MutableTree(repo, object);
    } else if (this.isBlob() && object instanceof Buffer) {
      this._object = new MutableBlob(repo, object);
    } else {
      this._object = object;
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
    return this._object;
  }
  async getTree() {
    return this._object;
  }
  async write() {
    if (this.isBlob()) {
      if (this._object instanceof MutableBlob) {
        return this._object.write();
      } else {
        return this._object.id();
      }
    } else {
      return this._object.write();
    }
  }
}

class NotFound extends Error {}
class OverwriteRejected extends Error {}

module.exports = { MutableTree, MutableBlob, safeEntryByName, NotFound, OverwriteRejected };

function safeEntryByName(tree, name) {
  // This is apparently private API. There's unfortunately no public
  // API for gracefully attempting to retriee and entry that may be
  // absent.
  let entry = tree._entryByName(name);
  if (entry) {
    entry.parent = tree;
  }
  return entry;
}
