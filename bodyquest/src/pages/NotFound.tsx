import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="content">
      <EmptyState icon="target" title="Page not found" action={<Link className="btn btn-primary" to="/app">Back to dashboard</Link>}>
        That page doesn’t exist. It may have moved.
      </EmptyState>
    </div>
  );
}
