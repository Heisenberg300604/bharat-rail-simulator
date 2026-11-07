// Pick a sensible default graphics preset from the GPU name the browser reports.
// Apple Silicon and discrete NVIDIA/AMD GPUs → high; Intel Iris Xe/Arc → medium;
// older Intel UHD/HD graphics → low. The player can always change it.
export function detectQuality() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return 'low';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const n = String(name).toLowerCase();
    if (/apple m\d|apple gpu|nvidia|geforce|rtx|gtx|radeon rx|radeon pro/.test(n)) return 'high';
    if (/iris xe|arc|radeon/.test(n)) return 'medium';
    if (/intel|uhd|hd graphics|mali|adreno|swiftshader|llvmpipe/.test(n)) return 'low';
    return 'medium';
  } catch {
    return 'medium';
  }
}
