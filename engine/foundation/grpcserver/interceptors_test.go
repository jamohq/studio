package grpcserver

import (
	"context"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestAuthenticate_SkipsHealthPing(t *testing.T) {
	err := authenticate(context.Background(), "secret-token", "/jamo.v1.HealthService/Ping")
	if err != nil {
		t.Fatalf("expected no error for health ping, got: %v", err)
	}
}

func TestAuthenticate_DoesNotSkipSuffix(t *testing.T) {
	// A crafted method name that ends with the same suffix should NOT bypass auth.
	err := authenticate(context.Background(), "secret-token", "/evil.v1.FakeHealthService/Ping")
	if err == nil {
		t.Fatal("expected error for non-matching method with similar suffix")
	}
	st, ok := status.FromError(err)
	if !ok {
		t.Fatal("expected gRPC status error")
	}
	if st.Code() != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated, got %v", st.Code())
	}
}

func TestAuthenticate_ValidToken(t *testing.T) {
	ctx := metadata.NewIncomingContext(
		context.Background(),
		metadata.Pairs("authorization", "Bearer valid-token"),
	)
	err := authenticate(ctx, "valid-token", "/jamo.v1.WorkspaceService/ReadFile")
	if err != nil {
		t.Fatalf("expected no error for valid token, got: %v", err)
	}
}

func TestAuthenticate_InvalidToken(t *testing.T) {
	ctx := metadata.NewIncomingContext(
		context.Background(),
		metadata.Pairs("authorization", "Bearer wrong-token"),
	)
	err := authenticate(ctx, "valid-token", "/jamo.v1.WorkspaceService/ReadFile")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
	st, _ := status.FromError(err)
	if st.Code() != codes.Unauthenticated {
		t.Fatalf("expected Unauthenticated, got %v", st.Code())
	}
}

func TestAuthenticate_MissingMetadata(t *testing.T) {
	err := authenticate(context.Background(), "token", "/jamo.v1.WorkspaceService/ReadFile")
	if err == nil {
		t.Fatal("expected error for missing metadata")
	}
}

func TestAuthenticate_MissingAuthHeader(t *testing.T) {
	ctx := metadata.NewIncomingContext(
		context.Background(),
		metadata.Pairs("other-header", "value"),
	)
	err := authenticate(ctx, "token", "/jamo.v1.WorkspaceService/ReadFile")
	if err == nil {
		t.Fatal("expected error for missing authorization header")
	}
}

func TestAuthenticate_InvalidFormat(t *testing.T) {
	ctx := metadata.NewIncomingContext(
		context.Background(),
		metadata.Pairs("authorization", "Basic dXNlcjpwYXNz"),
	)
	err := authenticate(ctx, "token", "/jamo.v1.WorkspaceService/ReadFile")
	if err == nil {
		t.Fatal("expected error for non-Bearer format")
	}
}
