import React, { useState, useCallback, useRef } from 'react';
import { BeatMap, BeatNote, GameId, InputDevice, ButtonId, DirectionId } from '@shared/types';
import { Countdown } from './Countdown';
import { RecorderSetup } from './recorder/RecorderSetup';
import { RecorderLive } from './recorder/RecorderLive';
import { RecorderReview } from './recorder/RecorderReview';
import { KeyMap } from '../hooks/useInput';

type RecorderPhase = 'setup' | 'countdown' | 'recording' | 'review';

interface ChartRecorderProps {
  keyMaps: Record<GameId, Record<string, ButtonId | DirectionId>>;
  leverlessMaps: Record<GameId, Record<string, ButtonId | DirectionId>>;
  inputDevice: InputDevice;
  onSave: (chart: BeatMap) => void;
  onBack: () => void;
}

export const ChartRecorder: React.FC<ChartRecorderProps> = ({
  keyMaps, leverlessMaps, inputDevice, onSave, onBack,
}) => {
  const [phase, setPhase] = useState<RecorderPhase>('setup');
  const [gameId, setGameId] = useState<GameId>('tekken');
  const [title, setTitle] = useState('');
  const [bpm, setBpm] = useState(0);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);

  // Recording results
  const [recordedNotes, setRecordedNotes] = useState<BeatNote[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const activeKeyMap: KeyMap = inputDevice === 'leverless'
    ? leverlessMaps[gameId] ?? {}
    : keyMaps[gameId] ?? {};

  const handleLoadAudio = useCallback((file: File) => {
    // Revoke previous blob URL
    if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    const url = URL.createObjectURL(file);
    audioBlobUrlRef.current = url;
    setAudioFileName(file.name);
  }, []);

  const handleStart = useCallback(() => {
    setPhase('countdown');
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setPhase('recording');
  }, []);

  const handleStop = useCallback((notes: BeatNote[], durationMs: number) => {
    setRecordedNotes(notes);
    setRecordingDuration(durationMs);
    setPhase('review');
  }, []);

  const handleReRecord = useCallback(() => {
    setRecordedNotes([]);
    setRecordingDuration(0);
    setPhase('countdown');
  }, []);

  const handleSave = useCallback((trimmedNotes: BeatNote[], durationMs: number) => {
    const chart: BeatMap = {
      id: 'custom-' + Date.now(),
      title: title || 'Recorded Chart',
      game: gameId,
      fps: 60,
      audioFile: 'audio/silence.mp3',
      notes: trimmedNotes.sort((a, b) => a.time - b.time),
    };
    onSave(chart);
  }, [title, gameId, onSave]);

  switch (phase) {
    case 'setup':
      return (
        <RecorderSetup
          gameId={gameId}
          title={title}
          bpm={bpm}
          metronomeEnabled={metronomeEnabled}
          audioFileName={audioFileName}
          onChangeGame={setGameId}
          onChangeTitle={setTitle}
          onChangeBpm={setBpm}
          onToggleMetronome={() => setMetronomeEnabled(m => !m)}
          onLoadAudio={handleLoadAudio}
          onStart={handleStart}
          onBack={onBack}
        />
      );

    case 'countdown':
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', background: '#0a0a1a',
        }}>
          <Countdown onComplete={handleCountdownComplete} />
        </div>
      );

    case 'recording':
      return (
        <RecorderLive
          gameId={gameId}
          keyMap={activeKeyMap}
          inputDevice={inputDevice}
          audioUrl={audioBlobUrlRef.current}
          bpm={bpm}
          metronomeEnabled={metronomeEnabled}
          onStop={handleStop}
        />
      );

    case 'review':
      return (
        <RecorderReview
          notes={recordedNotes}
          durationMs={recordingDuration}
          gameId={gameId}
          title={title}
          bpm={bpm}
          onSave={handleSave}
          onReRecord={handleReRecord}
          onBack={() => setPhase('setup')}
        />
      );
  }
};
