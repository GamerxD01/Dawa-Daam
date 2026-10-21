# Data

All data is bundled in the repo and shipped inside the app, so search works with no internet connection.

| file | rows | what |
|---|---|---|
| `data/src/janaushadhi.csv` | 149 | Jan Aushadhi products: PMBI drug code, name, **structured composition**, form, pack size, MRP |
| `data/src/brands.csv` | 63 | Curated branded products: composition, pack, listed MRP, source URL + date, expected Jan Aushadhi code |
| `data/src/molecules.csv` | 88 | Canonical molecule names, synonyms (e.g. `frusemide`, `amoxycillin`, `thyroxine`), Hindi names |
| `data/src/combo_aliases.csv` | 9 | Nicknames for combinations (`amoxyclav`, `panto d`) |

`npm run data` (also run by `npm test` and `npm run build`) validates everything and writes `src/generated/drugs.json`.

## Sources

- **Jan Aushadhi products and MRPs:** PMBI Product Portfolio List (Sr. No., Drug Code, Generic Name, Unit Size, MRP), 2025 edition. Official finder: https://www.pmbi.co.in/ProductList.aspx. We curated a subset of common outpatient medicines (oral solids, a few liquids and inhalers), not oncology or injectables.
- **Brand MRPs:** captured by hand on 20–21 Oct 2026 from public product pages (Truemeds; Galvus Met from PharmEasy; Nexito from 1mg). We record the **listed MRP**, not a discounted price. URL and date per row.
- Each brand's Jan Aushadhi match is **computed** from composition by the app, and a test checks it equals the curated `expected_ja_code`, so a typo in either place fails CI.

## Composition format

`molecule:strength[:release]` joined with `|`, e.g. `pantoprazole:40mg:GR|domperidone:30mg:MR`

- strength units: `mg`, `mcg`, `g`, `iu`; liquids `125mg/5ml`
- release: `IR` (default), `MR` (SR / ER / PR / XL / CR, all modified-release), `GR` (gastro-resistant / enteric-coated / delayed-release)

## Cleaning decisions

- PMBI spellings normalised through synonyms: `Amoxycillin` → amoxicillin, `Frusemide` → furosemide, `Cetrizine` → cetirizine, `Levo-Thyroxine` / `Thyroxine Sodium` → levothyroxine, `Potassium Clavulanate` → clavulanic acid. The source typo `Tabelts` is fixed in the name.
- Duplicate Jan Aushadhi listings with identical composition and form (e.g. levothyroxine 50 mcg, codes 506 and 1221) are grouped; the app shows the cheapest per unit.
- Pregabalin 75 mg exists as both capsule (code 3) and tablet (code 599). These are kept as **different** forms; a capsule brand only matches the capsule.
- Rows with MRP `0.00` in the source are excluded (no price is better than a wrong price).
- Salts are not distinguished (succinate vs tartrate) because the PMBI list doesn't; noted per row where it matters (Met XL).
- Rows we could not fully confirm are `verified=n` and show a warning on the card: Glycomet GP 1 and Glyciphage 500 (release type not clear on the source page), Nexito 10 and Cifran 500 (price not labelled MRP), Zentel 400 (chewable tablet). Garyfex 180's MRP was read off a photographed strip.

## Prices are indicative

MRPs change, and pharmacies discount. The app labels prices as indicative MRPs, shows the capture date and source, and never estimates a price that isn't in the data.
