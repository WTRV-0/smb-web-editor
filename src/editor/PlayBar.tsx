import { useEffect, useState } from 'react';
import { useEditor } from '../state/store';
import { maxAnimationDuration } from './animation';
import { previewClock } from './previewClock';

export function PlayBar() {
  const doc = useEditor((s) => s.doc);
  const playing = useEditor((s) => s.previewPlaying);
  const setPlaying = useEditor((s) => s.setPreviewPlaying);
  const [displayTime, setDisplayTime] = useState(0);

  const duration = maxAnimationDuration(doc.itemGroups);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setDisplayTime(previewClock.time), 100);
    return () => clearInterval(id);
  }, [playing]);

  if (duration <= 0) return null;

  return (
    <div className="playbar">
      <button
        className={playing ? 'active' : ''}
        onClick={() => setPlaying(!playing)}
        title="Play/pause animation preview"
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button
        onClick={() => {
          setPlaying(false);
          previewClock.time = 0;
          setDisplayTime(0);
        }}
        title="Stop and reset"
      >
        ■
      </button>
      <input
        type="range"
        min={0}
        max={duration}
        step={0.05}
        value={Math.min(displayTime % Math.max(duration, 0.001), duration)}
        onChange={(e) => {
          const t = parseFloat(e.target.value);
          previewClock.time = t;
          setDisplayTime(t);
        }}
      />
      <span className="playbar-time">
        {displayTime.toFixed(1)}s / {duration.toFixed(1)}s
      </span>
    </div>
  );
}
