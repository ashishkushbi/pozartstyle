// Ghibli Style Converter with Enhanced API
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const uploadStatus = document.getElementById('uploadStatus');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const originalCanvas = document.getElementById('originalCanvas');
const processedCanvas = document.getElementById('processedCanvas');
const ctxOriginal = originalCanvas.getContext('2d');
const ctxProcessed = processedCanvas.getContext('2d');

// Free tier API key (replace with your own from replicate.com)
const REPLICATE_API_KEY = 'r8_YourAPIKeyHere'; 
const GHIBLI_MODEL_VERSION = 'a9758cbfbd5ff3c20915657890a5d53b2bae5646c0e9e834b406b0680be1b141';

let originalImage = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    initializeCanvases();
});

function setupEventListeners() {
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            handleFileSelect({ target: fileInput });
        }
    });
    
    convertBtn.addEventListener('click', convertToGhibliStyle);
    downloadBtn.addEventListener('click', downloadResult);
}

function initializeCanvases() {
    [originalCanvas, processedCanvas].forEach(canvas => {
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ccc';
        ctx.font = '16px Nunito Sans';
        ctx.textAlign = 'center';
        ctx.fillText(
            canvas.id === 'originalCanvas' 
                ? 'Original image' 
                : 'Ghibli result',
            canvas.width/2, 
            canvas.height/2
        );
    });
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match('image.*')) {
        showStatus('Please select an image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        originalImage = new Image();
        originalImage.onload = () => {
            drawOriginalImage();
            showStatus('Image ready for Ghibli magic!', 'success');
            convertBtn.disabled = false;
        };
        originalImage.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function drawOriginalImage() {
    const maxWidth = 400;
    const maxHeight = 300;
    let width = originalImage.width;
    let height = originalImage.height;
    
    // Maintain aspect ratio
    if (width > height) {
        if (width > maxWidth) {
            height = (maxWidth / width) * height;
            width = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            width = (maxHeight / height) * width;
            height = maxHeight;
        }
    }
    
    originalCanvas.width = width;
    originalCanvas.height = height;
    processedCanvas.width = width;
    processedCanvas.height = height;
    
    ctxOriginal.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    ctxOriginal.drawImage(originalImage, 0, 0, width, height);
    
    // Reset processed canvas
    ctxProcessed.fillStyle = '#f8f8f8';
    ctxProcessed.fillRect(0, 0, processedCanvas.width, processedCanvas.height);
    ctxProcessed.fillStyle = '#ccc';
    ctxProcessed.font = '16px Nunito Sans';
    ctxProcessed.textAlign = 'center';
    ctxProcessed.fillText('Ghibli result', processedCanvas.width/2, processedCanvas.height/2);
}

async function convertToGhibliStyle() {
    if (!originalImage) return;
    
    showLoading(true);
    showStatus('Creating Ghibli magic...', 'info');
    convertBtn.disabled = true;
    downloadBtn.disabled = true;

    try {
        // Convert canvas to blob
        originalCanvas.toBlob(async (blob) => {
            try {
                // 1. Upload image to temporary hosting
                const formData = new FormData();
                formData.append('image', blob);
                
                const uploadResponse = await fetch('https://api.imgbb.com/1/upload?key=YOUR_IMGBB_KEY', {
                    method: 'POST',
                    body: formData
                });
                
                const uploadData = await uploadResponse.json();
                const imageUrl = uploadData.data.url;
                
                // 2. Send to Replicate API
                const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Token ${REPLICATE_API_KEY}`
                    },
                    body: JSON.stringify({
                        version: GHIBLI_MODEL_VERSION,
                        input: {
                            image: imageUrl,
                            prompt: "Studio Ghibli style, vibrant colors, watercolor",
                            negative_prompt: "photo, realistic, blurry, dark"
                        }
                    })
                });
                
                const prediction = await replicateResponse.json();
                const resultUrl = await pollForResult(prediction.id);
                
                // 3. Display result
                const processedImg = new Image();
                processedImg.crossOrigin = 'anonymous';
                processedImg.onload = () => {
                    ctxProcessed.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
                    ctxProcessed.drawImage(processedImg, 0, 0, processedCanvas.width, processedCanvas.height);
                    showStatus('Ghibli transformation complete!', 'success');
                    downloadBtn.disabled = false;
                };
                processedImg.src = resultUrl;
                
            } catch (error) {
                console.error('API Error:', error);
                showStatus('Using enhanced Ghibli filter...', 'warning');
                applyEnhancedGhibliFilter();
            } finally {
                showLoading(false);
                convertBtn.disabled = false;
            }
        }, 'image/jpeg', 0.9);
        
    } catch (error) {
        console.error('Conversion Error:', error);
        showStatus('Conversion failed', 'error');
        showLoading(false);
        convertBtn.disabled = false;
    }
}

async function pollForResult(predictionId) {
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    
    while (attempts < maxAttempts) {
        const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
            headers: {
                'Authorization': `Token ${REPLICATE_API_KEY}`
            }
        });
        
        const data = await response.json();
        
        if (data.status === 'succeeded') {
            return data.output;
        } else if (data.status === 'failed') {
            throw new Error('API processing failed');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
    }
    
    throw new Error('Timeout waiting for result');
}

function applyEnhancedGhibliFilter() {
    // 1. Copy original image
    ctxProcessed.drawImage(originalCanvas, 0, 0);
    
    // 2. Get pixel data
    const imageData = ctxProcessed.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
    const data = imageData.data;
    
    // 3. Apply Ghibli-style transformations
    for (let i = 0; i < data.length; i += 4) {
        // Color quantization (cel-shading)
        data[i] = Math.round(data[i] / 40) * 40;   // Red
        data[i+1] = Math.round(data[i+1] / 40) * 40; // Green
        data[i+2] = Math.round(data[i+2] / 40) * 40; // Blue
        
        // Ghibli color palette adjustments
        // Boost greens and blues
        data[i+1] = Math.min(255, data[i+1] * 1.3); // Greens
        data[i+2] = Math.min(255, data[i+2] * 1.1); // Blues
        
        // Soften reds
        data[i] = data[i] * 0.9;
        
        // Edge enhancement
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        if (brightness < 80) {
            // Dark areas - add blue tint
            data[i] *= 0.8;
            data[i+1] *= 0.8;
            data[i+2] = Math.min(255, data[i+2] * 1.2);
        }
    }
    
    // 4. Apply watercolor effect
    ctxProcessed.putImageData(imageData, 0, 0);
    applyWatercolorEffect();
    
    downloadBtn.disabled = false;
}

function applyWatercolorEffect() {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = processedCanvas.width;
    tempCanvas.height = processedCanvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Create blurred version
    tempCtx.drawImage(processedCanvas, 0, 0);
    tempCtx.filter = 'blur(3px)';
    tempCtx.globalAlpha = 0.4;
    tempCtx.drawImage(processedCanvas, 0, 0);
    
    // Composite back
    ctxProcessed.globalCompositeOperation = 'overlay';
    ctxProcessed.drawImage(tempCanvas, 0, 0);
    ctxProcessed.globalCompositeOperation = 'source-over';
}

function downloadResult() {
    const link = document.createElement('a');
    link.download = `ghibli-style-${Date.now()}.jpg`;
    link.href = processedCanvas.toDataURL('image/jpeg', 0.9);
    link.click();
}

function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = 'status-message';
    
    switch (type) {
        case 'success': uploadStatus.style.color = '#4CAF50'; break;
        case 'error': uploadStatus.style.color = '#F44336'; break;
        case 'warning': uploadStatus.style.color = '#FF9800'; break;
        case 'info': uploadStatus.style.color = '#2196F3'; break;
        default: uploadStatus.style.color = 'var(--text)';
    }
}

function showLoading(show) {
    loadingIndicator.style.display = show ? 'flex' : 'none';
}