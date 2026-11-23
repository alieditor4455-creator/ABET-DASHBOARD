import { StoreProvider, useStore } from './data/store';
import { Shell } from './components/Shell';
import { Toast } from './components/ui';
import { Icon } from './components/Icon';
import { useRoute } from './lib/router';
import { Login, Pending } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Studio } from './pages/Studio';
import { Styles } from './pages/Styles';
import { Assets } from './pages/Assets';
import { Production } from './pages/Production';
import { Calendar } from './pages/Calendar';
import { BrandKit } from './pages/BrandKit';
import { Integrations } from './pages/Integrations';
import { Admin } from './pages/Admin';
import { Connect } from './pages/Connect';

function Routes() {
  const { session, profile, data, authReady, loading } = useStore();
  const { section, id, params } = useRoute();
  if (section === 'connect') return <Connect />;
  if (!authReady) return <div className="boot"><Icon name="loader" spin /></div>;
  if (!session) return <Login />;
  if (!profile) return <div className="boot">{loading ? <Icon name="loader" spin /> : 'Loading your profile…'}</div>;
  if (!profile.active) return <Pending />;
  if (!data) return <div className="boot"><Icon name="loader" spin /></div>;
  const page = (() => {
    switch (section) {
      case 'studio': return <Studio id={id} params={params} />;
      case 'styles': return <Styles params={params} />;
      case 'assets': return <Assets />;
      case 'production': return <Production />;
      case 'calendar': return <Calendar />;
      case 'brand': return <BrandKit />;
      case 'integrations': return <Integrations />;
      case 'admin': return <Admin params={params} />;
      default: return <Dashboard />;
    }
  })();
  return <Shell section={section}>{page}</Shell>;
}

export default function App() {
  return (
    <StoreProvider>
      <Routes />
      <Toast />
    </StoreProvider>
  );
}
