import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PROJECTS_DIR } from './constants';
import { getDbProjectVariables, getProjectContent } from './db/schema';

export const PROJECT_PRIVATE_KEYS: Record<string, string> = {
  SF: '0xe773e490658fd8d1fa2263c6dc70549b8f7e2e7b200db72b28ede58a8548ac58',
  SF1: '0x17cb1953a4f98c7ab3dfa8955426904ef0572354be43fd5eb246983d80e6cd2b',
  SF2: '0xbd3e388c1fce0a40855e370de7742dd9cbb0e1b2c51b41a56b22a6b8803ed81f',
  SF3: '0xb42bc30a7c2451331d61589670ea440a2aef440fbf18c2d8bcc52f641f679778',
  SF4: '0x5bf2594f5a0f7ae2c17bdeb3973c3aef5809364d131062c82e5448ee9fecd612',
  SF5: '0xd256925d093ab8ad7e70b684829d999d178bac60e4dcc3629152c5d68edd92d2',
  SF6: '0xf55e9cb6ba9642c79a9018c3610e0de9cc55f542e83b09508101854d6d374756',
  SF7: '0xd0d3524f71c45b97ae93e6269eb8ab6901ee4023652fc1b59297f23cc6793608',
  SF8: '0xa5ac792d07523a1df7146a62f2fef96403c071e67886a9b81b97638cf8a27f9e',
  SF9: '0xcfb5586a137163d9a28ebf0a2beda72d74648a4d8a98e0729a2888905df29851',
  SF10: '0x2d91de2a930caf9a12c796bf6cbd920db8508158deeb5a3cd79603be25b9aca7',
  SF11: '0xc30c11582b820c0f93d0200fd3b870de79210d2c8185556877dae66d1a2aaad0',
  SF12: '0x9a68d662a201fc8fbb8ef1787df0c565e578336bc6c106457d08240ed8f6a7ef',
  SF13: '0xd1ada5dc6fabfdb2decc09180e1f79ddde623f1a516b8931362c1163e350d9c6',
  SF14: '0x76ca9326470b25efc8e854543250eb6c2d1cad943717c1e8178dc645f8f8fea0',
  SF16: '0xffe35e8dbdf98a7f1408476a86572cc8d66df650c02a72988e54acfa9ea15976'
};

export const DEFAULT_WALLET_PASSWORD = 'Dimahoma1998';

// --- SECP256K1 & KECCAK256 CONSTANTS ---
const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
];
const RHO = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
const PI = [0,10,20,5,15,16,1,11,21,6,7,17,2,12,22,23,8,18,3,13,14,24,9,19,4];

function rotl64(x: bigint, n: number): bigint {
  const bn = BigInt(n % 64);
  return ((x << bn) | (x >> (64n - bn))) & 0xffffffffffffffffn;
}

export function keccak256(data: Buffer | Uint8Array | string): Buffer {
  let buf: Buffer;
  if (typeof data === 'string') {
    buf = Buffer.from(data, 'utf8');
  } else if (Buffer.isBuffer(data)) {
    buf = data;
  } else {
    buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }

  const rate = 136;
  const state = new Array(25).fill(0n);
  const padLen = rate - (buf.length % rate);
  const padded = Buffer.alloc(buf.length + padLen);
  buf.copy(padded);
  if (padLen === 1) {
    padded[buf.length] = 0x86;
  } else {
    padded[buf.length] = 0x01;
    padded[padded.length - 1] = 0x80;
  }

  for (let b = 0; b < padded.length; b += rate) {
    for (let i = 0; i < rate / 8; i++) {
      state[i] ^= padded.readBigUInt64LE(b + i * 8);
    }
    for (let round = 0; round < 24; round++) {
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
      }
      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = C[(x+4)%5] ^ rotl64(C[(x+1)%5], 1);
      }
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x+y*5] ^= D[x];
        }
      }
      const B = new Array(25);
      for (let i = 0; i < 25; i++) {
        B[PI[i]] = rotl64(state[i], RHO[i]);
      }
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          state[x+y*5] = B[x+y*5] ^ ((~B[((x+1)%5)+y*5]) & B[((x+2)%5)+y*5]);
        }
      }
      state[0] ^= RC[round];
    }
  }
  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) {
    out.writeBigUInt64LE(state[i], i * 8);
  }
  return out;
}

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;

function mod(a: bigint, b: bigint = P): bigint {
  const r = a % b;
  return r >= 0n ? r : r + b;
}

function modInverse(a: bigint, m: bigint = P): bigint {
  a = mod(a, m);
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return mod(old_s, m);
}

class Point {
  x: bigint | null;
  y: bigint | null;
  constructor(x: bigint | null, y: bigint | null) {
    this.x = x;
    this.y = y;
  }
  static zero = new Point(null, null);
  isZero(): boolean {
    return this.x === null;
  }
  add(other: Point): Point {
    if (this.isZero()) return other;
    if (other.isZero()) return this;
    if (this.x === other.x) {
      if (this.y !== other.y) return Point.zero;
      const m = mod((3n * this.x! * this.x!) * modInverse(2n * this.y!, P), P);
      const nx = mod(m * m - 2n * this.x!, P);
      const ny = mod(m * (this.x! - nx) - this.y!, P);
      return new Point(nx, ny);
    }
    const m = mod((other.y! - this.y!) * modInverse(other.x! - this.x!, P), P);
    const nx = mod(m * m - this.x! - other.x!, P);
    const ny = mod(m * (this.x! - nx) - this.y!, P);
    return new Point(nx, ny);
  }
  multiply(n: bigint): Point {
    let p: Point = this;
    let r: Point = Point.zero;
    while (n > 0n) {
      if (n & 1n) r = r.add(p);
      p = p.add(p);
      n >>= 1n;
    }
    return r;
  }
}
const G = new Point(Gx, Gy);

export function getWalletAddress(privKey: string): string {
  const cleanKey = privKey.startsWith('0x') ? privKey : '0x' + privKey;
  const k = BigInt(cleanKey);
  const pt = G.multiply(k);
  const xBuf = Buffer.from(pt.x!.toString(16).padStart(64, '0'), 'hex');
  const yBuf = Buffer.from(pt.y!.toString(16).padStart(64, '0'), 'hex');
  const pub = Buffer.concat([xBuf, yBuf]);
  return '0x' + keccak256(pub).slice(12).toString('hex');
}

export function signPersonalMessage(message: string, privKey: string): string {
  let msgBuf: Buffer;
  if (message.startsWith('0x')) {
    msgBuf = Buffer.from(message.slice(2), 'hex');
  } else {
    msgBuf = Buffer.from(message, 'utf8');
  }
  const prefix = Buffer.from(String.fromCharCode(25) + 'Ethereum Signed Message:\n' + msgBuf.length, 'utf8');
  const digest = keccak256(Buffer.concat([prefix, msgBuf]));
  const e = BigInt('0x' + digest.toString('hex'));
  const d = BigInt(privKey.startsWith('0x') ? privKey : '0x' + privKey);

  while (true) {
    const kBytes = crypto.randomBytes(32);
    const k = BigInt('0x' + kBytes.toString('hex'));
    if (k <= 0n || k >= N) continue;
    const pt = G.multiply(k);
    const r = mod(pt.x!, N);
    if (r === 0n) continue;
    let s = mod(modInverse(k, N) * (e + r * d), N);
    if (s === 0n) continue;
    let recId = Number((pt.y! & 1n) ^ (s > N / 2n ? 1n : 0n));
    if (s > N / 2n) s = N - s;
    const v = recId + 27;
    return '0x' + r.toString(16).padStart(64, '0') + s.toString(16).padStart(64, '0') + v.toString(16).padStart(2, '0');
  }
}

export function getProjectPrivateKey(projectName: string): string | null {
  if (PROJECT_PRIVATE_KEYS[projectName]) {
    return PROJECT_PRIVATE_KEYS[projectName];
  }
  // 1. Спочатку швидко перевіряємо SQLite project_variables
  try {
    const dbVars = getDbProjectVariables(projectName);
    if (dbVars && dbVars.walletPrivateKey) return dbVars.walletPrivateKey as string;
  } catch (_) {}

  // 2. Перевіряємо SQLite content
  try {
    const dbProj = getProjectContent(projectName);
    if (dbProj && dbProj.content) {
      const data = JSON.parse(dbProj.content);
      const key = data.walletPrivateKey || data.browserSettings?.walletPrivateKey || data.variables?.walletPrivateKey;
      if (key) return key;
    }
  } catch (_) {}

  // 3. Фолбек на диск: файл змінних _vars.json
  try {
    const varsPath = path.join(PROJECTS_DIR, `${projectName}_vars.json`);
    if (fs.existsSync(varsPath)) {
      const vData = JSON.parse(fs.readFileSync(varsPath, 'utf8').replace(/^\uFEFF/, ''));
      if (vData && vData.walletPrivateKey) return vData.walletPrivateKey;
    }
  } catch (_) {}

  try {
    const pPath = path.join(PROJECTS_DIR, `${projectName}.json`);
    if (fs.existsSync(pPath)) {
      const data = JSON.parse(fs.readFileSync(pPath, 'utf8').replace(/^\uFEFF/, ''));
      return data.walletPrivateKey || data.browserSettings?.walletPrivateKey || data.variables?.walletPrivateKey || null;
    }
  } catch (_) {}
  return null;
}

export function getProjectWallet(projectName: string): { privateKey: string; address: string } | null {
  const privKey = getProjectPrivateKey(projectName);
  if (!privKey) return null;
  const address = getWalletAddress(privKey);
  return { privateKey: privKey, address };
}

/**
 * Генерує чистий скрипт для інжекції Ronin Wallet EIP-6963 Bridge у DOM Camoufox
 */
export function getRoninInjectionScript(projectName: string): string {
  const wallet = getProjectWallet(projectName);
  const targetAddress = wallet ? wallet.address : '0xccb1b5f99b94B5F891BEB86b993f8E665230849d';
  const targetPrivKey = wallet ? wallet.privateKey : PROJECT_PRIVATE_KEYS.SF;

  const roninSvg = "data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='100' height='100' fill='%231273EA'/%3E%3Cpath d='M76 38V21C76 17 72 13 68 13H32C28 13 24 17 24 21V70C24 74 28 78 32 78H68C72 78 76 74 76 70V38Z' fill='white'/%3E%3C/svg%3E";

  const innerScript = `
    (() => {
      if (window.__roninDone) return;
      window.__roninDone = true;

      const sfAddress = "${targetAddress}";
      const sfPrivKey = "${targetPrivKey}";

      const RC = [
        0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
        0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
        0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
        0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
        0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
        0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
      ];
      const RHO = [0,1,62,28,27,36,44,6,55,20,3,10,43,25,39,41,45,15,21,8,18,2,61,56,14];
      const PI = [0,10,20,5,15,16,1,11,21,6,7,17,2,12,22,23,8,18,3,13,14,24,9,19,4];
      function rotl64(x, n) { n = BigInt(n % 64); return ((x << n) | (x >> (64n - n))) & 0xffffffffffffffffn; }
      
      function keccak256Browser(data) {
        let bytes;
        if (typeof data === 'string') bytes = new TextEncoder().encode(data);
        else bytes = data;
        const rate = 136;
        const state = new Array(25).fill(0n);
        const padLen = rate - (bytes.length % rate);
        const padded = new Uint8Array(bytes.length + padLen);
        padded.set(bytes);
        if (padLen === 1) padded[bytes.length] = 0x86;
        else { padded[bytes.length] = 0x01; padded[padded.length - 1] = 0x80; }
        const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
        for (let b = 0; b < padded.length; b += rate) {
          for (let i = 0; i < rate / 8; i++) state[i] ^= view.getBigUint64(b + i * 8, true);
          for (let round = 0; round < 24; round++) {
            const C = new Array(5);
            for (let x = 0; x < 5; x++) C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
            const D = new Array(5);
            for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ rotl64(C[(x+1)%5], 1);
            for (let x = 0; x < 5; x++) for (let y = 0; y < 5; y++) state[x+y*5] ^= D[x];
            const B = new Array(25);
            for (let i = 0; i < 25; i++) B[PI[i]] = rotl64(state[i], RHO[i]);
            for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) state[x+y*5] = B[x+y*5] ^ ((~B[((x+1)%5)+y*5]) & B[((x+2)%5)+y*5]);
            state[0] ^= RC[round];
          }
        }
        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        for (let i = 0; i < 4; i++) outView.setBigUint64(i * 8, state[i], true);
        return out;
      }

      const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
      const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
      const Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n;
      const Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n;
      function mod(a, b = P) { const r = a % b; return r >= 0n ? r : r + b; }
      function modInverse(a, m = P) {
        a = mod(a, m);
        let [old_r, r] = [a, m];
        let [old_s, s] = [1n, 0n];
        while (r !== 0n) {
          const q = old_r / r;
          [old_r, r] = [r, old_r - q * r];
          [old_s, s] = [s, old_s - q * s];
        }
        return mod(old_s, m);
      }
      class Point {
        constructor(x, y) { this.x = x; this.y = y; }
        static zero = new Point(null, null);
        isZero() { return this.x === null; }
        add(other) {
          if (this.isZero()) return other;
          if (other.isZero()) return this;
          if (this.x === other.x) {
            if (this.y !== other.y) return Point.zero;
            const m = mod((3n * this.x * this.x) * modInverse(2n * this.y, P), P);
            const nx = mod(m * m - 2n * this.x, P);
            const ny = mod(m * (this.x - nx) - this.y, P);
            return new Point(nx, ny);
          }
          const m = mod((other.y - this.y) * modInverse(other.x - this.x, P), P);
          const nx = mod(m * m - this.x - other.x, P);
          const ny = mod(m * (this.x - nx) - this.y, P);
          return new Point(nx, ny);
        }
        multiply(n) {
          let p = this; let r = Point.zero;
          while (n > 0n) {
            if (n & 1n) r = r.add(p);
            p = p.add(p);
            n >>= 1n;
          }
          return r;
        }
      }
      const G = new Point(Gx, Gy);

      function signPersonalMessageBrowser(message, privKey) {
        let msgBuf;
        if (typeof message === 'string' && message.startsWith('0x')) {
          const clean = message.slice(2);
          msgBuf = new Uint8Array(clean.length / 2);
          for (let i = 0; i < clean.length; i += 2) {
            msgBuf[i / 2] = parseInt(clean.substring(i, i + 2), 16);
          }
        } else {
          msgBuf = new TextEncoder().encode(message);
        }
        const prefix = new TextEncoder().encode(String.fromCharCode(25) + 'Ethereum Signed Message:\\n' + msgBuf.length);
        const full = new Uint8Array(prefix.length + msgBuf.length);
        full.set(prefix);
        full.set(msgBuf, prefix.length);
        const digest = keccak256Browser(full);
        const hexDigest = Array.from(digest).map(b => b.toString(16).padStart(2, '0')).join('');
        const e = BigInt('0x' + hexDigest);
        const d = BigInt(privKey.startsWith('0x') ? privKey : '0x' + privKey);

        while (true) {
          const kBytes = new Uint8Array(32);
          crypto.getRandomValues(kBytes);
          const kHex = Array.from(kBytes).map(b => b.toString(16).padStart(2, '0')).join('');
          const k = BigInt('0x' + kHex);
          if (k <= 0n || k >= N) continue;
          const pt = G.multiply(k);
          const r = mod(pt.x, N);
          if (r === 0n) continue;
          let s = mod(modInverse(k, N) * (e + r * d), N);
          if (s === 0n) continue;
          let recId = Number((pt.y & 1n) ^ (s > N / 2n ? 1n : 0n));
          if (s > N / 2n) s = N - s;
          const v = recId + 27;
          return '0x' + r.toString(16).padStart(64, '0') + s.toString(16).padStart(64, '0') + v.toString(16).padStart(2, '0');
        }
      }

      const listeners = new Map();
      const roninProvider = {
        isRonin: true,
        isMetaMask: false,
        isConnected: () => true,
        chainId: "0x7e4",
        networkVersion: "2020",
        on: (event, handler) => {
          if (!listeners.has(event)) listeners.set(event, []);
          listeners.get(event).push(handler);
        },
        removeListener: (event, handler) => {
          const list = listeners.get(event) || [];
          listeners.set(event, list.filter(h => h !== handler));
        },
        emit: (event, ...args) => {
          (listeners.get(event) || []).forEach(h => {
            try { h(...args); } catch(e) {}
          });
        },
        request: async ({ method, params }) => {
          console.log('[RoninBridge] request:', method, params);
          if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
            return [sfAddress];
          }
          if (method === 'eth_chainId') return "0x7e4";
          if (method === 'net_version') return "2020";
          if (method === 'wallet_switchEthereumChain') return null;
          if (method === 'personal_sign') {
            const msg = (params[0] && params[0].startsWith('0x') && params[0].length !== 42) ? params[0] : params[1];
            console.log('[RoninBridge] Signing personal message for address:', sfAddress);
            const sig = signPersonalMessageBrowser(msg, sfPrivKey);
            console.log('[RoninBridge] Generated valid signature:', sig);
            return sig;
          }
          return null;
        }
      };

      window.ronin = { provider: roninProvider, isRonin: true };

      const info = {
        uuid: "bf680106-96a8-42ec-a070-07bf11c2e399",
        name: "Ronin Wallet",
        icon: "${roninSvg}",
        rdns: "com.roninchain.wallet"
      };

      const announce = () => {
        window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
          detail: Object.freeze({ info: Object.freeze({ ...info }), provider: roninProvider })
        }));
      };

      window.addEventListener("eip6963:requestProvider", announce);
      announce();
      window.dispatchEvent(new Event("ronin#initialized"));
      console.log('[RoninBridge] EIP-6963 Provider registered in pure page scope for:', sfAddress);
    })();
  `;

  return `
    (() => {
      const tryInject = () => {
        const root = document.head || document.documentElement;
        if (root) {
          const s = document.createElement('script');
          s.textContent = ${JSON.stringify(innerScript)};
          root.appendChild(s);
          s.remove();
          return true;
        }
        return false;
      };

      if (!tryInject()) {
        const observer = new MutationObserver(() => {
          if (tryInject()) observer.disconnect();
        });
        observer.observe(document, { childList: true, subtree: true });
      }
    })();
  `;
}
