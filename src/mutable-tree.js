// nodegit provides Treebuilder, which lets us mutate a
// not-yet-written tree. But you can't recursively put a Treebuilder
// inside a Treebuilder. That's where this class comes in.

const { TreeEntry, Treebuilder, Blob } = require('nodegit');
const { FILEMODE } = TreeEntry;

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
      entry = this.tree.entryByName(name);
    }
    if (entry) {
      result = new MutableEntryWrapper(entry);
    }
    this.overlay.set(name, result);
    return result;
  }

  // object is a Blob, MutableBlob, Tree, or MutableTree
  insert(filename, object, filemode) {
    this.overlay.set(filename, new NewEntry(this.repo, object, filemode));
  }
  async write() {
    if (this.overlay.size === 0 && this.tree) {
      return this.tree;
    }
    let builder = await Treebuilder.create(this.repo, this.tree);
    for (let [filename, entry] of this.overlay.entries()) {
      await builder.insert(filename, await entry.write(), entry.filemode());
    }
    return builder.write();
  }
}

class MutableBlob {
  constructor(repo, buffer) {
    this.repo = repo;
    this.buffer = buffer;
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

module.exports = { MutableTree, MutableBlob };
