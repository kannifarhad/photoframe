# photoframe

Gallery captions come from each file’s metadata:

- **Photos** — EXIF/IPTC GPS and capture date
- **MOV/MP4** — QuickTime GPS and creation date

Files with no usable metadata stay unlabeled.

## Filename overrides

If the embedded data is wrong or missing, put the correct values in **brackets** in the filename. Brackets win over metadata. You can set location, date, or both, on photos and videos:

```text
dinner [2023-10-09 | Baku, Azerbaijan].jpg
clip [Athens, Greece].MOV
DSC_2655 [2021-05-26].JPG
```

- Date must be `YYYY-MM-DD` (dots or underscores are also fine: `2023.10.09`, `2023_10_09`)
- Location is free text and is shown as written (for example `Athens, Greece` instead of a GPS suburb)
- Two bracket groups also work: `clip [2024-08-16] [Rome, Italy].MOV`

Point `MEDIA_DIR` at the folder of images and videos (see `.env.example`).

## Supported media

The kiosk Chromium build cannot display HEIC or HEVC `.MOV` files as-is, so those are converted on first load and cached in `MEDIA_DIR/.cache`:

- **HEIC/HEIF** → JPEG
- **HEVC MOV/MP4** → H.264 MP4

JPEG, PNG, WebP, H.264 MP4, and WebM are served unchanged. The first play of a new HEVC clip can take a little while; after that it is instant.
