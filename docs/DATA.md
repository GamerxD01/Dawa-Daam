# Data

All data is bundled in the repo and shipped inside the app, so search works with no internet connection.

| file | rows | what |
|---|---|---|
| `data/src/janaushadhi.csv` | 149 | Hand-checked Jan Aushadhi products: PMBI drug code, name, **structured composition**, form, pack size, MRP |
| `data/src/brands.csv` | 64 | Hand-checked brands: composition, pack, listed MRP, source URL + date, expected Jan Aushadhi code |
| `data/src/molecules.csv` | 89 | Canonical molecule names, synonyms (e.g. `frusemide`, `amoxycillin`, `thyroxine`), Hindi names |
| `data/src/combo_aliases.csv` | 9 | Nicknames for combinations (`amoxyclav`, `panto d`) |
| `data/raw/pmbi-product-list-2026-10-25.csv` | 2,438 | The official PMBI product list, as downloaded from janaushadhi.gov.in on 25 Oct 2026 |
| `data/auto/janaushadhi_pmbi.csv` | 1,047 | Jan Aushadhi products read from that list by `scripts/import/pmbi.mjs` (not already hand-checked) |
| `data/auto/pmbi_skipped.csv` | 1,249 | Every product we did **not** read, with the reason |
| `data/auto/brands_dataset.csv` | 86,521 | Brands from the public *A–Z Medicine Dataset of India* (Kaggle) that exactly equal a Jan Aushadhi product |
| `data/auto/kendras.csv` | 4,497 | Official Kendra list (Uttar Pradesh, 25 Oct 2026): code, state, district, PIN, address |
| `data/auto/molecules_auto.csv` | 459 | Molecules seen only in the machine-read rows (no Hindi name yet) |

`npm run data` (also run by `npm test` and `npm run build`) validates everything and writes `src/generated/drugs.json` (all Jan Aushadhi products and hand-checked brands, bundled in the app) and `public/data/brands.json` (the dataset brands, loaded in the background).

`npm run data:import` rebuilds `data/auto/` from `data/raw/`. The brand list is not committed in raw form (32 MB, third-party): download `A_Z_medicines_dataset_of_India.csv` from https://www.kaggle.com/datasets/shudhanshusingh/az-medicine-dataset-of-india and save it as `data/raw/kaggle-az-medicines.csv`.

## Reading the official PMBI list

Kept: oral **tablets, capsules, syrups and oral suspensions** with an MRP. Left out: injections, creams, drops, inhalers, sachets, dispersible / mouth-dissolving / chewable tablets, kits and combi-packs, surgical items, nutraceuticals and Ayurvedic products, and anything whose name we can't read with confidence (e.g. "Vitamin B Complex", probiotics counted in spores).

- Each ingredient needs a name and a strength (`Aceclofenac 100mg and Paracetamol 325mg Tablets`, `Prednisolone Tablets IP 10 mg`, `Amlodipine + Enalapril Tablet (5/5 Mg)`, `Co-trimoxazole (Sulphamethoxazole 800mg and Trimethoprim 160mg)`).
- Release type per ingredient when written next to it (`Pantoprazole 20mg (Gastro-resistant) and Domperidone 10mg (Prolonged Release)`); a release type for the whole tablet (`… Extended Release Tablets`) marks every ingredient. Pantoprazole, rabeprazole, omeprazole, esomeprazole, lansoprazole, dexrabeprazole and duloxetine solids are always gastro-resistant.
- Salt words are dropped (`Sitagliptin Phosphate` → sitagliptin) except where the salt is a different product (diclofenac sodium vs potassium) or there is nothing else left (`Ferrous Sulphate`, `Disodium Hydrogen Citrate`). Metoprolol succinate is always extended-release.
- Check: the parser agrees with **all 143** of our hand-checked rows that are still in the list. The 143 hand-checked rows keep their composition; their MRP was refreshed from the 25 Oct 2026 list.

## The public brand dataset

The *A–Z Medicine Dataset of India* by Shudhanshu Singh (Kaggle, **CC BY-SA 4.0**; about 254,000 rows) gives brand name, price, pack, maker and up to two ingredients. Its prices are **older and were not checked by us**, so every one of these brands is `verified=n` and the app shows "price from an older public list, check the MRP on your strip".

A brand is kept only if **all** of these hold:

- not discontinued; a plain tablet, capsule, syrup or oral suspension (by the pack label and the name);
- every ingredient readable, strengths in the right unit for the form;
- **two-ingredient rows:** the dataset keeps at most two ingredients and silently drops a third (e.g. *Cheston Cold* is cetirizine + paracetamol + phenylephrine but is listed with two). So a two-ingredient row is kept only if the brand name prints **both** strengths (`500mg/125mg`) or their sum (`Augmentin 625`);
- release type read from the label or name (`Tablet SR`, `ER`, `XL`, `DSR`…); an `OD` brand is left out (release type unclear); diclofenac brands are left out (salt not stated);
- the result is **exactly** one Jan Aushadhi product (same molecules, strengths, release types and form). The build re-checks every row and fails otherwise;
- a name used for two different medicines is dropped; a name already in our hand-checked list is dropped (ours wins); for one name in several packs we keep the lowest price per unit, so a saving is never overstated.

Result: 86,521 brands covering 924 different Jan Aushadhi medicines.

**Licence:** our adapted brand files are shared under the same CC BY-SA 4.0 licence, with attribution and the list of changes in [`data/auto/BRANDS-LICENSE.md`](../data/auto/BRANDS-LICENSE.md). Everything else in the repo is Apache-2.0.

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

## Kendra list

From janaushadhi.gov.in → PMBJP → *Locate PMBJK Kendra* → state, *Functional* → Search → export PDF. Convert with `pdftotext -layout` into `data/raw/kendras-<state>-<date>.txt` and run `node scripts/import/kendras.mjs data/raw/kendras-*.txt`.

- We keep the Kendra code, state, district, PIN code and address. The list also has each operator's personal name; the app doesn't need it, so it is **not kept** (and the raw export is not committed).
- 11 rows have no address (the address column repeats the operator's name); they show "address not listed" with district and PIN.
- District names cut by the PDF layout ("Sant Kabir") are restored to the full name; the result has exactly UP's 75 districts.
- Search: a 6-digit PIN shows that PIN first, then the nearest PINs with the same first three digits; a word matches the district and the address.
