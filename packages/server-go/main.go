package main

import (
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"database/sql"
	"encoding/base64"
	"encoding/json"

	"github.com/atotto/clipboard"
	"github.com/getlantern/systray"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/grandcat/zeroconf"
	"github.com/skip2/go-qrcode"
	"github.com/skratchdot/open-golang/open"
	_ "modernc.org/sqlite"
)

// Icon 数据 (一个简单的蓝色 16x16 图标，base64 简写)
var iconData = []byte{
	0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
	0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0xF3, 0xFF,
	0x61, 0x00, 0x00, 0x00, 0x19, 0x74, 0x45, 0x58, 0x74, 0x53, 0x6F, 0x66, 0x74, 0x77, 0x61, 0x72,
	0x65, 0x00, 0x61, 0x64, 0x6F, 0x62, 0x65, 0x20, 0x69, 0x6D, 0x61, 0x67, 0x65, 0x72, 0x65, 0x61,
	0x64, 0x79, 0x71, 0xC9, 0x65, 0x3C, 0x00, 0x00, 0x00, 0x2C, 0x49, 0x44, 0x41, 0x54, 0x78, 0xDA,
	0x62, 0xFC, 0xFF, 0xFF, 0x3F, 0x03, 0x0C, 0x20, 0x90, 0x00, 0x03, 0x31, 0x50, 0x18, 0x24, 0x00,
	0x06, 0x62, 0xA0, 0x30, 0x48, 0x00, 0x0C, 0xC4, 0x40, 0x61, 0x90, 0x00, 0x18, 0x88, 0x81, 0xC2,
	0x20, 0x01, 0x30, 0x10, 0x03, 0x85, 0x41, 0x02, 0x60, 0x20, 0x06, 0x0A, 0x83, 0x04, 0x00, 0x2E,
	0x1F, 0x06, 0x01, 0x4B, 0x03, 0x10, 0xCE, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
	0x42, 0x60, 0x82,
}

// FileInfo 描述单个文件信息
type FileInfo struct {
	Filename     string `json:"filename"`
	OriginalName string `json:"originalName"`
	Size         string `json:"size"`
	Type         string `json:"type"` // image, video, file
}

// SharedItem 对应前端的 SharedItem
type SharedItem struct {
	ID           int64      `json:"id"`
	Type         string     `json:"type"`
	Content      string     `json:"content,omitempty"`
	Filename     string     `json:"filename,omitempty"`
	OriginalName string     `json:"originalName,omitempty"`
	Size         string     `json:"size,omitempty"`
	Files        []FileInfo `json:"files,omitempty"`
	Time         string     `json:"time"`
	FullTime     string     `json:"fullTime"`
	SenderID     string     `json:"senderId"`
	Progress     float64    `json:"progress,omitempty"`
}

type Device struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	IP           string `json:"ip"`
	LastSocketID string `json:"lastSocketId"`
}

var (
	db                *sql.DB
	clients           = make(map[*websocket.Conn]string) // conn -> clientId
	clientsMu         sync.Mutex
	upgrader          = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	baseDir           string
	uploadDir         string
	chunkDir          string
	devicesByClientID = make(map[string]Device)
	devicesMu         sync.Mutex
)

func initDirs() {
	home, _ := os.UserHomeDir()
	baseDir = filepath.Join(home, ".fastsend")
	uploadDir = filepath.Join(baseDir, "uploads")
	chunkDir = filepath.Join(baseDir, "chunks")

	os.MkdirAll(uploadDir, 0755)
	os.MkdirAll(chunkDir, 0755)
}

func initDB() {
	dbPath := filepath.Join(baseDir, "fast-send.db")
	var err error
	db, err = sql.Open("sqlite", dbPath)
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
}

func getLocalIP() string {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}
	return "127.0.0.1"
}

func getAllLocalIPs() []string {
	ips := []string{}
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return ips
	}
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				ips = append(ips, ipnet.IP.String())
			}
		}
	}
	return ips
}

func broadcast(msgType string, data interface{}) {
	// 注意：前端 Socket.io 协议和原声 WebSocket 有区别
	// 这里我们简化处理，或者后面引入真正的 socket.io go 实现
	// 目前先用自定义广播
	clientsMu.Lock()
	defer clientsMu.Unlock()
	for conn := range clients {
		// 这里发送的是原始 JSON，前端需要适配或我们在这里适配 Socket.io 协议
		// 为了简单，我们直接发送，前端如果是 Socket.io 可能收不到，需要改用更通用的广播方式
		// 或者我们在路由里直接用 io.emit 的等价逻辑
		err := conn.WriteJSON(map[string]interface{}{
			"event": msgType,
			"data":  data,
		})
		if err != nil {
			conn.Close()
			delete(clients, conn)
		}
	}
}

// 由于前端使用了 Socket.io，直接用原生 WebSocket 可能不兼容。
// 这里的 broadcast 需要配合具体的路由逻辑。

func main() {
	initDirs()
	initDB()

	// 启动托盘
	systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetIcon(iconData)
	systray.SetTitle("FastSend")
	systray.SetTooltip("FastSend 局域网同步工具")

	mOpen := systray.AddMenuItem("打开主界面", "在浏览器中打开")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("退出", "关闭程序")

	go func() {
		for {
			select {
			case <-mOpen.ClickedCh:
				open.Run(fmt.Sprintf("http://localhost:3000"))
			case <-mQuit.ClickedCh:
				systray.Quit()
			}
		}
	}()

	// 在 Goroutine 中启动 HTTP 服务
	go func() {
		// 剪贴板监听
		go func() {
			lastText, _ := clipboard.ReadAll()
			for {
				time.Sleep(time.Second)
				text, err := clipboard.ReadAll()
				if err == nil && text != "" && text != lastText {
					lastText = text
					// 广播剪贴板变化
					now := time.Now()
					item := SharedItem{
						ID:       now.UnixNano() / 1e6,
						Type:     "text",
						Content:  text,
						SenderID: "CLIPBOARD_SYNC",
						Time:     now.Format("15:04:05"),
						FullTime: now.Format(time.RFC3339),
					}
					// 存入数据库并广播
					db.Exec(`INSERT INTO items (id, type, content, files, time, fullTime, senderId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
						item.ID, item.Type, item.Content, "", item.Time, item.FullTime, item.SenderID)
					broadcast("new-item", item)
				}
			}
		}()

		r := gin.Default()
		r.Use(cors.Default())

		// 静态资源
		r.Static("/download", uploadDir)

		// 查找前端构建产物
		clientDist := "../../packages/client/dist"
		if _, err := os.Stat(clientDist); err == nil {
			r.StaticFS("/web", http.Dir(clientDist))
			r.GET("/", func(c *gin.Context) {
				c.File(filepath.Join(clientDist, "index.html"))
			})
		}

		// API 路由
		api := r.Group("/api")
		{
			api.GET("/config", func(c *gin.Context) {
				ips := getAllLocalIPs()
				primaryIP := "127.0.0.1"
				if len(ips) > 0 {
					primaryIP = ips[0]
				}

				url := fmt.Sprintf("http://%s:3000", primaryIP)
				qrData, _ := qrcode.Encode(url, qrcode.Medium, 256)
				qrBase64 := "data:image/png;base64," + strings.TrimSpace(base64.StdEncoding.EncodeToString(qrData))

				c.JSON(200, gin.H{
					"ip":     primaryIP,
					"allIps": ips,
					"url":    url,
					"qr":     qrBase64,
				})
			})

			api.GET("/settings", func(c *gin.Context) {
				key := c.Query("key")
				var value string
				err := db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
				if err != nil {
					c.JSON(200, gin.H{"value": ""})
					return
				}
				c.JSON(200, gin.H{"value": value})
			})

			api.POST("/settings", func(c *gin.Context) {
				var input struct {
					Key   string `json:"key"`
					Value string `json:"value"`
				}
				if err := c.ShouldBindJSON(&input); err != nil {
					c.JSON(400, gin.H{"error": err.Error()})
					return
				}
				_, err := db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", input.Key, input.Value)
				if err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}
				c.JSON(200, gin.H{"success": true})
			})

			api.GET("/items", func(c *gin.Context) {
				rows, err := db.Query("SELECT id, type, content, filename, originalName, files, size, time, fullTime, senderId FROM items ORDER BY id DESC LIMIT 100")
				if err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}
				defer rows.Close()

				items := []SharedItem{}
				for rows.Next() {
					var item SharedItem
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
				c.JSON(200, items)
			})

			api.POST("/text", func(c *gin.Context) {
				var input struct {
					Content  string     `json:"content"`
					SenderID string     `json:"senderId"`
					Type     string     `json:"type"`
					Files    []FileInfo `json:"files"`
				}
				if err := c.ShouldBindJSON(&input); err != nil {
					c.JSON(400, gin.H{"error": err.Error()})
					return
				}

				if input.SenderID == "" {
					c.JSON(400, gin.H{"error": "Missing senderId"})
					return
				}

				now := time.Now()
				itemType := "text"
				if input.Type != "" {
					itemType = input.Type
				}

				item := SharedItem{
					ID:       now.UnixNano() / 1e6,
					Type:     itemType,
					Content:  input.Content,
					SenderID: input.SenderID,
					Files:    input.Files,
					Time:     now.Format("15:04:05"),
					FullTime: now.Format(time.RFC3339),
				}

				filesJSON := ""
				if item.Type == "gallery" && len(item.Files) > 0 {
					b, _ := json.Marshal(item.Files)
					filesJSON = string(b)
				}

				_, err := db.Exec(`INSERT INTO items (id, type, content, files, time, fullTime, senderId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
					item.ID, item.Type, item.Content, filesJSON, item.Time, item.FullTime, item.SenderID)
				if err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}

				broadcast("new-item", item)
				c.JSON(200, item)
			})

			api.POST("/upload/chunk", func(c *gin.Context) {
				hash := c.PostForm("hash")
				index := c.PostForm("index")
				file, _ := c.FormFile("chunk")

				dir := filepath.Join(chunkDir, hash)
				os.MkdirAll(dir, 0755)

				dest := filepath.Join(dir, index)
				if err := c.SaveUploadedFile(file, dest); err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}
				c.JSON(200, gin.H{"success": true})
			})

			api.GET("/upload/check/:hash", func(c *gin.Context) {
				hash := c.Param("hash")
				dir := filepath.Join(chunkDir, hash)

				uploaded := []int{}
				files, err := os.ReadDir(dir)
				if err == nil {
					for _, f := range files {
						idx, err := strconv.Atoi(f.Name())
						if err == nil {
							uploaded = append(uploaded, idx)
						}
					}
				}
				sort.Ints(uploaded)
				c.JSON(200, gin.H{"uploaded": uploaded})
			})

			api.POST("/upload/merge", func(c *gin.Context) {
				var req struct {
					Hash     string `json:"hash"`
					FileName string `json:"fileName"`
					Total    int    `json:"total"`
					SenderID string `json:"senderId"`
					NoRecord bool   `json:"noRecord"`
				}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(400, gin.H{"error": err.Error()})
					return
				}

				// 自动分类逻辑
				subDir := "Files"
				ext := strings.ToLower(filepath.Ext(req.FileName))
				switch ext {
				case ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic":
					subDir = "Images"
				case ".mp4", ".mov", ".avi", ".mkv", ".webm":
					subDir = "Videos"
				case ".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md":
					subDir = "Documents"
				}

				targetDir := filepath.Join(uploadDir, subDir)
				os.MkdirAll(targetDir, 0755)

				finalFileName := fmt.Sprintf("%d-%s", time.Now().Unix(), req.FileName)
				finalPath := filepath.Join(targetDir, finalFileName)

				destFile, err := os.Create(finalPath)
				if err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}
				defer destFile.Close()

				dir := filepath.Join(chunkDir, req.Hash)
				for i := 0; i < req.Total; i++ {
					chunkPath := filepath.Join(dir, strconv.Itoa(i))
					chunkFile, err := os.Open(chunkPath)
					if err != nil {
						c.JSON(500, gin.H{"error": "missing chunk"})
						return
					}
					io.Copy(destFile, chunkFile)
					chunkFile.Close()
					os.Remove(chunkPath)
				}
				os.Remove(dir)

				info, _ := os.Stat(finalPath)
				now := time.Now()
				// 存储相对路径
				dbFileName := filepath.Join(subDir, finalFileName)
				item := SharedItem{
					ID:           now.UnixNano() / 1e6,
					Type:         "file",
					Filename:     dbFileName,
					OriginalName: req.FileName,
					Size:         fmt.Sprintf("%.2f MB", float64(info.Size())/1024/1024),
					SenderID:     req.SenderID,
					Time:         now.Format("15:04:05"),
					FullTime:     now.Format(time.RFC3339),
				}

				if !req.NoRecord {
					_, err = db.Exec(`INSERT INTO items (id, type, filename, originalName, files, size, time, fullTime, senderId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						item.ID, item.Type, item.Filename, item.OriginalName, "", item.Size, item.Time, item.FullTime, item.SenderID)

					broadcast("new-item", item)
				}

				c.JSON(200, item)
			})

			api.DELETE("/items/:id", func(c *gin.Context) {
				id := c.Param("id")

				var filename string
				err := db.QueryRow("SELECT filename FROM items WHERE id = ?", id).Scan(&filename)
				if err == nil && filename != "" {
					// filename 已经是 Images/xxx.jpg 这种格式
					os.Remove(filepath.Join(uploadDir, filename))
				}

				_, err = db.Exec("DELETE FROM items WHERE id = ?", id)
				if err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}

				// 为了兼容前端，转为数字
				intID, _ := strconv.ParseInt(id, 10, 64)
				broadcast("item-removed", intID)
				c.JSON(200, gin.H{"success": true})
			})
		}

		// WebSocket 路由
		r.GET("/ws", func(c *gin.Context) {
			wsHandler(c.Writer, c.Request)
		})

		// 启动 mDNS
		server, err := zeroconf.Register("FastSend-Go", "_fastsend._tcp", "local.", 3000, []string{"version=2.0.0", "ip=" + getLocalIP()}, nil)
		if err != nil {
			log.Println("mDNS registration failed:", err)
		} else {
			defer server.Shutdown()
		}

		fmt.Printf("FastSend Go Server 启动在 http://%s:3000\n", getLocalIP())
		r.Run(":3000")
	}()
}

func onExit() {
	// 退出时的清理
}

func wsHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	clientsMu.Lock()
	clients[conn] = ""
	clientsMu.Unlock()

	// 连接成功后立即发送一次当前设备列表
	devicesMu.Lock()
	initialList := make([]Device, 0, len(devicesByClientID))
	for _, dev := range devicesByClientID {
		initialList = append(initialList, dev)
	}
	devicesMu.Unlock()
	conn.WriteJSON(map[string]interface{}{
		"event": "devices-update",
		"data":  initialList,
	})

	for {
		var msg struct {
			Event string      `json:"event"`
			Data  interface{} `json:"data"`
		}
		err := conn.ReadJSON(&msg)
		if err != nil {
			break
		}

		if msg.Event == "register" {
			// 处理注册逻辑，更新设备列表
			var d struct {
				ID   string `json:"id"`
				Type string `json:"type"`
			}
			// 尝试解析 Data 字段
			dataJSON, _ := json.Marshal(msg.Data)
			json.Unmarshal(dataJSON, &d)

			devicesMu.Lock()
			devicesByClientID[d.ID] = Device{
				ID:           d.ID,
				Name:         d.Type,
				Type:         d.Type,
				IP:           conn.RemoteAddr().String(),
				LastSocketID: fmt.Sprintf("%p", conn),
			}
			devicesMu.Unlock()

			clientsMu.Lock()
			clients[conn] = d.ID
			clientsMu.Unlock()

			// 广播设备更新
			devicesMu.Lock()
			list := make([]Device, 0, len(devicesByClientID))
			for _, dev := range devicesByClientID {
				list = append(list, dev)
			}
			devicesMu.Unlock()
			broadcast("devices-update", list)
		}
	}

	clientsMu.Lock()
	clientID := clients[conn]
	delete(clients, conn)
	clientsMu.Unlock()

	if clientID != "" {
		devicesMu.Lock()
		delete(devicesByClientID, clientID)
		devicesMu.Unlock()

		devicesMu.Lock()
		list := make([]Device, 0, len(devicesByClientID))
		for _, dev := range devicesByClientID {
			list = append(list, dev)
		}
		devicesMu.Unlock()
		broadcast("devices-update", list)
	}
}
