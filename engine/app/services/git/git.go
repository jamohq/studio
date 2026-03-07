// Package git implements the GitService gRPC handler.
package git

import (
	"context"

	"github.com/jamojamo/studio/engine/app/sdk/errs"
	"github.com/jamojamo/studio/engine/business/domain/gitbus"
	"github.com/jamojamo/studio/engine/foundation/logger"
	jamov1 "github.com/jamojamo/studio/engine/proto/jamo/v1"
	"google.golang.org/grpc"
)

// Config holds dependencies for the git service.
type Config struct {
	Log    *logger.Logger
	GitBus *gitbus.Business
}

// App implements the GitService gRPC server.
type App struct {
	jamov1.UnimplementedGitServiceServer
	log *logger.Logger
	bus *gitbus.Business
}

// NewApp creates a new git service handler.
func NewApp(cfg Config) *App {
	return &App{
		log: cfg.Log,
		bus: cfg.GitBus,
	}
}

// Register registers the git service with the gRPC server.
func Register(server *grpc.Server, cfg Config) {
	jamov1.RegisterGitServiceServer(server, NewApp(cfg))
}

// Init initializes a git repository in the workspace.
func (a *App) Init(ctx context.Context, req *jamov1.GitInitRequest) (*jamov1.GitInitResponse, error) {
	alreadyInit, err := a.bus.Init(ctx, req.GetWorkspaceId())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}
	return &jamov1.GitInitResponse{AlreadyInitialized: alreadyInit}, nil
}

// Status returns the git status of the workspace.
func (a *App) Status(ctx context.Context, req *jamov1.GitStatusRequest) (*jamov1.GitStatusResponse, error) {
	files, isClean, err := a.bus.Status(ctx, req.GetWorkspaceId())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	pbFiles := make([]*jamov1.ChangedFile, len(files))
	for i, f := range files {
		pbFiles[i] = &jamov1.ChangedFile{
			Path:   f.Path,
			Status: f.Status,
		}
	}

	return &jamov1.GitStatusResponse{
		Files:   pbFiles,
		IsClean: isClean,
	}, nil
}

// Diff returns the diff for the workspace or a specific file.
func (a *App) Diff(ctx context.Context, req *jamov1.GitDiffRequest) (*jamov1.GitDiffResponse, error) {
	diff, err := a.bus.Diff(ctx, req.GetWorkspaceId(), req.GetFilePath())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}
	return &jamov1.GitDiffResponse{Diff: diff}, nil
}

// Commit stages all changes and creates a commit.
func (a *App) Commit(ctx context.Context, req *jamov1.GitCommitRequest) (*jamov1.GitCommitResponse, error) {
	hash, err := a.bus.Commit(ctx, req.GetWorkspaceId(), req.GetMessage())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}
	return &jamov1.GitCommitResponse{CommitHash: hash}, nil
}

// Log returns recent commit history.
func (a *App) Log(ctx context.Context, req *jamov1.GitLogRequest) (*jamov1.GitLogResponse, error) {
	entries, err := a.bus.Log(ctx, req.GetWorkspaceId(), int(req.GetLimit()))
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	pbEntries := make([]*jamov1.GitLogEntry, len(entries))
	for i, e := range entries {
		pbEntries[i] = &jamov1.GitLogEntry{
			Hash:      e.Hash,
			ShortHash: e.ShortHash,
			Message:   e.Message,
			Timestamp: e.Timestamp,
		}
	}

	return &jamov1.GitLogResponse{Entries: pbEntries}, nil
}
