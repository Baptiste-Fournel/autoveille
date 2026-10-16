import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import './styles.css';
import { startApplication } from './app/startApplication';

const root = document.getElementById('app');

if (root !== null) {
  void startApplication({ fetch: (input, init) => window.fetch(input, init), window }, root);
}
