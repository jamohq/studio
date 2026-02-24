// Package event implements the EventService gRPC handler.
package event

import (
	"sync"

	"github.com/jamojamo/studio/engine/foundation/logger"
	jamov1 "github.com/jamojamo/studio/engine/proto/jamo/v1"
	"google.golang.org/grpc"
)

// Config holds dependencies for the event service.
type Config struct {
	Log *logger.Logger
}

// App implements the EventService gRPC server and manages event distribution.
type App struct {
	jamov1.UnimplementedEventServiceServer
	log         *logger.Logger
	subscribers map[string][]chan *jamov1.Event
	mu          sync.RWMutex
}

// NewApp creates a new event service handler.
func NewApp(cfg Config) *App {
	return &App{
		log:         cfg.Log,
		subscribers: make(map[string][]chan *jamov1.Event),
	}
}

// Register registers the event service with the gRPC server.
func Register(server *grpc.Server, cfg Config) *App {
	app := NewApp(cfg)
	jamov1.RegisterEventServiceServer(server, app)
	return app
}

// Send broadcasts an event to all subscribers.
func (a *App) Send(event *jamov1.Event) {
	a.mu.RLock()
	defer a.mu.RUnlock()

	for _, subs := range a.subscribers {
		for _, ch := range subs {
			select {
			case ch <- event:
			default:
				// Drop event if subscriber is too slow.
			}
		}
	}
}

// StreamEvents opens a server-stream for events.
func (a *App) StreamEvents(req *jamov1.StreamEventsRequest, stream jamov1.EventService_StreamEventsServer) error {
	wsID := req.GetWorkspaceId()
	ch := make(chan *jamov1.Event, 64)

	// Register subscriber.
	a.mu.Lock()
	a.subscribers[wsID] = append(a.subscribers[wsID], ch)
	a.mu.Unlock()

	// Unregister on exit.
	defer func() {
		a.mu.Lock()
		subs := a.subscribers[wsID]
		for i, s := range subs {
			if s == ch {
				a.subscribers[wsID] = append(subs[:i], subs[i+1:]...)
				break
			}
		}
		a.mu.Unlock()
		close(ch)
	}()

	for {
		select {
		case <-stream.Context().Done():
			return nil
		case event, ok := <-ch:
			if !ok {
				return nil
			}
			if err := stream.Send(event); err != nil {
				return err
			}
		}
	}
}
