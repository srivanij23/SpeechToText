let mediaRecorder;
let audioChunks = [];
const micButton = document.getElementById('micButton');
const status = document.getElementById('status');
const result = document.getElementById('transcriptionResult');
const downloadButton = document.getElementById('downloadButton');
const clearButton = document.getElementById('clearButton');

// File upload handling
document.getElementById('audioFile').addEventListener('change', handleFileUpload);

// Microphone handling
micButton.addEventListener('click', toggleRecording);

async function toggleRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        startRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 44100
            }
        });
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm'
        });
        audioChunks = [];

        mediaRecorder.addEventListener('dataavailable', event => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', processRecording);

        mediaRecorder.start();
        micButton.textContent = 'Stop Recording';
        micButton.classList.add('recording');
        status.textContent = 'Recording...';
    } catch (err) {
        status.textContent = 'Error: ' + err.message;
        status.classList.add('error');
    }
}

function stopRecording() {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    micButton.textContent = 'Start Recording';
    micButton.classList.remove('recording');
}

// Update the file input accept attribute
const audioFileInput = document.getElementById('audioFile');
audioFileInput.accept = "audio/wav";  // Accept only WAV files

async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check file type
    if (file.type !== 'audio/wav') {
        status.textContent = 'Error: Please upload a WAV file only';
        status.classList.add('error');
        return;
    }

    status.textContent = 'Processing audio...';
    result.textContent = '';

    const formData = new FormData();
    formData.append('audio', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (data.success) {
            status.textContent = 'Transcription complete!';
            result.textContent = data.text;
            downloadButton.style.display = 'block';
            clearButton.style.display = 'block';
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        status.textContent = 'Error: ' + error.message;
        status.classList.add('error');
    }
}

// Remove the duplicate processRecording function and keep only the WAV conversion one
async function processRecording() {
    status.textContent = 'Processing audio...';
    
    // Convert webm to wav using Web Audio API
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Convert AudioBuffer to WAV format
        const wavBlob = await convertToWav(audioBuffer);
        const formData = new FormData();
        formData.append('audio', wavBlob, 'recording.wav');

        const uploadResponse = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await uploadResponse.json();  // Changed from response to uploadResponse
        
        if (data.success) {
            status.textContent = 'Transcription complete!';
            result.textContent = data.text;
            downloadButton.style.display = 'block';
            clearButton.style.display = 'block';
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        status.textContent = 'Error: ' + error.message;
        status.classList.add('error');
    } finally {
        URL.revokeObjectURL(audioUrl);
    }
}

// Add this new function for WAV conversion
function convertToWav(audioBuffer) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, audioBuffer.sampleRate, true);
    view.setUint32(28, audioBuffer.sampleRate * 2 * numOfChannels, true);
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    // Write audio data
    for (let i = 0; i < numOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < audioBuffer.length) {
        for (let i = 0; i < numOfChannels; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(44 + offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function downloadTranscript() {
    const text = document.getElementById('transcriptionResult').textContent;
    if (!text) {
        status.textContent = 'No text to download';
        status.classList.add('error');
        setTimeout(() => {
            status.textContent = '';
            status.classList.remove('error');
        }, 2000);
        return;
    }

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:]/g, '-');
    const fileName = `speech_transcript_${timestamp}.txt`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    
    if (window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, fileName);
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    status.textContent = 'Transcript downloaded successfully!';
    setTimeout(() => status.textContent = '', 2000);
}

function clearTranscript() {
    if (!result.textContent) {
        status.textContent = 'Nothing to clear';
        status.classList.add('error');
        setTimeout(() => {
            status.textContent = '';
            status.classList.remove('error');
        }, 2000);
        return;
    }

    result.textContent = '';
    status.textContent = 'Transcript cleared';
    downloadButton.style.display = 'none';
    clearButton.style.display = 'none';
    
    setTimeout(() => {
        status.textContent = '';
    }, 2000);
}

// Update the success blocks in processRecording and handleFileUpload
if (data.success) {
    status.textContent = 'Transcription complete!';
    result.textContent = data.text;
    downloadButton.style.display = 'inline-block';  // Changed from 'block'
    clearButton.style.display = 'inline-block';     // Changed from 'block'
}