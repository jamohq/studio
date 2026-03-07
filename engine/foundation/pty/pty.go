// Package pty provides a thin wrapper around creack/pty for terminal sessions.
package pty

import (
	"io"
	"os"
	"os/exec"
	"strings"

	"github.com/creack/pty"
)

// Session represents a running PTY session.
type Session struct {
	cmd *exec.Cmd
	ptm *os.File
}

// cleanEnv returns the current environment with problematic variables removed.
func cleanEnv() []string {
	skip := map[string]bool{
		"CLAUDECODE":             true,
		"CLAUDE_CODE_ENTRYPOINT": true,
	}
	var env []string
	for _, e := range os.Environ() {
		// Strip Claude Code env vars so CLI tools don't think they're nested.
		key, _, _ := strings.Cut(e, "=")
		if skip[key] {
			continue
		}
		env = append(env, e)
	}
	return env
}

// Start creates a new PTY session with the given shell and dimensions.
func Start(shell string, cols, rows uint16, workdir ...string) (*Session, error) {
	cmd := exec.Command(shell)
	cmd.Env = cleanEnv()
	if len(workdir) > 0 && workdir[0] != "" {
		cmd.Dir = workdir[0]
	}

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
