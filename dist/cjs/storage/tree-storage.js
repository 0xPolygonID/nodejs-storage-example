"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _MongoDBTreeStorage_currentRoot;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongoDBTreeStorage = void 0;
const js_merkletree_1 = require("@iden3/js-merkletree");
class MongoDBTreeStorage {
    constructor(_collection, _prefix, _prefixHash, currentRoot) {
        this._collection = _collection;
        this._prefix = _prefix;
        this._prefixHash = _prefixHash;
        _MongoDBTreeStorage_currentRoot.set(this, void 0);
        __classPrivateFieldSet(this, _MongoDBTreeStorage_currentRoot, currentRoot, "f");
    }
    static async setup(prefix, _collection) {
        const prefixHash = (0, js_merkletree_1.bytes2Hex)(prefix);
        const rootObj = await _collection.findOne({ key: prefixHash });
        let currentRoot;
        if (rootObj) {
            const value = JSON.parse(rootObj.value);
            currentRoot = js_merkletree_1.Hash.fromString(value);
        }
        else {
            currentRoot = js_merkletree_1.ZERO_HASH;
        }
        return new MongoDBTreeStorage(_collection, prefix, prefixHash, currentRoot);
    }
    async get(k) {
        const kBytes = new Uint8Array([...this._prefix, ...k]);
        const key = (0, js_merkletree_1.bytes2Hex)(kBytes);
        let obj = (await this._collection.findOne({ key: key })).value;
        if (obj === null || obj === undefined) {
            return undefined;
        }
        obj = JSON.parse(obj);
        if (obj.type === js_merkletree_1.NODE_TYPE_EMPTY) {
            return new js_merkletree_1.NodeEmpty();
        }
        if (obj.type === js_merkletree_1.NODE_TYPE_MIDDLE) {
            const cL = js_merkletree_1.Hash.fromString(obj.childL);
            const cR = js_merkletree_1.Hash.fromString(obj.childR);
            return new js_merkletree_1.NodeMiddle(cL, cR);
        }
        if (obj.type === js_merkletree_1.NODE_TYPE_LEAF) {
            const k = js_merkletree_1.Hash.fromString(obj.entry[0]);
            const v = js_merkletree_1.Hash.fromString(obj.entry[1]);
            return new js_merkletree_1.NodeLeaf(k, v);
        }
        throw new Error(`error: value found for key ${key} is not of type Node`);
    }
    async put(k, n) {
        const kBytes = new Uint8Array([...this._prefix, ...k]);
        const key = (0, js_merkletree_1.bytes2Hex)(kBytes);
        await this._collection.findOneAndDelete({ key: key });
        await this._collection.insertOne({ key: key, value: JSON.stringify(n) });
    }
    async getRoot() {
        return __classPrivateFieldGet(this, _MongoDBTreeStorage_currentRoot, "f");
    }
    async setRoot(r) {
        await this._collection.findOneAndDelete({ key: this._prefixHash });
        await this._collection.insertOne({ key: this._prefixHash, value: JSON.stringify(r) });
        __classPrivateFieldSet(this, _MongoDBTreeStorage_currentRoot, r, "f");
    }
}
exports.MongoDBTreeStorage = MongoDBTreeStorage;
_MongoDBTreeStorage_currentRoot = new WeakMap();
//# sourceMappingURL=tree-storage.js.map