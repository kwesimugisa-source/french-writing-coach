// preload.js
// This file runs before the renderer loads.
// It is used to safely expose minimal APIs to the browser window.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("frenchCoach", {
  ping: () => "pong",
});
