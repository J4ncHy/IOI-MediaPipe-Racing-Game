import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FaceCamera } from './camera.js';

class CarSimulation {
    constructor(container) {
        // Setup Three.js
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.renderer.domElement);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(10, 10, 10).normalize();
        this.scene.add(directionalLight);

        // Setup Cannon.js
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);

        // Create larger ground plane
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.world.addBody(groundBody);

        // Load texture
        const textureLoader = new THREE.TextureLoader();
        const groundTexture = textureLoader.load('assets/checkered-texture.png');
        groundTexture.wrapS = groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(50, 50);

        // Three.js larger ground
        const groundGeometry = new THREE.PlaneGeometry(500, 500);
        const groundMaterial = new THREE.MeshStandardMaterial({ map: groundTexture });
        const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
        groundMesh.rotation.x = -Math.PI / 2;
        this.scene.add(groundMesh);

        // Add skybox
        const skyboxLoader = new THREE.CubeTextureLoader();
        const skyboxTexture = skyboxLoader.load([
            'assets/skybox/px.jpg', 'assets/skybox/nx.jpg',
            'assets/skybox/py.jpg', 'assets/skybox/ny.jpg',
            'assets/skybox/pz.jpg', 'assets/skybox/nz.jpg'
        ]);
        this.scene.background = skyboxTexture;

        // Create car
        this._createCar();

        // Setup controls
        this.controls = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            brake: false,
        };

        this._addEventListeners();

        // Create HUD
        this.speedometer = document.createElement('div');
        this.speedometer.style.position = 'absolute';
        this.speedometer.style.top = '10px';
        this.speedometer.style.left = '10px';
        this.speedometer.style.color = 'white';
        this.speedometer.style.fontSize = '20px';
        container.appendChild(this.speedometer);

        // Camera offset
        this.cameraOffset = new THREE.Vector3(0, 5, -10);

        // Setup MediaPipe Face Detection
        this.videoElement = document.createElement('video');
        this.videoElement.style.display = 'none';
        document.body.appendChild(this.videoElement);

        this.faceCamera = new FaceCamera(this.videoElement, this._onFaceDetectionResults.bind(this));
        this.faceCamera.start();
        this.faceCamera.showVideo();

        // Attach handleResize to window resize event
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    _createCar() {
        // Chassis
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
        const chassisBody = new CANNON.Body({ mass: 150 });
        chassisBody.addShape(chassisShape);
        chassisBody.position.set(0, 1, 0);

        // Vehicle
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: chassisBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2,
        });

        // Wheels
        const wheelOptions = {
            radius: 0.5,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
        };

        wheelOptions.chassisConnectionPointLocal.set(1, 0, -1.5);
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.chassisConnectionPointLocal.set(-1, 0, -1.5);
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.chassisConnectionPointLocal.set(1, 0, 1.5);
        this.vehicle.addWheel(wheelOptions);

        wheelOptions.chassisConnectionPointLocal.set(-1, 0, 1.5);
        this.vehicle.addWheel(wheelOptions);

        this.vehicle.addToWorld(this.world);

        // Three.js chassis
        const chassisGeometry = new THREE.BoxGeometry(2, 1, 4);
        const chassisMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.chassisMesh = new THREE.Mesh(chassisGeometry, chassisMaterial);
        this.scene.add(this.chassisMesh);

        // Three.js wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 32);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        this.wheelMeshes = [];
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            const wheelMesh = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheelMesh.rotation.z = Math.PI / 2;
            this.scene.add(wheelMesh);
            this.wheelMeshes.push(wheelMesh);
        }
    }

    _addEventListeners() {
        window.addEventListener('keydown', (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.controls.forward = true;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.controls.backward = true;
                    break;
                case 'Space':
                    this.controls.brake = true;
                    break;
            }
        });

        window.addEventListener('keyup', (event) => {
            switch (event.code) {
                case 'ArrowUp':
                case 'KeyW':
                    this.controls.forward = false;
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    this.controls.backward = false;
                    break;
                case 'Space':
                    this.controls.brake = false;
                    break;
            }
        });
    }

    _onFaceDetectionResults(results) {
        if (results.detections.length > 0) {
            const face = results.detections[0];
            const boundingBox = face.boundingBox;
            const centerX = boundingBox.xCenter / this.videoElement.videoWidth;

            this.facePosition = 5 * boundingBox.xCenter - 2.5;



            // Log the coordinates of the face detection
            console.log(`Face detected at: xCenter=${boundingBox.xCenter}, yCenter=${boundingBox.yCenter}`);

            // Draw the bounding box
            this.faceCamera.drawBoundingBox(boundingBox);
        } else {
            this.faceCamera.ctx.clearRect(0, 0, this.faceCamera.canvas.width, this.faceCamera.canvas.height);
        }
    }

    update() {
        const engineForce = 250;
        const maxSteering = 0.2;
        const brakeForce = 10;
        const maxSpeed = 15;

        if (this.controls.forward) {
            this.vehicle.applyEngineForce(engineForce, 2);
            this.vehicle.applyEngineForce(engineForce, 3);
        } else if (this.controls.backward) {
            this.vehicle.applyEngineForce(-engineForce, 2);
            this.vehicle.applyEngineForce(-engineForce, 3);
        } else {
            this.vehicle.applyEngineForce(0, 2);
            this.vehicle.applyEngineForce(0, 3);
        }

        if (this.controls.brake) {
            this.vehicle.setBrake(brakeForce, 0);
            this.vehicle.setBrake(brakeForce, 1);
            this.vehicle.setBrake(brakeForce, 2);
            this.vehicle.setBrake(brakeForce, 3);
        } else {
            this.vehicle.setBrake(0, 0);
            this.vehicle.setBrake(0, 1);
            this.vehicle.setBrake(0, 2);
            this.vehicle.setBrake(0, 3);
        }

        // Use face position to steer the car
        console.log(this.facePosition);
        if (this.facePosition !== undefined) {
            this.vehicle.setSteeringValue(this.facePosition * maxSteering, 0);
            this.vehicle.setSteeringValue(this.facePosition * maxSteering, 1);
        }

        this.world.step(1 / 60);

        // Update chassis position
        if (this.chassisMesh) {
            this.chassisMesh.position.copy(this.vehicle.chassisBody.position);
            this.chassisMesh.quaternion.copy(this.vehicle.chassisBody.quaternion);
        }

        // Update wheel positions
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const transform = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(transform.position);
            this.wheelMeshes[i].quaternion.copy(transform.quaternion);
        }

        // Calculate speed
        const speed = this.vehicle.chassisBody.velocity.length();
        if (speed > maxSpeed) {
            this.vehicle.chassisBody.velocity.scale(maxSpeed / speed, this.vehicle.chassisBody.velocity);
        }
        if (speed < 0.25 && !this.controls.forward && !this.controls.backward) {
            this.vehicle.chassisBody.velocity.set(0, 0, 0);
        }
        this.speedometer.innerText = `Speed: ${speed.toFixed(2)} m/s`;

        // Update camera position and rotation
        this.updateCamera();

        this.renderer.render(this.scene, this.camera);
    }

    updateCamera() {
        const cameraTarget = new THREE.Vector3();
        if (this.chassisMesh) {
            this.chassisMesh.getWorldPosition(cameraTarget);
        }

        // Calculate the direction the car is facing
        const carDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.chassisMesh.quaternion);

        // Calculate the new camera position
        const cameraPosition = cameraTarget.clone().add(carDirection.clone().multiplyScalar(-10)).add(new THREE.Vector3(0, 5, 0));

        // Update the camera position and look at the car
        this.camera.position.lerp(cameraPosition, 0.1);
        this.camera.lookAt(cameraTarget);
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.update();
    }
}

// Usage example
const container = document.body;
const simulation = new CarSimulation(container);
simulation.animate();