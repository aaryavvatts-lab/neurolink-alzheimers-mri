/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the whole site is HTML/JS/WASM on a CDN. There is no server,
  // because there is no server-side inference -- the model runs in the browser.
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
};
export default nextConfig;
