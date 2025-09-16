/**
 * Upload Manager Module
 * Handles image upload and face enrollment from static images
 */

class UploadManager {
    constructor() {
        this.faceDetector = new FaceDetector();
        this.faceRecognizer = new FaceRecognizer();
        
        this.currentImage = null;
        this.currentDetections = [];
        this.selectedFaceIndex = 0;
        
        this.init();
    }

    /**
     * Initialize the upload manager
     */
    async init() {
        try {
            await this.initializeElements();
            await this.initializeEventListeners();
            await this.loadModels();
            this.updateEnrolledFacesList();
            
            console.log('Upload Manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize upload manager:', error);
            this.showError(`Initialization failed: ${error.message}`);
        }
    }

    /**
     * Initialize DOM elements
     */
    async initializeElements() {
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.previewContainer = document.getElementById('previewContainer');
        this.previewImage = document.getElementById('previewImage');
        this.previewCanvas = document.getElementById('previewCanvas');
        this.detectionResults = document.getElementById('detectionResults');
        this.detectionMessage = document.getElementById('detectionMessage');
        this.enrollmentForm = document.getElementById('enrollmentForm');
        this.faceNameInput = document.getElementById('faceName');
        this.enrolledFacesList = document.getElementById('enrolledFacesList');
        
        if (!this.uploadArea || !this.fileInput || !this.previewImage) {
            throw new Error('Required DOM elements not found');
        }
    }

    /**
     * Initialize event listeners
     */
    async initializeEventListeners() {
        // File upload area click
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handleFileSelect(e.target.files[0]);
            }
        });

        // Drag and drop events
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                this.handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        // Enrollment form buttons
        document.getElementById('enrollFaceBtn').addEventListener('click', () => {
            this.enrollSelectedFace();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.resetUpload();
        });

        // Face name input enter key
        this.faceNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.enrollSelectedFace();
            }
        });
    }

    /**
     * Load face detection models
     */
    async loadModels() {
        try {
            await this.faceDetector.init();
            console.log('Face detection models loaded for upload manager');
            
        } catch (error) {
            throw new Error('Failed to load face detection models');
        }
    }

    /**
     * Handle file selection
     */
    async handleFileSelect(file) {
        try {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                throw new Error('Please select a valid image file');
            }

            // Validate file size (max 10MB)
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('Image file is too large. Please select a file smaller than 10MB');
            }

            this.showDetectionResults('Processing image...', false);
            
            // Load image
            const imageUrl = URL.createObjectURL(file);
            await this.loadImage(imageUrl);
            
            // Detect faces
            await this.detectFacesInImage();
            
            // Clean up object URL
            URL.revokeObjectURL(imageUrl);
            
        } catch (error) {
            console.error('Error handling file:', error);
            this.showError(error.message);
        }
    }

    /**
     * Load image into preview
     */
    async loadImage(imageUrl) {
        return new Promise((resolve, reject) => {
            this.previewImage.onload = () => {
                this.currentImage = this.previewImage;
                this.previewContainer.style.display = 'block';
                this.resizeCanvas();
                resolve();
            };
            
            this.previewImage.onerror = () => {
                reject(new Error('Failed to load image'));
            };
            
            this.previewImage.src = imageUrl;
        });
    }

    /**
     * Detect faces in the loaded image
     */
    async detectFacesInImage() {
        try {
            this.showDetectionResults('Detecting faces...', false);
            
            // Detect faces with descriptors for enrollment
            const detections = await this.faceDetector.detectFaces(this.previewImage, {
                withLandmarks: true,
                withDescriptors: true
            });

            this.currentDetections = detections;

            if (detections.length === 0) {
                this.showDetectionResults('No faces detected in this image. Please try another image with clear faces.', true);
                this.enrollmentForm.style.display = 'none';
                return;
            }

            if (detections.length > 1) {
                this.showDetectionResults(`${detections.length} faces detected. The first face will be used for enrollment.`, false);
            } else {
                this.showDetectionResults('1 face detected successfully!', false);
            }

            // Draw detection results
            this.drawDetections();
            
            // Show enrollment form
            this.enrollmentForm.style.display = 'block';
            this.faceNameInput.focus();
            
        } catch (error) {
            console.error('Error detecting faces:', error);
            this.showDetectionResults('Error detecting faces. Please try again.', true);
        }
    }

    /**
     * Draw face detections on canvas
     */
    drawDetections() {
        if (!this.currentDetections || this.currentDetections.length === 0) {
            return;
        }

        // Clear canvas
        const ctx = this.previewCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);

        // Draw detections
        this.faceDetector.drawDetections(this.previewCanvas, this.currentDetections, {
            showLandmarks: true
        });
    }

    /**
     * Enroll the selected face
     */
    async enrollSelectedFace() {
        try {
            const faceName = this.faceNameInput.value.trim();
            
            if (!faceName) {
                this.showError('Please enter a name for this face');
                this.faceNameInput.focus();
                return;
            }

            if (this.currentDetections.length === 0) {
                this.showError('No face detected to enroll');
                return;
            }

            const detection = this.currentDetections[this.selectedFaceIndex];
            
            if (!detection.descriptor) {
                this.showError('Face descriptor not available. Please try again.');
                return;
            }

            // Check if name already exists
            if (this.faceRecognizer.getEnrolledFaces().includes(faceName)) {
                const overwrite = confirm(`A face with name "${faceName}" already exists. Overwrite?`);
                if (!overwrite) {
                    return;
                }
            }

            // Enroll the face
            this.faceRecognizer.enrollFace(detection.descriptor, faceName);
            
            this.showDetectionResults(`Face enrolled successfully as "${faceName}"!`, false);
            this.updateEnrolledFacesList();
            
            // Reset form
            setTimeout(() => {
                this.resetUpload();
            }, 2000);
            
        } catch (error) {
            console.error('Error enrolling face:', error);
            this.showError(error.message);
        }
    }

    /**
     * Reset the upload interface
     */
    resetUpload() {
        this.previewContainer.style.display = 'none';
        this.enrollmentForm.style.display = 'none';
        this.detectionResults.style.display = 'none';
        this.faceNameInput.value = '';
        this.fileInput.value = '';
        this.currentImage = null;
        this.currentDetections = [];
        
        // Clear canvas
        if (this.previewCanvas) {
            const ctx = this.previewCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        }
    }

    /**
     * Resize canvas to match image dimensions
     */
    resizeCanvas() {
        if (!this.previewImage || !this.previewCanvas) return;

        // Set canvas size to match image display size
        this.previewCanvas.width = this.previewImage.offsetWidth;
        this.previewCanvas.height = this.previewImage.offsetHeight;
        
        // Scale canvas context to match image resolution
        const ctx = this.previewCanvas.getContext('2d');
        const scaleX = this.previewCanvas.width / this.previewImage.naturalWidth;
        const scaleY = this.previewCanvas.height / this.previewImage.naturalHeight;
        
        ctx.scale(scaleX, scaleY);
    }

    /**
     * Update enrolled faces list display
     */
    updateEnrolledFacesList() {
        const enrolledFaces = this.faceRecognizer.getEnrolledFaces();
        
        if (enrolledFaces.length === 0) {
            this.enrolledFacesList.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #6b7280; font-style: italic; padding: 40px;">
                    No faces enrolled yet. Upload an image to get started.
                </div>
            `;
            return;
        }

        const faceCards = enrolledFaces.map(faceName => {
            const stats = this.faceRecognizer.getStats();
            return `
                <div class="enrolled-face-card">
                    <h4>${faceName}</h4>
                    <p>Enrolled face</p>
                    <button class="remove-face-btn" onclick="uploadManager.removeFace('${faceName}')">
                        Remove
                    </button>
                </div>
            `;
        });

        this.enrolledFacesList.innerHTML = faceCards.join('');
    }

    /**
     * Remove an enrolled face
     */
    removeFace(faceName) {
        if (confirm(`Are you sure you want to remove "${faceName}"?`)) {
            this.faceRecognizer.removeFace(faceName);
            this.updateEnrolledFacesList();
        }
    }

    /**
     * Show detection results
     */
    showDetectionResults(message, isError = false) {
        this.detectionResults.style.display = 'block';
        this.detectionResults.className = isError ? 'detection-results error' : 'detection-results';
        this.detectionMessage.textContent = message;
    }

    /**
     * Show error message
     */
    showError(message) {
        alert(`Error: ${message}`);
        console.error('Upload Manager Error:', message);
    }
}

// Initialize the upload manager when the page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.uploadManager = new UploadManager();
        console.log('Upload Manager loaded successfully');
    } catch (error) {
        console.error('Failed to load upload manager:', error);
        alert('Failed to initialize the application. Please refresh the page.');
    }
});

// Handle window resize for canvas scaling
window.addEventListener('resize', () => {
    if (window.uploadManager && window.uploadManager.currentImage) {
        setTimeout(() => {
            window.uploadManager.resizeCanvas();
            window.uploadManager.drawDetections();
        }, 100);
    }
});