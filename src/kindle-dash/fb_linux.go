//go:build linux

package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"time"
)

const diagLog = "/mnt/us/diag.log"

// eips is the Voyage's EPDC display tool — the ONLY path that triggers
// a visible screen refresh (the "wave"). A plain /dev/fb0 mmap write is
// NOT visible (docs/03, ISSUES I10), so display() execs eips instead of
// writing the framebuffer. Its input must be a single-IDAT 8-bit
// grayscale PNG (saveKindlePNG, convert.go), 1072×1448 (or 1448×1072).
const eipsPath = "/usr/sbin/eips"

// eipsTimeout bounds one eips run so a wedged EPDC can't hang the 24/7
// refresh loop (a full FLASH is ~3 s, ISSUES I10; docs/03: 30 s).
const eipsTimeout = 30 * time.Second

// display triggers the visible EPDC refresh for the given PNG:
//
//	eips -g <file> -x 0 -y 0
//
// (grayscale input, no offset). rc + duration are always logged to
// diag.log — readable later via MRPI .log even when the screen state
// is not (I02).
func display(in string) error {
	ctx, cancel := context.WithTimeout(context.Background(), eipsTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, eipsPath, "-g", in, "-x", "0", "-y", "0")
	t0 := time.Now()
	err := cmd.Run()
	dur := time.Since(t0)
	if err != nil {
		var ee *exec.ExitError
		rc := -1
		if errors.As(err, &ee) {
			rc = ee.ExitCode()
		}
		diagf("eips rc=%d (%v): %v", rc, dur, err)
		return fmt.Errorf("eips: %w", err)
	}
	diagf("eips rc=0 (%v)", dur)
	return nil
}

// diagf appends a timestamped line to /mnt/us/diag.log, best effort:
// a failed log write is dropped, never fails the render. diag.log is
// the unattended-device log: readable from the host via MRPI
// `;get /mnt/us/diag.log` (no terminal, I02) — so display() logs the
// eips rc there: even if the screen state can't be observed, the
// exit code can.
func diagf(format string, args ...any) {
	f, err := os.OpenFile(diagLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s %s\n", time.Now().UTC().Format("2006-01-02T15:04:05Z"), fmt.Sprintf(format, args...))
}
