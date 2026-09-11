# Birthday Cake for Girlfie 🎂

A little birthday surprise I made for my girlfriend for her 20th birthday. It types out a message, drops a cake onto a table under fairy lights by a city skyline at night, and lets her blow out the candle to set off fireworks, all timed to *Get Schwifty*.

## What happens

1. **Tap (or press Space) to start.** The music begins and a terminal types out the message.
2. **The cake drops in on the beat.** It lands on the table just as the song kicks in, then the candle follows.
3. **Blow out the candle.** Tap the button (or press Space) for fireworks.
4. **Look around.** Drag to spin the view, and tap the card on the table to read it.

It works on phones as well as laptops.

## Built with

React, TypeScript and Vite, with Three.js through [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) and [drei](https://github.com/pmndrs/drei). The cake, table, photo frames, fairy lights and fireworks are all drawn in code; the only 3D model file is the candle.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Make it your own

| To change | Where |
|---|---|
| The typed message | `TYPED_LINES` in `src/App.tsx` |
| The photos | Replace `public/frame1.jpg` … `public/frame5.jpeg`; their order and positions are in `FRAME_PHOTOS` in `src/App.tsx` |
| The writing on the cake | `MESSAGE` in `src/models/cake.tsx` |
| The song | Replace `public/music.m4a`, then set `SONG_KICK_SECONDS` (when the beat kicks in) and `SONG_BEAT_SECONDS` (length of one beat) in `src/App.tsx` so the cake still drops on the beat |
| The background | Replace `public/background_4k.jpg` with a 360° image that's twice as wide as it is tall; `BACKGROUND_BRIGHTNESS` in `src/App.tsx` sets how dark it looks |
| The tablecloth colour | `GINGHAM_BLUE` in `src/models/table.tsx` |
| The card | `public/card.png` |

File names are case-sensitive once the site is online: `photo.JPG` and `photo.jpg` count as different files.

## Deploy

It's hosted on [Vercel](https://vercel.com). Import the repo there once, and every push to `main` updates the live site automatically.
