// camera.js
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';

export class FaceCamera {
    constructor(videoElement, onResults) {
        this.faceDetection = new FaceDetection({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}` });
        this.faceDetection.setOptions({
            model: 'short',
            minDetectionConfidence: 0.5
        });
        this.faceDetection.onResults(onResults);

        this.videoElement = videoElement;
        this.cameraUtils = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.faceDetection.send({ image: this.videoElement });
            },
            width: 640,
            height: 480
        });

        // Create a canvas for drawing the bounding box
        this.canvas = document.createElement('canvas');
        this.canvas.width = 640;
        this.canvas.height = 480;
        this.canvas.style.position = 'fixed';
        this.canvas.style.bottom = '10px';
        this.canvas.style.right = '10px';
        this.canvas.style.width = '320px';
        this.canvas.style.height = '240px';
        this.canvas.style.zIndex = '1001';
        this.canvas.style.border = '2px solid #fff';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
    }

    start() {
        this.cameraUtils.start();
    }

    showVideo() {
        this.videoElement.style.display = 'block';
        this.videoElement.style.position = 'fixed';
        this.videoElement.style.bottom = '10px';
        this.videoElement.style.right = '10px';
        this.videoElement.style.width = '320px';
        this.videoElement.style.height = '240px';
        this.videoElement.style.zIndex = '1000';
        this.videoElement.style.border = '2px solid #fff';
        this.videoElement.style.transform = 'scaleX(-1)';
    }

    drawBoundingBox(boundingBox) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.strokeStyle = 'red';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(
            boundingBox.xMin * this.canvas.width,
            boundingBox.yMin * this.canvas.height,
            (boundingBox.xMax - boundingBox.xMin) * this.canvas.width,
            (boundingBox.yMax - boundingBox.yMin) * this.canvas.height
        );
    }
}