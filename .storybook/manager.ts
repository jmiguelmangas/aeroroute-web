import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

addons.setConfig({
  theme: create({
    base: "dark",
    brandTitle: "AeroRoute Design System",
    brandUrl: "/",
    colorPrimary: "#4ea0ff",
    colorSecondary: "#2f74ee",
    appBg: "#020b17",
    appContentBg: "#071a2d",
    appBorderColor: "#28445f",
  }),
});
