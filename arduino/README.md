# Phase 1: Arduino Motion Controller (GRBL) Setup

## 1. Hardware Wiring
- **CNC Shield**: Plug the CNC shield onto the Arduino Uno.
- **Stepper Drivers**: Insert A4988 or DRV8825 drivers into the X and Y axis slots on the shield. Ensure orientation is correct (potentiometer usually faces away from the power terminal, but check your specific driver pinout!).
- **Motors**: Connect NEMA 17 stepper motors to the X and Y headers.
- **Power**: Connect 12V-24V DC power to the blue screw terminal on the CNC shield. **Do not power motors via USB only.**

## 2. Flashing GRBL
1. Download [grbl](https://github.com/gnea/grbl) as a .zip.
2. Open Arduino IDE.
3. Sketch -> Include Library -> Add .ZIP Library -> Select the grbl folder inside the zip.
4. File -> Examples -> grbl -> grblUpload.
5. Select your Board (Arduino Uno) and Port.
6. Click Upload.

## 3. Configuration
Connect via a G-code sender (e.g., UGS, bCNC, or Serial Monitor at 115200 baud).
Send `$$` to see settings. Key settings to tune:

- `$100`: X steps/mm (Calculate: `(steps_per_rev * microsteps) / (pitch * teeth)` or `(200 * 16) / (2 * 20)` etc.)
- `$101`: Y steps/mm
- `$110`: X Max rate (mm/min)
- `$111`: Y Max rate
- `$120`: X Acceleration (mm/sec^2)
- `$121`: Y Acceleration

## 4. Testing
Send `$J=G91 X10 F100` to jog X axis 10mm.
Send `$J=G91 Y10 F100` to jog Y axis 10mm.
