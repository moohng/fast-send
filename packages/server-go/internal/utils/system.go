package utils

import (
	"os/exec"
	"strings"
	"syscall"
)

// SelectFolder 调用 PowerShell 打开文件夹选择对话框
func SelectFolder() (string, error) {
	// 使用最稳健的脚本：
	// 1. LoadWithPartialName 保证加载速度
	// 2. 移除复杂的句柄绑定，避免因 MainWindowHandle 为 0 导致的错误
	script := `
	$assembly = [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms')
	$f = New-Object System.Windows.Forms.FolderBrowserDialog
	$f.Description = "选择 FastSend 数据存储目录"
	$f.ShowNewFolderButton = $true
	if ($f.ShowDialog() -eq "OK") {
		Write-Host $f.SelectedPath
	}
	`
	cmd := exec.Command("powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script)
	// 仅隐藏 PowerShell 控制台窗口，不限制交互
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(output)), nil
}
