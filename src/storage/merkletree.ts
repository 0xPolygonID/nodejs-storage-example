import { Merkletree, str2Bytes } from '@iden3/js-merkletree';
import * as uuid from 'uuid';

import {
  IdentityMerkleTreeMetaInformation,
  IMerkleTreeStorage,
  MerkleTreeType
} from '@0xpolygonid/js-sdk';
import { MongoDataSource } from './data-source';
import { MongoDataSourceFactory, MongoDBTreeStorageFactory } from './data-source-factory';
import { Db } from 'mongodb';

export const MERKLE_TREE_TYPES: MerkleTreeType[] = [
  MerkleTreeType.Claims,
  MerkleTreeType.Revocations,
  MerkleTreeType.Roots
];

const createMerkleTreeMetaInfo = (identifier: string): IdentityMerkleTreeMetaInformation[] => {
  const treesMeta: IdentityMerkleTreeMetaInformation[] = [];
  for (let index = 0; index < MERKLE_TREE_TYPES.length; index++) {
    const mType = MERKLE_TREE_TYPES[index];
    const treeId = `${identifier}+${mType}`;
    treesMeta.push({ treeId, identifier, type: mType });
  }
  return treesMeta;
};

/**
 * Merkle tree storage that uses mongo db storage
 *
 * @public
 * @class MerkleTreeMongodDBStorage
 * @implements implements IMerkleTreeStorage interface
 */
export class MerkleTreeMongodDBStorage implements IMerkleTreeStorage {
  /**
   * Creates an instance of MerkleTreeIndexedDBStorage.
   * @param {number} _mtDepth
   * @param {MongoDataSource<any>} _merkleTreeMetaStore
   * @param {MongoDataSource<any>} _bindingStore
   */
  private constructor(
    private readonly _mtDepth: number,
    private readonly _merkleTreeMetaStore: MongoDataSource<any>,
    private readonly _bindingStore: MongoDataSource<any>,
    private readonly _db: Db // private readonly _treeStorageMongoConnectionURL: string,
  ) // private readonly _dbName: string
  {}

  public static async setup(db: Db, mtDepth: number): Promise<MerkleTreeMongodDBStorage> {
    let metastore = await MongoDataSourceFactory<any>(db, 'meta_store');
    let bindingstore = await MongoDataSourceFactory<any>(db, 'binding_store');

    return new MerkleTreeMongodDBStorage(mtDepth, metastore, bindingstore, db);
  }

  /** creates a tree in the indexed db storage */
  async createIdentityMerkleTrees(
    identifier: string
  ): Promise<IdentityMerkleTreeMetaInformation[]> {
    if (!identifier) {
      identifier = `${uuid.v4()}`;
    }
    const existingBinging = await this._bindingStore.get(identifier);
    if (existingBinging) {
      throw new Error(
        `Present merkle tree meta information in the store for current identifier ${identifier}`
      );
    }

    const treesMeta = createMerkleTreeMetaInfo(identifier);
    await this._merkleTreeMetaStore.save(identifier, { meta: JSON.stringify(treesMeta) });
    return treesMeta;
  }
  /**
   *
   * getIdentityMerkleTreesInfo from the mongo db storage
   * @param {string} identifier
   * @returns `{Promise<IdentityMerkleTreeMetaInformation[]>}`
   */
  async getIdentityMerkleTreesInfo(
    identifier: string
  ): Promise<IdentityMerkleTreeMetaInformation[]> {
    const meta = await this._merkleTreeMetaStore.get(identifier);
    if (meta && meta.meta) {
      return JSON.parse(meta.meta);
    }
    throw new Error(`Merkle tree meta not found for identifier ${identifier}`);
  }

  /** get merkle tree from the mongo db storage */
  async getMerkleTreeByIdentifierAndType(
    identifier: string,
    mtType: MerkleTreeType
  ): Promise<Merkletree> {
    let meta = await this._merkleTreeMetaStore.get(identifier);
    const err = new Error(`Merkle tree not found for identifier ${identifier} and type ${mtType}`);
    if (!meta) {
      throw err;
    }

    meta = JSON.parse(meta.meta);
    const resultMeta = meta.find(
      (m: { identifier: string; type: MerkleTreeType }) =>
        m.identifier === identifier && m.type === mtType
    );
    if (!resultMeta) {
      throw err;
    }

    const mongoDBTreeStorage = await MongoDBTreeStorageFactory(
      this._db,
      str2Bytes(resultMeta.treeId)
    );
    return new Merkletree(mongoDBTreeStorage, true, this._mtDepth);
  }
  /** adds to merkle tree in the mongo db storage */
  async addToMerkleTree(
    identifier: string,
    mtType: MerkleTreeType,
    hindex: bigint,
    hvalue: bigint
  ): Promise<void> {
    let meta = await this._merkleTreeMetaStore.get(identifier);
    if (!meta || !meta.meta) {
      throw new Error(`Merkle tree meta not found for identifier ${identifier}`);
    }
    meta = JSON.parse(meta.meta);
    const resultMeta = meta.find(
      (m: { identifier: string; type: MerkleTreeType }) =>
        m.identifier === identifier && m.type === mtType
    );
    if (!resultMeta) {
      throw new Error(`Merkle tree not found for identifier ${identifier} and type ${mtType}`);
    }

    const mongoDBTreeStorage = await MongoDBTreeStorageFactory(
      this._db,
      str2Bytes(resultMeta.treeId)
    );
    const tree = new Merkletree(mongoDBTreeStorage, true, this._mtDepth);

    await tree.add(hindex, hvalue);
  }

  /** binds merkle tree in the mongo db storage to the new identifiers */
  async bindMerkleTreeToNewIdentifier(oldIdentifier: string, newIdentifier: string): Promise<void> {
    let meta = await this._merkleTreeMetaStore.get(oldIdentifier);
    if (!meta || !meta?.meta.length) {
      throw new Error(`Merkle tree meta not found for identifier ${oldIdentifier}`);
    }

    meta = JSON.parse(meta.meta);

    const treesMeta = meta.map((m: { identifier: string; type: MerkleTreeType }) => ({
      ...m,
      identifier: newIdentifier
    }));

    await this._merkleTreeMetaStore.delete(oldIdentifier);
    await this._merkleTreeMetaStore.save(newIdentifier, { meta: JSON.stringify(treesMeta) });
    await this._bindingStore.save(oldIdentifier, { new: newIdentifier });
  }
}
