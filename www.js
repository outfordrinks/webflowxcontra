import * as THREE from "https://esm.sh/three@0.166.0";
import { GLTFLoader } from "https://esm.sh/three@0.166.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://esm.sh/three@0.166.0/examples/jsm/loaders/DRACOLoader.js";

// Прелоадер
(function() {
  const preloader = document.createElement('div');
  preloader.id = 'preloader';
  preloader.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.5s ease-out;
  `;
  
  const circle = document.createElement('div');
  circle.style.cssText = `
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: #E1FF71;
    box-shadow: 0 0 20px rgba(225, 255, 113, 0.6);
    animation: blink 1s ease-in-out infinite;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes blink {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.3;
        transform: scale(0.8);
      }
    }
  `;
  
  document.head.appendChild(style);
  preloader.appendChild(circle);
  document.body.appendChild(preloader);
  
  window.hidePreloader = function() {
    preloader.style.opacity = '0';
    setTimeout(() => {
      preloader.remove();
    }, 500);
  };
})();

const CONFIG = {
  camera: { 
    fov: 25, 
    near: 0.1, 
    far: 1000, 
    positionZ: 24 
  },
  hearts: {
    count: 20,
    visualRadius: 200,
    padding: 20,
    repulsionForce: 2.0,
    damping: 2.98,
    maxSpeed: 25,
    maxSpeedSquared: 25 * 25,
    gravity: 1.0,
    layers: [0, -3, -6],
    bounce: 0.9,
    boundaryMargin: 20,
    collisionCheckInterval: 1,
    startDelay: 1500,
    spawnInterval: 150,
    spawnOffsetY: -300,
    spawnRangeY: 2,
    initialVelocityX: 2
  },
  lighting: {
    hemisphere: { 
      color: 0xfff5e6, 
      groundColor: 0xffd4e6, 
      intensity: 1.2 
    },
    main: {
      color: 0xfff5e6, 
      intensity: 1.8,
      position: { x: 3, y: 5, z: 4 },
      shadow: { 
        mapSize: 2048, 
        near: 0.5, 
        far: 20, 
        radius: 2, 
        bias: -0.0001 
      }
    },
    rim: { 
      color: 0xffd9e6, 
      intensity: 1.3, 
      position: { x: -4, y: 2, z: -3 } 
    },
    fill: { 
      color: 0xffe8f0, 
      intensity: 1.0, 
      position: { x: -2, y: 3, z: -2 } 
    },
    ambient: { 
      color: 0xffffff, 
      intensity: 0.4 
    }
  },
  renderer: {
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.0,
    shadowMap: { 
      enabled: true, 
      type: THREE.PCFSoftShadowMap 
    },
    dithering: true
  },
  materials: { 
    aoMapIntensity: 0.7, 
    textureAnisotropy: 8, 
    roughness: 0.85, 
    metalness: 0.0 
  },
  textures: {
    roughness: "https://cdn.jsdelivr.net/gh/outfordrinks/webflowxcontra@main/Grass005_2K-JPG_Roughness.jpg",
    ao: "https://cdn.jsdelivr.net/gh/outfordrinks/webflowxcontra@main/Grass005_2K-JPG_AmbientOcclusion.jpg"
  },
  model: {
    path: "https://cdn.jsdelivr.net/gh/outfordrinks/webflowxcontra@main/heart-logo-final.glb"
  },
  debug: false
};

class Viewport {
  constructor() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  update() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }
}

const viewport = new Viewport();

function calculateWorldSpace(camera, viewport) {
  const camDist = camera.position.z;
  const fovRad = (CONFIG.camera.fov * Math.PI) / 180;
  const posH = 2 * camDist * Math.tan(fovRad / 2);
  const posW = posH * (viewport.width / viewport.height);
  const pixelsPerUnit = viewport.height / posH;
  return { visW: posW, visH: posH, pixelsPerUnit };
}

function configureTexture(texture) {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = CONFIG.materials.textureAnisotropy;
  return texture;
}

class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }
  
  clear() {
    this.grid.clear();
  }
  
  _hash(x, y) {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }
  
  insert(heart) {
    const key = this._hash(heart.x, heart.y);
    if (!this.grid.has(key)) {
      this.grid.set(key, []);
    }
    this.grid.get(key).push(heart);
  }
  
  getNearby(heart) {
    const nearby = [];
    const cellX = Math.floor(heart.x / this.cellSize);
    const cellY = Math.floor(heart.y / this.cellSize);
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const cell = this.grid.get(key);
        if (cell) {
          nearby.push(...cell);
        }
      }
    }
    
    return nearby;
  }
}

class Heart {
  constructor(viewport) {
    this.initializePosition(viewport);
    this.initializePhysics();
    this.initializeVisuals();
  }
  
  initializePosition(viewport) {
    this.x = Math.random() * viewport.width;
    this.y = -Math.random() * viewport.height * CONFIG.hearts.spawnRangeY - CONFIG.hearts.spawnOffsetY;
    this.z = CONFIG.hearts.layers[
      Math.floor(Math.random() * CONFIG.hearts.layers.length)
    ];
  }
  
  initializePhysics() {
    this.radius = CONFIG.hearts.visualRadius + CONFIG.hearts.padding;
    this.vx = (Math.random() - 0.5) * CONFIG.hearts.initialVelocityX;
    this.vy = 0;
  }
  
  initializeVisuals() {
    this.rotationSpeed = (Math.random() - 0.5) * 0.005;
    this.mesh = null;
    this.active = false;
  }
  
  applyRepulsion(nearby) {
    for (const other of nearby) {
      if (other === this || !other.active) continue;
      if (Math.abs(other.z - this.z) > 1) continue;
      
      const dx = this.x - other.x;
      const dy = this.y - other.y;
      const distSq = dx * dx + dy * dy;
      const minDist = this.radius + other.radius;
      const minDistSq = minDist * minDist;
      
      if (distSq < minDistSq && distSq > 1) {
        this.handleCollision(other, dx, dy, distSq, minDist);
      }
    }
  }
  
  handleCollision(other, dx, dy, distSq, minDist) {
    const distance = Math.sqrt(distSq);
    const nx = dx / distance;
    const ny = dy / distance;
    
    const relativeVx = this.vx - other.vx;
    const relativeVy = this.vy - other.vy;
    const relativeSpeed = relativeVx * nx + relativeVy * ny;
    
    if (relativeSpeed < 0) {
      const bounceImpulse = relativeSpeed * CONFIG.hearts.bounce;
      this.vx -= bounceImpulse * nx;
      this.vy -= bounceImpulse * ny;
      other.vx += bounceImpulse * nx;
      other.vy += bounceImpulse * ny;
    }
    
    const overlap = minDist - distance;
    const separationForce = overlap * CONFIG.hearts.repulsionForce;
    this.vx += nx * separationForce;
    this.vy += ny * separationForce;
    other.vx -= nx * separationForce;
    other.vy -= ny * separationForce;
  }
  
  applyBoundaries(viewport) {
    const { boundaryMargin, bounce } = CONFIG.hearts;
    
    if (this.x < -boundaryMargin) {
      this.x = -boundaryMargin;
      this.vx = Math.abs(this.vx) * bounce;
    } else if (this.x > viewport.width + boundaryMargin) {
      this.x = viewport.width + boundaryMargin;
      this.vx = -Math.abs(this.vx) * bounce;
    }
    
    if (this.y < -boundaryMargin) {
      this.y = -boundaryMargin;
      this.vy = Math.abs(this.vy) * bounce;
    } else if (this.y > viewport.height + boundaryMargin) {
      this.y = viewport.height + boundaryMargin;
      this.vy = -Math.abs(this.vy) * bounce;
    }
  }
  
  limitSpeed() {
    const speedSq = this.vx * this.vx + this.vy * this.vy;
    if (speedSq > CONFIG.hearts.maxSpeedSquared) {
      const speed = Math.sqrt(speedSq);
      const scale = CONFIG.hearts.maxSpeed / speed;
      this.vx *= scale;
      this.vy *= scale;
    }
  }
  
  updateMesh(camera) {
    if (!this.mesh) return;
    
    const { visW, visH } = calculateWorldSpace(camera, viewport);
    const worldX = ((this.x / viewport.width) - 0.5) * visW;
    const worldY = -((this.y / viewport.height) - 0.5) * visH;
    
    this.mesh.position.set(worldX, worldY, this.z);
    this.mesh.rotation.y += this.rotationSpeed;
    this.mesh.rotation.x += this.rotationSpeed * 0.3;
  }
  
  update(nearby, viewport, camera) {
    if (!this.active) return;
    
    this.vy += CONFIG.hearts.gravity;
    this.applyRepulsion(nearby);
    this.limitSpeed();
    this.x += this.vx;
    this.y += this.vy;
    this.applyBoundaries(viewport);
    this.vx *= CONFIG.hearts.damping;
    this.vy *= CONFIG.hearts.damping;
    this.updateMesh(camera);
  }
}

class SceneSetup {
  static createRenderer() {
    const canvas = document.querySelector('[data-canvas="hearts"]');
    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      alpha: true, 
      antialias: true 
    });
    
    renderer.setSize(viewport.width, viewport.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = CONFIG.renderer.shadowMap.enabled;
    renderer.shadowMap.type = CONFIG.renderer.shadowMap.type;
    renderer.toneMapping = CONFIG.renderer.toneMapping;
    renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.dithering = CONFIG.renderer.dithering;
    
    return renderer;
  }
  
  static createCamera() {
    const camera = new THREE.PerspectiveCamera(
      CONFIG.camera.fov,
      viewport.width / viewport.height,
      CONFIG.camera.near,
      CONFIG.camera.far
    );
    camera.position.z = CONFIG.camera.positionZ;
    return camera;
  }
  
  static setupLighting(scene) {
    const { lighting } = CONFIG;
    
    scene.add(new THREE.HemisphereLight(
      lighting.hemisphere.color,
      lighting.hemisphere.groundColor,
      lighting.hemisphere.intensity
    ));
    
    const mainLight = new THREE.DirectionalLight(
      lighting.main.color, 
      lighting.main.intensity
    );
    mainLight.position.set(
      lighting.main.position.x,
      lighting.main.position.y,
      lighting.main.position.z
    );
    mainLight.castShadow = true;
    const shadow = lighting.main.shadow;
    mainLight.shadow.mapSize.width = shadow.mapSize;
    mainLight.shadow.mapSize.height = shadow.mapSize;
    mainLight.shadow.camera.near = shadow.near;
    mainLight.shadow.camera.far = shadow.far;
    mainLight.shadow.radius = shadow.radius;
    mainLight.shadow.bias = shadow.bias;
    scene.add(mainLight);
    
    const rimLight = new THREE.DirectionalLight(
      lighting.rim.color, 
      lighting.rim.intensity
    );
    rimLight.position.set(
      lighting.rim.position.x,
      lighting.rim.position.y,
      lighting.rim.position.z
    );
    scene.add(rimLight);
    
    const fillLight = new THREE.DirectionalLight(
      lighting.fill.color, 
      lighting.fill.intensity
    );
    fillLight.position.set(
      lighting.fill.position.x,
      lighting.fill.position.y,
      lighting.fill.position.z
    );
    scene.add(fillLight);
    
    scene.add(new THREE.AmbientLight(
      lighting.ambient.color, 
      lighting.ambient.intensity
    ));
  }
  
  static loadTextures() {
    const loader = new THREE.TextureLoader();
    const roughnessMap = configureTexture(
      loader.load(CONFIG.textures.roughness)
    );
    const aoMap = configureTexture(
      loader.load(CONFIG.textures.ao)
    );
    return { roughnessMap, aoMap };
  }
  
  static applyMaterials(template, textures) {
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
  
  static setupShadows(mesh) {
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }
}

class HeartManager {
  constructor(scene, camera, textures) {
    this.scene = scene;
    this.camera = camera;
    this.textures = textures;
    this.hearts = [];
    this.spatialGrid = new SpatialGrid(
      (CONFIG.hearts.visualRadius + CONFIG.hearts.padding) * 2
    );
    this.frameCount = 0;
    this.animationStarted = false;
  }
  
  createHearts() {
    for (let i = 0; i < CONFIG.hearts.count; i++) {
      this.hearts.push(new Heart(viewport));
    }
  }
  
  createMeshes(heartTemplate) {
    const { pixelsPerUnit } = calculateWorldSpace(this.camera, viewport);
    const box = new THREE.Box3().setFromObject(heartTemplate);
    const modelSize = box.getSize(new THREE.Vector3());
    const modelMaxDimension = Math.max(
      modelSize.x, 
      modelSize.y, 
      modelSize.z
    );
    
    const visualRadius3D = CONFIG.hearts.visualRadius / pixelsPerUnit;
    const scale = (visualRadius3D * 2) / modelMaxDimension;
    
    if (CONFIG.debug) {
      console.log('=== Heart Scaling Debug ===');
      console.log('visualRadius (px):', CONFIG.hearts.visualRadius);
      console.log('pixelsPerUnit:', pixelsPerUnit);
      console.log('modelMaxDimension:', modelMaxDimension);
      console.log('visualRadius3D (world units):', visualRadius3D);
      console.log('Final scale:', scale);
      console.log('==========================');
    }
    
    this.hearts.forEach((heart) => {
      const mesh = heartTemplate.clone();
      mesh.scale.set(scale, scale, scale);
      
      mesh.rotation.set(
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 0.8
      );
      
      mesh.visible = false;
      SceneSetup.setupShadows(mesh);
      this.scene.add(mesh);
      
      heart.mesh = mesh;
    });
  }
  
  startAnimation() {
    this.animationStarted = true;
    this.frameCount = 0;
    
    this.hearts.forEach((heart, index) => {
      setTimeout(() => {
        if (heart.mesh) {
          heart.mesh.visible = true;
          heart.active = true;
        }
      }, index * CONFIG.hearts.spawnInterval);
    });
  }
  
  updateSpatialGrid() {
    this.spatialGrid.clear();
    this.hearts.forEach(heart => {
      if (heart.active) {
        this.spatialGrid.insert(heart);
      }
    });
  }
  
  updateHearts(checkCollisions) {
    this.hearts.forEach((heart) => {
      const nearby = checkCollisions 
        ? this.spatialGrid.getNearby(heart) 
        : [];
      heart.update(nearby, viewport, this.camera);
    });
  }
  
  update() {
    if (!this.animationStarted) return;
    
    this.frameCount++;
    const checkCollisions = 
      this.frameCount % CONFIG.hearts.collisionCheckInterval === 0;
    
    if (checkCollisions) {
      this.updateSpatialGrid();
      this.updateHearts(true);
    } else {
      this.updateHearts(false);
    }
  }
}

const scene = new THREE.Scene();
const camera = SceneSetup.createCamera();
const renderer = SceneSetup.createRenderer();
SceneSetup.setupLighting(scene);
const textures = SceneSetup.loadTextures();

const heartManager = new HeartManager(scene, camera, textures);
heartManager.createHearts();

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(CONFIG.model.path, (gltf) => {
  const heartTemplate = gltf.scene;
  SceneSetup.applyMaterials(heartTemplate, textures);
  heartManager.createMeshes(heartTemplate);
  
  setTimeout(() => {
    heartManager.startAnimation();
    if (window.hidePreloader) {
      window.hidePreloader();
    }
  }, CONFIG.hearts.startDelay);
});

function handleResize() {
  viewport.update();
  camera.aspect = viewport.width / viewport.height;
  camera.updateProjectionMatrix();
  renderer.setSize(viewport.width, viewport.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener("resize", handleResize);

renderer.setAnimationLoop(() => {
  heartManager.update();
  renderer.render(scene, camera);
});
