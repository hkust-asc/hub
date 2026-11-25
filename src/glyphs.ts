import { createIsoProjector } from './iso.ts'
import type { IsoPaletteName } from './iso.ts'

export type Tone = 'blue' | 'green' | 'amber' | 'slate' | 'coral'

const glyphIso = createIsoProjector({ originX: 24, originY: 18.5, scale: 0.86, roundTo: 10 })

function box(
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  shade: IsoPaletteName,
): string {
  return glyphIso.box(x, y, z, w, d, h, shade, { stroke: '#2c3e4526', strokeWidth: 0.75 })
}

function wrap(inner: string): string {
  return `<svg class="entry-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">${inner}</svg>`
}

const glyphRenderers: Record<string, () => string> = {
  // Domain Categories
  'cat-nodes': () =>
    box(-13, -8, -4, 12, 12, 15, 'frame') +
    box(-11, 3, -1, 8, 2, 3, 'amber') +
    box(-11, 3, 4, 8, 2, 3, 'amber') +
    box(2, -8, -4, 12, 12, 15, 'frame') +
    box(4, 3, -1, 8, 2, 3, 'blue') +
    box(4, 3, 4, 8, 2, 3, 'blue') +
    box(4, 3, 9, 8, 2, 3, 'blueDeep') +
    '<path d="M14 40 H34 M18 36 V40 M30 36 V40" fill="none" stroke="#738596" stroke-width="1.6" stroke-linecap="round"/>',

  'cat-interconnect': () =>
    box(-15, -10, -5, 30, 22, 3, 'board') +
    box(-12, -6, -2, 9, 8, 6, 'green') +
    box(4, 1, -2, 9, 8, 6, 'blue') +
    '<path d="M18 25.5 L24 28.5 L24 33.5 L29 35.5" fill="none" stroke="#d75846" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="18" cy="25.5" r="2" fill="#427e6e"/><circle cx="29" cy="35.5" r="2" fill="#5375bd"/>',

  'cat-software': () =>
    box(-11, -11, -2, 11, 11, 9, 'amber') +
    box(2, -11, -2, 11, 11, 6, 'green') +
    box(-11, 2, -2, 11, 11, 6, 'slate') +
    box(2, 2, -2, 11, 11, 11, 'blue') +
    '<circle cx="34" cy="19.5" r="2.8" fill="#427e6e"/>',

  'cat-linux': () =>
    '<rect x="7" y="9" width="34" height="28" fill="#eef4f2" stroke="#8ab5a8" stroke-width="1.3"/>' +
    '<path d="M7 16 H41" stroke="#b9d4cb" stroke-width="1"/>' +
    '<circle cx="12" cy="12.5" r="1.4" fill="#d75846"/><circle cx="16.5" cy="12.5" r="1.4" fill="#d59d62"/><circle cx="21" cy="12.5" r="1.4" fill="#427e6e"/>' +
    '<path d="M13 22 L17 25.5 L13 29 M20 29 H27" fill="none" stroke="#356558" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M31 21 H36 V31 H31" fill="none" stroke="#5875ae" stroke-width="1.6" stroke-linecap="round"/>',

  'cat-gpu': () =>
    box(-14, -12, -5, 28, 24, 3, 'board') +
    box(-11, -8, -2, 9, 8, 5, 'amber') +
    box(-11, 2, -2, 9, 4, 8, 'green') +
    box(2, -3, -2, 10, 12, 8, 'blueDeep') +
    '<path d="M19 30.5 Q24 26.5 28 29.5" fill="none" stroke="#d75846" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="28" cy="29.5" r="2.1" fill="#ffd091" stroke="#b07b43" stroke-width="0.9"/>',

  // Live Hardware & System Entries
  cluster: () =>
    box(-14, -9, -4, 9, 8, 12, 'slate') +
    box(-3, -9, -4, 9, 8, 12, 'amber') +
    box(8, -9, -4, 9, 8, 12, 'blue') +
    '<path d="M11 35 H37 M11 31 V35 M24 31 V35 M37 31 V35 M24 35 V38" fill="none" stroke="#7d909f" stroke-width="1.5" stroke-linecap="round"/>' +
    '<rect x="17" y="38" width="14" height="5" fill="#66a090" stroke="#356558" stroke-width="0.9"/>',

  login: () =>
    box(-12, -9, -3, 24, 17, 3, 'frame') +
    box(-10, -7, 0, 20, 13, 9, 'slate') +
    '<polygon points="15,20.5 31,28.5 31,22.5 15,14.5" fill="#2c414d"/>' +
    '<path d="M9 33.5 L15 30.5" stroke="#d59d62" stroke-width="2" stroke-linecap="round"/>' +
    '<circle cx="9" cy="33.5" r="2" fill="#d59d62"/>',

  'cpu-nodes': () =>
    box(-15, -11, -4, 30, 22, 3, 'board') +
    box(-12, -7, -1, 10, 10, 5, 'amber') +
    box(2, -7, -1, 10, 10, 5, 'amberDeep') +
    box(-12, 6, -1, 24, 4, 5, 'green'),

  a30: () =>
    box(-15, -13, -5, 30, 26, 3, 'board') +
    box(-12, -10, -2, 8, 8, 4, 'amber') +
    box(2, -10, -2, 8, 8, 4, 'amber') +
    box(-12, 1, -2, 5, 9, 6, 'blue') +
    box(-5, 1, -2, 5, 9, 6, 'blue') +
    box(2, 1, -2, 5, 9, 6, 'blue') +
    box(9, 1, -2, 5, 9, 7, 'blueDeep'),

  rtx4090d: () =>
    box(-15, -12, -5, 30, 24, 3, 'board') +
    [-12, -2, 8].map(x => box(x, -9, -2, 7, 8, 6, 'blue') + box(x, 2, -2, 7, 8, 6, 'blueDeep')).join(''),

  'other-gpus': () =>
    box(-13, -9, -3, 11, 16, 7, 'blue') +
    box(2, -9, -3, 11, 16, 8, 'slate') +
    '<circle cx="19" cy="29.5" r="1.6" fill="#427e6e"/><circle cx="31" cy="28.5" r="1.6" fill="#5375bd"/>',

  cpu: () =>
    box(-13, -13, -4, 26, 26, 4, 'slate') +
    box(-10, -10, 0, 20, 20, 5, 'amber') +
    box(-6, -6, 5, 12, 12, 2, 'amberDeep'),

  memory: () =>
    box(-14, -10, -4, 28, 20, 3, 'board') +
    [-7, 0, 7].map(y => box(-11, y - 2, -1, 22, 3, 9, y === 0 ? 'greenDeep' : 'green')).join(''),

  gpu: () =>
    box(-13, -11, -4, 26, 22, 3, 'slate') +
    box(-11, -9, -1, 22, 18, 8, 'blueDeep') +
    box(-8, -6, 7, 16, 12, 2, 'blue') +
    '<circle cx="29" cy="29.5" r="1.8" fill="#427e6e"/>',

  pcie: () =>
    box(-15, -12, -5, 30, 24, 3, 'board') +
    box(-12, -9, -2, 8, 8, 4, 'amber') +
    box(4, 2, -2, 9, 8, 6, 'blue') +
    '<path d="M18 24.5 L22 26.5 L22 32.5 L28 35.5" fill="none" stroke="#d75846" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="23" cy="29.5" r="2" fill="#ffd091" stroke="#a87540" stroke-width="0.9"/>',

  numa: () =>
    '<polygon points="24,11 38,18 24,25 10,18" fill="#dceee7" stroke="#599483" stroke-width="1" stroke-dasharray="2 2"/>' +
    '<polygon points="24,25 38,32 24,39 10,32" fill="#faecd8" stroke="#c08b52" stroke-width="1" stroke-dasharray="2 2"/>' +
    box(-8, -9, 3, 7, 7, 4, 'green') +
    box(3, 3, -2, 7, 7, 4, 'amber') +
    '<path d="M21 19.5 L27 31.5" stroke="#d75846" stroke-width="2" stroke-linecap="round"/>',

  fabric: () =>
    '<rect x="9" y="21" width="30" height="7" fill="#e6edf5" stroke="#6c87ad" stroke-width="1.3"/>' +
    '<path d="M15 13 V21 M24 13 V21 M33 13 V21 M19 28 V36 M29 28 V36" stroke="#7d93a6" stroke-width="1.6" stroke-linecap="round"/>' +
    '<circle cx="15" cy="12" r="2.6" fill="#d59d62"/><circle cx="24" cy="12" r="2.6" fill="#6681b8"/><circle cx="33" cy="12" r="2.6" fill="#6681b8"/>' +
    '<circle cx="19" cy="36" r="2.6" fill="#599483"/><circle cx="29" cy="36" r="2.6" fill="#599483"/>',

  storage: () =>
    box(-11, -8, -4, 22, 16, 17, 'frame') +
    box(-9, 7, -1, 18, 2, 3, 'green') +
    box(-9, 7, 4, 18, 2, 3, 'green') +
    box(-9, 7, 9, 18, 2, 3, 'greenDeep'),

  // Software & Scenarios
  spack: () =>
    box(-11, 0, -3, 10, 10, 7, 'slate') +
    box(1, 0, -3, 10, 10, 7, 'green') +
    box(-5, -6, 4, 11, 11, 9, 'amber'),

  lmod: () =>
    '<rect x="9" y="10" width="30" height="8" fill="#eef3f6" stroke="#abb8c3" stroke-width="1.1"/>' +
    '<rect x="9" y="20" width="30" height="8" fill="#e3f3ec" stroke="#4f8c7b" stroke-width="1.4"/>' +
    '<rect x="9" y="30" width="30" height="8" fill="#eef3f6" stroke="#abb8c3" stroke-width="1.1"/>' +
    '<circle cx="14" cy="24" r="2.2" fill="#427e6e"/><path d="M19 24 H33" stroke="#356558" stroke-width="1.8" stroke-linecap="round"/>',

  slurm: () =>
    '<rect x="8" y="12" width="12" height="24" fill="#f8efe2" stroke="#c28e55" stroke-width="1.2"/>' +
    '<path d="M11 18 H17 M11 23 H17 M11 28 H15" stroke="#a6723c" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M21 24 H27 M25 21 L28 24 L25 27" fill="none" stroke="#5875ae" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<rect x="30" y="11" width="10" height="7" fill="#dae4f7" stroke="#6681b8" stroke-width="1.2"/>' +
    '<rect x="30" y="20.5" width="10" height="7" fill="#dae4f7" stroke="#6681b8" stroke-width="1.2"/>' +
    '<rect x="30" y="30" width="10" height="7" fill="#edf2f5" stroke="#b3bec8" stroke-width="1.1"/>',

  'first-job': () =>
    '<rect x="16" y="6" width="16" height="6.5" fill="#f5dec3" stroke="#b07b43" stroke-width="1.15"/>' +
    '<path d="M5 20.5 L7.5 18 H17.5 L20 20.5 V29.5 L17.5 32 H7.5 L5 29.5 Z" fill="#cbd2d9" stroke="#738596" stroke-width="1.1"/>' +
    '<path d="M5 18.5 L7.5 16 H17.5 L20 18.5 V27 L17.5 29.5 H7.5 L5 27 Z" fill="#e6eaee" stroke="#738596" stroke-width="1.15"/>' +
    '<rect x="7.5" y="20" width="10" height="6" fill="#2c414d"/>' +
    '<path d="M27 20.5 L29.5 18 H40.5 L43 20.5 V30 L40.5 32.5 H29.5 L27 30 Z" fill="#7b97cf" stroke="#466199" stroke-width="1.1"/>' +
    '<path d="M27 18.5 L29.5 16 H40.5 L43 18.5 V27.5 L40.5 30 H29.5 L27 27.5 Z" fill="#dae4f7" stroke="#5875ae" stroke-width="1.15"/>' +
    '<rect x="30" y="19.5" width="10" height="3" fill="#e3f3ec" stroke="#427e6e" stroke-width=".9"/>' +
    '<rect x="30" y="24" width="5.5" height="3.5" fill="#5c7ab8"/>' +
    '<rect x="37" y="24" width="3" height="3.5" fill="#b1bac3"/>' +
    '<rect x="10" y="36" width="28" height="6" fill="#d9efe7" stroke="#427e6e" stroke-width="1.2"/>' +
    '<path d="M12.5 16 V9.5 H16 M32 9.5 H35 V16" fill="none" stroke="#c08b52" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M35 32.5 V36 M12.5 36 V32" fill="none" stroke="#427e6e" stroke-width="1.4" stroke-linecap="round"/>',

  'host-to-gpu': () =>
    box(-13, -4, -2, 9, 5, 9, 'green') +
    box(4, -5, -2, 10, 11, 8, 'blueDeep') +
    '<path d="M18 26 C22 19, 27 19, 30 26" fill="none" stroke="#d75846" stroke-width="2" stroke-linecap="round"/>' +
    '<rect x="9" y="13" width="10" height="6" fill="#f5dec3" stroke="#b07b43" stroke-width="1"/>' +
    '<rect x="29" y="34" width="10" height="6" fill="#cce6dd" stroke="#427e6e" stroke-width="1"/>',

  'linux-fs': () =>
    '<rect x="19" y="8" width="10" height="7" fill="#f5dec3" stroke="#b07b43" stroke-width="1.2"/>' +
    '<path d="M24 15 V20 M12 20 H36 M12 20 V24 M24 20 V24 M36 20 V24" fill="none" stroke="#7c909e" stroke-width="1.4" stroke-linecap="round"/>' +
    '<rect x="7" y="24" width="10" height="7" fill="#cce6dd" stroke="#427e6e" stroke-width="1.2"/>' +
    '<rect x="19" y="24" width="10" height="7" fill="#e6edf5" stroke="#6c87ad" stroke-width="1.2"/>' +
    '<rect x="31" y="24" width="10" height="7" fill="#cce6dd" stroke="#427e6e" stroke-width="1.2"/>' +
    '<path d="M12 31 V36 H36 V31" fill="none" stroke="#427e6e" stroke-width="1.3" stroke-dasharray="2 2"/>',

  streams: () =>
    '<rect x="7" y="16" width="11" height="16" fill="#eef3f6" stroke="#738596" stroke-width="1.3"/>' +
    '<path d="M18 21 H25 L32 13 H40" fill="none" stroke="#427e6e" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M18 27 H25 L32 35 H40" fill="none" stroke="#d75846" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="18" cy="21" r="2.3" fill="#427e6e"/><circle cx="18" cy="27" r="2.3" fill="#d75846"/>',

  'ssh-tmux': () =>
    '<path d="M8 24 H18" stroke="#d75846" stroke-width="2" stroke-linecap="round" stroke-dasharray="2.5 2.5"/>' +
    '<path d="M19 21 L23 27 M23 21 L19 27" stroke="#d75846" stroke-width="1.6" stroke-linecap="round"/>' +
    '<rect x="26" y="13" width="15" height="22" fill="#e3f3ec" stroke="#427e6e" stroke-width="1.4"/>' +
    '<rect x="29" y="26" width="9" height="4" fill="#427e6e"/>' +
    '<circle cx="37" cy="17.5" r="1.8" fill="#427e6e"/>',

  planned: () =>
    '<rect x="11" y="11" width="26" height="26" fill="#f5f8fa" stroke="#aab7c2" stroke-width="1.3" stroke-dasharray="3 3"/>' +
    '<path d="M18 24 H30 M24 18 V30" stroke="#95a4b1" stroke-width="1.5" stroke-linecap="round"/>',
}

export function renderGlyph(glyphId: string): string {
  const draw = glyphRenderers[glyphId] ?? glyphRenderers.planned!
  return wrap(draw())
}
