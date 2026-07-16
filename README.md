# ♟️ Hidden Chess

A web app for playing **Hidden Chess** — a chess variant where you **design your own
starting position** and your opponent **can't see what your pieces are** until they're
captured. Bluff, infer, and outwit: a rook can pose as a king by only ever stepping one
square.

Built with React + TypeScript + Vite. Clean, chess.com-inspired UI. No accounts, no
backend — plays entirely in the browser.

## What is Hidden Chess?

Two things make it different from normal chess:

### 1. You design your setup

Instead of the fixed starting position, each player secretly arranges their own army.
There are two setup styles:

- **Back-Rank Design** *(Chess960-style, but you choose)* — arrange your 8 back-rank
  pieces (K, Q, 2×R, 2×B, 2×N) in any order across your first rank. Unlike Chess960 you
  aren't limited to legal 960 positions, and **you don't have to mirror your opponent**.
  Pawns stay on the 2nd rank.
- **Free Placement** — place **all 16 pieces, pawns included**, anywhere across your back
  two ranks.

### 2. Your opponent's pieces are hidden

During play you see **where** every piece is, but the opponent's pieces show as `?` — you
don't know what they are. A piece's identity is only **revealed when it's captured** (and
everything is revealed when the game ends).

You infer identities by watching how pieces move… but beware the bluffs. A rook that only
ever nudges one square looks a lot like a king.

Everything else is standard chess: checkmate wins, plus en passant, promotion, stalemate,
and the 50-move rule. There's no castling (your king rarely starts on a square where it
could castle anyway).

## Time controls

Every game has a **three-part time control**, written:

```
setup − play | increment
```

- **setup** — minutes each player gets to design their army
- **play** — minutes on each player's game clock
- **increment** — seconds added to your clock after every move (Fischer increment)

For example:

| Notation      | Meaning                                                        |
| ------------- | -------------------------------------------------------------- |
| `1 - 1 \| 1`  | Bullet: 1 min to set up, 1 min to play, +1 s per move          |
| `2 - 10 \| 0` | Rapid: 2 min to set up, 10 min to play, no increment           |

Presets for Bullet / Blitz / Rapid / Classical are built in, plus a fully custom option.
If your setup clock runs out, your remaining pieces are placed automatically so the game
can start.

## Game modes

- **vs Computer** — play solo against a built-in bot (choose your colour). The bot designs
  a hidden setup and plays with a shallow search.
- **Pass & Play** — two players share one device. A privacy "pass the device" screen
  hides each player's secret information during handoffs, and the board flips to the
  player on move.

## Running it

Requires Node 18+.

```bash
npm install     # install dependencies
npm run dev     # start the dev server (http://localhost:5173)
```

Other scripts:

```bash
npm run build   # type-check and build to dist/
npm run preview # preview the production build
npm test        # run the engine unit tests
npm run typecheck
```

## Deploying

A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes the site
to **GitHub Pages** on every push to the default branch. To turn it on, go to
**Settings → Pages → Build and deployment** and set the source to **GitHub Actions**.

The build uses `base: './'` (relative asset paths), so the same `dist/` also works when
hosted from a domain root or any static host (Netlify, Vercel, S3, …) — just serve the
`dist/` folder.

## Project structure

```
src/
  engine/            # framework-agnostic game logic (fully unit-tested)
    types.ts         # core types + coordinate system
    board.ts         # board helpers, setup construction & validation
    moves.ts         # move generation, check/checkmate, en passant, promotion
    ai.ts            # computer opponent (negamax) + random setup
    engine.test.ts   # assertion-based smoke tests
  game/
    state.ts         # top-level state machine (menu → setup → play → over)
    useGame.ts       # React hook wiring the clock + computer opponent
  components/         # UI: Menu, SetupView, PlayView, HandoffView, GameOverView, Piece…
  assets/pieces/      # bundled Cburnett SVG piece set (see CREDITS.md)
  styles/index.css    # the chess.com-inspired theme
```

The engine has no UI dependencies, so the rules can be tested (and reused) in isolation.

## Credits

Piece art is the open-source **Cburnett** Staunton set by Colin M. L. Burnett
(triple-licensed GPLv2+/GFDL/BSD, via [Lichess](https://github.com/lichess-org/lila)),
bundled locally so the app is fully self-contained. chess.com's own "neo" pieces are
proprietary and can't be redistributed, so this open set provides the same polished,
real-chess look. Swap in any set by replacing the SVGs in `src/assets/pieces/`. See
[`src/assets/pieces/CREDITS.md`](src/assets/pieces/CREDITS.md).

## License

MIT for the code. Bundled piece art keeps its own license (see Credits).
