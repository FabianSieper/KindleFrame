package main

import (
	"bytes"
	"compress/zlib"
	"encoding/binary"
	"fmt"
	"hash/crc32"
	"image"
	"os"
)

// toGray converts an image to 8bpp grayscale (ITU-R BT.601 luma)
// with Floyd-Steinberg error diffusion.
func toGray(img image.Image) []byte {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	out := make([]byte, w*h)

	var at func(x, y int) (r, g, bl float64)
	switch im := img.(type) {
	case *image.RGBA:
		p, sw := im.Pix, im.Stride
		at = func(x, y int) (r, g, bl float64) {
			i := sw*y + 4*x
			return float64(p[i]), float64(p[i+1]), float64(p[i+2])
		}
	case *image.NRGBA:
		p, sw := im.Pix, im.Stride
		at = func(x, y int) (r, g, bl float64) {
			i := sw*y + 4*x
			a := float64(p[i+3])
			if a == 0 {
				return 0, 0, 0
			}
			k := 255 / a
			return float64(p[i]) * k, float64(p[i+1]) * k, float64(p[i+2]) * k
		}
	case *image.Gray:
		p, sw := im.Pix, im.Stride
		at = func(x, y int) (r, g, bl float64) {
			v := float64(p[sw*y+x])
			return v, v, v
		}
	case *image.Paletted:
		n := len(im.Palette)
		lum := make([]float64, n)
		for i, c := range im.Palette {
			r16, g16, b16, a16 := c.RGBA()
			lum[i] = 0.299*unprem(r16, a16) + 0.587*unprem(g16, a16) + 0.114*unprem(b16, a16)
		}
		p := im.Pix
		at = func(x, y int) (r, g, bl float64) {
			v := lum[p[y*im.Stride+x]]
			return v, v, v
		}
	default:
		at = func(x, y int) (r, g, bl float64) {
			r16, g16, b16, a16 := img.At(b.Min.X+x, b.Min.Y+y).RGBA()
			return unprem(r16, a16), unprem(g16, a16), unprem(b16, a16)
		}
	}

	errA := make([]float64, w)
	errB := make([]float64, w)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			r, g, bl := at(x, y)
			val := 0.299*r + 0.587*g + 0.114*bl + errA[x]
			q := 0
			switch {
			case val <= 0:
			case val >= 255:
				q = 255
			default:
				q = int(val + 0.5)
			}
			out[y*w+x] = byte(q)
			e := val - float64(q)
			if x > 0 {
				errA[x-1] += e * 7.0 / 16.0
			}
			if x+1 < w {
				errA[x+1] += e * 3.0 / 16.0
			}
			if y+1 < h {
				errB[x] += e * 5.0 / 16.0
				if x > 0 {
					errB[x-1] += e * 2.0 / 16.0
				}
				if x+1 < w {
					errB[x+1] += e * 1.0 / 16.0
				}
			}
		}
		errA, errB = errB, errA
		for i := range errA {
			errA[i] = 0
		}
	}
	return out
}

// scaleLetterbox shrinks img by scale (0 < scale < 1) and centers the
// result on a black canvas of the input's original dimensions
// (1072×1448 or 1448×1072) — the T20 margin fix: the output frame size is
// unchanged, the content gets a black border. scale >= 1 returns img
// unchanged. The downscale is a manual bilinear over the luma
// (the pinned toolchain's image/draw has no scaling ops — no
// ApproxBiLinear — so the filter is implemented by hand); the result is
// an *image.Gray, so toGray() takes its fast path (already-quantized
// pixels round-trip exactly).
func scaleLetterbox(img image.Image, scale float64) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if scale >= 1 {
		return img
	}
	sw, sh := int(float64(w)*scale), int(float64(h)*scale)
	if sw < 1 {
		sw = 1
	}
	if sh < 1 {
		sh = 1
	}
	gray := toGray(img) // w*h bytes, ITU-R BT.601 + Floyd-Steinberg
	small := image.NewGray(image.Rect(0, 0, sw, sh))
	bilinearGray(gray, w, h, small, sw, sh)
	canvas := image.NewGray(image.Rect(0, 0, w, h))
	ox, oy := (w-sw)/2, (h-sh)/2
	for y := 0; y < sh; y++ {
		copy(canvas.Pix[(oy+y)*w+ox:(oy+y)*w+ox+sw], small.Pix[y*sw:(y+1)*sw])
	}
	return canvas
}

// bilinearGray downscales the w×h 8-bit luma row buffer src (as produced
// by toGray) to sw×sh with a clamped bilinear filter into the Pix of dst
// (sw <= w, sh <= h; 1:1 copies through unchanged).
func bilinearGray(src []byte, w, h int, dst *image.Gray, sw, sh int) {
	for y := 0; y < sh; y++ {
		fy := (float64(y)+0.5)*float64(h)/float64(sh) - 0.5
		y0 := int(fy)
		if y0 < 0 {
			y0 = 0
			fy = 0
		}
		fy -= float64(y0)
		y1 := y0 + 1
		if y1 > h-1 {
			y1 = h - 1
		}
		row0 := src[y0*w : (y0+1)*w]
		row1 := src[y1*w : (y1+1)*w]
		drow := dst.Pix[y*sw : (y+1)*sw]
		for x := 0; x < sw; x++ {
			fx := (float64(x)+0.5)*float64(w)/float64(sw) - 0.5
			x0 := int(fx)
			if x0 < 0 {
				x0 = 0
				fx = 0
			}
			fx -= float64(x0)
			x1 := x0 + 1
			if x1 > w-1 {
				x1 = w - 1
			}
			v := (1-fx)*(1-fy)*float64(row0[x0]) + fx*(1-fy)*float64(row0[x1]) +
				(1-fx)*fy*float64(row1[x0]) + fx*fy*float64(row1[x1])
			if v < 0 {
				v = 0
			} else if v > 255 {
				v = 255
			}
			drow[x] = byte(v + 0.5)
		}
	}
}

// unprem converts a 16-bit premultiplied channel (and its alpha) to 0..255.
func unprem(r16, a16 uint32) float64 {
	if a16 == 0 {
		return 0
	}
	if a16 == 65535 {
		return float64(r16 >> 8)
	}
	return float64(r16) * 255.0 / float64(a16)
}

// saveKindlePNG writes 8-bit grayscale pixels (row-major, w*h bytes) as a PNG
// the Kindle's eips accepts: IHDR color type 0 (grayscale) and exactly ONE IDAT
// chunk, a single compress/zlib stream over all filter-0 rows. image/png cannot
// do this (it splits the stream into ~32 KB blocks, 48 IDAT for a full frame);
// eips drops all but the first IDAT, so the chunks are written by hand.
func saveKindlePNG(path string, w, h int, gray []byte) error {
	if len(gray) != w*h {
		return fmt.Errorf("saveKindlePNG: need %d bytes, got %d", w*h, len(gray))
	}
	return os.WriteFile(path, kindlePNG(w, h, gray), 0644)
}

// kindlePNG builds the full eips PNG (SIG + IHDR + one IDAT + IEND) for w x h
// 8-bit grayscale pixels; the caller must ensure len(gray)==w*h. The single
// compress/zlib stream is written to a bytes.Buffer, so its (always-nil)
// errors are dropped here.
func kindlePNG(w, h int, gray []byte) []byte {
	raw := make([]byte, 0, h*(w+1))
	for y := 0; y < h; y++ {
		raw = append(raw, 0)
		raw = append(raw, gray[y*w:(y+1)*w]...)
	}
	var idat bytes.Buffer
	zw := zlib.NewWriter(&idat)
	zw.Write(raw)
	zw.Close()
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:4], uint32(w))
	binary.BigEndian.PutUint32(ihdr[4:8], uint32(h))
	ihdr[8] = 8
	ihdr[9] = 0
	var buf bytes.Buffer
	buf.Write([]byte{0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a})
	writePNGChunk(&buf, "IHDR", ihdr)
	writePNGChunk(&buf, "IDAT", idat.Bytes())
	writePNGChunk(&buf, "IEND", nil)
	return buf.Bytes()
}

// writePNGChunk appends one PNG chunk: 4-byte big-endian length, type, data,
// and the CRC-32 (IEEE) over type+data.
func writePNGChunk(buf *bytes.Buffer, typ string, data []byte) {
	var b [4]byte
	binary.BigEndian.PutUint32(b[:], uint32(len(data)))
	buf.Write(b[:])
	t := []byte(typ)
	buf.Write(t)
	buf.Write(data)
	var c [4]byte
	binary.BigEndian.PutUint32(c[:], crc32.ChecksumIEEE(append(t, data...)))
	buf.Write(c[:])
}
