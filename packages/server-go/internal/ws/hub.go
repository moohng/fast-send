package ws

import (
	"encoding/json"
	"fastsend/internal/models"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type Hub struct {
	clients           map[*websocket.Conn]string // conn -> clientId
	devicesByClientID map[string]models.Device
	mu                sync.Mutex
	upgrader          websocket.Upgrader
}

func NewHub() *Hub {
	return &Hub{
		clients:           make(map[*websocket.Conn]string),
		devicesByClientID: make(map[string]models.Device),
		upgrader:          websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }},
	}
}

func (h *Hub) Broadcast(msgType string, data interface{}) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for conn := range h.clients {
		err := conn.WriteJSON(map[string]interface{}{
			"event": msgType,
			"data":  data,
		})
		if err != nil {
			conn.Close()
			delete(h.clients, conn)
		}
	}
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	h.mu.Lock()
	h.clients[conn] = ""
	h.mu.Unlock()

	// 连接成功后立即发送一次当前设备列表
	h.mu.Lock()
	initialList := make([]models.Device, 0, len(h.devicesByClientID))
	for _, dev := range h.devicesByClientID {
		initialList = append(initialList, dev)
	}
	h.mu.Unlock()

	conn.WriteJSON(map[string]interface{}{
		"event": "devices-update",
		"data":  initialList,
	})

	for {
		var msg struct {
			Event string      `json:"event"`
			Data  interface{} `json:"data"`
		}
		err := conn.ReadJSON(&msg)
		if err != nil {
			break
		}

		if msg.Event == "register" {
			var d struct {
				ID   string `json:"id"`
				Type string `json:"type"`
			}
			dataJSON, _ := json.Marshal(msg.Data)
			json.Unmarshal(dataJSON, &d)

			h.mu.Lock()
			h.devicesByClientID[d.ID] = models.Device{
				ID:           d.ID,
				Name:         d.Type,
				Type:         d.Type,
				IP:           conn.RemoteAddr().String(),
				LastSocketID: fmt.Sprintf("%p", conn),
			}
			h.clients[conn] = d.ID

			list := make([]models.Device, 0, len(h.devicesByClientID))
			for _, dev := range h.devicesByClientID {
				list = append(list, dev)
			}
			h.mu.Unlock()

			h.Broadcast("devices-update", list)
		}
	}

	h.mu.Lock()
	clientID := h.clients[conn]
	delete(h.clients, conn)

	if clientID != "" {
		delete(h.devicesByClientID, clientID)
		list := make([]models.Device, 0, len(h.devicesByClientID))
		for _, dev := range h.devicesByClientID {
			list = append(list, dev)
		}
		h.mu.Unlock()
		h.Broadcast("devices-update", list)
	} else {
		h.mu.Unlock()
	}
}

func (h *Hub) GetDeviceList() []models.Device {
	h.mu.Lock()
	defer h.mu.Unlock()
	list := make([]models.Device, 0, len(h.devicesByClientID))
	for _, dev := range h.devicesByClientID {
		list = append(list, dev)
	}
	return list
}
