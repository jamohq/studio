import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import * as path from 'path';

export interface GrpcClients {
  health: any;
  workspace: any;
  terminal: any;
  generate: any;
  event: any;
}

function loadProto(protoFile: string) {
  const protoDir = path.resolve(__dirname, '..', '..', '..', '..', 'proto');
  const packageDefinition = protoLoader.loadSync(
    path.join(protoDir, 'jamo', 'v1', protoFile),
    {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [protoDir],
    }
  );
  return grpc.loadPackageDefinition(packageDefinition);
}

// Build metadata with auth token, reused on every call.
function authMetadata(token: string): grpc.Metadata {
  const meta = new grpc.Metadata();
  meta.set('authorization', `Bearer ${token}`);
  return meta;
}

// Interceptor that attaches auth metadata to every call.
function authInterceptor(token: string): grpc.Interceptor {
  return (options, nextCall) => {
    return new grpc.InterceptingCall(nextCall(options), {
      start(metadata, _listener, next) {
        const authMeta = authMetadata(token);
        authMeta.getMap();
        metadata.set('authorization', `Bearer ${token}`);
        next(metadata, _listener);
      },
    });
  };
}

export function createClients(port: number, token: string): GrpcClients {
  const address = `127.0.0.1:${port}`;
  const creds = grpc.credentials.createInsecure();
  const options = { interceptors: [authInterceptor(token)] };

  const healthPkg = loadProto('health.proto') as any;
  const workspacePkg = loadProto('workspace.proto') as any;
  const terminalPkg = loadProto('terminal.proto') as any;
  const generatePkg = loadProto('generate.proto') as any;
  const eventPkg = loadProto('event.proto') as any;

  return {
    health: new healthPkg.jamo.v1.HealthService(address, creds, options),
    workspace: new workspacePkg.jamo.v1.WorkspaceService(address, creds, options),
    terminal: new terminalPkg.jamo.v1.TerminalService(address, creds, options),
    generate: new generatePkg.jamo.v1.GenerateService(address, creds, options),
    event: new eventPkg.jamo.v1.EventService(address, creds, options),
  };
}
