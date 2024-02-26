// 示例数组
const myArray = [1, 2, 3, 4, 5];

// 获取数组长度
const arrayLength = myArray.length;

console.log(arrayLength);  // 输出：5

myArray.push(6)
console.log(myArray.length, myArray[2])

if ( 100 != 100)
    console.log('n')
else
    console.log('y')

const a = {m:1,n:2,}
a.m = 200
a.n = 2
m = a.m
b = `aa-${a.m}`
console.log(b)


const streamSaver = {
  createWriteStream,
}
function createWriteStream() {
  console.log('streamSaver', b)
}



const regex = /;\\s*\/\/.*$/gm;
const text = `
  someCode; // This is a comment
  anotherCode ;  // This is another comment with spaces
  finalCode;// This is the last comment
`;

const matches = text.replace(regex, '');
console.log(matches);
function mma() {
     console.log('mma');
}
mma()


c = 'adfadfasd'
const len = c.length < 10 ? c.length : 10;
console.log(len, c.substring(0, 20))