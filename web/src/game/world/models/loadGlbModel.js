// Load a GLB model and prepare it for cheap rendering:
//  - decode meshopt compression (used by our optimised assets)
//  - rotate/centre it into our vehicle frame (x = forward, y = up, 0 = rail top)
//  - MERGE all meshes that share a material → one draw call per material
// Returns [{ geometry, material }], ready for <mesh> or <instancedMesh>.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Copy any (possibly quantized/normalized) attribute into a plain float attribute. */
function toFloat32(attr) {
  if (attr.array instanceof Float32Array && !attr.normalized && !attr.isInterleavedBufferAttribute) return attr;
  const n = attr.count;
  const size = attr.itemSize;
  const out = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) out[i * size + c] = attr.getComponent(i, c);
  return new THREE.BufferAttribute(out, size);
}

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

/**
 * @param {string} url
 * @param {{ forwardAxis?: 'x'|'z', flip?: boolean, fit?: {length:number,height:number,width:number,lift?:number} }} opts
 *   forwardAxis: which model axis points forward. fit: stretch the model to
 *   real-world dimensions (metres), then raise it by `lift` above the rail.
 */
export function loadMergedModel(url, { forwardAxis = 'z', flip = false, fit = null } = {}) {
  if (!cache.has(url)) {
    cache.set(
      url,
      loader.loadAsync(url).then((gltf) => {
        const root = gltf.scene;
        if (forwardAxis === 'z') root.rotation.y = flip ? -Math.PI / 2 : Math.PI / 2; // model +z → our +x
        else if (flip) root.rotation.y = Math.PI;
        root.updateMatrixWorld(true);

        const byMaterial = new Map();
        root.traverse((obj) => {
          if (!obj.isMesh) return;
          const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
          for (const name of Object.keys(g.attributes)) {
            if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
            // Optimised GLBs store vertices as compressed 16-bit integers. They must
            // be expanded to float BEFORE transforming, or values clamp to ±1.
            else g.setAttribute(name, toFloat32(g.attributes[name]));
          }
          g.applyMatrix4(obj.matrixWorld);
          if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (!g.attributes.normal) g.computeVertexNormals();
          const mat = obj.material;
          if (!byMaterial.has(mat)) byMaterial.set(mat, []);
          byMaterial.get(mat).push(g);
        });

        const parts = [];
        for (const [material, geos] of byMaterial) {
          const geometry = mergeGeometries(geos, false);
          geos.forEach((g) => g.dispose());
          geometry.computeBoundingSphere();
          material.envMapIntensity = 0.9;
          if (material.transparent) material.depthWrite = false; // glass
          parts.push({ geometry, material, name: material.name });
        }
        // Centre along x so the model's middle is our vehicle centre
        const box = new THREE.Box3();
        parts.forEach((p) => {
          p.geometry.computeBoundingBox();
          box.union(p.geometry.boundingBox);
        });
        const cx = (box.min.x + box.max.x) / 2;
        const cz = (box.min.z + box.max.z) / 2;
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = fit ? [fit.length / size.x, fit.height / size.y, fit.width / size.z] : [1, 1, 1];
        parts.forEach((p) => {
          p.geometry.translate(-cx, -box.min.y, -cz);
          if (fit) {
            p.geometry.scale(...scale);
            p.geometry.translate(0, fit.lift ?? 0, 0);
            p.geometry.computeVertexNormals();
          }
          p.geometry.computeBoundingSphere();
        });
        return { parts, length: fit ? fit.length : size.x };
      }),
    );
  }
  return cache.get(url);
}
