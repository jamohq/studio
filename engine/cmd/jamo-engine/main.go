package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/jamojamo/studio/engine/app/services/event"
	"github.com/jamojamo/studio/engine/app/services/generate"
	gitservice "github.com/jamojamo/studio/engine/app/services/git"
	"github.com/jamojamo/studio/engine/app/services/health"
	"github.com/jamojamo/studio/engine/app/services/terminal"
	"github.com/jamojamo/studio/engine/app/services/workspace"
	"github.com/jamojamo/studio/engine/business/domain/generatebus"
	"github.com/jamojamo/studio/engine/business/domain/gitbus"
	"github.com/jamojamo/studio/engine/business/domain/terminalbus"
	"github.com/jamojamo/studio/engine/business/domain/workspacebus"
	"github.com/jamojamo/studio/engine/foundation/grpcserver"
	"github.com/jamojamo/studio/engine/foundation/logger"
)

func main() {
	log := logger.New(os.Stderr, logger.LevelInfo, "jamo-engine", nil)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	if err := run(ctx, log); err != nil {
		log.Error(ctx, "startup error", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, log *logger.Logger) error {
	// -------------------------------------------------------------------------
	// Generate auth token.

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return fmt.Errorf("generating token: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	// -------------------------------------------------------------------------
	// Start listener on ephemeral port.

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return fmt.Errorf("creating listener: %w", err)
	}
	defer lis.Close()

	port := lis.Addr().(*net.TCPAddr).Port

	// Print port and token to stdout for Electron to parse.
	// Logger writes to stderr, keeping stdout clean as a control channel.
	fmt.Fprintf(os.Stdout, "JAMO_ENGINE_PORT=%d\n", port)
	fmt.Fprintf(os.Stdout, "JAMO_ENGINE_TOKEN=%s\n", token)

	log.Info(ctx, "engine starting", "port", port)

	// -------------------------------------------------------------------------
	// Build foundation layer.

	srv := grpcserver.New(grpcserver.Config{
		Log:   log,
		Token: token,
	})

	// -------------------------------------------------------------------------
	// Build business layer (DI bottom-up).

	wsBus := workspacebus.NewBusiness(log)
	termBus := terminalbus.NewBusiness(log)
	genBus := generatebus.NewBusiness(log)
	gitBus := gitbus.NewBusiness(log, wsBus)

	// -------------------------------------------------------------------------
	// Register gRPC services.

	health.Register(srv, health.Config{
		Log: log,
	})

	workspace.Register(srv, workspace.Config{
		Log:          log,
		WorkspaceBus: wsBus,
	})

	terminal.Register(srv, terminal.Config{
		Log:         log,
		TerminalBus: termBus,
	})

	// Event service (returns the app so we can use its Send method).
	eventApp := event.Register(srv, event.Config{
		Log: log,
	})

	generate.Register(srv, generate.Config{
		Log:          log,
		GenerateBus:  genBus,
		WorkspaceBus: wsBus,
		EventSender:  eventApp.Send,
	})

	gitservice.Register(srv, gitservice.Config{
		Log:    log,
		GitBus: gitBus,
	})

	// -------------------------------------------------------------------------
	// Start serving in a goroutine.

	errCh := make(chan error, 1)
	go func() {
		log.Info(ctx, "grpc server listening", "addr", lis.Addr().String())
		errCh <- srv.Serve(lis)
	}()

	// -------------------------------------------------------------------------
	// Wait for shutdown signal or server error.

	select {
	case <-ctx.Done():
		log.Info(ctx, "shutdown signal received")
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	}

	// Graceful shutdown.
	log.Info(ctx, "shutting down")
	termBus.CloseAll()
	srv.GracefulStop()

	return nil
}
