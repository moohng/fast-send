package api

import (
	"encoding/base64"
	"fastsend/internal/config"
	"fastsend/internal/db"
	"fastsend/internal/models"
	"fastsend/internal/utils"
	"fastsend/internal/ws"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/skip2/go-qrcode"
)

func SetupRoutes(r *gin.Engine, hub *ws.Hub, store *db.Store) {
	api := r.Group("/api")
	{
		api.GET("/config", func(c *gin.Context) {
			ips := utils.GetAllLocalIPs()
			primaryIP := "127.0.0.1"
			if len(ips) > 0 {
				primaryIP = ips[0]
			}

			url := fmt.Sprintf("http://%s:5678", primaryIP)
			qrData, _ := qrcode.Encode(url, qrcode.Medium, 256)
			qrBase64 := "data:image/png;base64," + strings.TrimSpace(base64.StdEncoding.EncodeToString(qrData))

			c.JSON(200, gin.H{
				"ip":     primaryIP,
				"allIps": ips,
				"url":    url,
				"qr":     qrBase64,
			})
		})


			api.GET("/is-local", func(c *gin.Context) {
				clientIP := c.ClientIP()
				isLocal := clientIP == "127.0.0.1" || clientIP == "::1"
				c.JSON(200, gin.H{"isLocal": isLocal})
			})

			api.GET("/utils/select-folder", func(c *gin.Context) {
				clientIP := c.ClientIP()
				if clientIP != "127.0.0.1" && clientIP != "::1" {
					c.JSON(403, gin.H{"error": "Only localhost can trigger picker"})
					return
				}

				path, err := utils.SelectFolder()
				if err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}
				c.JSON(200, gin.H{"path": path})
			})

		api.GET("/settings", func(c *gin.Context) {
			key := c.Query("key")
			value := store.GetSetting(key)
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
			if err := store.SetSetting(input.Key, input.Value); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			if input.Key == "baseDir" {
				config.UpdateDirs(input.Value)
			}
			c.JSON(200, gin.H{"success": true})
		})

		api.GET("/items", func(c *gin.Context) {
			items, err := store.GetItems()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, items)
		})

		api.POST("/text", func(c *gin.Context) {
			var input struct {
				Content  string            `json:"content"`
				SenderID string            `json:"senderId"`
				Type     string            `json:"type"`
				Files    []models.FileInfo `json:"files"`
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

			item := models.SharedItem{
				ID:       now.UnixNano() / 1e6,
				Type:     itemType,
				Content:  input.Content,
				SenderID: input.SenderID,
				Files:    input.Files,
				Time:     now.Format("15:04:05"),
				FullTime: now.Format(time.RFC3339),
			}

			if err := store.AddItem(item); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}

			hub.Broadcast("new-item", item)
			c.JSON(200, item)
		})

		api.POST("/upload/chunk", func(c *gin.Context) {
			hash := c.PostForm("hash")
			index := c.PostForm("index")
			file, _ := c.FormFile("chunk")

			dir := filepath.Join(config.ChunkDir, hash)
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
			dir := filepath.Join(config.ChunkDir, hash)

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

			targetDir := filepath.Join(config.UploadDir, subDir)
			os.MkdirAll(targetDir, 0755)

			finalFileName := fmt.Sprintf("%d-%s", time.Now().Unix(), req.FileName)
			finalPath := filepath.Join(targetDir, finalFileName)

			destFile, err := os.Create(finalPath)
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			defer destFile.Close()

			dir := filepath.Join(config.ChunkDir, req.Hash)
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
			item := models.SharedItem{
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
				if err := store.AddItem(item); err != nil {
					c.JSON(500, gin.H{"error": err.Error()})
					return
				}
				hub.Broadcast("new-item", item)
			}

			c.JSON(200, item)
		})

		api.DELETE("/items/:id", func(c *gin.Context) {
			id := c.Param("id")

			filename, err := store.GetFilename(id)
			if err == nil && filename != "" {
				os.Remove(filepath.Join(config.UploadDir, filename))
			}

			if err := store.DeleteItem(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}

			// 为了兼容前端，转为数字
			intID, _ := strconv.ParseInt(id, 10, 64)
			hub.Broadcast("item-removed", intID)
			c.JSON(200, gin.H{"success": true})
		})
	}
}
