//go:build windows
// +build windows

package utils

import (
	"os/exec"
	"strings"
	"syscall"
)

// SelectFolder 调用 PowerShell 打开文件夹选择对话框 (Windows 专用)
func SelectFolder() (string, error) {
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
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	output, err := cmd.Output()
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(output)), nil
}
