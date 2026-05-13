package db

import (
	"database/sql"
	"encoding/json"
	"fastsend/internal/config"
	"fastsend/internal/models"
	"log"
	"path/filepath"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func InitDB() *Store {
	dbPath := filepath.Join(config.BaseDir, "fast-send.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}

	_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS items (
				id INTEGER PRIMARY KEY,
				type TEXT NOT NULL,
				content TEXT,
				filename TEXT,
				originalName TEXT,
				files TEXT,
				size TEXT,
				time TEXT NOT NULL,
				fullTime TEXT NOT NULL,
				senderId TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT
			);
		`)
	if err != nil {
		log.Fatal(err)
	}

	// 检查并添加缺失的列
	rows, err := db.Query("PRAGMA table_info(items)")
	if err == nil {
		hasFiles := false
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dflt_value interface{}
			rows.Scan(&cid, &name, &ctype, &notnull, &dflt_value, &pk)
			if name == "files" {
				hasFiles = true
			}
		}
		rows.Close()
		if !hasFiles {
			db.Exec("ALTER TABLE items ADD COLUMN files TEXT")
		}
	}

	return &Store{db: db}
}

func (s *Store) GetItems() ([]models.SharedItem, error) {
	rows, err := s.db.Query("SELECT id, type, content, filename, originalName, files, size, time, fullTime, senderId FROM items ORDER BY id DESC LIMIT 100")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []models.SharedItem{}
	for rows.Next() {
		var item models.SharedItem
		var content, filename, originalName, size, filesJSON sql.NullString
		err := rows.Scan(&item.ID, &item.Type, &content, &filename, &originalName, &filesJSON, &size, &item.Time, &item.FullTime, &item.SenderID)
		if err != nil {
			continue
		}
		item.Content = content.String
		item.Filename = filename.String
		item.OriginalName = originalName.String
		item.Size = size.String
		if filesJSON.Valid && filesJSON.String != "" {
			json.Unmarshal([]byte(filesJSON.String), &item.Files)
		}
		items = append(items, item)
	}
	return items, nil
}

func (s *Store) AddItem(item models.SharedItem) error {
	filesJSON := ""
	if item.Type == "gallery" && len(item.Files) > 0 {
		b, _ := json.Marshal(item.Files)
		filesJSON = string(b)
	}

	_, err := s.db.Exec(`INSERT INTO items (id, type, content, filename, originalName, files, size, time, fullTime, senderId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID, item.Type, item.Content, item.Filename, item.OriginalName, filesJSON, item.Size, item.Time, item.FullTime, item.SenderID)
	return err
}

func (s *Store) DeleteItem(id string) error {
	_, err := s.db.Exec("DELETE FROM items WHERE id = ?", id)
	return err
}

func (s *Store) GetFilename(id string) (string, error) {
	var filename string
	err := s.db.QueryRow("SELECT filename FROM items WHERE id = ?", id).Scan(&filename)
	return filename, err
}

func (s *Store) GetSetting(key string) string {
	var value string
	err := s.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err != nil {
		return ""
	}
	return value
}

func (s *Store) SetSetting(key, value string) error {
	_, err := s.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
	return err
}

func (s *Store) Reinit(newBaseDir string) error {
	dbPath := filepath.Join(newBaseDir, "fast-send.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
			CREATE TABLE IF NOT EXISTS items (
				id INTEGER PRIMARY KEY,
				type TEXT NOT NULL,
				content TEXT,
				filename TEXT,
				originalName TEXT,
				files TEXT,
				size TEXT,
				time TEXT NOT NULL,
				fullTime TEXT NOT NULL,
				senderId TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT
			);
		`)
	if err != nil {
		db.Close()
		return err
	}

	// 检查并添加缺失的列
	rows, err := db.Query("PRAGMA table_info(items)")
	if err == nil {
		hasFiles := false
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dflt_value interface{}
			rows.Scan(&cid, &name, &ctype, &notnull, &dflt_value, &pk)
			if name == "files" {
				hasFiles = true
			}
		}
		rows.Close()
		if !hasFiles {
			db.Exec("ALTER TABLE items ADD COLUMN files TEXT")
		}
	}

	oldDB := s.db
	s.db = db
	if oldDB != nil {
		oldDB.Close()
	}
	return nil
}

func (s *Store) Raw() *sql.DB {
	return s.db
}
