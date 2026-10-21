# Gemma 4 in DawaDaam

## The job, and why it's the right one

The brief says never to generate drug information with a language model. A hallucinated dosage is a harm. So Gemma is **not** asked what a medicine is, what it costs or what to take instead. It does two narrow perception jobs where a small vision-language model is genuinely better than the alternatives, and the app's deterministic matcher and shipped data decide everything the patient sees.

```
photo ──► Gemma: "transcribe printed text" ──► lines ──► OUR matcher ──► top-5 candidates from OUR data
                                                                      │
              patient confirms ◄── result card ◄── OUR data ◄── Gemma: "pick one id from this list, or null"
```

| | |
|---|---|
| Model | **Gemma 4 E2B** (`gemma4:e2b` in Ollama), about 2.3B effective parameters, image input, Apache-2.0 |
| Runs on | our laptop: Windows, RTX 3050 Laptop GPU (4 GB), 15 GB RAM. `ollama ps` shows 100% GPU |
| Why E2B, not E4B | E2B fits entirely in 4 GB of VRAM; E4B would spill to system RAM and be several times slower. For transcription, E2B is enough |
| Settings | temperature 0, `num_ctx` 8192, images downscaled to ≤1024 px JPEG in the browser before upload |
| Privacy | photos go from the phone to the user's own laptop over local Wi-Fi; nothing leaves it |

## Prompts (exact, from `server/gemma-bridge.mjs`)

**1 · Read**, with a JSON schema `{lines: string[]}`:

> You transcribe printed text from a photo of a medicine strip or box. Return every line of printed text exactly as printed, top to bottom: brand name, composition, strength. Do not add, correct, translate, explain or guess anything. If nothing is readable, return an empty list.

**2 · Pick**, with a JSON schema whose `id` is an **enum of the candidate ids we offered, plus null**, so Gemma *cannot* return a product we didn't offer. The bridge checks again anyway.

> Text read from a medicine package: … Candidate products from our database: - id=b:pan-40: Pan 40 (Pantoprazole 40 mg (gastro-resistant)) … Which candidate is the product printed on the package? The brand name and strength must agree with the text. If none clearly matches, or you are unsure, answer null.

## Guard rails

- Gemma's text is only ever **input to our matcher**; it is shown to the user as "Text we read", never as a fact.
- The pick must be one of our candidates; `null` → "Could not read the photo. Please type the name."
- The patient always confirms ("Is this your medicine? Yes / No, I will type it").
- The 📷 button only appears when the bridge answers `/health`; typing never depends on it.

## Measured results

Run on real strip photos with:

```bash
npm run gemma:eval -- path/to/photos   # optional expected.csv: file,brand,strength
```

| Photo | Seconds | Brand read | Strength read | Notes |
|---|---|---|---|---|
| _to be filled from our own strip photos during the hackathon_ | | | | |

## What it gets wrong (honestly)

- **Handwriting:** not attempted. The brief is right that it's hard, and a wrong read is a harm.
- **Glare on foil strips**, curved strips and tiny fonts: letters dropped or invented. That's why the read only feeds the matcher, which then needs a confident match.
- **Numbers:** batch numbers, MRP and dates sit next to the strength. The matcher's strength check and the patient's confirmation catch mix-ups.
- **Latency:** the first call after loading the model is slow (warm-up). Run one photo before a demo.
