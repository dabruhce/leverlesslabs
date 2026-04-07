import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameId, ButtonId, DirectionId, InputDevice, GamepadButtonMap } from '@shared/types';
import { GameRegistry } from '@shared/registry/GameRegistry';

type AllKeyMaps = Record<GameId, Record<string, ButtonId | DirectionId>>;

interface SettingsScreenProps {
  keyMaps: AllKeyMaps;
  leverlessMaps: AllKeyMaps;
  inputDevice: InputDevice;
  gamepadMap: GamepadButtonMap;
  onSave: (keyMaps: AllKeyMaps, leverlessMaps: AllKeyMaps, device: InputDevice, gpMap: GamepadButtonMap) => void;
  onBack: () => void;
}

const DIRECTIONS: DirectionId[] = ['up', 'down', 'left', 'right'];
const DIRECTION_LABELS: Record<DirectionId, string> = {
  up: 'u', down: 'd', left: 'b', right: 'f',
};

const TEKKEN_BUTTON_LABELS: Record<string, string> = {
  lp: '1', mp: '2', lk: '3', hk: '4',
};
const SF_BUTTON_LABELS: Record<string, string> = {
  lp: 'LP', mp: 'MP', hp: 'HP', lk: 'LK', mk: 'MK', hk: 'HK',
};

const DEVICE_OPTIONS: { id: InputDevice; label: string; desc: string }[] = [
  { id: 'keyboard', label: 'Keyboard', desc: 'Standard keyboard layout (arrow keys + letter keys).' },
  { id: 'controller', label: 'Controller / Leverless (USB)', desc: 'Gamepad or USB leverless controller. Press a button on the device to connect.' },
];

// All mappable inputs for a game
function getAllInputs(game: ReturnType<typeof GameRegistry.getGame>): (ButtonId | DirectionId)[] {
  return [...DIRECTIONS, ...game.buttons];
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  keyMaps, leverlessMaps, inputDevice, gamepadMap, onSave, onBack,
}) => {
  const [selectedGame, setSelectedGame] = useState<GameId>('tekken');
  const [localKeyMaps, setLocalKeyMaps] = useState(keyMaps);
  const [localLeverlessMaps, setLocalLeverlessMaps] = useState(leverlessMaps);
  const [localDevice, setLocalDevice] = useState<InputDevice>(inputDevice);
  const [localGamepadMap, setLocalGamepadMap] = useState<GamepadButtonMap>(gamepadMap);
  const [listening, setListening] = useState<string | null>(null);
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());

  // Gamepad state
  const [connectedGamepad, setConnectedGamepad] = useState<{ name: string; index: number; buttons: number } | null>(null);
  const [gpListening, setGpListening] = useState<string | null>(null); // which input we're mapping
  const [gpPressedButtons, setGpPressedButtons] = useState<Set<number>>(new Set());
  const gpPollRef = useRef<number>(0);
  const gpPrevPressedRef = useRef<Set<number>>(new Set());

  const game = GameRegistry.getGame(selectedGame);

  const isKeyboard = localDevice === 'keyboard';
  const isLeverless = localDevice === 'leverless';
  const showKeyBindings = isKeyboard || isLeverless;
  const isController = localDevice === 'controller';

  const currentMap = isLeverless
    ? localLeverlessMaps[selectedGame] ?? {}
    : localKeyMaps[selectedGame] ?? {};

  const setCurrentMap = (newMap: Record<string, ButtonId | DirectionId>) => {
    if (isLeverless) {
      setLocalLeverlessMaps(prev => ({ ...prev, [selectedGame]: newMap }));
    } else {
      setLocalKeyMaps(prev => ({ ...prev, [selectedGame]: newMap }));
    }
  };

  const invertedMap: Record<string, string> = {};
  for (const [key, val] of Object.entries(currentMap)) {
    invertedMap[val] = key;
  }

  const activeInputs = new Set<string>();
  if (!listening) {
    for (const key of pressedKeys) {
      const mapped = currentMap[key];
      if (mapped) activeInputs.add(mapped);
    }
  }

  const handleListen = useCallback((targetId: string) => {
    setListening(targetId);
  }, []);

  // Track held keys for live feedback
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (!listening) setPressedKeys(prev => new Set(prev).add(e.key));
    };
    const onUp = (e: KeyboardEvent) => {
      setPressedKeys(prev => { const next = new Set(prev); next.delete(e.key); return next; });
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [listening]);

  // Keyboard: capture next key for binding
  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      const newMap = { ...currentMap };
      for (const [k] of Object.entries(newMap)) {
        if (k === e.key) delete newMap[k];
      }
      newMap[e.key] = listening as ButtonId | DirectionId;
      setCurrentMap(newMap);
      setListening(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [listening, currentMap, selectedGame, localDevice]);

  // Gamepad detection and polling
  useEffect(() => {
    const onConnect = (e: GamepadEvent) => {
      setConnectedGamepad({
        name: e.gamepad.id,
        index: e.gamepad.index,
        buttons: e.gamepad.buttons.length,
      });
    };
    const onDisconnect = () => {
      setConnectedGamepad(null);
      setGpPressedButtons(new Set());
    };

    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);

    // Check if already connected
    const gamepads = navigator.getGamepads?.() ?? [];
    for (const gp of gamepads) {
      if (gp) {
        setConnectedGamepad({ name: gp.id, index: gp.index, buttons: gp.buttons.length });
        break;
      }
    }

    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, []);

  // Gamepad button polling (for live feedback and mapping)
  useEffect(() => {
    if (!isController) return;

    const poll = () => {
      const gamepads = navigator.getGamepads?.() ?? [];
      for (const gp of gamepads) {
        if (!gp) continue;
        const pressed = new Set<number>();
        gp.buttons.forEach((btn, idx) => {
          if (btn.pressed) pressed.add(idx);
        });
        setGpPressedButtons(pressed);

        // If we're mapping a button, capture the first NEW press (not already held)
        if (gpListening) {
          for (const idx of pressed) {
            if (gpPrevPressedRef.current.has(idx)) continue; // was already held
            // Assign this button index to the input we're mapping
            setLocalGamepadMap(prev => {
              const next = { ...prev };
              // Remove any existing mapping to this button index
              for (const [k, v] of Object.entries(next)) {
                if (v === gpListening) delete next[parseInt(k)];
              }
              next[idx] = gpListening as ButtonId | DirectionId;
              return next;
            });
            setGpListening(null);
            break;
          }
        }

        gpPrevPressedRef.current = pressed;

        if (!connectedGamepad) {
          setConnectedGamepad({ name: gp.id, index: gp.index, buttons: gp.buttons.length });
        }
        break;
      }
      gpPollRef.current = requestAnimationFrame(poll);
    };

    gpPollRef.current = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(gpPollRef.current);
  }, [isController, gpListening, connectedGamepad]);

  // Invert gamepad map for display
  const gpInvertedMap: Record<string, number> = {};
  for (const [btnIdx, inputId] of Object.entries(localGamepadMap)) {
    gpInvertedMap[inputId] = parseInt(btnIdx);
  }

  const allInputs = getAllInputs(game);
  const gameButtonLabels = selectedGame === 'tekken' ? TEKKEN_BUTTON_LABELS : SF_BUTTON_LABELS;

  const getInputLabel = (id: string) => {
    if (DIRECTIONS.includes(id as DirectionId)) return DIRECTION_LABELS[id as DirectionId];
    return gameButtonLabels[id] ?? id;
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      fontFamily: 'monospace', background: '#0a0a1a', padding: 32, overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, color: '#aac' }}>Settings</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { onSave(localKeyMaps, localLeverlessMaps, localDevice, localGamepadMap); onBack(); }} style={btnStyle}>Save</button>
          <button onClick={onBack} style={{ ...btnStyle, background: '#333' }}>Back</button>
        </div>
      </div>

      {/* Input device selector */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Input Device</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {DEVICE_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => setLocalDevice(opt.id)}
              style={{
                padding: '10px 24px', fontFamily: 'monospace', fontSize: 14,
                background: localDevice === opt.id ? '#2244aa' : '#1a1a2e',
                color: localDevice === opt.id ? '#fff' : '#666',
                border: localDevice === opt.id ? '2px solid #4466cc' : '2px solid #222',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
          {DEVICE_OPTIONS.find(o => o.id === localDevice)?.desc}
        </div>
      </div>

      {/* Game selector */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>Game</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {GameRegistry.getAllGames().map(g => (
            <button key={g.id} onClick={() => setSelectedGame(g.id)} style={{
              padding: '8px 20px', fontFamily: 'monospace', fontSize: 13,
              background: selectedGame === g.id ? '#2244aa' : '#222',
              color: selectedGame === g.id ? '#fff' : '#888',
              border: 'none', borderRadius: 6, cursor: 'pointer',
            }}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Keyboard/Leverless key mapping */}
      {showKeyBindings && (
        <div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>
            {isLeverless ? 'Leverless' : 'Keyboard'} Mapping ({game.label})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allInputs.map(id => {
              const label = getInputLabel(id);
              const boundKey = invertedMap[id] ?? '(none)';
              const isActive = activeInputs.has(id);

              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderRadius: 6,
                  background: isActive ? '#1a2a1a' : '#111128',
                  border: listening === id ? '1px solid #4466cc'
                    : isActive ? '1px solid #00ff88' : '1px solid #222',
                  transition: 'background 0.08s, border-color 0.08s',
                }}>
                  <span style={{
                    color: isActive ? '#00ff88' : DIRECTIONS.includes(id as DirectionId) ? '#88aaff' : '#cc88ff',
                    width: 120, fontWeight: isActive ? 'bold' : 'normal',
                  }}>
                    {label}
                  </span>
                  <button onClick={() => handleListen(id)} style={{
                    padding: '6px 16px', fontFamily: 'monospace', fontSize: 13,
                    background: listening === id ? '#2244aa' : isActive ? '#1a3a1a' : '#1a1a2e',
                    color: listening === id ? '#fff' : isActive ? '#00ff88' : '#aaa',
                    border: '1px solid #333', borderRadius: 4, cursor: 'pointer', minWidth: 120,
                  }}>
                    {listening === id ? 'Press a key...' : boundKey}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Controller / USB leverless mapping */}
      {isController && (
        <div>
          {/* Connection status */}
          <div style={{
            padding: '12px 16px', background: '#111128', borderRadius: 8,
            border: `1px solid ${connectedGamepad ? '#00ff88' : '#ff4444'}`,
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: connectedGamepad ? '#00ff88' : '#ff4444',
              }} />
              <span style={{ color: connectedGamepad ? '#00ff88' : '#ff4444', fontSize: 14 }}>
                {connectedGamepad ? 'Connected' : 'No controller detected'}
              </span>
            </div>
            {connectedGamepad ? (
              <div style={{ fontSize: 11, color: '#666', marginLeft: 16 }}>
                <div>{connectedGamepad.name}</div>
                <div>{connectedGamepad.buttons} buttons</div>
              </div>
            ) : (
              <div style={{ fontSize: 11, color: '#555', marginLeft: 16 }}>
                Press any button on your controller to connect.
              </div>
            )}
            {/* Live button display */}
            {connectedGamepad && gpPressedButtons.size > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#88aaff', marginLeft: 16 }}>
                Pressed: {[...gpPressedButtons].sort((a, b) => a - b).map(b => `btn${b}`).join(', ')}
              </div>
            )}
          </div>

          {/* Button mapping */}
          <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>
            Button Mapping ({game.label})
          </div>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>
            Click an input, then press the button on your controller to map it.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allInputs.map(id => {
              const label = getInputLabel(id);
              const mappedBtn = gpInvertedMap[id];
              const isActive = mappedBtn !== undefined && gpPressedButtons.has(mappedBtn);
              const isDir = DIRECTIONS.includes(id as DirectionId);

              return (
                <div key={id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', borderRadius: 6,
                  background: isActive ? '#1a2a1a' : '#111128',
                  border: gpListening === id ? '1px solid #ff6644'
                    : isActive ? '1px solid #00ff88' : '1px solid #222',
                  transition: 'background 0.08s, border-color 0.08s',
                }}>
                  <span style={{
                    color: isActive ? '#00ff88' : isDir ? '#88aaff' : '#cc88ff',
                    width: 120, fontWeight: isActive ? 'bold' : 'normal',
                  }}>
                    {label}
                  </span>
                  <button
                    onClick={() => setGpListening(gpListening === id ? null : id)}
                    style={{
                      padding: '6px 16px', fontFamily: 'monospace', fontSize: 13,
                      background: gpListening === id ? '#442200' : isActive ? '#1a3a1a' : '#1a1a2e',
                      color: gpListening === id ? '#ff6644' : isActive ? '#00ff88' : '#aaa',
                      border: '1px solid #333', borderRadius: 4, cursor: 'pointer', minWidth: 120,
                    }}
                  >
                    {gpListening === id ? 'Press button...' : mappedBtn !== undefined ? `btn ${mappedBtn}` : '(none)'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 12, color: '#555' }}>
        {game.buttons.length + 4} inputs total ({game.label})
      </div>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '8px 20px', fontSize: 13, fontFamily: 'monospace',
  background: '#2244aa', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
};
