#!/bin/bash

# GRBL Flashing Script for Smart Foam Cutter
# Uses avrdude to flash pre-compiled GRBL 1.1h to Arduino Uno

HEX_URL="https://github.com/gnea/grbl/releases/download/v1.1h.20190825/grbl_v1.1h.20190825.hex"
HEX_FILE="grbl_v1.1h.hex"

echo "========================================="
echo "   Smart Foam Cutter - GRBL Flasher"
echo "========================================="

# Check for avrdude
if ! command -v avrdude &> /dev/null; then
    echo "Error: avrdude is not installed."
    echo "Please install it using: sudo apt-get install avrdude"
    exit 1
fi

# Download Hex File
if [ ! -f "$HEX_FILE" ]; then
    echo "Downloading GRBL 1.1h firmware..."
    wget -O "$HEX_FILE" "$HEX_URL"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to download firmware."
        exit 1
    fi
else
    echo "Using existing firmware file: $HEX_FILE"
fi

# Detect Serial Port
echo "Detecting Arduino..."
PORTS=$(ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null)

if [ -z "$PORTS" ]; then
    echo "No Arduino found (checked /dev/ttyUSB* and /dev/ttyACM*)."
    echo "Please plug in your Arduino and try again."
    exit 1
fi

# Select Port
PS3="Select your Arduino port: "
select PORT in $PORTS; do
    if [ -n "$PORT" ]; then
        echo "Selected: $PORT"
        break
    else
        echo "Invalid selection."
    fi
done

# Flash
echo "Flashing GRBL to $PORT..."
avrdude -v -p atmega328p -c arduino -P "$PORT" -b 115200 -D -U flash:w:"$HEX_FILE":i

if [ $? -eq 0 ]; then
    echo "========================================="
    echo "   SUCCESS! GRBL 1.1h has been flashed."
    echo "========================================="
else
    echo "========================================="
    echo "   FAILURE! Flashing failed."
    echo "========================================="
fi
