# Security Policy

## Reporting a Vulnerability

Report security vulnerabilities by email to [go.jhson@gmail.com](mailto:go.jhson@gmail.com). Do not open a public issue.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Affected component (Electron app, Go engine, IPC layer, etc.)
- Potential impact

### Response Timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 7 days
- **Fix or mitigation**: depends on severity, but we'll keep you updated

## Trust Model

Jamo Studio is a local desktop application. The Go engine runs on localhost and communicates with the Electron frontend over gRPC with bearer token authentication. There is no remote server component.

## In Scope

- Code execution vulnerabilities
- Authentication or authorization bypass in the gRPC layer
- Electron security issues (context isolation, nodeIntegration, preload scripts)
- IPC vulnerabilities between renderer, main process, and engine
- Path traversal or unauthorized file access

## Out of Scope

- Attacks requiring physical access to the machine
- Social engineering
- Local denial of service
- Vulnerabilities in upstream dependencies (report those to the upstream project)
