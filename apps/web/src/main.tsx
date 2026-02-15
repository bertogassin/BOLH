/* @refresh reload */
import { render } from 'solid-js/web';
import { Router, Route } from '@solidjs/router';
import App from './App';
import './index.css';

import HomePage from './pages/Home';
import LoginPage from './pages/auth/Login';
import RegisterPage from './pages/auth/Register';
import DiscoverPage from './pages/Discover';
import MapPage from './pages/Map';
import OrdersPage from './pages/Orders';
import ProfilePage from './pages/Profile';
import GuardDetailPage from './pages/GuardDetail';
import CreateOrderPage from './pages/CreateOrder';
import SettingsPage from './pages/Settings';
import LiveTrackingPage from './pages/LiveTracking';
import ChatPage from './pages/Chat';
import MarketplacePage from './pages/Marketplace';
import WorkPage from './pages/Work';
import PaymentsPage from './pages/Payments';
import AchievementsPage from './pages/Achievements';
import AnalyticsPage from './pages/Analytics';
import IncidentReportPage from './pages/IncidentReport';
import BlockchainPage from './pages/Blockchain';
import WalletPage from './pages/Wallet';
import ReferralPage from './pages/Referral';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

render(
  () => (
    <Router singleFlight>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/" component={App}>
        <Route path="/" component={HomePage} />
        <Route path="/discover" component={DiscoverPage} />
        <Route path="/map" component={MapPage} />
        <Route path="/work" component={WorkPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/orders/create" component={CreateOrderPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/guards/:id" component={GuardDetailPage} />
        <Route path="/tracking/:orderId" component={LiveTrackingPage} />
        <Route path="/chat/:orderId" component={ChatPage} />
        <Route path="/marketplace" component={MarketplacePage} />
        <Route path="/payments" component={PaymentsPage} />
        <Route path="/achievements" component={AchievementsPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/orders/:orderId/report" component={IncidentReportPage} />
        <Route path="/wallet" component={WalletPage} />
        <Route path="/blockchain" component={BlockchainPage} />
        <Route path="/referral" component={ReferralPage} />
      </Route>
    </Router>
  ),
  root
);
