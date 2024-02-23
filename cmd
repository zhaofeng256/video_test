ffmpeg -y -i sintel_trailer-1080p.mp4 -force_key_frames "expr:gte(t,n_forced*2)" -sc_threshold 0 -s 1280x720 -c:v libx264 -b:v 1500k -c:a copy -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 -hls_segment_filename "fileSequence%d.m4s" prog_index.m3u8


fmpeg -re -i 1.mp4 -c copy -f mp4 -movflags frag_keyframe+empty_moov sample.mp4

ffmpeg -i 1.mp4 -movflags frag_keyframe+empty_moov -c:v copy -c:a copy videos/sample.mp4