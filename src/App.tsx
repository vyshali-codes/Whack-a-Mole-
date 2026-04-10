import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Timer as TimerIcon, 
  Play, 
  RotateCcw, 
  Target,
  Zap,
  Pause,
  CirclePlay
} from 'lucide-react';

const GRID_SIZE = 9; // 3x3
const INITIAL_TIME = 30;
const BASE_MOLE_TIME = 1000;
const MIN_MOLE_TIME = 400;

type MoleType = 'normal' | 'golden' | 'stubborn';

interface ActiveMole {
  index: number;
  type: MoleType;
  hitsRemaining: number;
  variant: number; // For animation variation
  isWhacked?: boolean;
}

export default function App() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle');
  const [isPaused, setIsPaused] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [activeMole, setActiveMole] = useState<ActiveMole | null>(null);
  const [whackedMole, setWhackedMole] = useState<{ index: number; type: MoleType } | null>(null);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('whack-a-mole-highscore');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [difficulty, setDifficulty] = useState(1);

  const moleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const scoreRef = useRef(score);
  const activeMoleRef = useRef(activeMole);
  const highScoreRef = useRef(highScore);

  // Keep refs in sync with state for use in stable callbacks
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    activeMoleRef.current = activeMole;
  }, [activeMole]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  // Sound effects (using standard web audio or silent if not available)
  const playSound = (type: 'hit' | 'miss' | 'start' | 'over' | 'golden') => {
    console.log(`Playing sound: ${type}`);
  };

  const spawnMole = useCallback(() => {
    if (gameState !== 'playing' || isPaused) return;

    // Clear existing timeout
    if (moleTimeoutRef.current) clearTimeout(moleTimeoutRef.current);

    // Pick a random hole that isn't the current one
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * GRID_SIZE);
    } while (activeMoleRef.current && nextIndex === activeMoleRef.current.index);

    // Determine mole type
    const rand = Math.random();
    let type: MoleType = 'normal';
    let hitsRemaining = 1;

    if (rand > 0.9) {
      type = 'golden';
    } else if (rand > 0.75) {
      type = 'stubborn';
      hitsRemaining = 2;
    }

    setActiveMole({
      index: nextIndex,
      type,
      hitsRemaining,
      variant: Math.random()
    });

    // Calculate how long the mole stays up
    const moleTime = Math.max(
      MIN_MOLE_TIME,
      BASE_MOLE_TIME - (Math.floor(scoreRef.current / 5) * 50)
    );

    moleTimeoutRef.current = setTimeout(() => {
      setActiveMole(null);
      // Wait a bit before spawning next one
      moleTimeoutRef.current = setTimeout(spawnMole, 200);
    }, moleTime);
  }, [gameState]);

  const startGame = () => {
    setScore(0);
    setTimeLeft(INITIAL_TIME);
    setGameState('playing');
    setIsPaused(false);
    setDifficulty(1);
    playSound('start');
  };

  const togglePause = () => {
    if (gameState !== 'playing') return;
    setIsPaused(prev => {
      const newPaused = !prev;
      if (newPaused) {
        setActiveMole(null);
        if (moleTimeoutRef.current) clearTimeout(moleTimeoutRef.current);
      }
      return newPaused;
    });
  };

  const endGame = useCallback(() => {
    setGameState('gameover');
    setActiveMole(null);
    if (moleTimeoutRef.current) clearTimeout(moleTimeoutRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    
    const currentScore = scoreRef.current;
    if (currentScore > highScoreRef.current) {
      setHighScore(currentScore);
      localStorage.setItem('whack-a-mole-highscore', currentScore.toString());
    }
    playSound('over');
  }, []); // Stable endGame

  const handleWhack = (index: number) => {
    if (gameState !== 'playing' || isPaused || !activeMole || activeMole.index !== index) {
      if (gameState === 'playing' && !isPaused) playSound('miss');
      return;
    }

    const newHitsRemaining = activeMole.hitsRemaining - 1;

    if (newHitsRemaining <= 0) {
      const points = activeMole.type === 'golden' ? 5 : 1;
      setScore(prev => prev + points);
      setWhackedMole({ index, type: activeMole.type });
      
      // Mark as whacked to trigger animation before removal
      setActiveMole(prev => prev ? { ...prev, isWhacked: true } : null);
      playSound(activeMole.type === 'golden' ? 'golden' : 'hit');
      
      // Clear whacked effect after animation
      setTimeout(() => setWhackedMole(null), 400);

      // Remove mole after a short delay to let whack animation play
      if (moleTimeoutRef.current) clearTimeout(moleTimeoutRef.current);
      setTimeout(() => {
        setActiveMole(null);
        setTimeout(spawnMole, 100);
      }, 150);
    } else {
      // Stubborn mole hit but not out
      setActiveMole(prev => prev ? { ...prev, hitsRemaining: newHitsRemaining } : null);
      playSound('hit');
    }
  };

  // Game loop for timer
  useEffect(() => {
    if (gameState === 'playing' && !isPaused) {
      gameTimerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      spawnMole();
    }

    return () => {
      if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      if (moleTimeoutRef.current) clearTimeout(moleTimeoutRef.current);
    };
  }, [gameState, isPaused, spawnMole, endGame]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 font-sans select-none overflow-hidden">
      {/* Header Info */}
      <div className="w-full max-w-md flex justify-between items-center mb-8">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <Trophy className="w-6 h-6" />
            <span>{score}</span>
          </div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Current Score
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className={`flex items-center gap-2 font-black text-4xl transition-colors ${timeLeft < 10 ? 'text-destructive animate-pulse' : 'text-foreground'}`}>
            <TimerIcon className="w-8 h-8" />
            <span>{timeLeft}s</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2 text-secondary-foreground font-bold text-xl">
            <Badge variant="secondary" className="text-lg px-3 py-0.5 rounded-full">
              HI: {highScore}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Best Ever
          </div>
        </div>
      </div>

      {/* Game Board */}
      <div className="relative w-full max-w-md">
        <Card className="w-full aspect-square bg-secondary border-8 border-secondary-foreground/20 shadow-2xl overflow-hidden rounded-[2rem]">
          <CardContent className="p-6 h-full grid grid-cols-3 gap-4">
            {Array.from({ length: GRID_SIZE }).map((_, i) => (
              <div 
                key={i} 
                className="relative aspect-square rounded-full bg-secondary-foreground/10 inner-shadow overflow-hidden cursor-crosshair group"
                onClick={() => handleWhack(i)}
              >
                {/* Hole shadow */}
                <div className="absolute inset-0 bg-black/20 rounded-full blur-sm transform scale-90" />
                
                {/* Mole */}
                <AnimatePresence>
                  {activeMole?.index === i && (
                    <motion.div
                      key={`mole-${i}`}
                      initial={{ 
                        y: activeMole.variant > 0.8 ? '120%' : '100%', 
                        scale: 0.8,
                        x: activeMole.variant > 0.7 ? -10 : activeMole.variant < 0.3 ? 10 : 0 
                      }}
                      animate={{ 
                        y: activeMole.isWhacked ? '30%' : (activeMole.variant > 0.5 ? '10%' : '20%'), 
                        scale: activeMole.isWhacked ? [1, 1.2, 0.9] : 1,
                        rotate: activeMole.isWhacked ? [0, -10, 10, 0] : (activeMole.type === 'stubborn' ? (activeMole.hitsRemaining === 1 ? [0, -5, 5, 0] : 0) : 0),
                        filter: activeMole.isWhacked ? 'brightness(1.5) contrast(1.2)' : 'brightness(1) contrast(1)'
                      }}
                      exit={{ 
                        y: '100%', 
                        scale: 0.8,
                        transition: { duration: 0.25, ease: "backIn" } 
                      }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: activeMole.isWhacked ? 500 : (400 + (activeMole.variant * 100)), 
                        damping: activeMole.isWhacked ? 15 : (25 + (activeMole.variant * 10)),
                        rotate: { type: 'tween', duration: 0.2 },
                        scale: activeMole.isWhacked ? { type: 'tween', duration: 0.2 } : { type: 'spring' }
                      }}
                      className="absolute inset-x-0 bottom-0 h-[85%] flex flex-col items-center justify-end pointer-events-none"
                    >
                      {/* Mole Body */}
                      <div className={`w-[80%] h-[90%] rounded-t-full relative shadow-lg border-4 border-accent-foreground/10 transition-colors duration-300
                        ${activeMole.type === 'golden' ? 'bg-yellow-400' : activeMole.type === 'stubborn' ? 'bg-slate-600' : 'bg-accent'}
                      `}>
                        {/* Eyes */}
                        <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                          <div className={`w-1.5 h-1.5 bg-black rounded-full transition-all ${activeMole.isWhacked ? 'scale-150' : ''}`} />
                        </div>
                        <div className="absolute top-1/4 right-1/4 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                          <div className={`w-1.5 h-1.5 bg-black rounded-full transition-all ${activeMole.isWhacked ? 'scale-150' : ''}`} />
                        </div>
                        {/* Nose */}
                        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 w-4 h-2.5 bg-pink-400 rounded-full" />
                        
                        {/* Stubborn Mole Helmet */}
                        {activeMole.type === 'stubborn' && (
                          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-full h-1/3 bg-slate-400 rounded-t-full opacity-50" />
                        )}

                        {/* Golden Mole Sparkle */}
                        {activeMole.type === 'golden' && !activeMole.isWhacked && (
                          <motion.div 
                            animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="absolute -top-2 -right-2 text-yellow-200"
                          >
                            ✨
                          </motion.div>
                        )}

                        {/* Whack Flash Overlay */}
                        <AnimatePresence>
                          {activeMole.isWhacked && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 0.8, 0] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="absolute inset-0 bg-white rounded-t-full z-10"
                            />
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Whack Effect - Separate AnimatePresence for independent lifecycle */}
                <AnimatePresence>
                  {whackedMole?.index === i && (
                    <motion.div
                      key={`whack-${i}`}
                      initial={{ scale: 0.5, opacity: 0, y: 0 }}
                      animate={{ scale: [1, 1.2, 1], opacity: [1, 1, 0], y: -20 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                    >
                      <div className="text-3xl font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                        {whackedMole.type === 'golden' ? '+5!' : 'POW!'}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Whack Effect (Visual feedback) */}
                <div className="absolute inset-0 pointer-events-none group-active:bg-white/10 transition-colors" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Game Over Overlay */}
        <AnimatePresence>
          {gameState === 'gameover' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md rounded-[2rem]"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                className="bg-card p-6 rounded-3xl shadow-2xl border-4 border-primary text-center w-full max-w-[280px]"
              >
                <Trophy className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
                <h2 className="text-3xl font-black text-foreground mb-1 leading-tight">GAME OVER!</h2>
                <div className="space-y-3 mb-6">
                  <div>
                    <p className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold">Final Score</p>
                    <p className="text-5xl font-black text-primary leading-none">{score}</p>
                  </div>
                  {score >= highScore && score > 0 && (
                    <Badge className="bg-yellow-500 text-white animate-bounce text-xs px-3 py-0.5">NEW RECORD!</Badge>
                  )}
                  <div className="pt-3 border-t border-border">
                    <p className="text-muted-foreground text-[11px]">Best Score: <span className="font-bold text-foreground">{highScore}</span></p>
                  </div>
                </div>
                <Button 
                  size="lg" 
                  onClick={startGame}
                  className="w-full rounded-xl py-6 text-xl font-black shadow-lg hover:scale-105 transition-transform bg-primary hover:bg-primary/90"
                >
                  <RotateCcw className="w-6 h-6 mr-2" />
                  RETRY
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pause Overlay */}
        <AnimatePresence>
          {isPaused && gameState === 'playing' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-background/60 backdrop-blur-sm rounded-[2rem]"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                className="bg-card p-8 rounded-3xl shadow-2xl border-4 border-primary text-center w-full max-w-[280px]"
              >
                <Pause className="w-12 h-12 text-primary mx-auto mb-4" />
                <h2 className="text-3xl font-black text-foreground mb-6 leading-tight">PAUSED</h2>
                <Button 
                  size="lg" 
                  onClick={togglePause}
                  className="w-full rounded-xl py-8 text-2xl font-black shadow-lg hover:scale-105 transition-transform bg-primary hover:bg-primary/90"
                >
                  <CirclePlay className="w-8 h-8 mr-2" />
                  RESUME
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <div className="mt-8 max-w-md w-full bg-secondary/30 p-4 rounded-2xl border border-secondary-foreground/10">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          How to Play
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center text-center p-2 bg-background/50 rounded-xl border border-secondary-foreground/5">
            <div className="w-8 h-8 bg-accent rounded-full mb-2" />
            <p className="text-[10px] font-bold">NORMAL</p>
            <p className="text-[9px] text-muted-foreground">1 Click = 1pt</p>
          </div>
          <div className="flex flex-col items-center text-center p-2 bg-background/50 rounded-xl border border-secondary-foreground/5">
            <div className="w-8 h-8 bg-yellow-400 rounded-full mb-2" />
            <p className="text-[10px] font-bold">GOLDEN</p>
            <p className="text-[9px] text-muted-foreground">1 Click = 5pt</p>
          </div>
          <div className="flex flex-col items-center text-center p-2 bg-background/50 rounded-xl border border-secondary-foreground/5">
            <div className="w-8 h-8 bg-slate-600 rounded-full mb-2" />
            <p className="text-[10px] font-bold">STUBBORN</p>
            <p className="text-[9px] text-muted-foreground">2 Clicks = 1pt</p>
          </div>
        </div>
      </div>

      {/* Controls / Overlays */}
      <div className="mt-8 flex gap-4">
        {gameState === 'idle' && (
          <Button 
            size="lg" 
            onClick={startGame}
            className="rounded-full px-8 py-8 text-2xl font-black shadow-xl hover:scale-105 transition-transform bg-primary hover:bg-primary/90"
          >
            <Play className="w-8 h-8 mr-2 fill-current" />
            START GAME
          </Button>
        )}

        {gameState === 'playing' && (
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="text-lg font-bold px-4 py-2 border-2 border-primary text-primary bg-primary/5">
                <Zap className="w-5 h-5 mr-2 fill-primary" />
                SPEED: {Math.floor(score / 5) + 1}x
             </Badge>
             <div className="flex gap-2">
               <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={togglePause}
                  className="rounded-full w-12 h-12 text-primary hover:bg-primary/10"
                >
                  {isPaused ? <CirclePlay className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={endGame}
                  className="rounded-full w-12 h-12 text-destructive hover:bg-destructive/10"
                >
                  <RotateCcw className="w-6 h-6" />
                </Button>
             </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .inner-shadow {
          box-shadow: inset 0 4px 12px rgba(0,0,0,0.3);
        }
      `}} />
    </div>
  );
}
