# AI Image Generation Providers

## Current (integrated)

| Provider | Type | API Style | Key Pattern | Endpoint |
|---|---|---|---|---|
| OpenAI | Direct | OpenAI-compatible | `sk-…` | `api.openai.com/v1/images/generations` |
| Google Gemini | Direct | Google API | `AIza…` | `generativelanguage.googleapis.com/v1beta` |
| OpenRouter | Aggregator | OpenAI-compatible | `sk-or-v1-…` | `openrouter.ai/api/v1/chat/completions` |
| Fal.ai | Aggregator | Custom queue | `…` | `queue.fal.run` |
| Stepfun | Direct | OpenAI-compatible | `sk-…` | `api.stepfun.com/v1/images/generations` |
| Agnes | Direct | OpenAI-compatible | `…` | `apihub.agnes-ai.com/v1/images/generations` |

## Planned — Phase 1 (xAI, Replicate, Ideogram)

| Provider | Type | API Style | Key Pattern | Endpoint | Notes |
|---|---|---|---|---|---|
| **xAI** | Direct | OpenAI-compatible | `xai-…` | `api.x.ai/v1/images/generations` | Drop-in, free tier available, `grok-imagine-image-quality` |
| **Replicate** | Aggregator | Custom | `r8_…` | `api.replicate.com/v1/predictions` | Poll-based async, many models |
| **Ideogram** | Direct | Custom | `…` | `api.ideogram.ai/v1/images/generate` | Best text rendering, flat/vector style |

## Candidates — Phase 2

| Provider | Type | API Style | Key Pattern | Endpoint | Notes |
|---|---|---|---|---|---|
| Black Forest Labs | Direct | Custom | `…` | `api.bfl.ai/v1` | FLUX.1 schnell/pro/dev/kontext |
| Stability AI | Direct | Custom | `sk-…` | `api.stability.ai/v2beta` | SD3.5, Stable Image Ultra |
| Recraft | Direct | Custom | `…` | `api.recraft.ai/v1/images/generate` | Vector/flat style, icon-friendly |
| Leonardo AI | Direct | REST | `…` | `api.leonardo.ai/v1/generations` | Many models |
| Together AI | Aggregator | OpenAI-compatible | `…` | `api.together.ai/v1/images/generations` | FLUX + SD hosted |
| Fireworks AI | Aggregator | OpenAI-compatible | `…` | `api.fireworks.ai/v1/images/generations` | FLUX Kontext |
| Krea | Aggregator | Custom | `…` | `api.krea.ai/v1/images/generate` | 40+ models |
| Runway | Direct | Custom | `…` | `api.runwayml.com/v1/images/generate` | Gen-4, $0.08/image |
| Luma | Direct | Custom | `…` | `api.lumalabs.ai/dream-machine/v1/generations/image` | Poll-based |
| Pika | Direct | Custom | `…` | `api.pika.style/v1/templates/{id}/images` | Template-based |

## No public API

- Midjourney — private/invite-only commercial API
