<div align="center">

# DawaDaam · दवा दाम

### Same medicine. Jan Aushadhi price.

**Type, say or photograph the medicine on your prescription, and see what the identical Jan Aushadhi generic costs, before you pay.**

[![CI](https://github.com/GamerxD01/Dawa-Daam/actions/workflows/ci.yml/badge.svg)](https://github.com/GamerxD01/Dawa-Daam/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-gamerxd01.github.io%2FDawa--Daam-0f5132)](https://gamerxd01.github.io/Dawa-Daam/)
[![Licence: Apache-2.0](https://img.shields.io/badge/licence-Apache--2.0-blue)](LICENSE)
![Works offline](https://img.shields.io/badge/works-offline-0f5132)
![Hindi + English](https://img.shields.io/badge/हिंदी-%2B%20English-f2b632)
![Gemma 4](https://img.shields.io/badge/Gemma%204-runs%20locally-4285F4)

**[▶ Open the app](https://gamerxd01.github.io/Dawa-Daam/)** · [How it works](#how-it-works) · [Gemma 4](#gemma-4-on-our-own-laptop) · [Run it yourself](#run-it-yourself) · [Data](#data) · [Contribute](CONTRIBUTING.md)

<img src="docs/screenshots/result.png" width="230" alt="Lyrica 75: ₹841.87 → ₹31.77, 96% saving">&nbsp;
<img src="docs/screenshots/prescription.png" width="230" alt="A whole prescription checked line by line">&nbsp;
<img src="docs/screenshots/sheet.png" width="230" alt="Printable sheet to hand across the counter">

</div>

> [!IMPORTANT]
> **Price and molecule information only, not medical advice.** DawaDaam never tells anyone to switch medicines and never comments on a dose. Always ask your doctor or pharmacist before changing any medicine. This line is on every screen of the app.

---

## The problem

A patient is handed a prescription of brand names, takes it to a chemist, and pays what they are told. For most of those medicines, an **identical generic** (same molecule, same strength, same form) is sold at a **Jan Aushadhi Kendra** for a fraction of the price. The patient can't read the molecule off the prescription, and won't argue at the counter.

**DawaDaam puts the saving in front of them, in Hindi, on a cheap phone, with no internet.**

| Brand (pack) | Brand MRP | Jan Aushadhi, same pack | Saving |
|---|---:|---:|---:|
| Lyrica 75 (14 capsules) | ₹841.87 | **₹31.77** | **96%** |
| Rosuvas 10 (15 tablets) | ₹375.00 | **₹19.28** | **95%** |
| Galvus 50 (15 tablets) | ₹371.25 | **₹20.63** | **94%** |
| Telma H (15 tablets) | ₹356.72 | **₹26.30** | **93%** |
| Pan 40 (15 tablets) | ₹192.80 | **₹18.71** | **90%** |
| Garyfex 180 (10 tablets) *(MRP read off our own strip)* | ₹175.00 | **₹35.06** | **80%** |

Across our **63 hand-checked brands**, the **median saving is 80%** (range 47–96%). Jan Aushadhi prices are from the official PMBI product list of 25 Oct 2026.

**Coverage:** **1,196 Jan Aushadhi medicines** (every oral tablet, capsule, syrup and suspension in the PMBI list that we can read with confidence) and **86,521 brands** that are an exact equivalent of one of them, plus our 63 hand-checked brands. The big brand list comes from a public dataset and is labelled as such in the app ([details](#data)).

## What it does

<table>
<tr>
<td width="33%" valign="top"><img src="docs/screenshots/home.png" alt="Home screen in Hindi"><br><b>Hindi first, one hand.</b> One search box, four big tiles, the disclaimer always visible, and "my prescription" in the thumb zone.</td>
<td width="33%" valign="top"><img src="docs/screenshots/strength.png" alt="Which strength?"><br><b>Never guesses.</b> No strength typed? "Which strength is on the strip?" Unclear? "Did you mean…?"</td>
<td width="33%" valign="top"><img src="docs/screenshots/not-found.png" alt="We have Amaryl 1, not 2"><br><b>Says what it doesn't know.</b> "We have Amaryl 1, not 2", then shows the Jan Aushadhi 2 mg as information only.</td>
</tr>
<tr>
<td valign="top"><img src="docs/screenshots/photo-menu.png" alt="What are you photographing?"><br><b>📷 Photo:</b> strip/box or printed prescription read by <b>Gemma 4 on our laptop</b>; handwritten (beta) by Gemini, only if enabled.</td>
<td valign="top"><img src="docs/screenshots/list.png" alt="My prescription with total saving"><br><b>Whole prescription:</b> paste, type, speak or photograph it. Dosage like <code>1-0-1 x 5 days</code> is stripped, never interpreted. You get a total saving.</td>
<td valign="top"><img src="docs/screenshots/kendra.png" alt="Nearest Jan Aushadhi Kendra on a map"><br><b>📍 Nearest Kendra</b> from OpenStreetMap: distance, map, directions, opening hours. Linked from every result.</td>
</tr>
</table>

### Against the problem statement

| The brief asked for | DawaDaam |
|---|---|
| Enter a brand **or** a molecule → generic name, strength, indicative generic vs branded price | ✅ Both: `Pan 40` → Pantoprazole 40 mg GR, ₹192.80 → ₹18.71; `paracetamol 650` → Jan Aushadhi 511 plus the brands we know |
| Make the saving the headline (`₹240 → ₹28`) | ✅ A 56 px number, at the patient's own pack size, with the per-tablet price underneath |
| Tolerate misspellings, missing strengths, half-read words | ✅ `lirika`, `rozuvas`, `alegra`, `dolo650`, `DOLO-650 TAB`, `pantop`, `६५०`. Covered by 274 tests |
| A clear disclaimer, and mean it | ✅ On every screen; the app never says "switch", "replace" or "use instead" |
| ➕ Photograph the strip or box | ✅ Gemma 4 E2B, local. Measured on our own strips (below) |
| ➕ Whole prescription with a total saving | ✅ Typed, pasted, spoken, or a photo of a **printed** prescription |
| ➕ Nearest Jan Aushadhi Kendra | ✅ **Offline search of the official list** (all 4,497 Kendras in Uttar Pradesh) by PIN code, district or area, plus a "near me" map from OpenStreetMap |
| ➕ Printable sheet for the counter | ✅ Bilingual sheet: print, save as PDF, or share on WhatsApp |
| ➕ Pill identifier by imprint | ❌ **Deliberately not built.** There is no reliable open Indian imprint database, and a wrong pill ID is dangerous |
| Never generate drug information with a language model | ✅ Models only **read text** and **pick from our list**. Every fact shown comes from data we ship |
| OCR on handwriting is hard: keep typing as the path that always works | ✅ Typing always works. Handwriting is an opt-in beta with extra safeguards |
| Curate 200 drugs well | ✅ **1,196 Jan Aushadhi medicines** read from the official PMBI list (143 of them also hand-checked), **63 hand-checked brands** with a source and date, and **86,521 dataset brands** kept only when they exactly equal a Jan Aushadhi product |
| Cheap phone, bad signal | ✅ **≈67 KB gzipped** app with all Jan Aushadhi data inside; the 86k-brand list (≈1.2 MB) loads in the background and is cached; **works in aeroplane mode**; no web fonts; 48 px+ tap targets |
| Open source, honest commits | ✅ Apache-2.0, CONTRIBUTING.md, small commits from the build window, CI on every push |

## How it works

```mermaid
flowchart LR
  A["Typed · spoken · photographed text"] --> B["Normalise<br/>dolo650 → dolo 650<br/>Tab. / 1-0-1 / after food removed"]
  B --> C["Parse strengths<br/>650 · 50/500 · ६५० · 60k"]
  C --> D["Candidates<br/>alias · prefix · Indian-spelling phonetics · trigrams"]
  D --> E{"Decide"}
  E -->|confident| F["Safety check:<br/>identical molecule + strength<br/>+ release + form"]
  E -->|close call| G["Did you mean? / Which strength?"]
  E -->|nothing safe| H["Not in our list<br/>(or: we have 1 mg, not 2)"]
  F --> I["₹ brand → ₹ Jan Aushadhi<br/>at the patient's pack size"]
```

**The matcher is our own** (`src/match/`, no fuzzy-search library). It combines Damerau-Levenshtein distance, trigram overlap, prefix matching for half-read words, and a phonetic key tuned for Indian spellings (`ph/f`, `z/s`, `c/k`, `v/w`, `y/i`, doubled letters: `lirika` = `lyrica`, `rozuvas` = `rosuvas`).

**Safety by design**, enforced in code and by tests:

- A brand gets a Jan Aushadhi price **only** if every ingredient matches on **molecule, strength, unit and release type** (plain / SR-ER-PR / gastro-resistant), **and** the dosage form is the same. SR never matches plain, a combination never matches a single molecule, and 25 mg never matches 50 mg (`src/match/equivalence.ts`).
- **Letter suffixes are different medicines.** `Pan` ≠ `Pan D`, `Telma` ≠ `Telma H`, `Montair` ≠ `Montair LC`. A suffix-less query asks instead of guessing.
- **A strength we don't have is reported, not swapped.** "We have Amaryl 1, not 2."
- **An unreadable word never gives a confident answer.** `Cap Pan [?] 40` asks "Pan 40 or Pan D?".
- **Dosage instructions are removed, never interpreted.** The app has no opinion on `1-0-1`.
- **Only lines with both prices count towards a total.** Nothing is estimated.

## Gemma 4, on our own laptop

| | |
|---|---|
| **Model** | **Gemma 4 E2B** (`gemma4:e2b`): open weights, Apache-2.0, image input |
| **Where it runs** | Our laptop (Windows, **RTX 3050 4 GB**, `ollama ps` shows 100% GPU) via **Ollama**. Photos go from the phone to that laptop over local Wi-Fi and never leave it |
| **What it is asked** | **Job 1:** *transcribe* the printed text on a strip, box or printed prescription (JSON, temperature 0). **Job 2:** *choose one id* from the candidate list **our** matcher built from that text, or `null`. Enforced with a JSON-schema `enum`, so it cannot return a product we didn't offer |
| **What it is never asked** | Dosage, price, molecule, side effects, alternatives, or any free text shown to a patient |
| **Why Gemma here** | Foil glare, curved strips and mixed fonts defeat plain OCR on brand names. A small vision model reads layout and noisy text, runs locally, and keeps prescription photos private |

**Measured on six of our own strip photos** (phone camera, ordinary light, some with pen marks):

| Strip | Time | Brand read | Strength read | What the app did |
|---|---:|:---:|:---:|---|
| Garyfex-180 (fexofenadine 180) | 9.2 s | ✗ *"Ganytex-180"* | ✓ | Our fuzzy matcher still offered **Garyfex 180** → patient confirms → ₹175 → ₹37.40 |
| Giorax-25 (hydroxyzine 25) | 10.3 s | ✓ | ✓ | "We have hydroxyzine 10 mg, not 25" |
| Panced-DSR (pantoprazole + domperidone) | 13.4 s | ✓ | ✗ | Composition line matched Jan Aushadhi 465 |
| Lactopen (lactic acid bacillus) | 7.3 s | ✓ | – | Matched Jan Aushadhi 196 |
| ?PRET-8 (name covered by pen) | 10.3 s | – | – | No candidates → asked to type |
| Nutricion-5G (a nutraceutical) | 38.6 s\* | ✗ | – | No candidates → "not in our list". Correct: it isn't a medicine |

\* includes loading the model onto the GPU; warm reads took 7–13 s. **Gemma alone read 3/5 brands and 2/5 strengths**, which is why its output is only a hint to our deterministic matcher, and the patient always confirms. **In no case did the app show a wrong medicine.** These exact Gemma outputs are kept as regression tests (`src/photo.test.ts`). Full details: [docs/GEMMA.md](docs/GEMMA.md).

**Optional Gemini fallback (off by default).** If Gemma's read gives nothing we can match, or the patient says "not this", the app *offers* a "Try Gemini" button to re-read the same photo with Google Gemini (`gemini-3.6-flash`, online), and **Gemma still makes the final pick**. Handwritten prescriptions (beta) are read only by Gemini, which returns just the medicine names and strengths (no patient details): no "add all", every medicine confirmed individually, unclear words marked `[?]`. Without a Gemini key, none of this appears and the app is pure Gemma, fully local.

## Run it yourself

**Just use it:** open **https://gamerxd01.github.io/Dawa-Daam/**, then *Add to Home screen*. After the first visit it works with no signal.

**Run locally** (Node 18+):

```bash
git clone https://github.com/GamerxD01/Dawa-Daam.git
cd Dawa-Daam
npm install
npm run dev          # http://localhost:5173 · phone on the same Wi-Fi: http://<laptop-ip>:5173
npm test             # data build + 274 tests
npm run build        # production build in dist/
```

**With photo reading (Gemma 4 on your machine):**

```bash
ollama pull gemma4:e2b   # ~7 GB, once
npm run demo             # starts the Gemma bridge + the app, prints the address for your phone
```

The 📷 tile appears only when the bridge answers; typing never depends on it. To use the live site with your laptop's Gemma, open `https://gamerxd01.github.io/Dawa-Daam/?gemma=http://localhost:8000` on that laptop (Chrome will ask to allow local access).

**Optional: Gemini fallback + handwriting beta.** Off unless *you* set a key on *your* bridge ([get one at Google AI Studio](https://aistudio.google.com/apikey); never commit it):

```powershell
$env:GEMINI_API_KEY = "your-key"     # PowerShell  ·  macOS/Linux: export GEMINI_API_KEY=your-key
npm run demo
```

At start-up the bridge asks Google which Flash / Flash-Lite models your key can see, checks each one, and prints ✓ / ✗ for them. A busy model (503) is retried and then the next one is tried; a model your key can't use (e.g. "limit: 0" on the free tier) is skipped for the rest of the run. To fix the list yourself, set `GEMINI_MODELS=a,b,c`.

**Measure Gemma on your own photos:** `npm run gemma:eval -- path/to/photos` (optional `expected.csv`: `file,brand,strength`).

## Data

Everything is bundled in the repo and shipped inside the app.

| File | Rows | What |
|---|---:|---|
| [`data/src/janaushadhi.csv`](data/src/janaushadhi.csv) | 143 | Hand-checked Jan Aushadhi products: PMBI drug code, MRP, pack, and a **structured composition** (molecule, strength and release type per ingredient) |
| [`data/auto/janaushadhi_pmbi.csv`](data/auto/janaushadhi_pmbi.csv) | 1,047 | More Jan Aushadhi products, **read by our parser** from the [official PMBI list](data/raw/) (every skipped product and why: [`pmbi_skipped.csv`](data/auto/pmbi_skipped.csv)) |
| [`data/auto/kendras.csv`](data/auto/kendras.csv) | 4,497 | Official Jan Aushadhi Kendra list for Uttar Pradesh: code, district, PIN, address (operators' names left out) |
| `data/auto/brands_dataset.csv` | 86,521 | Brands from the public *A–Z Medicine Dataset of India* that exactly equal a Jan Aushadhi product; prices not checked by us |
| [`data/src/brands.csv`](data/src/brands.csv) | 63 | Curated brands: composition, pack, **listed MRP**, **source URL and date**, expected Jan Aushadhi code |
| [`data/src/molecules.csv`](data/src/molecules.csv) | 84 | Canonical names, synonyms (`frusemide`, `amoxycillin`, `thyroxine`), Hindi names |
| [`data/src/combo_aliases.csv`](data/src/combo_aliases.csv) | 9 | Combination nicknames (`amoxyclav`, `panto d`) |

`npm run data:import` re-reads the raw lists (`data/raw/`) into `data/auto/`. `npm run data` validates everything and fails the build on an unknown molecule, a malformed strength, a missing price or a missing source. A test checks that **every brand maps to its expected Jan Aushadhi code** and that **every brand is found by its own name**. Rows we couldn't fully confirm are marked `verified=n` and show a "check the box" warning. Sources and cleaning decisions: [docs/DATA.md](docs/DATA.md).

## Built for the person with the cheap phone

- **≈67 KB gzipped** app with all 1,196 Jan Aushadhi medicines inside. The 86,521-brand list (≈1.2 MB) downloads **after** the first screen, builds its search index in small slices so typing never freezes, and is then cached for offline use. On a 4×-slowed CPU: first screen < 1 s, full list ready in ≈10 s, each search ≈0.1 s. The map library loads only on the Kendra screen.
- **Works offline:** a service worker precaches the app on the first visit. Tested by reloading in aeroplane mode.
- **Hindi by default**, with "साल्ट" (salt) as chemists say it. One tap switches to English. No web fonts, because Android's built-in Devanagari font works offline.
- **One hand:** 48 px+ targets, 22 px input, the main actions in the bottom thumb zone. Dark mode follows the phone.
- **No account, no tracking.** The list lives on the phone. Location is used once, only when you ask for a Kendra.

## Project layout

```
data/src/              hand-checked CSVs: always win over machine-read rows
data/raw/              official PMBI product list (and the public brand list, not committed)
data/auto/             machine-read rows from data/raw (scripts/import-big.mjs)
scripts/build-data.mjs CSV → validated src/generated/drugs.json
scripts/demo.mjs       one-command local demo (Gemma bridge + app)
src/match/             normalise · parse · phonetic · similarity · equivalence · search · prescription · voice (+ tests)
src/ui/                result card, choices, prescription, photo, Kendra map, list, counter sheet
src/kendra.ts          OpenStreetMap / Overpass lookup (+ tests)
src/photo.ts           client side of the photo flow
server/                zero-dependency Gemma bridge + evaluation script
public/sw.js           offline service worker
docs/                  DATA.md · GEMMA.md · screenshots · sample printed prescription
```

## Limits, honestly

- **Prices are indicative MRPs.** Jan Aushadhi: official PMBI list, 25 Oct 2026. Hand-checked brands: captured 20–21 Oct 2026. **Dataset brands: older prices from a public list that we did not check**; the app says so on every such result and asks the patient to check the MRP on the strip.
- **Coverage:** brands that the public dataset lists with only two ingredients are kept **only** when the brand name itself prints both strengths (the dataset drops a third ingredient, so `Cheston Cold` could otherwise look like a 2-ingredient medicine). Dispersible, mouth-dissolving, chewable, injections, creams and drops are not compared yet. Anything else gets "not in our list yet".
- **"Same molecule & strength" is not a medical judgement.** Bioequivalence and the decision to switch belong to the doctor and pharmacist.
- **Gemma misreads** (see the table above), so the patient always confirms. Handwriting is only an opt-in Gemini beta and can be wrong.
- **Kendras:** the offline list covers Uttar Pradesh only so far (add more states by exporting them from janaushadhi.gov.in; see docs/DATA.md). It has addresses but no map points, so "nearest" by distance still uses OpenStreetMap, which is incomplete and needs internet.
- **Salts:** most are not distinguished (as in the PMBI list). Metoprolol succinate is treated as extended-release; diclofenac sodium and potassium are kept apart, and dataset diclofenac brands are left out because the dataset doesn't say which salt.

## Roadmap

- Hand-check the most-used dataset brands with pharmacists through the [add-a-medicine issue form](https://github.com/GamerxD01/Dawa-Daam/issues/new?template=add-medicine.yml)
- NPPA ceiling prices as a third reference price
- Official Kendra lists for every state (UP is done)
- More Indian languages (the UI strings are already separated in `src/i18n.ts`)

## Contributing

Adding a medicine is **one CSV row with a source link**, and no code. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the data rules (no AI-generated rows, every price sourced, exact composition) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Credits

- **Data:** [Pradhan Mantri Bhartiya Janaushadhi Pariyojana (PMBI)](https://janaushadhi.gov.in) product list and MRPs. Brand MRPs from public listings on [Truemeds](https://truemeds.in), [PharmEasy](https://pharmeasy.in) and [1mg](https://www.1mg.com) (URL and date on every row). Garyfex 180's MRP was read off a strip we photographed.
- **Models:** [Gemma 4](https://ai.google.dev/gemma) by Google DeepMind (Apache-2.0), served with [Ollama](https://ollama.com) (MIT). Optional: [Gemini API](https://ai.google.dev/gemini-api/docs) (Google, cloud), only when the bridge owner sets their own key.
- **Maps:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), via the [Overpass API](https://overpass-api.de); drawn with [Leaflet](https://leafletjs.com) (BSD-2-Clause).
- **Libraries:** [Preact](https://preactjs.com) (MIT), [Vite](https://vite.dev) (MIT), [Vitest](https://vitest.dev) (MIT), [TypeScript](https://www.typescriptlang.org) (Apache-2.0). Screenshots and UI checks with [Playwright](https://playwright.dev) (Apache-2.0).
- **Speech:** the browser's built-in Web Speech API.
- **AI assistance:** code and docs were written with help from Claude (Anthropic) during the hackathon build window. Gemma 4 is the model inside the product.

## Licence

[Apache-2.0](LICENSE), the same licence as Gemma 4.
