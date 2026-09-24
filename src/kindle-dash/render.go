package main

import (
	"bytes"
	"image"
	"image/png"
)

// render displays in (device: exec eips, fb_linux.go; dev machine: PGM,
// fb_stub.go). The PNG in must be the single-IDAT 8-bit grayscale
// dashboard (dash get output); `dash render` is the ONLY eips/EPDC call
// in the pipeline (docs/03 final architecture).
func render(in string) error {
	return display(in)
}

func pngDecode(data []byte) (image.Image, error) {
	return png.Decode(bytes.NewReader(data))
}
