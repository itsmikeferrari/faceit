/**
 * Camera Manager Module
 * Handles camera access and stream management
 */

class CameraManager {
    constructor() {
        this.stream = null;
        this.currentDeviceId = null;
        this.availableDevices = [];
        this.isActive = false;
    }

    /**
     * Check if getUserMedia is supported
     */
    isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Get available video input devices
     */
    async getAvailableDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableDevices = devices.filter(device => device.kind === 'videoinput');
            return this.availableDevices;
        } catch (error) {
            console.error('Error enumerating devices:', error);
            throw new Error('Unable to access camera devices');
        }
    }

    /**
     * Start camera with specified constraints
     */
    async startCamera(deviceId = null, constraints = {}) {
        if (!this.isSupported()) {
            throw new Error('Camera access is not supported in this browser');
        }

        try {
            // Stop existing stream first
            await this.stopCamera();

            // Default constraints
            const videoConstraints = {
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                frameRate: { ideal: 30, max: 60 },
                facingMode: 'user',
                ...constraints
            };

            // Use specific device if provided
            if (deviceId) {
                videoConstraints.deviceId = { exact: deviceId };
                delete videoConstraints.facingMode; // Remove facingMode when using deviceId
            }

            const streamConstraints = {
                video: videoConstraints,
                audio: false
            };

            console.log('Requesting camera access with constraints:', streamConstraints);
            
            this.stream = await navigator.mediaDevices.getUserMedia(streamConstraints);
            this.currentDeviceId = deviceId;
            this.isActive = true;
            
            console.log('Camera started successfully');
            return this.stream;
            
        } catch (error) {
            console.error('Error starting camera:', error);
            
            // Provide user-friendly error messages
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera access denied. Please allow camera permissions and reload the page.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera found. Please connect a camera and try again.');
            } else if (error.name === 'NotReadableError') {
                throw new Error('Camera is being used by another application.');
            } else if (error.name === 'OverconstrainedError') {
                throw new Error('Camera constraints cannot be satisfied.');
            } else {
                throw new Error(`Camera error: ${error.message}`);
            }
        }
    }

    /**
     * Stop the camera stream
     */
    async stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
            this.isActive = false;
            console.log('Camera stopped');
        }
    }

    /**
     * Switch to next available camera
     */
    async switchCamera() {
        try {
            await this.getAvailableDevices();
            
            if (this.availableDevices.length <= 1) {
                throw new Error('No additional cameras available');
            }

            // Find current device index
            let currentIndex = this.availableDevices.findIndex(
                device => device.deviceId === this.currentDeviceId
            );

            // Move to next device (or first if current not found)
            const nextIndex = (currentIndex + 1) % this.availableDevices.length;
            const nextDevice = this.availableDevices[nextIndex];

            console.log(`Switching to camera: ${nextDevice.label || 'Unknown'}`);
            
            return await this.startCamera(nextDevice.deviceId);
            
        } catch (error) {
            console.error('Error switching camera:', error);
            throw error;
        }
    }

    /**
     * Get current stream
     */
    getStream() {
        return this.stream;
    }

    /**
     * Check if camera is active
     */
    isActiveCamera() {
        return this.isActive && this.stream && this.stream.active;
    }

    /**
     * Get camera capabilities
     */
    getCapabilities() {
        if (!this.stream) return null;

        const videoTrack = this.stream.getVideoTracks()[0];
        return videoTrack ? videoTrack.getCapabilities() : null;
    }

    /**
     * Get current settings
     */
    getSettings() {
        if (!this.stream) return null;

        const videoTrack = this.stream.getVideoTracks()[0];
        return videoTrack ? videoTrack.getSettings() : null;
    }

    /**
     * Apply new constraints to active stream
     */
    async applyConstraints(constraints) {
        if (!this.stream) {
            throw new Error('No active camera stream');
        }

        try {
            const videoTrack = this.stream.getVideoTracks()[0];
            if (videoTrack) {
                await videoTrack.applyConstraints(constraints);
                console.log('Camera constraints applied:', constraints);
            }
        } catch (error) {
            console.error('Error applying constraints:', error);
            throw new Error(`Failed to apply camera constraints: ${error.message}`);
        }
    }

    /**
     * Get device information
     */
    getCurrentDeviceInfo() {
        if (!this.currentDeviceId) return null;
        
        return this.availableDevices.find(
            device => device.deviceId === this.currentDeviceId
        );
    }
}

// Export for use in other modules
window.CameraManager = CameraManager;