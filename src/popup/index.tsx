/// <reference lib="dom" />
/**
 * Popup entry point. Wave 3 renders capture controls; this placeholder only proves the bundle
 * boots and mounts in a real popup.
 *
 * @module
 */

import { render } from "preact";

function App() {
  return <div>Point and Shoot — popup (wave 3)</div>;
}

const root = document.getElementById("app");
if (root === null) throw new Error("popup/index.html is missing #app");
render(<App />, root);
