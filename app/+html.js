import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ScrollViewStyleReset } from "expo-router/html";
/**
 * This file is web-only and used to configure the root HTML for every web page during static rendering.
 * The contents of this function only run in Node.js environments and do not have access to the DOM or browser APIs.
 */
export default function Root({ children }) {
    return (_jsxs("html", { lang: "en", children: [_jsxs("head", { children: [_jsx("meta", { charSet: "utf-8" }), _jsx("meta", { httpEquiv: "X-UA-Compatible", content: "IE=edge" }), _jsx("meta", { name: "viewport", content: "width=device-width, initial-scale=1, shrink-to-fit=no" }), _jsx(ScrollViewStyleReset, {}), _jsx("style", { dangerouslySetInnerHTML: { __html: responsiveBackground } })] }), _jsx("body", { children: children })] }));
}
const responsiveBackground = `
body {
  background-color: #fff;
}
@media (prefers-color-scheme: dark) {
  body {
    background-color: #000;
  }
}`;
