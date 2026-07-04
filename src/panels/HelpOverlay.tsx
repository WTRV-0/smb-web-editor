import { useState } from 'react';
import { HelpIcon } from '../ui/icons';

export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="icon-only" onClick={() => setOpen(true)} title="Help & Dolphin workflow">
        <HelpIcon size={18} />
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="help-content">
              <h2>Monkey Ball Workshop</h2>
              <p>Build Super Monkey Ball 2 custom levels in the browser, organize them into level sets, and export game-ready files.</p>

              <h3>Editor basics</h3>
              <ul>
                <li>Add geometry and objects from the left palette; click things to select, drag the gizmo to move them.</li>
                <li><b>W / E / R</b> switch between move / rotate / scale; <b>S</b> toggles snapping; <b>Delete</b> removes the selection; <b>Ctrl+Z / Ctrl+Y</b> undo/redo.</li>
                <li>Parametric shapes (arc ramp with banking, stairs, half-pipe, funnel, torus…) have per-shape sliders in the inspector, including segment counts. The <b>▲ counter</b> in the top bar tracks stage triangles — keep it sane for file size.</li>
                <li>Everything autosaves to your browser. The <b>Library</b> holds your levels, organized into level sets, with <code>.smbproj</code> import/export for backups and sharing.</li>
              </ul>

              <h3>Mesh edit mode (Blender-style)</h3>
              <ul>
                <li>Select a mesh and press <b>Tab</b> (or "Edit Mesh") — parametric shapes get baked to a free-form mesh.</li>
                <li><b>1 / 2 / 3</b> switch vertex / edge / face select; click to select, shift-click to add; <b>A</b> selects all/none.</li>
                <li>Drag the gizmo to move the selection. <b>E</b> extrudes selected faces (then drag them out), plus Subdivide, Merge (vertices), Delete, and Flip normals on the toolbar.</li>
                <li><b>Tab</b> or Done exits; everything is undoable with Ctrl+Z.</li>
              </ul>

              <h3>Moving platforms, seesaws &amp; switches</h3>
              <ul>
                <li>Create an <b>item group</b> (＋ group in the outliner), assign meshes to it in the inspector, then enable <b>Animation</b> and add keyframes per channel. Preview with the play bar.</li>
                <li>Mark a group as a <b>seesaw</b> to make it tilt under the ball's weight.</li>
                <li>Place <b>switches</b> and point them at a group to control its animation (play/pause/reverse/…).</li>
                <li>Link <b>wormholes</b> to each other via the inspector.</li>
              </ul>

              <h3>Getting levels into Dolphin</h3>
              <ol>
                <li>Use <b>Patch ISO</b>: pick a level set, assign each level to a named slot (Story 1-1 … 10-10), select your legally-dumped SMB2 ISO, and a patched copy is written — all in the browser.</li>
                <li>Open the patched ISO in Dolphin and play the slots you replaced.</li>
              </ol>
              <p className="hint">
                How slots work: stage files (<code>STAGENNN.lz</code> + models) are just numbered containers. Course
                tables inside the game's code decide which stage number each menu slot loads — e.g. vanilla Story 1-1
                loads STAGE201, but Story 1-5 loads STAGE001. Challenge mode reuses the same stage pool, so replacing
                a story stage also changes any challenge slot pointing at the same stage. Renaming menu slots or
                building bigger custom difficulties requires patching those tables (see the community's smb2-relmod) —
                not needed for simply swapping in your own levels.
              </p>
            </div>
            <button className="modal-close-btn" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
