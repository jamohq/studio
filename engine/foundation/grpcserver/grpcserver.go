// Package grpcserver provides gRPC server creation with interceptor chains.
package grpcserver

import (
	"github.com/jamojamo/studio/engine/foundation/logger"
	"google.golang.org/grpc"
)

// Config holds the configuration for creating a gRPC server.
type Config struct {
	Log   *logger.Logger
	Token string
}

// New creates a new gRPC server with auth, logging, and recovery interceptors.
func New(cfg Config) *grpc.Server {
	srv := grpc.NewServer(
		grpc.ChainUnaryInterceptor(
			recoveryUnaryInterceptor(cfg.Log),
			authUnaryInterceptor(cfg.Token),
			loggingUnaryInterceptor(cfg.Log),
		),
		grpc.ChainStreamInterceptor(
			recoveryStreamInterceptor(cfg.Log),
			authStreamInterceptor(cfg.Token),
			loggingStreamInterceptor(cfg.Log),
		),
	)

	return srv
}
