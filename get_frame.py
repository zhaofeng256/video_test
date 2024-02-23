from cv2 import VideoCapture
from cv2 import imwrite
import numpy as np
from pymediainfo import MediaInfo
from moviepy.editor import VideoFileClip

# 定义保存图片函数
# image:要保存的图片名字
# addr；图片地址与相片名字的前部分
# num: 相片，名字的后缀。int 类型
def save_image(image, addr, num):
    address = addr + str(num) + '.jpg'
    print(address)
    imwrite(address, image)

def array_reshape():
    # 假设有一个一维数组
    one_dim_array = np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])

    # 使用reshape将其转换为3维数组，形状为(2, 5, 1)
    three_dim_array = one_dim_array.reshape((2, 3, 2))

    print(three_dim_array)

def array_transpose():
    original_array = np.array([[[1, 2, 3], [4, 5, 6]],
                               [[7, 8, 9], [10, 11, 12]],
                               [[13, 14, 15], [16, 17, 18]]])

    # 使用 numpy.transpose() 函数进行行列互换
    transposed_array_1 = np.transpose(original_array, (1, 0, 2))

    # 使用数组对象的 T 属性进行行列互换
    transposed_array_2 = original_array.T

    # 打印结果
    print("Original Array:")
    print(original_array)

    print("\nTransposed Array (Using numpy.transpose()):")
    print(transposed_array_1)

    print("\nTransposed Array (Using T attribute):")
    print(transposed_array_2)
 
def mp4_info(video_file):
    media_info = MediaInfo.parse(video_file)
    data = media_info.to_json()
    print(data)

def mp4_head_size(file_path):
    # 读取视频文件
    video_clip = VideoFileClip(file_path)

    # 获取文件头信息的大小
    header_size = video_clip.reader.headerend

    print(file_path + f" MP4文件头信息大小: {header_size} 字节")



def extract_frames(input_file, output_folder, start_time, end_time, fps=1):
    # 读取视频文件
    video_clip = VideoFileClip(input_file)

    # 设置截取的时间范围
    subclip = video_clip.subclip(start_time, end_time)

    # 获取截取时间范围内的帧
    frames = subclip.iter_frames(fps=fps, dtype='uint8')

    # 保存每一帧
    for i, frame in enumerate(frames):
        output_file = f"{output_folder}/frame_{i:04d}.png"
        subclip.save_frame(output_file, t=i / fps)

    video_clip.reader.close()

def mp4_extract(input_file):

    # 设置输出文件夹
    output_folder = './extract'

    # 设置截取的时间范围（以秒为单位）
    start_time = 10
    end_time = 15

    # 设置帧率
    fps = 1

    # 创建输出文件夹
    import os
    os.makedirs(output_folder, exist_ok=True)

    # 执行截取
    extract_frames(input_file, output_folder, start_time, end_time, fps)


if __name__ == '__main__':
    #array_reshape()
    #array_transpose()
    #mp4_info('C:/Users/admin/Downloads/1.mp4')

    file_path = 'C:/Users/admin/Downloads/1.mp4'
   
    #mp4_head_size('1.mp4')
    #mp4_head_size(file_path)
    #mp4_extract('1.mp4')
    mp4_extract(file_path)

    height = 406
    width = 720
    depth = 3

    with open(file_path, 'rb') as file:
        target_shape = (height, width, depth)
        data = file.read(height*width*depth)
        flat_array = np.frombuffer(data, dtype=np.uint8)

        # 将一维数组转换为目标形状的三维数组
        target_shape = (height, width, depth)
        three_dim_array  = flat_array[:np.prod(target_shape)].reshape(target_shape)
        save_image(three_dim_array, '1-', 1)
        #transposed_array = np.transpose(three_dim_array, (1, 0, 2))
        #save_image(transposed_array, '1-', 2)
