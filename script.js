class DrawingApp {
    constructor() {
        // Canvas and context
        this.canvas = document.getElementById('drawingCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Drawing state
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.startX = 0;
        this.startY = 0;
        this.currentTool = 'pen';
        this.drawingHistory = [];
        this.historyIndex = -1;
        
        // Visual properties
        this.color = '#000000';
        this.secondaryColor = '#ffffff';
        this.brushSize = 5;
        this.opacity = 1;
        this.useGradient = false;
        this.gradient = null;
        
        // Text properties
        this.fontSize = 16;
        this.fontFamily = 'Arial';
        
        // Advanced features
        this.layers = [];
        this.currentLayerIndex = 0;
        this.pressureSensitivity = false;
        this.symmetryMode = false;
        this.symmetryType = 'vertical';
        this.showGrid = false;
        this.showRulers = false;
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.activeText = null;
        this.activeTextPosition = null;
        this.stamps = [];
        
        // Initialize the app
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.setupUI();
        this.createDefaultLayer();
        this.loadDefaultStamps();
        this.updateCanvasBackground();
        this.saveState(); // Initial blank state
    }

    setupCanvas() {
        this.canvas.width = window.innerWidth - 310; // Account for side panels
        this.canvas.height = window.innerHeight - 40; // Account for top toolbar
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.updateDrawingContext();
    }

    setupEventListeners() {
        // Window events
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Canvas events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('mouseout', this.stopDrawing.bind(this));
        this.canvas.addEventListener('wheel', this.handleZoom.bind(this), { passive: false });
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Tool buttons
        document.getElementById('penTool').addEventListener('click', () => this.setTool('pen'));
        document.getElementById('eraserTool').addEventListener('click', () => this.setTool('eraser'));
        document.getElementById('rectTool').addEventListener('click', () => this.setTool('rect'));
        document.getElementById('circleTool').addEventListener('click', () => this.setTool('circle'));
        document.getElementById('lineTool').addEventListener('click', () => this.setTool('line'));
        document.getElementById('textTool').addEventListener('click', () => this.setTool('text'));
        document.getElementById('bucketTool').addEventListener('click', () => this.setTool('bucket'));
        document.getElementById('eyedropperTool').addEventListener('click', () => this.setTool('eyedropper'));
        
        // Color and brush controls
        document.getElementById('colorPicker').addEventListener('input', (e) => {
            this.color = e.target.value;
            this.updateDrawingContext();
        });
        
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.brushSize = e.target.value;
            document.getElementById('brushSizeValue').textContent = this.brushSize;
            this.updateDrawingContext();
        });
        
        document.getElementById('opacity').addEventListener('input', (e) => {
            this.opacity = e.target.value / 100;
            document.getElementById('opacityValue').textContent = `${e.target.value}%`;
            this.updateDrawingContext();
        });
        
        // File operations
        document.getElementById('saveCanvas').addEventListener('click', this.saveCanvas.bind(this));
        document.getElementById('loadCanvas').addEventListener('click', () => document.getElementById('fileInput').click());
        document.getElementById('fileInput').addEventListener('change', this.loadCanvas.bind(this));
        document.getElementById('clearCanvas').addEventListener('click', this.clearCanvas.bind(this));
        
        // Undo/redo
        document.getElementById('undoBtn').addEventListener('click', this.undo.bind(this));
        document.getElementById('redoBtn').addEventListener('click', this.redo.bind(this));
        
        // Layer operations
        document.getElementById('addLayer').addEventListener('click', this.createNewLayer.bind(this));
        
        // Zoom controls
        document.getElementById('zoomIn').addEventListener('click', () => this.adjustZoom(0.1));
        document.getElementById('zoomOut').addEventListener('click', () => this.adjustZoom(-0.1));
        document.getElementById('resetZoom').addEventListener('click', () => this.resetZoom());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
    }

    setupUI() {
        // Set initial active tool
        this.setActiveToolButton('pen');
        
        // Update brush size display
        document.getElementById('brushSizeValue').textContent = this.brushSize;
        document.getElementById('opacityValue').textContent = `${this.opacity * 100}%`;
        document.getElementById('fontSizeValue').textContent = this.fontSize;
        
        // Hide text properties initially
        document.getElementById('textProperties').style.display = 'none';
    }

    // Drawing methods
    startDrawing(e) {
        if (this.currentTool === 'text') {
            this.startTextInput(e);
            return;
        }
        
        this.isDrawing = true;
        const pos = this.getCanvasPosition(e);
        [this.lastX, this.lastY] = [this.startX, this.startY] = [pos.x, pos.y];
        
        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            this.ctx.beginPath();
            this.ctx.moveTo(this.lastX, this.lastY);
        }
        
        // For shape tools, we'll draw a preview
        if (['rect', 'circle', 'line'].includes(this.currentTool)) {
            this.saveTempState();
        }
    }

    draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getCanvasPosition(e);
        const x = pos.x;
        const y = pos.y;
        
        if (this.currentTool === 'pen' || this.currentTool === 'eraser') {
            this.ctx.lineTo(x, y);
            this.ctx.stroke();
            [this.lastX, this.lastY] = [x, y];
        } else if (['rect', 'circle', 'line'].includes(this.currentTool)) {
            // For shapes, draw preview
            this.restoreTempState();
            this.drawShapePreview(this.startX, this.startY, x, y);
        }
    }

    stopDrawing() {
        if (!this.isDrawing) return;
        
        if (['rect', 'circle', 'line'].includes(this.currentTool)) {
            // Finalize the shape
            const currentLayer = this.layers[this.currentLayerIndex];
            const tempCtx = currentLayer.ctx;
            
            this.drawShape(tempCtx, this.startX, this.startY, this.lastX, this.lastY);
            this.saveState();
        }
        
        this.isDrawing = false;
    }

    drawShapePreview(x1, y1, x2, y2) {
        const currentLayer = this.layers[this.currentLayerIndex];
        const ctx = currentLayer.ctx;
        
        switch (this.currentTool) {
            case 'rect':
                ctx.beginPath();
                ctx.rect(x1, y1, x2 - x1, y2 - y1);
                ctx.stroke();
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                ctx.beginPath();
                ctx.arc(x1, y1, radius, 0, Math.PI * 2);
                ctx.stroke();
                break;
            case 'line':
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                break;
        }
    }

    drawShape(ctx, x1, y1, x2, y2) {
        ctx.save();
        this.updateDrawingContext(ctx);
        
        switch (this.currentTool) {
            case 'rect':
                ctx.beginPath();
                ctx.rect(x1, y1, x2 - x1, y2 - y1);
                ctx.stroke();
                if (this.useGradient) {
                    ctx.fill();
                }
                break;
            case 'circle':
                const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                ctx.beginPath();
                ctx.arc(x1, y1, radius, 0, Math.PI * 2);
                ctx.stroke();
                if (this.useGradient) {
                    ctx.fill();
                }
                break;
            case 'line':
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                break;
        }
        
        ctx.restore();
    }

    // Tool management
    setTool(tool) {
        this.currentTool = tool;
        this.setActiveToolButton(tool);
        
        switch (tool) {
            case 'pen':
                this.canvas.style.cursor = 'crosshair';
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = this.color;
                break;
            case 'eraser':
                this.canvas.style.cursor = 'crosshair';
                this.ctx.globalCompositeOperation = 'destination-out';
                this.ctx.strokeStyle = 'rgba(0,0,0,1)';
                break;
            case 'text':
                this.canvas.style.cursor = 'text';
                break;
            default:
                this.canvas.style.cursor = 'crosshair';
                this.ctx.globalCompositeOperation = 'source-over';
                this.ctx.strokeStyle = this.color;
        }
        
        // Show/hide tool-specific UI
        document.getElementById('textProperties').style.display = 
            tool === 'text' ? 'block' : 'none';
    }

    setActiveToolButton(tool) {
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${tool}Tool`).classList.add('active');
    }

    // Layer management
    createDefaultLayer() {
        this.createNewLayer();
    }

    createNewLayer() {
        const layer = {
            canvas: document.createElement('canvas'),
            visible: true,
            name: `Layer ${this.layers.length + 1}`,
            opacity: 1,
            blendMode: 'source-over'
        };
        layer.canvas.width = this.canvas.width;
        layer.canvas.height = this.canvas.height;
        layer.ctx = layer.canvas.getContext('2d');
        this.layers.push(layer);
        this.currentLayerIndex = this.layers.length - 1;
        this.updateLayersUI();
    }

    updateLayersUI() {
        const layersList = document.getElementById('layersList');
        layersList.innerHTML = '';
        
        this.layers.forEach((layer, index) => {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${index === this.currentLayerIndex ? 'active' : ''}`;
            layerItem.innerHTML = `
                <input type="checkbox" class="layer-visibility" ${layer.visible ? 'checked' : ''}>
                <span>${layer.name}</span>
                <div class="layer-actions">
                    <i class="fas fa-trash"></i>
                </div>
            `;
            layerItem.addEventListener('click', () => this.selectLayer(index));
            layersList.appendChild(layerItem);
        });
    }

    selectLayer(index) {
        this.currentLayerIndex = index;
        this.updateLayersUI();
    }

    // File operations
    saveCanvas() {
        const link = document.createElement('a');
        link.download = `drawing-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = this.canvas.toDataURL('image/png');
        link.click();
    }

    loadCanvas(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const currentLayer = this.layers[this.currentLayerIndex];
                currentLayer.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                
                // Scale image to fit canvas while maintaining aspect ratio
                const scale = Math.min(
                    this.canvas.width / img.width,
                    this.canvas.height / img.height
                );
                const width = img.width * scale;
                const height = img.height * scale;
                const x = (this.canvas.width - width) / 2;
                const y = (this.canvas.height - height) / 2;
                
                currentLayer.ctx.drawImage(img, x, y, width, height);
                this.renderLayers();
                this.saveState();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    clearCanvas() {
        if (confirm('Are you sure you want to clear the canvas?')) {
            const currentLayer = this.layers[this.currentLayerIndex];
            currentLayer.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.renderLayers();
            this.saveState();
        }
    }

    // Undo/redo functionality
    saveState() {
        // Limit history to 50 states to prevent memory issues
        if (this.drawingHistory.length >= 50) {
            this.drawingHistory.shift();
        } else {
            this.historyIndex++;
        }
        
        // Save the state of all layers
        const state = {
            layers: this.layers.map(layer => ({
                imageData: layer.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height),
                visible: layer.visible,
                opacity: layer.opacity,
                blendMode: layer.blendMode
            }))
        };
        
        this.drawingHistory = this.drawingHistory.slice(0, this.historyIndex);
        this.drawingHistory.push(state);
    }

    undo() {
        if (this.historyIndex <= 0) return;
        this.historyIndex--;
        this.restoreState();
    }

    redo() {
        if (this.historyIndex >= this.drawingHistory.length - 1) return;
        this.historyIndex++;
        this.restoreState();
    }

    restoreState() {
        const state = this.drawingHistory[this.historyIndex];
        
        state.layers.forEach((layerState, index) => {
            if (this.layers[index]) {
                this.layers[index].ctx.putImageData(layerState.imageData, 0, 0);
                this.layers[index].visible = layerState.visible;
                this.layers[index].opacity = layerState.opacity;
                this.layers[index].blendMode = layerState.blendMode;
            }
        });
        
        this.renderLayers();
        this.updateLayersUI();
    }

    // Rendering
    renderLayers() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.layers.forEach(layer => {
            if (layer.visible) {
                this.ctx.save();
                this.ctx.globalAlpha = layer.opacity;
                this.ctx.globalCompositeOperation = layer.blendMode;
                this.ctx.drawImage(layer.canvas, 0, 0);
                this.ctx.restore();
            }
        });
    }

    // Utility methods
    updateDrawingContext(ctx = this.ctx) {
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.useGradient ? this.createGradient() : this.color;
        ctx.lineWidth = this.brushSize;
        ctx.globalAlpha = this.opacity;
    }

    createGradient() {
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(1, this.secondaryColor);
        return gradient;
    }

    getCanvasPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.panOffset.x) / this.zoomLevel,
            y: (e.clientY - rect.top - this.panOffset.y) / this.zoomLevel
        };
    }

    handleResize() {
        this.canvas.width = window.innerWidth - 310;
        this.canvas.height = window.innerHeight - 40;
        this.renderLayers();
    }

    // Zoom and pan
    handleZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.adjustZoom(delta, e.clientX, e.clientY);
    }

    adjustZoom(delta, centerX, centerY) {
        const prevZoom = this.zoomLevel;
        this.zoomLevel = Math.min(Math.max(0.1, this.zoomLevel + delta), 5);
        
        if (centerX && centerY) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = centerX - rect.left;
            const mouseY = centerY - rect.top;
            
            // Adjust pan offset to zoom toward mouse position
            this.panOffset.x -= (mouseX - this.panOffset.x) * (this.zoomLevel / prevZoom - 1);
            this.panOffset.y -= (mouseY - this.panOffset.y) * (this.zoomLevel / prevZoom - 1);
        }
        
        document.getElementById('zoomLevel').textContent = `${Math.round(this.zoomLevel * 100)}%`;
        this.applyTransform();
    }

    resetZoom() {
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        document.getElementById('zoomLevel').textContent = '100%';
        this.applyTransform();
    }

    applyTransform() {
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.renderLayers();
    }

    // Text tool
    startTextInput(e) {
        const pos = this.getCanvasPosition(e);
        this.activeTextPosition = pos;
        
        // Show text input modal
        const modal = document.getElementById('textInputModal');
        modal.style.display = 'block';
        document.getElementById('textInput').focus();
        
        // Set up modal buttons
        document.getElementById('confirmText').onclick = () => {
            this.activeText = document.getElementById('textInput').value;
            this.drawText();
            modal.style.display = 'none';
        };
        
        document.getElementById('cancelText').onclick = () => {
            this.activeText = null;
            modal.style.display = 'none';
        };
    }

    drawText() {
        if (!this.activeText || !this.activeTextPosition) return;
        
        const currentLayer = this.layers[this.currentLayerIndex];
        const ctx = currentLayer.ctx;
        
        ctx.save();
        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        ctx.fillStyle = this.color;
        ctx.fillText(this.activeText, this.activeTextPosition.x, this.activeTextPosition.y);
        ctx.restore();
        
        this.renderLayers();
        this.saveState();
    }

    // Stamp tool
    loadDefaultStamps() {
        // In a real app, you would load actual stamp images
        this.stamps = [
            { name: 'Star', icon: 'fa-star' },
            { name: 'Heart', icon: 'fa-heart' },
            { name: 'Cloud', icon: 'fa-cloud' },
            // Add more stamps...
        ];
        
        this.renderStampLibrary();
    }

    renderStampLibrary() {
        const stampsGrid = document.querySelector('.stamps-grid');
        stampsGrid.innerHTML = '';
        
        this.stamps.forEach((stamp, index) => {
            const stampItem = document.createElement('div');
            stampItem.className = 'stamp-item';
            stampItem.innerHTML = `<i class="fas ${stamp.icon}"></i>`;
            stampItem.addEventListener('click', () => this.useStamp(stamp));
            stampsGrid.appendChild(stampItem);
        });
    }

    useStamp(stamp) {
        // In a real app, you would draw the actual stamp image
        const currentLayer = this.layers[this.currentLayerIndex];
        const ctx = currentLayer.ctx;
        
        ctx.save();
        ctx.font = `${this.brushSize * 5}px FontAwesome`;
        ctx.fillStyle = this.color;
        ctx.fillText(stamp.icon, this.lastX, this.lastY);
        ctx.restore();
        
        this.renderLayers();
        this.saveState();
    }

    // Keyboard shortcuts
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 'z': this.undo(); break;
                case 'y': this.redo(); break;
                case 's': e.preventDefault(); this.saveCanvas(); break;
                case 'o': e.preventDefault(); document.getElementById('fileInput').click(); break;
                case 'g': e.preventDefault(); this.toggleGrid(); break;
                case 'r': e.preventDefault(); this.toggleRulers(); break;
                case '0': e.preventDefault(); this.resetZoom(); break;
                case '=': e.preventDefault(); this.adjustZoom(0.1); break;
                case '-': e.preventDefault(); this.adjustZoom(-0.1); break;
            }
        } else {
            switch (e.key.toLowerCase()) {
                case 'p': this.setTool('pen'); break;
                case 'e': this.setTool('eraser'); break;
                case 'r': this.setTool('rect'); break;
                case 'c': this.setTool('circle'); break;
                case 'l': this.setTool('line'); break;
                case 't': this.setTool('text'); break;
                case 'f': this.setTool('bucket'); break;
                case 'i': this.setTool('eyedropper'); break;
                case 'delete': this.clearCanvas(); break;
            }
        }
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        this.updateCanvasBackground();
    }

    toggleRulers() {
        this.showRulers = !this.showRulers;
        // In a real app, you would implement ruler display
    }

    updateCanvasBackground() {
        const bgColor = this.showGrid ? '#f0f0f0' : '#ffffff';
        document.querySelector('.canvas-container').style.backgroundColor = bgColor;
        
        if (this.showGrid) {
            document.querySelector('.canvas-container').style.backgroundImage = `
                linear-gradient(#ddd 1px, transparent 1px),
                linear-gradient(90deg, #ddd 1px, transparent 1px)
            `;
            document.querySelector('.canvas-container').style.backgroundSize = '20px 20px';
        } else {
            document.querySelector('.canvas-container').style.backgroundImage = 'none';
        }
    }

    // Touch support
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
    }

    handleTouchEnd(e) {
        e.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        this.canvas.dispatchEvent(mouseEvent);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new DrawingApp();
});