//go:build linux

package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"time"
)

// fbDevPath is the raw panel framebuffer. A full raw read is the
// snapshot for the overpaint-detection PoC (ISSUES I14, T25): two
// dumps of the same buffer, byte-compared in the script (cmp -s),
// detect the Kindle UI painting over our rendered image (button
// press, boot, wake) — no pixel decoding in Go; fb-to-fb comparison
// is immune to transform/palette drift.
const fbDevPath = "/dev/fb0"

// fbDumpBytes = measured geometry 1072x1448 @ 16bpp (docs/03) =
// 3,104,512 B. The smem is larger (6,782,976 B); we read the first
// fbDumpBytes — the byte-diff needs a CONSISTENT read pattern, not a
// "correct" geometry. No geometry query: the Go stdlib has no
// fb-info ioctl wrapper (x/sys only), and mirroring the kernel's
// fb_var_screeninfo on this custom 3.0.35 kernel is more risk than
// value for a diff PoC.
const fbDumpBytes = 1072 * 1448 * 2

// fbdump reads the panel framebuffer into <out> (atomic: .tmp +
// rename) and logs the outcome to diag.log (best effort). A failed
// dump never fails a render — it only costs one PoC sample.
func fbdump(out string) error {
	t0 := time.Now()
	f, err := os.Open(fbDevPath)
	if err != nil {
		diagf("fbdump %s: open %s: %v (%v)", out, fbDevPath, err, time.Since(t0))
		return fmt.Errorf("open %s: %w", fbDevPath, err)
	}
	defer f.Close()
	b := make([]byte, fbDumpBytes)
	m, rerr := io.ReadFull(f, b)
	if rerr != nil && rerr != io.EOF && rerr != io.ErrUnexpectedEOF {
		diagf("fbdump %s: read: %v (%v)", out, rerr, time.Since(t0))
		return fmt.Errorf("read %s: %w", fbDevPath, rerr)
	}
	if m == 0 {
		diagf("fbdump %s: no data (%v)", out, time.Since(t0))
		return errors.New("no data from " + fbDevPath)
	}
	b = b[:m]
	tmp := out + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		diagf("fbdump %s: write %s: %v (%v)", out, tmp, err, time.Since(t0))
		return err
	}
	if err := os.Rename(tmp, out); err != nil {
		os.Remove(tmp)
		diagf("fbdump %s: rename: %v (%v)", out, err, time.Since(t0))
		return err
	}
	diagf("fbdump %s: %d bytes (%v)", out, len(b), time.Since(t0))
	return nil
}
