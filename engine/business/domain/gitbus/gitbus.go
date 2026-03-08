// Package gitbus provides business logic for git operations within workspaces.
package gitbus

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/jamojamo/studio/engine/app/sdk/errs"
	"github.com/jamojamo/studio/engine/business/domain/workspacebus"
	"github.com/jamojamo/studio/engine/foundation/logger"
	"google.golang.org/grpc/codes"
)

// GitLogEntry represents a single commit log entry.
type GitLogEntry struct {
	Hash      string
	ShortHash string
	Message   string
	Timestamp string
}

// ChangedFile represents a file with its git status.
type ChangedFile struct {
	Path   string
	Status string
}

// Business manages git operations.
type Business struct {
	log *logger.Logger
	ws  *workspacebus.Business
}

// NewBusiness creates a new git business instance.
func NewBusiness(log *logger.Logger, ws *workspacebus.Business) *Business {
	return &Business{
		log: log,
		ws:  ws,
	}
}

func (b *Business) workspacePath(wsID string) (string, error) {
	ws, err := b.ws.Get(wsID)
	if err != nil {
		return "", err
	}
	return ws.Path, nil
}

func (b *Business) runGit(ctx context.Context, dir string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("git %s: %s: %w", args[0], strings.TrimSpace(stderr.String()), err)
	}
	return stdout.String(), nil
}

// Init initializes a git repository in the workspace. No-op if already initialized.
func (b *Business) Init(ctx context.Context, wsID string) (bool, error) {
	dir, err := b.workspacePath(wsID)
	if err != nil {
		return false, err
	}

	// Check if already initialized.
	gitDir := filepath.Join(dir, ".git")
	if info, err := os.Stat(gitDir); err == nil && info.IsDir() {
		b.log.Info(ctx, "git already initialized", "workspace", wsID)
		b.ensureGitignore(dir)
		return true, nil
	}

	if _, err := exec.LookPath("git"); err != nil {
		return false, errs.New(codes.FailedPrecondition, "git not installed")
	}

	if _, err := b.runGit(ctx, dir, "init"); err != nil {
		return false, errs.Newf(codes.Internal, "git init failed: %s", err)
	}

	b.ensureGitignore(dir)
	b.log.Info(ctx, "git initialized", "workspace", wsID)
	return false, nil
}

// ensureGitignore ensures .jamo/sync-status.json is in .gitignore.
func (b *Business) ensureGitignore(dir string) {
	gitignorePath := filepath.Join(dir, ".gitignore")
	entry := ".jamo/sync-status.json"

	data, err := os.ReadFile(gitignorePath)
	if err == nil {
		// Check if already present.
		scanner := bufio.NewScanner(bytes.NewReader(data))
		for scanner.Scan() {
			if strings.TrimSpace(scanner.Text()) == entry {
				return
			}
		}
		// Append.
		f, err := os.OpenFile(gitignorePath, os.O_APPEND|os.O_WRONLY, 0o644)
		if err != nil {
			return
		}
		defer f.Close()
		// Ensure newline before our entry.
		if len(data) > 0 && data[len(data)-1] != '\n' {
			f.WriteString("\n")
		}
		f.WriteString(entry + "\n")
		return
	}

	// Create new .gitignore.
	os.WriteFile(gitignorePath, []byte(entry+"\n"), 0o644)
}

// Status returns the git status of the workspace.
func (b *Business) Status(ctx context.Context, wsID string) ([]ChangedFile, bool, error) {
	dir, err := b.workspacePath(wsID)
	if err != nil {
		return nil, false, err
	}

	output, err := b.runGit(ctx, dir, "status", "--porcelain=v1")
	if err != nil {
		return nil, false, errs.Newf(codes.Internal, "git status failed: %s", err)
	}

	if strings.TrimSpace(output) == "" {
		return nil, true, nil
	}

	var files []ChangedFile
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 4 {
			continue
		}
		xy := line[:2]
		path := strings.TrimSpace(line[3:])
		// Handle renames: "R  old -> new"
		if strings.Contains(path, " -> ") {
			parts := strings.SplitN(path, " -> ", 2)
			path = parts[1]
		}
		status := mapStatus(xy)
		files = append(files, ChangedFile{Path: path, Status: status})
	}

	return files, false, nil
}

func mapStatus(xy string) string {
	// Check index (first char) and worktree (second char).
	x := xy[0]
	y := xy[1]

	if x == '?' && y == '?' {
		return "untracked"
	}
	if x == 'R' || y == 'R' {
		return "renamed"
	}
	if x == 'A' || y == 'A' {
		return "added"
	}
	if x == 'D' || y == 'D' {
		return "deleted"
	}
	if x == 'M' || y == 'M' {
		return "modified"
	}
	return "modified"
}

// Diff returns the diff for the workspace or a specific file.
func (b *Business) Diff(ctx context.Context, wsID, filePath string) (string, error) {
	dir, err := b.workspacePath(wsID)
	if err != nil {
		return "", err
	}

	// Check if there are any commits.
	hasCommits := true
	if _, err := b.runGit(ctx, dir, "rev-parse", "HEAD"); err != nil {
		hasCommits = false
	}

	if filePath != "" {
		// Check if file is untracked.
		statusOut, _ := b.runGit(ctx, dir, "status", "--porcelain=v1", "--", filePath)
		if strings.HasPrefix(strings.TrimSpace(statusOut), "??") {
			absPath := filepath.Join(dir, filePath)
			output, err := b.runGit(ctx, dir, "diff", "--no-index", "/dev/null", absPath)
			if err != nil && output == "" {
				return "", errs.Newf(codes.Internal, "git diff failed: %s", err)
			}
			return output, nil
		}

		if hasCommits {
			output, err := b.runGit(ctx, dir, "diff", "HEAD", "--", filePath)
			if err != nil {
				return "", errs.Newf(codes.Internal, "git diff failed: %s", err)
			}
			return output, nil
		}

		// No commits yet, diff against empty tree.
		output, err := b.runGit(ctx, dir, "diff", "--cached", "--", filePath)
		if err != nil {
			return "", errs.Newf(codes.Internal, "git diff failed: %s", err)
		}
		return output, nil
	}

	// All files diff.
	if hasCommits {
		output, err := b.runGit(ctx, dir, "diff", "HEAD")
		if err != nil {
			return "", errs.Newf(codes.Internal, "git diff failed: %s", err)
		}
		return output, nil
	}

	output, err := b.runGit(ctx, dir, "diff", "--cached")
	if err != nil {
		return "", errs.Newf(codes.Internal, "git diff failed: %s", err)
	}
	return output, nil
}

// Commit stages all changes and creates a commit.
func (b *Business) Commit(ctx context.Context, wsID, message string) (string, error) {
	dir, err := b.workspacePath(wsID)
	if err != nil {
		return "", err
	}

	// Stage all changes.
	if _, err := b.runGit(ctx, dir, "add", "-A"); err != nil {
		return "", errs.Newf(codes.Internal, "git add failed: %s", err)
	}

	// Check if there's anything to commit.
	statusOut, err := b.runGit(ctx, dir, "status", "--porcelain=v1")
	if err != nil {
		return "", errs.Newf(codes.Internal, "git status failed: %s", err)
	}
	if strings.TrimSpace(statusOut) == "" {
		return "", errs.New(codes.FailedPrecondition, "nothing to commit")
	}

	// Commit.
	output, err := b.runGit(ctx, dir, "commit", "-m", message)
	if err != nil {
		return "", errs.Newf(codes.Internal, "git commit failed: %s", err)
	}

	// Extract commit hash.
	hash, _ := b.runGit(ctx, dir, "rev-parse", "HEAD")
	hash = strings.TrimSpace(hash)

	b.log.Info(ctx, "committed", "workspace", wsID, "hash", hash, "output", strings.TrimSpace(output))

	return hash, nil
}

// Checkout discards uncommitted changes for the given paths.
// If paths is empty, it discards all changes (git checkout -- .).
// For untracked files, it removes them. For tracked files, it restores them.
func (b *Business) Checkout(ctx context.Context, wsID string, paths []string) error {
	dir, err := b.workspacePath(wsID)
	if err != nil {
		return err
	}

	if len(paths) == 0 {
		// Discard all: reset tracked files and clean untracked.
		if _, err := b.runGit(ctx, dir, "checkout", "--", "."); err != nil {
			return errs.Newf(codes.Internal, "git checkout failed: %s", err)
		}
		if _, err := b.runGit(ctx, dir, "clean", "-fd"); err != nil {
			return errs.Newf(codes.Internal, "git clean failed: %s", err)
		}
		b.log.Info(ctx, "discarded all changes", "workspace", wsID)
		return nil
	}

	// Separate tracked vs untracked files.
	statusOut, err := b.runGit(ctx, dir, "status", "--porcelain=v1")
	if err != nil {
		return errs.Newf(codes.Internal, "git status failed: %s", err)
	}

	untrackedSet := make(map[string]bool)
	scanner := bufio.NewScanner(strings.NewReader(statusOut))
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) >= 4 && line[0] == '?' && line[1] == '?' {
			p := strings.TrimSpace(line[3:])
			untrackedSet[p] = true
		}
	}

	var trackedPaths []string
	for _, p := range paths {
		if untrackedSet[p] {
			// Remove untracked file/directory.
			absPath := filepath.Join(dir, p)
			if err := os.RemoveAll(absPath); err != nil {
				return errs.Newf(codes.Internal, "failed to remove %s: %s", p, err)
			}
		} else {
			trackedPaths = append(trackedPaths, p)
		}
	}

	if len(trackedPaths) > 0 {
		args := append([]string{"checkout", "--"}, trackedPaths...)
		if _, err := b.runGit(ctx, dir, args...); err != nil {
			return errs.Newf(codes.Internal, "git checkout failed: %s", err)
		}
	}

	b.log.Info(ctx, "discarded changes", "workspace", wsID, "paths", paths)
	return nil
}

// Log returns recent commit history.
func (b *Business) Log(ctx context.Context, wsID string, limit int) ([]GitLogEntry, error) {
	dir, err := b.workspacePath(wsID)
	if err != nil {
		return nil, err
	}

	if limit <= 0 {
		limit = 20
	}

	output, err := b.runGit(ctx, dir, "log", "--format=%H|%h|%s|%ai", "-n", strconv.Itoa(limit))
	if err != nil {
		// No commits yet is not an error.
		if strings.Contains(err.Error(), "does not have any commits") {
			return nil, nil
		}
		return nil, errs.Newf(codes.Internal, "git log failed: %s", err)
	}

	var entries []GitLogEntry
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "|", 4)
		if len(parts) < 4 {
			continue
		}
		entries = append(entries, GitLogEntry{
			Hash:      parts[0],
			ShortHash: parts[1],
			Message:   parts[2],
			Timestamp: parts[3],
		})
	}

	return entries, nil
}
