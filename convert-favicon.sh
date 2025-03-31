#!/bin/bash

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is not installed. Please install it with 'brew install imagemagick' or 'apt-get install imagemagick'"
    exit 1
fi

# Create various sizes of the favicon
convert -background transparent favicon.svg -resize 16x16 favicon-16x16.png
convert -background transparent favicon.svg -resize 32x32 favicon-32x32.png
convert -background transparent favicon.svg -resize 48x48 favicon-48x48.png
convert -background transparent favicon.svg -resize 64x64 favicon-64x64.png
convert -background transparent favicon.svg -resize 128x128 favicon-128x128.png

# Create the favicon.ico (multi-size icon file)
convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon-64x64.png favicon.ico

echo "Favicon files created successfully!" 