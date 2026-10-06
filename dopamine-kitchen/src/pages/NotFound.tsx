import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'
import { useTitle } from '../lib/hooks'

export default function NotFound() {
  useTitle('Page not found')
  return (
    <div className="mx-auto max-w-3xl px-4">
      <EmptyState icon={Compass} title="This page got lost on the way" body="The link may be broken, or the page was never cooked. Let's get you back to the menu." action={<><Link to="/" className="btn btn-primary">Go home</Link><Link to="/search" className="btn btn-secondary">Search</Link></>} />
    </div>
  )
}
