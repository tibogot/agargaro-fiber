import { Material, Matrix4 } from 'three';

// Define IUniform type locally since it's not exported from three.js
export interface IUniform<T = any> {
  value: T;
}
import shaderChunkMapFragment from '../shaders/impostor/octahedral_impostor_shader_map_fragment.glsl';
import shaderChunkNormalFragmentBegin from '../shaders/impostor/octahedral_impostor_shader_normal_fragment_begin.glsl';
import shaderChunkParamsFragment from '../shaders/impostor/octahedral_impostor_shader_params_fragment.glsl';
import shaderChunkParamsVertex from '../shaders/impostor/octahedral_impostor_shader_params_vertex.glsl';
import shaderChunkVertex from '../shaders/impostor/octahedral_impostor_shader_vertex.glsl';
import { createTextureAtlas, type CreateTextureAtlasParams } from '../utils/createTextureAtlas';

// TODO: fix normal from top
// TODO: use not standard normalMap uniform
// TODO: use define to avoid paralax mapping if useless

export type OctahedralImpostorDefinesKeys = 'EZ_USE_HEMI_OCTAHEDRON' | 'EZ_USE_NORMAL' | 'EZ_USE_ORM' | 'EZ_TRANSPARENT';
export type OctahedralImpostorDefines = { [key in OctahedralImpostorDefinesKeys]?: boolean };

export type UniformValue<T> = T extends IUniform<infer U> ? U : never;
export type MaterialConstructor<T extends Material> = new () => T;

export interface OctahedralImpostorUniforms {
  spritesPerSide: IUniform<number>;
  // ormMap: IUniform<Texture>;
  // parallaxScale: IUniform<number>;
  alphaClamp: IUniform<number>;
  impostorTransform: IUniform<Matrix4>;
}

export interface CreateOctahedralImpostor<T extends Material> extends OctahedralImpostorMaterial, CreateTextureAtlasParams {
  baseType: MaterialConstructor<T>;
}

export interface OctahedralImpostorMaterial {
  transparent?: boolean;
  // parallaxScale?: number;
  alphaClamp?: number;
  transform?: Matrix4;
}

declare module 'three' {
  interface Material extends OctahedralImpostorMaterial {
    isOctahedralImpostorMaterial: boolean;
    ezImpostorUniforms?: OctahedralImpostorUniforms;
    ezImpostorDefines?: OctahedralImpostorDefines;
  }
}

export function createOctahedralImpostorMaterial<T extends Material>(parameters: CreateOctahedralImpostor<T>): T {
  if (!parameters) throw new Error('createOctahedralImpostorMaterial: parameters is required.');
  if (!parameters.baseType) throw new Error('createOctahedralImpostorMaterial: baseType is required.');
  if (!parameters.useHemiOctahedron) throw new Error('createOctahedralImpostorMaterial: useHemiOctahedron is required.');

  const { albedo, normalDepth } = createTextureAtlas(parameters); // TODO normal only if lights

  const material = new parameters.baseType();
  material.isOctahedralImpostorMaterial = true;
  material.transparent = parameters.transparent ?? false;
  (material as any).map = albedo; // TODO remove any
  (material as any).normalMap = normalDepth; // TODO only if lights

  material.ezImpostorDefines = {};

  if (parameters.useHemiOctahedron) material.ezImpostorDefines.EZ_USE_HEMI_OCTAHEDRON = true;
  if (parameters.transparent) material.ezImpostorDefines.EZ_TRANSPARENT = true;
  material.ezImpostorDefines.EZ_USE_NORMAL = true; // TODO only if lights
  // material.ezImpostorDefines.EZ_USE_ORM = true; // TODO only if lights

  const { transform, spritesPerSide, alphaClamp } = parameters;

  material.ezImpostorUniforms = {
    spritesPerSide: { value: spritesPerSide ?? 16 }, // TODO config default value
    // ormMap: { value: null },
    // parallaxScale: { value: parallaxScale ?? 0 },
    alphaClamp: { value: alphaClamp ?? 0.4 },
    impostorTransform: { value: transform }
  };

  overrideMaterialCompilation(material);

  return material;
}

function overrideMaterialCompilation(material: Material): void {
  const onBeforeCompileBase = material.onBeforeCompile;

  material.onBeforeCompile = (shader, renderer) => {
    shader.defines = { ...shader.defines, ...material.ezImpostorDefines };
    shader.uniforms = { ...shader.uniforms, ...material.ezImpostorUniforms };

    shader.vertexShader = shader.vertexShader
      .replace('#include <clipping_planes_pars_vertex>', shaderChunkParamsVertex)
      .replace('#include <project_vertex>', shaderChunkVertex);

    // TODO improve
    shader.fragmentShader = shader.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `${shaderChunkMapFragment}\n vec4 diffuseColor = vec4( diffuse, opacity );`)
      .replace('#include <clipping_planes_pars_fragment>', shaderChunkParamsFragment)
      .replace('#include <normal_fragment_begin>', shaderChunkNormalFragmentBegin)
      .replace('#include <normal_fragment_maps>', '// #include <normal_fragment_maps>')
      .replace('#include <map_fragment>', 'diffuseColor *= blendedColor;'); // todo separate file

    onBeforeCompileBase?.call(material, shader, renderer);
  };

  const customProgramCacheKeyBase = material.customProgramCacheKey;

  material.customProgramCacheKey = () => {
    const hemiOcta = !!material.ezImpostorDefines.EZ_USE_HEMI_OCTAHEDRON;
    const useNormal = !!material.ezImpostorDefines.EZ_USE_NORMAL;
    const useOrm = !!material.ezImpostorDefines.EZ_USE_ORM;
    const transparent = !!material.transparent;

    return `ez_${hemiOcta}_${transparent}_${useNormal}_${useOrm}_${customProgramCacheKeyBase.call(material)}`;
  };
}

