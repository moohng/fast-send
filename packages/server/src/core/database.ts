import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

/**
 * 共享项目的数据结构接口
 */
export interface SharedItem {
    id: number;
    type: 'text' | 'file';
    content?: string;
    filename?: string;
    originalName?: string;
    size?: string;
    time: string;
}

/**
 * 极简数据持久化工具 (JSON版)。
 */
class DataStore {
    private items: SharedItem[];
    private storagePath: string;

    constructor() {
        this.storagePath = path.join(__dirname, '../../fast-send-data.json');
        this.items = this._load();
    }

    private _load(): SharedItem[] {
        try {
            if (fs.existsSync(this.storagePath)) {
                return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
            }
        } catch (e) {
            console.error('Failed to load storage:', e);
        }
        return [];
    }

    private _save(): void {
        try {
            fs.writeFileSync(this.storagePath, JSON.stringify(this.items, null, 2));
        } catch (e) {
            console.error('Failed to save storage:', e);
        }
    }

    public getAll(): SharedItem[] {
        return this.items;
    }

    public add(item: Omit<SharedItem, 'id'>): SharedItem {
        const newItem = { ...item, id: Date.now() };
        this.items.unshift(newItem);
        if (this.items.length > 100) this.items.pop();
        this._save();
        return newItem;
    }

    /**
     * 根据 ID 删除记录
     */
    public remove(id: number): boolean {
        const initialLength = this.items.length;
        this.items = this.items.filter(i => i.id !== id);
        if (this.items.length !== initialLength) {
            this._save();
            return true;
        }
        return false;
    }

    public clear(): void {
        this.items = [];
        this._save();
    }
}

export const db = new DataStore();
