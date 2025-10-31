// hearts.js — Falling Hearts Physics
// Compatible with Webflow + GitHub CDN

import * as THREE from "https://esm.sh/three@0.166.0";
import { GLTFLoader } from "https://esm.sh/three@0.166.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://esm.sh/three@0.166.0/examples/jsm/loaders/DRACOLoader.js";

const { Engine, Runner, Bodies, Body, World, Events } = Matter;

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  camera: { fov: 25, near: 0.1, far: 1000, positionZ: 24 },
  physics: {
    numCircles: 20,
    layerConfig: [
      { visualRadius: 140, z: 0 },
      { visualRadius: 140, z: -3 },
      { visualRadius: 140, z: -6 }
    ],
    boundaries: {
      groundOffset: 200,
      wallOffset: 200,
      groundThickness: 60,
      wallThickness: 60,
      wallWidth: 50000,
      wallHeightMultiplier: 2
    }
  },
  lighting: {
    hemisphere: { color: 0xfff5e6, groundColor: 0xffd4e6, intensity: 1.2 },
    main: {
      color: 0xfff5e6, intensity: 1.8,
      position: { x: 3, y: 5, z: 4 },
      shadow: { mapSize: 4096, near: 0.5, far: 20, radius: 2, bias: -0.0001 }
    },
    rim: { color: 0xffd9e6, intensity: 1.3, position: { x: -4, y: 2, z: -3 } },
    fill: { color: 0xffe8f0, intensity: 1.0, position: { x: -2, y: 3, z: -2 } },
    ambient: { color: 0xffffff, intensity: 0.4 }
  },
  renderer: {
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
    dithering: true
  },
  materials: { aoMapIntensity: 0.7, textureAnisotropy: 8, roughness: 0.85, metalness: 0.0 },
  textures: {
    roughness: "https://cdn.jsdelivr.net/gh/outfordrinks/webflowxcontra@main/Grass005_2K-JPG_Roughness.jpg",
    ao: "https://cdn.jsdelivr.net/gh/outfordrinks/webflowxcontra@main/Grass005_2K-JPG_AmbientOcclusion.jpg"
  },
  model: {
    path: "https://cdn.jsdelivr.net/gh/outfordrinks/webflowxcontra@main/heart-logo-final.glb"
  }
};

// ============================================================================
// UTILITIES
// ============================================================================
let viewport = { width: window.innerWidth, height: window.innerHeight };

function configureTexture(texture) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = CONFIG.materials.textureAnisotropy;
  return texture;
}

function calculateWorldSpace(camera, viewport) {
  const camDist = camera.position.z;
  const fovRad = (CONFIG.camera.fov * Math.PI) / 180;
  const visH = 2 * camDist * Math.tan(fovRad / 2);
  const visW = visH * (viewport.width / viewport.height);
  const pixelsPerUnit = viewport.height / visH;
  return { visW, visH, pixelsPerUnit };
}

// ============================================================================
// HEART CLASS
// ============================================================================
class Heart {
  constructor(visualRadius, zDepth) {
    const x = Math.random() * viewport.width;
    const y = Math.random() * -viewport.height * 6 - 500;
    this.visualRadius = visualRadius;
    this.radius = visualRadius + 8;
    this.zDepth = zDepth;
    this.mesh = null;
    this.body = Bodies.circle(x, y, this.radius, {
      render: { fillStyle: "transparent" }
    });
    Body.setAngle(this.body, Math.random() * Math.PI * 2);
    Body.setAngularVelocity(this.body, (Math.random() - 0.5) * 0.05);
  }

  update(camera, viewport) {
    this.pos = { x: this.body.position.x, y: this.body.position.y };
    if (!this.mesh) return;
    const { visW, visH } = calculateWorldSpace(camera, viewport);
    const worldX = ((this.pos.x / viewport.width) - 0.5) * visW;
    const worldY = -((this.pos.y / viewport.height) - 0.5) * visH;
    this.mesh.position.set(worldX, worldY, this.zDepth);
    this.mesh.rotation.z = -this.body.angle;
    this.mesh.rotation.x = Math.sin(this.body.angle) * 0.3;
    this.mesh.rotation.y = Math.cos(this.body.angle) * 0.4;
  }
}

// ============================================================================
// PHYSICS SETUP
// ============================================================================
function createPhysicsBoundaries(engine, viewport) {
  const { groundOffset, wallOffset, groundThickness, wallThickness, wallWidth, wallHeightMultiplier } = CONFIG.physics.boundaries;
  const ground = Bodies.rectangle(viewport.width / 2, viewport.height + groundOffset, wallWidth, groundThickness, { isStatic: true });
  const wall1 = Bodies.rectangle(-wallOffset, viewport.height / 2, wallThickness, viewport.height * wallHeightMultiplier, { isStatic: true });
  const wall2 = Bodies.rectangle(viewport.width + wallOffset, viewport.height / 2, wallThickness, viewport.height * wallHeightMultiplier, { isStatic: true });
  World.add(engine.world, [ground, wall1, wall2]);
  return { ground, wall1, wall2 };
}

function updatePhysicsBoundaries(boundaries, viewport) {
  if (!boundaries) return;
  const { groundOffset, wallOffset } = CONFIG.physics.boundaries;
  Body.setPosition(boundaries.wall2, Matter.Vector.create(viewport.width + wallOffset, viewport.height * 0.5));
  Body.setPosition(boundaries.ground, Matter.Vector.create(viewport.width * 0.5, viewport.height + groundOffset));
}

function initializePhysicsLayers() {
  return CONFIG.physics.layerConfig.map((layer) => {
    const engine = Engine.create();
    const hearts = [];
    for (let i = 0; i < CONFIG.physics.numCircles; i++) {
      hearts.push(new Heart(layer.visualRadius, layer.z));
    }
    const boundaries = createPhysicsBoundaries(engine, viewport);
    World.add(engine.world, hearts.map((h) => h.body));
    const runner = Runner.create();
    Runner.run(runner, engine);
    return { engine, hearts, boundaries, layer, runner };
  });
}

// ============================================================================
// THREE.JS SETUP
// ============================================================================
function createRenderer() {
  const canvas = document.querySelector('[data-canvas="hearts"]');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(viewport.width, viewport.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = CONFIG.renderer.shadowMap.enabled;
  renderer.shadowMap.type = CONFIG.renderer.shadowMap.type;
  renderer.toneMapping = CONFIG.renderer.toneMapping;
  renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.dithering = CONFIG.renderer.dithering;
  return renderer;
}

function createCamera() {
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, viewport.width / viewport.height, CONFIG.camera.near, CONFIG.camera.far);
  camera.position.z = CONFIG.camera.positionZ;
  return camera;
}

function setupLighting(scene) {
  const { lighting } = CONFIG;
  scene.add(new THREE.HemisphereLight(lighting.hemisphere.color, lighting.hemisphere.groundColor, lighting.hemisphere.intensity));
  const mainLight = new THREE.DirectionalLight(lighting.main.color, lighting.main.intensity);
  mainLight.position.set(lighting.main.position.x, lighting.main.position.y, lighting.main.position.z);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.width = lighting.main.shadow.mapSize;
  mainLight.shadow.mapSize.height = lighting.main.shadow.mapSize;
  mainLight.shadow.camera.near = lighting.main.shadow.near;
  mainLight.shadow.camera.far = lighting.main.shadow.far;
  mainLight.shadow.radius = lighting.main.shadow.radius;
  mainLight.shadow.bias = lighting.main.shadow.bias;
  scene.add(mainLight);
  const rimLight = new THREE.DirectionalLight(lighting.rim.color, lighting.rim.intensity);
  rimLight.position.set(lighting.rim.position.x, lighting.rim.position.y, lighting.rim.position.z);
  scene.add(rimLight);
  const fillLight = new THREE.DirectionalLight(lighting.fill.color, lighting.fill.intensity);
  fillLight.position.set(lighting.fill.position.x, lighting.fill.position.y, lighting.fill.position.z);
  scene.add(fillLight);
  scene.add(new THREE.AmbientLight(lighting.ambient.color, lighting.ambient.intensity));
}

function loadTextures() {
  const loader = new THREE.TextureLoader();
  const roughnessMap = configureTexture(loader.load(CONFIG.textures.roughness));
  const aoMap = configureTexture(loader.load(CONFIG.textures.ao));
  return { roughnessMap, aoMap };
}

function applyMaterialsToModel(template, textures) {
  template.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.roughnessMap = textures.roughnessMap;
      child.material.aoMap = textures.aoMap;
      child.material.aoMapIntensity = CONFIG.materials.aoMapIntensity;
      if (CONFIG.materials.roughness !== undefined) {
        child.material.roughness = CONFIG.materials.roughness;
      }
      if (CONFIG.materials.metalness !== undefined) {
        child.material.metalness = CONFIG.materials.metalness;
      }
      child.material.needsUpdate = true;
    }
  });
}

function setupMeshShadows(mesh) {
  mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================
const scene = new THREE.Scene();
const camera = createCamera();
const renderer = createRenderer();
setupLighting(scene);
const textures = loadTextures();
const physicsLayers = initializePhysicsLayers();

physicsLayers.forEach((layerData) => {
  Events.on(layerData.engine, "afterUpdate", () => {
    layerData.hearts.forEach((heart) => heart.update(camera, viewport));
  });
});

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(CONFIG.model.path, (gltf) => {
  const heartTemplate = gltf.scene;
  applyMaterialsToModel(heartTemplate, textures);
  const { pixelsPerUnit } = calculateWorldSpace(camera, viewport);
  const box = new THREE.Box3().setFromObject(heartTemplate);
  const modelSize = box.getSize(new THREE.Vector3());
  const modelMaxDimension = Math.max(modelSize.x, modelSize.y, modelSize.z);
  physicsLayers.forEach((layerData) => {
    layerData.hearts.forEach((heart) => {
      const mesh = heartTemplate.clone();
      const visualRadius3D = heart.visualRadius / pixelsPerUnit;
      const scale = (visualRadius3D * 2) / modelMaxDimension;
      mesh.scale.set(scale, scale, scale);
      setupMeshShadows(mesh);
      scene.add(mesh);
      heart.mesh = mesh;
    });
  });
});

window.addEventListener("resize", () => {
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  physicsLayers.forEach(layerData => {
    updatePhysicsBoundaries(layerData.boundaries, viewport);
  });
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.width, viewport.height);
});

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});

