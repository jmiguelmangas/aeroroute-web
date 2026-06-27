import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Preview } from "@storybook/react-vite";
import { createElement } from "react";

import "../src/styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const preview: Preview = {
  decorators: [
    (Story) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(Story)
      ),
  ],
  parameters: {
    a11y: { test: "error" },
    backgrounds: {
      options: {
        cockpit: { name: "Cockpit", value: "#020b17" },
        panel: { name: "Panel", value: "#071a2d" },
      },
    },
    controls: { expanded: true },
    layout: "centered",
  },
  initialGlobals: { backgrounds: { value: "cockpit" } },
};

export default preview;
