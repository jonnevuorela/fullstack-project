import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const State = {
   READY: 0,
   ERROR: 1,
   LOADING: 2,
}
class Game {
   constructor() {
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.vehicle = null;

      this.keyState = {};
      this.playerId = window.playerId || 'local';
      this.state = State.LOADING;
      this.overlay = null;
      this.canvasContainer = document.getElementById('gameCanvas');

   }

   degreesToRadians(degrees) {
      return degrees * Math.PI / 180;
   }

   wrapVec3(vec) {
      return new THREE.Vector3(vec.x, vec.y, vec.z);
   }

   wrapQuat(quat) {
      return new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w);
   }

   showSpinner() {
      this.hideOverlay();
      this.overlay = document.createElement('div');
      this.overlay.className = 'game-overlay spinner';
      this.overlay.innerHTML = `<div class="spinner"></div><p>Loading...</p>`;
      this.canvasContainer.appendChild(this.overlay);
   }
   showError(message) {
      this.hideOverlay();
      this.overlay = document.createElement('div');
      this.overlay.className = 'game-overlay error';
      this.overlay.innerHTML = `<p>Error: ${message || "An error occurred."}</p>`;
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

   initScene() {
      this.setState(State.LOADING);

      console.log("Initializing Three.js scene");
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x88ccff);

      this.scene.add(new THREE.AmbientLight(0x404040));
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
      directionalLight.position.set(1, 1, 0.5).normalize();
      this.scene.add(directionalLight);

      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.set(10, 5, 10);

      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);

      if (!this.canvasContainer) throw new Error("gameCanvas element not found");
      this.canvasContainer.appendChild(this.renderer.domElement);

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;

      window.addEventListener('resize', () => {
         this.camera.aspect = window.innerWidth / window.innerHeight;
         this.camera.updateProjectionMatrix();
         this.renderer.setSize(window.innerWidth, window.innerHeight);
      });
   }


   setupControls() {
      console.log("Setting up controls");

      this.setState(State.LOADING);

      window.addEventListener('keydown', (e) => { this.keyState[e.code] = true; });
      window.addEventListener('keyup', (e) => { this.keyState[e.code] = false; });
   }

   processInput() {
      if (!this.vehicle) return;
      let forward = 0, steer = 0, brake = 0, handbrake = 0;
      if (this.keyState['KeyW'] || this.keyState['ArrowUp']) forward = 1;
      if (this.keyState['KeyS'] || this.keyState['ArrowDown']) forward = -1;
      if (this.keyState['KeyA'] || this.keyState['ArrowLeft']) steer = -1;
      if (this.keyState['KeyD'] || this.keyState['ArrowRight']) steer = 1;
      if (this.keyState['Space']) handbrake = 1;

      if (this.previousForward * forward < 0) {
         const rotation = this.vehicle.chassisBody.GetRotation().Conjugated();
         const velocity = this.wrapVec3(this.vehicle.chassisBody.GetLinearVelocity());
         const localVelocity = velocity.clone().applyQuaternion(this.wrapQuat(rotation));
         if ((forward > 0 && localVelocity.z < -0.1) || (forward < 0 && localVelocity.z > 0.1)) {
            forward = 0;
            brake = 1;
         } else {
            this.previousForward = forward;
         }
      }

      if (handbrake) {
         forward = 0;
         handbrake = 1;
      }


   }

   animate() {
      requestAnimationFrame(this.animate.bind(this));
      this.processInput();
      if (this.controls) this.controls.update();
      this.renderer.render(this.scene, this.camera);
   }

   async init() {
      console.log("Starting game for player:", this.playerId);
      try {
         try {
            this.initScene();
         } catch (error) {
            console.error("Scene initialization failed: ", error)

            this.setState(State.ERROR, error.message);
            return
         }

         try {
            this.setupControls();
         } catch (error) {
            console.error("Controls setup failed: ", error)

            this.setState(State.ERROR, error.message);
            return
         }

         this.animate();
         console.log("Game initialized successfully");
         this.setState(State.READY);

      } catch (error) {
         console.error("Failed to initialize game:", error);

         this.setState(State.ERROR, error.message);
         return
      }
   }
}


document.addEventListener('DOMContentLoaded', () => {
   console.log("DOM loaded, initializing game");
   new Game().init();
});
