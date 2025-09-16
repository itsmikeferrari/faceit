/**
 * Main Application Module
 * Coordinates all components for facial recognition application
 */

class FacialRecognitionApp {
    constructor() {
        this.cameraManager = new CameraManager();
        this.faceDetector = new FaceDetector();
        this.faceRecognizer = new FaceRecognizer();
        
        this.videoElement = null;
        this.canvasElement = null;
        this.isProcessing = false;
        this.animationId = null;
        this.confidenceThreshold = 0.6;
        this.showLandmarks = true;
        
        this.currentDetections = [];
        this.currentRecognitions = [];
        
        this.init();
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            await this.initializeElements();
            await this.initializeEventListeners();
            await this.loadModels();
            this.updateUI();
            
            console.log('Facial Recognition App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError(`Initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize DOM elements
     */
    async initializeElements() {
        this.videoElement = document.getElementById('videoElement');
        this.canvasElement = document.getElementById('overlay');
        
        if (!this.videoElement || !this.canvasElement) {
            throw new Error('Required DOM elements not found');
        }

        // Set up video element
        this.videoElement.addEventListener('loadedmetadata', () => {
            this.resizeCanvas();
        });
    }

    /**
     * Initialize event listeners
     */
    async initializeEventListeners() {
        // Camera controls
        document.getElementById('startBtn').addEventListener('click', () => this.startCamera());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopCamera());
        document.getElementById('switchBtn').addEventListener('click', () => this.switchCamera());
        
        // Face enrollment
        document.getElementById('enrollBtn').addEventListener('click', () => this.enrollFace());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearEnrolledFaces());
        
        // Settings
        document.getElementById('showLandmarks').addEventListener('change', (e) => {
            this.showLandmarks = e.target.checked;
        });
        
        document.getElementById('confidenceThreshold').addEventListener('input', (e) => {
            this.confidenceThreshold = parseFloat(e.target.value);
            document.getElementById('confidenceValue').textContent = e.target.value;
        });

        // Handle browser visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseProcessing();
            } else if (this.cameraManager.isActiveCamera()) {
                this.resumeProcessing();
            }
        });
    }

    /**
     * Load face detection models
     */
    async loadModels() {
        this.setStatus('Loading AI models...', true);
        
        try {
            await this.faceDetector.init();
            this.setStatus('Models loaded successfully');
            
        } catch (error) {
            this.setStatus('Failed to load AI models');
            throw error;
        }
    }

    /**
     * Start camera and begin processing
     */
    async startCamera() {
        try {
            this.setStatus('Starting camera...', true);
            
            const stream = await this.cameraManager.startCamera();
            this.videoElement.srcObject = stream;
            
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
            
            this.resizeCanvas();
            this.startProcessing();
            this.updateUI();
            
            this.setStatus('Camera active - Detecting faces');
            
        } catch (error) {
            console.error('Error starting camera:', error);
            this.setStatus('Camera error');
            this.showError(error.message);
        }
    }

    /**
     * Stop camera and processing
     */
    async stopCamera() {
        try {
            this.stopProcessing();
            await this.cameraManager.stopCamera();
            
            this.videoElement.srcObject = null;
            this.clearCanvas();
            this.updateUI();
            
            this.setStatus('Camera stopped');
            
        } catch (error) {
            console.error('Error stopping camera:', error);
            this.showError('Failed to stop camera');
        }
    }

    /**
     * Switch to next available camera
     */
    async switchCamera() {
        try {
            this.setStatus('Switching camera...', true);
            
            const stream = await this.cameraManager.switchCamera();
            this.videoElement.srcObject = stream;
            
            this.setStatus('Camera switched');
            
        } catch (error) {
            console.error('Error switching camera:', error);
            this.showError(error.message);
        }
    }

    /**
     * Start face detection processing loop
     */
    startProcessing() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processFrame();
    }

    /**
     * Stop face detection processing
     */
    stopProcessing() {
        this.isProcessing = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Pause processing (for visibility changes)
     */
    pauseProcessing() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Resume processing
     */
    resumeProcessing() {
        if (this.isProcessing && !this.animationId) {
            this.processFrame();
        }
    }

    /**
     * Process video frame for face detection
     */
    async processFrame() {
        if (!this.isProcessing || !this.videoElement || this.videoElement.paused) {
            return;
        }

        try {
            // Detect faces in current frame
            const detections = await this.faceDetector.detectFaces(this.videoElement, {
                withLandmarks: this.showLandmarks,
                withDescriptors: true
            });

            this.currentDetections = detections;

            // Perform face recognition if faces are enrolled
            if (detections.length > 0 && this.faceRecognizer.getEnrollmentCount() > 0) {
                this.currentRecognitions = this.faceRecognizer.recognizeFaces(
                    detections,
                    this.confidenceThreshold
                );
            } else {
                this.currentRecognitions = [];
            }

            // Draw results on canvas
            this.drawResults();
            
            // Update UI with detection info
            this.updateDetectionInfo();
            this.updateRecognizedFacesList();
            
        } catch (error) {
            console.error('Error processing frame:', error);
        }

        // Schedule next frame
        if (this.isProcessing) {
            this.animationId = requestAnimationFrame(() => this.processFrame());
        }
    }

    /**
     * Draw detection and recognition results on canvas
     */
    drawResults() {
        if (!this.currentDetections || this.currentDetections.length === 0) {
            this.clearCanvas();
            return;
        }

        this.faceDetector.drawDetections(this.canvasElement, this.currentDetections, {
            showLandmarks: this.showLandmarks,
            recognitionResults: this.currentRecognitions
        });
    }

    /**
     * Enroll a detected face
     */
    async enrollFace() {
        if (!this.currentDetections || this.currentDetections.length === 0) {
            this.showError('No faces detected. Please ensure your face is visible.');
            return;
        }

        if (this.currentDetections.length > 1) {
            this.showError('Multiple faces detected. Please ensure only one face is visible.');
            return;
        }

        try {
            const detection = this.currentDetections[0];
            if (!detection.descriptor) {
                this.showError('Face descriptor not available. Please try again.');
                return;
            }

            await this.faceRecognizer.enrollFaceWithPrompt(detection.descriptor);
            this.updateUI();
            this.setStatus('Face enrolled successfully');
            
        } catch (error) {
            console.error('Error enrolling face:', error);
            this.showError(error.message);
        }
    }

    /**
     * Clear all enrolled faces
     */
    clearEnrolledFaces() {
        if (this.faceRecognizer.getEnrollmentCount() === 0) {
            this.showError('No enrolled faces to clear.');
            return;
        }

        if (confirm('Are you sure you want to clear all enrolled faces? This cannot be undone.')) {
            this.faceRecognizer.clearAllFaces();
            this.updateUI();
            this.setStatus('All enrolled faces cleared');
        }
    }

    /**
     * Resize canvas to match video dimensions
     */
    resizeCanvas() {
        if (!this.videoElement || !this.canvasElement) return;

        const displaySize = this.faceDetector.getDisplaySize(this.videoElement);
        
        // Match canvas size to video display size
        this.canvasElement.width = this.videoElement.offsetWidth;
        this.canvasElement.height = this.videoElement.offsetHeight;
        
        // Scale canvas context to match video resolution
        const ctx = this.canvasElement.getContext('2d');
        const scaleX = this.canvasElement.width / displaySize.width;
        const scaleY = this.canvasElement.height / displaySize.height;
        
        ctx.scale(scaleX, scaleY);
    }

    /**
     * Clear canvas overlay
     */
    clearCanvas() {
        if (!this.canvasElement) return;
        
        const ctx = this.canvasElement.getContext('2d');
        ctx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    /**
     * Update UI elements based on current state
     */
    updateUI() {
        const isActive = this.cameraManager.isActiveCamera();
        const hasEnrolledFaces = this.faceRecognizer.getEnrollmentCount() > 0;
        const hasDetections = this.currentDetections.length > 0;

        // Update button states
        document.getElementById('startBtn').disabled = isActive;
        document.getElementById('stopBtn').disabled = !isActive;
        document.getElementById('switchBtn').disabled = !isActive;
        document.getElementById('enrollBtn').disabled = !isActive || !hasDetections;

        // Update stats
        document.getElementById('enrolledCount').textContent = this.faceRecognizer.getEnrollmentCount();
        document.getElementById('recognitionMode').textContent = hasEnrolledFaces ? 'Recognition active' : 'Detection only';
    }

    /**
     * Update detection information display
     */
    updateDetectionInfo() {
        document.getElementById('faceCount').textContent = this.currentDetections.length;
    }

    /**
     * Update recognized faces list
     */
    updateRecognizedFacesList() {
        const listElement = document.getElementById('recognizedList');
        
        if (!this.currentRecognitions || this.currentRecognitions.length === 0) {
            listElement.innerHTML = '<p style="color: #6b7280; font-style: italic;">No recognized faces</p>';
            return;
        }

        const recognizedFaces = this.currentRecognitions
            .filter(result => result.isMatch)
            .map(result => {
                const confidence = Math.round((1 - result.distance) * 100);
                return `
                    <div class="recognized-face">
                        <span class="face-name">${result.label}</span>
                        <span class="face-confidence">${confidence}%</span>
                    </div>
                `;
            });

        if (recognizedFaces.length > 0) {
            listElement.innerHTML = recognizedFaces.join('');
        } else {
            listElement.innerHTML = '<p style="color: #6b7280; font-style: italic;">No matches found</p>';
        }
    }

    /**
     * Set status message
     */
    setStatus(message, isLoading = false) {
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.innerHTML = isLoading ? 
                `<span class="loading"></span> ${message}` : 
                message;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        alert(`Error: ${message}`);
        console.error('App Error:', message);
    }

    /**
     * Handle browser compatibility check
     */
    checkBrowserSupport() {
        const issues = [];

        if (!this.cameraManager.isSupported()) {
            issues.push('Camera access (getUserMedia)');
        }

        if (!window.requestAnimationFrame) {
            issues.push('Animation frame support');
        }

        if (!window.localStorage) {
            issues.push('Local storage');
        }

        if (issues.length > 0) {
            const message = `Your browser does not support: ${issues.join(', ')}. Please use a modern browser.`;
            this.showError(message);
            return false;
        }

        return true;
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        document.getElementById('status').textContent = 'Browser not supported';
        alert('Your browser does not support camera access. Please use Chrome, Firefox, Safari, or Edge.');
        return;
    }

    // Create and start the application
    try {
        window.app = new FacialRecognitionApp();
        console.log('Facial Recognition App loaded successfully');
    } catch (error) {
        console.error('Failed to load application:', error);
        document.getElementById('status').textContent = 'Failed to load application';
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.app && window.app.cameraManager) {
        window.app.cameraManager.stopCamera();
    }
});