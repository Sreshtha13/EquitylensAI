export type DatabaseStatus = 'unconfigured' | 'ready' | 'error';

export type DatabaseClient = {
  isConfigured(): boolean;
  getStatus(): DatabaseStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
};
