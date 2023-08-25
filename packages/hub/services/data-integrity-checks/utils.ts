export interface IntegrityCheckResult {
  name: string;
  status: 'degraded' | 'operational';
  message: string | null;
}
