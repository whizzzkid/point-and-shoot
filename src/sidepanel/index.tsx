/// <reference lib="dom" />
/**
 * Side-panel entry point. Wave 3 renders the notes list and plan view; this placeholder only
 * proves the bundle boots and mounts in a real panel.
 *
 * @module
 */

import { render } from "preact";

function App() {
  return <div>Point and Shoot — side panel (wave 3)</div>;
}

const root = document.getElementById("app");
if (root === null) throw new Error("sidepanel/index.html is missing #app");
render(<App />, root);
