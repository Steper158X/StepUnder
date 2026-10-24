import { defineConfig, type Plugin } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

/** Where the phonetic lyrics converter fetches the Japanese dictionary from. */
const KUROMOJI_DICT_URL = "kuromoji-dict/";
const kuromojiDictDir = fileURLToPath(
  new URL("./node_modules/@patdx/kuromoji/dict/", import.meta.url),
);

/**
 * Ships kuromoji's dictionary next to the app (served in dev, copied on build)
 * so Japanese phonetic lyrics work offline. The files stay gzipped; the
 * loader in src/lib/phonetic.ts unpacks them.
 */
function kuromojiDict(): Plugin {
  return {
    name: "kuromoji-dict",
    configureServer(server) {
      server.middlewares.use(`/${KUROMOJI_DICT_URL}`, (req, res, next) => {
        const name = (req.url ?? "").replace(/^\/+/, "").split("?")[0];
        if (!/^[\w.]+\.dat\.gz$/.test(name)) return next();
        try {
          const data = readFileSync(kuromojiDictDir + name);
          res.setHeader("Content-Type", "application/octet-stream");
          res.end(data);
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      for (const name of readdirSync(kuromojiDictDir)) {
        this.emitFile({
          type: "asset",
          fileName: KUROMOJI_DICT_URL + name,
          source: readFileSync(kuromojiDictDir + name),
        });
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [solid(), tailwindcss(), kuromojiDict()],

  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
