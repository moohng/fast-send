package utils

import (
	"net"
	"strings"
)

func isVirtualInterface(name string) bool {
	name = strings.ToLower(name)
	virtualNames := []string{
		"virtual", "vbox", "vmware", "docker", "wsl", "veth", 
		"vethernet", "tailscale", "zerotier", "vpn", "tunnel",
	}
	for _, vn := range virtualNames {
		if strings.Contains(name, vn) {
			return true
		}
	}
	return false
}

func GetLocalIP() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "127.0.0.1"
	}

	// 优先寻找物理网卡的 IPv4
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		if isVirtualInterface(iface.Name) {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				if ipnet.IP.To4() != nil {
					return ipnet.IP.String()
				}
			}
		}
	}

	// 如果没找到，退而求其次寻找任何非回环 IPv4
	addrs, _ := net.InterfaceAddrs()
	for _, address := range addrs {
		if ipnet, ok := address.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
			if ipnet.IP.To4() != nil {
				return ipnet.IP.String()
			}
		}
	}

	return "127.0.0.1"
}

func GetAllLocalIPs() []string {
	ips := []string{}
	ifaces, err := net.Interfaces()
	if err != nil {
		return ips
	}

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
				if ipnet.IP.To4() != nil {
					ipStr := ipnet.IP.String()
					// 物理网卡排在前面
					if !isVirtualInterface(iface.Name) {
						ips = append([]string{ipStr}, ips...)
					} else {
						ips = append(ips, ipStr)
					}
				}
			}
		}
	}
	return ips
}
