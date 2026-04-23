package models

// FileInfo 描述单个文件信息
type FileInfo struct {
	Filename     string `json:"filename"`
	OriginalName string `json:"originalName"`
	Size         string `json:"size"`
	Type         string `json:"type"` // image, video, file
}

// SharedItem 对应前端的 SharedItem
type SharedItem struct {
	ID           int64      `json:"id"`
	Type         string     `json:"type"`
	Content      string     `json:"content,omitempty"`
	Filename     string     `json:"filename,omitempty"`
	OriginalName string     `json:"originalName,omitempty"`
	Size         string     `json:"size,omitempty"`
	Files        []FileInfo `json:"files,omitempty"`
	Time         string     `json:"time"`
	FullTime     string     `json:"fullTime"`
	SenderID     string     `json:"senderId"`
	Progress     float64    `json:"progress,omitempty"`
}

type Device struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Type         string `json:"type"`
	IP           string `json:"ip"`
	LastSocketID string `json:"lastSocketId"`
}
