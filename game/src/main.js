// Tässä on käytetty pohjana Jolt fysiikkakirjaston javascript binding repon
// wheeled vehicle esimerkkiä, joka löytyy osoitteesta
// https://github.com/jrouwe/JoltPhysics.js/blob/main/Examples/vehicle_wheeled.html#L165
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import initJolt from 'jolt-physics';

const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_LAYERS = 2;

const State = {
   READY: 0,
   ERROR: 1,
   LOADING: 2,
};

const NetworkState = {
   CONNECTED: 0,
   DISCONNECTED: 1,
   CONNECTING: 2,
};

class Game {
   constructor() {
      // core
      this.scene = null;
      this.camera = null;
      this.cameraMode = 'orbit';
      this.renderer = null;
      this.texLoader = null;
      this.gltfLoader = null;
      this.clock = null;

      // physics
      this.Jolt = null;
      this.joltInterface = null;
      this.physicsSystem = null;
      this.bodyInterface = null;
      this.previousForward = 1.0;
      this.tempVec = null;
      this.tempRVec = null;
      this.tempQuat = null;
      this.dynamicObjects = [];
      this.staticObjects = [];

      // ui
      this.state = State.LOADING;
      this.overlay = null;
      this.overlayContent = null;
      this.canvasContainer = document.getElementById('gameCanvas');
      this.uiOverlay = document.getElementById('gameUi');
      this.uiDynamicContainer = null;
      this.currentRPM = 0;
      this.RpmGaugeSvg = null;
      this.RpmGaugeNeedle = null;


      this.debugLog = [];
      this.debugLogContainer = null;

      // player
      this.controls = null;
      this.playerPosition = null;
      this.playerRotation = null;
      this.playerVelocity = null;
      this.playerController = null;
      this.keyState = {};
      this.playerId = window.playerId || 123;

      // vehicle physics and rendering
      this.vehicle = null;
      this.vehicleBody = null;
      this.vehicleMesh = null;
      this.wheelModelL = null;
      this.wheelModelR = null;
      this.vehicleWheels = [];
      this.vehicleStepListener = null;


      // vehicle setup
      this.vehicleEngine = null;
      this.vehicleTransmission = null;

      this.groundMesh = null;
      this.mapColors = [0x666666, 0x006600, 0x000066];

      this.ws = null;
      this.sendInterval = null;
      this.networkState = null;
      this.networkIcon = document.documentElement;
   }

   degreesToRadians(degrees) {
      return degrees * Math.PI / 180;
   }

   wrapVec3(vec) {
      return new THREE.Vector3(vec.GetX(), vec.GetY(), vec.GetZ());
   }

   wrapQuat(quat) {
      return new THREE.Quaternion(quat.GetX(), quat.GetY(), quat.GetZ(), quat.GetW());
   }


   initOverlay() {
      if (!this.overlay) {
         this.overlay = document.createElement('div');
         this.overlay.className = 'game-overlay';
         this.overlayContent = document.createElement('div');
         this.overlayContent.className = 'overlay-content';
         this.overlay.appendChild(this.overlayContent);
         this.canvasContainer.appendChild(this.overlay);
      }
      if (!this.uiOverlay) {
         this.uiOverlay = document.createElement('div');
         this.uiOverlay.className = 'game-ui';

         // AI genereoitu svg - locaali qwen3-coder-30b
         // how could we make a svg that simulates a rpm gauge that edits with the rpm value of the game with the addUiElement function
         this.uiOverlay.innerHTML = `
              <div class="rpm-meter">
             <svg id="rpm-gauge" width="200" height="200" viewBox="0 0 200 200">
               <circle cx="100" cy="100" r="95" fill="#222" stroke="#444" stroke-width="2"/>
               <g id="tickMarks"></g>
               <text x="100" y="180" text-anchor="middle" fill="#808080" font-size="18">RPM</text>
               <text x="50" y="165" text-anchor="middle" fill="#808080" font-size="12">0</text>
               <text x="160" y="90" text-anchor="middle" fill="#808080" font-size="12">10000</text>
               <!-- Needle (starts vertical) -->
               <line id="rpm-needle" x1="100" y1="100" x2="100" y2="35" stroke="#f00" stroke-width="4"/>
               <circle cx="100" cy="100" r="6" fill="#fff"/>
             </svg>
             <div id="rpm-value" style="text-align:center;font-size:16px;color:#fff;margin-top:6px;">0 RPM</div>
           </div>
           <div class="network-status-icon"></div>
           <div id="ui-dynamic"></div>
         `;
         this.canvasContainer.appendChild(this.uiOverlay);

         this.addTickMarks();
         // Keep reference for adding elements later
         this.uiDynamicContainer = this.uiOverlay.querySelector('#ui-dynamic');
         this.RpmGaugeSvg = this.uiOverlay.querySelector('#rpm-gauge');
         this.RpmGaugeNeedle = this.uiOverlay.querySelector('#rpm-needle');
         this.RpmGaugeValue = this.uiOverlay.querySelector('#rpm-value');
      }
   }
   // AI genereoitu svg - locaali qwen3-coder-30b
   // the svg layout looks like what i want now, can you add marker lines aftear each 1000rpm and add redline to end
   addTickMarks() {
      const tickContainer = document.getElementById('tickMarks');
      const maxRPM = 10000;
      const minRPM = 0;

      const sweep = 230;
      const base = -235;

      for (let i = 0; i <= maxRPM; i += 1000) {
         // Angle for this tick
         const angle = ((i - minRPM) / (maxRPM - minRPM)) * sweep;
         const theta = angle + base; // actual angle for this tick mark

         const x1 = 100 + 85 * Math.cos(theta * Math.PI / 180);
         const y1 = 100 + 85 * Math.sin(theta * Math.PI / 180);
         const x2 = 100 + 95 * Math.cos(theta * Math.PI / 180);
         const y2 = 100 + 95 * Math.sin(theta * Math.PI / 180);

         const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
         line.setAttribute('x1', x1);
         line.setAttribute('y1', y1);
         line.setAttribute('x2', x2);
         line.setAttribute('y2', y2);
         line.setAttribute('stroke', '#fff');
         line.setAttribute('stroke-width', '2');
         tickContainer.appendChild(line);
      }

      // Redline at maxRPM
      const angle = sweep + base;
      const rx1 = 100 + 85 * Math.cos(angle * Math.PI / 180);
      const ry1 = 100 + 85 * Math.sin(angle * Math.PI / 180);
      const rx2 = 100 + 95 * Math.cos(angle * Math.PI / 180);
      const ry2 = 100 + 95 * Math.sin(angle * Math.PI / 180);

      const redline = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      redline.setAttribute('x1', rx1);
      redline.setAttribute('y1', ry1);
      redline.setAttribute('x2', rx2);
      redline.setAttribute('y2', ry2);
      redline.setAttribute('stroke', 'red');
      redline.setAttribute('stroke-width', '3');
      tickContainer.appendChild(redline);
   }

   addDebugLog(type, text, ttl = 10) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const entry = { type, text, time: timeStr, ttl };

      this.debugLog.push(entry);
      this.renderDebugLog();
      console.log(`${type}: ${text}`)

      setTimeout(() => {
         const idx = this.debugLog.indexOf(entry);
         if (idx !== -1) {
            this.debugLog.splice(idx, 1);
            this.renderDebugLog();
         }
      }, ttl * 1000);
   }

   addUiElement(htmlOrNode, ttl = null) {
      let node;
      if (typeof htmlOrNode === 'string') {
         node = document.createElement('div');
         node.innerHTML = htmlOrNode;
         node = node.firstElementChild || node;
      } else {
         node = htmlOrNode;
      }

      const closeBtn = node.querySelector('.close-pop');
      if (closeBtn) {
         closeBtn.onclick = () => {
            if (node.parentNode) node.parentNode.removeChild(node);
         };
      }

      this.uiDynamicContainer.appendChild(node);

      if (ttl && typeof ttl === 'number' && ttl > 0) {
         setTimeout(() => {
            if (node.parentNode === this.uiDynamicContainer) {
               this.uiDynamicContainer.removeChild(node);
            }
         }, ttl * 1000);
      }
      return node;
   }

   renderDebugLog() {
      if (!this.debugLogContainer) {
         this.debugLogContainer = document.createElement('div');
         this.debugLogContainer.className = 'debug-log';
         this.canvasContainer.appendChild(this.debugLogContainer);
      }
      this.debugLogContainer.innerHTML = this.debugLog.map(entry => `
         <div class="debug-log-entry debug-${entry.type}">
           <span class="debug-time">${entry.time}</span>
           <span class="debug-text">${entry.text}</span>
         </div>
      `).join('');
      this.debugLogContainer.scrollTop = this.debugLogContainer.scrollHeight;
   }

   showSpinner() {
      this.showSpinnerOverlay();
   }

   showSpinnerOverlay() {
      if (!this.spinnerOverlay) {
         this.spinnerOverlay = document.createElement('div');
         this.spinnerOverlay.className = 'spinner-overlay';
         const spinner = document.createElement('div');
         spinner.className = 'spinner';
         this.spinnerOverlay.appendChild(spinner);
         this.canvasContainer.appendChild(this.spinnerOverlay);
      }
   }

   hideSpinner() {
      this.hideSpinnerOverlay();
   }

   hideSpinnerOverlay() {
      if (this.spinnerOverlay) {
         this.spinnerOverlay.remove();
         this.spinnerOverlay = null;
      }
   }

   showError(message) {
      this.initOverlay();
      this.overlayContent.innerHTML = `<div class="overlay-error">${message || "An error occurred."}</div>`;
   }

   clearError() {
      this.initOverlay();
      this.overlayContent.innerHTML = "";
   }

   showNetworkIcon() {
      this.initOverlay();
      let icon = this.overlayContent.querySelector('.network-icon');
      if (!icon) {
         icon = document.createElement('div');
         icon.className = 'network-icon';
         this.overlayContent.appendChild(icon);
      }
      this.networkIcon = icon;
   }

   setNetworkState(state) {
      this.showNetworkIcon();
      let color = '#808080';
      if (state === NetworkState.CONNECTING) color = '#edc001';
      if (state === NetworkState.CONNECTED) color = '#0b6623';
      if (state === NetworkState.DISCONNECTED) color = '#ed4337';
      this.networkIcon.style.backgroundColor = color;
   }

   setState(newState, errorMessage) {
      this.initOverlay();
      if (newState === State.LOADING) {
         this.showSpinner();
         this.clearError();
      } else if (newState === State.ERROR) {
         this.hideSpinner();
         this.showError(errorMessage);
         let logMsg = '';
         if (errorMessage instanceof Error) {
            logMsg = errorMessage.message;
         } else {
            logMsg = errorMessage || "An error occurred.";
         }
         this.addDebugLog('error', logMsg);
      } else if (newState === State.READY) {
         this.hideSpinner();
         this.clearError();
      }
   }

   // AI genereoitu - locaali qwen3-coder-30b
   // how could we make a svg that simulates a rpm gauge that edits with the rpm value of the game with the addUiElement function
   updateRpmGauge() {
      if (!this.RpmGaugeNeedle || !this.vehicleEngine) return;

      const maxRpm = this.vehicleEngine.get_mMaxRPM();
      const currentRpm = Math.max(0, Math.min(this.currentRPM, maxRpm));

      // Needle angle: -120 deg = minRpm, +120 deg = maxRpm (arc from left to right)
      const startAngle = -230;
      const endAngle = -20;
      const range = endAngle - startAngle;
      const normalized = (currentRpm - 0) / (maxRpm - 0);
      const angle = startAngle + range * normalized;
      const rad = angle * Math.PI / 180;

      // Needle coordinates
      const centerX = 100, centerY = 100, needleLen = 65;
      const x2 = centerX + needleLen * Math.cos(rad);
      const y2 = centerY + needleLen * Math.sin(rad);

      this.RpmGaugeNeedle.setAttribute('x2', x2);
      this.RpmGaugeNeedle.setAttribute('y2', y2);

      if (this.RpmGaugeValue) {
         this.RpmGaugeValue.textContent = `${Math.round(currentRpm)} RPM`;
      }
   }

   async initPhysics() {
      this.setState(State.LOADING);
      console.log("Starting Jolt initialization");
      try {
         this.Jolt = await initJolt({
            locateFile: (file) => {
               console.log(`Loading file: ${file}`);
               return `/static/game/assets/${file}`;
            },
         });

         const settings = new this.Jolt.JoltSettings();
         settings.mMaxWorkerThreads = 3;

         const objectFilter = new this.Jolt.ObjectLayerPairFilterTable(NUM_LAYERS);
         objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
         objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);

         const BP_LAYER_NON_MOVING = new this.Jolt.BroadPhaseLayer(0);
         const BP_LAYER_MOVING = new this.Jolt.BroadPhaseLayer(1);
         const NUM_BROAD_PHASE_LAYERS = 2;

         const bpInterface = new this.Jolt.BroadPhaseLayerInterfaceTable(NUM_LAYERS, NUM_BROAD_PHASE_LAYERS);
         bpInterface.MapObjectToBroadPhaseLayer(LAYER_NON_MOVING, BP_LAYER_NON_MOVING);
         bpInterface.MapObjectToBroadPhaseLayer(LAYER_MOVING, BP_LAYER_MOVING);

         settings.mObjectLayerPairFilter = objectFilter;
         settings.mBroadPhaseLayerInterface = bpInterface;
         settings.mObjectVsBroadPhaseLayerFilter = new this.Jolt.ObjectVsBroadPhaseLayerFilterTable(
            bpInterface, NUM_BROAD_PHASE_LAYERS, objectFilter, NUM_LAYERS
         );

         settings.mMaxBodies = 1024;
         settings.mMaxBodyPairs = 1024;
         settings.mMaxContactConstraints = 2048;

         this.joltInterface = new this.Jolt.JoltInterface(settings);
         this.physicsSystem = this.joltInterface.GetPhysicsSystem();
         this.bodyInterface = this.physicsSystem.GetBodyInterface();

         this.tempVec = new this.Jolt.Vec3();
         this.tempRVec = new this.Jolt.RVec3();
         this.tempQuat = new this.Jolt.Quat();
         this.tempQuat.Set(0, 0, 0, 1);

         this.Jolt.destroy(settings);
         console.log("Physics system initialized");
      } catch (error) {
         console.error("Failed to initialize physics:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   initScene() {
      this.setState(State.LOADING);
      console.log("Initializing Three.js scene");
      try {
         this.scene = new THREE.Scene();
         this.scene.background = new THREE.Color(0xffd577);

         this.scene.add(new THREE.AmbientLight(0x303b5e));
         const dirLight = new THREE.DirectionalLight(0xffcc77, 3);
         dirLight.position.set(10, 5, 5);
         this.scene.add(dirLight);

         this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
         this.camera.position.set(0, 15, 30);
         this.camera.lookAt(new THREE.Vector3(0, 0, 0));

         this.renderer = new THREE.WebGLRenderer({ antialias: true });
         const width = window.innerWidth * 0.9;
         const height = window.innerHeight * 0.9;
         this.renderer.setClearColor(0xbfd1e5);
         this.renderer.setSize(width, height);
         this.renderer.setPixelRatio(window.devicePixelRatio);

         if (!this.canvasContainer) throw new Error("gameCanvas element not found");
         this.canvasContainer.appendChild(this.renderer.domElement);

         this.controls = new OrbitControls(this.camera, this.renderer.domElement);


         window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
         });


         this.texLoader = new THREE.TextureLoader();
         this.scene.fog = new THREE.Fog(0x303b5e, 0, 300);
      } catch (error) {
         console.error("Failed to initialize scene:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   createAndAddBody(shapeSettings, position, rotation, motionType, layer, color, mass = 0, material = null, customThreeObject = null) {
      try {
         const shape = shapeSettings.Create().Get();
         if (!shape) {
            throw new Error("Failed to create shape");
         }

         const bodySettings = new this.Jolt.BodyCreationSettings(
            shape,
            position,
            rotation,
            motionType,
            layer
         );
         if (mass != 0 && motionType == this.Jolt.EMotionType_Dynamic) {
            bodySettings.mOverrideMassProperties = this.Jolt.EOverrideMassProperties_CalculateInertia;
            bodySettings.mMassPropertiesOverride.mMass = mass;
         }

         const body = this.bodyInterface.CreateBody(bodySettings);
         if (!body) {
            this.Jolt.destroy(shape);
            throw new Error("Failed to create body");
         }

         this.bodyInterface.AddBody(body.GetID(),
            motionType === this.Jolt.EMotionType_Static ?
               this.Jolt.EActivation_DontActivate :
               this.Jolt.EActivation_Activate
         );

         const isAdded = this.bodyInterface.IsAdded(body.GetID());

         if (!isAdded) {
            this.Jolt.destroy(shape);
            this.Jolt.destroy(body);
            throw new Error("Failed to add body to physics system");
         }

         let threeObject = null;
         if (customThreeObject) {
            threeObject = customThreeObject;
            threeObject.position.copy(this.wrapVec3(body.GetPosition()));
            threeObject.quaternion.copy(this.wrapQuat(body.GetRotation()));
         } else {
            if (material == null) {
               threeObject = this.getThreeObjectForBody(body, color);
            } else {
               threeObject = this.getThreeObjectForBody(body, color, material);
            }
         }

         threeObject.userData.body = body;
         body.userData = { threeObject: threeObject };

         this.scene.add(threeObject);

         if (motionType === this.Jolt.EMotionType_Static) {
            this.staticObjects.push(threeObject);
         } else {
            this.dynamicObjects.push(threeObject);
         }

         this.Jolt.destroy(bodySettings);

         return body;
      } catch (error) {
         console.error("Failed to create and add body:", error);
         throw error;
      }
   }

   getThreeObjectForBody(body, color, material = new THREE.MeshPhongMaterial({ color: color })
   ) {
      let threeObject;

      const shape = body.GetShape();
      switch (shape.GetSubType()) {
         case this.Jolt.EShapeSubType_Box:
            const boxShape = this.Jolt.castObject(shape, this.Jolt.BoxShape);
            const extent = this.wrapVec3(boxShape.GetHalfExtent()).multiplyScalar(2);
            threeObject = new THREE.Mesh(
               new THREE.BoxGeometry(extent.x, extent.y, extent.z),
               material
            );
            break;
         case this.Jolt.EShapeSubType_Sphere:
            const sphereShape = this.Jolt.castObject(shape, this.Jolt.SphereShape);
            threeObject = new THREE.Mesh(
               new THREE.SphereGeometry(sphereShape.GetRadius(), 32, 32),
               material
            );
            break;
         default:
            threeObject = new THREE.Mesh(
               this.createMeshForShape(shape),
               material
            );
            break;
      }

      threeObject.position.copy(this.wrapVec3(body.GetPosition()));
      threeObject.quaternion.copy(this.wrapQuat(body.GetRotation()));
      return threeObject;
   }


   createMeshForShape(shape) {
      try {
         const scale = new this.Jolt.Vec3(1, 1, 1);
         const triContext = new this.Jolt.ShapeGetTriangles(
            shape,
            this.Jolt.AABox.prototype.sBiggest(),
            shape.GetCenterOfMass(),
            this.Jolt.Quat.prototype.sIdentity(),
            scale
         );

         const vertices = new Float32Array(
            this.Jolt.HEAPF32.buffer,
            triContext.GetVerticesData(),
            triContext.GetVerticesSize() / Float32Array.BYTES_PER_ELEMENT
         ).slice();

         this.Jolt.destroy(triContext);
         this.Jolt.destroy(scale);

         const geometry = new THREE.BufferGeometry();
         geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
         geometry.computeVertexNormals();
         return geometry;
      } catch (error) {
         console.error("Failed to create mesh for shape:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   createGround() {
      this.setState(State.LOADING);
      console.log("Creating ground");
      try {
         this.tempRVec.Set(0, -0.3, 0);
         this.tempQuat.Set(0, 0, 0, 1);

         const groundShapeSettings = new this.Jolt.BoxShapeSettings(
            new this.Jolt.Vec3(20000, 0.1, 20000),
            0.05
         );

         const groundBody = this.createAndAddBody(
            groundShapeSettings,
            this.tempRVec,
            this.tempQuat,
            this.Jolt.EMotionType_Static,
            LAYER_NON_MOVING,
            0xc7c7c7
         );

         this.Jolt.destroy(groundShapeSettings);
         console.log("Ground created successfully");
         return groundBody;
      } catch (error) {
         console.error("Failed to create ground:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   // AI generoitu: Create a function that gets vectors out of THREE.js object
   // and returns a triangle list for Jolt MeshShapeSettings. - Grok 4 Fast
   createTriangleListFromThreeObject(threeObject) {
      let vertices = [];
      let indices = [];
      let vertexOffset = 0;

      threeObject.updateMatrixWorld(true);

      threeObject.traverse((child) => {
         if (child.isMesh && child.geometry) {
            const geometry = child.geometry;
            geometry.computeVertexNormals();

            const positionAttribute = geometry.getAttribute('position');
            const indexAttribute = geometry.getIndex();

            if (!positionAttribute) {
               console.warn(`Mesh ${child.name} missing position attribute`);
               return;
            }

            const worldMatrix = child.matrixWorld;
            const vertex = new THREE.Vector3();

            for (let i = 0; i < positionAttribute.count; i++) {
               vertex.fromBufferAttribute(positionAttribute, i);
               vertex.applyMatrix4(worldMatrix);

               vertices.push(vertex.x);
               vertices.push(vertex.y);
               vertices.push(vertex.z);
            }

            if (indexAttribute) {
               for (let i = 0; i < indexAttribute.count; i++) {
                  indices.push(indexAttribute.getX(i) + vertexOffset);
               }
            } else {
               for (let i = 0; i < positionAttribute.count / 3; i++) {
                  indices.push(vertexOffset + i * 3);
                  indices.push(vertexOffset + i * 3 + 1);
                  indices.push(vertexOffset + i * 3 + 2);
               }
            }

            vertexOffset += positionAttribute.count;
         }
      });

      if (vertices.length === 0) {
         console.error("No valid geometry found in Three.js object");
         return null;
      }

      const triangleList = new this.Jolt.TriangleList();
      const vertexCount = vertices.length / 3;

      for (let i = 0; i < indices.length; i += 3) {
         const idx1 = indices[i];
         const idx2 = indices[i + 1];
         const idx3 = indices[i + 2];

         if (idx1 < vertexCount && idx2 < vertexCount && idx3 < vertexCount) {
            const v1 = new this.Jolt.Vec3(vertices[idx1 * 3], vertices[idx1 * 3 + 1], vertices[idx1 * 3 + 2]);
            const v2 = new this.Jolt.Vec3(vertices[idx2 * 3], vertices[idx2 * 3 + 1], vertices[idx2 * 3 + 2]);
            const v3 = new this.Jolt.Vec3(vertices[idx3 * 3], vertices[idx3 * 3 + 1], vertices[idx3 * 3 + 2]);

            triangleList.push_back(new this.Jolt.Triangle(v1, v2, v3));

            this.Jolt.destroy(v1);
            this.Jolt.destroy(v2);
            this.Jolt.destroy(v3);
         }
      }

      return triangleList;
   }

   async createMap() {
      this.setState(State.LOADING);
      console.log("Creating map");
      try {
         const mapGltf = await this.gltfLoader.loadAsync("static/gameAssets/map.glb");
         console.log("Map model loaded successfully");
         const mapModel = mapGltf.scene.clone();

         mapModel.position.set(0, 0, 0);
         mapModel.quaternion.set(0, 0, 0, 1);

         const triangleList = this.createTriangleListFromThreeObject(mapModel);
         if (!triangleList) {
            console.error("Failed to create TriangleList from road model");
            this.setState(State.ERROR, "Failed to create physics shape for road");
            return;
         }

         const mapShapeSettings = new this.Jolt.MeshShapeSettings(triangleList);

         this.tempRVec.Set(0, 0, 0);
         this.tempQuat.Set(0, 0, 0, 1);

         this.createAndAddBody(
            mapShapeSettings,
            this.tempRVec,
            this.tempQuat,
            this.Jolt.EMotionType_Static,
            LAYER_NON_MOVING,
            0x666666,
            0,
            null,
            mapModel
         );

         this.Jolt.destroy(triangleList);
         this.Jolt.destroy(mapShapeSettings);

         this.setState(State.READY)
         return mapGltf;
      } catch (error) {
         this.setState(State.ERROR, `Map creation error: ${error.message}`);
         throw error;
      }
   }

   async createRoads() {
      this.setState(State.LOADING);
      console.log("Creating roads");
      try {
         const roadsGltf = await this.gltfLoader.loadAsync("static/gameAssets/roads.glb");
         console.log("roads model loaded successfully");
         const roadsModel = roadsGltf.scene.clone();

         roadsModel.position.set(0, 0, 0);
         roadsModel.quaternion.set(0, 0, 0, 1);

         const triangleList = this.createTriangleListFromThreeObject(roadsModel);
         if (!triangleList) {
            console.error("Failed to create TriangleList from roads model");
            this.setState(State.ERROR, "Failed to create physics shape for roads");
            return;
         }

         const roadsShapeSettings = new this.Jolt.MeshShapeSettings(triangleList);

         this.tempRVec.Set(0, 0, 0);
         this.tempQuat.Set(0, 0, 0, 1);

         this.createAndAddBody(
            roadsShapeSettings,
            this.tempRVec,
            this.tempQuat,
            this.Jolt.EMotionType_Static,
            LAYER_NON_MOVING,
            0x666666,
            0,
            null,
            roadsModel
         );

         this.Jolt.destroy(triangleList);
         this.Jolt.destroy(roadsShapeSettings);

         this.setState(State.READY)
         return roadsGltf;
      } catch (error) {
         this.setState(State.ERROR, `Roads creation error: ${error.message}`);
         throw error;
      }
   }

   async createBuildings() {
      const gltf = await this.gltfLoader.loadAsync("static/gameAssets/buildings.glb");
      const model = gltf.scene;

      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.updateMatrixWorld(true);

      model.traverse((child) => {
         if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
            child.geometry.computeVertexNormals();
            child.material.flatShading = false;
            child.material.needsUpdate = true;
         }
      });
      this.scene.add(model);
      return { gltf, model };
   }

   createFrictionCurve(multiplier) {
      const curve = new this.Jolt.LinearCurve();
      const basePoints = [
         [0.0, 1.0],
         [0.1, 1.2],
         [0.3, 0.8],
         [1.0, 0.6]
      ];

      basePoints.forEach(([slip, friction]) => {
         const scaledFriction = friction * multiplier;
         curve.AddPoint(slip, scaledFriction);
      });

      return curve;
   }

   createCarShape(halfWidth, halfHeight, halfLength) {
      const compoundSettings = new this.Jolt.StaticCompoundShapeSettings();

      const mainBody = new this.Jolt.BoxShapeSettings(
         new this.Jolt.Vec3(halfWidth, halfHeight, halfLength)
      );
      compoundSettings.AddShape(
         new this.Jolt.Vec3(0, halfHeight, 0),
         new this.Jolt.Quat(0, 0, 0, 1),
         mainBody
      );

      const hood = new this.Jolt.BoxShapeSettings(
         new this.Jolt.Vec3(halfWidth * 0.8, halfHeight * 0.6, halfLength * 0.27)
      );
      compoundSettings.AddShape(
         new this.Jolt.Vec3(0, halfHeight * 1.4, halfLength * 0.68),
         new this.Jolt.Quat(0, 0, 0, 1),
         hood
      );

      const roof = new this.Jolt.BoxShapeSettings(
         new this.Jolt.Vec3(halfWidth * 0.82, halfHeight * 0.8, halfLength * 0.45)
      );
      compoundSettings.AddShape(
         new this.Jolt.Vec3(0, halfHeight * 2.2, halfLength * -0.11),
         new this.Jolt.Quat(0, 0, 0, 1),
         roof
      );

      return compoundSettings;
   }

   createUnitCylinder(radius = 0.05, material = new THREE.MeshPhongMaterial({ color: 0x222222 }), radialSegments = 8) {
      // unit-length cylinder centered at origin (height = 1)
      const geom = new THREE.CylinderGeometry(radius, radius, 1.0, radialSegments);
      const mesh = new THREE.Mesh(geom, material);
      mesh.userData.unitLength = 1.0;
      return mesh;
   }

   createVehicle() {
      this.setState(State.LOADING);

      // dimensions
      const wheelRadius = 0.55;
      const wheelWidth = 0.6;

      const halfVehicleLength = 4.445;
      const halfVehicleWidth = 1.695;
      const halfVehicleHeight = 0.9;
      const wheelBase = halfVehicleLength / 1.83;

      const wheelOffset = -0.2;
      const wheelOffsetVertical = -0.64;
      const wheelOffsetLongitudal = 0.4;

      const maxSteerAngle = this.degreesToRadians(60);

      // multipliers
      const suspensionMinLength = 0.4;
      const suspensionMaxLength = 1;
      const suspensionPreloadLenght = 1;
      const suspensionStiffness = 1;
      const suspensionDamping = 1;
      const suspensionFrequency = 1;
      const frontTyreLateralFriction = 15;
      const frontTyreLongitudalFriction = 1;
      const rearTyreLateralFriction = 2;
      const rearTyreLongitudalFriction = 15;

      // powertrain
      const transmissionMode = this.Jolt.ETransmissionMode_Auto;
      const fourWheelDrive = false;
      const torqueSplitRatio = 1.4;
      const differentialLimitedSlipRatio = 1.3;
      const antiRollbar = true;

      const maxEngineTorque = 2500.0;
      const clutchStrength = 1000.0;
      const minRPM = 400;
      const maxRPM = 10000;
      const damperMass = 1.0;
      const flywheelMass = 1.0;

      const vehicleMass = 1200.0;

      const FL_WHEEL = 0;
      const FR_WHEEL = 1;
      const BL_WHEEL = 2;
      const BR_WHEEL = 3;

      const wheelRight = new this.Jolt.Vec3(0, 1, 0);
      const wheelUp = new this.Jolt.Vec3(1, 0, 0);

      this.tempRVec.Set(10, 0, -30);
      this.tempQuat.Set(0, 180, 0, 1);
      try {
         const carShapeSettings = new this.Jolt.OffsetCenterOfMassShapeSettings(
            new this.Jolt.Vec3(0, -halfVehicleHeight, 0),
            this.createCarShape(halfVehicleWidth, halfVehicleHeight, halfVehicleLength)
         );

         let carBody = null;
         Promise.all([
            new Promise((resolve, reject) => {
               this.gltfLoader.load("static/gameAssets/s15_body.glb", resolve, undefined, reject);
            }),
            new Promise((resolve, reject) => {
               this.gltfLoader.load("static/gameAssets/s15_wheel_l.glb", resolve, undefined, reject);
            }),
            new Promise((resolve, reject) => {
               this.gltfLoader.load("static/gameAssets/s15_wheel_r.glb", resolve, undefined, reject);
            })
         ]).then(([carGltf, wheelGltfL, wheelGltfR]) => {
            console.log("Car and wheel models loaded successfully");

            const carModel = carGltf.scene.clone();

            this.wheelGltfL = wheelGltfL;
            this.wheelGltfR = wheelGltfR;


            let safetyDistance = 0.3;
            let goal = new THREE.Object3D();
            let follow = new THREE.Object3D();
            follow.position.z = -safetyDistance;
            carModel.position.y = -200;
            carModel.frustumCulled = false;
            carModel.add(follow);
            goal.add(this.camera);

            carBody = this.createAndAddBody(
               carShapeSettings,
               this.tempRVec,
               this.tempQuat,
               this.Jolt.EMotionType_Dynamic,
               LAYER_MOVING,
               0xff0000,
               vehicleMass,
               null,
               carModel
            );

            const vehicleMesh = this.dynamicObjects[this.dynamicObjects.length - 1];
            const vehicle = new this.Jolt.VehicleConstraintSettings();
            vehicle.mMaxPitchRollAngle = this.degreesToRadians(60);
            vehicle.mWheels.clear();

            // wheel settings
            const mWheels = [];
            {
               const fl = new this.Jolt.WheelSettingsWV();
               fl.mPosition = new this.Jolt.Vec3((halfVehicleWidth + wheelOffset), -wheelOffsetVertical, wheelBase + wheelOffsetLongitudal);
               fl.set_mMaxSteerAngle(maxSteerAngle);
               fl.mMaxHandBrakeTorque = 0.0;
               fl.set_mLateralFriction(this.createFrictionCurve(frontTyreLateralFriction));
               fl.set_mLongitudinalFriction(this.createFrictionCurve(frontTyreLongitudalFriction));

               vehicle.mWheels.push_back(fl);
               mWheels.push(fl);

               const fr = new this.Jolt.WheelSettingsWV();
               fr.mPosition = new this.Jolt.Vec3(-(halfVehicleWidth + wheelOffset), -wheelOffsetVertical, wheelBase + wheelOffsetLongitudal);
               fr.set_mMaxSteerAngle(maxSteerAngle);
               fr.mMaxHandBrakeTorque = 0.0;
               fr.set_mLateralFriction(this.createFrictionCurve(frontTyreLateralFriction));
               fr.set_mLongitudinalFriction(this.createFrictionCurve(frontTyreLongitudalFriction));
               vehicle.mWheels.push_back(fr);
               mWheels.push(fr);

               const bl = new this.Jolt.WheelSettingsWV();
               bl.mPosition = new this.Jolt.Vec3((halfVehicleWidth + wheelOffset), -wheelOffsetVertical, -wheelBase + wheelOffsetLongitudal / 2);
               bl.set_mMaxSteerAngle(0);
               fr.mMaxHandBrakeTorque = 100.0;
               bl.set_mLateralFriction(this.createFrictionCurve(rearTyreLateralFriction));
               bl.set_mLongitudinalFriction(this.createFrictionCurve(rearTyreLongitudalFriction));
               vehicle.mWheels.push_back(bl);
               mWheels.push(bl);

               const br = new this.Jolt.WheelSettingsWV();
               br.mPosition = new this.Jolt.Vec3(-(halfVehicleWidth + wheelOffset), -wheelOffsetVertical, -wheelBase + wheelOffsetLongitudal / 2);
               br.set_mMaxSteerAngle(0);
               fr.mMaxHandBrakeTorque = 100.0;
               br.set_mLateralFriction(this.createFrictionCurve(rearTyreLateralFriction));
               br.set_mLongitudinalFriction(this.createFrictionCurve(rearTyreLongitudalFriction));
               vehicle.mWheels.push_back(br);
               mWheels.push(br);

            }
            mWheels.forEach(wheelS => {
               wheelS.mRadius = wheelRadius;
               wheelS.mWidth = wheelWidth;
               wheelS.set_mSuspensionMinLength(wheelS.get_mSuspensionMinLength() * suspensionMinLength);
               wheelS.set_mSuspensionMaxLength(wheelS.get_mSuspensionMaxLength() * suspensionMaxLength);
               wheelS.set_mSuspensionPreloadLength(wheelS.get_mSuspensionPreloadLength() * suspensionPreloadLenght);

               const spring = wheelS.get_mSuspensionSpring()
               spring.set_mStiffness(spring.get_mStiffness() * suspensionStiffness);
               spring.set_mFrequency(spring.get_mFrequency() * suspensionFrequency);
               spring.set_mDamping(spring.get_mDamping() * suspensionDamping);
            });

            const controllerSettings = new this.Jolt.WheeledVehicleControllerSettings();

            // Powertrain
            const engine = controllerSettings.get_mEngine();
            engine.set_mMinRPM(minRPM);
            engine.set_mMaxRPM(maxRPM);
            engine.set_mAngularDamping(damperMass);
            engine.set_mInertia(flywheelMass);
            engine.set_mMaxTorque(maxEngineTorque);

            const transmission = controllerSettings.get_mTransmission();
            transmission.set_mClutchStrength(clutchStrength);
            transmission.set_mMode(transmissionMode);

            vehicle.mController = controllerSettings;

            // Rear differential
            controllerSettings.mDifferentials.clear();
            const rearWheelDrive = new this.Jolt.VehicleDifferentialSettings();
            rearWheelDrive.mLeftWheel = BL_WHEEL;
            rearWheelDrive.mRightWheel = BR_WHEEL;
            rearWheelDrive.mLimitedSlipRatio = differentialLimitedSlipRatio;
            controllerSettings.mDifferentials.push_back(rearWheelDrive);
            rearWheelDrive.mEngineTorqueRatio = 1;

            // 4WD settings
            if (fourWheelDrive) {
               // adjust rear
               rearWheelDrive.mEngineTorqueRatio = 0.5;
               controllerSettings.mDifferentialLimitedSlipRatio = torqueSplitRatio;

               // add front
               const frontWheelDrive = new this.Jolt.VehicleDifferentialSettings();
               frontWheelDrive.mLeftWheel = FL_WHEEL;
               frontWheelDrive.mRightWheel = FR_WHEEL;
               frontWheelDrive.mLimitedSlipRatio = differentialLimitedSlipRatio;
               frontWheelDrive.mEngineTorqueRatio = 0.5;
               controllerSettings.mDifferentials.push_back(frontWheelDrive);
            }

            // Antirollbar
            if (antiRollbar) {
               vehicle.mAntiRollBars.clear();
               const frontRollBar = new this.Jolt.VehicleAntiRollBar();
               frontRollBar.mLeftWheel = FL_WHEEL;
               frontRollBar.mRightWheel = FR_WHEEL;
               const rearRollBar = new this.Jolt.VehicleAntiRollBar();
               rearRollBar.mLeftWheel = BL_WHEEL;
               rearRollBar.mRightWheel = BR_WHEEL;
               vehicle.mAntiRollBars.push_back(frontRollBar);
               vehicle.mAntiRollBars.push_back(rearRollBar);
            }

            this.vehicle = new this.Jolt.VehicleConstraint(carBody, vehicle);
            const tester = new this.Jolt.VehicleCollisionTesterCastCylinder(LAYER_MOVING, 0.05);
            this.vehicle.SetVehicleCollisionTester(tester);

            this.vehicleBody = carBody;
            this.vehicleMesh = carModel;

            const callbacks = new this.Jolt.VehicleConstraintCallbacksJS();
            callbacks.GetCombinedFriction = (wheelIndex, tireFrictionDirection, tireFriction, body2, subShapeID2) => {
               const otherBody = this.Jolt.wrapPointer(body2, this.Jolt.Body);
               return Math.sqrt(tireFriction * otherBody.GetFriction());
            };
            callbacks.OnPreStepCallback = (vehicle, stepContext) => { };
            callbacks.OnPostCollideCallback = (vehicle, stepContext) => { };
            callbacks.OnPostStepCallback = (vehicle, stepContext) => { };
            callbacks.SetVehicleConstraint(this.vehicle);
            this.vehicleCallbacks = callbacks;

            this.physicsSystem.AddConstraint(this.vehicle);
            this.playerController = this.Jolt.castObject(this.vehicle.GetController(), this.Jolt.WheeledVehicleController);
            this.vehicleEngine = this.playerController.GetEngine();
            this.vehicleTransmission = this.playerController.GetTransmission();

            const controllerCallbacks = new this.Jolt.WheeledVehicleControllerCallbacksJS();
            controllerCallbacks.OnTireMaxImpulseCallback = (wheelIndex, result, suspensionImpulse,
               longitudinalFriction, lateralFriction, longitudinalSlip, lateralSlip, deltaTime) => {
               const resultObj = this.Jolt.wrapPointer(result, this.Jolt.TireMaxImpulseCallbackResult);
               resultObj.mLongitudinalImpulse = longitudinalFriction * suspensionImpulse;
               resultObj.mLateralImpulse = lateralFriction * suspensionImpulse;
            };
            controllerCallbacks.SetWheeledVehicleController(this.playerController);
            this.controllerCallbacks = controllerCallbacks;

            // wheel creation
            const createThreeWheel = (constraint, wheelIndex, body) => {
               const joltWheel = constraint.GetWheel(wheelIndex);
               const wheelSetting = joltWheel.GetSettings();

               const isLeftSide = wheelIndex === 0 || wheelIndex === 2;

               let wheel;
               if (isLeftSide) {
                  wheel = this.wheelGltfL.scene.clone();
                  wheel.rotation.x = -Math.PI / 2;
               } else {
                  wheel = this.wheelGltfR.scene.clone();
                  wheel.rotation.x = Math.PI / 2;
               }

               body.add(wheel);

               // AI generoitu - ChatGPT 5 mini
               // Create functions for procedurally generating controlarms that
               // interconnect on vehicle center and center of the wheel.
               // create control arm as reusable unit cylinder
               const armMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
               const controlArm = this.createUnitCylinder(0.04, armMaterial, 8);
               controlArm.visible = true;
               body.add(controlArm);

               const updater = {
                  wheel,
                  controlArm,
                  updateLocalTransform: () => {
                     try {
                        // wheel update
                        const transform = constraint.GetWheelLocalTransform(wheelIndex, wheelRight, wheelUp);
                        const wheelPos = this.wrapVec3(transform.GetTranslation());
                        wheel.position.copy(wheelPos);
                        const wheelQuat = this.wrapQuat(transform.GetRotation().GetQuaternion());
                        wheel.quaternion.copy(wheelQuat);
                        if (isLeftSide) wheel.rotateX(-Math.PI / 2); else wheel.rotateX(Math.PI / 2);


                        // control arm update
                        const cp = new THREE.Vector3(0, 0, wheelPos.z);
                        const dir = new THREE.Vector3().subVectors(cp, wheelPos);
                        const length = dir.length();
                        if (length < 1e-6) controlArm.visible = false;
                        else {
                           controlArm.visible = true;
                           const midpoint = new THREE.Vector3().addVectors(wheelPos, cp).multiplyScalar(0.5);
                           const up = new THREE.Vector3(0, 1, 0);
                           const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
                           controlArm.position.copy(midpoint);
                           controlArm.setRotationFromQuaternion(q);
                           controlArm.scale.set(1, length / controlArm.userData.unitLength, 1);
                        }
                     } catch (err) {
                        this.addDebugLog('error', err);
                     }
                  }
               };
               updater.updateLocalTransform();

               return updater;
            };

            this.vehicleWheels = [];
            for (let i = 0; i < vehicle.mWheels.size(); i++) {
               const updater = createThreeWheel(this.vehicle, i, vehicleMesh);
               this.vehicleWheels.push(updater);
            }

            const stepListener = new this.Jolt.VehicleConstraintStepListener(this.vehicle);
            this.vehicleStepListener = this.physicsSystem.AddStepListener(stepListener);


            console.log("Created vehicle with step listener");
            return carBody;

         });


      } catch (error) {
         console.error("Failed to create vehicle:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   setupControls() {
      this.setState(State.LOADING);
      console.log("Setting up controls");
      try {

         const input = {
            forwardPressed: false,
            backwardPressed: false,
            leftPressed: false,
            rightPressed: false,
            handBrake: false
         };

         this.input = input;

         const keyDownHandler = (event) => {
            const keyCode = event.key;
            if (keyCode == 'w') {
               input.forwardPressed = true;
            } else if (keyCode == 's') {
               input.backwardPressed = true;
            } else if (keyCode == 'a') {
               input.leftPressed = true;
            } else if (keyCode == 'd') {
               input.rightPressed = true;
            } else if (keyCode == 'z' || keyCode == ' ') {
               input.handBrake = true;
            }
         };

         const keyUpHandler = (event) => {
            const keyCode = event.key;
            if (keyCode == 'w') {
               input.forwardPressed = false;
            } else if (keyCode == 's') {
               input.backwardPressed = false;
            } else if (keyCode == 'a') {
               input.leftPressed = false;
            } else if (keyCode == 'd') {
               input.rightPressed = false;
            } else if (keyCode == 'z' || keyCode == ' ') {
               input.handBrake = false;
            }
         };

         document.addEventListener("keydown", keyDownHandler, false);
         document.addEventListener("keyup", keyUpHandler, false);

         this.controlHandlers = {
            keyDown: keyDownHandler,
            keyUp: keyUpHandler
         };

         this.controls.enableDamping = true;
         this.controls.dampingFactor = 0.1;
         this.controls.minDistance = 5;
         this.controls.maxDistance = 12;
         this.controls.maxPolarAngle = Math.PI / 2;
         this.controls.minPolarAngle = 0.1;
      } catch (error) {
         console.error("Failed to set up controls:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   prePhysicsUpdate() {
      if (!this.vehicle) return;
      try {
         const input = this.input;
         let forward = 0.0, right = 0.0, brake = 0.0, handBrake = 0.0;

         forward = input.forwardPressed ? 1.0 : (input.backwardPressed ? -1.0 : 0.0);
         right = input.rightPressed ? 1.0 : (input.leftPressed ? -1.0 : 0.0);
         const linearV = this.wrapVec3(this.vehicleBody.GetLinearVelocity());
         this.playerVelocity = {
            x: linearV.getComponent(0).toFixed(2),
            y: linearV.getComponent(1).toFixed(2),
            z: linearV.getComponent(2).toFixed(2)
         };
         const vehicleRotation = this.wrapQuat(this.vehicleBody.GetRotation());
         this.playerRotation = {
            x: vehicleRotation.x.toFixed(2),
            y: vehicleRotation.y.toFixed(2),
            z: vehicleRotation.z.toFixed(2),
            w: vehicleRotation.w.toFixed(2)
         }


         if (this.previousForward * forward < 0.0) {
            const rotation = this.wrapQuat(this.vehicleBody.GetRotation().Conjugated());
            const velocity = linearV.applyQuaternion(rotation).z;

            if ((forward > 0.0 && velocity < -0.1) || (forward < 0.0 && velocity > 0.1)) {
               forward = 0.0;
               brake = 1.0;
            }
            else {
               this.previousForward = forward; // reversing after stopping
            }
         }

         if (input.handBrake) {
            forward = 0.0;
            handBrake = 1.0;
         }

         this.playerController.SetDriverInput(forward, right, brake, handBrake);
         if (right != 0.0 || forward != 0.0 || brake != 0.0 || handBrake != 0.0) {
            this.bodyInterface.ActivateBody(this.vehicleBody.GetID());
         }


         if (this.vehicleWheels && this.vehicleWheels.length) {
            this.vehicleWheels.forEach(entry => {
               if (entry && typeof entry.updateLocalTransform === 'function') {
                  entry.updateLocalTransform();
               }
            });
         }

         this.currentRPM = this.vehicleEngine.GetCurrentRPM();

         this.uiOverlay.querySelector('#rpm-value').textContent = `${Math.round(this.currentRPM)} RPM`
      } catch (error) {
         console.error("Failed to process prePhysicsUpdate:", error);
         this.setState(State.ERROR, error.message);
      }
   }

   updatePhysics(deltaTime) {
      try {
         if (!this.Jolt || !this.physicsSystem) {
            throw new Error("Physics system not initialized");
         }
         var numSteps = deltaTime > 1.0 / 55.0 ? 2 : 1;
         this.joltInterface.Step(deltaTime, numSteps);

         for (let i = 0, il = this.dynamicObjects.length; i < il; i++) {
            let objThree = this.dynamicObjects[i];
            let body = objThree.userData.body;
            objThree.position.copy(this.wrapVec3(body.GetPosition()));
            objThree.quaternion.copy(this.wrapQuat(body.GetRotation()));
            if (body.GetBodyType() == this.Jolt.EBodyType_SoftBody) {
               if (objThree.userData.updateVertex) {
                  objThree.userData.updateVertex();
               } else {
                  objThree.geometry = this.createMeshForShape(body.GetShape());
               }
            }
         }
         return true;
      } catch (error) {
         console.error("Physics update failed:", error);
         return false;
      }
   }
   handleCamera() {
      if (!this.vehicleBody || !this.vehicleMesh) return;

      const vehiclePosition = new THREE.Vector3();
      this.vehicleMesh.getWorldPosition(vehiclePosition);
      this.playerPosition = {
         x: vehiclePosition.getComponent(0).toFixed(2),
         y: vehiclePosition.getComponent(1).toFixed(2),
         z: vehiclePosition.getComponent(2).toFixed(2)
      };


      const velocity = this.wrapVec3(this.vehicleBody.GetLinearVelocity());
      const speed = velocity.length();

      const baseHeight = 12;
      const speedMultiplier = Math.min(speed * 0.3, 8);
      const dynamicHeight = baseHeight + speedMultiplier;

      const dynamicOffset = new THREE.Vector3(0, dynamicHeight, -10);

      if (this.cameraMode === 'follow') {
         this.controls.enabled = false;

         const vehicleRotation = this.vehicleMesh.quaternion.clone();
         const offset = dynamicOffset.clone();
         offset.applyQuaternion(vehicleRotation);

         const cameraPosition = vehiclePosition.clone().add(offset);
         this.camera.position.lerp(cameraPosition, 0.1);
         this.camera.lookAt(vehiclePosition);

      } else if (this.cameraMode === 'orbit') {
         this.controls.enabled = true;
         this.controls.target.copy(vehiclePosition);

         if (this.camera.position.y < vehiclePosition.y + 5) {
            this.camera.position.y = vehiclePosition.y + 5;
         }

         this.controls.update();
      }
   }

   toggleCameraMode() {
      if (this.cameraMode === 'follow') {
         this.cameraMode = 'orbit';
         this.controls.enabled = true;
         console.log("Switched to orbit camera mode");
      } else {
         this.cameraMode = 'follow';
         this.controls.enabled = false;
         console.log("Switched to follow camera mode");
      }
   }

   animate() {
      requestAnimationFrame(this.animate.bind(this));

      const deltaTime = this.clock.getDelta();
      try {
         this.prePhysicsUpdate();

         this.updatePhysics(deltaTime);

         this.handleCamera();

         this.updateRpmGauge();

         if (this.controls) this.controls.update();

         this.renderer.render(this.scene, this.camera);
      } catch (error) {
         console.error("Animation error:", error);
         this.setState(State.ERROR, `Animation error: ${error.message}`);
      }
   }

   // AI:n tekemä: Create a recursive function that creates a pyramid out of cubes with createbody function. Grok 3
   async createPyramid(basePosition, layers = 10, cubeSize = 2.0, currentLayer = 0) {
      this.tempRVec.Set(30, 0, -30)
      basePosition = this.tempRVec;

      if (currentLayer >= layers) {
         return; // Base case: stop when all layers are built
      }

      // Calculate the number of cubes per side for this layer (decreasing pyramid)
      const numCubesPerSide = layers - currentLayer;
      const halfSide = (numCubesPerSide - 1) / 2.0;

      // Compute the Y offset for this layer (stacking upward from base)
      const layerYOffset = currentLayer * cubeSize;
      const layerY = basePosition.GetY() + layerYOffset;

      const texture = this.texLoader.load('static/gameAssets/box.jpeg');
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.offset.set(0, 0);
      texture.repeat.set(1, 1);
      texture.magFilter = THREE.NearestFilter;
      let material = new THREE.MeshPhongMaterial({ map: texture, color: 0xbfbfbf });

      let pyramid = [];

      // Generate cubes for this layer in a square grid
      for (let x = 0; x < numCubesPerSide; x++) {
         for (let z = 0; z < numCubesPerSide; z++) {
            // Position each cube centered in the layer grid
            const cubeX = basePosition.GetX() + (x - halfSide) * cubeSize;
            const cubeZ = basePosition.GetZ() + (z - halfSide) * cubeSize;
            const cubePos = new this.Jolt.RVec3(cubeX, layerY, cubeZ);

            // Rotation (identity for upright cubes)
            const cubeQuat = new this.Jolt.Quat(0, 0, 0, 1);

            // Create box shape for the cube
            const halfExtent = new this.Jolt.Vec3(cubeSize / 2, cubeSize / 2, cubeSize / 2);
            const shapeSettings = new this.Jolt.BoxShapeSettings(halfExtent);

            // Add as static body (for a stable pyramid; use Dynamic if interactive)
            const box = this.createAndAddBody(
               shapeSettings,
               cubePos,
               cubeQuat,
               this.Jolt.EMotionType_Dynamic,
               LAYER_MOVING,
               0x000000,
               17,
               material

            );
            pyramid.push(box);

            // Cleanup resources
            this.Jolt.destroy(shapeSettings);
            this.Jolt.destroy(cubePos);
            this.Jolt.destroy(cubeQuat);
            this.Jolt.destroy(halfExtent);
         }
      }

      // Recursive call for the next smaller layer
      this.createPyramid(basePosition, layers, cubeSize, currentLayer + 1);

      return pyramid;
   }

   async createProps() {
      try {
         const shapeSettings = new this.Jolt.BoxShapeSettings(
            new this.Jolt.Vec3(5, 0.1, 5)
         );


         this.tempRVec.Set(10, -5, -30);
         this.tempQuat.Set(0, 0, 0, 1);

         const body = this.createAndAddBody(
            shapeSettings,
            this.tempRVec,
            this.tempQuat,
            this.Jolt.EMotionType_Dynamic,
            LAYER_MOVING,
            0xa6a6a6
         );


         return body
      } catch (e) {
         throw e
      }
   }

   websocketConnect() {
      //  this.setState(State.LOADING);
      this.setNetworkState(NetworkState.CONNECTING);
      this.ws = new WebSocket('ws://localhost:4000/ws');
      if (!this.ws) {
         throw new Error("WebSocket creation failed");
      }

      let counter = 0;

      const cleanup = () => {
         if (this.sendInterval) {
            clearInterval(this.sendInterval);
            this.sendInterval = null;
         }
      };

      this.ws.addEventListener("error", (error) => {
         console.error("WebSocket error:", error);
         this.setState(State.ERROR, error);
         this.setNetworkState(NetworkState.DISCONNECTED);
         cleanup();
      });

      this.ws.addEventListener("open", () => {
         this.addDebugLog("info", "Websocket connected");
         this.setState(State.READY);
         this.setNetworkState(NetworkState.CONNECTED);

         if (this.sendInterval) {
            clearInterval(this.sendInterval);
         }

         this.sendInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
               ++counter

               let packet;

               let data;
               if (isNaN(this.playerId) ||
                  isNaN(this.playerPosition.x) || isNaN(this.playerPosition.y) || isNaN(this.playerPosition.z) ||
                  isNaN(this.playerRotation.x) || isNaN(this.playerRotation.y) || isNaN(this.playerRotation.z) || isNaN(this.playerRotation.w) ||
                  isNaN(this.playerVelocity.x) || isNaN(this.playerVelocity.y) || isNaN(this.playerVelocity.z)) {
                  packet = null;
               } else {
                  packet = {
                     player_id: Number(this.playerId),
                     position: this.playerPosition,
                     rotation: this.playerRotation,
                     velocity: this.playerVelocity
                  }

                  data = new Float64Array([
                     this.playerId,
                     this.playerPosition.x,
                     this.playerPosition.y,
                     this.playerPosition.z,
                     this.playerRotation.x,
                     this.playerRotation.y,
                     this.playerRotation.z,
                     this.playerRotation.w,
                     this.playerVelocity.x,
                     this.playerVelocity.y,
                     this.playerVelocity.z,
                  ]);

                  const packetStr = JSON.stringify(packet, null, 2);

                  this.addDebugLog('info', `CLIENT SENT: packet #${counter}\n${packetStr}`);
                  try {
                     this.ws.send(data.buffer);
                  } catch (e) {
                     this.addDebugLog('error', `WebSocket send failed: ${e.message}`);
                  }
               }
            } else {
               this.log('info', "Websocket not open, not sending messages")
               cleanup();
            }
         }, 1000);
      });

      this.ws.addEventListener("close", (event) => {
         this.setNetworkState(NetworkState.DISCONNECTED);
         this.addDebugLog("info", `websocket closed. ${event.code} ${event.reason}`);
         cleanup();
      });
   }
   async init() {
      try {
         this.addDebugLog('info', 'Debug log initialized');
         this.addDebugLog('info', `Player id: ${this.playerId}`)
         try { this.websocketConnect(); } catch (e) { throw e }

         try { this.initScene(); } catch (e) { throw e }
         this.gltfLoader = new GLTFLoader();

         this.clock = new THREE.Clock();
         this.cameraOffset = new THREE.Vector3(0, 7, -13);

         try { await this.initPhysics(); } catch (e) { throw e }


         try { await this.createMap(); } catch (e) { throw e }
         try { await this.createRoads(); } catch (e) { throw e }

         try { await this.createProps(); } catch (e) { throw e }

         try { await this.createPyramid(); } catch (e) { throw e }
         // try { await this.createBuildings(); } catch (e) { throw e }
         try { this.createVehicle(); } catch (e) { throw e }
         try { this.createGround(); } catch (e) { throw e }





         // cars spawn position. gltf loading happens async so the other translations messes it up.
         this.tempRVec.Set(-40, 0, -40);
         this.tempQuat.Set(0, 0, 0, 1);

         try { this.setupControls(); } catch (e) { throw e }


         this.setState(State.READY);
         this.animate();

         this.addUiElement(`<div class="game-hint">
             <span>WASD: Drive</span><br>
             <span>Space: Handbrake</span>
             <!-- add more hints -->
           </div>`,
            10);
         // this.addUiElement(`
         //      <div class="game-pop">
         //        <button class="close-pop" title="Close">&times;</button>
         //        <h1>Buy the BattlePass!</h1>
         //        <p>For a good price of 100€, you can get the battlepass for yourself today!</p>
         //        <p>With the battlepass you can keep up your interest in playing this game, that you wouldn't otherwise have!</p>
         //        <p>You can grind levels to earn limited time cosmetics that gives you fear of missing out and nobody wants to see.</p>
         //      </div>
         //    `
         //    , 15);
      } catch (error) {
         console.error("Failed to initialize game:", error);
         this.setState(State.ERROR, error.message);
      }
   }


   cleanup() {
      console.log("Cleaning up physics resources");


      if (this.controlHandlers) {
         document.removeEventListener('keydown', this.controlHandlers.keyDown);
         document.removeEventListener('keyup', this.controlHandlers.keyUp);
      }

      if (this.physicsSystem && this.vehicleStepListener) {
         this.physicsSystem.RemoveStepListener(this.vehicleStepListener);
      }

      if (this.vehicle) {
         this.physicsSystem.RemoveConstraint(this.vehicle);
         this.Jolt.destroy(this.vehicle);
      }

      if (this.vehicleCallbacks) {
         this.Jolt.destroy(this.vehicleCallbacks);
      }

      if (this.controllerCallbacks) {
         this.Jolt.destroy(this.controllerCallbacks);
      }

      if (this.bodyInterface) {
         for (const obj of this.dynamicObjects) {
            if (obj.userData && obj.userData.body) {
               const id = obj.userData.body.GetID();
               this.bodyInterface.RemoveBody(id);
               this.bodyInterface.DestroyBody(id);
            }
         }

         for (const obj of this.staticObjects) {
            if (obj.userData && obj.userData.body) {
               const id = obj.userData.body.GetID();
               this.bodyInterface.RemoveBody(id);
               this.bodyInterface.DestroyBody(id);
            }
         }
      }

      if (this.joltInterface) {
         this.Jolt.destroy(this.joltInterface);
      }

      if (this.tempVec) this.Jolt.destroy(this.tempVec);
      if (this.tempRVec) this.Jolt.destroy(this.tempRVec);
      if (this.tempQuat) this.Jolt.destroy(this.tempQuat);

      this.vehicle = null;
      this.vehicleWheels = [];

      this.vehicleStepListener = null;

      this.vehicleCallbacks = null;
      this.controllerCallbacks = null;

      this.dynamicObjects = [];
      this.staticObjects = [];

      this.clock = null;
      this.texLoader = null;
      this.bodyInterface = null;
      this.physicsSystem = null;
      this.joltInterface = null;
   }
}

document.addEventListener('DOMContentLoaded', () => {
   console.log("DOM loaded, initializing game");
   const game = new Game();
   game.init();

   window.addEventListener('beforeunload', () => {
      game.cleanup();
   });
});
