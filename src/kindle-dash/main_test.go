package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

type kpng struct{ idat, w, h, ct, bd int }

// readKindle parses the eips PNG at path: walks the chunks (counting IDATs,
// reading IHDR) and decodes the pixel buffer.
func readKindle(t *testing.T, path string) (*image.Gray, kpng) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	var info kpng
	i := 8
	for i < len(data) {
		if i+8 > len(data) {
			t.Fatalf("truncated chunk at %d", i)
		}
		l := int(data[i])<<24 | int(data[i+1])<<16 | int(data[i+2])<<8 | int(data[i+3])
		typ := string(data[i+4 : i+8])
		body := data[i+8 : i+8+l]
		if typ == "IHDR" {
			info.w = int(binary.BigEndian.Uint32(body[0:4]))
			info.h = int(binary.BigEndian.Uint32(body[4:8]))
			info.bd, info.ct = int(body[8]), int(body[9])
		}
		if typ == "IDAT" {
			info.idat++
		}
		i += 12 + l
	}
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("decode: %v", err)
	}
	g, ok := img.(*image.Gray)
	if !ok {
		t.Fatalf("decoded %T, want *image.Gray", img)
	}
	return g, info
}

func TestGet(t *testing.T) {
	const w, h = 1072, 1448
	src := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			src.SetRGBA(x, y, color.RGBA{R: byte(x % 256), G: byte(y % 256), B: byte((x + y) % 256), A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, src); err != nil {
		t.Fatalf("encode source: %v", err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(buf.Bytes())
	}))
	defer srv.Close()

	out := filepath.Join(t.TempDir(), "dashboard.png")
	if err := get(out, []string{srv.URL}); err != nil {
		t.Fatalf("get: %v", err)
	}

	g, info := readKindle(t, out)
	if info.idat != 1 || info.ct != 0 || info.bd != 8 {
		t.Fatalf("idat=%d ct=%d bd=%d, want 1/0/8 (eips)", info.idat, info.ct, info.bd)
	}
	if info.w != w || info.h != h {
		t.Fatalf("dims %dx%d, want %dx%d", info.w, info.h, w, h)
	}
	want := toGray(src)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			if got := g.Pix[y*g.Stride+x]; got != want[y*w+x] {
				t.Fatalf("gray pixel %d,%d = %d, want %d", x, y, got, want[y*w+x])
			}
		}
	}
}
