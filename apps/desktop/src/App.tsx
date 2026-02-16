import { Router, Route } from '@solidjs/router';
import { lazy } from 'solid-js';

const Home = lazy(() => import('./pages/Home'));

export default function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
    </Router>
  );
}
