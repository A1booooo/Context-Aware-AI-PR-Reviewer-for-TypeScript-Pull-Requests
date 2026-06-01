import { redactSensitiveText } from './errors';

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

export function createLogger(): Logger {
  return {
    info(message: string) {
      console.log(redactSensitiveText(message));
    },
    error(message: string) {
      console.error(redactSensitiveText(message));
    }
  };
}
