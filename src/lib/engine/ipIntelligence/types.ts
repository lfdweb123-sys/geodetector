import type { IpIntelligenceResult } from '../types';

export interface IpIntelligenceProvider {
  readonly name: string;
  lookup(ip: string): Promise<IpIntelligenceResult>;
}

export class IpIntelligenceError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
  ) {
    super(message);
    this.name = 'IpIntelligenceError';
  }
}
