import { assertRestrictedRuntimeRole } from './runtime-role';

describe('RLS startup checks', () => {
  it.each(['superuser', 'bypassRls', 'ownsTenantTables'] as const)(
    'rejects an effective %s bypass',
    (key) => {
      expect(() =>
        assertRestrictedRuntimeRole({
          superuser: false,
          bypassRls: false,
          ownsTenantTables: false,
          [key]: true,
        }),
      ).toThrow('RLS requires');
    },
  );
  it('accepts a restricted non-owner role', () => {
    expect(() =>
      assertRestrictedRuntimeRole({
        superuser: false,
        bypassRls: false,
        ownsTenantTables: false,
      }),
    ).not.toThrow();
  });
});
