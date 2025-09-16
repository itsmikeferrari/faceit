/**
 * Face Detection Module
 * Handles face detection using face-api.js
 */

class FaceDetector {
    constructor() {
        this.isInitialized = false;
        this.modelsLoaded = false;
    }

    /**
     * Initialize face-api.js models
     */
    async init() {
        if (this.isInitialized) return;
        
        try {
            console.log('Loading face detection models...');
            
            // Load required models from CDN
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model';
            
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
            ]);
            
            this.modelsLoaded = true;
            this.isInitialized = true;
            console.log('Face detection models loaded successfully');
            
        } catch (error) {
            console.error('Error loading face detection models:', error);
            throw new Error('Failed to initialize face detection models');
        }
    }

    /**
     * Detect faces in video element
     */
    async detectFaces(video, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Face detector not initialized');
        }

        const {
            withLandmarks = true,
            withDescriptors = true,
            withExpressions = false
        } = options;

        try {
            let detection = faceapi
                .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
                    inputSize: 416,
                    scoreThreshold: 0.3
                }));

            if (withLandmarks) {
                detection = detection.withFaceLandmarks();
            }

            if (withDescriptors) {
                detection = detection.withFaceDescriptors();
            }

            if (withExpressions) {
                detection = detection.withFaceExpressions();
            }

            return await detection;
            
        } catch (error) {
            console.error('Error detecting faces:', error);
            return [];
        }
    }

    /**
     * Draw detection results on canvas
     */
    drawDetections(canvas, detections, options = {}) {
        const {
            showLandmarks = true,
            showExpressions = false,
            recognitionResults = null
        } = options;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!detections || detections.length === 0) return;

        detections.forEach((detection, index) => {
            const box = detection.detection.box;
            
            // Draw bounding box
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            
            // Draw confidence score
            const confidence = Math.round(detection.detection.score * 100);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(box.x, box.y - 30, 120, 25);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px Arial';
            ctx.fillText(`${confidence}% confident`, box.x + 5, box.y - 10);
            
            // Draw recognition result if available
            if (recognitionResults && recognitionResults[index]) {
                const result = recognitionResults[index];
                const labelY = box.y + box.height + 20;
                
                ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
                ctx.fillRect(box.x, labelY, 150, 25);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.fillText(result.label, box.x + 5, labelY + 17);
            }
            
            // Draw landmarks if enabled
            if (showLandmarks && detection.landmarks) {
                const landmarks = detection.landmarks;
                
                ctx.fillStyle = '#10b981';
                landmarks.positions.forEach(point => {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }
        });
    }

    /**
     * Get display dimensions for canvas overlay
     */
    getDisplaySize(video) {
        return {
            width: video.videoWidth,
            height: video.videoHeight
        };
    }
}

// Export for use in other modules
window.FaceDetector = FaceDetector;