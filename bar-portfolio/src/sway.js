import * as THREE from 'three';

/**
 * Vertex Shader: ใบต้นไม้โอนเอนตามลม (เปลี่ยนตำแหน่ง vertex แบบ realtime)
 */
export const swayUniforms = { uTime: { value: 0 } };

export function makeSwayMaterial(base) {
  const mat = base.clone();
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = swayUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // ตำแหน่ง vertex ในโลก ใช้คำนวณความสูงและเฟสของคลื่น
        vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
        // 0 ที่ระดับกระถาง -> 1 ที่ยอดต้น
        float k = clamp((wp.y - 0.5) / 0.9, 0.0, 1.0);
        float phase = uTime * 1.8 + wp.x * 2.5 + wp.y * 3.0;
        transformed.x += sin(phase) * 0.06 * k;
        transformed.z += cos(phase * 0.8 + 1.3) * 0.05 * k;
        transformed.y += sin(phase * 1.3) * 0.02 * k;`
      );
  };
  mat.customProgramCacheKey = () => 'leafSway';
  return mat;
}
