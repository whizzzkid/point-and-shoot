/// <reference lib="dom" />
/**
 * Options-page entry point. Wave 3 renders the theme override and other settings; this placeholder
 * only proves the bundle boots and mounts in a real options page.
 *
 * @module
 */

import { render } from "preact";

function App() {
  return <div>Point and Shoot — options (wave 3)</div>;
}

const root = document.getElementById("app");
if (root === null) throw new Error("options/index.html is missing #app");
render(<App />, root);
