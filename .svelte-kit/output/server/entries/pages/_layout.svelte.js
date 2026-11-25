import { c as create_ssr_component, b as add_attribute } from "../../chunks/ssr.js";
const Layout = create_ssr_component(($$result, $$props, $$bindings, slots) => {
  let canvas;
  return `<canvas id="wave-underlay" aria-hidden="true"${add_attribute("this", canvas, 0)}></canvas> ${slots.default ? slots.default({}) : ``}`;
});
export {
  Layout as default
};
