import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// 解决 better-sqlite3 的类型引用问题
type BetterDatabase = any;

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
    private db: BetterDatabase;
    private storagePath: string = '';

    constructor() {}

    public setStoragePath(p: string) {
        const dbPath = p.endsWith('.db') ? p : path.join(path.dirname(p), 'fast-send.db');
        this.storagePath = dbPath;
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        this.db = new Database(dbPath);
        this.init();
    }

    private init() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY,
                type TEXT NOT NULL,
                content TEXT,
                filename TEXT,
                originalName TEXT,
                size TEXT,
                time TEXT NOT NULL,
                fullTime TEXT NOT NULL,
                senderId TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);
    }

    public getSetting(key: string, defaultValue: string = ''): string {
        if (!this.db) return defaultValue;
        const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
        return row ? row.value : defaultValue;
    }

    public setSetting(key: string, value: string): void {
        if (!this.db) throw new Error('Database not initialized');
        this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
    }

    public getAll(): SharedItem[] {
        if (!this.db) return [];
        return this.db.prepare('SELECT * FROM items ORDER BY id DESC LIMIT 100').all() as SharedItem[];
    }

    public add(item: Omit<SharedItem, 'id'>): SharedItem {
        if (!this.db) throw new Error('Database not initialized');
        
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const stmt = this.db.prepare(`
            INSERT INTO items (id, type, content, filename, originalName, size, time, fullTime, senderId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run(
            id,
            item.type,
            item.content || null,
            item.filename || null,
            item.originalName || null,
            item.size || null,
            item.time,
            item.fullTime,
            item.senderId
        );

        return { ...item, id };
    }

    public remove(id: number): boolean {
        if (!this.db) return false;
        const result = this.db.prepare('DELETE FROM items WHERE id = ?').run(id);
        return result.changes > 0;
    }

    public clear(): void {
        if (!this.db) return;
        this.db.prepare('DELETE FROM items').run();
    }
}

export const db = new DataStore();
export const setStoragePath = (p: string) => db.setStoragePath(p);
