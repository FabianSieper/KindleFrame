package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestSaveKindlePNG(t *testing.T) {
	const w, h = 64, 32
	gray := make([]byte, w*h)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			gray[y*w+x] = byte(255 * x / (w - 1))
		}
	}

	path := filepath.Join(t.TempDir(), "out.png")
	if err := saveKindlePNG(path, w, h, gray); err != nil {
		t.Fatalf("saveKindlePNG: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if !bytes.Equal(data[:8], []byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a}) {
		t.Fatal("bad signature")
	}

	// Structural check: walk chunks, verify exactly 1 IDAT and the IHDR
	// eips requires (8-bit, color type 0 = grayscale), correct dimensions.
	var (
		i      = 8
		idat   int
		iw, ih int
		bd, ct int
	)
	for i < len(data) {
		if i+8 > len(data) {
			t.Fatalf("truncated chunk at %d", i)
		}
		l := int(data[i])<<24 | int(data[i+1])<<16 | int(data[i+2])<<8 | int(data[i+3])
		typ := string(data[i+4 : i+8])
		body := data[i+8 : i+8+l]
		if typ == "IHDR" {
			iw = int(binary.BigEndian.Uint32(body[0:4]))
			ih = int(binary.BigEndian.Uint32(body[4:8]))
			bd, ct = int(body[8]), int(body[9])
		}
		if typ == "IDAT" {
			idat++
		}
		i += 12 + l
	}
	if idat != 1 {
		t.Fatalf("IDAT count = %d, want 1", idat)
	}
	if bd != 8 || ct != 0 {
		t.Fatalf("bitdepth=%d colortype=%d, want 8/0 (grayscale)", bd, ct)
	}
	if iw != w || ih != h {
		t.Fatalf("dims %dx%d, want %dx%d", iw, ih, w, h)
	}

	// Pixel-exact round-trip: the decoded grayscale bytes must equal the input.
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	gimg, ok := img.(*image.Gray)
	if !ok {
		t.Fatalf("decoded type %T, want *image.Gray", img)
	}
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if gimg.Pix[y*w+x] != gray[y*w+x] {
				t.Fatalf("pixel %d,%d = %d, want %d", x, y, gimg.Pix[y*w+x], gray[y*w+x])
			}
		}
	}
}

func TestSaveKindlePNGSample(t *testing.T) {
	const w, h = 1072, 1448
	gray := make([]byte, w*h)
	for i := range gray {
		gray[i] = byte(i % 256)
	}
	path := filepath.Join(os.TempDir(), "dash-selftest.png")
	if err := saveKindlePNG(path, w, h, gray); err != nil {
		t.Fatalf("saveKindlePNG: %v", err)
	}
	t.Log("sample at", path)
}
