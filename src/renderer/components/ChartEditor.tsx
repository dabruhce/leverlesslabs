import React, { useState, useCallback, useRef, useEffect } from 'react';
import { BeatMap, BeatNote, GameId } from '@shared/types';
import { GameRegistry } from '@shared/registry/GameRegistry';
import YAML from 'yaml';

interface ChartEditorProps {
  chart: BeatMap | null;
  onSave: (chart: BeatMap) => void;
  onBack: () => void;
}

function createEmptyChart(game: GameId): BeatMap {
  return {
    id: 'custom-' + Date.now(),
    title: 'New Chart',
    game,
    fps: 60,
    audioFile: 'audio/silence.mp3',
    notes: [],
  };
}

type EditorTab = 'notes' | 'record' | 'yaml';

export const ChartEditor: React.FC<ChartEditorProps> = ({ chart: initialChart, onSave, onBack }) => {
  const [chartData, setChartData] = useState<BeatMap>(
    () => initialChart ? { ...initialChart, notes: [...initialChart.notes] } : createEmptyChart('tekken')
  );
  const [selectedNoteIdx, setSelectedNoteIdx] = useState<number | null>(null);
  const [tab, setTab] = useState<EditorTab>('notes');
  const [yamlText, setYamlText] = useState('');
  const [yamlError, setYamlError] = useState('');

  // Audio state
  const [audioFileName, setAudioFileName] = useState<string | null>(
    initialChart?.audioFile && initialChart.audioFile !== 'audio/silence.mp3'
      ? initialChart.audioFile.split('/').pop() ?? null
      : null
  );
  const audioBlobUrlRef = useRef<string | null>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const audioEngineRef = useRef<{ ctx: AudioContext; source: AudioBufferSourceNode | null } | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  // Record mode state
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordLane, setRecordLane] = useState(0);
  const recordStartRef = useRef(0);
  const recordRafRef = useRef(0);

  const game = GameRegistry.getGame(chartData.game);
  const sortedNotes = [...chartData.notes].sort((a, b) => a.time - b.time);

  const msPerFrame = 1000 / chartData.fps;
  const timeToFrame = (ms: number) => Math.round(ms / msPerFrame);
  const frameToTime = (f: number) => Math.round(f * msPerFrame);

  const updateField = <K extends keyof BeatMap>(key: K, value: BeatMap[K]) => {
    setChartData(prev => ({ ...prev, [key]: value }));
  };

  const addNote = useCallback((time: number, lane: number, endTime?: number, label?: string) => {
    const note: BeatNote = { time: Math.round(time), endTime: Math.round(endTime ?? time), lane };
    if (label) note.label = label;
    setChartData(prev => ({
      ...prev,
      notes: [...prev.notes, note].sort((a, b) => a.time - b.time),
    }));
  }, []);

  const updateNote = useCallback((idx: number, updates: Partial<BeatNote>) => {
    setChartData(prev => {
      const notes = [...prev.notes];
      notes[idx] = { ...notes[idx], ...updates };
      return { ...prev, notes: notes.sort((a, b) => a.time - b.time) };
    });
  }, []);

  const deleteNote = useCallback((idx: number) => {
    setChartData(prev => ({
      ...prev,
      notes: prev.notes.filter((_, i) => i !== idx),
    }));
    setSelectedNoteIdx(null);
  }, []);

  // Audio
  const handleLoadAudio = useCallback((file: File) => {
    if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    const url = URL.createObjectURL(file);
    audioBlobUrlRef.current = url;
    setAudioFileName(file.name);
    updateField('audioFile', `audio/${file.name}`);
  }, []);

  const stopAudioPreview = useCallback(() => {
    if (audioEngineRef.current?.source) {
      try { audioEngineRef.current.source.stop(); } catch {}
      audioEngineRef.current.source = null;
    }
    setAudioPlaying(false);
  }, []);

  const handlePlayAudio = useCallback(async () => {
    // Stop if already playing
    if (audioEngineRef.current?.source) {
      stopAudioPreview();
      return;
    }

    // Try blob URL first (user just picked a file), then fall back to assets path
    const url = audioBlobUrlRef.current
      ?? (chartData.audioFile && chartData.audioFile !== 'audio/silence.mp3'
        ? `./assets/${chartData.audioFile}`
        : null);
    if (!url) return;

    try {
      const ctx = audioEngineRef.current?.ctx ?? new AudioContext();
      const resp = await fetch(url);
      if (!resp.ok) return;
      const buf = await resp.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(buf);
      const source = ctx.createBufferSource();
      source.buffer = audioBuf;
      source.connect(ctx.destination);
      source.onended = () => { setAudioPlaying(false); if (audioEngineRef.current) audioEngineRef.current.source = null; };
      source.start();
      audioEngineRef.current = { ctx, source };
      setAudioPlaying(true);
    } catch { /* audio failed */ }
  }, [chartData.audioFile, stopAudioPreview]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioEngineRef.current?.source) {
        try { audioEngineRef.current.source.stop(); } catch {}
      }
      audioEngineRef.current?.ctx.close();
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    };
  }, []);

  // Record mode
  const startRecording = useCallback(() => {
    setRecording(true);
    setRecordTime(0);
    recordStartRef.current = performance.now();
    const tick = () => {
      setRecordTime(performance.now() - recordStartRef.current);
      recordRafRef.current = requestAnimationFrame(tick);
    };
    recordRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRecording = useCallback(() => {
    setRecording(false);
    cancelAnimationFrame(recordRafRef.current);
  }, []);

  const tapNote = useCallback(() => {
    if (!recording) return;
    const time = performance.now() - recordStartRef.current;
    addNote(time, recordLane);
  }, [recording, recordLane, addNote]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); tapNote(); }
      if (e.key === 'Escape') stopRecording();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recording, tapNote, stopRecording]);

  // YAML
  const exportYaml = useCallback(() => {
    setYamlText(YAML.stringify(chartData, { flowCollectionPadding: true }));
    setYamlError('');
    setTab('yaml');
  }, [chartData]);

  const importYaml = useCallback(() => {
    try {
      const parsed = YAML.parse(yamlText);
      if (!parsed.id || !parsed.title || !parsed.game || !parsed.notes) {
        setYamlError('Missing required fields (id, title, game, notes)');
        return;
      }
      setChartData(parsed as BeatMap);
      setYamlError('');
      setTab('notes');
    } catch (e) {
      setYamlError('Invalid YAML: ' + (e as Error).message);
    }
  }, [yamlText]);

  const handleSave = useCallback(() => { onSave(chartData); }, [chartData, onSave]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const rem = ms % 1000;
    return `${m}:${String(s % 60).padStart(2, '0')}.${String(Math.round(rem)).padStart(3, '0')}`;
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'monospace', background: '#0a0a1a', color: '#ccc',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid #222', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={headerBtn}>&#x2190; Back</button>
          <span style={{ fontSize: 16, color: '#aac' }}>Chart Editor</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportYaml} style={headerBtn}>Export YAML</button>
          <button onClick={handleSave} style={{ ...headerBtn, background: '#2244aa', color: '#fff' }}>
            Save Chart
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div style={{
        display: 'flex', gap: 16, padding: '12px 20px',
        borderBottom: '1px solid #222', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0,
      }}>
        <Field label="Title">
          <input value={chartData.title} onChange={e => updateField('title', e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Game">
          <select value={chartData.game} onChange={e => updateField('game', e.target.value as GameId)} style={inputStyle}>
            {GameRegistry.getAllGames().map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="FPS">
          <input type="number" value={chartData.fps} onChange={e => updateField('fps', Number(e.target.value))} style={{ ...inputStyle, width: 70 }} />
        </Field>
        <Field label="ID">
          <input value={chartData.id} onChange={e => updateField('id', e.target.value)} style={{ ...inputStyle, width: 160 }} />
        </Field>
        <Field label="Audio">
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => audioFileRef.current?.click()} style={{ ...inputStyle, cursor: 'pointer', padding: '4px 10px' }}>
              Choose
            </button>
            <span style={{ fontSize: 11, color: '#666', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {audioFileName ?? 'None'}
            </span>
            {(audioBlobUrlRef.current || (chartData.audioFile && chartData.audioFile !== 'audio/silence.mp3')) && (
              <button onClick={handlePlayAudio} style={{ ...inputStyle, cursor: 'pointer', padding: '4px 8px', fontSize: 11 }}>
                {audioPlaying ? '\u23F9' : '\u25B6'}
              </button>
            )}
            <input
              ref={audioFileRef}
              type="file"
              accept="audio/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLoadAudio(f); }}
            />
          </div>
        </Field>
        <div style={{ fontSize: 12, color: '#555' }}>{chartData.notes.length} notes</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222', flexShrink: 0 }}>
        {(['notes', 'record', 'yaml'] as EditorTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 20px', fontFamily: 'monospace', fontSize: 13,
            background: tab === t ? '#1a1a3a' : 'transparent',
            color: tab === t ? '#88aaff' : '#666',
            border: 'none', borderBottom: tab === t ? '2px solid #4466cc' : '2px solid transparent',
            cursor: 'pointer', textTransform: 'capitalize',
          }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

        {tab === 'notes' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button onClick={() => addNote(
                chartData.notes.length > 0
                  ? chartData.notes[chartData.notes.length - 1].time + frameToTime(10)
                  : frameToTime(120),
                0
              )} style={actionBtn}>
                + Add Note
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '100px 70px 70px 36px 120px 80px',
                gap: 8, padding: '6px 12px', color: '#555', fontSize: 11,
              }}>
                <span>Lane</span><span>Start</span><span>End</span><span>JF</span><span>Label</span><span></span>
              </div>
              {sortedNotes.map((note, sortIdx) => {
                const realIdx = chartData.notes.indexOf(note);
                const isSelected = selectedNoteIdx === realIdx;
                return (
                  <div
                    key={sortIdx}
                    onClick={() => setSelectedNoteIdx(isSelected ? null : realIdx)}
                    style={{
                      display: 'grid', gridTemplateColumns: '100px 70px 70px 36px 120px 80px',
                      gap: 8, padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
                      background: isSelected ? '#1a2a3a' : '#111128',
                      border: isSelected ? '1px solid #4466cc' : '1px solid transparent',
                      fontSize: 13, alignItems: 'center',
                    }}
                  >
                    {isSelected ? (
                      <>
                        <select value={note.lane}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateNote(realIdx, { lane: Number(e.target.value) })}
                          style={cellInput}>
                          {game.laneLabels.map((l, i) => <option key={i} value={i}>{l} ({i})</option>)}
                        </select>
                        <input type="number" value={timeToFrame(note.time)}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateNote(realIdx, { time: frameToTime(Number(e.target.value)) })}
                          style={{ ...cellInput, width: 60 }} />
                        <input type="number" value={timeToFrame(note.endTime)}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateNote(realIdx, { endTime: frameToTime(Number(e.target.value)) })}
                          style={{ ...cellInput, width: 60 }} />
                        <input type="checkbox" checked={!!note.justFrame}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateNote(realIdx, { justFrame: e.target.checked || undefined })}
                          style={{ cursor: 'pointer', accentColor: '#ff44aa' }} />
                        <input value={note.label ?? ''}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateNote(realIdx, { label: e.target.value || undefined })}
                          placeholder="(optional)"
                          style={{ ...cellInput, width: 100 }} />
                        <button
                          onClick={e => { e.stopPropagation(); deleteNote(realIdx); }}
                          style={{ ...actionBtn, background: '#441122', color: '#f66', padding: '4px 8px', fontSize: 11 }}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ color: '#cc88ff' }}>{game.laneLabels[note.lane] ?? note.lane}</span>
                        <span style={{ color: '#88aaff' }}>{timeToFrame(note.time)}f</span>
                        <span style={{ color: '#88aaff' }}>
                          {timeToFrame(note.endTime) !== timeToFrame(note.time)
                            ? `${timeToFrame(note.endTime)}f`
                            : <span style={{ color: '#333' }}>—</span>}
                        </span>
                        <span style={{ color: note.justFrame ? '#ff44aa' : '#333' }}>
                          {note.justFrame ? 'JF' : '—'}
                        </span>
                        <span style={{ color: '#558' }}>{note.label ?? ''}</span>
                        <span />
                      </>
                    )}
                  </div>
                );
              })}
              {sortedNotes.length === 0 && (
                <div style={{ color: '#444', padding: 20, textAlign: 'center' }}>
                  No notes yet. Add notes manually or use Record mode.
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'record' && (
          <div>
            <div style={{ marginBottom: 16, color: '#888', fontSize: 13, lineHeight: 1.8 }}>
              Tap <b style={{ color: '#aac' }}>Space</b> to place notes in time. Set the lane, start recording, and tap along.
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center' }}>
              <Field label="Lane">
                <select value={recordLane} onChange={e => setRecordLane(Number(e.target.value))} style={inputStyle} disabled={recording}>
                  {game.laneLabels.map((l, i) => <option key={i} value={i}>{l} ({i})</option>)}
                </select>
              </Field>
            </div>
            {!recording ? (
              <button onClick={startRecording} style={{ ...actionBtn, padding: '12px 32px', fontSize: 16 }}>
                &#x25CF; Start Recording
              </button>
            ) : (
              <div>
                <div style={{ fontSize: 48, fontWeight: 'bold', color: '#ff4444', marginBottom: 16, fontVariantNumeric: 'tabular-nums' }}>
                  &#x25CF; {timeToFrame(recordTime)}f
                </div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <button onClick={tapNote} style={{ ...actionBtn, padding: '12px 32px', fontSize: 16 }}>Tap (Space)</button>
                  <button onClick={stopRecording} style={{ ...actionBtn, background: '#333', padding: '12px 24px' }}>Stop (Esc)</button>
                </div>
                <div style={{ fontSize: 12, color: '#555' }}>Notes placed: {chartData.notes.length}</div>
              </div>
            )}
          </div>
        )}

        {tab === 'yaml' && (
          <div>
            <textarea value={yamlText} onChange={e => { setYamlText(e.target.value); setYamlError(''); }}
              style={{
                width: '100%', height: 400, fontFamily: 'monospace', fontSize: 12,
                background: '#111128', color: '#ccc', border: '1px solid #333',
                borderRadius: 6, padding: 12, resize: 'vertical',
              }}
              spellCheck={false} />
            {yamlError && <div style={{ color: '#f66', fontSize: 12, marginTop: 8 }}>{yamlError}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={importYaml} style={actionBtn}>Import YAML</button>
              <button onClick={() => navigator.clipboard.writeText(yamlText)} style={{ ...actionBtn, background: '#333' }}>Copy to Clipboard</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontSize: 11, color: '#555' }}>{label}</span>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 13, padding: '6px 10px',
  background: '#1a1a2e', color: '#ccc', border: '1px solid #333', borderRadius: 4,
};
const cellInput: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: 12, padding: '4px 6px',
  background: '#1a1a2e', color: '#ccc', border: '1px solid #333', borderRadius: 3,
};
const headerBtn: React.CSSProperties = {
  padding: '6px 14px', fontFamily: 'monospace', fontSize: 12,
  background: '#1a1a2e', color: '#aac', border: '1px solid #333', borderRadius: 4, cursor: 'pointer',
};
const actionBtn: React.CSSProperties = {
  padding: '8px 16px', fontFamily: 'monospace', fontSize: 13,
  background: '#2244aa', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
};
