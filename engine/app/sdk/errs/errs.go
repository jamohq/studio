// Package errs provides structured error types that map to gRPC status codes.
package errs

import (
	"fmt"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

// Error represents a structured error with a gRPC status code.
type Error struct {
	GRPCCode codes.Code
	Message  string
}

// New creates a new Error with the given gRPC code and message.
func New(code codes.Code, msg string) *Error {
	return &Error{
		GRPCCode: code,
		Message:  msg,
	}
}

// Newf creates a new Error with a formatted message.
func Newf(code codes.Code, format string, args ...any) *Error {
	return &Error{
		GRPCCode: code,
		Message:  fmt.Sprintf(format, args...),
	}
}

// Error implements the error interface.
func (e *Error) Error() string {
	return e.Message
}

// ToGRPCError converts any error to an appropriate gRPC status error.
// If the error is already an *Error, its code is used; otherwise codes.Internal.
func ToGRPCError(err error) error {
	if err == nil {
		return nil
	}

	if e, ok := err.(*Error); ok {
		return status.Error(e.GRPCCode, e.Message)
	}

	return status.Error(codes.Internal, err.Error())
}
