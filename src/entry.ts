const url = new URL(location.href)
if (url.searchParams.get('lesson') === 'gpu-copy-sol') {
  url.searchParams.set('lesson', 'host-to-gpu')
  history.replaceState(history.state, '', url)
}

if (url.searchParams.get('lesson') === 'host-to-gpu') {
  void import('./host-to-gpu/player')
} else if (url.searchParams.get('lesson') === 'ssh-tmux') {
  void import('./ssh-tmux/player')
} else {
  void import('./main')
}
