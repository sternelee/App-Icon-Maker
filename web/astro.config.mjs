// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Vite plugin to rewrite bare Node.js built-in imports to node: prefixed.
function nodeBuiltinsPlugin() {
  const modules = ["util", "crypto", "async_hooks", "stream", "path", "os", "events", "buffer", "process", "assert", "util/types", "string_decoder", "sys", "tty", "domain", "constants", "timers", "querystring", "url", "zlib", "http", "https", "net", "tls", "fs", "child_process"];
  return {
    name: "node-builtins-to-node-prefix",
    generateBundle(options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk" && typeof file.code === "string") {
          for (const mod of modules) {
            const escaped = mod.replace("/", "\\/");
            file.code = file.code.replace(new RegExp(`from\\s+['"]${escaped}['"]`, "g"), (m) => m.replace(`'${mod}'`, "'node:" + mod + "'"));
            file.code = file.code.replace(new RegExp(`require\\(['"]${escaped}['"]\\)`, "g"), (m) => m.replace(`'${mod}'`, "'node:" + mod + "'"));
          }
        }
      }
    },
  };
}

// Plugin to remove MessageChannel-dependent code from react-dom/server.browser.
function stripBrowserServerPlugin() {
  return {
    name: "strip-browser-server",
    generateBundle(options, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk" && typeof file.code === "string") {
          file.code = file.code.replace(
            /var channel = new MessageChannel\(\),[\s\S]*?channel\.port2\.postMessage\(null\);\s*\}/g,
            "var channel = null, taskQueue = []; function scheduleWork(callback) { taskQueue.push(callback); }"
          );
        }
      }
    },
  };
}

export default defineConfig({
  output: "server",
  adapter: cloudflare({ 
    imageService: "passthrough"
  }),
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      nodeBuiltinsPlugin(),
      stripBrowserServerPlugin(),
      {
        name: "force-react-dom-server-node",
        resolveId(id) {
          if (id === "react-dom/server") {
            return resolve(__dirname, "node_modules/react-dom/server.node.js");
          }
        },
      },
    ],
    ssr: {
      resolve: {
        conditions: ["node", "module"],
      },
      external: [],
    },
    optimizeDeps: {
      include: [
        "react-dom/client",
        "@base-ui/react/select",
        "use-sync-external-store/shim",
      ],
    },
  },
});
