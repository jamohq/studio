package gitbus

import "testing"

func TestMapStatus(t *testing.T) {
	tests := []struct {
		xy   string
		want string
	}{
		{"??", "untracked"},
		{"A ", "added"},
		{" A", "added"},
		{"M ", "modified"},
		{" M", "modified"},
		{"D ", "deleted"},
		{" D", "deleted"},
		{"R ", "renamed"},
		{" R", "renamed"},
		{"MM", "modified"},
	}

	for _, tt := range tests {
		got := mapStatus(tt.xy)
		if got != tt.want {
			t.Errorf("mapStatus(%q) = %q, want %q", tt.xy, got, tt.want)
		}
	}
}
