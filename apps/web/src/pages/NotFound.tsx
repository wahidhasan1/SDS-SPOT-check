import { ButtonLink } from '../components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
      <p className="muted mt-2">The page you are looking for does not exist or has moved.</p>
      <ButtonLink to="/" className="mt-6">Go home</ButtonLink>
    </div>
  );
}
