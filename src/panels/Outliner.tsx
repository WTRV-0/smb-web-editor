import { STATIC_GROUP_ID } from '../model/types';
import { newItemGroup } from '../model/defaults';
import { useEditor, type Selection } from '../state/store';

export function Outliner() {
  const doc = useEditor((s) => s.doc);
  const selection = useEditor((s) => s.selection);
  const select = useEditor((s) => s.select);
  const mutate = useEditor((s) => s.mutate);

  const isSelected = (sel: Selection) => JSON.stringify(sel) === JSON.stringify(selection);

  const row = (sel: NonNullable<Selection>, label: string, extra?: React.ReactNode) => (
    <div
      key={sel.kind === 'start' ? 'start' : `${sel.kind}:${sel.id}`}
      className={`outliner-row ${isSelected(sel) ? 'selected' : ''}`}
      onClick={() => select(sel)}
    >
      <span className="outliner-label">{label}</span>
      {extra}
    </div>
  );

  const deleteButton = (onDelete: () => void) => (
    <button
      className="icon-btn"
      title="Delete"
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    >
      ✕
    </button>
  );

  const addGroup = () => {
    const group = newItemGroup();
    mutate((d) => {
      d.itemGroups.push(group);
    });
    select({ kind: 'group', id: group.id });
  };

  const deleteGroup = (id: string) => {
    mutate((d) => {
      d.itemGroups = d.itemGroups.filter((g) => g.id !== id);
      // reparent children to the static group
      for (const m of d.meshes) if (m.groupId === id) m.groupId = STATIC_GROUP_ID;
      for (const o of d.objects) if (o.groupId === id) o.groupId = STATIC_GROUP_ID;
    });
    select(null);
  };

  return (
    <div className="outliner">
      <div className="outliner-header">
        <h3>Stage</h3>
        <button className="icon-btn" onClick={addGroup} title="Add item group (for animated/seesaw platforms)">
          ＋ group
        </button>
      </div>
      {row({ kind: 'start' }, '▶ Start')}
      {doc.itemGroups.map((group) => {
        const meshes = doc.meshes.filter((m) => m.groupId === group.id);
        const objects = doc.objects.filter((o) => o.groupId === group.id);
        const tags = [group.animation ? '⏱' : '', group.seesaw ? '⚖' : ''].join('');
        return (
          <div key={group.id} className="outliner-group">
            <div
              className={`outliner-group-name ${isSelected({ kind: 'group', id: group.id }) ? 'selected' : ''}`}
              onClick={() => select({ kind: 'group', id: group.id })}
            >
              <span className="outliner-label">
                {group.name} {tags}
              </span>
              {group.id !== STATIC_GROUP_ID &&
                deleteButton(() => deleteGroup(group.id))}
            </div>
            {meshes.map((m) =>
              row(
                { kind: 'mesh', id: m.id },
                m.name,
                deleteButton(() => {
                  mutate((d) => {
                    d.meshes = d.meshes.filter((x) => x.id !== m.id);
                  });
                  if (isSelected({ kind: 'mesh', id: m.id })) select(null);
                }),
              ),
            )}
            {objects.map((o) =>
              row(
                { kind: 'object', id: o.id },
                o.name,
                deleteButton(() => {
                  mutate((d) => {
                    d.objects = d.objects.filter((x) => x.id !== o.id);
                  });
                  if (isSelected({ kind: 'object', id: o.id })) select(null);
                }),
              ),
            )}
          </div>
        );
      })}
    </div>
  );
}
