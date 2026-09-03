// Configurable rule engine (spec ยง16). Rules are stored as a small JSON AST
// (`RuleCondition`) rather than free-form code, so customer-authored rules
// can never execute arbitrary logic against the platform.

export type ComparisonOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in';

export interface FieldCondition {
  field: keyof RuleFacts;
  op: ComparisonOp;
  value: unknown;
}

export interface AndCondition {
  and: RuleCondition[];
}

export interface OrCondition {
  or: RuleCondition[];
}

export interface NotCondition {
  not: RuleCondition;
}

export type RuleCondition = FieldCondition | AndCondition | OrCondition | NotCondition;

export type RuleActionName = 'ALLOW' | 'BLOCK' | 'MANUAL_REVIEW';

export interface RuleDefinition {
  id: string;
  name: string;
  condition: RuleCondition;
  action: RuleActionName;
  priority: number;
  enabled: boolean;
}

/** Flattened, rule-evaluable view of a verification result. */
export interface RuleFacts {
  confidence: number;
  status: 'VERIFIED' | 'SUSPICIOUS' | 'UNVERIFIED';
  country?: string;
  gpsCountry?: string;
  ipCountry?: string;
  requiredCountry?: string;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  datacenter: boolean;
  mockLocation: boolean;
  mockLocationStatus: 'DETECTED' | 'NOT_DETECTED' | 'UNAVAILABLE';
  deviceIntegrity: 'PHYSICAL' | 'EMULATOR_SUSPECTED' | 'COMPROMISED_SUSPECTED' | 'UNAVAILABLE';
  gpsAccuracyMeters?: number;
}

function isFieldCondition(c: RuleCondition): c is FieldCondition {
  return 'field' in c;
}

function compare(op: ComparisonOp, actual: unknown, expected: unknown): boolean {
  switch (op) {
    case 'eq':
      return actual === expected;
    case 'ne':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);
    default:
      return false;
  }
}

export function evaluateCondition(condition: RuleCondition, facts: RuleFacts): boolean {
  if (isFieldCondition(condition)) {
    return compare(condition.op, facts[condition.field], condition.value);
  }
  if ('and' in condition) return condition.and.every((c) => evaluateCondition(c, facts));
  if ('or' in condition) return condition.or.some((c) => evaluateCondition(c, facts));
  if ('not' in condition) return !evaluateCondition(condition.not, facts);
  return false;
}

export interface RuleMatch {
  ruleId: string;
  ruleName: string;
  action: RuleActionName;
}

/**
 * Evaluates enabled rules in priority order (highest first) and returns the
 * first match, or `null` if no rule fired - in which case the base decision
 * engine result stands.
 */
export function evaluateRules(rules: RuleDefinition[], facts: RuleFacts): RuleMatch | null {
  const sorted = [...rules].filter((r) => r.enabled).sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (evaluateCondition(rule.condition, facts)) {
      return { ruleId: rule.id, ruleName: rule.name, action: rule.action };
    }
  }
  return null;
}

export function ruleActionToDecision(action: RuleActionName): 'ACCEPT' | 'REJECT' | 'MANUAL_REVIEW' {
  if (action === 'ALLOW') return 'ACCEPT';
  if (action === 'BLOCK') return 'REJECT';
  return 'MANUAL_REVIEW';
}
