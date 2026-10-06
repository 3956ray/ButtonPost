# Platform matrix

| Platform | Batch | Transport | Source handling | MVP status |
| --- | --- | --- | --- | --- |
| X | 1 | Official API | Markdown -> plain text | Implemented |
| DEV Community | 1 | Official Forem API | Markdown preserved | Implemented |
| 即刻 | 1 | Browser extension | Format compatibility only | Planned |
| 登链社区 | 1 | Browser / verified integration path | Markdown / editor compatibility | Planned |
| Indie Hackers | 1 | Browser-assisted | Editor compatibility | Planned |
| Bonjorr | 1 | Unconfirmed | TBD after exact platform is confirmed | Blocked on platform identity |
| 微信公众号 | 2 | Browser adapter | HTML-compatible article | Planned |
| Substack | 2 | API/browser research | Long-form source | Planned |
| 小红书 | 2 | Browser adapter | Text + image constraints | Planned |
| Farcaster | 2 | API | Short post | Planned |
| Hugging Face Community | 2 | Research | Technical article | Planned |
| V2EX | 2 | Browser adapter | Topic/editor compatibility | Planned |

## MVP rule

ButtonPost stores one source. An adapter may make mechanical transformations required by the target (for example Markdown to plain text), but does not create a separately authored platform variant.
