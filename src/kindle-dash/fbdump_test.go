package main

import (
	"os"
	"path/filepath"
	"testing"
)

// The !linux stub (fbdump_stub.go) is the only testable path on a dev
// machine; the linux path (fbdump_linux.go) is compile-checked via the
// cross build and exercised on the device (ISSUES I14, T25).
func TestFbDumpStub(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "fb.raw")
	in := []byte{0, 1, 2, 255, 254, 253}
	if err := os.WriteFile(src, in, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DASH_FB", src)
	out := filepath.Join(dir, "out.raw")
	if err := fbdump(out); err != nil {
		t.Fatalf("fbdump: %v", err)
	}
	got, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != len(in) || string(got) != string(in) {
		t.Fatalf("dump mismatch: %x != %x", got, in)
	}
	if _, err := os.Stat(out + ".tmp"); !os.IsNotExist(err) {
		t.Fatal("tmp file left behind (atomic rename failed?)")
	}
}

func TestFbDumpStubNoEnv(t *testing.T) {
	t.Setenv("DASH_FB", "")
	if err := fbdump(filepath.Join(t.TempDir(), "out.raw")); err == nil {
		t.Fatal("expected error without DASH_FB")
	}
}
