import React, { useState, useCallback } from 'react';
import { BeatMap } from '@shared/types';
import { validateBeatMap } from '@shared/BeatMapLoader';
import YAML from 'yaml';

interface ImportChartsDialogProps {
  onImport: (charts: BeatMap[]) => void;
  onClose: () => void;
}

interface RepoFile {
  name: string;
  download_url: string;
  selected: boolean;
}

type ImportMode = 'url' | 'repo' | 'paste';

function parseGitHubRepo(url: string): { owner: string; repo: string; path: string } | null {
  // https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/path
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)(?:\/tree\/[^/]+\/(.+))?/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], path: match[3] ?? '' };
}

export const ImportChartsDialog: React.FC<ImportChartsDialogProps> = ({ onImport, onClose }) => {
  const [mode, setMode] = useState<ImportMode>('url');
  const [url, setUrl] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imported, setImported] = useState<string[]>([]);

  // ── Direct URL import ──
  const handleUrlImport = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(url.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const text = await res.text();
      const data = YAML.parse(text);

      // Could be a single chart or an array of charts
      const charts: BeatMap[] = [];
      if (Array.isArray(data)) {
        for (const item of data) {
          charts.push(validateBeatMap(item));
        }
      } else {
        charts.push(validateBeatMap(data));
      }

      onImport(charts);
      setImported(charts.map(c => c.title));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, onImport]);

  // ── GitHub repo browse ──
  const handleRepoBrowse = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setRepoFiles([]);
    try {
      const parsed = parseGitHubRepo(url.trim());
      if (!parsed) throw new Error('Not a valid GitHub repo URL. Use: https://github.com/owner/repo');

      // Try common chart paths
      const paths = parsed.path
        ? [parsed.path]
        : ['assets/charts', 'charts', '.', 'src/charts'];

      let files: RepoFile[] = [];
      for (const p of paths) {
        try {
          const apiUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/contents/${p}`;
          const res = await fetch(apiUrl);
          if (!res.ok) continue;
          const data = await res.json();
          if (!Array.isArray(data)) continue;
          files = data
            .filter((f: { name: string; type: string }) => (f.name.endsWith('.yaml') || f.name.endsWith('.yml') || f.name.endsWith('.json')) && f.type === 'file')
            .map((f: { name: string; download_url: string }) => ({
              name: f.name,
              download_url: f.download_url,
              selected: true,
            }));
          if (files.length > 0) break;
        } catch {
          continue;
        }
      }

      if (files.length === 0) {
        throw new Error('No chart files found in the repository. Try a direct URL to a chart file instead.');
      }

      setRepoFiles(files);
      setMode('repo');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  const toggleFile = (idx: number) => {
    setRepoFiles(prev => prev.map((f, i) => i === idx ? { ...f, selected: !f.selected } : f));
  };

  const handleRepoImport = useCallback(async () => {
    const selected = repoFiles.filter(f => f.selected);
    if (selected.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const charts: BeatMap[] = [];
      const errors: string[] = [];
      for (const file of selected) {
        try {
          const res = await fetch(file.download_url);
          if (!res.ok) { errors.push(`${file.name}: HTTP ${res.status}`); continue; }
          const text = await res.text();
          const data = YAML.parse(text);
          charts.push(validateBeatMap(data));
        } catch (e) {
          errors.push(`${file.name}: ${(e as Error).message}`);
        }
      }
      if (charts.length > 0) {
        onImport(charts);
        setImported(charts.map(c => c.title));
      }
      if (errors.length > 0) {
        setError(`Imported ${charts.length}, failed ${errors.length}:\n${errors.join('\n')}`);
      }
    } finally {
      setLoading(false);
    }
  }, [repoFiles, onImport]);

  // ── Paste JSON import ──
  const handlePasteImport = useCallback(() => {
    if (!pasteText.trim()) return;
    setError('');
    try {
      const data = YAML.parse(pasteText);
      const charts: BeatMap[] = [];
      if (Array.isArray(data)) {
        for (const item of data) charts.push(validateBeatMap(item));
      } else {
        charts.push(validateBeatMap(data));
      }
      onImport(charts);
      setImported(charts.map(c => c.title));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [pasteText, onImport]);

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', zIndex: 1000, fontFamily: 'monospace',
    }}>
      <div style={{
        width: 560, maxHeight: '80vh', background: '#0e0e1a', border: '1px solid #222',
        borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', borderBottom: '1px solid #222',
        }}>
          <span style={{ fontSize: 16, color: '#aac' }}>Import Charts</span>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
          {([['url', 'From URL'], ['repo', 'GitHub Repo'], ['paste', 'Paste YAML']] as [ImportMode, string][]).map(([m, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(''); setRepoFiles([]); setImported([]); }} style={{
              padding: '8px 16px', fontFamily: 'monospace', fontSize: 12,
              background: mode === m ? '#1a1a3a' : 'transparent',
              color: mode === m ? '#88aaff' : '#555',
              border: 'none', borderBottom: mode === m ? '2px solid #4466cc' : '2px solid transparent',
              cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

          {/* URL mode */}
          {mode === 'url' && (
            <div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10, lineHeight: 1.6 }}>
                Paste a direct URL to a chart file (.yaml or .json). Supports raw GitHub URLs,
                gists, and any CORS-enabled host.
              </div>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://raw.githubusercontent.com/user/repo/main/charts/chart.yaml"
                style={inputStyle}
              />
              <button onClick={handleUrlImport} disabled={loading || !url.trim()} style={{ ...actionBtn, marginTop: 10 }}>
                {loading ? 'Fetching...' : 'Import'}
              </button>
            </div>
          )}

          {/* Repo browse mode */}
          {mode === 'repo' && repoFiles.length === 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10, lineHeight: 1.6 }}>
                Paste a GitHub repository URL. Charts are searched in
                assets/charts/, charts/, or root directory.
              </div>
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://github.com/user/leverless-charts"
                style={inputStyle}
              />
              <button onClick={handleRepoBrowse} disabled={loading || !url.trim()} style={{ ...actionBtn, marginTop: 10 }}>
                {loading ? 'Searching...' : 'Browse'}
              </button>
            </div>
          )}

          {/* Repo file list */}
          {mode === 'repo' && repoFiles.length > 0 && (
            <div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
                Found {repoFiles.length} chart files. Select which to import:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {repoFiles.map((f, i) => (
                  <label key={f.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', background: '#111128', borderRadius: 4,
                    cursor: 'pointer', fontSize: 13, color: f.selected ? '#ccc' : '#555',
                  }}>
                    <input type="checkbox" checked={f.selected} onChange={() => toggleFile(i)}
                      style={{ accentColor: '#4466cc' }} />
                    {f.name}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleRepoImport}
                  disabled={loading || repoFiles.every(f => !f.selected)}
                  style={actionBtn}>
                  {loading ? 'Importing...' : `Import ${repoFiles.filter(f => f.selected).length} charts`}
                </button>
                <button onClick={() => { setRepoFiles([]); setImported([]); }} style={{ ...actionBtn, background: '#333' }}>
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Paste mode */}
          {mode === 'paste' && (
            <div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
                Paste chart YAML directly. Also accepts JSON (YAML is a superset of JSON).
              </div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="id: my-chart&#10;title: My Chart&#10;game: tekken&#10;fps: 60&#10;notes:&#10;  - { time: 3000, endTime: 3050, lane: 3 }"
                style={{
                  width: '100%', height: 200, fontFamily: 'monospace', fontSize: 11,
                  background: '#111128', color: '#ccc', border: '1px solid #333',
                  borderRadius: 4, padding: 10, resize: 'vertical',
                }}
                spellCheck={false}
              />
              <button onClick={handlePasteImport} disabled={!pasteText.trim()} style={{ ...actionBtn, marginTop: 10 }}>
                Import
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#2a1118', borderRadius: 4, color: '#f66', fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {error}
            </div>
          )}

          {/* Success */}
          {imported.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#112a18', borderRadius: 4, color: '#0f8', fontSize: 12 }}>
              Imported: {imported.join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', fontFamily: 'monospace', fontSize: 12, padding: '8px 10px',
  background: '#111128', color: '#ccc', border: '1px solid #333', borderRadius: 4,
};

const actionBtn: React.CSSProperties = {
  padding: '8px 20px', fontFamily: 'monospace', fontSize: 13,
  background: '#2244aa', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#666', fontSize: 20,
  cursor: 'pointer', padding: '0 4px',
};
