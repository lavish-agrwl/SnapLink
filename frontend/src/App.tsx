import { Routes, Route } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import LandingView from './views/LandingView';
import ShortenView from './views/ShortenView';
import UrlsView from './views/UrlsView';
import AnalyticsView from './views/AnalyticsView';
import RedirectView from './views/RedirectView';
import NotFoundView from './views/NotFoundView';

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<LandingView />} />
        <Route path="/shorten" element={<ShortenView />} />
        <Route path="/urls" element={<UrlsView />} />
        <Route path="/analytics/:slug" element={<AnalyticsView />} />
        <Route path="/:slug" element={<RedirectView />} />
        <Route path="*" element={<NotFoundView />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
