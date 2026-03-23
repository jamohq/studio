package grpcserver

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jamojamo/studio/engine/foundation/logger"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// =============================================================================
// Auth interceptors

func authUnaryInterceptor(token string) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		if err := authenticate(ctx, token, info.FullMethod); err != nil {
			return nil, err
		}
		return handler(ctx, req)
	}
}

func authStreamInterceptor(token string) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		if err := authenticate(ss.Context(), token, info.FullMethod); err != nil {
			return err
		}
		return handler(srv, ss)
	}
}

func authenticate(ctx context.Context, token string, method string) error {
	// Skip auth for health check. Use exact match to prevent bypass via
	// crafted service names that end with the same suffix.
	if method == "/jamo.v1.HealthService/Ping" {
		return nil
	}

	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return status.Error(codes.Unauthenticated, "missing metadata")
	}

	values := md.Get("authorization")
	if len(values) == 0 {
		return status.Error(codes.Unauthenticated, "missing authorization header")
	}

	authHeader := values[0]
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return status.Error(codes.Unauthenticated, "invalid authorization format")
	}

	provided := strings.TrimPrefix(authHeader, "Bearer ")
	if provided != token {
		return status.Error(codes.Unauthenticated, "invalid token")
	}

	return nil
}

// =============================================================================
// Logging interceptors

func loggingUnaryInterceptor(log *logger.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		start := time.Now()

		resp, err := handler(ctx, req)

		st, _ := status.FromError(err)
		log.Info(ctx, "grpc unary",
			"method", info.FullMethod,
			"duration", time.Since(start).String(),
			"code", st.Code().String(),
		)

		return resp, err
	}
}

func loggingStreamInterceptor(log *logger.Logger) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		start := time.Now()

		err := handler(srv, ss)

		st, _ := status.FromError(err)
		log.Info(ss.Context(), "grpc stream",
			"method", info.FullMethod,
			"duration", time.Since(start).String(),
			"code", st.Code().String(),
		)

		return err
	}
}

// =============================================================================
// Recovery interceptors

func recoveryUnaryInterceptor(log *logger.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp any, err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error(ctx, "grpc panic recovered",
					"method", info.FullMethod,
					"panic", fmt.Sprintf("%v", r),
				)
				err = status.Error(codes.Internal, "internal server error")
			}
		}()

		return handler(ctx, req)
	}
}

func recoveryStreamInterceptor(log *logger.Logger) grpc.StreamServerInterceptor {
	return func(srv any, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) (err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error(ss.Context(), "grpc panic recovered",
					"method", info.FullMethod,
					"panic", fmt.Sprintf("%v", r),
				)
				err = status.Error(codes.Internal, "internal server error")
			}
		}()

		return handler(srv, ss)
	}
}
