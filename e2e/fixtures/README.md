`clip-with-audio.mp4` is a two-second black H.264 video with an audible 1 kHz AAC tone. Browser tests use this synthetic fixture without requiring FFmpeg on the test machine.

To regenerate it with FFmpeg:

```sh
ffmpeg -f lavfi -i "color=c=black:s=16x16:r=10:d=2" -f lavfi -i "sine=frequency=1000:sample_rate=24000:duration=2" -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 24k -movflags +faststart clip-with-audio.mp4
```
