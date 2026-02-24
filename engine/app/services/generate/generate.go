// Package generate implements the GenerateService gRPC handler.
package generate

import (
	"context"
	"time"

	"github.com/jamojamo/studio/engine/app/sdk/errs"
	"github.com/jamojamo/studio/engine/business/domain/generatebus"
	"github.com/jamojamo/studio/engine/business/domain/workspacebus"
	"github.com/jamojamo/studio/engine/foundation/logger"
	jamov1 "github.com/jamojamo/studio/engine/proto/jamo/v1"
	"google.golang.org/grpc"
)

// Config holds dependencies for the generate service.
type Config struct {
	Log          *logger.Logger
	GenerateBus  *generatebus.Business
	WorkspaceBus *workspacebus.Business
	EventSender  func(event *jamov1.Event)
}

// App implements the GenerateService gRPC server.
type App struct {
	jamov1.UnimplementedGenerateServiceServer
	log          *logger.Logger
	genBus       *generatebus.Business
	wsBus        *workspacebus.Business
	eventSender  func(event *jamov1.Event)
}

// NewApp creates a new generate service handler.
func NewApp(cfg Config) *App {
	return &App{
		log:         cfg.Log,
		genBus:      cfg.GenerateBus,
		wsBus:       cfg.WorkspaceBus,
		eventSender: cfg.EventSender,
	}
}

// Register registers the generate service with the gRPC server.
func Register(server *grpc.Server, cfg Config) {
	jamov1.RegisterGenerateServiceServer(server, NewApp(cfg))
}

// Generate runs code generation and returns patches.
func (a *App) Generate(ctx context.Context, req *jamov1.GenerateRequest) (*jamov1.GenerateResponse, error) {
	result, err := a.genBus.Generate(ctx, req.GetWorkspaceId(), req.GetPrompt())
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	patches := make([]*jamov1.Patch, len(result.Patches))
	for i, p := range result.Patches {
		patches[i] = &jamov1.Patch{
			FilePath: p.FilePath,
			Content:  p.Content,
		}
	}

	// Emit a progress event if sender is available.
	if a.eventSender != nil {
		a.eventSender(&jamov1.Event{
			Id:          result.TaskID,
			Type:        "generate.completed",
			Payload:     []byte(`{"status":"completed"}`),
			TimestampMs: timeNowMs(),
		})
	}

	return &jamov1.GenerateResponse{
		TaskId:  result.TaskID,
		Patches: patches,
	}, nil
}

// ApplyPatches writes the patches to the workspace.
func (a *App) ApplyPatches(ctx context.Context, req *jamov1.ApplyPatchesRequest) (*jamov1.ApplyPatchesResponse, error) {
	var results []*jamov1.PatchResult

	for _, p := range req.GetPatches() {
		err := a.wsBus.WriteFile(ctx, req.GetWorkspaceId(), p.GetFilePath(), p.GetContent())
		pr := &jamov1.PatchResult{
			FilePath: p.GetFilePath(),
			Applied:  err == nil,
		}
		if err != nil {
			pr.Error = err.Error()
		}
		results = append(results, pr)
	}

	return &jamov1.ApplyPatchesResponse{
		Results: results,
	}, nil
}

func timeNowMs() int64 {
	return time.Now().UnixMilli()
}
