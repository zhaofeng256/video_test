const express = require('express');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = 3000;

// 设置静态文件夹，存放视频文件
app.use(express.static('videos'));

// API 路由，用于流式传输视频
app.get('/video', (req, res) => {
  const videoPath = 'videos/sample.mp4'; // 请替换为您的视频文件路径

  // 使用 fluent-ffmpeg 转码为 h264 视频流
  ffmpeg()
    .input(videoPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .outputFormat('mp4')
    .on('end', () => {
      console.log('Streaming finished');
    })
    .on('error', function(err, stdout, stderr) {
        if (err) {
            console.log(err.message);
            console.log("stdout:\n" + stdout);
            console.log("stderr:\n" + stderr);
            reject("Error");
        }
    })
    .pipe(res, { end: true });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
