#!/usr/bin/env bash
# Generates offline placeholder media (images + looping videos) for the gallery
# using ffmpeg's built-in generative sources (mandelbrot, life, cellauto, gradients...).
# No network access or external assets required.
set -euo pipefail

FF="$(node -e "console.log(require('ffmpeg-static'))")"
OUT="$(dirname "$0")/../public/media"
mkdir -p "$OUT/images" "$OUT/videos"

# --- Images -----------------------------------------------------------
# name | size | filter chain
gen_image() {
  local name="$1" size="$2" filter="$3"
  "$FF" -y -f lavfi -i "$filter" -frames:v 1 -vf "scale=${size},format=yuv420p" \
    -q:v 3 "$OUT/images/${name}.jpg" -loglevel error
  echo "image: $name"
}

gen_image "img-01" "900x1200" "gradients=size=900x1200:c0=0x0b0f1a:c1=0x3a63ff:c2=0x0b0f1a:x0=100:y0=100:x1=800:y1=1100,eq=saturation=1.2"
gen_image "img-02" "1200x900" "mandelbrot=size=1200x900:rate=1:start_x=-0.75:start_y=0.1:start_scale=2.2,eq=brightness=0.02:saturation=1.3:contrast=1.15"
gen_image "img-03" "1000x1000" "cellauto=size=1000x1000:rule=30:rate=1:scroll=0,colorchannelmixer=rr=0.2:rg=0.1:rb=0.9:gr=0.1:gg=0.3:gb=0.6:br=0.6:bg=0.2:bb=0.9"
gen_image "img-04" "900x1200" "colorspectrum=size=900x1200,hue=h=200,eq=saturation=1.1"
gen_image "img-05" "1200x900" "gradients=size=1200x900:c0=0x1a0b1f:c1=0xff5b3a:c2=0x1a0b1f:nb_colors=3,eq=saturation=1.15"
gen_image "img-06" "1000x1000" "life=size=1000x1000:rate=1:mold=8:life_color=0xffb84d:death_color=0x0b0f1a:mold_color=0x3a1f0b"
gen_image "img-07" "900x1200" "mandelbrot=size=900x1200:rate=1:start_x=-0.16:start_y=1.04:start_scale=1.6,eq=saturation=1.4:gamma=1.05"
gen_image "img-08" "1200x900" "gradients=size=1200x900:c0=0x0b1a14:c1=0x2ee6a6:c2=0x0b0f1a,eq=saturation=1.2"
gen_image "img-09" "1000x1000" "cellauto=size=1000x1000:rule=110:rate=1,colorchannelmixer=rr=0.9:rg=0.3:rb=0.1:gr=0.1:gg=0.2:gb=0.1:br=0.2:bg=0.4:bb=0.9"
gen_image "img-10" "900x1200" "colorspectrum=type=all:size=900x1200,hue=h=280:s=1.1"
gen_image "img-11" "1200x900" "gradients=size=1200x900:c0=0x0b0f1a:c1=0x6a3aff:c2=0xff3aa6:nb_colors=3,eq=saturation=1.25"
gen_image "img-12" "1000x1000" "mandelbrot=size=1000x1000:rate=1:start_x=-0.745:start_y=0.186:start_scale=1.2,eq=saturation=1.3:contrast=1.1"
gen_image "img-13" "900x1200" "life=size=900x1200:rate=1:mold=4:life_color=0x3ad6ff:death_color=0x0b0f1a:mold_color=0x0b2a3a"
gen_image "img-14" "1200x900" "gradients=size=1200x900:c0=0x1a140b:c1=0xffd23a:c2=0x1a0b1f,eq=saturation=1.15"

# --- Videos -------------------------------------------------------------
# short, silent, looping, generative motion clips
gen_video() {
  local name="$1" size="$2" filter="$3" dur="$4"
  "$FF" -y -f lavfi -i "$filter" -t "$dur" \
    -vf "scale=${size},format=yuv420p" \
    -an -c:v libx264 -preset veryfast -crf 28 -maxrate 1200k -bufsize 2400k -movflags +faststart \
    "$OUT/videos/${name}.mp4" -loglevel error
  # WebM/VP9: stock (non-Google-branded) Chromium builds ship without H.264
  # decoding, so a royalty-free fallback keeps the gallery working there too.
  "$FF" -y -f lavfi -i "$filter" -t "$dur" \
    -vf "scale=${size},format=yuv420p" \
    -an -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good -cpu-used 4 \
    "$OUT/videos/${name}.webm" -loglevel error
  echo "video: $name"
}

gen_video "vid-01" "720x960" "mandelbrot=size=720x960:rate=20:start_x=-0.75:start_y=0.1:start_scale=2.4:end_scale=0.6:inner=convergence" 5
gen_video "vid-02" "720x540" "life=size=720x540:rate=10:mold=3:life_color=0xff5b3a:death_color=0x0b0f1a:mold_color=0x3a1f0b:stitch=1" 5
gen_video "vid-03" "900x900" "gradients=size=900x900:c0=0x0b0f1a:c1=0x3a63ff:c2=0xff3aa6:nb_colors=3:speed=0.03,eq=saturation=1.2" 5
gen_video "vid-04" "720x960" "cellauto=size=720x960:rule=30:rate=12:scroll=1" 5
gen_video "vid-05" "960x720" "mandelbrot=size=960x720:rate=20:start_x=-0.16:start_y=1.04:start_scale=1.8:end_scale=0.3,eq=saturation=1.3" 5

echo "done"
