package errs

import (
	"errors"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestNew(t *testing.T) {
	err := New(codes.NotFound, "not found")
	if err.GRPCCode != codes.NotFound {
		t.Fatalf("expected NotFound, got %v", err.GRPCCode)
	}
	if err.Message != "not found" {
		t.Fatalf("expected 'not found', got %q", err.Message)
	}
}

func TestNewf(t *testing.T) {
	err := Newf(codes.InvalidArgument, "bad %s: %d", "value", 42)
	if err.GRPCCode != codes.InvalidArgument {
		t.Fatalf("expected InvalidArgument, got %v", err.GRPCCode)
	}
	if err.Message != "bad value: 42" {
		t.Fatalf("expected 'bad value: 42', got %q", err.Message)
	}
}

func TestErrorInterface(t *testing.T) {
	err := New(codes.Internal, "something broke")
	var e error = err
	if e.Error() != "something broke" {
		t.Fatalf("expected 'something broke', got %q", e.Error())
	}
}

func TestToGRPCError_Nil(t *testing.T) {
	if ToGRPCError(nil) != nil {
		t.Fatal("expected nil for nil input")
	}
}

func TestToGRPCError_StructuredError(t *testing.T) {
	err := New(codes.PermissionDenied, "forbidden")
	grpcErr := ToGRPCError(err)

	st, ok := status.FromError(grpcErr)
	if !ok {
		t.Fatal("expected gRPC status error")
	}
	if st.Code() != codes.PermissionDenied {
		t.Fatalf("expected PermissionDenied, got %v", st.Code())
	}
	if st.Message() != "forbidden" {
		t.Fatalf("expected 'forbidden', got %q", st.Message())
	}
}

func TestToGRPCError_PlainError(t *testing.T) {
	err := errors.New("generic error")
	grpcErr := ToGRPCError(err)

	st, ok := status.FromError(grpcErr)
	if !ok {
		t.Fatal("expected gRPC status error")
	}
	if st.Code() != codes.Internal {
		t.Fatalf("expected Internal, got %v", st.Code())
	}
}
