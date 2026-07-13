import { useState } from 'react';
import PhotoPostTool from './tools/PhotoPostTool';
import ZoomBackgroundTool from './tools/ZoomBackgroundTool';

const TOOLS = [
  { id: 'photo', label: '📸 Meeting Photo', Component: PhotoPostTool },
  { id: 'zoom', label: '🖥 Zoom Background', Component: ZoomBackgroundTool },
];

export default function OtherToolsTab() {
  const [activeTool, setActiveTool] = useState('photo');
  const { Component } = TOOLS.find((t) => t.id === activeTool);

  return (
    <div>
      <div className="section-head">
        <h2>Other Tools</h2>
        <p>Small utilities for club communication.</p>
        <div className="maroon-line"></div>
      </div>

      <div className="tool-switcher">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={'tool-switcher-btn' + (activeTool === t.id ? ' active' : '')}
            onClick={() => setActiveTool(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Component />
    </div>
  );
}
