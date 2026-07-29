/// <reference lib="dom" />

import React from "react";
import { createRoot } from "react-dom/client";
import { createApp, defineComponent, h } from "vue";

const REACT_SOURCE = {
  columnNumber: 3,
  fileName: "/workspace/src/checkout/ReactCheckoutButton.tsx",
  lineNumber: 17,
};

function ReactCheckoutButton(): React.ReactElement {
  return React.createElement("button", {
    __source: REACT_SOURCE,
    id: "actual-react-probe",
  }, "React checkout");
}

const reactRoot = document.createElement("div");
reactRoot.id = "actual-react-root";
document.body.append(reactRoot);
createRoot(reactRoot).render(
  React.createElement(ReactCheckoutButton, { __source: REACT_SOURCE }),
);

const VueCheckoutButton = defineComponent({
  name: "VueCheckoutButton",
  setup() {
    return () => h("button", { id: "actual-vue-probe" }, "Vue checkout");
  },
});
(VueCheckoutButton as unknown as Record<string, unknown>).__file =
  "/workspace/src/checkout/VueCheckoutButton.vue";

const vueRoot = document.createElement("div");
vueRoot.id = "actual-vue-root";
document.body.append(vueRoot);
createApp(VueCheckoutButton).mount(vueRoot);
