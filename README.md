# 🔥 Smart CNC Foam Cutter

```
   _____ __  __          _____ _______   ______ ____          __  __
  / ____|  \/  |   /\   |  __ \__   __| |  ____/ __ \   /\   |  \/  |
 | (___ | \  / |  /  \  | |__) | | |    | |__ | |  | | /  \  | \  / |
  \___ \| |\/| | / /\ \ |  _  /  | |    |  __|| |  | |/ /\ \ | |\/| |
  ____) | |  | |/ ____ \| | \ \  | |    | |   | |__| / ____ \| |  | |
 |_____/|_|  |_/_/    \_\_|  \_\ |_|    |_|    \____/_/    \_\_|  |_|

        CNC Foam Cutter with AI-Powered Slicing & Real-Time Control
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![GRBL](https://img.shields.io/badge/GRBL-1.1h-green)](https://github.com/gnea/grbl)

## 📖 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Hardware Requirements](#hardware-requirements)
- [Technology Stack](#technology-stack)
- [Installation & Setup](#installation--setup)
- [Usage Guide](#usage-guide)
- [API Documentation](#api-documentation)
- [Configuration](#configuration)
- [Safety Features](#safety-features)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## 🎯 Overview

**Smart CNC Foam Cutter** is an advanced, AI-powered CNC hot wire foam cutting machine control system. It combines precision motion control with intelligent automation to transform foam cutting from a manual, expertise-dependent process into an accessible, automated workflow.

### Key Highlights

- **AI-Powered Slicing**: Upload images and let AI generate optimized G-code toolpaths
- **Real-Time Control**: Web-based dashboard with live video feed and position tracking
- **Automated Heat Management**: PID-controlled wire temperature for consistent cuts
- **Edge Computing**: Runs on Luckfox Pico (RV1106) for low-latency local control
- **Cloud Integration**: Cloudflare Pages hosting with edge functions
- **Safety First**: Multi-layer safety monitoring with emergency stop capabilities

## ✨ Features

### 🎨 AI Slicer
- **Image-to-G-code**: Upload PNG/JPG images and automatically generate cutting paths
- **Material Intelligence**: AI recommends heat settings and feed rates based on detected shapes
- **Smart Optimization**: Minimizes air cuts and optimizes tool paths for efficiency

### 🎮 Manual Control
- **3-Axis Jogging**: Precise manual control with configurable step sizes (XY: 1-100mm, Z: 0.1-10mm)
- **Keyboard Shortcuts**: Arrow keys for XY, Q/E or PgUp/PgDn for Z-axis
- **Diagonal Movements**: Corner buttons for 45° diagonal jogging
- **Variable Feed Rate**: 100-2000 mm/min adjustable speed

### 📊 Real-Time Monitoring
- **Live Video Feed**: MJPEG stream from SC3336 camera module
- **Digital Readout (DRO)**: Real-time X/Y/Z position display
- **Progress Tracking**: Current line / total lines indicator
- **Console Logging**: Timestamped event history

### 🔥 Heat Control
- **Manual Mode**: Direct PWM duty cycle control (0-100%)
- **Auto Mode**: PID-controlled temperature maintenance
- **Configurable PID**: Adjustable P, I, D parameters for tuning
- **Safety Cutoff**: Automatic heat disable on idle/alarm states

### 📐 G-Code Editor
- **Syntax Highlighting**: Color-coded G-code display
- **Direct Editing**: Modify toolpaths before execution
- **File Upload**: Support for .gcode, .nc, .txt formats
- **3D Visualization**: Interactive canvas preview with play/pause controls

### 🛡️ Safety Systems
- **Emergency Stop**: Immediate motion halt and heat cutoff
- **Idle Heat Monitoring**: Auto-disable wire heat when machine is idle
- **Connection Watchdog**: Detects communication failures
- **Soft Limits**: Configurable workspace boundaries (via GRBL)

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │           Cloudflare Pages (React + Vite + TS)               │  │
│  │  • 3D G-code Visualizer  • Manual Jog Controls               │  │
│  │  • Heat Management UI    • DRO & Status Display              │  │
│  │  • AI Slicer Upload      • Real-time Video Feed              │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │ HTTPS / WebSocket                       │
└──────────────────────────┼─────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EDGE COMPUTING LAYER                             │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │      Cloudflare Workers (Functions)                          │  │
│  │  • AI Image Analysis (Cloudflare AI Workers)                 │  │
│  │  • G-code Generation                                         │  │
│  │  • Material Recognition                                      │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
└──────────────────────────┼─────────────────────────────────────────┘
                           │ HTTP API
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   LOCAL CONTROL SERVER                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │         Luckfox Pico (RV1106) - Python Flask API             │  │
│  │  • G-code Streaming      • PWM Heat Control                  │  │
│  │  • Position Tracking     • Video Feed (MJPEG)                │  │
│  │  • Safety Monitoring     • Serial Communication              │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │ UART (115200 baud)                      │
└──────────────────────────┼─────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MOTION CONTROLLER                               │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              Arduino Uno + CNC Shield                        │  │
│  │                    GRBL 1.1h Firmware                        │  │
│  │  • Stepper Motor Drivers (A4988/DRV8825)                     │  │
│  │  • Step/Direction Signal Generation                          │  │
│  │  • Soft Limits & Homing                                      │  │
│  └───────────────────────┬──────────────────────────────────────┘  │
│                          │ Step/Dir Pulses                         │
└──────────────────────────┼─────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   PHYSICAL HARDWARE                                 │
│  • NEMA 17 Stepper Motors (X, Y Axes)                              │
│  • Nichrome Hot Wire + PWM Power Supply                            │
│  • SC3336 Camera Module (1080p)                                    │
│  • Foam Cutting Frame                                              │
└─────────────────────────────────────────────────────────────────────┘
```

## 🔧 Hardware Requirements

### Core Components

| Component | Specification | Quantity | Notes |
|-----------|---------------|----------|-------|
| **Luckfox Pico** | RV1106 SBC (256MB RAM) | 1 | Main controller |
| **Arduino Uno** | ATmega328P (16MHz) | 1 | Motion control via GRBL |
| **CNC Shield** | v3.0 or compatible | 1 | Stepper driver carrier |
| **Stepper Drivers** | A4988 or DRV8825 | 2 | X and Y axes |
| **NEMA 17 Motors** | 1.8° step angle | 2+ | Bipolar steppers |
| **Camera** | SC3336 (3MP) | 1 | Integrated with Luckfox |
| **Power Supply** | 12-24V DC, 5A+ | 1 | For motors |
| **Hot Wire PSU** | Variable DC (0-12V) | 1 | Nichrome heating |

### Additional Materials
- Nichrome wire (gauge depends on cutting width)
- Frame (aluminum extrusion or 3D printed)
- Power MOSFETs for PWM heat control
- Limit switches (optional, for homing)
- Emergency stop button

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18.2 with TypeScript
- **Build Tool**: Vite 5.2
- **Styling**: Tailwind CSS 3.4
- **Hosting**: Cloudflare Pages
- **3D Rendering**: HTML5 Canvas (custom G-code visualizer)

### Backend (Luckfox)
- **Runtime**: Python 3.x
- **Framework**: Flask (with CORS)
- **Serial Communication**: PySerial
- **Video Streaming**: FFmpeg (MJPEG)
- **Dependencies**: `flask`, `pyserial`, `requests`, `flask-cors`

### Edge Functions
- **Platform**: Cloudflare Workers (Pages Functions)
- **AI Model**: Cloudflare AI Workers (Vision + LLM)
- **Storage**: Cloudflare KV (for machine state)

### Motion Control
- **Firmware**: GRBL 1.1h
- **Protocol**: G-code over serial (115200 baud)
- **Hardware**: Arduino Uno (ATmega328P)

## 📦 Installation & Setup

### 1. Frontend Deployment (Cloudflare Pages)

#### Prerequisites
- Node.js 20+ and npm
- Cloudflare account
- Wrangler CLI

#### Steps

```bash
# Clone repository
git clone https://github.com/randunun-eng/smart-cnc-foam-cutter.git
cd smart-cnc-foam-cutter/frontend

# Install dependencies
npm install

# Build for production
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=foam-cnc-dashboard

# OR: Connect to Git and enable automatic deployments
# 1. Push to GitHub
# 2. Go to Cloudflare Dashboard > Pages
# 3. Connect your repository and set build command: npm run build
# 4. Set build output directory: dist
```

#### Environment Configuration

Add these bindings in `wrangler.toml`:

```toml
name = "foam-cnc-dashboard"
compatibility_date = "2024-04-05"
pages_build_output_dir = "dist"

[ai]
binding = "AI"

[[kv_namespaces]]
binding = "MACHINE_KV"
id = "YOUR_KV_NAMESPACE_ID"  # Get from Cloudflare dashboard
```

### 2. Luckfox Pico Setup (Backend Server)

#### Prerequisites
- Luckfox Pico with Ubuntu/Debian installed
- Python 3.7+
- Camera module connected

#### Installation

```bash
# SSH into Luckfox Pico
ssh root@<luckfox-ip>

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y python3 python3-pip ffmpeg

# Clone repository
git clone https://github.com/randunun-eng/smart-cnc-foam-cutter.git
cd smart-cnc-foam-cutter/luckfox

# Install Python packages
pip3 install -r requirements.txt

# Configure environment variables
export SERIAL_PORT=/dev/ttyS3        # Adjust for your UART port
export MACHINE_ID=foam-cnc-01
export ADMIN_USER=admin
export ADMIN_PASS=your_secure_password

# Run server
python3 app.py
```

#### Camera Setup

Verify camera is detected:
```bash
ls /dev/video*  # Should show /dev/video0
v4l2-ctl --list-devices
```

#### Autostart (systemd)

Create `/etc/systemd/system/foam-cnc.service`:

```ini
[Unit]
Description=Smart Foam CNC Controller
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/smart-cnc-foam-cutter/luckfox
Environment="SERIAL_PORT=/dev/ttyS3"
Environment="MACHINE_ID=foam-cnc-01"
ExecStart=/usr/bin/python3 app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
systemctl daemon-reload
systemctl enable foam-cnc.service
systemctl start foam-cnc.service
systemctl status foam-cnc.service
```

### 3. Arduino GRBL Flash

#### Method 1: Automated Script (Recommended)

```bash
cd smart-cnc-foam-cutter/arduino
chmod +x flash_grbl.sh
./flash_grbl.sh
```

#### Method 2: Arduino IDE

1. Download [GRBL 1.1h](https://github.com/gnea/grbl/releases/tag/v1.1h.20190825)
2. Open Arduino IDE
3. Sketch → Include Library → Add .ZIP Library → Select `grbl` folder
4. File → Examples → grbl → grblUpload
5. Select Board: **Arduino Uno**
6. Select Port: `/dev/ttyUSB0` or `/dev/ttyACM0`
7. Click **Upload**

#### Method 3: Manual with avrdude

```bash
# Download firmware
wget https://github.com/gnea/grbl/releases/download/v1.1h.20190825/grbl_v1.1h.20190825.hex

# Flash
avrdude -v -p atmega328p -c arduino -P /dev/ttyUSB0 -b 115200 -D -U flash:w:grbl_v1.1h.20190825.hex:i
```

### 4. GRBL Configuration

Connect to Arduino via serial (115200 baud) using a terminal:

```bash
# Linux/Mac
screen /dev/ttyUSB0 115200

# OR use PuTTY on Windows
```

Send `$$` to view settings. Key parameters to configure:

```gcode
$100=80.0    ; X steps/mm (adjust for your mechanics)
$101=80.0    ; Y steps/mm
$102=400.0   ; Z steps/mm (if using Z-axis)
$110=2000.0  ; X max rate (mm/min)
$111=2000.0  ; Y max rate
$112=500.0   ; Z max rate
$120=200.0   ; X acceleration (mm/sec^2)
$121=200.0   ; Y acceleration
$130=400.0   ; X max travel (mm)
$131=400.0   ; Y max travel
$132=100.0   ; Z max travel
$20=1        ; Soft limits enable (1=on)
$21=0        ; Hard limits (0=off for now)
$22=1        ; Homing cycle enable
```

Calculate steps/mm:
```
steps_per_mm = (motor_steps * microstepping) / (pulley_pitch * pulley_teeth)
              = (200 * 16) / (2mm * 20 teeth)  ; Example for GT2 belt
              = 80 steps/mm
```

Test with:
```gcode
$X              ; Unlock (if alarmed)
G91             ; Relative positioning
G1 X10 F500     ; Move X+10mm at 500mm/min
G1 Y-10 F500    ; Move Y-10mm
```

### 5. Hardware Wiring

#### Stepper Motor Connections

```
CNC Shield X-Axis:
  X-STEP  → Arduino D2
  X-DIR   → Arduino D5
  X-EN    → Arduino D8

CNC Shield Y-Axis:
  Y-STEP  → Arduino D3
  Y-DIR   → Arduino D6
  Y-EN    → Arduino D8 (shared)
```

Motor wiring (for NEMA 17 with 4 wires):
- **Phase A**: Coil 1 (usually Red/Blue or Black/Green)
- **Phase B**: Coil 2 (usually Green/Black or Red/Blue)

**Test continuity**: Use multimeter to find coil pairs (resistance ~1-5Ω between coil pairs, infinite between phases).

#### Power Supply

```
12V PSU
  (+) → CNC Shield Power Terminal (+)
  (-) → CNC Shield Power Terminal (-)

NEVER power motors via USB only! Arduino will brown-out.
```

#### Hot Wire Control

```
Luckfox GPIO (PWM) → MOSFET Gate
MOSFET Drain → Nichrome Wire (+)
MOSFET Source → Power Supply (-)
Power Supply (+) → Nichrome Wire (-)
```

Use a logic-level MOSFET (e.g., IRLZ44N) rated for your wire current.

#### UART Connection (Luckfox ↔ Arduino)

```
Luckfox UART3 (TX) → Arduino RX (Pin 0)
Luckfox UART3 (RX) → Arduino TX (Pin 1)
Luckfox GND → Arduino GND
```

**Voltage Warning**: If Luckfox GPIO is 3.3V and Arduino is 5V, use level shifter or voltage divider.

## 🎮 Usage Guide

### Initial Startup

1. **Power On**
   - Apply 12-24V to CNC Shield
   - Boot Luckfox Pico (wait ~30s for Linux to start)
   - Arduino should have solid LED (GRBL initialized)

2. **Access Dashboard**
   - Navigate to: `https://foam-cnc-dashboard.pages.dev`
   - OR your custom domain if configured

3. **Configure Backend URL**
   - Click **⚙️ Settings** (top-right)
   - Enter Luckfox IP: `http://192.168.x.x:5000`
   - Click **Save URL & Reload**

4. **Verify Connection**
   - Green indicator = Backend online
   - Red pulsing = Disconnected (check Luckfox service)

### Manual Jogging

#### Using Buttons
- **Arrow Buttons**: Move XY axes
- **Q / E Buttons**: Move Z up/down
- **Corner Buttons**: Diagonal movements (↖↗↙↘)

#### Using Keyboard
- Focus **outside** text inputs
- **Arrow Keys**: XY control
- **Q / PageUp**: Z up
- **E / PageDown**: Z down

#### Step Size Selection
- **XY Steps**: 1mm, 10mm, 100mm (selectable)
- **Z Steps**: 0.1mm, 1mm, 10mm (finer control)

#### Feed Rate
- Adjust slider: **100-2000 mm/min**
- Higher = faster (but may cause stuttering if too high)

### Running a Job

#### Option 1: Upload G-code File

1. Click **📂 UPLOAD** button (center panel)
2. Select `.gcode`, `.nc`, or `.txt` file
3. Review in editor (green text)
4. Verify in 3D visualizer (preview toolpath)
5. Click **START JOB**

#### Option 2: AI Slicer (Image Upload)

1. Click **🖼️ AI Slicer** drag-drop area
2. Upload PNG/JPG image of desired shape
3. Wait for AI processing (~10-30s)
4. Review generated G-code and recommendations
5. If **Auto Mode** enabled:
   - Heat and feed rate auto-applied
   - PID control activates
6. Click **START JOB**

#### Option 3: Manual G-code Entry

1. Type/paste G-code in editor
2. Use visualizer to verify path
3. Click **START JOB**

### Heat Control

#### Manual Mode
1. Ensure **Auto Mode** is OFF (gray button)
2. Move **Wire Heat** slider (0-100%)
3. Click **ENABLE HEAT**
4. Wire starts heating (monitor via video feed)
5. Click **DISABLE HEAT** when done

#### Auto Mode (PID Control)
1. Click **MODE** button (top-right) → Enable **AUTO (AI)**
2. Adjust **PID Configuration** sliders:
   - **P** (Proportional): 1.0 default
   - **I** (Integral): 0.1 default
   - **D** (Derivative): 0.05 default
3. Run job → PID maintains target temp automatically
4. Heat disables on job completion

### Safety Operations

#### Emergency Stop
- Click **EMERGENCY STOP** (red pulsing button)
- Sends GRBL soft reset (`Ctrl-X`)
- Kills heat immediately
- Requires unlock before next move: Click **UNLOCK** button

#### Soft Reset
- Click **SOFT RESET** (red button in DRO panel)
- Clears GRBL state without power cycle

#### Zeroing Axes
- **Zero X/Y/Z**: Click individual axis buttons
- **ZERO ALL**: Sets current position as 0,0,0 (work coordinates)

#### Homing
- Click **HOME** → Executes `$H` (GRBL homing cycle)
- Requires homing switches to be installed and configured

### Monitoring

- **DRO (Digital Readout)**: Shows real-time X/Y/Z positions
- **Progress**: Line count updates during job
- **Console**: Logs all commands and errors (bottom-right)
- **Video Feed**: Live camera view (top-left)
- **3D Visualizer**: Animated toolpath with progress bar

## 🔌 API Documentation

### Backend API (Luckfox Flask Server)

Base URL: `http://<luckfox-ip>:5000`

#### GET `/status`
Returns machine state.

**Response:**
```json
{
  "status": "Idle",           // Idle | Run | Hold | Alarm
  "last_error": null,
  "current_line": 0,
  "total_lines": 0,
  "current_file": null,
  "heat_duty": 0,
  "mpos": {                   // Machine position (if parsed)
    "x": "0.000",
    "y": "0.000",
    "z": "0.000"
  }
}
```

#### POST `/start`
Start a G-code job.

**Request:**
```json
{
  "filename": "/opt/cnc_jobs/job.gcode",
  "auto_mode": true,          // Optional
  "feed_rate": 800,           // Optional (mm/min)
  "heat_duty": 60,            // Optional (0-100%)
  "pid_values": {             // Optional
    "p": 1.0,
    "i": 0.1,
    "d": 0.05
  }
}
```

**Response:**
```json
{
  "status": "started"
}
```

#### POST `/pause`
Pause current job.

**Response:**
```json
{
  "status": "paused"
}
```

#### POST `/stop`
Stop job and kill heat.

**Response:**
```json
{
  "status": "stopped",
  "safety": "heat_killed"
}
```

#### POST `/heat`
Set heat duty cycle.

**Request:**
```json
{
  "duty": 75  // 0-100%
}
```

**Response:**
```json
{
  "status": "set",
  "duty": 75
}
```

#### POST `/jog`
Jog axis (relative movement).

**Request:**
```json
{
  "axis": "X",        // X | Y | Z
  "distance": 10,     // mm (positive or negative)
  "feed": 1000        // mm/min
}
```

**Response:**
```json
{
  "status": "ok"
}
```

#### POST `/command`
Send raw G-code command.

**Request:**
```json
{
  "cmd": "$X"  // Any GRBL command
}
```

**Response:**
```json
{
  "status": "sent",
  "cmd": "$X"
}
```

#### GET `/video_feed`
MJPEG video stream (multipart HTTP).

**Response:** Continuous stream of JPEG frames

#### GET `/ports`
List available serial ports.

**Response:**
```json
{
  "ports": ["/dev/ttyS3", "/dev/ttyUSB0"]
}
```

#### POST `/connect`
Connect to specific serial port.

**Request:**
```json
{
  "port": "/dev/ttyUSB0"
}
```

**Response:**
```json
{
  "status": "connected",
  "port": "/dev/ttyUSB0"
}
```

### Edge Functions API (Cloudflare Workers)

Base URL: `https://foam-cnc-dashboard.pages.dev/api`

#### POST `/slicer`
Generate G-code from image using AI.

**Request (Multipart Form Data):**
```
image: [File] (PNG/JPG)
prompt: "Generate G-code for this shape." (optional)
```

**Response:**
```json
{
  "gcode": "G21\nG90\nG0 X0 Y0\n...",
  "heat_duty": 65,
  "feed_rate": 800,
  "material": "EPS Foam"
}
```

#### GET `/machine_status?machineId=foam-cnc-01`
Get machine online status from KV store.

**Response:**
```json
{
  "online": true,
  "lastSeen": 1701234567890
}
```

## ⚙️ Configuration

### Frontend Settings

Edit `/frontend/src/App.tsx`:

```typescript
const MACHINE_ID = "foam-cnc-01";           // Unique machine identifier
const WORKER_URL = "/api";                  // Cloudflare Functions path
```

Settings are also accessible via UI (⚙️ button):
- **Backend URL**: Override Luckfox server address
- **Serial Port**: Select Arduino connection

### Backend Environment Variables

Set in Luckfox shell or systemd service:

```bash
export SERIAL_PORT=/dev/ttyS3              # UART device
export BAUD_RATE=115200                    # GRBL baud rate
export MACHINE_ID=foam-cnc-01              # Machine ID
export ADMIN_USER=admin                    # Dashboard auth (if implemented)
export ADMIN_PASS=your_password            # Dashboard auth
export WATCHER_URL=https://your-worker.workers.dev/event  # Optional: remote logging
```

### GRBL Settings

Connect via serial (115200 baud) and send:

```gcode
$$  ; View all settings

; Modify specific parameter:
$100=80.0  ; X steps/mm
```

See [GRBL Configuration Guide](https://github.com/gnea/grbl/wiki/Grbl-v1.1-Configuration) for full reference.

### PID Tuning

Access via **Auto Mode → PID Configuration** panel:

- **P (Proportional)**: Immediate response to error. Too high = oscillation.
- **I (Integral)**: Corrects steady-state error. Too high = overshoot.
- **D (Derivative)**: Dampens oscillations. Too high = noise sensitivity.

**Tuning Process:**
1. Start with P=1.0, I=0, D=0
2. Increase P until minor oscillation, then reduce 50%
3. Increase I slowly until error corrects
4. Add D to reduce overshoot (often not needed for slow thermal systems)

## 🛡️ Safety Features

### Hardware Safety
- **Emergency Stop Button**: Physical wired to GRBL reset (optional)
- **Thermal Cutoff**: Fuse in hot wire circuit (recommended)
- **Current Limiting**: Set stepper driver current pots correctly

### Software Safety

#### 1. Idle Heat Monitor
```python
# In luckfox/app.py safety_monitor()
if heat > 0 and status in ["Idle", "Alarm"]:
    machine_state["heat_duty"] = 0  # Kill heat
```

#### 2. Connection Watchdog
- Frontend polls `/machine_status` every 10s
- Red indicator if backend unreachable

#### 3. Soft Limits
```gcode
$20=1        ; Enable soft limits
$130=400.0   ; X max travel
$131=400.0   ; Y max travel
```

#### 4. Emergency Stop Sequence
1. User clicks **EMERGENCY STOP**
2. Backend sends GRBL soft reset (`\x18`)
3. Heat PWM set to 0
4. All motion halts immediately
5. Machine enters **Alarm** state (requires unlock)

### Best Practices
- ✅ **Never** leave machine unattended during cutting
- ✅ **Always** test new G-code without heat first
- ✅ Keep fire extinguisher nearby
- ✅ Verify hot wire tension before starting
- ✅ Use safety glasses (foam particles)

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Issues

Use [GitHub Issues](https://github.com/randunun-eng/smart-cnc-foam-cutter/issues) to report:
- 🐛 Bugs
- 💡 Feature requests
- 📝 Documentation improvements
- ❓ Questions

Include:
- System details (Luckfox version, Arduino board, browser)
- Steps to reproduce
- Expected vs actual behavior
- Logs (Console output, backend terminal)

### Pull Requests

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

#### Code Style
- **TypeScript**: Follow existing conventions, use ESLint
- **Python**: PEP 8 style, type hints preferred
- **G-code**: Comments for complex toolpaths

### Development Setup

```bash
# Frontend hot reload
cd frontend
npm run dev  # Vite dev server on localhost:5173

# Backend local testing
cd luckfox
python3 app.py  # Flask dev server on 0.0.0.0:5000
```

## 🔧 Troubleshooting

### Frontend Issues

#### ❌ "Failed to connect to backend"
**Causes:**
- Luckfox server not running
- Incorrect IP address in settings
- Firewall blocking port 5000

**Solutions:**
```bash
# Check Luckfox service
ssh root@<luckfox-ip>
systemctl status foam-cnc.service

# Test endpoint
curl http://<luckfox-ip>:5000/status

# Check firewall (if UFW enabled)
ufw allow 5000/tcp
```

#### ❌ "Video feed not loading"
**Causes:**
- Camera not detected
- ffmpeg not installed
- Wrong /dev/video device

**Solutions:**
```bash
# Verify camera
ls /dev/video*
v4l2-ctl --list-devices

# Test ffmpeg
ffmpeg -f v4l2 -i /dev/video0 -frames:v 1 test.jpg

# Check permissions
chmod 666 /dev/video0
```

#### ❌ "G-code visualizer stuck at 0%"
**Cause:** Invalid G-code format

**Solution:** Ensure G-code contains `G0`/`G1` move commands with X/Y coordinates.

### Backend Issues

#### ❌ "CRITICAL: Failed to connect to any GRBL controller"
**Causes:**
- Arduino not connected
- Wrong serial port
- Wrong baud rate
- Arduino not flashed with GRBL

**Solutions:**
```bash
# List serial devices
ls -l /dev/tty*

# Test Arduino connection
screen /dev/ttyUSB0 115200
# Type: $$
# Should see GRBL settings

# Reflash GRBL if needed
cd arduino
./flash_grbl.sh
```

#### ❌ "Python: ModuleNotFoundError"
**Solution:**
```bash
pip3 install -r luckfox/requirements.txt
```

#### ❌ "GRBL timeout waiting for ok"
**Causes:**
- Stepper drivers disabled
- Motion exceeds limits
- GRBL in alarm state

**Solutions:**
```gcode
$X  ; Unlock alarm
$$  ; Check settings
```

### Motion Issues

#### ❌ Motors not moving
**Checks:**
1. **Power**: Is 12V connected to CNC shield?
2. **Enable**: Is stepper enable pin working?
3. **Drivers**: Are pots adjusted? (clockwise = more current)
4. **Wiring**: Verify phase connections

**Test:**
```bash
# Enable verbose mode and send jog
curl -X POST http://<luckfox-ip>:5000/jog \
  -H "Content-Type: application/json" \
  -d '{"axis":"X","distance":10,"feed":500}'

# Watch Arduino serial output
screen /dev/ttyUSB0 115200
```

#### ❌ Motors stuttering or skipping steps
**Causes:**
- Current too low
- Acceleration too high
- Feed rate too fast
- Mechanical binding

**Solutions:**
```gcode
; Reduce acceleration
$120=100.0  ; X accel (was 200)
$121=100.0  ; Y accel

; Reduce max rate
$110=1000.0  ; X max (was 2000)
$111=1000.0  ; Y max
```

#### ❌ Motors moving wrong direction
**Solution:** Reverse motor wiring (swap one coil pair) OR use GRBL direction invert:
```gcode
$3=1  ; Invert X direction
$3=2  ; Invert Y direction
$3=3  ; Invert both X and Y
```

### Heat Control Issues

#### ❌ Wire not heating
**Checks:**
1. **PWM Output**: Is Luckfox GPIO working?
2. **MOSFET**: Is gate receiving signal? (test with multimeter)
3. **Power Supply**: Is voltage present at wire terminals?
4. **Wire Continuity**: Is nichrome wire broken?

**Test PWM:**
```python
# On Luckfox, test GPIO directly
echo 1 > /sys/class/gpio/export
echo out > /sys/class/gpio/gpio1/direction
echo 1 > /sys/class/gpio/gpio1/value  # Should turn on
```

#### ❌ Wire overheating
**Causes:**
- PWM duty too high
- PID tuned too aggressively
- Power supply voltage too high

**Solutions:**
- Lower duty cycle manually
- Reduce P gain
- Add current limiting resistor

### AI Slicer Issues

#### ❌ "Generation failed"
**Causes:**
- Cloudflare AI Workers not configured
- KV namespace missing
- Image too large (>10MB)

**Solutions:**
```bash
# Check wrangler.toml has AI binding
[ai]
binding = "AI"

# Deploy with bindings
npx wrangler pages deploy dist --binding=AI
```

## 📄 License

This project is licensed under the **MIT License**.

```
MIT License

Copyright (c) 2025 Smart CNC Foam Cutter Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 Acknowledgments

- **GRBL Team**: For the incredible CNC controller firmware
- **Cloudflare**: For generous free tier (Pages + Workers + AI)
- **Luckfox**: For affordable ARM SBC with camera integration
- **React & Vite Community**: For modern web development tools

---

## 📧 Contact & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/randunun-eng/smart-cnc-foam-cutter/issues)
- **Project URL**: https://github.com/randunun-eng/smart-cnc-foam-cutter
- **Live Demo**: https://foam-cnc-dashboard.pages.dev

---

## 🗺️ Roadmap

### v2.1 (Next Release)
- [ ] WebSocket support for real-time updates
- [ ] Multi-language support (i18n)
- [ ] Mobile-responsive design improvements
- [ ] SVG/DXF import for 2D shapes

### v3.0 (Future)
- [ ] 4-axis support (dual hot wires)
- [ ] Automatic feed rate optimization (AI)
- [ ] Cloud job queue with remote monitoring
- [ ] Advanced safety features (thermal camera integration)

---

**Made with ❤️ for the maker community**

*If this project helped you, please consider giving it a ⭐ on GitHub!*

