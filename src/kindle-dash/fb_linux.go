//go:build linux

package main

import (
	"fmt"
	"os"
	"regexp"
	"strconv"
	"syscall"
)

const defaultFB = "/dev/fb0"

// Verified Kindle Voyage e-paper geometry (from the /dev/fb0 readout eips used):
// portrait 1072 x 1448, 8bpp, 1088-byte rows.
const (
	fbW  = 1072
	fbH  = 1448
	fbLL = 1088 // bytes per row
)

var sizeRe = regexp.MustCompile(`size=0x([0-9a-fA-F]+)`)

// smemLenFromProc parses /proc/fb/<n> and returns the frame buffer length.
func smemLenFromProc(n int) (uint64, bool) {
	data, err := os.ReadFile(fmt.Sprintf("/proc/fb/%d", n))
	if err != nil {
		return 0, false
	}
	m := sizeRe.FindSubmatch(data)
	if m == nil {
		return 0, false
	}
	v, err := strconv.ParseUint(string(m[1]), 16, 64)
	if err != nil || v == 0 {
		return 0, false
	}
	return v, true
}

func mmapFB(fd uintptr, length int) ([]byte, error) {
	b, err := syscall.Mmap(int(fd), 0, length,
		syscall.PROT_READ|syscall.PROT_WRITE, syscall.MAP_SHARED)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// writeFB maps the framebuffer and copies an 8bpp grayscale buffer into it.
func writeFB(fbPath string, pix []byte, w, h int) error {
	// Resolve the source into exactly fbW x fbH (transpose if rotated).
	src := pix
	if w != fbW || h != fbH {
		if w == fbH && h == fbW {
			src = transpose(pix, w, h)
		} else {
			return fmt.Errorf("image %dx%d does not match fb %dx%d", w, h, fbW, fbH)
		}
	}

	f, err := os.OpenFile(fbPath, os.O_RDWR, 0)
	if err != nil {
		f, err = os.OpenFile(fbPath, os.O_WRONLY, 0)
		if err != nil {
			return fmt.Errorf("open %s: %w", fbPath, err)
		}
	}
	defer f.Close()

	smem, fromProc := smemLenFromProc(0)
	if smem == 0 {
		smem = uint64(fbH * fbLL)
	}

	buf, merr := mmapFB(f.Fd(), int(smem))
	if merr != nil {
		// Retry with the exact minimum in case the reported size is off.
		buf, merr = mmapFB(f.Fd(), fbH*fbLL)
		if merr != nil {
			return fmt.Errorf("mmap smem=%d (proc=%v): %v", smem, fromProc, merr)
		}
	}
	defer syscall.Munmap(buf)

	flipY := os.Getenv("DASH_FLIPY") != ""
	flipX := os.Getenv("DASH_FLIPX") != ""
	ll := fbLL
	for y := 0; y < fbH; y++ {
		sy := y
		if flipY {
			sy = fbH - 1 - y
		}
		dst := buf[y*ll : (y+1)*ll]
		srow := src[sy*fbW : (sy+1)*fbW]
		if flipX {
			for x := 0; x < fbW; x++ {
				dst[x] = srow[fbW-1-x]
			}
		} else {
			copy(dst, srow)
		}
	}
	return nil
}