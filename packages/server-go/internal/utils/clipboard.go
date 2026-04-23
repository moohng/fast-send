package utils

import (
	"fastsend/internal/db"
	"fastsend/internal/models"
	"fastsend/internal/ws"
	"time"

	"github.com/atotto/clipboard"
)

func StartClipboardService(hub *ws.Hub, store *db.Store) {
	lastText, _ := clipboard.ReadAll()
	for {
		time.Sleep(time.Second)

		// 检查剪贴板同步开关
		if store.GetSetting("clipboardSync") != "true" {
			continue
		}

		text, err := clipboard.ReadAll()
		if err == nil && text != "" && text != lastText {
			lastText = text
			// 广播剪贴板变化
			now := time.Now()
			item := models.SharedItem{
				ID:       now.UnixNano() / 1e6,
				Type:     "text",
				Content:  text,
				SenderID: "CLIPBOARD_SYNC",
				Time:     now.Format("15:04:05"),
				FullTime: now.Format(time.RFC3339),
			}
			// 存入数据库并广播
			store.AddItem(item)
			hub.Broadcast("new-item", item)
		}
	}
}
