'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Play,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
} from 'lucide-react'

// ─── Game Constants ───────────────────────────────────────────────
const GRID_SIZE = 20
const CELL_SIZE = 24
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE
const INITIAL_SPEED = 150
const SPEED_INCREMENT = 2
const MIN_SPEED = 60

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Position = { x: number; y: number }
type GameState = 'idle' | 'playing' | 'paused' | 'gameover'

// ─── Colors ───────────────────────────────────────────────────────
const COLORS = {
  grid: '#f8faf8',
  gridLine: '#e8f0e8',
  snakeHead: '#22c55e',
  snakeBody: '#16a34a',
  snakeTail: '#15803d',
  snakeEye: '#ffffff',
  snakePupil: '#1a1a2e',
  food: '#ef4444',
  foodGlow: 'rgba(239, 68, 68, 0.3)',
  bonusFood: '#f59e0b',
  bonusFoodGlow: 'rgba(245, 158, 11, 0.3)',
}

// ─── Helper Functions ─────────────────────────────────────────────
function randomPosition(snake: Position[]): Position {
  let pos: Position
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    }
  } while (snake.some((s) => s.x === pos.x && s.y === pos.y))
  return pos
}

function getOpposite(dir: Direction): Direction {
  const map: Record<Direction, Direction> = {
    UP: 'DOWN',
    DOWN: 'UP',
    LEFT: 'RIGHT',
    RIGHT: 'LEFT',
  }
  return map[dir]
}

// ─── Component ────────────────────────────────────────────────────
export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameLoopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const directionRef = useRef<Direction>('RIGHT')
  const nextDirectionRef = useRef<Direction>('RIGHT')
  const lastMoveTimeRef = useRef<number>(0)

  const [gameState, setGameState] = useState<GameState>('idle')
  const [score, setScore] = useState(0)
  const [snake, setSnake] = useState<Position[]>([
    { x: 5, y: 10 },
    { x: 4, y: 10 },
    { x: 3, y: 10 },
  ])
  const [food, setFood] = useState<Position>({ x: 15, y: 10 })
  const [bonusFood, setBonusFood] = useState<Position | null>(null)
  const [speed, setSpeed] = useState(INITIAL_SPEED)

  // Refs for synchronous access inside game tick
  const foodRef = useRef<Position>({ x: 15, y: 10 })
  const bonusFoodRef = useRef<Position | null>(null)
  const scoreRef = useRef(0)

  // Load high score from localStorage (lazy initializer)
  const [highScore, setHighScore] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('snake-high-score')
      return saved ? parseInt(saved, 10) : 0
    }
    return 0
  })

  // ─── Draw Function ─────────────────────────────────────────────
  const draw = useCallback(
    (currentSnake: Position[], currentFood: Position, currentBonus: Position | null) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Clear canvas
      ctx.fillStyle = COLORS.grid
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

      // Draw grid lines
      ctx.strokeStyle = COLORS.gridLine
      ctx.lineWidth = 0.5
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath()
        ctx.moveTo(i * CELL_SIZE, 0)
        ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * CELL_SIZE)
        ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE)
        ctx.stroke()
      }

      // Draw food glow
      const foodCenterX = currentFood.x * CELL_SIZE + CELL_SIZE / 2
      const foodCenterY = currentFood.y * CELL_SIZE + CELL_SIZE / 2
      const glowGradient = ctx.createRadialGradient(
        foodCenterX,
        foodCenterY,
        2,
        foodCenterX,
        foodCenterY,
        CELL_SIZE * 1.2
      )
      glowGradient.addColorStop(0, COLORS.foodGlow)
      glowGradient.addColorStop(1, 'transparent')
      ctx.fillStyle = glowGradient
      ctx.fillRect(
        currentFood.x * CELL_SIZE - CELL_SIZE,
        currentFood.y * CELL_SIZE - CELL_SIZE,
        CELL_SIZE * 3,
        CELL_SIZE * 3
      )

      // Draw food (apple)
      const fX = currentFood.x * CELL_SIZE + 2
      const fY = currentFood.y * CELL_SIZE + 2
      const fS = CELL_SIZE - 4

      ctx.fillStyle = COLORS.food
      ctx.beginPath()
      ctx.arc(fX + fS / 2, fY + fS / 2 + 1, fS / 2, 0, Math.PI * 2)
      ctx.fill()

      // Food highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.beginPath()
      ctx.arc(fX + fS / 2 - 2, fY + fS / 2 - 2, fS / 5, 0, Math.PI * 2)
      ctx.fill()

      // Food stem
      ctx.strokeStyle = '#854d0e'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(fX + fS / 2, fY + 2)
      ctx.lineTo(fX + fS / 2 + 2, fY - 2)
      ctx.stroke()

      // Draw bonus food
      if (currentBonus) {
        const bCenterX = currentBonus.x * CELL_SIZE + CELL_SIZE / 2
        const bCenterY = currentBonus.y * CELL_SIZE + CELL_SIZE / 2
        const bGlow = ctx.createRadialGradient(
          bCenterX,
          bCenterY,
          2,
          bCenterX,
          bCenterY,
          CELL_SIZE * 1.2
        )
        bGlow.addColorStop(0, COLORS.bonusFoodGlow)
        bGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = bGlow
        ctx.fillRect(
          currentBonus.x * CELL_SIZE - CELL_SIZE,
          currentBonus.y * CELL_SIZE - CELL_SIZE,
          CELL_SIZE * 3,
          CELL_SIZE * 3
        )

        const bX = currentBonus.x * CELL_SIZE + 2
        const bY = currentBonus.y * CELL_SIZE + 2
        const bS = CELL_SIZE - 4

        // Star shape
        ctx.fillStyle = COLORS.bonusFood
        ctx.beginPath()
        const spikes = 5
        const outerR = bS / 2
        const innerR = bS / 4
        for (let i = 0; i < spikes * 2; i++) {
          const r = i % 2 === 0 ? outerR : innerR
          const angle = (Math.PI * i) / spikes - Math.PI / 2
          const sx = bX + bS / 2 + r * Math.cos(angle)
          const sy = bY + bS / 2 + r * Math.sin(angle)
          if (i === 0) ctx.moveTo(sx, sy)
          else ctx.lineTo(sx, sy)
        }
        ctx.closePath()
        ctx.fill()

        // Star highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.beginPath()
        ctx.arc(bX + bS / 2 - 1, bY + bS / 2 - 1, bS / 6, 0, Math.PI * 2)
        ctx.fill()
      }

      // Draw snake
      currentSnake.forEach((segment, index) => {
        const x = segment.x * CELL_SIZE
        const y = segment.y * CELL_SIZE
        const padding = 1
        const size = CELL_SIZE - padding * 2
        const radius = index === 0 ? 6 : 4

        // Body gradient
        const ratio = index / currentSnake.length
        const r = Math.round(34 + ratio * (22 - 34))
        const g = Math.round(197 + ratio * (163 - 197))
        const b = Math.round(94 + ratio * (74 - 94))

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`

        // Rounded rectangle
        ctx.beginPath()
        ctx.moveTo(x + padding + radius, y + padding)
        ctx.lineTo(x + padding + size - radius, y + padding)
        ctx.quadraticCurveTo(x + padding + size, y + padding, x + padding + size, y + padding + radius)
        ctx.lineTo(x + padding + size, y + padding + size - radius)
        ctx.quadraticCurveTo(x + padding + size, y + padding + size, x + padding + size - radius, y + padding + size)
        ctx.lineTo(x + padding + radius, y + padding + size)
        ctx.quadraticCurveTo(x + padding, y + padding + size, x + padding, y + padding + size - radius)
        ctx.lineTo(x + padding, y + padding + radius)
        ctx.quadraticCurveTo(x + padding, y + padding, x + padding + radius, y + padding)
        ctx.closePath()
        ctx.fill()

        // Head details
        if (index === 0) {
          const dir = directionRef.current
          ctx.fillStyle = COLORS.snakeEye

          let eye1X: number, eye1Y: number, eye2X: number, eye2Y: number
          const eyeSize = 3
          const pupilSize = 1.5

          switch (dir) {
            case 'RIGHT':
              eye1X = x + CELL_SIZE - 8
              eye1Y = y + 7
              eye2X = x + CELL_SIZE - 8
              eye2Y = y + CELL_SIZE - 7
              break
            case 'LEFT':
              eye1X = x + 6
              eye1Y = y + 7
              eye2X = x + 6
              eye2Y = y + CELL_SIZE - 7
              break
            case 'UP':
              eye1X = x + 7
              eye1Y = y + 6
              eye2X = x + CELL_SIZE - 7
              eye2Y = y + 6
              break
            case 'DOWN':
              eye1X = x + 7
              eye1Y = y + CELL_SIZE - 8
              eye2X = x + CELL_SIZE - 7
              eye2Y = y + CELL_SIZE - 8
              break
          }

          // Eyes
          ctx.fillStyle = COLORS.snakeEye
          ctx.beginPath()
          ctx.arc(eye1X!, eye1Y!, eyeSize, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(eye2X!, eye2Y!, eyeSize, 0, Math.PI * 2)
          ctx.fill()

          // Pupils
          ctx.fillStyle = COLORS.snakePupil
          ctx.beginPath()
          ctx.arc(eye1X!, eye1Y!, pupilSize, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(eye2X!, eye2Y!, pupilSize, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    },
    []
  )

  // ─── Game Tick ──────────────────────────────────────────────────
  const gameTick = useCallback(() => {
    setSnake((prevSnake) => {
      const newSnake = [...prevSnake]
      const head = { ...newSnake[0] }

      directionRef.current = nextDirectionRef.current

      switch (directionRef.current) {
        case 'UP':
          head.y -= 1
          break
        case 'DOWN':
          head.y += 1
          break
        case 'LEFT':
          head.x -= 1
          break
        case 'RIGHT':
          head.x += 1
          break
      }

      // Check wall collision
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        setGameState('gameover')
        setHighScore((prev) => {
          const newHigh = Math.max(prev, scoreRef.current)
          localStorage.setItem('snake-high-score', String(newHigh))
          return newHigh
        })
        return prevSnake
      }

      // Check self collision
      if (newSnake.some((s) => s.x === head.x && s.y === head.y)) {
        setGameState('gameover')
        setHighScore((prev) => {
          const newHigh = Math.max(prev, scoreRef.current)
          localStorage.setItem('snake-high-score', String(newHigh))
          return newHigh
        })
        return prevSnake
      }

      newSnake.unshift(head)

      // Check food using refs for synchronous access
      const currentFood = foodRef.current
      const currentBonus = bonusFoodRef.current
      let ate = false
      let ateBonus = false

      if (head.x === currentFood.x && head.y === currentFood.y) {
        ate = true
        const newFood = randomPosition(newSnake)
        foodRef.current = newFood
        setFood(newFood)
      }

      if (currentBonus && head.x === currentBonus.x && head.y === currentBonus.y) {
        ateBonus = true
        bonusFoodRef.current = null
        setBonusFood(null)
      }

      if (ate) {
        scoreRef.current += 10
        setScore(scoreRef.current)
        setSpeed((prev) => Math.max(MIN_SPEED, prev - SPEED_INCREMENT))

        // Chance to spawn bonus
        if (!currentBonus && Math.random() < 0.3) {
          const newBonus = randomPosition(newSnake)
          bonusFoodRef.current = newBonus
          setBonusFood(newBonus)
        }
      } else if (ateBonus) {
        scoreRef.current += 30
        setScore(scoreRef.current)
      } else {
        newSnake.pop()
      }

      return newSnake
    })
  }, [])

  // ─── Game Loop ─────────────────────────────────────────────────
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

  // ─── Start Game ────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const initialSnake = [
      { x: 5, y: 10 },
      { x: 4, y: 10 },
      { x: 3, y: 10 },
    ]
    const newFood = randomPosition(initialSnake)
    setSnake(initialSnake)
    setFood(newFood)
    foodRef.current = newFood
    setBonusFood(null)
    bonusFoodRef.current = null
    setScore(0)
    scoreRef.current = 0
    setSpeed(INITIAL_SPEED)
    directionRef.current = 'RIGHT'
    nextDirectionRef.current = 'RIGHT'
    setGameState('playing')
  }, [])

  // ─── Mobile Direction Control ──────────────────────────────────
  const handleDirection = useCallback((dir: Direction) => {
    if (dir !== getOpposite(directionRef.current)) {
      nextDirectionRef.current = dir
    }
  }, [])

  // ─── Draw on every snake/food change ───────────────────────────
  useEffect(() => {
    draw(snake, food, bonusFood)
  }, [snake, food, bonusFood, draw])

  // ─── Keyboard Controls ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          if (gameState === 'idle' || gameState === 'gameover') {
            startGame()
          }
        }
        return
      }

      let newDir: Direction | null = null
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          newDir = 'UP'
          break
        case 'ArrowDown':
        case 's':
        case 'S':
          newDir = 'DOWN'
          break
        case 'ArrowLeft':
        case 'a':
        case 'A':
          newDir = 'LEFT'
          break
        case 'ArrowRight':
        case 'd':
        case 'D':
          newDir = 'RIGHT'
          break
      }

      if (newDir && newDir !== getOpposite(directionRef.current)) {
        e.preventDefault()
        nextDirectionRef.current = newDir
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [gameState, startGame])

  // ─── Initial draw ──────────────────────────────────────────────
  useEffect(() => {
    draw(snake, food, bonusFood)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950">
      {/* Header */}
      <header className="w-full px-4 py-4 sm:py-5">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Snake Game
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {highScore > 0 && (
              <Badge
                variant="secondary"
                className="gap-1.5 px-3 py-1 text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              >
                <Trophy className="h-3.5 w-3.5" />
                {highScore}
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-start justify-center px-4 pb-4">
        <div className="max-w-2xl w-full flex flex-col items-center gap-4 sm:gap-5">
          {/* Score Bar */}
          <div className="w-full flex items-center justify-between max-w-[480px]">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Score</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {score}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Length</span>
              <span className="text-2xl font-bold text-gray-700 dark:text-gray-300 tabular-nums">
                {snake.length}
              </span>
            </div>
          </div>

          {/* Game Canvas */}
          <Card className="overflow-hidden border-2 border-emerald-200 dark:border-emerald-800 shadow-lg shadow-emerald-100/50 dark:shadow-emerald-900/30">
            <CardContent className="p-0 relative">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="block"
                style={{ maxWidth: '100%', height: 'auto' }}
              />

              {/* Overlay - Idle */}
              {gameState === 'idle' && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-white mb-2">🐍 Snake</h2>
                    <p className="text-white/80 text-sm">Use arrow keys or WASD to control</p>
                  </div>
                  <Button
                    onClick={startGame}
                    size="lg"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 px-8 text-lg"
                  >
                    <Play className="h-5 w-5" />
                    Start Game
                  </Button>
                </div>
              )}

              {/* Overlay - Game Over */}
              {gameState === 'gameover' && (
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="text-center">
                    <h2 className="text-3xl font-bold text-red-400 mb-1">Game Over</h2>
                    <p className="text-white/90 text-lg">
                      Score: <span className="font-bold text-emerald-400">{score}</span>
                    </p>
                    {score >= highScore && score > 0 && (
                      <p className="text-amber-400 text-sm font-medium mt-1 flex items-center justify-center gap-1">
                        <Trophy className="h-4 w-4" /> New High Score!
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={startGame}
                    size="lg"
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 px-8"
                  >
                    <RotateCcw className="h-5 w-5" />
                    Play Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Controls */}
          <div className="flex flex-col items-center gap-3 w-full max-w-[480px]">
            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {gameState === 'playing' && (
                <Button
                  onClick={() => setGameState('paused')}
                  variant="outline"
                  className="gap-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                >
                  Pause
                </Button>
              )}
              {gameState === 'paused' && (
                <Button
                  onClick={() => setGameState('playing')}
                  variant="outline"
                  className="gap-2 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                >
                  <Play className="h-4 w-4" />
                  Resume
                </Button>
              )}
              {(gameState === 'playing' || gameState === 'paused') && (
                <Button
                  onClick={startGame}
                  variant="outline"
                  className="gap-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  Restart
                </Button>
              )}
            </div>

            {/* Mobile D-Pad */}
            <div className="grid grid-cols-3 gap-1.5 sm:hidden mt-1">
              <div />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 border-emerald-200 dark:border-emerald-800 active:bg-emerald-100 dark:active:bg-emerald-900/50"
                onTouchStart={(e) => {
                  e.preventDefault()
                  handleDirection('UP')
                }}
              >
                <ChevronUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </Button>
              <div />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 border-emerald-200 dark:border-emerald-800 active:bg-emerald-100 dark:active:bg-emerald-900/50"
                onTouchStart={(e) => {
                  e.preventDefault()
                  handleDirection('LEFT')
                }}
              >
                <ChevronLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </Button>
              <div className="h-12 w-12 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-emerald-200 dark:bg-emerald-800" />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 border-emerald-200 dark:border-emerald-800 active:bg-emerald-100 dark:active:bg-emerald-900/50"
                onTouchStart={(e) => {
                  e.preventDefault()
                  handleDirection('RIGHT')
                }}
              >
                <ChevronRight className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </Button>
              <div />
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 border-emerald-200 dark:border-emerald-800 active:bg-emerald-100 dark:active:bg-emerald-900/50"
                onTouchStart={(e) => {
                  e.preventDefault()
                  handleDirection('DOWN')
                }}
              >
                <ChevronDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </Button>
              <div />
            </div>

            {/* Instructions */}
            <div className="text-center text-xs text-gray-400 dark:text-gray-500 mt-1 space-y-0.5">
              <p>
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">
                  ↑↓←→
                </kbd>{' '}
                or{' '}
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-mono">
                  WASD
                </kbd>{' '}
                to move
              </p>
              <p>
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 align-middle" />
                Apple = 10 pts
                <span className="mx-2">·</span>
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1 align-middle" />
                Star = 30 pts
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-4 py-3 text-center text-xs text-gray-400 dark:text-gray-600">
        Built with Next.js & shadcn/ui · Snake Game
      </footer>
    </div>
  )
}
