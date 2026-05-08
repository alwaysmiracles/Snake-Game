# 🐍 Snake Game

A classic Snake game built with Next.js 16, TypeScript, Tailwind CSS 4, and shadcn/ui. Features beautiful Canvas rendering, responsive design, dark mode support, and mobile touch controls.

> 🎯 This README doubles as a **Vibe Coding Prompt** — copy the prompt below into any AI coding assistant to reproduce the entire game from scratch.

---

## Screenshot

The game features an emerald-green themed interface with:
- A 20×20 grid canvas with smooth snake rendering
- Score bar showing current score and snake length
- Overlay screens for idle/pause/game-over states
- Mobile D-pad for touch controls
- High score persistence via localStorage

---

## Quick Start

```bash
# Prerequisites: Node.js 18+ & bun
bun install
bun run dev
# Open http://localhost:3000
```

---

## Vibe Coding Prompt

> **Copy everything below this line and paste into your AI coding assistant to reproduce this game.**

---

### Project Context

Create a Snake game in an existing Next.js 16 project (App Router) with TypeScript, Tailwind CSS 4, and shadcn/ui (New York style). The project already has all shadcn/ui components installed in `src/components/ui/`. The game should be a single-page app rendered at the `/` route.

### Tech Stack Requirements

- **Framework**: Next.js 16 with App Router (do NOT change this)
- **Language**: TypeScript 5 (strict)
- **Styling**: Tailwind CSS 4 + shadcn/ui components
- **Icons**: Lucide React icons
- **Rendering**: HTML5 Canvas for the game board
- **No external game libraries** — pure Canvas 2D API + React hooks

### File Structure

Only 2 files need to be created/modified:

1. **`src/components/snake-game.tsx`** — The complete game component (~715 lines)
2. **`src/app/page.tsx`** — Simply imports and renders the game component

### Detailed Specification

#### Game Constants & Types

```typescript
const GRID_SIZE = 20          // 20×20 grid
const CELL_SIZE = 24          // Each cell is 24px
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE  // 480px canvas
const INITIAL_SPEED = 150     // ms between ticks (starts at 150ms)
const SPEED_INCREMENT = 2     // Speed up by 2ms each food eaten
const MIN_SPEED = 60          // Fastest possible speed

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Position = { x: number; y: number }
type GameState = 'idle' | 'playing' | 'paused' | 'gameover'
```

#### Color Palette

```typescript
const COLORS = {
  grid: '#f8faf8',              // Light green-white background
  gridLine: '#e8f0e8',          // Subtle grid lines
  snakeHead: '#22c55e',         // Bright green head
  snakeBody: '#16a34a',         // Medium green body
  snakeTail: '#15803d',         // Dark green tail
  snakeEye: '#ffffff',          // White eye sclera
  snakePupil: '#1a1a2e',        // Dark pupil
  food: '#ef4444',              // Red apple
  foodGlow: 'rgba(239, 68, 68, 0.3)',    // Red glow around food
  bonusFood: '#f59e0b',         // Amber/gold star
  bonusFoodGlow: 'rgba(245, 158, 11, 0.3)', // Gold glow around bonus
}
```

#### Game Mechanics

**Snake Movement:**
- Snake starts at positions `[{x:5,y:10}, {x:4,y:10}, {x:3,y:10}]`, moving RIGHT
- Each tick, the head moves one cell in the current direction
- A new head position is prepended; if no food was eaten, the tail is removed (pop)
- Direction is buffered via `nextDirectionRef` to prevent 180° turns within the same tick
- Use `useRef` for `directionRef` and `nextDirectionRef` so the game loop always reads the latest value

**Food System:**
- Regular food (red apple): +10 points, always present on the grid
- Bonus food (gold star): +30 points, 30% chance to spawn after eating an apple, disappears when eaten
- When food is eaten, a new position is randomly generated (never on the snake body)

**Collision Detection:**
- Wall collision: head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE → game over
- Self collision: head position matches any existing snake body segment → game over
- On game over, update high score and save to localStorage

**Speed:**
- Starts at 150ms per tick
- Decreases by 2ms each time regular food is eaten (faster = harder)
- Minimum speed is 60ms per tick

**High Score:**
- Use `useState` with a lazy initializer to read from `localStorage.getItem('snake-high-score')` on mount
- Update high score whenever game ends and current score exceeds it
- Display as a Badge with Trophy icon in the header

#### Critical Implementation Detail: Synchronous State Access

**This is the most important architectural decision in the code.**

In React 18, `setState` calls are batched. When you call `setFood()` inside a `setSnake()` callback, the inner `setFood` callback does NOT execute synchronously. This means patterns like:

```typescript
// ❌ BROKEN: `ate` will always be false because setFood callback is deferred
let ate = false
setFood((prevFood) => {
  if (head.x === prevFood.x && head.y === prevFood.y) {
    ate = true  // This assignment happens AFTER the outer function returns
    return randomPosition(newSnake)
  }
  return prevFood
})
if (ate) { /* never reaches here */ } else { newSnake.pop() } // Snake never grows!
```

**Solution:** Use `useRef` to maintain synchronous copies of food and score state:

```typescript
const foodRef = useRef<Position>({ x: 15, y: 10 })
const bonusFoodRef = useRef<Position | null>(null)
const scoreRef = useRef(0)
```

In the `gameTick` function, read positions directly from refs (synchronous), then update both the ref AND the state:

```typescript
// ✅ CORRECT: Read from ref (synchronous), then sync both ref and state
const currentFood = foodRef.current
if (head.x === currentFood.x && head.y === currentFood.y) {
  ate = true
  const newFood = randomPosition(newSnake)
  foodRef.current = newFood   // Update ref immediately
  setFood(newFood)            // Update state for React re-render
}
```

Always update both ref and state together. The ref provides synchronous reads in game logic; the state triggers React re-renders for the UI.

#### Canvas Drawing (`draw` function)

Wrap in `useCallback` with empty deps `[]` since it only reads its parameters.

Drawing order (back to front):
1. **Grid background** — Fill entire canvas with `COLORS.grid`, then draw `COLORS.gridLine` lines at every `CELL_SIZE` interval
2. **Food glow** — Radial gradient around food position (radius = `CELL_SIZE * 1.2`), from `COLORS.foodGlow` to transparent
3. **Food (apple)** — Red circle with white highlight dot and brown stem line
4. **Bonus food (star)** — Same glow pattern but amber, then draw a 5-pointed star using alternating outer/inner radius points, plus white highlight dot
5. **Snake body** — For each segment, draw a rounded rectangle with color gradient from head (bright green) to tail (dark green) based on `index / snake.length` ratio. Use `quadraticCurveTo` for rounded corners (radius 6 for head, 4 for body)
6. **Snake head eyes** — Two white circles (radius 3) with dark pupils (radius 1.5), positioned based on current direction (e.g., RIGHT → eyes on right side, UP → eyes on top)

#### Game Loop

```typescript
useEffect(() => {
  if (gameState === 'playing') {
    gameLoopRef.current = setTimeout(() => {
      gameTick()
    }, speed)
  }
  return () => {
    if (gameLoopRef.current) clearTimeout(gameLoopRef.current)
  }
}, [gameState, snake, speed, gameTick])
```

Use `setTimeout` (not `setInterval`) so the speed can change dynamically. The effect re-runs whenever `snake` or `speed` changes, creating the next tick.

#### Keyboard Controls

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Space/Enter to start when idle or game over
    // Arrow keys or WASD for direction during gameplay
    // Prevent 180° reversal (can't go opposite of current direction)
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [gameState, startGame])
```

Prevent the snake from reversing: if current direction is RIGHT, pressing LEFT is ignored. Use `getOpposite()` helper function and `directionRef.current` for the check.

#### Page Layout (`src/app/page.tsx`)

```typescript
import SnakeGame from '@/components/snake-game'
export default function Home() {
  return <SnakeGame />
}
```

Simple — just import and render the game component.

#### UI Layout (JSX structure)

The component returns a `div` with `min-h-screen flex flex-col` and a green gradient background:

```
bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50
dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950
```

**Header** (`header`):
- Left: `Gamepad2` icon + "Snake Game" title
- Right: High score Badge (amber colored, with Trophy icon), only shown when highScore > 0

**Score Bar**:
- Left: "Score" label + score value in emerald color, large bold font with `tabular-nums`
- Right: "Length" label + snake.length in gray

**Game Canvas** (wrapped in Card with emerald border):
- Canvas element: 480×480px, `style={{ maxWidth: '100%', height: 'auto' }}` for responsive scaling
- **Idle overlay**: Black/40 backdrop blur, "🐍 Snake" title, "Use arrow keys or WASD" subtitle, green "Start Game" button with Play icon
- **Game Over overlay**: Black/50 backdrop blur, red "Game Over" title, score display, "New High Score!" amber text (conditional), green "Play Again" button with RotateCcw icon
- Both overlays use `absolute inset-0` positioning over the canvas

**Control Buttons**:
- During playing: "Pause" button (emerald outline)
- During paused: "Resume" button with Play icon (emerald outline)
- During playing or paused: "Restart" button with RotateCcw icon (gray outline)

**Mobile D-Pad** (only visible on small screens, `sm:hidden`):
- 3×3 grid layout with ChevronUp/Down/Left/Right icons
- Each button is 48×48px (`h-12 w-12`) with emerald border
- Uses `onTouchStart` with `e.preventDefault()` to handle touch without scroll
- Center cell has a small emerald dot as decoration
- Calls `handleDirection()` which updates `nextDirectionRef.current`

**Instructions** (bottom text):
- Shows keyboard shortcuts with `<kbd>` styled elements
- Shows food point values with colored dots: red = Apple 10pts, amber = Star 30pts

**Footer**: Sticky at bottom via `mt-auto` in flex column, small gray text "Built with Next.js & shadcn/ui · Snake Game"

#### shadcn/ui Components Used

- `Button` — For start/restart/pause/resume/d-pad controls
- `Card` + `CardContent` — Wrapping the canvas
- `Badge` — For high score display

#### Lucide Icons Used

- `Gamepad2` — Header icon
- `Trophy` — High score badge, new high score indicator
- `Play` — Start/resume buttons
- `RotateCcw` — Restart/play again buttons
- `ChevronUp/Down/Left/Right` — Mobile D-pad

#### State Management Summary

| State | Type | Purpose | Also tracked via ref? |
|-------|------|---------|----------------------|
| `gameState` | `'idle' \| 'playing' \| 'paused' \| 'gameover'` | Current game phase | No |
| `score` | `number` | Current score | Yes (`scoreRef`) |
| `highScore` | `number` | All-time best (localStorage) | No |
| `snake` | `Position[]` | Snake body segments | No |
| `food` | `Position` | Regular food position | Yes (`foodRef`) |
| `bonusFood` | `Position \| null` | Bonus food position | Yes (`bonusFoodRef`) |
| `speed` | `number` | Current tick interval (ms) | No |

All refs are **synchronized** with their state counterparts — every `setFood()` call is paired with `foodRef.current = newValue`.

#### `startGame` Function

Resets all state and refs to initial values:
- Snake to `[{x:5,y:10}, {x:4,y:10}, {x:3,y:10}]`
- Food to `randomPosition(initialSnake)` (sync both state + ref)
- Bonus food to `null` (sync both)
- Score to `0` (sync both)
- Speed to `INITIAL_SPEED`
- Direction refs to `'RIGHT'`
- Game state to `'playing'`

#### `randomPosition` Helper

Generates a random Position that doesn't overlap with any snake segment. Uses a do-while loop to re-roll if the position collides.

#### `getOpposite` Helper

Maps each direction to its opposite: UP↔DOWN, LEFT↔RIGHT. Used to prevent 180° direction reversal.

---

### Quality Checklist

Before considering the implementation complete, verify:

- [ ] Snake grows when eating food (the ref-sync pattern is critical for this)
- [ ] Score increases: +10 for apple, +30 for star
- [ ] Game over on wall collision or self-collision
- [ ] High score persists across page reloads via localStorage
- [ ] Speed increases gradually as score goes up
- [ ] Bonus star food spawns randomly after eating apples
- [ ] Keyboard controls: Arrow keys + WASD
- [ ] Cannot reverse direction (no 180° turns)
- [ ] Start/Restart/Pause/Resume buttons all work
- [ ] Space/Enter key starts game from idle or game-over screen
- [ ] Mobile D-pad works with touch (no scroll interference)
- [ ] Canvas renders correctly with snake eyes facing movement direction
- [ ] Dark mode styling works
- [ ] Responsive: canvas scales down on small screens
- [ ] No lint errors (`bun run lint` passes clean)

---

## License

MIT
