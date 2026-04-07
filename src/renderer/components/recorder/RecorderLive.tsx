import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BeatNote, GameId, InputState } from '@shared/types';
import { GameRegistry } from '@shared/registry/GameRegistry';
import { useInput, KeyMap } from '../../hooks/useInput';
import { AudioEngine } from '../../context/AudioEngine';
import { BeatMapRenderer } from '../BeatMapRenderer';
import { InputHistory, InputHistoryEntry, getDirectionNumpad } from '../InputHistory';
import type { InputDevice } from '@shared/types';

const SCROLL_SPEED = 0.3;

interface RecorderLiveProps {
  gameId: GameId;
  keyMap: KeyMap;
  inputDevice: InputDevice;
  audioUrl: string | null;
  bpm: number;
  metronomeEnabled: boolean;
  onStop: (notes: BeatNote[], durationMs: number) => void;
}

function scheduleClick(ctx: AudioContext, delaySec: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 1000;
  osc.type = 'sine';
  const t = ctx.currentTime + delaySec;
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  osc.start(t);
  osc.stop(t + 0.05);
}

export const RecorderLive: React.FC<RecorderLiveProps> = ({
  gameId, keyMap, inputDevice, audioUrl, bpm, metronomeEnabled, onStop,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLanes, setActiveLanes] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<BeatNote[]>([]);
  const [inputHistory, setInputHistory] = useState<InputHistoryEntry[]>([]);

  const notesRef = useRef<BeatNote[]>([]);
  const activeNotesRef = useRef<Map<number, number>>(new Map()); // lane -> pressTime
  const prevStateRef = useRef<InputState | null>(null);
  const audioRef = useRef<AudioEngine>(new AudioEngine());
  const metroCtxRef = useRef<AudioContext | null>(null);
  const lastBeatRef = useRef(-1);
  const historyIdRef = useRef(0);
  const runningRef = useRef(true);

  const input = useInput(keyMap, inputDevice);
  const game = GameRegistry.getGame(gameId);

  // Start audio on mount
  useEffect(() => {
    const audio = audioRef.current;
    const start = async () => {
      await audio.init();
      if (audioUrl) {
        try {
          await audio.loadAudio(audioUrl);
        } catch { /* no audio, timer-only */ }
      }
      audio.play();
    };
    start();

    if (metronomeEnabled && bpm > 0) {
      metroCtxRef.current = new AudioContext();
    }

    return () => {
      audio.stop();
      audio.destroy();
      metroCtxRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop handler
  const handleStop = useCallback(() => {
    runningRef.current = false;
    const audio = audioRef.current;
    const duration = audio.currentTime();
    audio.stop();

    // Close any still-held notes
    const finalNotes = [...notesRef.current];
    activeNotesRef.current.forEach((startTime, lane) => {
      finalNotes.push({ time: startTime, endTime: duration, lane });
    });
    activeNotesRef.current.clear();

    onStop(finalNotes, duration);
  }, [onStop]);

  // Escape to stop
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleStop();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleStop]);

  // Main recording loop
  useEffect(() => {
    let rafId: number;

    const tick = () => {
      if (!runningRef.current) return;

      const audio = audioRef.current;
      const time = audio.isPlaying ? audio.currentTime() : 0;
      setCurrentTime(time);

      const state = input.getState();
      const prevState = prevStateRef.current;
      const lanes = new Set<number>();
      const justPressed: number[] = [];

      game.laneInputMap.forEach((field, laneIdx) => {
        const isPressed = state[field];
        const wasPressed = prevState ? prevState[field] : false;

        if (isPressed) lanes.add(laneIdx);

        if (isPressed && !wasPressed) {
          // Key down: start note
          activeNotesRef.current.set(laneIdx, time);
          justPressed.push(laneIdx);
        } else if (!isPressed && wasPressed) {
          // Key up: close note
          const startTime = activeNotesRef.current.get(laneIdx);
          if (startTime !== undefined) {
            const note: BeatNote = {
              time: startTime,
              endTime: Math.max(time, startTime + 17), // min 1 frame
              lane: laneIdx,
            };
            notesRef.current = [...notesRef.current, note];
            setNotes([...notesRef.current]);
            activeNotesRef.current.delete(laneIdx);
          }
        }
      });

      prevStateRef.current = { ...state };
      setActiveLanes(lanes);

      // Input history
      if (justPressed.length > 0) {
        const dir = getDirectionNumpad(state);
        const buttons: string[] = [];
        for (const laneIdx of justPressed) {
          if (laneIdx >= 4) buttons.push(game.laneLabels[laneIdx]);
        }
        const entry: InputHistoryEntry = {
          id: historyIdRef.current++,
          direction: dir,
          buttons,
          timestamp: time,
        };
        setInputHistory(prev => [...prev.slice(-40), entry]);
      }

      // Metronome
      if (metronomeEnabled && bpm > 0 && metroCtxRef.current) {
        const beatMs = 60000 / bpm;
        const nextBeat = Math.ceil(time / beatMs) * beatMs;
        if (nextBeat > lastBeatRef.current && nextBeat - time < 100) {
          scheduleClick(metroCtxRef.current, (nextBeat - time) / 1000);
          lastBeatRef.current = nextBeat;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = Math.floor(currentTime / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: '#0a0a1a', position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch', height: 600 }}>
        <BeatMapRenderer
          notes={notes}
          currentTime={currentTime}
          scrollSpeed={SCROLL_SPEED}
          resolvedNotes={new Map()}
          hitFlash={null}
          fps={60}
          laneLabels={game.laneLabels}
          activeLanes={activeLanes}
        />
        <InputHistory entries={inputHistory} />
      </div>

      {/* Recording indicator */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 12,
        fontFamily: 'monospace', fontSize: 16,
      }}>
        <span style={{
          display: 'inline-block', width: 12, height: 12, borderRadius: '50%',
          background: '#ff3344',
          animation: 'pulse 1s infinite',
        }} />
        <span style={{ color: '#ff3344' }}>REC</span>
        <span style={{ color: '#888' }}>
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
        <span style={{ color: '#555', fontSize: 12 }}>
          {notes.length} notes
        </span>
      </div>

      {/* Stop button */}
      <div style={{
        position: 'absolute', top: 12, right: 16,
      }}>
        <button onClick={handleStop} style={{
          padding: '8px 20px', fontSize: 13, fontFamily: 'monospace',
          background: '#1a1a2e', color: '#ff4444', border: '1px solid #ff4444',
          borderRadius: 4, cursor: 'pointer',
        }}>
          Stop (Esc)
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};
