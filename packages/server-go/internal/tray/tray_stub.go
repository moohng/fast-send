//go:build (!windows && !cgo) || nocgo
// +build !windows,!cgo nocgo

package tray

import (
	"fastsend/internal/db"
	"fastsend/internal/ws"
	"fmt"
	"os"
	"os/signal"
	"syscall"
)

// Run 这是一个不带托盘图标的占位符实现，用于非 CGO 或 Linux/macOS 交叉编译环境
func Run(hub *ws.Hub, store *db.Store) {
	fmt.Println("[Tray] Tray is disabled on this build. Use Ctrl+C to exit.")

	// 在没有托盘的情况下，我们需要一种方式来保持主线程运行并等待退出信号
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
	fmt.Println("[Tray] Shutting down...")
}
