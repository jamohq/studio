// Package pty provides a thin wrapper around creack/pty for terminal sessions.
package pty

import (
	"io"
	"os"
	"os/exec"

	"github.com/creack/pty"
)

// Session represents a running PTY session.
type Session struct {
	cmd *exec.Cmd
	ptm *os.File
}

// Start creates a new PTY session with the given shell and dimensions.
func Start(shell string, cols, rows uint16) (*Session, error) {
	cmd := exec.Command(shell)

	ptm, err := pty.StartWithSize(cmd, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
	if err != nil {
		return nil, err
	}

	return &Session{
		cmd: cmd,
		ptm: ptm,
	}, nil
}

// Read reads from the PTY output.
func (s *Session) Read(p []byte) (int, error) {
	return s.ptm.Read(p)
}

// Write writes to the PTY input.
func (s *Session) Write(p []byte) (int, error) {
	return s.ptm.Write(p)
}

// Resize changes the PTY window size.
func (s *Session) Resize(cols, rows uint16) error {
	return pty.Setsize(s.ptm, &pty.Winsize{
		Cols: cols,
		Rows: rows,
	})
}

// Close terminates the PTY session.
func (s *Session) Close() error {
	// Close the PTY master — this signals EOF to the child process.
	if err := s.ptm.Close(); err != nil && err != io.EOF {
		return err
	}

	// Wait for the child process to exit (ignore error since it may be killed).
	_ = s.cmd.Wait()

	return nil
}
