//go:build !linux

package main

import (
	"errors"
	"os"
)

// fbdump (dev stub, !linux): a dev machine has no /dev/fb0 (the device
// reads it for the overpaint PoC — ISSUES I14, T25). With DASH_FB set to
// a file, copy it to <out>: the sandbox stand-in for a raw fb dump (same
// pattern as the display() stub in fb_stub.go).
func fbdump(out string) error {
	src := os.Getenv("DASH_FB")
	if src == "" {
		return errors.New("no DASH_FB set (dev stub: no /dev/fb0)")
	}
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	tmp := out + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, out)
}
