# HookCover Brand Kit

## Positioning

HookCover turns a video, link, or transcript into a clickable cover:

```text
video/transcript -> CTR hook -> thumbnail template -> finished cover
```

Core promise:

```text
Из ролика в CTR-обложку за пару минут.
```

Short description:

```text
AI-бот для YouTube, Reels и TikTok: анализирует видео, предлагает хуки и собирает обложку по шаблонам.
```

## Name

Primary: `HookCover`

Russian product wording:

```text
HookCover — AI-студия обложек для видео
```

Avoid names that sound generic, such as `AI Обложки` or `YouTube Bot`.

## Visual Assets

Avatar:

- Original: `brand/assets/hookcover-avatar.png`
- Telegram-ready: `brand/assets/hookcover-avatar-512.png`

Bot cover / intro image:

- Original: `brand/assets/hookcover-bot-cover.png`
- Telegram-ready: `brand/assets/hookcover-bot-cover-1280.png`

## Palette

```text
Graphite       #101216
White          #F8FAFC
CTR Yellow     #F9D84A
Signal Red     #FF3B30
Electric Cyan  #25D7F7
Muted Gray     #7A7F8C
```

Usage:

- Graphite is the main background.
- Yellow is the primary product accent.
- Red is for arrows, urgency, and CTR cues.
- Cyan is for source/input/AI accents.
- Avoid purple AI gradients and beige creator palettes.

## Typography Direction

Use bold, condensed, high-contrast display text for thumbnail-like moments.

Recommended style:

- heavy grotesk / condensed sans
- uppercase for short hooks
- strong contrast
- no delicate thin fonts

UI/admin typography can stay neutral and system-based.

## Telegram Bot Text

Bot about text:

```text
AI-бот, который превращает видео, ссылку или транскрипт в CTR-хуки и готовую обложку.
```

Bot description:

```text
HookCover анализирует ролик, предлагает сильные хуки и собирает обложку по проверенным thumbnail-шаблонам для YouTube, Reels и TikTok.

Дайте ссылку, видео или транскрипт — бот подготовит варианты хуков и сгенерирует обложку через AI.
```

Start message tone:

```text
Создадим обложку из вашего ролика.

Дайте ссылку, видео или транскрипт — я найду главный хук и соберу обложку по шаблону.
```

## Voice

Tone:

- practical
- creator-focused
- confident
- concise

Do say:

- `хук`
- `CTR`
- `шаблон`
- `обложка из ролика`
- `готовый PNG`
- `выберите механику обложки`

Do not say:

- `нейросеть сделает магию`
- `просто напишите промпт`
- `скопируем чужую обложку`
- `гарантируем просмотры`

## Template Language

Template labels should describe a thumbnail mechanic, not an abstract style.

Good:

- `Split Text`
- `Double Focus Arrow`
- `Faceless POV`
- `Split Compare`
- `Subject Circle Highlight`

Avoid:

- `Красивый`
- `Современный`
- `Вирусный стиль`
- `AI стиль`

## Generated Asset Prompts

Avatar prompt summary:

```text
Premium Telegram avatar for HookCover. Centered thumbnail frame, play triangle, lightning/spark accent, cursor/crop mark, deep graphite background, yellow/red/cyan accents, no text, no official platform logos.
```

Cover prompt summary:

```text
Dark premium horizontal bot cover. Left: source cards for link, video, transcript. Center: AI pipeline. Right: vivid thumbnail template cards. Main text: “Видео → CTR-обложка”. Subtitle: “Хуки • Шаблоны • AI-дизайн”.
```

## BotFather Setup

Use:

```text
/setuserpic
brand/assets/hookcover-avatar-512.png
```

Use the cover/intro visual wherever Telegram exposes a bot intro, profile, or Mini App preview image:

```text
brand/assets/hookcover-bot-cover-1280.png
```

If Telegram crops the cover too tightly, use the original large version and crop manually around the headline and right-side thumbnail cards.
