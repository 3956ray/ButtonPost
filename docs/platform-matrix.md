# Platform matrix

| Platform | Batch | Transport | Source handling | MVP status |
| --- | --- | --- | --- | --- |
| X | 1 | Official API + X Media | Markdown -> plain text; up to 4 source images | Implemented |
| DEV Community | 1 | Official Forem API + public Blob URLs | Markdown preserved; source images appended; first image as cover | Implemented |
| 即刻 | 1 | Local Runner + Patchright | Markdown -> plain text; optional JPEG/PNG images; manual review/send | Implemented and production-verified |
| 登链社区 | 1 | Local Runner + Patchright | Title + Markdown article; direct authenticated body-image upload; manual final review | Implemented and production-verified |
| Indie Hackers | 1 | Local Runner + Patchright | Title/body mapping; optional local image attempt; manual final review | Implemented (review publish MVP; needs production verification) |
| Bonjorr | 1 | Unconfirmed | TBD after exact platform is confirmed | Blocked on platform identity |
| 微信公众号 | 2 | Browser adapter | HTML-compatible article | Planned |
| Substack | 2 | API/browser research | Long-form source | Planned |
| 小红书 | 2 | Local Runner + Patchright | Markdown -> plain text + local image upload | Implemented (image note MVP) |
| Farcaster | 2 | API | Short post | Planned |
| Hugging Face Community | 2 | Research | Technical article | Planned |
| V2EX | 2 | Browser adapter | Topic/editor compatibility | Planned |

## MVP rule

ButtonPost stores one source. An adapter may make mechanical transformations required by the target (for example Markdown to plain text), but does not create a separately authored platform variant.
