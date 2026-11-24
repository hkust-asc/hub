import { normalizeLessonUrl } from './catalog'

const normalized = normalizeLessonUrl(location.href)
if (normalized) history.replaceState(history.state, '', normalized)

void import('./main')
