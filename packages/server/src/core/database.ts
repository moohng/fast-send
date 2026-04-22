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
    fullTime: string;
    senderId: string;
}

class DataStore {
    private items: SharedItem[];
    private storagePath: string = '';

    constructor() {
        this.items = [];
    }

    public setStoragePath(p: string) {
        this.storagePath = p;
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        this.items = this._load();
    }

    private _load(): SharedItem[] {
        try {
            if (this.storagePath && fs.existsSync(this.storagePath)) {
                return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
            }
        } catch (e) { console.error(e); }
        return [];
    }

    private _save(): void {
        try {
            if (!this.storagePath) return;
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
export const setStoragePath = (p: string) => db.setStoragePath(p);
