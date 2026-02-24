// Package workspacebus provides business logic for workspace management.
package workspacebus

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/google/uuid"
	"github.com/jamojamo/studio/engine/app/sdk/errs"
	"github.com/jamojamo/studio/engine/foundation/logger"
	"google.golang.org/grpc/codes"
)

// Workspace represents an opened workspace directory.
type Workspace struct {
	ID   string
	Path string
}

// Business manages workspace operations.
type Business struct {
	log        *logger.Logger
	workspaces map[string]*Workspace
	mu         sync.RWMutex
}

// NewBusiness creates a new workspace business instance.
func NewBusiness(log *logger.Logger) *Business {
	return &Business{
		log:        log,
		workspaces: make(map[string]*Workspace),
	}
}

// Open validates and opens a workspace at the given path.
func (b *Business) Open(ctx context.Context, path string) (*Workspace, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, errs.Newf(codes.InvalidArgument, "invalid path: %s", err)
	}

	info, err := os.Stat(absPath)
	if err != nil {
		return nil, errs.Newf(codes.NotFound, "path does not exist: %s", absPath)
	}
	if !info.IsDir() {
		return nil, errs.Newf(codes.InvalidArgument, "path is not a directory: %s", absPath)
	}

	ws := &Workspace{
		ID:   uuid.New().String(),
		Path: absPath,
	}

	b.mu.Lock()
	b.workspaces[ws.ID] = ws
	b.mu.Unlock()

	b.log.Info(ctx, "workspace opened", "id", ws.ID, "path", ws.Path)

	return ws, nil
}

// Get returns a workspace by ID.
func (b *Business) Get(id string) (*Workspace, error) {
	b.mu.RLock()
	ws, ok := b.workspaces[id]
	b.mu.RUnlock()

	if !ok {
		return nil, errs.Newf(codes.NotFound, "workspace not found: %s", id)
	}

	return ws, nil
}

// ResolvePath resolves a relative path within a workspace, with sandbox checking.
func (b *Business) ResolvePath(wsID, relPath string) (string, error) {
	ws, err := b.Get(wsID)
	if err != nil {
		return "", err
	}

	absPath := filepath.Join(ws.Path, relPath)
	absPath, err = filepath.Abs(absPath)
	if err != nil {
		return "", errs.Newf(codes.InvalidArgument, "invalid path: %s", err)
	}

	// Sandbox check: ensure resolved path is within workspace root.
	rel, err := filepath.Rel(ws.Path, absPath)
	if err != nil {
		return "", errs.Newf(codes.InvalidArgument, "path resolution error: %s", err)
	}
	if rel == ".." || len(rel) > 1 && rel[:2] == ".." {
		return "", errs.New(codes.PermissionDenied, fmt.Sprintf("path escapes workspace: %s", relPath))
	}

	return absPath, nil
}

// ReadFile reads a file within the workspace.
func (b *Business) ReadFile(ctx context.Context, wsID, relPath string) ([]byte, error) {
	absPath, err := b.ResolvePath(wsID, relPath)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, errs.Newf(codes.NotFound, "failed to read file: %s", err)
	}

	b.log.Debug(ctx, "file read", "workspace", wsID, "path", relPath, "size", len(data))

	return data, nil
}

// FileEntry represents a single directory entry.
type FileEntry struct {
	Name  string
	IsDir bool
	Size  int64
}

// ListDirectory lists entries in a directory within the workspace.
func (b *Business) ListDirectory(ctx context.Context, wsID, relPath string) ([]FileEntry, error) {
	absPath, err := b.ResolvePath(wsID, relPath)
	if err != nil {
		return nil, err
	}

	dirEntries, err := os.ReadDir(absPath)
	if err != nil {
		return nil, errs.Newf(codes.NotFound, "failed to read directory: %s", err)
	}

	entries := make([]FileEntry, 0, len(dirEntries))
	for _, de := range dirEntries {
		info, err := de.Info()
		if err != nil {
			continue
		}
		entries = append(entries, FileEntry{
			Name:  de.Name(),
			IsDir: de.IsDir(),
			Size:  info.Size(),
		})
	}

	b.log.Debug(ctx, "directory listed", "workspace", wsID, "path", relPath, "entries", len(entries))

	return entries, nil
}

// WriteFile writes content to a file within the workspace.
func (b *Business) WriteFile(ctx context.Context, wsID, relPath string, content []byte) error {
	absPath, err := b.ResolvePath(wsID, relPath)
	if err != nil {
		return err
	}

	// Ensure parent directory exists.
	dir := filepath.Dir(absPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return errs.Newf(codes.Internal, "failed to create directory: %s", err)
	}

	if err := os.WriteFile(absPath, content, 0o644); err != nil {
		return errs.Newf(codes.Internal, "failed to write file: %s", err)
	}

	b.log.Info(ctx, "file written", "workspace", wsID, "path", relPath, "size", len(content))

	return nil
}

// MoveFile moves/renames a file or directory within the workspace.
func (b *Business) MoveFile(ctx context.Context, wsID, oldRelPath, newRelPath string) error {
	oldAbs, err := b.ResolvePath(wsID, oldRelPath)
	if err != nil {
		return err
	}

	newAbs, err := b.ResolvePath(wsID, newRelPath)
	if err != nil {
		return err
	}

	// Ensure parent directory of destination exists.
	if err := os.MkdirAll(filepath.Dir(newAbs), 0o755); err != nil {
		return errs.Newf(codes.Internal, "failed to create directory: %s", err)
	}

	if err := os.Rename(oldAbs, newAbs); err != nil {
		return errs.Newf(codes.Internal, "failed to move file: %s", err)
	}

	b.log.Info(ctx, "file moved", "workspace", wsID, "from", oldRelPath, "to", newRelPath)

	return nil
}

// CreateDirectory creates a directory within the workspace.
func (b *Business) CreateDirectory(ctx context.Context, wsID, relPath string) error {
	absPath, err := b.ResolvePath(wsID, relPath)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(absPath, 0o755); err != nil {
		return errs.Newf(codes.Internal, "failed to create directory: %s", err)
	}

	b.log.Info(ctx, "directory created", "workspace", wsID, "path", relPath)

	return nil
}
