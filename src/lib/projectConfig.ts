import type { Project, ScoringConfig } from '@prisma/client';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, type ScoringThresholds, type ScoringWeights } from './engine/types';
import type { ProjectConfig } from './engine/pipeline';
import { prisma } from './db';

export async function getActiveScoringConfig(projectId: string): Promise<ScoringConfig | null> {
  return prisma.scoringConfig.findFirst({
    where: { projectId, isActive: true },
    orderBy: { version: 'desc' },
  });
}

export function toProjectConfig(project: Project, scoringConfig: ScoringConfig | null): ProjectConfig {
  const weights = (scoringConfig?.weights as unknown as ScoringWeights) ?? DEFAULT_WEIGHTS;
  const thresholds = (scoringConfig?.thresholds as unknown as ScoringThresholds) ?? DEFAULT_THRESHOLDS;
  return {
    mode: project.mode,
    requireLocation: project.requireLocation,
    allowedCountries: project.allowedCountries,
    maxAccuracyMeters: project.maxAccuracyMeters ?? 150,
    maxLocationAgeSec: project.maxLocationAgeSec ?? 120,
    weights,
    thresholds,
  };
}
