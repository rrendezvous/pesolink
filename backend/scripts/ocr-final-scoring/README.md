# Final handwriting OCR scoring scripts

These are the two scripts used for the final handwriting OCR test (forms HW-01 to HW-18, scanned on 2 Nov 2026 in the deployed app). They are published here exactly as they were run on 3 Nov 2026 (unchanged copies).

| Script | What it does |
| --- | --- |
| `apply_corrections.js` | Makes a corrected copy of the answer key from the key checker's corrections (what the writer actually wrote). The original key is never changed. It also writes a list of every changed row. |
| `score_tab.js` | Compares each stored OCR reading with the corrected answer key and writes one row per field (columns A to N of the "OCR scoring" sheet). |

## Scoring rules (manuscript section 3.7.3 OCR Accuracy Evaluation, fixed before the run)

- **Written fields:** Exact = same characters; Normalized = differs only in letter case or extra spaces (a missing space is Wrong); Wrong; Missed (nothing read).
- **Blank fields:** Blank kept / False fill.
- **Checkboxes:** Correct / Missed tick / False tick.
- **Table row counts** are reported separately.
- **Not scorable:** only fields the key checker could not read; they are left out of every total.

The script scores the readings saved at the moment of scanning (before the user could edit anything), using the first photo of each page.

## How it was run

```
node apply_corrections.js <HW-ANSWER-KEY.csv> corrections.json HW-ANSWER-KEY-corrected.csv KEY-CHANGES-list.csv
node score_tab.js <full path to backend folder> <folder with scans.jsonl and an empty final/ folder> HW-ANSWER-KEY-corrected.csv
```

`score_tab.js` uses the app's own code (`scripts/ocr-accuracy.js` and `services/nsrpForm.js`) to read the saved readings, so it needs the path to this `backend` folder.

## Data (not in this repository)

The input files (the answer key, the corrections, the stored readings `scans.jsonl` and the form photos) contain the testers' handwriting and are kept private by the team. The panel or adviser can ask the team to re-run the scoring in front of them. Re-running these scripts on the same files gives a byte-identical result (checked on 17 Nov 2026).

After the run, a team member hand-checked all 2,259 result rows in two rounds and confirmed every outcome. Final results are reported in Chapter 4 of the manuscript.
