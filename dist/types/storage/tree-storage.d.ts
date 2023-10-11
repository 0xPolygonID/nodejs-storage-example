import { Bytes, Hash, ITreeStorage, Node } from '@iden3/js-merkletree';
import { Collection } from 'mongodb';
export declare class MongoDBStorage implements ITreeStorage {
    #private;
    private readonly _prefix;
    private readonly _collection;
    private readonly _prefixHash;
    constructor(_prefix: Bytes, _collection: Collection<any>);
    get(k: Bytes): Promise<Node | undefined>;
    put(k: Bytes, n: Node): Promise<void>;
    getRoot(): Promise<Hash>;
    setRoot(r: Hash): Promise<void>;
}