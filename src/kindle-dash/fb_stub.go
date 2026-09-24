//go:build !linux

package main

import (
	"fmt"
	"os"
)

const defaultFB = "/tmp/dash-out.pgm"

// writeFB (non-Linux test stub): writes the pixel buffer as a PGM file.
func writeFB(fbPath string, pix []byte, w, h int) error {
	out := fbPath
	if out == "/dev/fb0" {
		out = defaultFB
	}
	hdr := fmt.Sprintf("P5\n%d %d\n255\n", w, h)
	f, err := os.Create(out)
	if err != nil {
		return err
	}
	defer f.Close()
	if _, err := f.Write([]byte(hdr)); err != nil {
		return err
	}
	_, err = f.Write(pix)
	return err
}