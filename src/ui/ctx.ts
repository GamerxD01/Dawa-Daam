import type { Lang, Strings } from '../i18n';
import type { Molecule } from '../match/types';

export interface Ctx {
  t: Strings;
  lang: Lang;
  molecules: Map<string, Molecule>;
  version: string;
}
