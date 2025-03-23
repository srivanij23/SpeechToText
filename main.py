from flask import Flask, render_template, request, jsonify
import speech_recognition as sr
import os
import base64
import io
import wave
import audioop

app = Flask(__name__)
stt_system = None

class SpeechToTextSystem:
    def __init__(self):
        self.recognizer = sr.Recognizer()
    
    def transcribe_from_file(self, audio_file_path):
        try:
            with sr.AudioFile(audio_file_path) as source:
                audio = self.recognizer.record(source)
                text = self.recognizer.recognize_google(audio)
                return {"success": True, "text": text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def transcribe_from_blob(self, audio_blob):
        try:
            # Convert blob to audio data
            audio_data = base64.b64decode(audio_blob.split(',')[1])
            
            # Create a temporary WAV file
            temp_path = "temp_recording.wav"
            with open(temp_path, 'wb') as f:
                f.write(audio_data)
            
            # Use the file-based transcription method
            result = self.transcribe_from_file(temp_path)
            
            # Clean up
            os.remove(temp_path)
            return result
            
        except Exception as e:
            return {"success": False, "error": str(e)}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'audio' not in request.files:
        return jsonify({"success": False, "error": "No file uploaded"})
    
    file = request.files['audio']
    if file.filename == '':
        return jsonify({"success": False, "error": "No file selected"})
    
    temp_path = "temp_audio.wav"
    file.save(temp_path)
    
    result = stt_system.transcribe_from_file(temp_path)
    os.remove(temp_path)
    
    return jsonify(result)

@app.route('/transcribe-audio', methods=['POST'])
def transcribe_audio():
    audio_blob = request.json.get('audio')
    if not audio_blob:
        return jsonify({"success": False, "error": "No audio data received"})
    
    result = stt_system.transcribe_from_blob(audio_blob)
    return jsonify(result)

if __name__ == "__main__":
    stt_system = SpeechToTextSystem()
    app.run(debug=True)