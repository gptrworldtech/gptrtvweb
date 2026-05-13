const line = "https://jiotvpllive.cdn.jio.com/bpk-tv/Star_Sports_HD1_Hindi_BTS/output/index.mpd?__hdnea__=st=1775184338~exp=1775205938~acl=/*~hmac=23e4b076c43854a33c7b157410328ab0465957dbcd2ba30ce8fc13d90e1466b3&xxx=%7Ccookie=__hdnea__=st=1775184338~exp=1775205938~acl=/*~hmac=23e4b076c43854a33c7b157410328ab0465957dbcd2ba30ce8fc13d90e1466b3";
const currentCh = {
  keyId: "400131994b445d8c8817202248760fda", 
  key: "2d56cb6f07a75b9aff165d534ae2bfc4",
  cookie: "__hdnea__=st=1775184338~exp=1775205938~acl=/*~hmac=23e4b076c43854a33c7b157410328ab0465957dbcd2ba30ce8fc13d90e1466b3"
};

let playerLink = `https://dash.vodep39240327.workers.dev/?url=${encodeURIComponent(line)}`;
if (currentCh.keyId && currentCh.key) {
  playerLink += `&keyId=${currentCh.keyId}&key=${currentCh.key}`;
}
if (currentCh.cookie) {
  playerLink += `&cookie=${encodeURIComponent(currentCh.cookie)}`;
}
console.log("My generated:");
console.log(playerLink);

console.log("Expected format like output.json:");
console.log("https://dash.vodep39240327.workers.dev/?url=https://jiotvpllive.cdn.jio.com/bpk-tv/Star_Sports_HD1_Hindi_BTS/output/index.mpd?name=Star_Sports_HD1_Hindi&keyId=400131994b445d8c8817202248760fda&key=2d56cb6f07a75b9aff165d534ae2bfc4&cookie=__hdnea__=st=1775184338~exp=1775205938~acl=/*~hmac=23e4b076c43854a33c7b157410328ab0465957dbcd2ba30ce8fc13d90e1466b3");
