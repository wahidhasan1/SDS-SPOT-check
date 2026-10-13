import { Route } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { APP_NAME } from './lib/api';

function TempHome() {
  return <div className="card"><h1>{APP_NAME}</h1><Link to="/speaking">Speaking</Link></div>;
}
function TempWelcome() {
  return <div className="card"><Link to="/login">Login</Link> <Link to="/register">Register</Link></div>;
}

export const routes = {
  public: [<Route key="w" path="/welcome" element={<TempWelcome />} />],
  private: [<Route key="h" path="/" element={<TempHome />} />],
  standalone: [] as React.ReactNode[],
};
