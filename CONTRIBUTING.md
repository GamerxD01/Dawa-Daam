# Contributing to DawaDaam

Thank you! DawaDaam is only as useful as its data, and the most valuable contribution is **one more correctly curated medicine**. You don't need to write code for that.

## Ground rules (they protect patients)

1. **Every price has a source.** A URL and the date you saw it. No source, no row.
2. **No language-model-generated data.** Never ask an AI for a molecule, strength, price or Jan Aushadhi code. Copy it from the box, the official PMBI list or a pharmacy listing.
3. **Composition must be exact.** Molecule, strength, unit and release type (IR / MR = SR, ER, PR, XL, CR / GR = gastro-resistant, enteric-coated) for **every** ingredient, plus the dosage form. If you are unsure, set `verified=n` and say why in `note`.
4. **Never write advice.** The app shows prices and molecules. It never says "switch", "replace" or "use instead".

## Add a medicine (5 minutes)

1. Open [`data/src/brands.csv`](data/src/brands.csv) and add one row:

   | column | example | notes |
   |---|---|---|
   | `brand` | `Pan D` | as printed |
   | `aliases` | `pan-d\|pan dsr` | other spellings people type, `\|`-separated (optional) |
   | `manufacturer` | `Alkem` | |
   | `composition` | `pantoprazole:40mg:GR\|domperidone:30mg:MR` | `molecule:strength[:release]`, release defaults to `IR` |
   | `form` | `capsule` | tablet, capsule, suspension, syrup, inhaler, sachet |
   | `pack_qty` | `15` | units in the strip/pack the MRP is for |
   | `mrp_inr` | `261.90` | listed MRP, **not** a discounted price |
   | `expected_ja_code` | `465` | the Jan Aushadhi code you expect it to match (tests check this) |
   | `source_url` | `https://…` | where you saw the MRP |
   | `captured_on` | `2026-10-21` | YYYY-MM-DD |
   | `verified` | `y` | `n` if anything is uncertain |
   | `note` | | anything a reviewer should know |

2. If a molecule is new, add it to [`data/src/molecules.csv`](data/src/molecules.csv) with synonyms and the Hindi name.
3. If the Jan Aushadhi equivalent is missing, add it to [`data/src/janaushadhi.csv`](data/src/janaushadhi.csv) from the official PMBI product list.
4. Run `npm test`. The data build rejects unknown molecules, bad strengths and missing sources, and a test checks that every brand maps to its `expected_ja_code`.
5. Open a pull request titled `data: add <brand>` and link your sources.

Can't edit CSV? [Open an "Add a medicine" issue](https://github.com/GamerxD01/Dawa-Daam/issues/new?template=add-medicine.yml) with a photo of the strip and we'll do it.

## Code changes

```bash
npm install
npm run dev       # app
npm test          # data build + unit tests
npm run typecheck
npm run gemma     # optional, needs Ollama + gemma4:e2b
```

- Matcher changes start with a **failing test** in `src/match/search.test.ts`: add the real input someone typed and what should happen.
- Keep the bundle small. The target user has a cheap phone and a weak signal. Discuss before adding a dependency.
- Commits: small and focused, [Conventional Commits](https://www.conventionalcommits.org) style (`feat(match): …`, `data: …`, `fix(ui): …`, `docs: …`).
- UI text goes in `src/i18n.ts`, in **both** Hindi and English.

## Good first issues

- Add 10 brands in one therapeutic area (BP, diabetes, thyroid, acidity, antibiotics)
- Add Jan Aushadhi Kendra locations for your district
- Add Hindi-script brand spellings (e.g. `डोलो`) as aliases
- Add a phonetic rule with a failing test for a misspelling you've seen
- Translate the UI into another Indian language

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind; many contributors are pharmacists, students or patients, not programmers.
