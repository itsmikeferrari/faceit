/**
 * Face Recognition Module
 * Handles face enrollment and recognition
 */

class FaceRecognizer {
    constructor() {
        this.enrolledFaces = new Map();
        this.faceMatcher = null;
        this.loadEnrolledFaces();
    }

    /**
     * Enroll a face with a given label
     */
    enrollFace(faceDescriptor, label) {
        if (!faceDescriptor || !label) {
            throw new Error('Face descriptor and label are required');
        }

        // Store the face descriptor with timestamp
        const faceData = {
            descriptor: Array.from(faceDescriptor),
            label: label,
            enrolledAt: new Date().toISOString()
        };

        this.enrolledFaces.set(label, faceData);
        this.updateFaceMatcher();
        this.saveEnrolledFaces();
        
        console.log(`Face enrolled for: ${label}`);
        return true;
    }

    /**
     * Remove an enrolled face
     */
    removeFace(label) {
        if (this.enrolledFaces.has(label)) {
            this.enrolledFaces.delete(label);
            this.updateFaceMatcher();
            this.saveEnrolledFaces();
            console.log(`Face removed for: ${label}`);
            return true;
        }
        return false;
    }

    /**
     * Clear all enrolled faces
     */
    clearAllFaces() {
        this.enrolledFaces.clear();
        this.faceMatcher = null;
        this.saveEnrolledFaces();
        console.log('All enrolled faces cleared');
    }

    /**
     * Recognize faces in detections
     */
    recognizeFaces(detections, confidenceThreshold = 0.6) {
        if (!this.faceMatcher || detections.length === 0) {
            return [];
        }

        const results = [];

        detections.forEach(detection => {
            if (detection.descriptor) {
                const bestMatch = this.faceMatcher.findBestMatch(
                    detection.descriptor,
                    confidenceThreshold
                );
                
                results.push({
                    label: bestMatch.label,
                    distance: bestMatch.distance,
                    isMatch: bestMatch.label !== 'unknown'
                });
            } else {
                results.push({
                    label: 'unknown',
                    distance: 1.0,
                    isMatch: false
                });
            }
        });

        return results;
    }

    /**
     * Update the face matcher with current enrolled faces
     */
    updateFaceMatcher() {
        if (this.enrolledFaces.size === 0) {
            this.faceMatcher = null;
            return;
        }

        try {
            const labeledDescriptors = Array.from(this.enrolledFaces.entries()).map(
                ([label, faceData]) => {
                    const descriptor = new Float32Array(faceData.descriptor);
                    return new faceapi.LabeledFaceDescriptors(label, [descriptor]);
                }
            );

            this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
            console.log(`Face matcher updated with ${labeledDescriptors.length} enrolled faces`);
            
        } catch (error) {
            console.error('Error updating face matcher:', error);
            this.faceMatcher = null;
        }
    }

    /**
     * Get list of enrolled faces
     */
    getEnrolledFaces() {
        return Array.from(this.enrolledFaces.keys());
    }

    /**
     * Get enrollment count
     */
    getEnrollmentCount() {
        return this.enrolledFaces.size;
    }

    /**
     * Save enrolled faces to localStorage
     */
    saveEnrolledFaces() {
        try {
            const facesData = Object.fromEntries(this.enrolledFaces);
            localStorage.setItem('enrolledFaces', JSON.stringify(facesData));
        } catch (error) {
            console.error('Error saving enrolled faces:', error);
        }
    }

    /**
     * Load enrolled faces from localStorage
     */
    loadEnrolledFaces() {
        try {
            const saved = localStorage.getItem('enrolledFaces');
            if (saved) {
                const facesData = JSON.parse(saved);
                this.enrolledFaces = new Map(Object.entries(facesData));
                this.updateFaceMatcher();
                console.log(`Loaded ${this.enrolledFaces.size} enrolled faces`);
            }
        } catch (error) {
            console.error('Error loading enrolled faces:', error);
            this.enrolledFaces = new Map();
        }
    }

    /**
     * Generate a unique label for enrollment
     */
    generateLabel() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `Person_${timestamp}_${random}`;
    }

    /**
     * Enroll face with user input label
     */
    async enrollFaceWithPrompt(faceDescriptor) {
        const label = prompt('Enter a name for this face:', this.generateLabel());
        
        if (!label || label.trim() === '') {
            throw new Error('Name is required for face enrollment');
        }

        if (this.enrolledFaces.has(label.trim())) {
            const overwrite = confirm(`A face with name "${label.trim()}" already exists. Overwrite?`);
            if (!overwrite) {
                throw new Error('Enrollment cancelled');
            }
        }

        return this.enrollFace(faceDescriptor, label.trim());
    }

    /**
     * Get recognition statistics
     */
    getStats() {
        return {
            enrolledCount: this.enrolledFaces.size,
            hasEnrolledFaces: this.enrolledFaces.size > 0,
            enrolledLabels: this.getEnrolledFaces()
        };
    }
}

// Export for use in other modules
window.FaceRecognizer = FaceRecognizer;