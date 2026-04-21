import * as fs from 'fs';
import * as path from 'path';

export interface SharedItem {
    id: number;
    type: 'text' | 'file';
    content?: string;
    filename?: string;
    originalName?: string;
    size?: string;
    time: string;
    senderId: string; // 必须持久化
}

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
        } catch (e) { console.error(e); }
        return [];
    }

    private _save(): void {
        try {
            fs.writeFileSync(this.storagePath, JSON.stringify(this.items, null, 2));
        } catch (e) { console.error(e); }
    }

    public getAll(): SharedItem[] { return this.items; }

    public add(item: Omit<SharedItem, 'id'>): SharedItem {
        const newItem = { ...item, id: Date.now() + Math.floor(Math.random() * 1000) };
        this.items.unshift(newItem);
        if (this.items.length > 100) this.items.pop();
        this._save();
        return newItem;
    }

    public remove(id: number): boolean {
        const initialLength = this.items.length;
        this.items = this.items.filter(i => i.id !== id);
        if (this.items.length !== initialLength) { this._save(); return true; }
        return false;
    }

    public clear(): void { this.items = []; this._save(); }
}

export const db = new DataStore();
