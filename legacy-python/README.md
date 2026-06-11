# Legacy Python script

This folder holds the original Python prototype that the [browser extension](../extension/) was built from.

You probably want the **extension** — install it once, open KSP, click the floating "✨ נתח עם AI" button, done. No terminal, no copy-paste.

The script here is kept for power users who want to pipe extracted data into scripts.

## Usage

```bash
pip install beautifulsoup4

# from clipboard (after copying a product grid div in DevTools)
python ksp_extract.py

# from file
python ksp_extract.py input.html

# from stdin
cat page.html | python ksp_extract.py -

# compact text instead of JSON
python ksp_extract.py --format text
```

See [`sample.html`](sample.html) for an example input and [`input.txt`](input.txt) for a full-page paste.
