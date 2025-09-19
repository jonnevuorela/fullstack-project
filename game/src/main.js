// Tässä on käytetty pohjana Jolt fysiikkakirjaston javascript binding repon
// wheeled vehicle esimerkkiä, joka löytyy osoitteesta
// https://github.com/jrouwe/JoltPhysics.js/blob/main/Examples/vehicle_wheeled.html#L165
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import initJolt from 'jolt-physics';
import { materialReference } from 'three/src/nodes/TSL.js';

const LAYER_NON_MOVING = 0;
const LAYER_MOVING = 1;
const NUM_LAYERS = 2;

const State = {
   READY: 0,
   ERROR: 1,
   LOADING: 2,
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
      this.canvasContainer = document.getElementById('gameCanvas');
      this.uiOverlay = null;
      this.currentRPM = 0;

      // player
      this.controls = null;
      this.playerPosition = null;
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

         this.scene.add(new THREE.AmbientLight(0x1f2a4d));
         const dirLight = new THREE.DirectionalLight(0xffcc77, 2);
         dirLight.position.set(10, 7, 5);
         this.scene.add(dirLight);

         this.camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.1, 1000);
         this.camera.position.set(0, 15, 30);
         this.camera.lookAt(new THREE.Vector3(0, 0, 0));

         this.renderer = new THREE.WebGLRenderer({ antialias: true });
         this.renderer.setClearColor(0xbfd1e5);
         this.renderer.setSize(window.innerWidth, window.innerHeight);
         this.renderer.setPixelRatio(window.devicePixelRatio);

         if (!this.canvasContainer) throw new Error("gameCanvas element not found");
         this.canvasContainer.appendChild(this.renderer.domElement);

         this.controls = new OrbitControls(this.camera, this.renderer.domElement);


         this.uiOverlay = document.createElement('div');
         this.uiOverlay.id = 'ui-display';
         this.uiOverlay.className = 'game-overlay ui-display';
         this.uiOverlay.innerHTML = '<span id="rpm-value">0 RPM</span>';
         this.canvasContainer.appendChild(this.uiOverlay);

         window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
         });

         this.texLoader = new THREE.TextureLoader();
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
         this.tempRVec.Set(0, -16, 0);
         this.tempQuat.Set(0, 0, 0, 1);

         const groundShapeSettings = new this.Jolt.BoxShapeSettings(
            new this.Jolt.Vec3(20000, 0.5, 20000),
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

   createVehicle() {
      this.setState(State.LOADING);
      console.log("Creating vehicle");

      const wheelRadius = 0.55;
      const wheelWidth = 0.6;

      const halfVehicleLength = 4.445;
      const halfVehicleWidth = 1.695;
      const halfVehicleHeight = 0.1;
      const wheelBase = halfVehicleLength / 1.83;

      const wheelOffset = -0.2;
      const wheelOffsetVertical = -0.67;
      const wheelOffsetLongitudal = 0.4;

      const suspensionMinLength = 0.05;
      const suspensionMaxLength = 0.3;
      const suspensionPreloadLenght = 0.7;
      const suspensionStiffness = 10;
      const suspensionDamping = 1;
      const suspensionFrequency = 1;

      const maxSteerAngle = this.degreesToRadians(55);

      // LinearCurve multiplier
      const frontTyreLateralFriction = 20;
      const frontTyreLongitudalFriction = 5;

      // LinearCurve multiplier
      const rearTyreLateralFriction = 5;
      const rearTyreLongitudalFriction = 20;

      const transmissionMode = this.Jolt.ETransmissionMode_Auto;
      const fourWheelDrive = false;
      const torqueSplitRatio = 1.4;
      const differentialLimitedSlipRatio = 1.3;
      const antiRollbar = true;

      const maxEngineTorque = 2500.0;
      const clutchStrength = 100.0;
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

      const texture = this.texLoader.load('data:image/gif;base64,R0lGODdhAgACAIABAAAAAP///ywAAAAAAgACAAACA0QCBQA7');
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.offset.set(0, 0);
      texture.repeat.set(1, 1);
      texture.magFilter = THREE.NearestFilter;
      let wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x666666 });
      wheelMaterial.map = texture;


      this.tempRVec.Set(10, 0, -30);
      this.tempQuat.Set(0, 180, 0, 1);
      try {
         const carShapeSettings = new this.Jolt.OffsetCenterOfMassShapeSettings(new this.Jolt.Vec3(0, -halfVehicleHeight, 0),
            new this.Jolt.BoxShapeSettings(new this.Jolt.Vec3(halfVehicleWidth, halfVehicleHeight, halfVehicleLength)));



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

            //carModel.scale.set(0.018, 0.018, 0.018);

            carModel.position.set(-100, 0, 0);

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
            const mWheels = [];
            {
               const frontLongitudinalCurve = new this.Jolt.LinearCurve();
               frontLongitudinalCurve.AddPoint(0.05 * frontTyreLongitudalFriction, 1.2 * frontTyreLongitudalFriction);
               frontLongitudinalCurve.Sort();


               const frontLateralCurve = new this.Jolt.LinearCurve();
               frontLateralCurve.AddPoint(0.1 * frontTyreLateralFriction, 1.15 * frontTyreLateralFriction);
               frontLateralCurve.Sort();

               const rearLongitudinalCurve = new this.Jolt.LinearCurve();
               rearLongitudinalCurve.AddPoint(0.05 * rearTyreLongitudalFriction, 1.1 * rearTyreLongitudalFriction);
               rearLongitudinalCurve.Sort();

               const rearLateralCurve = new this.Jolt.LinearCurve();
               rearLateralCurve.AddPoint(0.1 * rearTyreLateralFriction, 1.1 * rearTyreLateralFriction);
               rearLateralCurve.Sort();

               const fl = new this.Jolt.WheelSettingsWV();
               fl.mPosition = new this.Jolt.Vec3((halfVehicleWidth + wheelOffset), -wheelOffsetVertical, wheelBase + wheelOffsetLongitudal);
               fl.set_mMaxSteerAngle(maxSteerAngle);
               fl.mMaxHandBrakeTorque = 0.0;
               fl.set_mLateralFriction(frontLateralCurve);
               fl.set_mLongitudinalFriction(frontLongitudinalCurve);
               vehicle.mWheels.push_back(fl);
               mWheels.push(fl);

               const fr = new this.Jolt.WheelSettingsWV();
               fr.mPosition = new this.Jolt.Vec3(-(halfVehicleWidth + wheelOffset), -wheelOffsetVertical, wheelBase + wheelOffsetLongitudal);
               fr.set_mMaxSteerAngle(maxSteerAngle);
               fr.mMaxHandBrakeTorque = 0.0;
               fr.set_mLateralFriction(frontLateralCurve);
               fr.set_mLongitudinalFriction(frontLongitudinalCurve);
               vehicle.mWheels.push_back(fr);
               mWheels.push(fr);

               const bl = new this.Jolt.WheelSettingsWV();
               bl.mPosition = new this.Jolt.Vec3((halfVehicleWidth + wheelOffset), -wheelOffsetVertical, -wheelBase + wheelOffsetLongitudal / 2);
               bl.set_mMaxSteerAngle(0);
               fr.mMaxHandBrakeTorque = 100.0;
               bl.set_mLateralFriction(rearLateralCurve);
               bl.set_mLongitudinalFriction(rearLongitudinalCurve);
               vehicle.mWheels.push_back(bl);
               mWheels.push(bl);

               const br = new this.Jolt.WheelSettingsWV();
               br.mPosition = new this.Jolt.Vec3(-(halfVehicleWidth + wheelOffset), -wheelOffsetVertical, -wheelBase + wheelOffsetLongitudal / 2);
               br.set_mMaxSteerAngle(0);
               fr.mMaxHandBrakeTorque = 100.0;
               br.set_mLateralFriction(rearLateralCurve);
               br.set_mLongitudinalFriction(rearLongitudinalCurve);
               vehicle.mWheels.push_back(br);
               mWheels.push(br);

               this.Jolt.destroy(frontLateralCurve);
               this.Jolt.destroy(frontLongitudinalCurve);
               this.Jolt.destroy(rearLateralCurve);
               this.Jolt.destroy(rearLongitudinalCurve);
            }
            mWheels.forEach(wheelS => {
               wheelS.mRadius = wheelRadius;
               wheelS.mWidth = wheelWidth;
               wheelS.mSuspensionMinLength = suspensionMinLength;
               wheelS.mSuspensionMaxLength = suspensionMaxLength;
               wheelS.set_mSuspensionPreloadLength(suspensionPreloadLenght);

               const spring = wheelS.get_mSuspensionSpring()
               spring.set_mStiffness(suspensionStiffness);
               spring.set_mFrequency(suspensionFrequency);
               spring.set_mDamping(suspensionDamping);
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

            const createThreeWheel = (constraint, wheelIndex, body) => {
               const joltWheel = constraint.GetWheel(wheelIndex);
               const wheelSetting = joltWheel.GetSettings();

               const scaleRatio = wheelSetting.mRadius / 0.5;
               const isLeftSide = wheelIndex === 0 || wheelIndex === 2;

               let wheel;
               if (isLeftSide) {
                  wheel = this.wheelGltfL.scene.clone();
                  wheel.rotation.x = -Math.PI / 2;
               } else {
                  wheel = this.wheelGltfR.scene.clone();
                  wheel.rotation.x = Math.PI / 2;
               }
               const additionalScaleFactor = 0.7;
               wheel.scale.set(
                  scaleRatio * additionalScaleFactor,
                  scaleRatio * additionalScaleFactor,
                  scaleRatio * additionalScaleFactor
               );
               wheel.scale.set(scaleRatio, scaleRatio, scaleRatio);
               body.add(wheel);

               wheel.updateLocalTransform = () => {
                  let transform = constraint.GetWheelLocalTransform(wheelIndex, wheelRight, wheelUp);
                  wheel.position.copy(this.wrapVec3(transform.GetTranslation()));
                  const wheelRotation = this.wrapQuat(transform.GetRotation().GetQuaternion());
                  wheel.quaternion.copy(wheelRotation);
                  if (isLeftSide) {
                     wheel.rotateX(-Math.PI / 2);
                  } else {
                     wheel.rotateX(Math.PI / 2);
                  }
               };

               wheel.updateLocalTransform();
               return wheel;
            };

            this.vehicleWheels = [];
            for (let i = 0; i < vehicle.mWheels.size(); i++) {
               this.vehicleWheels.push(createThreeWheel(this.vehicle, i, vehicleMesh));
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

         if (this.previousForward * forward < 0.0) {
            const rotation = this.wrapQuat(this.vehicleBody.GetRotation().Conjugated());
            const linearV = this.wrapVec3(this.vehicleBody.GetLinearVelocity());
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

         this.vehicleWheels.forEach(wheel => wheel.updateLocalTransform());
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

         if (this.controls) this.controls.update();

         this.renderer.render(this.scene, this.camera);
      } catch (error) {
         console.error("Animation error:", error);
         this.setState(State.ERROR, `Animation error: ${error.message}`);
      }
   }

   // AI:n tekemä: Create a recursive function that creates a pyramid out of cubes with createbody function. Grok 3
   createPyramid(basePosition, layers = 10, cubeSize = 2.0, currentLayer = 0) {
      this.tempRVec.Set(30, -10, -30)
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
            this.createAndAddBody(
               shapeSettings,
               cubePos,
               cubeQuat,
               this.Jolt.EMotionType_Dynamic,
               LAYER_MOVING,
               0x000000,
               17,
               material

            );

            // Cleanup resources
            this.Jolt.destroy(shapeSettings);
            this.Jolt.destroy(cubePos);
            this.Jolt.destroy(cubeQuat);
            this.Jolt.destroy(halfExtent);
         }
      }

      // Recursive call for the next smaller layer
      this.createPyramid(basePosition, layers, cubeSize, currentLayer + 1);
   }

   createProps() {
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


      } catch (e) {
         throw e
      }
   }

   async init() {
      console.log("Starting game for player:", this.playerId);
      try {

         try { this.initScene(); } catch (e) { throw e }
         this.gltfLoader = new GLTFLoader();

         this.clock = new THREE.Clock();
         this.cameraOffset = new THREE.Vector3(0, 7, -13);

         try { await this.initPhysics(); } catch (e) { throw e }


         try { this.createGround(); } catch (e) { throw e }
         try { this.createTrack(); } catch (e) { throw e }

         try { this.createVehicle(); } catch (e) { throw e }

         try { this.createPyramid(); } catch (e) { throw e }

         try { this.createProps(); } catch (e) { throw e }

         // cars spawn position. gltf loading happens async so the other translations messes it up.
         this.tempRVec.Set(-40, 0, -40);
         this.tempQuat.Set(0, 0, 0, 1);

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
