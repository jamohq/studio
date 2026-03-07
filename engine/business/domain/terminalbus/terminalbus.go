// Package terminalbus provides business logic for terminal session management.
package terminalbus

import (
	"context"
	"sync"

	"github.com/google/uuid"
	"github.com/jamojamo/studio/engine/app/sdk/errs"
	"github.com/jamojamo/studio/engine/foundation/logger"
	"github.com/jamojamo/studio/engine/foundation/pty"
	"google.golang.org/grpc/codes"
)

// Business manages terminal sessions.
type Business struct {
	log      *logger.Logger
	sessions map[string]*pty.Session
	mu       sync.RWMutex
}

// NewBusiness creates a new terminal business instance.
func NewBusiness(log *logger.Logger) *Business {
	return &Business{
		log:      log,
		sessions: make(map[string]*pty.Session),
	}
}

// Create starts a new terminal session with the given shell and dimensions.
func (b *Business) Create(ctx context.Context, shell string, cols, rows uint16, workdir string) (string, error) {
	sess, err := pty.Start(shell, cols, rows, workdir)
	if err != nil {
		return "", errs.Newf(codes.Internal, "failed to create terminal: %s", err)
	}

	id := uuid.New().String()

	b.mu.Lock()
	b.sessions[id] = sess
	b.mu.Unlock()

	b.log.Info(ctx, "terminal created", "id", id, "shell", shell, "cols", cols, "rows", rows)

	return id, nil
}

// Get returns a terminal session by ID.
func (b *Business) Get(id string) (*pty.Session, bool) {
	b.mu.RLock()
	sess, ok := b.sessions[id]
	b.mu.RUnlock()

	return sess, ok
}

// Close terminates a specific terminal session.
func (b *Business) Close(id string) {
	b.mu.Lock()
	sess, ok := b.sessions[id]
	if ok {
		delete(b.sessions, id)
	}
	b.mu.Unlock()

	if ok {
		sess.Close()
	}
}

// CloseAll terminates all terminal sessions.
func (b *Business) CloseAll() {
	b.mu.Lock()
	sessions := b.sessions
	b.sessions = make(map[string]*pty.Session)
	b.mu.Unlock()

	for _, sess := range sessions {
		sess.Close()
	}
}
