/**
 * SMB .lz LZSS codec.
 *
 * Port of Okumura's classic LZSS as adapted for Super Monkey Ball by
 * camthesaxman / ComplexPlane (ws2lz LZCompressor.cpp, SMB_LZ_Tool):
 * ring buffer N=4096 zero-initialised, max match F=18, threshold 2.
 *
 * File layout: u32 LE compressed size (total file size, 8-byte header
 * included — the convention of smb2cnv and SMB_LZ_Tool and retail stage
 * files; ws2lz writes payload-only here and the game doesn't seem to mind),
 * u32 LE uncompressed size, then the LZSS stream.
 */

const N = 4096;
const F = 18;
const THRESHOLD = 2;
const NIL = N;

export function lzCompress(input: Uint8Array): Uint8Array {
  const out: number[] = [];
  encode(input, out);

  const result = new Uint8Array(8 + out.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, out.length + 8, true);
  view.setUint32(4, input.length, true);
  result.set(out, 8);
  return result;
}

export function lzDecompress(data: Uint8Array): Uint8Array {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const sizeField = view.getUint32(0, true);
  const uncompressedSize = view.getUint32(4, true);
  // Tolerate both conventions: header-inclusive total size (retail/smb2cnv) and
  // payload-only (ws2lz).
  const compressedSize = sizeField === data.length - 8 ? sizeField : sizeField - 8;
  if (8 + compressedSize > data.length) {
    throw new Error(`LZ header claims ${compressedSize} payload bytes but file has ${data.length - 8}`);
  }

  const out = new Uint8Array(uncompressedSize);
  let outPos = 0;
  const ring = new Uint8Array(N); // zero-filled
  let r = N - F;
  let flags = 0;
  let pos = 8;
  const end = 8 + compressedSize;

  while (pos < end && outPos < uncompressedSize) {
    flags >>= 1;
    if ((flags & 0x100) === 0) {
      if (pos >= end) break;
      flags = data[pos++] | 0xff00;
    }
    if (flags & 1) {
      const c = data[pos++];
      out[outPos++] = c;
      ring[r] = c;
      r = (r + 1) & (N - 1);
    } else {
      const b0 = data[pos++];
      const b1 = data[pos++];
      const matchPos = b0 | ((b1 & 0xf0) << 4);
      const matchLen = (b1 & 0x0f) + THRESHOLD + 1;
      for (let i = 0; i < matchLen && outPos < uncompressedSize; i++) {
        const c = ring[(matchPos + i) & (N - 1)];
        out[outPos++] = c;
        ring[r] = c;
        r = (r + 1) & (N - 1);
      }
    }
  }
  return out;
}

function encode(input: Uint8Array, out: number[]): void {
  const textBuf = new Uint8Array(N + F - 1);
  const lson = new Int32Array(N + 1);
  const rson = new Int32Array(N + 257);
  const dad = new Int32Array(N + 1);
  let matchPosition = 0;
  let matchLength = 0;

  const initTree = () => {
    for (let i = N + 1; i <= N + 256; i++) rson[i] = NIL;
    for (let i = 0; i < N; i++) dad[i] = NIL;
  };

  const insertNode = (r: number) => {
    let cmp = 1;
    const key = r;
    let p = N + 1 + textBuf[key];
    rson[r] = lson[r] = NIL;
    matchLength = 0;
    for (;;) {
      if (cmp >= 0) {
        if (rson[p] !== NIL) p = rson[p];
        else {
          rson[p] = r;
          dad[r] = p;
          return;
        }
      } else {
        if (lson[p] !== NIL) p = lson[p];
        else {
          lson[p] = r;
          dad[r] = p;
          return;
        }
      }
      let i;
      for (i = 1; i < F; i++) {
        cmp = textBuf[key + i] - textBuf[p + i];
        if (cmp !== 0) break;
      }
      if (i > matchLength) {
        matchPosition = p;
        matchLength = i;
        if (i >= F) break;
      }
    }
    dad[r] = dad[p];
    lson[r] = lson[p];
    rson[r] = rson[p];
    dad[lson[p]] = r;
    dad[rson[p]] = r;
    if (rson[dad[p]] === p) rson[dad[p]] = r;
    else lson[dad[p]] = r;
    dad[p] = NIL;
  };

  const deleteNode = (p: number) => {
    let q;
    if (dad[p] === NIL) return;
    if (rson[p] === NIL) q = lson[p];
    else if (lson[p] === NIL) q = rson[p];
    else {
      q = lson[p];
      if (rson[q] !== NIL) {
        do {
          q = rson[q];
        } while (rson[q] !== NIL);
        rson[dad[q]] = lson[q];
        dad[lson[q]] = dad[q];
        lson[q] = lson[p];
        dad[lson[p]] = q;
      }
      rson[q] = rson[p];
      dad[rson[p]] = q;
    }
    dad[q] = dad[p];
    if (rson[dad[p]] === p) rson[dad[p]] = q;
    else lson[dad[p]] = q;
    dad[p] = NIL;
  };

  let inPos = 0;
  const codeBuf = new Uint8Array(17);
  let codeBufPtr = 1;
  let mask = 1;
  codeBuf[0] = 0;

  initTree();
  let s = 0;
  let r = N - F;
  let len = 0;
  while (len < F && inPos < input.length) {
    textBuf[r + len] = input[inPos++];
    len++;
  }
  if (len === 0) return;
  for (let i = 1; i <= F; i++) insertNode(r - i);
  insertNode(r);

  do {
    if (matchLength > len) matchLength = len;
    if (matchLength <= THRESHOLD) {
      matchLength = 1;
      codeBuf[0] |= mask;
      codeBuf[codeBufPtr++] = textBuf[r];
    } else {
      codeBuf[codeBufPtr++] = matchPosition & 0xff;
      codeBuf[codeBufPtr++] = ((matchPosition >> 4) & 0xf0) | (matchLength - (THRESHOLD + 1));
    }
    mask = (mask << 1) & 0xff;
    if (mask === 0) {
      for (let i = 0; i < codeBufPtr; i++) out.push(codeBuf[i]);
      codeBuf[0] = 0;
      codeBufPtr = 1;
      mask = 1;
    }
    const lastMatchLength = matchLength;
    let i;
    for (i = 0; i < lastMatchLength && inPos < input.length; i++) {
      deleteNode(s);
      const c = input[inPos++];
      textBuf[s] = c;
      if (s < F - 1) textBuf[s + N] = c;
      s = (s + 1) & (N - 1);
      r = (r + 1) & (N - 1);
      insertNode(r);
    }
    while (i++ < lastMatchLength) {
      deleteNode(s);
      s = (s + 1) & (N - 1);
      r = (r + 1) & (N - 1);
      if (--len) insertNode(r);
    }
  } while (len > 0);

  if (codeBufPtr > 1) {
    for (let i = 0; i < codeBufPtr; i++) out.push(codeBuf[i]);
  }
}
