/** Growable big-endian binary writer for GameCube formats. */
export class BinaryWriter {
  private buf: ArrayBuffer;
  private view: DataView;
  private bytes: Uint8Array;
  private pos = 0;

  constructor(initialCapacity = 64 * 1024) {
    this.buf = new ArrayBuffer(initialCapacity);
    this.view = new DataView(this.buf);
    this.bytes = new Uint8Array(this.buf);
  }

  get offset(): number {
    return this.pos;
  }

  private ensure(n: number): void {
    if (this.pos + n <= this.buf.byteLength) return;
    let cap = this.buf.byteLength * 2;
    while (cap < this.pos + n) cap *= 2;
    const next = new ArrayBuffer(cap);
    new Uint8Array(next).set(this.bytes.subarray(0, this.pos));
    this.buf = next;
    this.view = new DataView(next);
    this.bytes = new Uint8Array(next);
  }

  u8(v: number): void {
    this.ensure(1);
    this.view.setUint8(this.pos, v);
    this.pos += 1;
  }

  u16(v: number): void {
    this.ensure(2);
    this.view.setUint16(this.pos, v, false);
    this.pos += 2;
  }

  u32(v: number): void {
    this.ensure(4);
    this.view.setUint32(this.pos, v >>> 0, false);
    this.pos += 4;
  }

  f32(v: number): void {
    this.ensure(4);
    this.view.setFloat32(this.pos, v, false);
    this.pos += 4;
  }

  vec3(v: { x: number; y: number; z: number }): void {
    this.f32(v.x);
    this.f32(v.y);
    this.f32(v.z);
  }

  /** Rotation in degrees -> three u16 angle units (65536 per revolution) */
  rot3(v: { x: number; y: number; z: number }): void {
    this.u16(degToAngleUnits(v.x));
    this.u16(degToAngleUnits(v.y));
    this.u16(degToAngleUnits(v.z));
  }

  zeros(n: number): void {
    this.ensure(n);
    this.bytes.fill(0, this.pos, this.pos + n);
    this.pos += n;
  }

  raw(data: Uint8Array): void {
    this.ensure(data.length);
    this.bytes.set(data, this.pos);
    this.pos += data.length;
  }

  /** ASCII string + NUL, padded with zeros to a 4-byte boundary */
  cstringAligned4(s: string): void {
    const data = new TextEncoder().encode(s);
    this.raw(data);
    this.zeros(alignUp4(data.length + 1) - data.length);
  }

  toUint8Array(): Uint8Array {
    return this.bytes.slice(0, this.pos);
  }
}

export function degToAngleUnits(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  // truncate like the C++ float -> u16 conversion in ws2lz
  return Math.floor((d / 360) * 65536) & 0xffff;
}

export function alignUp4(n: number): number {
  return (n + 3) & ~3;
}
