//go:build !linux

package main

import (
	"os"
)

// defaultPGM: where display() writes on dev machines (there is no EPDC
// hardware outside the device): /tmp/dash-out.pgm, openable in any
// image viewer.
const defaultPGM = "/tmp/dash-out.pgm"

// display (dev stub, !linux): the device displays via eips
// (fb_linux.go); a dev machine has none, so decode the PNG, apply the
// same grayscale, and write a PGM to defaultPGM (override: DASH_FB).
// `dash get` on a dev machine writes the single-IDAT PNG only — the
// display is the separate render step (docs/03 final architecture).
func display(in string) error {
	data, err := os.ReadFile(in)
	if err != nil {
		return err
	}
	m, err := pngDecode(data)
	if err != nil {
		return err
	}
	r := m.Bounds()
	path := defaultPGM
	if fb := os.Getenv("DASH_FB"); fb != "" {
		path = fb
	}
	return writePGM(toGray(m), r.Dx(), r.Dy(), path)
}

// writePGM writes the grayscale pixel buffer as a PGM (P5) file — the
// dev-machine stand-in for the eips display.
func writePGM(g []byte, w, h int, path string) error {
	b := make([]byte, 0, len(g)+32)
	b = append(b, 'P', '5', '\n')
	b = append(b, []byte(itoa(w))...)
	b = append(b, ' ')
	b = append(b, []byte(itoa(h))...)
	b = append(b, '\n', 255, '\n')
	b = append(b, g...)
	return os.WriteFile(path, b, 0o644)
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [12]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}
