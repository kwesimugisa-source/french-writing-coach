const { app, BrowserWindow } = require("electron");
const path = require("path");
const http = require("http");
const handler = require("serve-handler");

let server = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#020617",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    // DEV: use Next dev server like before
    win.loadURL("http://localhost:3000");
  } else {
    // PROD: serve the static "out" folder over HTTP, like `npx serve out`
    const outDir = path.join(__dirname, "out");

    server = http.createServer((req, res) => {
      return handler(req, res, {
        public: outDir
      });
    });

    // listen on a random free port
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 3000;

      const url = `http://127.0.0.1:${port}`;
      win.loadURL(url);
    });
  }

  // optional: win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (server) {
    server.close();
    server = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
