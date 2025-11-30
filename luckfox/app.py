import os
import time
import json
import threading
import serial
import requests
import subprocess
from flask import Flask, request, jsonify, Response, render_template, redirect, url_for, session
from werkzeug.utils import secure_filename
from functools import wraps
import socket

app = Flask(__name__)

# --- Configuration ---
app.secret_key = os.environ.get('SECRET_KEY', 'luckfox_secret_key')

# --- Configuration ---
SERIAL_PORT = os.environ.get('SERIAL_PORT', '/dev/ttyS3')
BAUD_RATE = int(os.environ.get('BAUD_RATE', 115200))
WATCHER_URL = os.environ.get('WATCHER_URL', 'https://your-watcher-worker.workers.dev/event')
UPLOAD_FOLDER = '/opt/cnc_jobs'
MACHINE_ID = os.environ.get('MACHINE_ID', 'foam-cnc-01')
ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASS = os.environ.get('ADMIN_PASS', 'luckfox')

# Ensure upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# --- Global State ---
grbl_serial = None
machine_state = {
    "status": "Idle", # Idle, Run, Hold, Alarm
    "last_error": None,
    "current_line": 0,
    "total_lines": 0,
    "current_file": None,
    "heat_duty": 0
}
job_control = {
    "running": False,
    "paused": False,
    "stop_requested": False
}
state_lock = threading.Lock()

# --- Serial Connection ---
def connect_serial():
    global grbl_serial
    try:
        grbl_serial = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        # Wake up GRBL
        grbl_serial.write(b"\r\n\r\n")
        time.sleep(2)
        grbl_serial.flushInput()
        print(f"Connected to GRBL on {SERIAL_PORT}")
    except Exception as e:
        print(f"Failed to connect to serial: {e}")
        send_event("error", "serial_error", f"Failed to connect: {str(e)}")

# --- Helper: Send Event to Cloudflare ---
def send_event(severity, event_type, message, extra=None):
    if not WATCHER_URL or "your-watcher-worker" in WATCHER_URL:
        print(f"[Event Mock] {severity}: {message}")
        return

    payload = {
        "machineId": MACHINE_ID,
        "severity": severity,
        "type": event_type,
        "message": message,
        "timestamp": int(time.time() * 1000),
        "extra": extra or {}
    }
    try:
        requests.post(WATCHER_URL, json=payload, timeout=5)
    except Exception as e:
        print(f"Failed to send event: {e}")

# --- Background Thread: Heartbeat ---
def heartbeat_loop():
    while True:
        send_event("info", "heartbeat", "Luckfox online", {"state": machine_state["status"]})
        time.sleep(60)

# --- Background Thread: G-Code Streamer ---
def stream_gcode(filepath):
    global job_control
    
    with state_lock:
        machine_state["status"] = "Run"
        machine_state["current_file"] = os.path.basename(filepath)
        machine_state["current_line"] = 0
        job_control["running"] = True
        job_control["paused"] = False
        job_control["stop_requested"] = False

    send_event("info", "job_start", f"Starting job: {os.path.basename(filepath)}")

    try:
        with open(filepath, 'r') as f:
            lines = f.readlines()
        
        with state_lock:
            machine_state["total_lines"] = len(lines)

        for i, line in enumerate(lines):
            line = line.strip()
            if not line or line.startswith(';'):
                continue

            # Check control flags
            while job_control["paused"]:
                time.sleep(0.1)
                if job_control["stop_requested"]:
                    break
            
            if job_control["stop_requested"]:
                break

            # Send to GRBL
            if grbl_serial:
                grbl_serial.write((line + '\n').encode())
                
                # Wait for 'ok'
                start_wait = time.time()
                response = b""
                while b"ok" not in response:
                    if time.time() - start_wait > 10: # 10s timeout
                        raise Exception("GRBL timeout waiting for ok")
                    if grbl_serial.in_waiting:
                        response += grbl_serial.read(grbl_serial.in_waiting)
                    time.sleep(0.01)
            else:
                # Simulation mode
                time.sleep(0.1)

            with state_lock:
                machine_state["current_line"] = i + 1

        send_event("info", "job_complete", "Job finished successfully")

    except Exception as e:
        error_msg = f"Job failed: {str(e)}"
        print(error_msg)
        with state_lock:
            machine_state["last_error"] = error_msg
        send_event("error", "job_error", error_msg)
    finally:
        with state_lock:
            machine_state["status"] = "Idle"
            job_control["running"] = False

# --- Authentication Decorator ---
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# --- Wi-Fi Helper ---
def setup_wifi(ssid, password):
    try:
        # Create a wpa_supplicant config block
        config = f"""
network={{
    ssid="{ssid}"
    psk="{password}"
}}
"""
        # Append to config file (common location)
        with open('/etc/wpa_supplicant.conf', 'a') as f:
            f.write(config)
        
        # Reconfigure wpa_supplicant
        subprocess.run(['wpa_cli', '-i', 'wlan0', 'reconfigure'], check=False)
        return True
    except Exception as e:
        print(f"WiFi setup failed: {e}")
        return False

def get_ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

# --- Routes ---

@app.route('/')
@login_required
def dashboard():
    return render_template('dashboard.html', ip_address=get_ip_address())

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        if request.form['username'] == ADMIN_USER and request.form['password'] == ADMIN_PASS:
            session['logged_in'] = True
            return redirect(url_for('dashboard'))
        else:
            error = 'Invalid Credentials'
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    session.pop('logged_in', None)
    return redirect(url_for('login'))

@app.route('/wifi_setup', methods=['POST'])
@login_required
def wifi_setup():
    ssid = request.form.get('ssid')
    password = request.form.get('password')
    if ssid:
        if setup_wifi(ssid, password):
            return "Wi-Fi configured. Check connection."
        else:
            return "Failed to configure Wi-Fi."
    return redirect(url_for('dashboard'))

@app.route('/jog', methods=['POST'])
@login_required
def jog():
    data = request.json
    axis = data.get('axis', '').upper()
    distance = float(data.get('distance', 0))
    feed = float(data.get('feed', 1000))
    
    if axis not in ['X', 'Y', 'Z']:
        return jsonify({"error": "Invalid axis"}), 400

    cmd = f"$J=G91 {axis}{distance} F{feed}\n"
    if grbl_serial:
        grbl_serial.write(cmd.encode())
        return jsonify({"status": "sent", "command": cmd.strip()})
    return jsonify({"status": "simulated", "command": cmd.strip()})

@app.route('/gcode/upload', methods=['POST'])
@login_required
def upload_gcode():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    filename = secure_filename(file.filename)
    timestamp = int(time.time())
    save_path = os.path.join(UPLOAD_FOLDER, f"{timestamp}_{filename}")
    file.save(save_path)
    
    return jsonify({"status": "uploaded", "path": save_path})

@app.route('/start', methods=['POST'])
@login_required
def start_job():
    data = request.json
    filename = data.get('filename') # Can be full path or just basename if we search
    
    # Simple logic: if just basename, look in upload folder (most recent match or exact match)
    # For now assume full path or relative to upload folder
    filepath = filename
    if not os.path.exists(filepath):
         # Try looking in upload folder
         filepath = os.path.join(UPLOAD_FOLDER, filename)
         if not os.path.exists(filepath):
             return jsonify({"error": "File not found"}), 404

    if job_control["running"]:
        return jsonify({"error": "Job already running"}), 409

    t = threading.Thread(target=stream_gcode, args=(filepath,))
    t.daemon = True
    t.start()
    return jsonify({"status": "started"})

@app.route('/pause', methods=['POST'])
@login_required
def pause_job():
    job_control["paused"] = True
    if grbl_serial:
        grbl_serial.write(b"!") # Feed hold
    return jsonify({"status": "paused"})

@app.route('/resume', methods=['POST']) # Added resume for convenience
@login_required
def resume_job():
    job_control["paused"] = False
    if grbl_serial:
        grbl_serial.write(b"~") # Cycle start
    return jsonify({"status": "resumed"})

@app.route('/stop', methods=['POST'])
@login_required
def stop_job():
    job_control["stop_requested"] = True
    if grbl_serial:
        grbl_serial.write(b"\x18") # Soft reset
    return jsonify({"status": "stopped"})

@app.route('/heat', methods=['POST'])
@login_required
def set_heat():
    data = request.json
    duty = float(data.get('duty', 0))
    with state_lock:
        machine_state["heat_duty"] = duty
    # TODO: Implement actual PWM control here
    return jsonify({"status": "set", "duty": duty})

@app.route('/status', methods=['GET'])
def get_status():
    with state_lock:
        return jsonify(machine_state)

# --- Video Feed ---
def gen_frames():
    # Command to capture MJPEG from camera. 
    # Adjust /dev/video0 and resolution as needed for SC3336
    # This is a generic ffmpeg command.
    cmd = [
        'ffmpeg',
        '-f', 'v4l2',
        '-i', '/dev/video0',
        '-f', 'mjpeg',
        '-q:v', '5', # Quality
        '-r', '15',  # FPS
        '-'
    ]
    
    try:
        process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10**6)
        
        # Read MJPEG stream chunk by chunk is tricky without a proper parser.
        # A simpler way for Python is to capture frames individually or use a library.
        # However, for a simple pipe, we can try to read standard JPEG headers.
        # SOI: FF D8, EOI: FF D9
        
        buffer = b""
        while True:
            chunk = process.stdout.read(4096)
            if not chunk:
                break
            buffer += chunk
            a = buffer.find(b'\xff\xd8')
            b = buffer.find(b'\xff\xd9')
            if a != -1 and b != -1:
                jpg = buffer[a:b+2]
                buffer = buffer[b+2:]
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpg + b'\r\n')
    except Exception as e:
        print(f"Camera error: {e}")
        # Yield a placeholder or error frame?
        pass

@app.route('/video_feed')
def video_feed():
    return Response(gen_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    connect_serial()
    
    # Start heartbeat
    hb_thread = threading.Thread(target=heartbeat_loop)
    hb_thread.daemon = True
    hb_thread.start()
    
    app.run(host='0.0.0.0', port=5000)
