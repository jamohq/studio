package workspacebus

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/jamojamo/studio/engine/foundation/logger"
)

func newTestBusiness(t *testing.T) (*Business, string) {
	t.Helper()
	log := logger.New(io.Discard, logger.LevelInfo, "test", nil)
	dir := t.TempDir()
	b := NewBusiness(log)
	return b, dir
}

func openTestWorkspace(t *testing.T, b *Business, dir string) *Workspace {
	t.Helper()
	ws, err := b.Open(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	return ws
}

func TestOpen(t *testing.T) {
	b, dir := newTestBusiness(t)

	ws, err := b.Open(context.Background(), dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ws.Path != dir {
		t.Fatalf("expected path %q, got %q", dir, ws.Path)
	}
	if ws.ID == "" {
		t.Fatal("expected non-empty ID")
	}
}

func TestOpen_NotExists(t *testing.T) {
	b, _ := newTestBusiness(t)

	_, err := b.Open(context.Background(), "/nonexistent/path/xyz")
	if err == nil {
		t.Fatal("expected error for nonexistent path")
	}
}

func TestOpen_NotDirectory(t *testing.T) {
	b, dir := newTestBusiness(t)

	file := filepath.Join(dir, "file.txt")
	os.WriteFile(file, []byte("hello"), 0o644)

	_, err := b.Open(context.Background(), file)
	if err == nil {
		t.Fatal("expected error for non-directory path")
	}
}

func TestGet(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)

	got, err := b.Get(ws.ID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != ws.ID {
		t.Fatalf("expected ID %q, got %q", ws.ID, got.ID)
	}
}

func TestGet_NotFound(t *testing.T) {
	b, _ := newTestBusiness(t)

	_, err := b.Get("nonexistent-id")
	if err == nil {
		t.Fatal("expected error for nonexistent workspace")
	}
}

func TestResolvePath(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)

	resolved, err := b.ResolvePath(ws.ID, "subdir/file.txt")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := filepath.Join(dir, "subdir/file.txt")
	if resolved != expected {
		t.Fatalf("expected %q, got %q", expected, resolved)
	}
}

func TestResolvePath_EscapeSandbox(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)

	cases := []string{
		"../../etc/passwd",
		"../sibling",
		"foo/../../..",
		"foo/../../../etc",
		"..",
		"../",
	}
	for _, relPath := range cases {
		_, err := b.ResolvePath(ws.ID, relPath)
		if err == nil {
			t.Errorf("expected error for path escaping sandbox: %q", relPath)
		}
	}
}

func TestResolvePath_AllowsDotJamo(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)

	// Paths within the workspace should be allowed, including dotfiles.
	resolved, err := b.ResolvePath(ws.ID, ".jamo/runs/test.json")
	if err != nil {
		t.Fatalf("unexpected error for .jamo path: %v", err)
	}
	expected := filepath.Join(dir, ".jamo/runs/test.json")
	if resolved != expected {
		t.Fatalf("expected %q, got %q", expected, resolved)
	}
}

func TestResolvePath_WorkspaceRootItself(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)

	// Resolving "." should return the workspace root.
	resolved, err := b.ResolvePath(ws.ID, ".")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resolved != dir {
		t.Fatalf("expected %q, got %q", dir, resolved)
	}
}

func TestWriteAndReadFile(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)
	ctx := context.Background()

	content := []byte("hello world")
	if err := b.WriteFile(ctx, ws.ID, "test.txt", content); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	data, err := b.ReadFile(ctx, ws.ID, "test.txt")
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if string(data) != "hello world" {
		t.Fatalf("expected 'hello world', got %q", string(data))
	}
}

func TestWriteFile_CreatesParentDirs(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)
	ctx := context.Background()

	if err := b.WriteFile(ctx, ws.ID, "deep/nested/dir/file.txt", []byte("data")); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}

	expected := filepath.Join(dir, "deep/nested/dir/file.txt")
	if _, err := os.Stat(expected); err != nil {
		t.Fatalf("expected file to exist at %q", expected)
	}
}

func TestListDirectory(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)
	ctx := context.Background()

	os.WriteFile(filepath.Join(dir, "a.txt"), []byte("a"), 0o644)
	os.WriteFile(filepath.Join(dir, "b.txt"), []byte("b"), 0o644)
	os.Mkdir(filepath.Join(dir, "subdir"), 0o755)

	entries, err := b.ListDirectory(ctx, ws.ID, ".")
	if err != nil {
		t.Fatalf("ListDirectory: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}
}

func TestMoveFile(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)
	ctx := context.Background()

	os.WriteFile(filepath.Join(dir, "old.txt"), []byte("data"), 0o644)

	if err := b.MoveFile(ctx, ws.ID, "old.txt", "new.txt"); err != nil {
		t.Fatalf("MoveFile: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "old.txt")); !os.IsNotExist(err) {
		t.Fatal("expected old file to not exist")
	}
	if _, err := os.Stat(filepath.Join(dir, "new.txt")); err != nil {
		t.Fatal("expected new file to exist")
	}
}

func TestCreateDirectory(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)
	ctx := context.Background()

	if err := b.CreateDirectory(ctx, ws.ID, "newdir/nested"); err != nil {
		t.Fatalf("CreateDirectory: %v", err)
	}

	info, err := os.Stat(filepath.Join(dir, "newdir/nested"))
	if err != nil {
		t.Fatal("expected directory to exist")
	}
	if !info.IsDir() {
		t.Fatal("expected a directory")
	}
}

func TestDeleteFile(t *testing.T) {
	b, dir := newTestBusiness(t)
	ws := openTestWorkspace(t, b, dir)
	ctx := context.Background()

	os.WriteFile(filepath.Join(dir, "delete-me.txt"), []byte("bye"), 0o644)

	if err := b.DeleteFile(ctx, ws.ID, "delete-me.txt"); err != nil {
		t.Fatalf("DeleteFile: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "delete-me.txt")); !os.IsNotExist(err) {
		t.Fatal("expected file to be deleted")
	}
}
