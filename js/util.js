/* 共用小工具 */
const $ = (id) => document.getElementById(id);
const clone = (x) => JSON.parse(JSON.stringify(x));
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
