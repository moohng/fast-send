package main

import (
	"embed"
	"fastsend/internal/api"
	"fastsend/internal/config"
	"fastsend/internal/db"
	"fastsend/internal/discovery"
	"fastsend/internal/tray"
	"fastsend/internal/utils"
	"fastsend/internal/ws"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

//go:embed all:dist
var clientDist embed.FS

func main() {
	config.InitDirs()
	store := db.InitDB()
	hub := ws.NewHub()

	// 启动网络服务
	go runHTTPServer(hub, store)

	// 启动托盘逻辑（在非 CGO 平台将回退到信号监听）
	tray.Run(hub, store)
}

func runHTTPServer(hub *ws.Hub, store *db.Store) {
	// 等待确保托盘初始化开始
	time.Sleep(time.Second)

	// 启动剪贴板监听
	go utils.StartClipboardService(hub, store)

	r := gin.Default()
	r.Use(cors.Default())

	// 静态资源
	r.GET("/download/*filepath", func(c *gin.Context) {
		filePath := c.Param("filepath")
		fullPath := config.UploadDir + filePath
		
		if c.Query("download") == "1" {
			// Extract filename from path for the attachment header
			parts := strings.Split(filePath, "/")
			filename := parts[len(parts)-1]
			c.FileAttachment(fullPath, filename)
		} else {
			c.File(fullPath)
		}
	})

	// 使用 embed 托管前端构建产物
	staticFiles, _ := fs.Sub(clientDist, "dist")
	fileServer := http.FileServer(http.FS(staticFiles))

	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// 如果请求的是静态资源文件（包含 . 且不是 .html）
		if strings.Contains(path, ".") && !strings.HasSuffix(path, ".html") {
			// 尝试从 embed 资源中直接提供文件
			// 这里的 http.FileServer 会自动处理 MIME 类型
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}

		// 否则（访问根目录或前端路由），返回 index.html
		indexData, err := clientDist.ReadFile("dist/index.html")
		if err != nil {
			c.String(404, "Frontend not built")
			return
		}
		c.Data(200, "text/html; charset=utf-8", indexData)
	})

	// API 路由
	api.SetupRoutes(r, hub, store)

	// WebSocket 路由
	r.GET("/ws", func(c *gin.Context) {
		hub.HandleWS(c.Writer, c.Request)
	})

	// 启动 mDNS
	mdnsServer := discovery.RegistermDNS(5678)
	if mdnsServer != nil {
		defer mdnsServer.Shutdown()
	}

	fmt.Printf("FastSend Go Server 启动在 http://%s:5678\n", utils.GetLocalIP())
	r.Run(":5678")
}
