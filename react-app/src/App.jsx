import Layout from './Layout';
import DisplayOverlay from './DisplayOverlay';

function isDisplayMode() {
  return new URLSearchParams(window.location.search).get('display') === '1';
}

export default function App() {
  return isDisplayMode() ? <DisplayOverlay /> : <Layout />;
}
