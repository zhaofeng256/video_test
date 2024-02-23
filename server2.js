const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static('videos'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/video', (req, res) => {
  const videoPath = 'videos/sample.mp4';

  // 临时文件目录
  const tempDir = 'temp';
  // 临时文件路径
  const tempFilePath = path.join(tempDir, 'output.mp4');

  // 创建临时文件目录
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  ffmpeg()
    .input(videoPath)
    .videoCodec('libx264')
    .audioCodec('aac')
    .output(tempFilePath)
    .on('end', () => {
      // 读取临时文件并将其流式传输到 HTTP 响应
      const tempFileReadStream = fs.createReadStream(tempFilePath);
      tempFileReadStream.pipe(res);

      tempFileReadStream.on('end', () => {
        // 删除临时文件
        fs.unlinkSync(tempFilePath);
        console.log('Streaming finished');
      });
    })
    .on('error', function(err, stdout, stderr) {
        if (err) {
            console.log(err.message);
            console.log("stdout:\n" + stdout);
            console.log("stderr:\n" + stderr);
            reject("Error");
        }
    })
    .run();
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
