// Package health implements the HealthService gRPC handler.
package health

import (
	"context"

	"github.com/jamojamo/studio/engine/foundation/logger"
	jamov1 "github.com/jamojamo/studio/engine/proto/jamo/v1"
	"google.golang.org/grpc"
)

// Config holds dependencies for the health service.
type Config struct {
	Log *logger.Logger
}

// App implements the HealthService gRPC server.
type App struct {
	jamov1.UnimplementedHealthServiceServer
	log *logger.Logger
}

// NewApp creates a new health service handler.
func NewApp(cfg Config) *App {
	return &App{
		log: cfg.Log,
	}
}

// Register registers the health service with the gRPC server.
func Register(server *grpc.Server, cfg Config) {
	jamov1.RegisterHealthServiceServer(server, NewApp(cfg))
}

// Ping returns the service status and version.
func (a *App) Ping(ctx context.Context, req *jamov1.PingRequest) (*jamov1.PingResponse, error) {
	return &jamov1.PingResponse{
		Status:  "ok",
		Version: "0.1.0",
	}, nil
}
