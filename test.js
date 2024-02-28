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


const k = {
  a:0,
  b:'',
}
c=[]
c.push(k)
f = c[0]
f.a = 1

console.log(k, c[0])

d = [1,2,3,4]
d.shift()
console.log(d)
d.pop()
console.log(d)

d = null
d=[]
d.push(1)
d[0] += 2
console.log(d)

console.log(1%50==1)

let v = [1,2,3]
b = {name:1,v}
v.push(4)
console.log(b)
b.v.pop()
console.log(v)