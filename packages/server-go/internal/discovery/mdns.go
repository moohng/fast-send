package discovery

import (
	"fastsend/internal/utils"
	"log"

	"github.com/grandcat/zeroconf"
)

func RegistermDNS(port int) *zeroconf.Server {
	server, err := zeroconf.Register("FastSend-Go", "_fastsend._tcp", "local.", port, []string{"version=2.0.0", "ip=" + utils.GetLocalIP()}, nil)
	if err != nil {
		log.Println("mDNS registration failed:", err)
		return nil
	}
	return server
}
