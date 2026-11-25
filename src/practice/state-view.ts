import type { Game } from './engine/game.ts'
import { basename } from './engine/vfs.ts'
import { escapeHtml as esc } from '../platform/links.ts'

export const stateViews = {
  tree: 'Filesystem tree', streams: 'Stream plumber', env: '$PATH lookup', processes: 'Process telemetry',
}
export type StateView = keyof typeof stateViews
export type Run = ReturnType<Game['run']>

export function stateView(view: StateView, shell: Game['shell'], last?: Run): string {
  switch (view) {
    case 'tree': {
      function branch(path: string): string {
        const dir = shell.vfs.get(path)?.type === 'directory'
        const children = dir ? shell.vfs.list(path) : []
        const visible = children.filter(child => !basename(child).startsWith('.') || shell.revealed.has(path))
        return `<li><code>${esc(basename(path))}${dir && path !== '/' ? '/' : ''}</code>${path === shell.cwd ? ' <b class="state-mark">cwd</b>' : ''}
          ${children.length ? `<ul>${visible.map(branch).join('')}${visible.length < children.length ? '<li class="mode-note">Hidden entries</li>' : ''}</ul>` : ''}</li>`
      }
      return `<p>Simulated disk. An all-entries listing reveals hidden names.</p><ul class="vfs-tree">${branch('/')}</ul>`
    }
    case 'streams':
      if (!last?.stages.length) return '<p>Run a command to trace its file descriptors.</p>'
      return last.stages.map((stage, i, stages) => `<section class="stream-stage"><h3>${esc(stage.name)}</h3>${(['stdin', 'stdout', 'stderr'] as const).map((fd, n) => {
        const write = stage.writes.find(w => w.stream === fd)
        const destination = write ? `${write.operator} ${write.path}`
          : fd === 'stdin' ? (i ? 'from pipe' : 'input') : (fd === 'stdout' && i < stages.length - 1 ? 'to pipe' : 'to terminal')
        return `<div class="stream-lane" data-stream="${fd}"><b>${fd} [${n}]</b> <code>${esc(destination)}</code><pre>${esc(stage[fd].trimEnd() || '—')}</pre></div>`
      }).join('')}</section>`).join('')
    case 'env':
      return `<p>Search order for an external command without a slash:</p><ol>${shell.pathDirectories.map(p => `<li><code>${esc(p)}</code></li>`).join('')}</ol>
        <h3>Exported variables</h3><dl>${Object.entries(shell.env).map(([k, v]) => `<dt>${esc(k)}</dt><dd><code>${esc(v)}</code></dd>`).join('')}</dl>`
    case 'processes':
      return `<p>Simulated processes on the training node. These are not HPC4 measurements.</p>
        <table><thead><tr><th>PID</th><th>Command</th><th>CPU</th><th>MiB</th></tr></thead><tbody>${shell.processes.map(p =>
          `<tr${p.cpu >= 90 ? ' class="is-hot"' : ''}><td>${esc(p.pid)}</td><td>${esc(p.name)}</td><td>${esc(p.cpu)}%</td><td>${esc(p.memory)}</td></tr>`).join('')}</tbody></table>`
  }
}
