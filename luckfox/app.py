import os
import time
import json
import threading
import serial
import serial.tools.list_ports
import requests
import subprocess
from flask import Flask, request, jsonify, Response, render_template, redirect, url_for, session
from werkzeug.utils import secure_filename
from functools import wraps
import socket

from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

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
def connect_serial(port_name=None):
    global grbl_serial
    
    # If port specified, try that first
    ports_to_try = []
    if port_name:
        ports_to_try.append(port_name)
    
    # Defaults
    ports_to_try.extend([os.environ.get('SERIAL_PORT'), '/dev/ttyS3', '/dev/ttyUSB0', '/dev/ttyACM0', 'COM3', 'COM4'])
    # Remove None and duplicates
    ports_to_try = list(dict.fromkeys([p for p in ports_to_try if p]))

    for port in ports_to_try:
        try:
            print(f"Attempting to connect to {port}...")
            if not port.startswith('COM') and not os.path.exists(port):
                print(f"Port {port} not found, skipping.")
                continue
                
            if grbl_serial and grbl_serial.is_open:
                grbl_serial.close()

            grbl_serial = serial.Serial(port, BAUD_RATE, timeout=1)
            grbl_serial.write(b"\r\n\r\n")
            time.sleep(2)
            grbl_serial.flushInput()
            print(f"SUCCESS: Connected to GRBL on {port}")
            return port
        except Exception as e:
            print(f"Failed to connect to {port}: {e}")
            
    print("CRITICAL: Failed to connect to any GRBL controller.")
    return None

@app.route('/ports', methods=['GET'])
def list_ports():
    ports = [p.device for p in serial.tools.list_ports.comports()]
    # Add Luckfox default if not detected (it's a UART, might not show in comports)
    if '/dev/ttyS3' not in ports and os.path.exists('/dev/ttyS3'):
        ports.append('/dev/ttyS3')
    return jsonify({"ports": ports})

@app.route('/connect', methods=['POST'])
def connect_endpoint():
    data = request.json
    port = data.get('port')
    connected_port = connect_serial(port)
    if connected_port:
        return jsonify({"status": "connected", "port": connected_port})
    return jsonify({"status": "error", "message": "Failed to connect"}), 500

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

# --- PID Controller ---
class PIDController:
    def __init__(self, p=1.0, i=0.1, d=0.05):
        self.kp = p
        self.ki = i
        self.kd = d
        self.prev_error = 0
        self.integral = 0
        self.last_time = time.time()

    def update(self, setpoint, measured_value):
        current_time = time.time()
        dt = current_time - self.last_time
        if dt <= 0: return 0
        
        error = setpoint - measured_value
        self.integral += error * dt
        derivative = (error - self.prev_error) / dt
        
        output = (self.kp * error) + (self.ki * self.integral) + (self.kd * derivative)
        
        self.prev_error = error
        self.last_time = current_time
        return output

# --- Background Thread: G-Code Streamer ---
def stream_gcode(filepath, auto_mode=False, feed_rate=None, heat_duty=None, pid_values=None):
    global job_control
    
    pid = None
    if auto_mode and pid_values:
        pid = PIDController(pid_values.get('p', 1.0), pid_values.get('i', 0.1), pid_values.get('d', 0.05))

    with state_lock:
        machine_state["status"] = "Run"
        machine_state["current_file"] = os.path.basename(filepath)
        machine_state["current_line"] = 0
        job_control["running"] = True
        job_control["paused"] = False
        job_control["stop_requested"] = False
        
        # Apply Auto Mode initial settings
        if auto_mode:
            if heat_duty is not None:
                machine_state["heat_duty"] = heat_duty
                # TODO: Set actual PWM here
            if feed_rate is not None:
                # We can't easily override F commands in G-code file without parsing/replacing
                # For now, we assume the file uses F parameters or we send an override command
                pass

    send_event("info", "job_start", f"Starting job: {os.path.basename(filepath)} (Auto: {auto_mode})")

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

            # PID Update Loop (Simulated for now as we lack temp feedback)
            if pid and auto_mode:
                # In a real system, we'd read temp here. 
                # For now, we just simulate maintaining the setpoint duty
                # current_temp = read_temp() 
                # adjustment = pid.update(target_temp, current_temp)
                # set_pwm(adjustment)
                pass

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
            # Auto-off heat after job? Maybe safer.
            if auto_mode:
                machine_state["heat_duty"] = 0
                # TODO: Kill PWM

# ... (Auth & WiFi helpers omitted) ...

@app.route('/start', methods=['POST'])
@login_required
def start_job():
    data = request.json
    filename = data.get('filename')
    
    # Auto Mode Parameters
    auto_mode = data.get('auto_mode', False)
    feed_rate = data.get('feed_rate')
    heat_duty = data.get('heat_duty')
    pid_values = data.get('pid_values')
    
    filepath = filename
    if not os.path.exists(filepath):
         filepath = os.path.join(UPLOAD_FOLDER, filename)
         if not os.path.exists(filepath):
             return jsonify({"error": "File not found"}), 404

    if job_control["running"]:
        return jsonify({"error": "Job already running"}), 409

    t = threading.Thread(target=stream_gcode, args=(filepath, auto_mode, feed_rate, heat_duty, pid_values))
    t.daemon = True
    t.start()
    return jsonify({"status": "started"})

# ... (Pause/Resume omitted) ...

@app.route('/stop', methods=['POST'])
@login_required
def stop_job():
    job_control["stop_requested"] = True
    
    # KILL SWITCH LOGIC
    # 1. Stop Motion
    if grbl_serial:
        grbl_serial.write(b"\x18") # Soft reset
    
    # 2. Kill Heat (Safety)
    with state_lock:
        machine_state["heat_duty"] = 0
    # TODO: Explicitly set PWM to 0 here immediately
    
    return jsonify({"status": "stopped", "safety": "heat_killed"})

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

# --- Safety Monitor Thread ---
def safety_monitor():
    last_pos = {"x": 0, "y": 0, "z": 0}
    last_move_time = time.time()
    
    while True:
        with state_lock:
            status = machine_state["status"]
            heat = machine_state["heat_duty"]
            # Assume we parse MPOS from GRBL status reports (not fully implemented in this snippet, but placeholder logic)
            # current_pos = machine_state.get("mpos", {"x":0, "y":0, "z":0}) 
        
        # 1. Fire Safety: Heat ON but Idle for > 5s
        if heat > 0 and status in ["Idle", "Alarm"]:
            # Check how long we've been idle with heat on? 
            # For simplicity, just kill it immediately if Idle
            print("SAFETY: Heat killed due to Idle state")
            with state_lock:
                machine_state["heat_duty"] = 0
            # TODO: PWM 0
        
        # 2. Stall Detection (Placeholder)
        # If status == "Run" and pos == last_pos for > 10s -> E-Stop
        
        time.sleep(1)

@app.route('/command', methods=['POST'])
@login_required
def send_command():
    data = request.json
    cmd = data.get('cmd')
    if cmd and grbl_serial:
        grbl_serial.write((cmd + '\n').encode())
        return jsonify({"status": "sent", "cmd": cmd})
    return jsonify({"status": "error", "message": "No command or serial"}), 400

if __name__ == '__main__':
    connect_serial()
    
    # Start heartbeat
    hb_thread = threading.Thread(target=heartbeat_loop)
    hb_thread.daemon = True
    hb_thread.start()
    
    # Start Safety Monitor
    safety_thread = threading.Thread(target=safety_monitor)
    safety_thread.daemon = True
    safety_thread.start()
    
    app.run(host='0.0.0.0', port=5000)
