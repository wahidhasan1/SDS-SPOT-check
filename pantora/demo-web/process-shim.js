// Minimal `process` global for modules that read process.env in the browser build.
export const process = { env: { NODE_ENV: "production" } };
