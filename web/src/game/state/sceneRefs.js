// Shared references to 3D objects that several components need to read each
// frame (e.g. the cameras follow the locomotive). Plain module object = no
// React re-renders.
export const sceneRefs = {
  locomotive: null, // THREE.Group of the locomotive, updated every frame
  gl: null, // WebGLRenderer (for debug stats)
};
