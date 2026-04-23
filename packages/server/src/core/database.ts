import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

// 解决 better-sqlite3 的类型引用问题
type BetterDatabase = any;

export interface FileInfo {
    filename: string;
    originalName: string;
    size: string;
    type: 'image' | 'video' | 'file';
}

export interface SharedItem {
    id: number;
    type: 'text' | 'file' | 'gallery';
    content?: string;
    filename?: string;
    originalName?: string;
    size?: string;
    files?: FileInfo[];
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
                files TEXT,
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
        try {
            const rows = this.db.prepare('SELECT * FROM items ORDER BY id DESC LIMIT 100').all() as any[];
            return rows.map(row => {
                let files = undefined;
                if (row.files) {
                    try {
                        files = JSON.parse(row.files);
                    } catch (e) {
                        console.error('Failed to parse files JSON:', row.files);
                    }
                }
                return {
                    ...row,
                    files
                };
            });
        } catch (err) {
            console.error('Database getAll error:', err);
            return [];
        }
    }

    public add(item: Omit<SharedItem, 'id'>): SharedItem {
        if (!this.db) throw new Error('Database not initialized');

        const id = Date.now() + Math.floor(Math.random() * 1000);
        try {
            const stmt = this.db.prepare(`
                INSERT INTO items (id, type, content, filename, originalName, size, files, time, fullTime, senderId)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            stmt.run(
                id,
                item.type || 'text',
                item.content === undefined ? null : item.content,
                item.filename === undefined ? null : item.filename,
                item.originalName === undefined ? null : item.originalName,
                item.size === undefined ? null : item.size,
                item.files ? JSON.stringify(item.files) : null,
                item.time || new Date().toLocaleTimeString(),
                item.fullTime || new Date().toISOString(),
                item.senderId || 'unknown'
            );

            return { ...item, id };
        } catch (err) {
            console.error('Database add error:', err);
            throw err;
        }
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
