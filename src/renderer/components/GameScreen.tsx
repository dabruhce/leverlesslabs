import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BeatMap, ScoreState, HitGrade, InputDevice, InputState, GamepadButtonMap, createInitialScoreState, GRADE_WINDOWS, JF_GRADE_WINDOWS } from '@shared/types';
import { GameRegistry } from '@shared/registry/GameRegistry';
import { AudioEngine } from '../context/AudioEngine';
import { useInput, KeyMap } from '../hooks/useInput';
import { BeatMapRenderer } from './BeatMapRenderer';
import { HUD } from './HUD';
import { Countdown } from './Countdown';
import { DebugOverlay } from './DebugOverlay';
import { InputHistory, InputHistoryEntry, getDirectionNumpad } from './InputHistory';
import { detectButtonBuffer } from '@shared/parsers/detectButtonBuffer';

const MISS_WINDOW = GRADE_WINDOWS.Sloppy;
const SCROLL_SPEED = 0.3;

interface GameScreenProps {
  chart: BeatMap;
  audioUrl: string | null;
  keyMap: KeyMap;
  inputDevice: InputDevice;
  gamepadMap?: GamepadButtonMap;
  onFinish: (score: ScoreState, loopCount: number) => void;
  onBack: () => void;
  debugMode: boolean;
}

type PlayState = 'idle' | 'countdown' | 'playing' | 'paused' | 'finished';

function gradeFromDelta(absDelta: number, justFrame: boolean = false): HitGrade | null {
  const w = justFrame ? JF_GRADE_WINDOWS : GRADE_WINDOWS;
  if (absDelta <= w.Perfect) return 'Perfect';
  if (absDelta <= w.Close) return 'Close';
  if (absDelta <= w.Late) return 'Late';
  if (absDelta <= w.Sloppy) return 'Sloppy';
  return null;
}

export const GameScreen: React.FC<GameScreenProps> = ({ chart, audioUrl, keyMap, inputDevice, gamepadMap, onFinish, onBack, debugMode }) => {
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [looping, setLooping] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState<ScoreState>(createInitialScoreState());
  const [resolvedNotes, setResolvedNotes] = useState<Map<number, HitGrade>>(new Map());
  const [hitFlash, setHitFlash] = useState<{ grade: HitGrade; time: number } | null>(null);
  const [missFlash, setMissFlash] = useState(false);
  const [activeLanes, setActiveLanes] = useState<Set<number>>(new Set());
  const [timingPopup, setTimingPopup] = useState<{ delta: number; grade: HitGrade; time: number } | null>(null);
  const [inputHistory, setInputHistory] = useState<InputHistoryEntry[]>([]);
  const [justFrameFlash, setJustFrameFlash] = useState<number | null>(null); // songTime when JF was hit

  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const resolvedRef = useRef<Set<number>>(new Set());
  const prevStateRef = useRef<InputState | null>(null);
  const loopCountRef = useRef(1);
  const historyIdRef = useRef(0);
  const loopingRef = useRef(looping);
  loopingRef.current = looping;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  // Track which game-loop frame each JF note was resolved on
  // Key: noteIdx, Value: the RAF tick number when resolved
  const jfResolvedTickRef = useRef<Map<number, number>>(new Map());
  const tickCountRef = useRef(0);

  // Precompute JF groups: notes that share the same time+endTime and are all justFrame
  const jfGroups = useRef<Map<string, number[]>>(new Map());
  useEffect(() => {
    const groups = new Map<string, number[]>();
    chart.notes.forEach((note, idx) => {
      if (!note.justFrame) return;
      const key = `${note.time}-${note.endTime}`;
      const list = groups.get(key) ?? [];
      list.push(idx);
      groups.set(key, list);
    });
    jfGroups.current = groups;
  }, [chart]);
  const input = useInput(keyMap, inputDevice, gamepadMap);

  const game = GameRegistry.getGame(chart.game);

  // JF success sound via Web Audio
  const playJFSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      // Quick rising tone: electric crack sound
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
      // Second harmonic for richness
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1200, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 0.04);
      gain2.gain.setValueAtTime(0.1, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.12);
    } catch { /* audio not available */ }
  }, []);

  const resetRun = useCallback(() => {
    resolvedRef.current = new Set();
    prevStateRef.current = null;
    setCurrentTime(0);
    setScore(createInitialScoreState());
    setResolvedNotes(new Map());
    setHitFlash(null);
    setMissFlash(false);
    setTimingPopup(null);
    setActiveLanes(new Set());
    setInputHistory([]);
    setJustFrameFlash(null);
    historyIdRef.current = 0;
    jfResolvedTickRef.current = new Map();
    tickCountRef.current = 0;
  }, []);

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const startAudio = useCallback(() => {
    const audio = audioRef.current;
    audio.init().then(() => {
      if (audioUrl) {
        return audio.loadAudio(audioUrl);
      }
      throw new Error('No audio URL');
    }).then(() => {
      audio.setVolume(volumeRef.current);
      audio.play();
    }).catch(() => {
      audio.play(0); // timer-only mode
    });
  }, [audioUrl]);

  const handlePlay = useCallback(() => {
    resetRun();
    loopCountRef.current = 1;
    setPlayState('countdown');
  }, [resetRun]);

  // Save session if there's data (for stopping mid-run or after loops)
  const saveIfNeeded = useCallback((score: ScoreState) => {
    const total = score.perfects + score.closes + score.lates + score.sloppies + score.misses;
    if (total > 0) {
      onFinish(score, loopCountRef.current);
    }
  }, [onFinish]);

  const handleCountdownComplete = useCallback(() => {
    setPlayState('playing');
    startAudio();
  }, [startAudio]);

  const handlePlayPause = useCallback(() => {
    if (playState === 'paused') {
      audioRef.current.resume();
      setPlayState('playing');
    } else if (playState === 'playing') {
      audioRef.current.pause();
      setPlayState('paused');
    }
  }, [playState]);

  const handleVolumeChange = useCallback((v: number) => {
    setVolume(v);
    audioRef.current.setVolume(v);
  }, []);

  const handleStop = useCallback(() => {
    audioRef.current.stop();
    onBack();
  }, [onBack]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (playState === 'idle' || playState === 'finished' || playState === 'countdown') handleStop();
        else handlePlayPause();
      }
      if (e.key === 'Enter' && playState === 'idle') {
        handlePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playState, handlePlay, handlePlayPause, handleStop]);

  // Gamepad start button (button 9 = Start on most controllers)
  useEffect(() => {
    if (playState !== 'idle') return;
    let rafId: number;
    const poll = () => {
      const gamepads = navigator.getGamepads?.() ?? [];
      for (const gp of gamepads) {
        if (!gp) continue;
        if (gp.buttons[9]?.pressed) {
          handlePlay();
          return;
        }
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [playState, handlePlay]);

  const resolveNote = useCallback((idx: number, grade: HitGrade, signedDelta: number, time: number) => {
    resolvedRef.current.add(idx);
    setResolvedNotes(prev => new Map(prev).set(idx, grade));

    const breaksCombo = grade === 'Sloppy';
    setScore(prev => {
      const newCombo = breaksCombo ? 0 : prev.combo + 1;
      return {
        perfects: prev.perfects + (grade === 'Perfect' ? 1 : 0),
        closes: prev.closes + (grade === 'Close' ? 1 : 0),
        lates: prev.lates + (grade === 'Late' ? 1 : 0),
        sloppies: prev.sloppies + (grade === 'Sloppy' ? 1 : 0),
        misses: prev.misses,
        combo: newCombo,
        maxCombo: Math.max(prev.maxCombo, newCombo),
      };
    });

    setHitFlash({ grade, time });
    setTimingPopup({ delta: signedDelta, grade, time });

    // Track JF group completion
    const note = chart.notes[idx];
    if (note?.justFrame) {
      jfResolvedTickRef.current.set(idx, tickCountRef.current);
      // Check if all notes in this JF group are resolved on the same tick
      const key = `${note.time}-${note.endTime}`;
      const group = jfGroups.current.get(key);
      if (group && group.every(i => resolvedRef.current.has(i))) {
        const ticks = group.map(i => jfResolvedTickRef.current.get(i)!);
        const allSameTick = ticks.every(t => t === ticks[0]);
        if (allSameTick) {
          playJFSound();
          setJustFrameFlash(time);
        }
      }
    }
  }, [chart.notes, playJFSound]);

  // Main game loop — runs as a continuous RAF, no deps that change every frame
  useEffect(() => {
    if (playState !== 'playing') return;

    let rafId: number;
    let running = true;

    const tick = () => {
      if (!running) return;
      tickCountRef.current++;

      const audio = audioRef.current;
      const time = audio.isPlaying ? audio.currentTime() : 0;
      setCurrentTime(time);

      const state = input.getState();
      const prevState = prevStateRef.current;
      const lanes = new Set<number>();
      const justPressed: number[] = [];

      game.laneInputMap.forEach((field, laneIdx) => {
        if (state[field]) lanes.add(laneIdx);
        if (state[field] && prevState && !prevState[field]) {
          justPressed.push(laneIdx);
        }
      });
      if (!prevState) {
        game.laneInputMap.forEach((field, laneIdx) => {
          if (state[field]) justPressed.push(laneIdx);
        });
      }
      prevStateRef.current = { ...state };
      setActiveLanes(lanes);

      // Build input history entry on any new press
      if (justPressed.length > 0) {
        const dir = getDirectionNumpad(state);
        const buttons: string[] = [];
        for (const laneIdx of justPressed) {
          if (laneIdx >= 4) buttons.push(game.laneLabels[laneIdx]);
        }

        // Detect button buffering (held buttons combining with new presses)
        const bufferResult = chart.game === 'tekken'
          ? detectButtonBuffer(prevState, state)
          : null;

        const entry: InputHistoryEntry = {
          id: historyIdRef.current++,
          direction: dir,
          buttons,
          timestamp: time,
          bufferedInput: bufferResult?.effectiveNotation,
        };
        setInputHistory(prev => [...prev.slice(-40), entry]);
      }

      // Match just-pressed inputs to nearest unresolved notes
      const songTime = time;
      for (const laneIdx of justPressed) {
        let bestIdx = -1;
        let bestAbsDelta = Infinity;
        let bestSignedDelta = 0;

        chart.notes.forEach((note, idx) => {
          if (resolvedRef.current.has(idx)) return;
          if (note.lane !== laneIdx) return;
          let signed: number;
          if (songTime >= note.time && songTime <= note.endTime) {
            signed = 0;
          } else if (songTime < note.time) {
            signed = songTime - note.time;
          } else {
            signed = songTime - note.endTime;
          }
          const abs = Math.abs(signed);
          if (abs < bestAbsDelta) {
            bestAbsDelta = abs;
            bestSignedDelta = signed;
            bestIdx = idx;
          }
        });

        if (bestIdx === -1) continue;
        const grade = gradeFromDelta(bestAbsDelta, !!chart.notes[bestIdx].justFrame);
        if (!grade) continue;
        resolveNote(bestIdx, grade, bestSignedDelta, time);
      }

      // Check for missed notes
      chart.notes.forEach((note, idx) => {
        if (resolvedRef.current.has(idx)) return;
        const missW = note.justFrame ? JF_GRADE_WINDOWS.Sloppy : MISS_WINDOW;
        if (time > note.endTime + missW) {
          resolvedRef.current.add(idx);
          setResolvedNotes(prev => new Map(prev).set(idx, 'Miss'));
          setScore(prev => ({ ...prev, misses: prev.misses + 1, combo: 0 }));
          setMissFlash(true);
          setTimeout(() => setMissFlash(false), 400);
          setHitFlash({ grade: 'Miss', time });
        }
      });

      // Chart complete
      if (resolvedRef.current.size >= chart.notes.length && chart.notes.length > 0) {
        audio.stop();
        if (loopingRef.current) {
          loopCountRef.current++;
          resolvedRef.current = new Set();
          prevStateRef.current = null;
          jfResolvedTickRef.current = new Map();
          setCurrentTime(0);
          setResolvedNotes(new Map());
          setHitFlash(null);
          setTimingPopup(null);
          setJustFrameFlash(null);
          // Restart audio, then keep the loop going
          const a = audioRef.current;
          a.init().then(() => {
            if (audioUrl) return a.loadAudio(audioUrl);
            throw new Error('No audio');
          }).then(() => { a.setVolume(volumeRef.current); a.play(); }).catch(() => a.play(0));
          // Keep ticking while audio restarts
        } else {
          running = false;
          setPlayState('finished');
          const loops = loopCountRef.current;
          setScore(prev => {
            setTimeout(() => onFinishRef.current(prev, loops), 100);
            return prev;
          });
          return;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(rafId); };
  // Only restart the loop when playState changes or chart changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playState]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio.destroy();
  }, []);

  const isRunning = playState === 'playing' || playState === 'paused';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#0a0a1a', position: 'relative',
    }}>
      {playState === 'countdown' && <Countdown onComplete={handleCountdownComplete} />}
      <div style={{ display: 'flex', alignItems: 'stretch', height: 600 }}>
        <BeatMapRenderer
          notes={chart.notes}
          currentTime={currentTime}
          scrollSpeed={SCROLL_SPEED}
          resolvedNotes={resolvedNotes}
          hitFlash={hitFlash}
          fps={chart.fps}
          laneLabels={game.laneLabels}
          activeLanes={activeLanes}
        />
        <InputHistory entries={inputHistory} />
      </div>
      {isRunning && <HUD score={score} showMissFlash={missFlash} />}
      {isRunning && <TimingIndicator popup={timingPopup} currentTime={currentTime} />}
      <JustFrameNotification flashTime={justFrameFlash} currentTime={currentTime} />
      <DebugOverlay getState={input.getState} visible={debugMode} />

      {/* Top bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'rgba(10,10,26,0.85)',
      }}>
        <button onClick={handleStop} style={topBtnStyle} title="Back to menu (Esc)">
          &#x2190; Back
        </button>
        <div style={{ fontFamily: 'monospace', textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: '#667' }}>
            {chart.title} &middot; {chart.fps} FPS
          </span>
          <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
            {audioUrl ? chart.audioFile : 'No audio'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Volume */}
          {audioUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginRight: 4 }}>
              <span style={{ fontSize: 10, color: '#555' }}>Vol</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                style={{ width: 60, accentColor: '#4466cc' }}
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>
          )}
          {/* Loop toggle */}
          <button
            onClick={() => setLooping(l => !l)}
            style={{
              ...topBtnStyle,
              color: looping ? '#00ff88' : '#555',
              border: looping ? '1px solid #00ff88' : '1px solid #333',
            }}
            title="Loop chart"
          >
            &#x1F501; Loop
          </button>

          {/* Play / Pause / Stop */}
          {playState === 'idle' && (
            <button onClick={handlePlay} style={{ ...topBtnStyle, color: '#0f8' }}>
              &#x25B6; Play
            </button>
          )}
          {isRunning && (
            <button onClick={handlePlayPause} style={topBtnStyle}>
              {playState === 'paused' ? '\u25B6 Resume' : '\u23F8 Pause'}
            </button>
          )}
          {isRunning && (
            <button onClick={() => { audioRef.current.stop(); setScore(prev => { saveIfNeeded(prev); return prev; }); resetRun(); setPlayState('idle'); }}
              style={{ ...topBtnStyle, color: '#f44' }}>
              \u23F9 Stop
            </button>
          )}
        </div>
      </div>

      {/* Idle overlay — prompt to press Play */}
      {playState === 'idle' && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'monospace', color: '#555', fontSize: 14, textAlign: 'center',
        }}>
          Press <b style={{ color: '#0f8' }}>Play</b> to start
        </div>
      )}

      {/* Pause overlay */}
      {playState === 'paused' && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)', zIndex: 1000, fontFamily: 'monospace',
        }}>
          <div style={{ fontSize: 48, color: '#4466cc', marginBottom: 24 }}>PAUSED</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handlePlayPause} style={pauseBtnStyle}>&#x25B6; Resume</button>
            <button onClick={() => { audioRef.current.stop(); setScore(prev => { saveIfNeeded(prev); return prev; }); resetRun(); setPlayState('idle'); }}
              style={{ ...pauseBtnStyle, background: '#333' }}>&#x23F9; Stop</button>
            <button onClick={handleStop} style={{ ...pauseBtnStyle, background: '#222', color: '#888' }}>&#x2190; Quit</button>
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 16 }}>Press Esc to resume</div>
        </div>
      )}
    </div>
  );
};

const TIMING_DISPLAY_MS = 800;
const JF_FLASH_MS = 1200;

const JustFrameNotification: React.FC<{
  flashTime: number | null;
  currentTime: number;
}> = ({ flashTime, currentTime }) => {
  if (flashTime === null) return null;
  const age = currentTime - flashTime;
  if (age > JF_FLASH_MS) return null;

  const opacity = age < 200 ? 1 : 1 - (age - 200) / (JF_FLASH_MS - 200);
  const scale = age < 100 ? 0.5 + (age / 100) * 0.5 : 1;

  return (
    <div style={{
      position: 'absolute', top: '30%', left: '50%',
      transform: `translate(-50%, -50%) scale(${scale})`,
      fontFamily: 'monospace', textAlign: 'center', opacity,
      pointerEvents: 'none', userSelect: 'none',
    }}>
      <div style={{
        fontSize: 36, fontWeight: 'bold', color: '#ff44aa',
        textShadow: '0 0 20px #ff44aa88, 0 0 40px #ff44aa44',
        letterSpacing: 4,
      }}>
        JUST FRAME!
      </div>
    </div>
  );
};

const TimingIndicator: React.FC<{
  popup: { delta: number; grade: HitGrade; time: number } | null;
  currentTime: number;
}> = ({ popup, currentTime }) => {
  if (!popup) return null;
  const age = currentTime - popup.time;
  if (age > TIMING_DISPLAY_MS) return null;

  const opacity = 1 - age / TIMING_DISPLAY_MS;
  const absDelta = Math.abs(popup.delta);
  const frames = absDelta / (1000 / 60);
  const direction = popup.delta < -2 ? 'EARLY' : popup.delta > 2 ? 'LATE' : '';
  const deltaText = frames < 0.5 ? '<1f' : `${frames.toFixed(1)}f`;

  const COLORS: Record<string, string> = {
    Perfect: '#00ff88', Close: '#44ddff', Late: '#ffdd00', Sloppy: '#ff8844', Miss: '#ff3344',
  };
  const LABELS: Record<string, string> = {
    Perfect: 'PERFECT', Close: 'CLOSE', Late: 'LATE', Sloppy: 'SLOPPY',
  };
  const color = COLORS[popup.grade] ?? '#888';

  return (
    <div style={{
      position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
      fontFamily: 'monospace', textAlign: 'center', opacity,
      pointerEvents: 'none', userSelect: 'none',
    }}>
      <div style={{ fontSize: 22, fontWeight: 'bold', color }}>{LABELS[popup.grade] ?? popup.grade}</div>
      <div style={{ fontSize: 14, color: direction === 'EARLY' ? '#88ccff' : direction === 'LATE' ? '#ff8866' : color, marginTop: 2 }}>
        {direction ? `${deltaText} ${direction}` : deltaText}
      </div>
    </div>
  );
};

const topBtnStyle: React.CSSProperties = {
  padding: '6px 14px', fontFamily: 'monospace', fontSize: 12,
  background: '#1a1a2e', color: '#aac', border: '1px solid #333',
  borderRadius: 4, cursor: 'pointer',
};

const pauseBtnStyle: React.CSSProperties = {
  padding: '12px 32px', fontSize: 16, fontFamily: 'monospace',
  background: '#2244aa', color: '#fff', border: 'none',
  borderRadius: 8, cursor: 'pointer',
};
