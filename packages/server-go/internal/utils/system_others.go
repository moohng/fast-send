//go:build !windows
// +build !windows

package utils

import "errors"

// SelectFolder 在非 Windows 平台上暂不支持自动选择 (占位符)
func SelectFolder() (string, error) {
	return "", errors.New("folder selection is not supported on this platform via this method")
}
