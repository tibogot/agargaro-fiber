import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { InstancedMesh2 } from "@three.ez/instanced-mesh";
import { simplifyGeometriesByError } from "@three.ez/simplify-geometry";
import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Material,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  RepeatWrapping,
  TextureLoader,
  Vector3,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OctahedralImpostor } from "../core/octahedralImpostor";
import { Terrain, type TerrainParams } from "./TerrainClass";

interface WorldProps {
  onLoadingChange?: (loading: boolean) => void;
}

export function World({ onLoadingChange }: WorldProps) {
  const { gl, scene, camera } = useThree();
  const directionalLightRef = useRef<DirectionalLight>(null);
  const sunOffsetRef = useRef(
    new Vector3(1, 1, 0).normalize().multiplyScalar(1000)
  );
  const terrainRef = useRef<Terrain<MeshStandardMaterial> | null>(null);
  const rendererRef = useRef(gl);
  const sceneRef = useRef(scene);
  const cameraRef = useRef(camera);

  // Setup renderer (exact copy of original lines 14-17, 24)
  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => {
    rendererRef.current = gl;
    // In R3F, gl, scene, and camera are mutable objects - these modifications are allowed
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.7;
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = PCFSoftShadowMap;
    gl.setPixelRatio(Math.min(1.25, window.devicePixelRatio));
  }, [gl]);

  // Setup scene (exact copy of original lines 31, 54)
  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => {
    sceneRef.current = scene;
    scene.background = new Color("cyan");
    scene.fog = new FogExp2("cyan", 0.0015);
  }, [scene]);

  // Setup camera (exact copy of original line 10)
  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => {
    cameraRef.current = camera;
    camera.position.set(0, 50, 0);
    camera.near = 0.1;
    camera.far = 1200;
    camera.updateProjectionMatrix();
  }, [camera]);

  // Load tree model and setup scene (exact copy of original lines 26-126)
  useEffect(() => {
    let mounted = true;

    async function loadScene() {
      try {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync("/Pine_5.gltf");

        if (!mounted) return;

        const treeGroup = gltf.scene.children[0];
        if (treeGroup) {
          // Exact copy of original lines 28-29
          treeGroup.children[0].renderOrder = 2;
          if (treeGroup.children[1]) {
            treeGroup.children[1].renderOrder = 1;
          }
        }

        // Setup lights (exact copy of original lines 33-52)
        const directionalLight = new DirectionalLight("white", 1.5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.set(2048, 2048);
        directionalLight.shadow.camera.left = -450;
        directionalLight.shadow.camera.right = 450;
        directionalLight.shadow.camera.top = 450;
        directionalLight.shadow.camera.bottom = -450;
        directionalLight.shadow.camera.far = 5000;
        directionalLight.shadow.camera.updateProjectionMatrix();
        scene.add(directionalLight, directionalLight.target);
        directionalLightRef.current = directionalLight;

        const ambientLight = new AmbientLight("white", 2);
        scene.add(ambientLight);

        // TERRAIN (exact copy of original lines 56-84)
        const textureLoader = new TextureLoader();
        const grassMap = await textureLoader.loadAsync("/grass.jpg");
        grassMap.wrapS = grassMap.wrapT = RepeatWrapping;
        grassMap.repeat.set(50, 50);

        const options: TerrainParams = {
          maxChunksX: 24,
          maxChunksZ: 24,
          chunkSize: 128,
          segments: 56,
          frequency: 0.001,
          amplitude: 150,
          octaves: 4,
          lacunarity: 3,
          gain: 0.2,
        };

        const terrain = new Terrain(
          new MeshStandardMaterial({ color: 0x888888, map: grassMap }),
          options
        );
        terrain.renderOrder = -1;
        terrain.receiveShadow = true;
        terrain.castShadow = true;

        for (
          let x = -(options.maxChunksX / 2);
          x < options.maxChunksX / 2;
          x++
        ) {
          for (
            let z = -(options.maxChunksZ / 2);
            z < options.maxChunksZ / 2;
            z++
          ) {
            await terrain.addChunk(x, z);
          }
        }
        scene.add(terrain);
        terrainRef.current = terrain;

        // TREES AND IMPOSTORS (exact copy of original lines 86-120)
        const mergedGeo = mergeGeometries(
          treeGroup.children
            .filter((x): x is Mesh => (x as Mesh).isMesh)
            .map((x) => x.geometry),
          true
        );
        const materials = treeGroup.children
          .filter((x): x is Mesh => (x as Mesh).isMesh)
          .map((x) => x.material as Material);

        const pos = await terrain.generateTrees(200_000);

        // Exact copy of original line 93
        const iMesh = new InstancedMesh2(mergedGeo, materials, {
          createEntities: true,
          renderer: gl,
          capacity: pos.length,
        });

        // Exact copy of original lines 95-99
        iMesh.addInstances(pos.length, (obj, index) => {
          obj.position.copy(pos[index]);
          obj
            .rotateY(Math.random() * Math.PI * 2)
            .rotateX(Math.random() * 0.5 - 0.25);
          obj.scale.setScalar(Math.random() * 0.5 + 0.75);
        });

        // Exact copy of original lines 101-110
        const impostor = new OctahedralImpostor({
          renderer: gl,
          target: treeGroup,
          useHemiOctahedron: true,
          transparent: false,
          alphaClamp: 0.5,
          spritesPerSide: 24,
          textureSize: 4096,
          baseType: MeshStandardMaterial,
        });

        // Exact copy of original lines 112-113
        const LODGeo = await simplifyGeometriesByError(
          treeGroup.children
            .filter((x): x is Mesh => (x as Mesh).isMesh)
            .map((x) => x.geometry),
          0.05
        );
        const mergedGeoLOD = mergeGeometries(LODGeo, true);

        // Exact copy of original lines 115-117
        iMesh.addLOD(
          mergedGeoLOD,
          treeGroup.children
            .filter((x): x is Mesh => (x as Mesh).isMesh)
            .map((x) => ((x as Mesh).material as Material).clone()),
          10
        );
        iMesh.addLOD(impostor.geometry, impostor.material, 50);
        iMesh.addShadowLOD(new BoxGeometry(3, 10, 3));
        iMesh.computeBVH();

        scene.add(iMesh);

        onLoadingChange?.(false);
      } catch (error) {
        console.error("Error loading scene:", error);
        onLoadingChange?.(false);
      }
    }

    loadScene();

    return () => {
      mounted = false;
    };
  }, [gl, scene, onLoadingChange]);

  // Update directional light position based on camera (exact copy of original lines 45-49)
  useFrame(() => {
    if (directionalLightRef.current) {
      const light = directionalLightRef.current;
      light.position.copy(camera.position).add(sunOffsetRef.current);
      light.target.position.copy(camera.position).sub(sunOffsetRef.current);
    }
  });

  return (
    <>
      <OrbitControls
        maxPolarAngle={Math.PI / 2}
        target={[100, 0, 0]}
        makeDefault
      />
      {/* Terrain and InstancedMesh2 are added directly to scene in useEffect, not via JSX */}
    </>
  );
}
