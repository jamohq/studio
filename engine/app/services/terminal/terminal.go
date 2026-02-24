// Package terminal implements the TerminalService gRPC handler.
package terminal

import (
	"context"
	"io"

	"github.com/jamojamo/studio/engine/app/sdk/errs"
	"github.com/jamojamo/studio/engine/business/domain/terminalbus"
	"github.com/jamojamo/studio/engine/foundation/logger"
	jamov1 "github.com/jamojamo/studio/engine/proto/jamo/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Config holds dependencies for the terminal service.
type Config struct {
	Log         *logger.Logger
	TerminalBus *terminalbus.Business
}

// App implements the TerminalService gRPC server.
type App struct {
	jamov1.UnimplementedTerminalServiceServer
	log *logger.Logger
	bus *terminalbus.Business
}

// NewApp creates a new terminal service handler.
func NewApp(cfg Config) *App {
	return &App{
		log: cfg.Log,
		bus: cfg.TerminalBus,
	}
}

// Register registers the terminal service with the gRPC server.
func Register(server *grpc.Server, cfg Config) {
	jamov1.RegisterTerminalServiceServer(server, NewApp(cfg))
}

// CreateTerminal creates a new terminal session.
func (a *App) CreateTerminal(ctx context.Context, req *jamov1.CreateTerminalRequest) (*jamov1.CreateTerminalResponse, error) {
	shell := "/bin/zsh"

	cols := uint16(req.GetCols())
	rows := uint16(req.GetRows())
	if cols == 0 {
		cols = 80
	}
	if rows == 0 {
		rows = 24
	}

	id, err := a.bus.Create(ctx, shell, cols, rows)
	if err != nil {
		return nil, errs.ToGRPCError(err)
	}

	return &jamov1.CreateTerminalResponse{
		SessionId: id,
	}, nil
}

// TerminalStream handles bi-directional terminal I/O.
func (a *App) TerminalStream(stream jamov1.TerminalService_TerminalStreamServer) error {
	// First message must contain session ID.
	first, err := stream.Recv()
	if err != nil {
		return status.Error(codes.InvalidArgument, "expected initial message with session_id")
	}

	sessionID := first.GetSessionId()
	sess, ok := a.bus.Get(sessionID)
	if !ok {
		return status.Errorf(codes.NotFound, "terminal session not found: %s", sessionID)
	}

	// Goroutine: read PTY output → send to client.
	errCh := make(chan error, 1)
	go func() {
		buf := make([]byte, 4096)
		for {
			n, err := sess.Read(buf)
			if n > 0 {
				out := make([]byte, n)
				copy(out, buf[:n])
				if sendErr := stream.Send(&jamov1.TerminalOutput{
					SessionId: sessionID,
					Data:      out,
				}); sendErr != nil {
					errCh <- sendErr
					return
				}
			}
			if err != nil {
				if err == io.EOF {
					errCh <- nil
				} else {
					errCh <- err
				}
				return
			}
		}
	}()

	// Main loop: read client input → write to PTY or resize.
	for {
		msg, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}

		switch payload := msg.GetPayload().(type) {
		case *jamov1.TerminalInput_Data:
			if _, err := sess.Write(payload.Data); err != nil {
				a.log.Error(stream.Context(), "pty write error", "session", sessionID, "error", err)
			}
		case *jamov1.TerminalInput_Resize:
			if err := sess.Resize(uint16(payload.Resize.GetCols()), uint16(payload.Resize.GetRows())); err != nil {
				a.log.Error(stream.Context(), "pty resize error", "session", sessionID, "error", err)
			}
		}
	}

	// Wait for the reader goroutine to finish.
	return <-errCh
}
