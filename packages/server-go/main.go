package main

import (
	"fastsend/internal/api"
	"fastsend/internal/config"
	"fastsend/internal/db"
	"fastsend/internal/discovery"
	"fastsend/internal/utils"
	"fastsend/internal/ws"
	"fmt"
	"time"

	"github.com/getlantern/systray"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/skratchdot/open-golang/open"
)

func main() {
	config.InitDirs()
	store := db.InitDB()
	hub := ws.NewHub()

	// 启动网络服务
	go runHTTPServer(hub, store)

	fmt.Println("[Systray] Starting tray...")
	systray.Run(func() {
		onReady(hub, store)
	}, onExit)
}

func runHTTPServer(hub *ws.Hub, store *db.Store) {
	// 等待确保托盘初始化开始
	time.Sleep(time.Second)

	// 启动剪贴板监听
	go utils.StartClipboardService(hub, store)

	r := gin.Default()
	r.Use(cors.Default())

	// 静态资源
	r.Static("/download", config.UploadDir)

	// 查找前端构建产物
	clientDist := "../../packages/client/dist"
	r.StaticFS("/web", gin.Dir(clientDist, false))
	r.GET("/", func(c *gin.Context) {
		c.File("../../packages/client/dist/index.html")
	})

	// API 路由
	api.SetupRoutes(r, hub, store)

	// WebSocket 路由
	r.GET("/ws", func(c *gin.Context) {
		hub.HandleWS(c.Writer, c.Request)
	})

	// 启动 mDNS
	mdnsServer := discovery.RegistermDNS(3000)
	if mdnsServer != nil {
		defer mdnsServer.Shutdown()
	}

	fmt.Printf("FastSend Go Server 启动在 http://%s:3000\n", utils.GetLocalIP())
	r.Run(":3000")
}

func onReady(hub *ws.Hub, store *db.Store) {
	fmt.Println("[Systray] onReady...")
	systray.SetIcon(config.IconData)
	systray.SetTitle("FastSend")
	systray.SetTooltip("FastSend 局域网同步工具")

	mOpen := systray.AddMenuItem("打开主界面", "在浏览器中打开")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("退出", "关闭程序")

	for {
		select {
		case <-mOpen.ClickedCh:
			open.Run("http://localhost:3000")
		case <-mQuit.ClickedCh:
			systray.Quit()
			return
		}
	}
}

func onExit() {
	fmt.Println("[Systray] Exiting...")
}
