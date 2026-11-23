# ABET brand assets

Everything in this folder was downloaded from https://abetglobal.com on 23 Nov 2026, or derived from those files as noted. Nothing here was invented.

## Logos (`logos/`)

| File | Source | Status |
|---|---|---|
| `abet-wordmark-dark-official-251.png` | `abetglobal.com/logo.png` (251 × 90 px) | Official, but low resolution |
| `abet-wordmark-white-official.png` | `abetglobal.com/static/media/logowhite…png` (922 × 267 px) | Official |
| `abet-mark-official.png` | `abetglobal.com/favicon.png` (1668 × 1667 px), the bull-and-bear "A" | Official |
| `abet-wordmark-dark-derived.png` | The white logo with its white pixels recoloured to logo ink `#231F20` | **Derived, needs approval** |
| `abet-mark-96.png` | The favicon, cropped, white made transparent, 96 px | Derived for UI use |
| `web/` | Downscaled copies that are embedded in the app | Derived |

The site has no SVG logo. Its `logo192.png` and `logo512.png` app icons are the default React placeholder, not ABET artwork.

## Images (`images/`)

- `mt5-devices.png`: `abetglobal.com/computer.png`, MetaTrader 5 on laptop, tablet and phones (the screens show MetaQuotes demo data).
- `trust-compliance.svg`: `abetglobal.com/trust-compliance.svg`.

## Colours (from the site's CSS and logo pixels)

| Token | Hex | Where it was found |
|---|---|---|
| ABET Red | `#AE1818` | CSS `--main-color`, `--wb-red` |
| Red, pressed | `#8C1313` | CSS `--wb-red-dark` |
| Logo Red | `#BC202E` | Logo pixels; `manifest.json` theme colour |
| Logo Red, bull | `#BB1F24` | Logo pixels |
| Ink | `#191B22` | CSS `--main-color2` |
| Logo Ink | `#231F20` | Logo pixels |
| Text | `#1E2229` / `#333333` | CSS `--wb-text` / `--text-color` |
| Light surface | `#F8F9FA` | CSS `--light-color` |

No official secondary colours were found. **Needs confirmation.**

## Typography (from the site's CSS)

- **Poppins**: body text (`body { font-family: Poppins … }`)
- **Space Grotesk**: display headings (footer `h2`)
- **Montserrat**: secondary and footer text

## Legal text (verbatim from the site footer)

- Registration: "ABET is a registered trading services provider in Anguilla under registration number A000000977."
- The full CFD risk warning is in `design/src/app.html` as `RISK_FULL`.
- The short caption warning (`RISK_SHORT`) was written for Content OS. **It needs compliance approval.**

## Official social accounts (linked from the site footer)

instagram.com/abet.global · facebook.com/abetglobal · youtube.com/@abetglobal · linkedin.com/company/abetglobal · x.com/abetglobal · t.me/abet_global · pinterest.com/abetglobal
