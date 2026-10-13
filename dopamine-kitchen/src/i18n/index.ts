import { useStore } from '../store/store'
import { bn } from './bn'
import { en, type DictKey } from './en'

const dicts = { en, bn } as const

export function useT() {
  const lang = useStore((s) => s.settings.lang)
  return (key: DictKey) => (dicts[lang] as Partial<Record<DictKey, string>>)[key] ?? en[key]
}
