import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import initJolt from 'jolt-physics';


const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_LAYERS = 2;

const BP_LAYER_NON_MOVING = 0;
const BP_LAYER_MOVING = 1;
const NUM_BROAD_PHASE_LAYERS = 2;

const State = {
   READY: 0,
   ERROR: 1,
   LOADING: 2,
};

class Game {
   constructor() {
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.clock = null;
      this.controls = null;
      this.vehicle = null;

      this.keyState = {};
      this.playerId = window.playerId || 123;

      this.state = State.LOADING;
      this.overlay = null;
      this.canvasContainer = document.getElementById('gameCanvas');

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
      this.vehicleMesh = null;
      this.groundMesh = null;
      this.wheelMeshes = [];
      this.track = [
         // track
         [
            [
               [38, 64, -14],
               [38, 64, -16],
               [38, -64, -16],
               [38, -64, -14],
               [64, -64, -16],
               [64, -64, -14],
               [64, 64, -16],
               [64, 64, -14],
            ],
            [
               [-16, 64, -14],
               [-16, 64, -16],
               [-16, -64, -16],
               [-16, -64, -14],
               [10, -64, -16],
               [10, -64, -14],
               [10, 64, -16],
               [10, 64, -14],
            ],
            [
               [10, -48, -14],
               [10, -48, -16],
               [10, -64, -16],
               [10, -64, -14],
               [38, -64, -16],
               [38, -64, -14],
               [38, -48, -16],
               [38, -48, -14],
            ],
            [
               [10, 64, -14],
               [10, 64, -16],
               [10, 48, -16],
               [10, 48, -14],
               [38, 48, -16],
               [38, 48, -14],
               [38, 64, -16],
               [38, 64, -14],
            ],
         ],
         // walls
         [
            [
               [38, 48, -10],
               [38, 48, -14],
               [38, -48, -14],
               [38, -48, -10],
               [40, -48, -14],
               [40, -48, -10],
               [40, 48, -14],
               [40, 48, -10],
            ],
            [
               [62, 62, -10],
               [62, 62, -14],
               [62, -64, -14],
               [62, -64, -10],
               [64, -64, -14],
               [64, -64, -10],
               [64, 62, -14],
               [64, 62, -10],
            ],
            [
               [8, 48, -10],
               [8, 48, -14],
               [8, -48, -14],
               [8, -48, -10],
               [10, -48, -14],
               [10, -48, -10],
               [10, 48, -14],
               [10, 48, -10],
            ],
            [
               [-16, 62, -10],
               [-16, 62, -14],
               [-16, -64, -14],
               [-16, -64, -10],
               [-14, -64, -14],
               [-14, -64, -10],
               [-14, 62, -14],
               [-14, 62, -10],
            ],
            [
               [-14, -62, -10],
               [-14, -62, -14],
               [-14, -64, -14],
               [-14, -64, -10],
               [62, -64, -14],
               [62, -64, -10],
               [62, -62, -14],
               [62, -62, -10],
            ],
            [
               [8, -48, -10],
               [8, -48, -14],
               [8, -50, -14],
               [8, -50, -10],
               [40, -50, -14],
               [40, -50, -10],
               [40, -48, -14],
               [40, -48, -10],
            ],
            [
               [8, 50, -10],
               [8, 50, -14],
               [8, 48, -14],
               [8, 48, -10],
               [40, 48, -14],
               [40, 48, -10],
               [40, 50, -14],
               [40, 50, -10],
            ],
            //            [
            //               [-16, 64, -10],
            //               [-16, 64, -14],
            //               [-16, 62, -14],
            //               [-16, 62, -10],
            //               [64, 62, -14],
            //               [64, 62, -10],
            //               [64, 64, -14],
            //               [64, 64, -10],
            //            ],
         ],
         // jumps
         [
            [
               [-4, 22, -14],
               [-4, -14, -14],
               [-4, -14, -10],
               [4, -14, -14],
               [4, -14, -10],
               [4, 22, -14],
            ],
            [
               [-4, -27, -14],
               [-4, -48, -14],
               [-4, -48, -11],
               [4, -48, -14],
               [4, -48, -11],
               [4, -27, -14],
            ],
            [
               [-4, 50, -14],
               [-4, 30, -14],
               [-4, 30, -12],
               [4, 30, -14],
               [4, 30, -12],
               [4, 50, -14],
            ],
            [
               [46, 50, -14],
               [46, 31, -14],
               [46, 50, -12],
               [54, 31, -14],
               [54, 50, -12],
               [54, 50, -14],
            ],
            [
               [46, 16, -14],
               [46, -19, -14],
               [46, 16, -10],
               [54, -19, -14],
               [54, 16, -10],
               [54, 16, -14],
            ],
            [
               [46, -28, -14],
               [46, -48, -14],
               [46, -28, -11],
               [54, -48, -14],
               [54, -28, -11],
               [54, -28, -14],
            ],
         ],
      ];
      this.mapColors = [0x666666, 0x006600, 0x000066];
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

   showSpinner() {
      this.hideOverlay();
      this.overlay = document.createElement('div');
      this.overlay.className = 'game-overlay spinner';
      this.overlay.innerHTML = `<div class="spinner"></div>`;
      this.canvasContainer.appendChild(this.overlay);
   }

   showError(message) {
      this.hideOverlay();
      this.overlay = document.createElement('div');
      this.overlay.className = 'game-overlay error';
      this.overlay.innerHTML = `<p>${message || "An error occurred."}</p>`;
      this.canvasContainer.appendChild(this.overlay);
   }

   hideOverlay() {
      if (this.overlay && this.canvasContainer.contains(this.overlay)) {
         this.canvasContainer.removeChild(this.overlay);
      }
      this.overlay = null;
   }

   setState(newState, errorMessage) {
      this.state = newState;
      if (this.state === State.LOADING) this.showSpinner();
      else if (this.state === State.ERROR) this.showError(errorMessage);
      else this.hideOverlay();
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
         settings.mMaxWorkerThreads = 0;

         const objectFilter = new this.Jolt.ObjectLayerPairFilterTable(NUM_LAYERS);
         objectFilter.EnableCollision(LAYER_NON_MOVING, LAYER_MOVING);
         objectFilter.EnableCollision(LAYER_MOVING, LAYER_MOVING);

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
         this.scene.background = new THREE.Color(0x88ccff);

         this.scene.add(new THREE.AmbientLight(0x404040));
         const dirLight = new THREE.DirectionalLight(0xffffff, 1);
         dirLight.position.set(10, 10, 5);
         this.scene.add(dirLight);

         this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
         this.camera.position.set(0, 15, 30);
         this.camera.lookAt(new THREE.Vector3(0, 0, 0));

         this.renderer = new THREE.WebGLRenderer({ antialias: true });
         this.renderer.setClearColor(0xbfd1e5);
         this.renderer.setSize(window.innerWidth, window.innerHeight);
         this.renderer.setPixelRatio(window.devicePixelRatio);

         if (!this.canvasContainer) throw new Error("gameCanvas element not found");
         this.canvasContainer.appendChild(this.renderer.domElement);

         this.controls = new OrbitControls(this.camera, this.renderer.domElement);

         window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
         });
      } catch (error) {
         console.error("Failed to initialize scene:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   createAndAddBody(shapeSettings, position, rotation, motionType, layer, color) {
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

         const threeObject = this.getThreeObjectForBody(body, color);
         threeObject.userData.body = body;
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

   getThreeObjectForBody(body, color) {
      const material = new THREE.MeshPhongMaterial({ color: color });
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
         this.tempRVec.Set(0, -15, 0);
         this.tempQuat.Set(0, 0, 0, 1);

         const groundShapeSettings = new this.Jolt.BoxShapeSettings(
            new this.Jolt.Vec3(200, 0.5, 200),
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


   createTrack() {
      this.setState(State.LOADING);
      console.log("Creating track");

      try {
         this.track.forEach((type, tIdx) => {
            type.forEach((block) => {
               const hull = new this.Jolt.ConvexHullShapeSettings();
               block.forEach((v) => {
                  this.tempVec.Set(-v[1], v[2], v[0]);
                  hull.mPoints.push_back(this.tempVec);
               });

               this.tempRVec.Set(0, 0, 0);
               this.tempQuat.Set(0, 0, 0, 1);

               this.createAndAddBody(
                  hull,
                  this.tempRVec,
                  this.tempQuat,
                  this.Jolt.EMotionType_Static,
                  LAYER_NON_MOVING,
                  this.mapColors[tIdx]
               );

               this.Jolt.destroy(hull);
            });
         });

         console.log("Track created successfully");
      } catch (error) {
         console.error("Failed to create track:", error);
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
      } catch (error) {
         console.error("Failed to set up controls:", error);
         this.setState(State.ERROR, error.message);
         throw error;
      }
   }

   processInput() {
      if (!this.vehicle) return;
      try {
         const input = this.input;
         let forward = 0.0, right = 0.0, brake = 0.0, handBrake = 0.0;

         forward = input.forwardPressed ? 1.0 : (input.backwardPressed ? -1.0 : 0.0);
         right = input.rightPressed ? 1.0 : (input.leftPressed ? -1.0 : 0.0);

         if (this.previousForward * forward < 0.0) {
            const rotation = this.wrapQuat(this.vehicle.chassisBody.GetRotation().Conjugated());
            const linearV = this.wrapVec3(this.vehicle.chassisBody.GetLinearVelocity());
            const velocity = linearV.applyQuaternion(rotation).z;

            if ((forward > 0.0 && velocity < -0.1) || (forward < 0.0 && velocity > 0.1)) {
               forward = 0.0;
               brake = 1.0;
            }
            else {
               this.previousForward = forward;
            }
         }

         if (input.handBrake) {
            forward = 0.0;
            handBrake = 1.0;
         }

         const controller = this.Jolt.castObject(this.vehicle.GetController(), this.Jolt.WheeledVehicleController);
         controller.SetDriverInput(forward, right, brake, handBrake);

         if (right != 0.0 || forward != 0.0 || brake != 0.0 || handBrake != 0.0) {
            this.bodyInterface.ActivateBody(this.vehicle.chassisBody.GetID());
         }
      } catch (error) {
         console.error("Failed to process input:", error);
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

         for (const obj of this.dynamicObjects) {
            for (let i = 0, il = this.dynamicObjects.length; i < il; i++) {
               let objThree = this.dynamicObjects[i];
               let body = objThree.userData.body;
               obj.position.copy(this.wrapVec3(body.GetPosition()));
               obj.quaternion.copy(this.wrapQuat(body.GetRotation()));


               if (body.GetBodyType() == this.Jolt.EBodyType_SoftBody) {
                  if (objThree.userData.updateVertex) {
                     objThree.userData.updateVertex();
                  } else {
                     objThree.geometry = createMeshForShape(body.GetShape());
                  }
               }
            }
         }

         if (this.vehicle && this.wheelMeshes.length > 0) {
            for (let i = 0; i < this.wheelMeshes.length; i++) {
               const wheel = this.vehicle.GetWheel(i);
               const wheelTransform = wheel.GetWorldTransform();
               const wheelMesh = this.wheelMeshes[i];

               wheelMesh.position.copy(this.wrapVec3(wheelTransform.GetTranslation()));
               wheelMesh.quaternion.copy(this.wrapQuat(wheelTransform.GetRotation()));
            }
         }

         return true;
      } catch (error) {
         console.error("Physics update failed:", error);
         return false;
      }
   }

   animate() {
      requestAnimationFrame(this.animate.bind(this));

      const deltaTime = this.clock.getDelta();
      try {
         this.processInput();

         this.updatePhysics(deltaTime);

         if (this.controls) this.controls.update();

         this.renderer.render(this.scene, this.camera);
      } catch (error) {
         console.error("Animation error:", error);
         this.setState(State.ERROR, `Animation error: ${error.message}`);
      }
   }

   createProps() {
      try {
         const shapeSettings = new this.Jolt.BoxShapeSettings(
            new this.Jolt.Vec3(1, 1, 1)
         );

         this.tempRVec.Set(0, 1, 0);
         this.tempQuat.Set(0, 0, 0, 1);

         const body = this.createAndAddBody(
            shapeSettings,
            this.tempRVec,
            this.tempQuat,
            this.Jolt.EMotionType_Dynamic,
            LAYER_MOVING,
            0xff0000
         );


      } catch (e) {
         throw e
      }
   }

   async init() {
      console.log("Starting game for player:", this.playerId);
      try {

         try { this.initScene(); } catch (e) { throw e }

         this.clock = new THREE.Clock();

         try { await this.initPhysics(); } catch (e) { throw e }

         try { this.createGround(); } catch (e) { throw e }
         try { this.createTrack(); } catch (e) { throw e }

         try { this.createProps(); } catch (e) { throw e }

         try { this.setupControls(); } catch (e) { throw e }

         console.log("Game initialized successfully");

         this.setState(State.READY);
         this.animate();

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
      this.clock = null;
      this.vehicleStepListener = null;
      this.vehicleCallbacks = null;
      this.controllerCallbacks = null;
      this.dynamicObjects = [];
      this.staticObjects = [];
      this.wheelMeshes = [];
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
