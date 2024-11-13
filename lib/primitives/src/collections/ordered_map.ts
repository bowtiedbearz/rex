import { none, type Option, some } from "@bearz/functional";


export class OrderedMap<K, V> extends Map<K, V> {
    #keys: K[] = [];

    override keys(): MapIterator<K> {
        return Iterator.from(this.#keys);
    }

    override values(): MapIterator<V> {
        return Iterator.from(this.#keys.map((key) => this.get(key) as V));
    }

    override entries(): MapIterator<[K, V]> {
        return Iterator.from(this.#keys.map((key) => [key, this.get(key)] as [K, V]));
    }

    add(key: K, value: V): boolean {
        if (!this.has(key)) {
            this.#keys.push(key);
            super.set(key, value);
            return true;
        }

        return false;
    }

    at(index: number): Option<[K, V]> {
        const key = this.#keys[index];
        if (key === undefined) {
            return none();
        }

        const value = this.get(key);
        if (value === undefined) {
            return none();
        }

        return some([key, value]);
    }

    valueAt(index: number): Option<V> {
        const key = this.#keys[index];
        if (key === undefined) {
            return none();
        }
        return some(this.get(key) as V);
    }

    keyAt(index: number): Option<K> {
        const key = this.#keys[index];
        if (key === undefined) {
            return none();
        }
        return some(key);
    }

    override set(key: K, value: V) {
        if (!this.has(key)) {
            this.#keys.push(key);
        }

        return super.set(key, value);
    }

    override delete(key: K) {
        const index = this.#keys.indexOf(key);
        if (index !== -1) {
            this.#keys.splice(index, 1);
        }

        return super.delete(key);
    }

    override clear() {
        this.#keys = [];
        return super.clear();
    }

    toJSON() {
        return this.#keys.map((key) => [key, this.get(key)]);
    }
}
