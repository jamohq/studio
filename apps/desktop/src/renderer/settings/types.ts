import type { EnvCheckResult } from '../../shared/types';

export interface SettingsAPI {
  checkEnvironment(): Promise<EnvCheckResult>;
}

declare global {
  interface Window {
    jamoSettings: SettingsAPI;
  }
}
