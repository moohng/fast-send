//go:build windows
// +build windows

package utils

import (
	"syscall"

	"github.com/ncruces/zenity"
)

var (
	user32               = syscall.NewLazyDLL("user32.dll")
	getForegroundWindow = user32.NewProc("GetForegroundWindow")
)

// SelectFolder 使用原生 Windows API 打开文件夹选择对话框 (Windows 专用)
func SelectFolder() (string, error) {
	title := "选择 FastSend 数据存储目录"

	// 获取当前活动窗口（即浏览器）的句柄
	// 将其作为父窗口锚定，可以百分之百确保弹窗出现在浏览器上方
	hwnd, _, _ := getForegroundWindow.Call()

	path, err := zenity.SelectFile(
		zenity.Directory(),
		zenity.Title(title),
		zenity.Attach(hwnd),
	)

	if err != nil {
		if err == zenity.ErrCanceled {
			return "", nil
		}
		return "", err
	}
	return path, nil
}
