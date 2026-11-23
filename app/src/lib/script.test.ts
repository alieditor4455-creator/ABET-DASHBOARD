import { describe, expect, it } from 'vitest';
import { complianceCheck, makeCaption, templateScript } from './script';
import { PLAT_KEYS, PLAT_LIMIT, TYPE_KEYS } from './constants';

describe('templateScript', () => {
  it('keeps a question topic as the title', () => {
    expect(templateScript('reel', 'What is a pip?').title).toBe('What is a pip?');
  });
  it('produces a script that passes compliance for every format', () => {
    for (const t of TYPE_KEYS) {
      const s = templateScript(t, 'How leverage works');
      expect(s.units.length).toBeGreaterThan(0);
      expect(complianceCheck(s.title, s.units).every((c) => c.ok), t).toBe(true);
    }
  });
});

describe('complianceCheck', () => {
  const base = templateScript('reel', 'Stop-loss basics');
  it('flags guaranteed-return language', () => {
    const units = [...base.units, { ...base.units[0], vo: 'This strategy is guaranteed to make money.' }];
    expect(complianceCheck(base.title, units)[0].ok).toBe(false);
  });
  it('flags risk-free claims', () => {
    expect(complianceCheck('Risk-free trading', base.units)[0].ok).toBe(false);
  });
  it('flags a missing risk warning', () => {
    const units = base.units.map((u) => ({ ...u, vo: 'Plain text.', on: 'x' }));
    expect(complianceCheck(base.title, units)[1].ok).toBe(false);
  });
  it('flags unverified regulatory claims', () => {
    const units = [...base.units, { ...base.units[0], vo: 'ABET is regulated by the FCA.' }];
    expect(complianceCheck(base.title, units)[2].ok).toBe(false);
  });
});

describe('makeCaption', () => {
  it('fits every platform limit and carries a risk warning', () => {
    for (const p of PLAT_KEYS) {
      const c = makeCaption(p, 'What is a pip? In 30 seconds');
      expect(c.length).toBeLessThanOrEqual(PLAT_LIMIT[p]);
      expect(c).toMatch(/risk/i);
    }
  });
});
