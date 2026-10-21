import { describe, expect, it } from 'vitest';
import { spokenToText } from './spoken';

describe('voice: spoken strengths become digits', () => {
  it.each([
    ['Dolo six fifty', 'dolo 650'],
    ['pan forty', 'pan 40'],
    ['augmentin six twenty five', 'augmentin 625'],
    ['paracetamol six hundred and fifty milligram', 'paracetamol 650 mg'],
    ['telma h forty', 'telma h 40'],
    ['amaryl one', 'amaryl 1'],
    ['allegra one twenty', 'allegra 120'],
  ])('%s → %s', (said, want) => expect(spokenToText(said)).toBe(want));
});
