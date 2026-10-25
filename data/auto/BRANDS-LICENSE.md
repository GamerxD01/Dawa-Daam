# Licence of `brands_dataset.csv` (and the generated `public/data/brands.json`)

These files are **adapted from** the *A-Z Medicine Dataset of India* by Shudhanshu Singh, published on Kaggle
(https://www.kaggle.com/datasets/shudhanshusingh/az-medicine-dataset-of-india) under
**Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**, https://creativecommons.org/licenses/by-sa/4.0/.

**Changes we made:** kept only brands that are not discontinued and are plain tablets, capsules, syrups or oral
suspensions; dropped two-ingredient rows whose name does not print both strengths, diclofenac rows (salt not stated),
"OD" rows and names used for two different medicines; normalised ingredient names, strengths and release types;
shortened names ("Pan 40 Tablet" → "Pan 40"); kept one pack per name (lowest price per unit); and added the code of the
exactly equivalent Jan Aushadhi product. Prices are as in the source and were **not checked by us**.

As required by the licence, these adapted files are shared under the **same licence, CC BY-SA 4.0**.
The rest of this repository (code, and our own hand-checked data in `data/src/`) is under Apache-2.0 (see `LICENSE`).
No warranty: the source data may be out of date or wrong; the app says so on every result that uses it.
