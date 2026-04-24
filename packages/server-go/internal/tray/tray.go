//go:build (windows && !nocgo) || (darwin && cgo) || (linux && cgo)
// +build windows,!nocgo darwin,cgo linux,cgo

package tray

import (
	"fastsend/internal/config"
	"fastsend/internal/db"
	"fastsend/internal/ws"
	"fmt"
	"github.com/getlantern/systray"
	"github.com/skratchdot/open-golang/open"
)

func Run(hub *ws.Hub, store *db.Store) {
	fmt.Println("[Systray] Starting tray...")
	systray.Run(func() {
		onReady(hub, store)
	}, onExit)
}

func onReady(hub *ws.Hub, store *db.Store) {
	systray.SetIcon(config.IconData)
	systray.SetTitle("FastSend")
	systray.SetTooltip("FastSend")

	mOpen := systray.AddMenuItem("打开主界面", "在浏览器中打开")
	systray.AddSeparator()
	mQuit := systray.AddMenuItem("退出", "关闭程序")

	for {
		select {
		case <-mOpen.ClickedCh:
			open.Run("http://localhost:5678")
		case <-mQuit.ClickedCh:
			systray.Quit()
			return
		}
	}
}

func onExit() {
	fmt.Println("[Systray] Exiting...")
}
