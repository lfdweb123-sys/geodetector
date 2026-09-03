import { describe, expect, it } from 'vitest';
import { evaluateRules, ruleActionToDecision, type RuleDefinition, type RuleFacts } from '@/lib/engine/rulesEngine';

function baseFacts(overrides: Partial<RuleFacts> = {}): RuleFacts {
  return {
    confidence: 90,
    status: 'VERIFIED',
    country: 'BJ',
    requiredCountry: 'BJ',
    vpn: false,
    proxy: false,
    tor: false,
    datacenter: false,
    mockLocation: false,
    mockLocationStatus: 'NOT_DETECTED',
    deviceIntegrity: 'PHYSICAL',
    ...overrides,
  };
}

describe('rules engine', () => {
  it('IF country != BJ THEN BLOCK', () => {
    const rules: RuleDefinition[] = [
      { id: '1', name: 'geo-fence', condition: { field: 'country', op: 'ne', value: 'BJ' }, action: 'BLOCK', priority: 0, enabled: true },
    ];
    const match = evaluateRules(rules, baseFacts({ country: 'DE' }));
    expect(match?.action).toBe('BLOCK');
    expect(ruleActionToDecision(match!.action)).toBe('REJECT');

    expect(evaluateRules(rules, baseFacts({ country: 'BJ' }))).toBeNull();
  });

  it('IF vpn AND gpsCountry=BJ AND confidence>=85 THEN ALLOW', () => {
    const rules: RuleDefinition[] = [
      {
        id: '2',
        name: 'vpn-allow',
        condition: {
          and: [
            { field: 'vpn', op: 'eq', value: true },
            { field: 'gpsCountry', op: 'eq', value: 'BJ' },
            { field: 'confidence', op: 'gte', value: 85 },
          ],
        },
        action: 'ALLOW',
        priority: 0,
        enabled: true,
      },
    ];
    const match = evaluateRules(rules, baseFacts({ vpn: true, gpsCountry: 'BJ', confidence: 95 }));
    expect(match?.action).toBe('ALLOW');
  });

  it('IF mock_location THEN BLOCK', () => {
    const rules: RuleDefinition[] = [
      { id: '3', name: 'mock-block', condition: { field: 'mockLocation', op: 'eq', value: true }, action: 'BLOCK', priority: 0, enabled: true },
    ];
    expect(evaluateRules(rules, baseFacts({ mockLocation: true }))?.action).toBe('BLOCK');
    expect(evaluateRules(rules, baseFacts({ mockLocation: false }))).toBeNull();
  });

  it('IF confidence < 70 THEN MANUAL_REVIEW, higher priority wins over lower', () => {
    const rules: RuleDefinition[] = [
      { id: '4', name: 'low-conf', condition: { field: 'confidence', op: 'lt', value: 70 }, action: 'MANUAL_REVIEW', priority: 1, enabled: true },
      { id: '5', name: 'catch-all-allow', condition: { field: 'confidence', op: 'gte', value: 0 }, action: 'ALLOW', priority: 0, enabled: true },
    ];
    const match = evaluateRules(rules, baseFacts({ confidence: 50 }));
    expect(match?.ruleId).toBe('4');
  });

  it('disabled rules never match', () => {
    const rules: RuleDefinition[] = [
      { id: '6', name: 'disabled', condition: { field: 'confidence', op: 'gte', value: 0 }, action: 'BLOCK', priority: 100, enabled: false },
    ];
    expect(evaluateRules(rules, baseFacts())).toBeNull();
  });
});
