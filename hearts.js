<!-- Matter.js v0.20.0 -->
<script src="https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js"></script>

<!-- THREE.js v0.180.0 -->
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
  }
}
</script>

<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

document.addEventListener("DOMContentLoaded", () => {
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
      hemisphere: { color: 0xfff5e6, groundColor: 0xffd4e6, intensity: 1.8 },
      main: {
        color: 0xfff5e6,
        intensity: 2.8,
        position: { x: 3, y: 5, z: 4 },
        shadow: { mapSize: 4096, near: 0.5, far: 20, radius: 2, bias: -0.0001 }
      },
      rim: { color: 0xffd9e6, intensity: 2.0, position: { x: -4, y: 2, z: -3 } },
      fill: { color: 0xffe8f0, intensity: 1.4, position: { x: -2, y: 3, z: -2 } },
      ambient: { color: 0xffffff, intensity: 0.7 }
    },
    renderer: {
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.3,
      shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap },
      dithering: true
    },
    materials: { aoMapIntensity: 0.5, textureAnisotropy: 8 },
    textures: {
      roughness: "3d/Grass005_2K-JPG/Grass005_2K-JPG_Roughness.jpg",
      ao: "3d/Grass005_2K-JPG/Grass005_2K-JPG_AmbientOcclusion.jpg"
    },
    model: { path: "3d/heart-new/heart-logo-final.glb" }
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

      this.body = Matter.Bodies.circle(x, y, this.radius, {
        render: { fillStyle: "transparent" }
      });

      Matter.Body.setAngle(this.body, Math.random() * Math.PI * 2);
      Matter.Body.setAngularVelocity(this.body, (Math.random() - 0.5) * 0.05);
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

    const ground = Matter.Bodies.rectangle(viewport.width / 2, viewport.height + groundOffset, wallWidth, groundThickness, { isStatic: true });
    const wall1 = Matter.Bodies.rectangle(-wallOffset, viewport.height / 2, wallThickness, viewport.height * wallHeightMultiplier, { isStatic: true });
    const wall2 = Matter.Bodies.rectangle(viewport.width + wallOffset, viewport.height / 2, wallThickness, viewport.height * wallHeightMultiplier, { isStatic: true });

    Matter.World.add(engine.world, [ground, wall1, wall2]);
    return { ground, wall1, wall2 };
  }

  function initializePhysicsLayers() {
    return CONFIG.physics.layerConfig.map((layer) => {
      const engine = Matter.Engine.create();
      const hearts = [];

      for (let i = 0; i < CONFIG.physics.numCircles; i++) {
        hearts.push(new Heart(layer.visualRadius, layer.z));
      }

      const boundaries = createPhysicsBoundaries(engine, viewport);
      Matter.World.add(engine.world, hearts.map((h) => h.body));
      Matter.Engine.run(engine);
      return { engine, hearts, boundaries, layer };
    });
  }

  // ============================================================================
  // THREE.JS SETUP
  // ============================================================================
  function createRenderer(canvasId) {
    const canvas = document.getElementById(canvasId);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(viewport.width, viewport.height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = CONFIG.renderer.shadowMap.enabled;
    renderer.shadowMap.type = CONFIG.renderer.shadowMap.type;
    renderer.toneMapping = CONFIG.renderer.toneMapping;
    renderer.toneMappingExposure = CONFIG.renderer.toneMappingExposure;
    renderer.outputEncoding = THREE.sRGBEncoding; // ✅ актуальный метод
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
    const hemi = new THREE.HemisphereLight(lighting.hemisphere.color, lighting.hemisphere.groundColor, lighting.hemisphere.intensity);
    scene.add(hemi);

    const main = new THREE.DirectionalLight(lighting.main.color, lighting.main.intensity);
    main.position.set(lighting.main.position.x, lighting.main.position.y, lighting.main.position.z);
    main.castShadow = true;
    main.shadow.mapSize.width = lighting.main.shadow.mapSize;
    main.shadow.mapSize.height = lighting.main.shadow.mapSize;
    scene.add(main);

    const rim = new THREE.DirectionalLight(lighting.rim.color, lighting.rim.intensity);
    rim.position.set(lighting.rim.position.x, lighting.rim.position.y, lighting.rim.position.z);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(lighting.fill.color, lighting.fill.intensity);
    fill.position.set(lighting.fill.position.x, lighting.fill.position.y, lighting.fill.position.z);
    scene.add(fill);

    const ambient = new THREE.AmbientLight(lighting.ambient.color, lighting.ambient.intensity);
    scene.add(ambient);
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
        child.material.needsUpdate = true;
      }
    });
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  const scene = new THREE.Scene();
  const camera = createCamera();
  const renderer = createRenderer("three-canvas");
  setupLighting(scene);
  const textures = loadTextures();
  const physicsLayers = initializePhysicsLayers();

  physicsLayers.forEach((layerData) => {
    Matter.Events.on(layerData.engine, "afterUpdate", () => {
      layerData.hearts.forEach((heart) => heart.update(camera, viewport));
    });
  });

  const loader = new GLTFLoader();
  loader.load(CONFIG.model.path, (gltf) => {
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
        scene.add(mesh);
        heart.mesh = mesh;
      });
    });
  });

  // ============================================================================
  // RESIZE + LOOP
  // ============================================================================
  window.addEventListener("resize", () => {
    viewport.width = window.innerWidth;
    viewport.height = window.innerHeight;
    camera.aspect = viewport.width / viewport.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.width, viewport.height);
  });

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
});
</script>
