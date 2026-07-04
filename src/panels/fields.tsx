import { useEffect, useState } from 'react';
import type { Vec3 } from '../model/types';

/** Numeric input that commits on blur/Enter and tolerates in-progress typing. */
export function NumberField({
  label,
  value,
  onChange,
  step = 0.25,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  const [text, setText] = useState(String(round(value)));
  useEffect(() => setText(String(round(value))), [value]);

  const commit = () => {
    const v = parseFloat(text);
    if (!Number.isNaN(v) && v !== value) onChange(v);
    else setText(String(round(value)));
  };

  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

export function Vec3Field({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: Vec3;
  onChange: (v: Vec3) => void;
  step?: number;
}) {
  return (
    <div className="vec3-field">
      <span className="vec3-label">{label}</span>
      <div className="vec3-inputs">
        <NumberField label="X" value={value.x} onChange={(x) => onChange({ ...value, x })} step={step} />
        <NumberField label="Y" value={value.y} onChange={(y) => onChange({ ...value, y })} step={step} />
        <NumberField label="Z" value={value.z} onChange={(z) => onChange({ ...value, z })} step={step} />
      </div>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== value && onChange(text)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
