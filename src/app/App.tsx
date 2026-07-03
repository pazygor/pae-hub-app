import { AppProviders } from './providers';
import { AppRouter } from './router';

const App = () => (
  <AppProviders>
    <AppRouter />
  </AppProviders>
);

export default App;
