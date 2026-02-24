// Package workspace implements the WorkspaceService gRPC handler.
package workspace

import (
	"context"

	"github.com/jamojamo/studio/engine/app/sdk/errs"
	"github.com/jamojamo/studio/engine/business/domain/workspacebus"
	"github.com/jamojamo/studio/engine/foundation/logger"
	jamov1 "github.com/jamojamo/studio/engine/proto/jamo/v1"
	"google.golang.org/grpc"
)

// Config holds dependencies for the workspace service.
type Config struct {
	Log          *logger.Logger
	WorkspaceBus *workspacebus.Business
}

// App implements the WorkspaceService gRPC server.
type App struct {
	jamov1.UnimplementedWorkspaceServiceServer
	log *logger.Logger
	bus *workspacebus.Business
}

// NewApp creates a new workspace service handler.
func NewApp(cfg Config) *App {
	return &App{
		log: cfg.Log,
		bus: cfg.WorkspaceBus,
	}
}

// Register registers the workspace service with the gRPC server.
func Register(server *grpc.Server, cfg Config) {
	jamov1.RegisterWorkspaceServiceServer(server, NewApp(cfg))
}

// OpenWorkspace opens a new workspace at the given path.
func (a *App) OpenWorkspace(ctx context.Context, req *jamov1.OpenWorkspaceRequest) (*jamov1.OpenWorkspaceResponse, error) {
	ws, err := a.bus.Open(ctx, req.GetPath())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	return &jamov1.OpenWorkspaceResponse{
		WorkspaceId: ws.ID,
		Path:        ws.Path,
	}, nil
}

// ReadFile reads a file within the workspace.
func (a *App) ReadFile(ctx context.Context, req *jamov1.ReadFileRequest) (*jamov1.ReadFileResponse, error) {
	data, err := a.bus.ReadFile(ctx, req.GetWorkspaceId(), req.GetRelativePath())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	return &jamov1.ReadFileResponse{
		Content: data,
	}, nil
}

// WriteFile writes content to a file within the workspace.
func (a *App) WriteFile(ctx context.Context, req *jamov1.WriteFileRequest) (*jamov1.WriteFileResponse, error) {
	err := a.bus.WriteFile(ctx, req.GetWorkspaceId(), req.GetRelativePath(), req.GetContent())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	return &jamov1.WriteFileResponse{}, nil
}

// ListDirectory lists entries in a directory within the workspace.
func (a *App) ListDirectory(ctx context.Context, req *jamov1.ListDirectoryRequest) (*jamov1.ListDirectoryResponse, error) {
	entries, err := a.bus.ListDirectory(ctx, req.GetWorkspaceId(), req.GetRelativePath())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	pbEntries := make([]*jamov1.FileEntry, len(entries))
	for i, e := range entries {
		pbEntries[i] = &jamov1.FileEntry{
			Name:  e.Name,
			IsDir: e.IsDir,
			Size:  e.Size,
		}
	}

	return &jamov1.ListDirectoryResponse{
		Entries: pbEntries,
	}, nil
}

// MoveFile moves/renames a file or directory within the workspace.
func (a *App) MoveFile(ctx context.Context, req *jamov1.MoveFileRequest) (*jamov1.MoveFileResponse, error) {
	err := a.bus.MoveFile(ctx, req.GetWorkspaceId(), req.GetOldPath(), req.GetNewPath())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	return &jamov1.MoveFileResponse{}, nil
}

// CreateDirectory creates a directory within the workspace.
func (a *App) CreateDirectory(ctx context.Context, req *jamov1.CreateDirectoryRequest) (*jamov1.CreateDirectoryResponse, error) {
	err := a.bus.CreateDirectory(ctx, req.GetWorkspaceId(), req.GetRelativePath())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	return &jamov1.CreateDirectoryResponse{}, nil
}
