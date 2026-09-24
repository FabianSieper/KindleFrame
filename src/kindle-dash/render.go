package main

import (
	"bytes"
	"image"
	"image/png"
	"os"
)

func pngDecode(data []byte) (image.Image, error) {
	return png.Decode(bytes.NewReader(data))
}

func render(in, fbPath string) error {
	f, err := os.Open(in)
	if err != nil {
		return err
	}
	defer f.Close()
	img, err := png.Decode(f)
	if err != nil {
		return err
	}
	pix := toGray(img)
	b := img.Bounds()
	return writeFB(fbPath, pix, b.Dx(), b.Dy())
}