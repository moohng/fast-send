package main

import (
	"bytes"
	"fmt"
	"image/png"
	"fastsend/internal/config"
)

func main() {
	_, err := png.Decode(bytes.NewReader(config.IconData))
	if err != nil {
		fmt.Println("Error decoding PNG:", err)
	} else {
		fmt.Println("PNG decoded successfully!")
	}
}
