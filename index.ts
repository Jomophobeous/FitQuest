import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';

// Suppress known Reanimated nested layout animation warnings (cosmetic, non-breaking)
LogBox.ignoreLogs([
  'Property "transform" of AnimatedComponent(View) may be overwritten by a layout animation',
]);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
