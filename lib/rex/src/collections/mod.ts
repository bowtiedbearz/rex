import { type Option, none, some } from '@bearz/functional';
import { equalFold } from "@bearz/strings/equal";

export interface ProxyObject extends Record<string, unknown>  {
}

function proxy<T extends ProxyObject>(map: Map<string, unknown>) : ProxyObject {
    return new Proxy({}, {
        get(_, key) {
            if (typeof key === 'string' && key !== "") {
                return map.get(key);
            }

            return undefined;
        },
        deleteProperty(_, key) {
            if (typeof key !== 'string') {
                return false;
            }

            return map.delete(key);
        },
        has(_, key) {
            if (typeof key !== 'string') {
                return false;
            }

            return map.has(key);
        },
        ownKeys(_) {
            return Array.from(map.keys());
        },
        set(_, key, value) {
            if (typeof key !== 'string') {
                return false;
            }

            map.set(key as string, value);
           
            return true;
        },
    }) as ProxyObject;
}

export class ProxyMap<V = unknown> extends Map<string, V> {
    #proxy?: ProxyObject

    empty() : boolean {
        return this.size === 0;
    }

    get proxy() : ProxyObject {
        if (!this.#proxy) {
            this.#proxy = proxy(this);
        }

        return this.#proxy;
    }

    exists(key: string): boolean {
        const value = this.get(key);
        return value !== undefined && value !== null;
    }

    merge(obj: Record<string, V> | ProxyMap<V>) : this {
        if (obj instanceof ProxyMap) {
            obj = obj.toObject();
        }

        for (const [key, value] of Object.entries(obj)) {
            this.set(key, value);
        }

        return this;
    }

    tryGet(key: string) : Option<V> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        return some(value as V);
    }

    query(path: string) : Option<V> {
        const keys = path.split('.');
        let value: unknown = this as ProxyMap<V>;
        for (const key of keys) {
            if (value === null || value === undefined)
                return none()

            if (Array.isArray(value)) {
                const index = Number.parseInt(key);
                if (Number.isNaN(index)) {
                    return none();
                }

                value = value[index];
                continue;
            }

            if (value instanceof ProxyMap) {
                if (!value.has(key)) {
                    return none();
                }

                value = value.get(key);
                continue;
            }

            if (typeof value === 'object' && value !== null) {
                value = (value as Record<string, unknown>)[key];
                continue;
            }

            return none();
        }

        return some(value as V);
    }

    toJSON() {
        return Object.fromEntries(this.entries());
    }

    toObject() : Record<string, V> {
        return Object.fromEntries(this.entries()) as Record<string, V>;
    }
}

export class StringMap extends ProxyMap<string> {

    static fromObject(obj: Record<string, string>): StringMap {
        const map = new StringMap();
        for (const [key, value] of Object.entries(obj)) {
            map.set(key, value);
        }
        return map;
    }

    override toObject(): Record<string, string> {
        const obj: Record<string, string> = {};
        for (const [key, value] of this.entries()) {
            obj[key] = value;
        }
        return obj;
    }

    boolean(key: string): Option<boolean> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        return some(equalFold(value, 'true') || equalFold(value, '1'));
    }

    int(key: string): Option<number> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        if (value === '') {
            return none();
        }

        const n = Number.parseInt(value);
        if (!Number.isNaN(n)) {
            return some(n);
        }
        
        return none();
    }
    
    bigint(key: string): Option<bigint> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        if (value === '') {
            return none();
        }

        if (value === '') {
            return none();
        }

        const n = Number.parseInt(value);
        if (isNaN(n)) {
            return none();
        }
        
        return some(BigInt(n));
    }

    number(key: string): Option<number> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        if (value === '') {
            return none();
        }

        const n = Number.parseFloat(value);
        if (!Number.isNaN(n)) {
            return some(n);
        }

        return none();
    }
}

export class ObjectMap extends ProxyMap<unknown> {

    array<T = unknown>(key: string): Option<T[]> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        if (!Array.isArray(value)) {
            return none();
        }

        return some(value as T[]);
    }

    string(key: string): Option<string> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        if (typeof value !== 'string') {
            return none();
        }

        return some(value as string);
    }

    boolean(key: string): Option<boolean> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        switch(typeof value) {
            case 'boolean':
                return some(value as boolean);
            case 'string':
                return some(value === 'true' || value === '1');
            case 'number':
                return some(value !== 0);
            case 'bigint':
                return some(value !== 0n);
            default:
                return none();
        }
    }

    int(key: string): Option<number> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        switch(typeof value) {
            case 'number':
                {
                    if (!Number.isInteger(value)) {
                        return none();
                    }

                    return some(value as number);
                }
            case 'boolean':
                return some(value ? 1 : 0);
            case 'bigint':
                {
                    const n = Number(value);
                    if (!Number.isInteger(n)) {
                        return none();
                    }

                    return some(n);
                }
            case 'string':
                {
                    if (value === '') {
                        return none();
                    }

                    const n = Number.parseInt(value);
                    if (!Number.isNaN(n)) {
                        return some(n);
                    }
                    
                    return none();
                }
            default:
                return none();
        }
    }
    
    bigint(key: string): Option<bigint> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        switch(typeof value) {
            case 'number':
                if (!Number.isInteger(value)) {
                    return none();
                }
                return some(BigInt(value as number));
            case 'boolean':
                return some(value ? BigInt(1) : BigInt(0));
            case 'bigint':
                return some(value as bigint);
            case 'string':
                {
                    if (value === '') {
                        return none();
                    }

                    const n = Number.parseInt(value);
                    if (isNaN(n)) {
                        return none();
                    }
                    
                    return some(BigInt(n));
                }
            default:
                return none();
        }
    }

    number(key: string): Option<number> {
        const value = this.get(key);
        if (value === undefined || value === null) {
            return none();
        }

        switch(typeof value) {
            case 'number':
                return some(value as number);
            case 'boolean':
                return some(value ? 1 : 0);
            case 'bigint':
                return some(Number(value));
            case 'string':
                {
                    if (value === '') {
                        return none();
                    }

                    const n = Number.parseFloat(value);
                    if (!Number.isNaN(n)) {
                        return some(n);
                    }
                    
                    return none();
                }
            default:
                return none();
        }
    }  
}

export class Outputs extends ObjectMap {
    static fromObject(obj: Record<string, unknown>): Outputs {
        const map = new Outputs();
        for (const [key, value] of Object.entries(obj)) {
            map.set(key, value);
        }
        return map;
    }
}

export class Inputs extends ObjectMap {
    static fromObject(obj: Record<string, unknown>): Inputs {
        const map = new Inputs();
        for (const [key, value] of Object.entries(obj)) {
            map.set(key, value);
        }
        return map;
    }
}



export class OrderedMap<K, V> extends Map<K, V> {
    #keys: K[] = [];

    override keys(): MapIterator<K> {
        return Iterator.from(this.#keys);
    }

    override values(): MapIterator<V> {
        return Iterator.from(this.#keys.map(key => this.get(key) as V));
    }

    override entries(): MapIterator<[K, V]> {
        return Iterator.from(this.#keys.map(key => [key, this.get(key)] as [K, V]));
    }

    add(key: K, value: V) : boolean {
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
        return this.#keys.map(key => [key, this.get(key)]);
    }
}