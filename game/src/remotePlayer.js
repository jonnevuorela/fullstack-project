import * as THREE from "three";
// Lähtökohta AI generoitu, josta kehitystä jatkettu - Claude Sonnet 3.5
// Now I require you to do something extra important. i want you to implement two features here and take your time implementing them as they are core features and can make or break this build. Now that we get other players over the websocket, we need to collect and manage them accordingly. we want to render a car for each other player like we do for the player, but the wheels should not be physics simulated. essentially i want lighter version of players car. collider ofcourse for collisions, rotating and steering adjusted wheels would be nice but we dont want to simulate them as it would be heavy. as the update intervall is 1000ms quite long by intention to reduce netork traffic, we need movement prediction for other players from the rotation position and velcity by calculation. this is the second huge feature so take your time on this also. the other players would have their name on top of them and colliders disabled and sleeping icon on top of them if they are inactive. again i cant stress enough this but do take your time and try to make it as robust as possible.

export default class RemotePlayer {
    constructor(game, playerData, packetInterval, debug = false) {
        this.game = game;
        this.id = playerData.player_id;
        this.name = playerData.name || `Player ${this.id}`;
        this.isActive = playerData.activity === 1.0;

        this.PACKET_INTERVAL = packetInterval / 1000; // Convert to seconds

        // Store models for reuse
        this.models = {
            body: null,
            wheelL: null,
            wheelR: null,
        };

        // Physics state (authoritative from server)
        this.position = new THREE.Vector3(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z,
        );
        this.rotation = new THREE.Quaternion(
            playerData.rotation.x,
            playerData.rotation.y,
            playerData.rotation.z,
            playerData.rotation.w,
        );
        this.velocity = new THREE.Vector3(
            playerData.velocity.x,
            playerData.velocity.y,
            playerData.velocity.z,
        );

        // Current visual state (where the mesh actually is)
        this.currentPosition = this.position.clone();
        this.currentRotation = this.rotation.clone();

        // Start position/rotation (where interpolation begins - where we ARE NOW visually)
        this.startPosition = this.position.clone();
        this.startRotation = this.rotation.clone();

        // Target state (where we predict it WILL BE at next packet)
        this.targetPosition = this.position.clone();
        this.targetRotation = this.rotation.clone();

        // Acceleration tracking for better prediction
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.previousVelocity = this.velocity.clone();

        // Angular dynamics
        this.angularVelocity = new THREE.Vector3(0, 0, 0);
        this.angularAcceleration = new THREE.Vector3(0, 0, 0);
        this.previousAngularVelocity = new THREE.Vector3(0, 0, 0);

        this.lastUpdateTime = Date.now();
        this.stateHistory = [];
        this.MAX_HISTORY = 5;

        // Physics constants
        this.FRICTION_COEFF = 0.02;
        this.ANGULAR_FRICTION_COEFF = 0.05;
        this.MAX_SPEED = 200;
        this.MAX_ANGULAR_SPEED = Math.PI * 3;
        this.GROUND_LEVEL = 0.13;
        this.GRAVITY = -9.8;

        // Prediction aggressiveness scales with packet interval
        this.PREDICTION_AGGRESSION = Math.min(this.PACKET_INTERVAL / 0.5, 5.0);
        this.EXTRAPOLATION_SCALE = 0.5 + (this.PACKET_INTERVAL * 0.1);

        // Correction settings
        this.SNAP_THRESHOLD = 10.0 * this.PREDICTION_AGGRESSION;
        this.MAX_PREDICTION_TIME = 1; // seconds
        this.ERROR_CORRECTION_SPEED = 0.1; // How fast to correct position errors

        // Error tracking
        this.positionError = new THREE.Vector3();
        this.averageError = 0;
        this.errorSamples = [];
        this.MAX_ERROR_SAMPLES = 1;

        // Prediction confidence
        this.predictionConfidence = 1.0;

        // Debug
        this.debugMode = debug;
        this.debugArrow = null;
        this.debugTargetSphere = null;
        this.debugStartSphere = null;
        this.debugText = null;

        this.tune = new Tune(playerData.tune || {});

        this.wheels = [];
        this.initialized = false;
        this.init();
    }

    async init() {
        try {
            await this.loadModels();
            await this.createVehicle();
            this.createNameTag();
            this.setName(this.name);
            this.createSleepIcon();

            if (this.debugMode) {
                this.createDebugVisuals();
            }

            this.initialized = true;
        } catch (error) {
            this.game.uiManager.addDebugLog(
                "error",
                `Failed to initialize RemotePlayer ${this.id}`,
            );
        }
    }

    async loadModels() {
        if (!this.models.body) {
            const [carGltf, wheelL, wheelR] = await Promise.all([
                this.game.gltfLoader.loadAsync(
                    "static/gameAssets/s15_body.glb",
                ),
                this.game.gltfLoader.loadAsync(
                    "static/gameAssets/s15_wheel_l.glb",
                ),
                this.game.gltfLoader.loadAsync(
                    "static/gameAssets/s15_wheel_r.glb",
                ),
            ]);

            this.models.body = carGltf.scene;
            this.models.wheelL = wheelL.scene;
            this.models.wheelR = wheelR.scene;
        }
    }

    async createVehicle() {
        this.vehicleMesh = this.models.body.clone();
        this.vehicleMesh.frustumCulled = false;

        this.vehicleMesh.position.copy(this.position);
        this.vehicleMesh.quaternion.copy(this.rotation);
        this.game.scene.add(this.vehicleMesh);

        this.buildWheels(this.tune);
    }
    buildWheels(tune) {
        if (this.wheels && this.wheels.length) {
            for (const w of this.wheels) {
                if (w.parent) w.parent.remove(w);
            }
        }
        this.wheels = [];

        // mittojen asettelu noudattaa eri logiikkaa kuin pelaajan auto,
        // mutta samasta kaavasta saadaan tehtyä myös remoteplayerille auto.
        const wheelPosX = tune.halfVehicleWidth - tune.wheelWidth / 3;
        const wheelPosY = tune.halfVehicleHeight + tune.wheelOffsetVertical;
        const wheelPosZ = tune.wheelBase;

        const longi = tune.wheelLongitudalOffset;

        const wheelPositions = [
            { x: wheelPosX, y: wheelPosY, z: wheelPosZ + longi, left: true, front: true },
            { x: -wheelPosX, y: wheelPosY, z: wheelPosZ + longi, left: false, front: true },
            { x: wheelPosX, y: wheelPosY, z: -wheelPosZ + longi / 2, left: true, front: false },
            { x: -wheelPosX, y: wheelPosY, z: -wheelPosZ + longi / 2, left: false, front: false }
        ];

        wheelPositions.forEach((pos) => {
            const wheel = (pos.left ? this.models.wheelL : this.models.wheelR).clone();
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.rotation.y = pos.left ? -Math.PI / 2 : Math.PI / 2;
            wheel.userData.front = pos.front;
            wheel.userData.left = pos.left;
            wheel.userData.steerAngle = 0;
            wheel.userData.rollAngle = 0;
            this.vehicleMesh.add(wheel);
            this.wheels.push(wheel);
        });
    }

    applyTune(tuneObj) {
        if (!tuneObj) return;
        this.tune = new Tune(tuneObj);
        if (this.vehicleMesh) {
            this.buildWheels(this.tune);
        }
    }

    createNameTag() {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.width = 512;
        canvas.height = 128;

        context.fillStyle = "rgba(0, 0, 0, 0.7)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = "bold 48px Arial";
        context.fillStyle = "#ffffff";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(this.name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            sizeAttenuation: true,
        });
        this.nameSprite = new THREE.Sprite(material);
        this.nameSprite.scale.set(5, 1.25, 1);
        this.nameSprite.position.y = 3.5;
        this.vehicleMesh.add(this.nameSprite);
    }

    setName(name) {
        this.name = name || `Player ${this.id}`;
        if (!this.nameSprite) return;
        const canvas = this.nameSprite.material.map.image;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 48px Arial";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.name, canvas.width / 2, canvas.height / 2);
        this.nameSprite.material.map.needsUpdate = true;
    }

    createSleepIcon() {
        if (!this.game.sleepIconTexture) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            canvas.width = 128;
            canvas.height = 128;

            context.fillStyle = "rgba(0, 0, 0, 0.7)";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.font = "bold 96px Arial";
            context.fillStyle = "#ffffff";
            context.textAlign = "center";
            context.textBaseline = "middle";
            context.fillText("Z", canvas.width / 2, canvas.height);

            this.game.sleepIconTexture = new THREE.CanvasTexture(canvas);
        }

        const material = new THREE.SpriteMaterial({
            map: this.game.sleepIconTexture,
            transparent: true,
            opacity: 0.8,
            depthTest: false,
        });
        this.sleepSprite = new THREE.Sprite(material);
        this.sleepSprite.scale.set(2, 2, 1);
        this.sleepSprite.position.y = 5;
        this.sleepSprite.visible = !this.isActive;
        this.vehicleMesh.add(this.sleepSprite);
    }

    createDebugVisuals() {
        // Current velocity arrow
        this.debugArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            this.position,
            10,
            0xff0000,
            2,
            1,
        );
        this.game.scene.add(this.debugArrow);

        // Target position sphere (green)
        const sphereGeom = new THREE.SphereGeometry(0.5, 16, 16);
        const targetMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
        });
        this.debugTargetSphere = new THREE.Mesh(sphereGeom, targetMat);
        this.game.scene.add(this.debugTargetSphere);

        // Start position sphere (blue)
        const startMat = new THREE.MeshBasicMaterial({
            color: 0x0000ff,
            transparent: true,
            opacity: 0.5,
        });
        this.debugStartSphere = new THREE.Mesh(sphereGeom.clone(), startMat);
        this.game.scene.add(this.debugStartSphere);

        // Debug text
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 360;
        const texture = new THREE.CanvasTexture(canvas);

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
        });
        this.debugText = new THREE.Sprite(material);
        this.debugText.scale.set(10, 7, 1);
        this.debugText.position.y = 10;
        this.vehicleMesh.add(this.debugText);
    }

    updateDebugVisuals() {
        if (!this.debugMode || !this.debugText) return;

        const canvas = this.debugText.material.map.image;
        const context = canvas.getContext("2d");

        context.fillStyle = "rgba(0, 0, 0, 0.8)";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.font = "18px monospace";
        context.fillStyle = "#00ff00";
        context.textAlign = "left";

        const timeSinceLast = (Date.now() - this.lastUpdateTime) / 1000;
        const progressToNext = Math.min(
            timeSinceLast / this.PACKET_INTERVAL,
            1.0,
        );

        const info = [
            `Vel: ${this.velocity.length().toFixed(1)} u/s`,
            `AngVel: ${this.angularVelocity.length().toFixed(2)} rad/s`,
            `Error: ${this.positionError.length().toFixed(2)} u`,
            `AvgErr: ${this.averageError.toFixed(2)} u`,
            `Confidence: ${(this.predictionConfidence * 100).toFixed(0)}%`,
            `Aggression: ${this.PREDICTION_AGGRESSION.toFixed(2)}x`,
            `Progress: ${(progressToNext * 100).toFixed(0)}%`,
            `TimeSince: ${timeSinceLast.toFixed(2)}s`,
            `Alpha: ${progressToNext.toFixed(3)}`,
            `StartDist: ${this.startPosition.distanceTo(this.currentPosition).toFixed(2)
            }`,
            `TargetDist: ${this.targetPosition.distanceTo(this.currentPosition).toFixed(2)
            }`,
        ];

        info.forEach((line, i) => {
            context.fillText(line, 10, 22 + i * 24);
        });

        this.debugText.material.map.needsUpdate = true;

        // Update arrow
        if (this.debugArrow && this.velocity.length() > 0.1) {
            this.debugArrow.position.copy(this.vehicleMesh.position);
            const dir = this.velocity.clone().normalize();
            this.debugArrow.setDirection(dir);
            this.debugArrow.setLength(
                Math.min(this.velocity.length() * 0.5, 20),
            );
        }

        // Update debug spheres
        if (this.debugTargetSphere) {
            this.debugTargetSphere.position.copy(this.targetPosition);
        }
        if (this.debugStartSphere) {
            this.debugStartSphere.position.copy(this.startPosition);
        }
    }

    updateState(playerData) {
        if (!this.initialized) return;

        const currentTime = Date.now();
        const actualTimeSinceUpdate = (currentTime - this.lastUpdateTime) /
            1000;

        // New authoritative state from server
        const newPosition = new THREE.Vector3(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z,
        );
        const newRotation = new THREE.Quaternion(
            playerData.rotation.x,
            playerData.rotation.y,
            playerData.rotation.z,
            playerData.rotation.w,
        );
        const newVelocity = new THREE.Vector3(
            playerData.velocity.x,
            playerData.velocity.y,
            playerData.velocity.z,
        );

        // Calculate prediction error (how wrong were we?)
        this.positionError.subVectors(newPosition, this.currentPosition);
        const errorMagnitude = this.positionError.length();

        // Track error history for adaptive prediction
        this.errorSamples.push(errorMagnitude);
        if (this.errorSamples.length > this.MAX_ERROR_SAMPLES) {
            this.errorSamples.shift();
        }
        this.averageError = this.errorSamples.reduce((a, b) => a + b, 0) /
            this.errorSamples.length;

        // Adjust prediction confidence based on error
        this.predictionConfidence = Math.max(
            0.5,
            1.0 - (this.averageError / 15.0),
        );

        // Calculate acceleration from velocity change
        if (actualTimeSinceUpdate > 0) {
            this.acceleration.subVectors(newVelocity, this.previousVelocity)
                .divideScalar(actualTimeSinceUpdate);
            // Clamp acceleration to reasonable values
            const maxAccel = 50.0;
            if (this.acceleration.length() > maxAccel) {
                this.acceleration.normalize().multiplyScalar(maxAccel);
            }
        }
        this.previousVelocity.copy(newVelocity);

        // Store history
        this.stateHistory.push({
            time: currentTime,
            position: newPosition.clone(),
            rotation: newRotation.clone(),
            velocity: newVelocity.clone(),
            angularVelocity: this.angularVelocity.clone(),
        });

        if (this.stateHistory.length > this.MAX_HISTORY) {
            this.stateHistory.shift();
        }

        // Calculate angular velocity and acceleration
        if (this.stateHistory.length >= 2) {
            const lastState = this.stateHistory[this.stateHistory.length - 2];
            const deltaTime = (currentTime - lastState.time) / 1000;

            if (deltaTime > 0) {
                // Quaternion difference for angular velocity
                const rotDiff = new THREE.Quaternion().multiplyQuaternions(
                    newRotation,
                    lastState.rotation.clone().invert(),
                );

                const angle = 2 * Math.acos(Math.min(Math.abs(rotDiff.w), 1));
                const s = Math.sqrt(Math.max(0, 1 - rotDiff.w * rotDiff.w));

                if (s > 0.001) {
                    const newAngularVel = new THREE.Vector3(
                        rotDiff.x / s * angle / deltaTime,
                        rotDiff.y / s * angle / deltaTime,
                        rotDiff.z / s * angle / deltaTime,
                    );

                    // Calculate angular acceleration
                    this.angularAcceleration.subVectors(
                        newAngularVel,
                        this.angularVelocity,
                    ).divideScalar(deltaTime);

                    this.angularVelocity.copy(newAngularVel);

                    // Clamp angular velocity
                    const angSpeed = this.angularVelocity.length();
                    if (angSpeed > this.MAX_ANGULAR_SPEED) {
                        this.angularVelocity.multiplyScalar(
                            this.MAX_ANGULAR_SPEED / angSpeed,
                        );
                    }
                }
            }
        }

        // If error is too large, snap to correct position
        if (errorMagnitude > this.SNAP_THRESHOLD) {
            console.log(
                `Player ${this.id}: Large error (${errorMagnitude.toFixed(2)
                }), snapping`,
            );
            this.position.copy(newPosition);
            this.rotation.copy(newRotation);
            this.velocity.copy(newVelocity);
            this.currentPosition.copy(newPosition);
            this.currentRotation.copy(newRotation);
            this.startPosition.copy(newPosition);
            this.startRotation.copy(newRotation);
            this.vehicleMesh.position.copy(newPosition);
            this.vehicleMesh.quaternion.copy(newRotation);
        } else {
            // Update authoritative state
            this.position.copy(newPosition);
            this.rotation.copy(newRotation);
            this.velocity.copy(newVelocity);

            // CRITICAL: Set START position as WHERE WE ARE NOW (current visual position)
            // This ensures smooth continuation from predicted position
            this.startPosition.copy(this.currentPosition);
            this.startRotation.copy(this.currentRotation);

            // Blend server position with current position for error correction
            // This gradually corrects prediction errors without sudden jumps
            const correctedStart = new THREE.Vector3().lerpVectors(
                this.currentPosition,
                newPosition,
                this.ERROR_CORRECTION_SPEED,
            );
            this.startPosition.copy(correctedStart);

            const correctedStartRot = new THREE.Quaternion().slerpQuaternions(
                this.currentRotation,
                newRotation,
                this.ERROR_CORRECTION_SPEED,
            );
            this.startRotation.copy(correctedStartRot);
        }

        // Calculate TARGET position (where we predict it will be at next packet)
        this.calculateAggressiveTarget();

        this.lastUpdateTime = currentTime;
        this.isActive = playerData.activity === 1.0;

        if (this.sleepSprite) {
            this.sleepSprite.visible = !this.isActive;
        }
    }

    calculateAggressiveTarget() {
        // Predict where the vehicle WILL BE at next packet
        const predictionTime = this.PACKET_INTERVAL * this.EXTRAPOLATION_SCALE *
            Math.min(this.predictionConfidence, 1);

        // Position extrapolation with acceleration
        this.targetPosition.copy(this.position);

        // v = v0 + at
        const futureVelocity = this.velocity.clone().add(
            this.acceleration.clone().multiplyScalar(predictionTime),
        );

        // Clamp future velocity
        const futureSpeed = futureVelocity.length();
        if (futureSpeed > this.MAX_SPEED) {
            futureVelocity.multiplyScalar(this.MAX_SPEED / futureSpeed);
        }

        // s = s0 + v0*t + 0.5*a*t²
        this.targetPosition.add(
            this.velocity.clone().multiplyScalar(predictionTime),
        ).add(
            this.acceleration.clone().multiplyScalar(
                0.5 * predictionTime * predictionTime,
            ),
        );

        // Apply friction decay
        const frictionDecay = Math.exp(-this.FRICTION_COEFF * predictionTime);
        this.targetPosition.lerp(this.position, 1.0 - frictionDecay);

        // Ground clamp
        this.targetPosition.y = Math.max(
            this.GROUND_LEVEL,
            this.targetPosition.y,
        );

        // Rotation extrapolation with angular acceleration
        this.targetRotation.copy(this.rotation);

        if (this.angularVelocity.length() > 0.001) {
            // Future angular velocity with acceleration
            const futureAngVel = this.angularVelocity.clone().add(
                this.angularAcceleration.clone().multiplyScalar(predictionTime),
            );

            // Clamp
            const futureAngSpeed = futureAngVel.length();
            if (futureAngSpeed > this.MAX_ANGULAR_SPEED) {
                futureAngVel.multiplyScalar(
                    this.MAX_ANGULAR_SPEED / futureAngSpeed,
                );
            }

            // Average angular velocity over prediction period
            const avgAngVel = this.angularVelocity.clone().add(futureAngVel)
                .multiplyScalar(0.5);
            const angularDelta = avgAngVel.multiplyScalar(predictionTime);

            const angle = angularDelta.length();
            if (angle > 0.001) {
                const axis = angularDelta.clone().normalize();
                const angularQuat = new THREE.Quaternion().setFromAxisAngle(
                    axis,
                    angle,
                );
                this.targetRotation.multiply(angularQuat);
                this.targetRotation.normalize();
            }
        }
    }

    predict(currentTime, deltaTime, latency) {
        if (!this.initialized || !this.vehicleMesh) return;
        if (this.stateHistory.length < 1) return;

        const timeSinceUpdate = (currentTime - this.lastUpdateTime) / 1000;

        // Don't predict too far ahead
        if (timeSinceUpdate > this.MAX_PREDICTION_TIME) {
            this.vehicleMesh.position.copy(this.position);
            this.vehicleMesh.quaternion.copy(this.rotation);
            this.currentPosition.copy(this.position);
            this.currentRotation.copy(this.rotation);
            return;
        }

        const latencySeconds = latency / 1000;
        const predictedTime = timeSinceUpdate + latencySeconds;

        // LINEAR INTERPOLATION: Calculate progress from 0 to 1
        // 0 = at start position (where we were visually when packet arrived)
        // 1 = at target position (predicted next packet position)
        const alpha = Math.min(predictedTime / this.PACKET_INTERVAL, 1.0) *
            1.1;

        // Linear interpolation from start to target
        this.currentPosition.lerpVectors(
            this.startPosition,
            this.targetPosition,
            alpha,
        );
        this.currentRotation.slerpQuaternions(
            this.startRotation,
            this.targetRotation,
            alpha,
        );

        // Update mesh
        this.vehicleMesh.position.copy(this.currentPosition);
        this.vehicleMesh.quaternion.copy(this.currentRotation);

        // Update wheels
        this.updateWheels(deltaTime);

        if (this.debugMode) {
            this.updateDebugVisuals();
        }
    }

    updateWheels(deltaTime) {
        const speed = this.velocity.length();

        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.currentRotation);

        const velocityDir = this.velocity.clone().normalize();
        const forwardDot = forward.dot(velocityDir);
        const isReverse = forwardDot < 0;

        const wheelRotationSpeed = speed * deltaTime * (isReverse ? 1 : -1);

        let steerAngle = 0;
        if (speed > 0.1) {
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.currentRotation);

            const lateralComponent = velocityDir.dot(right);

            steerAngle = -Math.atan2(lateralComponent, Math.abs(forwardDot));

            const maxSteerAngle = Math.PI / 3;
            steerAngle = Math.max(-maxSteerAngle, Math.min(maxSteerAngle, steerAngle));
        }

        this.wheels.forEach((wheel) => {
            wheel.userData.rollAngle = (wheel.userData.rollAngle || 0) + wheelRotationSpeed;

            if (wheel.userData.left) {
                wheel.rotation.x = wheel.userData.rollAngle - Math.PI / 2;
            } else {
                wheel.rotation.x = -wheel.userData.rollAngle + Math.PI / 2;
            }

            if (wheel.userData.front) {
                wheel.userData.steerAngle = steerAngle;
                wheel.rotation.z = steerAngle;
            } else {
                wheel.rotation.z = 0;
            }

        });
    }

    remove() {
        if (this.vehicleMesh) {
            this.game.scene.remove(this.vehicleMesh);
        }
        if (this.debugArrow) {
            this.game.scene.remove(this.debugArrow);
        }
        if (this.debugTargetSphere) {
            this.game.scene.remove(this.debugTargetSphere);
        }
        if (this.debugStartSphere) {
            this.game.scene.remove(this.debugStartSphere);
        }
        console.log(`RemotePlayer ${this.id} removed`);
        game.addDebugLog("info", `RemotePlayer ${this.id} removed`);
    }
}

export class Tune {
    constructor(raw = {}) {
        this.wheelRadius = pick(raw.wheel_radius, raw.wheelRadius, 0.55);
        this.wheelWidth = pick(raw.wheel_width, raw.wheelWidth, 0.6);

        this.halfVehicleLength = 4.445;
        this.halfVehicleWidth = 1.695;
        this.halfVehicleHeight = 0.9;
        this.wheelBase = this.halfVehicleLength / 1.83;

        this.wheelOffset = pick(raw.wheel_offset, raw.wheelOffset, -0.2);
        this.wheelOffsetVertical = pick(raw.wheel_vertical_offset, raw.wheelVerticalOffset, -0.64);
        this.wheelLongitudalOffset = pick(raw.wheel_longitudal_offset, raw.wheelLongitudalOffset, 0.4);

        this.maxSteerAngle = this.degreesToRadians(pick(raw.max_steering_angle, raw.maxSteeringAngle, 60));

        this.suspensionMinLength = pick(raw.suspension_lenght_min, raw.suspensionLenghtMin, 0.4);
        this.suspensionMaxLength = pick(raw.suspension_lenght_max, raw.suspensionLenghtMax, 1);
        this.suspensionPreloadLenght = pick(raw.suspension_preload, raw.suspensionPreload, 1);
        this.suspensionStiffness = pick(raw.suspension_stiffness, raw.suspensionStiffness, 1);
        this.suspensionDamping = pick(raw.suspension_damping, raw.suspensionDamping, 1);
        this.suspensionFrequency = 1;

        // Match SQL defaults (15, 1, 2, 15)
        this.frontTyreLateralFriction = pick(raw.front_tyre_lateral_friction, raw.frontTyreLateralFriction, 15);
        this.frontTyreLongitudalFriction = pick(raw.front_tyre_longitudal_friction, raw.frontTyreLongitudalFriction, 1);
        this.rearTyreLateralFriction = pick(raw.rear_tyre_lateral_friction, raw.rearTyreLateralFriction, 2);
        this.rearTyreLongitudalFriction = pick(raw.rear_tyre_longitudal_friction, raw.rearTyreLongitudalFriction, 15);

        this.transmissionModeAuto = true;
        this.fourWheelDrive = pick(raw.four_wheel_drive, raw.fourWheelDrive, false);
        this.torqueSplitRatio = pick(raw.torque_split_ratio, raw.torqueSplitRatio, 1.4);
        this.differentialLimitedSlipRatio = pick(raw.differential_limited_slip_ratio, raw.differentialLimitedSlipRatio, 1.3);
        this.antiRollbar = pick(raw.antirollbar, raw.antiRollbar, true);

        this.maxEngineTorque = pick(raw.max_engine_torque, raw.maxEngineTorque, 2500.0);
        this.clutchStrength = pick(raw.clutch_strenght, raw.clutchStrength, 1000.0);
        this.minRPM = pick(raw.min_rpm, raw.minRpm, 400);
        this.maxRPM = pick(raw.max_rpm, raw.maxRpm, 8000);
        this.damperMass = pick(raw.damper_mass, raw.damperMass, 1.0);
        this.flywheelMass = pick(raw.flywheel_mass, raw.flywheelMass, 1.0);

        this.vehicleMass = pick(raw.vehicle_mass, raw.vehicleMass, 1200.0);
    }

    degreesToRadians(degrees) {
        return (degrees * Math.PI) / 180;
    }
}

function pick(...vals) {
    for (const v of vals) {
        if (v !== undefined && v !== null) return v;
    }
    return undefined;
}
