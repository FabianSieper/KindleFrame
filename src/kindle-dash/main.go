package main

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	log.SetOutput(os.Stderr)
	log.SetFlags(0)
	if len(os.Args) < 2 {
		log.Fatal("usage: dash get <out.png> <url...> | dash render <in.png> [fbpath]")
	}
	switch os.Args[1] {
	case "get":
		if len(os.Args) < 4 {
			log.Fatal("usage: dash get <out.png> <url...>")
		}
		if err := get(os.Args[2], os.Args[3:]); err != nil {
			log.Fatalf("get: %v", err)
		}
	case "render":
		if len(os.Args) < 3 {
			log.Fatal("usage: dash render <in.png> [fbpath]")
		}
		fb := defaultFB
		if len(os.Args) > 3 {
			fb = os.Args[3]
		}
		if err := render(os.Args[2], fb); err != nil {
			log.Fatalf("render: %v", err)
		}
	default:
		log.Fatalf("unknown command %q", os.Args[1])
	}
}

var wantSizes = [][2]int{{1072, 1448}, {1448, 1072}}

func pngOK(d []byte) error {
	if len(d) < 33 || string(d[:8]) != "\x89PNG\r\n\x1a\n" || string(d[12:16]) != "IHDR" {
		return errors.New("not a PNG")
	}
	w := int(uint32(d[16])<<24 | uint32(d[17])<<16 | uint32(d[18])<<8 | uint32(d[19]))
	h := int(uint32(d[20])<<24 | uint32(d[21])<<16 | uint32(d[22])<<8 | uint32(d[23]))
	bd, ct := d[24], d[25]
	if bd != 8 {
		return errors.New("bitdepth != 8")
	}
	if ct != 0 && ct != 2 && ct != 3 && ct != 4 && ct != 6 {
		return fmt.Errorf("unsupported colortype %d", ct)
	}
	for _, s := range wantSizes {
		if w == s[0] && h == s[1] {
			return nil
		}
	}
	return fmt.Errorf("bad dims %dx%d", w, h)
}

type httpError struct{ code int }

func (e *httpError) Error() string { return fmt.Sprintf("http %d", e.code) }

func get(out string, urls []string) error {
	client := &http.Client{Timeout: 45 * time.Second}
	var lastErr error
	for _, u := range urls {
		resp, err := client.Get(u)
		if err != nil {
			lastErr = fmt.Errorf("%s: %w", u, err)
			continue
		}
		data, rerr := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			lastErr = &httpError{resp.StatusCode}
			continue
		}
		if rerr != nil {
			lastErr = fmt.Errorf("%s: %w", u, rerr)
			continue
		}
		if err := pngOK(data); err != nil {
			lastErr = fmt.Errorf("%s: %w", u, err)
			continue
		}
		img, err := pngDecode(data)
		if err != nil {
			lastErr = fmt.Errorf("%s: decode: %w", u, err)
			continue
		}
		_ = img
		old, oerr := os.ReadFile(out)
		if oerr == nil && string(old) == string(data) {
			return nil
		}
		tmp := out + ".tmp"
		if err := os.WriteFile(tmp, data, 0644); err != nil {
			return err
		}
		if err := os.Rename(tmp, out); err != nil {
			os.Remove(tmp)
			return err
		}
		if err := render(out, defaultFB); err != nil {
			log.Printf("render after get: %v", err)
		}
		return nil
	}
	return lastErr
}