# photoframe

Gallery captions come from each file’s metadata:

- **Photos** — EXIF/IPTC GPS and capture date
- **MOV/MP4** — QuickTime GPS and creation date

Files with no usable metadata stay unlabeled until you fill them in.

## Captions file

`photos/metadata.json` lists every image and video. The app creates it and fills in what it can find. Anything you type there is kept. A `null` field is tried again on the next refresh, including another OpenStreetMap lookup when GPS exists but the last request failed.

```json
{
  "IMG_2429.MOV": {
    "location": "Athens, Greece",
    "takenAt": "2024-04-23"
  },
  "DSC_2655.JPG": {
    "location": null,
    "takenAt": "2021-05-26"
  }
}
```

- `takenAt` is `YYYY-MM-DD`
- `location` is shown as written
- Delete a value, or set it back to `null`, to let the app detect it again

Filename brackets still fill an empty field the first time, then that value is saved in `metadata.json`:

```text
dinner [2023-10-09 | Baku, Azerbaijan].jpg
```

Point `MEDIA_DIR` at the folder of images and videos (see `.env.example`).

## Supported media

The kiosk Chromium build cannot display HEIC or HEVC `.MOV` files as-is, so those are converted on first load and stored as **files on disk** in `MEDIA_DIR/.cache` (not in RAM):

- **HEIC/HEIF** → JPEG
- **HEVC MOV/MP4** → H.264 MP4

JPEG, PNG, WebP, H.264 MP4, and WebM are served unchanged. The first play of a new HEVC clip can take a little while; after that it reads the disk file. Cache files for photos you have removed are deleted automatically. You can also delete `.cache` yourself; it will be rebuilt as needed.
